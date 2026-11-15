import asyncio
import os
from contextlib import asynccontextmanager
from datetime import datetime
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException, Header, Query, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

import auth
from database import engine, ensure_schema, get_db
import models

# Standard hospital departments with clinical consultation baseline durations
DEPARTMENTS = [
    {
        "id": "gen_med",
        "name": "General Medicine",
        "code": "GEN",
        "avg_duration_minutes": 10,
        "description": "General adult medical care and initial diagnoses",
    },
    {
        "id": "cardio",
        "name": "Cardiology",
        "code": "CARD",
        "avg_duration_minutes": 15,
        "description": "Heart and cardiovascular system care",
    },
    {
        "id": "ortho",
        "name": "Orthopedics",
        "code": "ORTH",
        "avg_duration_minutes": 12,
        "description": "Bone, joint, spine, and muscle treatments",
    },
    {
        "id": "pedia",
        "name": "Pediatrics",
        "code": "PED",
        "avg_duration_minutes": 10,
        "description": "Infant, child, and adolescent healthcare",
    },
    {
        "id": "derma",
        "name": "Dermatology",
        "code": "DERM",
        "avg_duration_minutes": 10,
        "description": "Skin, hair, and nail health and care",
    },
]

DEPARTMENT_MAP = {d["name"]: d for d in DEPARTMENTS}
VALID_STATUSES = {"WAITING", "IN_PROGRESS", "COMPLETED", "CANCELLED"}

# Concurrency lock to prevent duplicate token numbers across concurrent requests
token_lock = asyncio.Lock()


# -------------------------------------------------------------
# WebSocket Connection Manager
# -------------------------------------------------------------
class ConnectionManager:
    def __init__(self):
        # Store active connections as tuples of (WebSocket, Optional[department])
        self.active_connections: list[tuple[WebSocket, Optional[str]]] = []

    async def connect(self, websocket: WebSocket, department: Optional[str] = None):
        await websocket.accept()
        self.active_connections.append((websocket, department))

    def disconnect(self, websocket: WebSocket):
        self.active_connections = [
            (ws, dept) for ws, dept in self.active_connections if ws != websocket
        ]

    async def broadcast(self, message: dict):
        """
        Broadcast JSON message to relevant connected clients.
        If a client subscribed to a specific department, send only matching events.
        If a client subscribed to global /ws/queue, send all events.
        """
        dead_connections = []
        target_dept = message.get("department")
        from_dept = message.get("from_department")

        for ws, dept in list(self.active_connections):
            # Client receives message if subscribed to all (dept is None)
            # or if department matches target_dept or from_dept (e.g. transfer)
            if dept is None or target_dept is None or dept == target_dept or dept == from_dept:
                try:
                    await ws.send_json(message)
                except Exception:
                    dead_connections.append(ws)

        for ws in dead_connections:
            self.disconnect(ws)


ws_manager = ConnectionManager()


def get_dept_avg_duration(department_name: str) -> int:
    dept = DEPARTMENT_MAP.get(department_name.strip())
    return dept["avg_duration_minutes"] if dept else 10


def calculate_wait_estimation(entry: models.QueueEntry, db: Session):
    """
    Transparent Rule-Based Waiting-Time Estimation:
    Calculates queue position from ACTUAL active WAITING visits within the active daily operating session.
    Formula: Estimated Wait (mins) = int((patients_ahead * avg_duration) / effective_doctors) + serving_buffer
    Outpatient ceiling: Capped realistically at max 120 mins (2 hrs).
    """
    if entry.status != "WAITING":
        return {"patients_ahead": 0, "estimated_wait_minutes": 0}

    # Same-day operating window: Only count active WAITING patients created on the same operating date
    entry_date_str = (entry.created_at.date() if entry.created_at else datetime.utcnow().date()).isoformat()

    waiting_ahead_count = (
        db.query(models.QueueEntry)
        .filter(
            models.QueueEntry.department == entry.department,
            models.QueueEntry.status == "WAITING",
            models.QueueEntry.id < entry.id,
            func.date(models.QueueEntry.created_at) == entry_date_str,
        )
        .count()
    )

    # Active available doctors for this department
    active_doctors = (
        db.query(models.Doctor)
        .filter(
            models.Doctor.department == entry.department,
            models.Doctor.available == 1,
        )
        .count()
    )
    effective_doctors = max(1, active_doctors)

    # Check if there is currently a patient IN_PROGRESS in this department on the same date
    has_active_serving = (
        db.query(models.QueueEntry)
        .filter(
            models.QueueEntry.department == entry.department,
            models.QueueEntry.status == "IN_PROGRESS",
            func.date(models.QueueEntry.created_at) == entry_date_str,
        )
        .first()
        is not None
    )

    avg_duration = get_dept_avg_duration(entry.department)
    additional_serving_buffer = (avg_duration // (2 * effective_doctors)) if has_active_serving else 0

    # Parallel doctor throughput
    raw_wait = int((waiting_ahead_count * avg_duration) / effective_doctors) + additional_serving_buffer

    # Outpatient Clinic Ceiling: Cap realistic wait time estimate at 120 minutes (2 hrs).
    capped_wait = min(raw_wait, 120)

    return {
        "patients_ahead": waiting_ahead_count,
        "estimated_wait_minutes": capped_wait,
    }


def serialize_queue_entry(entry: models.QueueEntry, db: Session):
    estimation = calculate_wait_estimation(entry, db)

    doctor = entry.doctor
    if not doctor and entry.department:
        doctor = (
            db.query(models.Doctor)
            .filter(models.Doctor.department == entry.department)
            .first()
        )

    queue_pos = (
        (estimation["patients_ahead"] + 1)
        if entry.status == "WAITING"
        else (0 if entry.status == "IN_PROGRESS" else None)
    )

    return {
        "id": entry.id,
        "patient_id": entry.patient_id,
        "patient_name": entry.patient.name if entry.patient else f"Patient #{entry.patient_id}",
        "department": entry.department,
        "token_number": entry.token_number,
        "status": entry.status,
        "created_at": entry.created_at.isoformat() if entry.created_at else None,
        "served_at": entry.served_at.isoformat() if entry.served_at else None,
        "completed_at": entry.completed_at.isoformat() if entry.completed_at else None,
        "patients_ahead": estimation["patients_ahead"],
        "queue_position": queue_pos,
        "estimated_wait_minutes": estimation["estimated_wait_minutes"],
        "doctor_id": doctor.id if doctor else None,
        "doctor_name": doctor.name if doctor else "On-Duty Physician",
        "room_number": doctor.room_number if doctor else "Room 101",
    }


def compute_dashboard_summary(db: Session) -> dict:
    """
    Computes real-time statistics across all departments and queue states.
    """
    total_patients = db.query(models.Patient).count()
    all_queue = db.query(models.QueueEntry).all()

    waiting_entries = [e for e in all_queue if e.status == "WAITING"]
    in_progress_entries = [e for e in all_queue if e.status == "IN_PROGRESS"]
    completed_entries = [e for e in all_queue if e.status == "COMPLETED"]
    cancelled_entries = [e for e in all_queue if e.status == "CANCELLED"]

    if waiting_entries:
        total_wait_mins = sum(
            calculate_wait_estimation(e, db)["estimated_wait_minutes"]
            for e in waiting_entries
        )
        avg_wait_minutes = round(total_wait_mins / len(waiting_entries), 1)
    else:
        avg_wait_minutes = 0

    department_stats = []
    for dept in DEPARTMENTS:
        d_name = dept["name"]
        dept_entries = [e for e in all_queue if e.department == d_name]
        d_waiting = [e for e in dept_entries if e.status == "WAITING"]
        d_in_progress = [e for e in dept_entries if e.status == "IN_PROGRESS"]
        d_completed = [e for e in dept_entries if e.status == "COMPLETED"]

        current_token = d_in_progress[0].token_number if d_in_progress else None

        active_docs = (
            db.query(models.Doctor)
            .filter(models.Doctor.department == d_name, models.Doctor.available == 1)
            .count()
        )
        eff_docs = max(1, active_docs)

        new_patient_wait = min(
            int((len(d_waiting) * dept["avg_duration_minutes"]) / eff_docs) + (
                (dept["avg_duration_minutes"] // (2 * eff_docs)) if d_in_progress else 0
            ),
            120,
        )

        department_stats.append(
            {
                "department": d_name,
                "code": dept["code"],
                "avg_duration_minutes": dept["avg_duration_minutes"],
                "waiting_count": len(d_waiting),
                "in_progress_count": len(d_in_progress),
                "completed_count": len(d_completed),
                "total_count": len(dept_entries),
                "current_token": current_token,
                "estimated_wait_minutes": new_patient_wait,
            }
        )

    recent_patients = (
        db.query(models.Patient)
        .order_by(models.Patient.id.desc())
        .limit(6)
        .all()
    )

    return {
        "total_patients": total_patients,
        "total_queue": len(all_queue),
        "waiting_count": len(waiting_entries),
        "in_progress_count": len(in_progress_entries),
        "completed_count": len(completed_entries),
        "cancelled_count": len(cancelled_entries),
        "avg_wait_minutes": avg_wait_minutes,
        "department_stats": department_stats,
        "recent_patients": [
            {
                "id": p.id,
                "name": p.name,
                "age": p.age,
                "phone": p.phone,
            }
            for p in recent_patients
        ],
    }


async def broadcast_queue_event(
    event_type: str,
    entry: models.QueueEntry,
    db: Session,
    extra: Optional[dict] = None,
):
    """
    Persisted state change broadcaster:
    Sends real-time event, serialized entry, and authoritative dashboard summary.
    """
    payload = {
        "event": event_type,
        "department": entry.department,
        "patient_id": entry.patient_id,
        "entry": serialize_queue_entry(entry, db),
        "summary": compute_dashboard_summary(db),
        "timestamp": datetime.utcnow().isoformat(),
    }
    if extra:
        payload.update(extra)
    await ws_manager.broadcast(payload)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure database tables and columns exist smoothly
    ensure_schema()
    yield


app = FastAPI(
    title="MediQueue Hospital API",
    description="Hospital patient registration, real-time queue management, and patient flow tracking",
    version="1.4.0",
    lifespan=lifespan,
)

# Enable CORS for local development and deployed Vercel frontend.
# FRONTEND_URL env var is set on Render to your Vercel app URL.
# Using "*" with allow_credentials=True is blocked by browsers — always use explicit origins in production.
_frontend_url = os.environ.get("FRONTEND_URL", "").strip()
_allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
if _frontend_url:
    _allowed_origins.append(_frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------------------------------------------------------------
# Authentication & Role Authorization Helpers
# -------------------------------------------------------------
def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> models.User:
    """
    Validates Bearer token from Authorization header and retrieves authenticated user.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization.split(" ", 1)[1].strip()
    payload = auth.decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.get(models.User, payload["sub"])
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found.",
        )
    return user


def get_current_patient(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> tuple[models.User, models.Patient]:
    """
    Strict Patient Role Check:
    Ensures requester is authenticated with role='patient' and bound to an existing Patient profile.
    Prevents patient ID spoofing — patient identity is derived strictly from verified token.
    """
    if current_user.role != "patient" or not current_user.patient_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted: This action requires a Patient account.",
        )

    patient = db.get(models.Patient, current_user.patient_id)
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Linked patient medical record not found.",
        )

    return current_user, patient


def get_current_staff(
    current_user: models.User = Depends(get_current_user),
) -> models.User:
    """
    Staff Role Check: Restricts access to hospital staff accounts.
    """
    if current_user.role != "staff":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted: Hospital staff authorization required.",
        )
    return current_user


# -------------------------------------------------------------
# WebSocket Endpoints
# -------------------------------------------------------------
@app.websocket("/ws/queue")
async def websocket_queue_endpoint(websocket: WebSocket):
    """
    Global WebSocket endpoint: Clients subscribe to all queue and patient events.
    """
    await ws_manager.connect(websocket, department=None)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)


@app.websocket("/ws/queue/{department}")
async def websocket_department_endpoint(websocket: WebSocket, department: str):
    """
    Department-scoped WebSocket endpoint: Clients subscribe only to this department's events.
    """
    await ws_manager.connect(websocket, department=department.strip())
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)


# -------------------------------------------------------------
# Pydantic Request Models
# -------------------------------------------------------------
class PatientCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    age: int = Field(ge=0, le=120)
    phone: str = Field(default="9999999999", min_length=7, max_length=20)


class QueueCreate(BaseModel):
    patient_id: int = Field(gt=0)
    department: str = Field(min_length=1, max_length=100)


class QuickRegisterQueue(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    age: int = Field(ge=0, le=120)
    department: str = Field(min_length=1, max_length=100)
    phone: Optional[str] = Field(default="9999999999", max_length=20)


class StatusUpdate(BaseModel):
    status: str = Field(min_length=3, max_length=30)


class TransferRequest(BaseModel):
    department: str = Field(min_length=1, max_length=100)


class UserRegister(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=4, max_length=100)
    age: int = Field(ge=0, le=120)
    phone: str = Field(min_length=7, max_length=20)


class UserLogin(BaseModel):
    email: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=1, max_length=100)


class PatientProfileUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    age: Optional[int] = Field(None, ge=0, le=120)
    phone: Optional[str] = Field(None, min_length=7, max_length=20)


class AppointmentCreate(BaseModel):
    department: str = Field(min_length=1, max_length=100)
    doctor_id: Optional[int] = None
    appointment_date: str = Field(min_length=8, max_length=20)  # YYYY-MM-DD
    time_slot: str = Field(min_length=4, max_length=20)         # e.g. "10:30 AM"
    reason: Optional[str] = Field(default="General Checkup", max_length=255)


class PatientJoinQueue(BaseModel):
    department: str = Field(min_length=1, max_length=100)


class QueueCleanupRequest(BaseModel):
    mode: str = Field(default="stale_test", description="stale_test | completed_cancelled | older_than_today | reset_all")
    department: Optional[str] = None


# -------------------------------------------------------------
# REST API Endpoints
# -------------------------------------------------------------
@app.get("/")
def home():
    return {
        "message": "Welcome to MediQueue",
        "status": "running",
        "version": "1.4.0",
        "docs_url": "/docs",
        "websocket_url": "/ws/queue",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.get("/departments")
def list_departments():
    """Return configured hospital departments with standard consultation metrics."""
    return DEPARTMENTS


@app.get("/doctors")
def list_doctors(
    department: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """List clinical doctors, optionally filtered by department."""
    query = db.query(models.Doctor)
    if department:
        query = query.filter(models.Doctor.department == department.strip())
    doctors = query.all()
    return [
        {
            "id": doc.id,
            "name": doc.name,
            "department": doc.department,
            "specialization": doc.specialization,
            "room_number": doc.room_number,
            "available": bool(doc.available),
        }
        for doc in doctors
    ]


# -------------------------------------------------------------
# Authentication Endpoints
# -------------------------------------------------------------
@app.post("/auth/register", status_code=201)
def register_user(
    data: UserRegister,
    db: Session = Depends(get_db),
):
    """
    Patient self-registration: Creates patient profile and linked user credentials.
    Returns access token and profile info.
    """
    clean_email = data.email.strip().lower()
    existing_user = db.query(models.User).filter(models.User.email == clean_email).first()
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="An account with this email address already exists. Please log in.",
        )

    # 1. Create Patient profile
    patient = models.Patient(
        name=data.name.strip(),
        age=data.age,
        phone=data.phone.strip(),
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)

    # 2. Create User account
    user = models.User(
        email=clean_email,
        hashed_password=auth.hash_password(data.password),
        role="patient",
        patient_id=patient.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # 3. Issue Token
    token = auth.create_access_token({
        "sub": user.id,
        "email": user.email,
        "role": user.role,
        "patient_id": patient.id,
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "role": user.role,
            "patient_id": patient.id,
        },
        "patient": {
            "id": patient.id,
            "name": patient.name,
            "age": patient.age,
            "phone": patient.phone,
        },
    }


@app.post("/auth/login")
def login(
    data: UserLogin,
    db: Session = Depends(get_db),
):
    """
    Authenticate user (staff or patient) and issue verified JWT token.
    """
    clean_email = data.email.strip().lower()
    user = db.query(models.User).filter(models.User.email == clean_email).first()

    if not user or not auth.verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password. Please try again.",
        )

    token = auth.create_access_token({
        "sub": user.id,
        "email": user.email,
        "role": user.role,
        "patient_id": user.patient_id,
    })

    patient_data = None
    if user.patient_id and user.patient:
        patient_data = {
            "id": user.patient.id,
            "name": user.patient.name,
            "age": user.patient.age,
            "phone": user.patient.phone,
        }

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "role": user.role,
            "patient_id": user.patient_id,
        },
        "patient": patient_data,
    }


@app.get("/auth/me")
def get_current_user_profile(
    current_user: models.User = Depends(get_current_user),
):
    """
    Returns current authenticated session user and linked patient profile if available.
    """
    patient_data = None
    if current_user.patient:
        patient_data = {
            "id": current_user.patient.id,
            "name": current_user.patient.name,
            "age": current_user.patient.age,
            "phone": current_user.patient.phone,
            "total_visits": len(current_user.patient.queue_entries),
        }

    return {
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "role": current_user.role,
            "patient_id": current_user.patient_id,
            "created_at": current_user.created_at.isoformat(),
        },
        "patient": patient_data,
    }


# -------------------------------------------------------------
# Patient-Specific Dashboard Endpoints (Role-Protected)
# -------------------------------------------------------------
@app.get("/patient/profile")
def get_patient_profile(
    user_patient: tuple[models.User, models.Patient] = Depends(get_current_patient),
):
    """
    Retrieve authenticated patient's medical profile. Strictly isolated to the caller.
    """
    user, patient = user_patient
    return {
        "id": patient.id,
        "name": patient.name,
        "age": patient.age,
        "phone": patient.phone,
        "email": user.email,
        "role": user.role,
        "total_visits": len(patient.queue_entries),
        "created_at": user.created_at.isoformat(),
    }


@app.patch("/patient/profile")
def update_patient_profile(
    data: PatientProfileUpdate,
    user_patient: tuple[models.User, models.Patient] = Depends(get_current_patient),
    db: Session = Depends(get_db),
):
    """
    Update patient contact information.
    """
    user, patient = user_patient
    if data.name is not None and data.name.strip():
        patient.name = data.name.strip()
    if data.age is not None:
        patient.age = data.age
    if data.phone is not None and data.phone.strip():
        patient.phone = data.phone.strip()

    db.commit()
    db.refresh(patient)

    return {
        "id": patient.id,
        "name": patient.name,
        "age": patient.age,
        "phone": patient.phone,
        "email": user.email,
    }


@app.get("/patient/active-visit")
def get_patient_active_visit(
    user_patient: tuple[models.User, models.Patient] = Depends(get_current_patient),
    db: Session = Depends(get_db),
):
    """
    Retrieve patient's active queue token (WAITING or IN_PROGRESS).
    Includes real-time calculated queue position, patients ahead, estimated wait time,
    assigned doctor, room number, and department queue metrics.
    """
    user, patient = user_patient

    # Look for active visit
    active_entry = (
        db.query(models.QueueEntry)
        .filter(
            models.QueueEntry.patient_id == patient.id,
            models.QueueEntry.status.in_(["WAITING", "IN_PROGRESS"]),
        )
        .order_by(models.QueueEntry.id.desc())
        .first()
    )

    if not active_entry:
        return {
            "has_active_visit": False,
            "visit": None,
            "department_summary": None,
        }

    serialized = serialize_queue_entry(active_entry, db)

    # Department level context
    dept_name = active_entry.department
    dept_waiting = (
        db.query(models.QueueEntry)
        .filter(
            models.QueueEntry.department == dept_name,
            models.QueueEntry.status == "WAITING",
        )
        .count()
    )
    dept_in_progress = (
        db.query(models.QueueEntry)
        .filter(
            models.QueueEntry.department == dept_name,
            models.QueueEntry.status == "IN_PROGRESS",
        )
        .first()
    )

    return {
        "has_active_visit": True,
        "visit": serialized,
        "department_summary": {
            "department": dept_name,
            "waiting_in_department": dept_waiting,
            "current_serving_token": dept_in_progress.token_number if dept_in_progress else None,
            "average_consultation_minutes": get_dept_avg_duration(dept_name),
        },
    }


@app.get("/patient/visits")
def get_patient_visit_history(
    user_patient: tuple[models.User, models.Patient] = Depends(get_current_patient),
    db: Session = Depends(get_db),
):
    """
    Retrieve authenticated patient's visit history (completed, cancelled, and active).
    """
    user, patient = user_patient
    entries = (
        db.query(models.QueueEntry)
        .filter(models.QueueEntry.patient_id == patient.id)
        .order_by(models.QueueEntry.created_at.desc(), models.QueueEntry.id.desc())
        .all()
    )

    visits = []
    for e in entries:
        doctor = e.doctor
        if not doctor and e.department:
            doctor = (
                db.query(models.Doctor)
                .filter(models.Doctor.department == e.department)
                .first()
            )

        duration_mins = None
        if e.served_at and e.completed_at:
            duration_mins = max(1, int((e.completed_at - e.served_at).total_seconds() / 60))

        visits.append(
            {
                "id": e.id,
                "token_number": e.token_number,
                "department": e.department,
                "status": e.status,
                "created_at": e.created_at.isoformat() if e.created_at else None,
                "served_at": e.served_at.isoformat() if e.served_at else None,
                "completed_at": e.completed_at.isoformat() if e.completed_at else None,
                "doctor_name": doctor.name if doctor else "Department Physician",
                "room_number": doctor.room_number if doctor else "Room 101",
                "consultation_minutes": duration_mins,
            }
        )

    return visits


@app.post("/patient/queue/join", status_code=201)
async def patient_join_queue(
    data: PatientJoinQueue,
    user_patient: tuple[models.User, models.Patient] = Depends(get_current_patient),
    db: Session = Depends(get_db),
):
    """
    Allow authenticated patient to join the queue directly for a department.
    Ensures they do not already have an active uncompleted queue token.
    """
    user, patient = user_patient
    dept_name = data.department.strip()

    if dept_name not in DEPARTMENT_MAP:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid department '{dept_name}'. Allowed departments: {', '.join(sorted(DEPARTMENT_MAP.keys()))}",
        )

    existing_active = (
        db.query(models.QueueEntry)
        .filter(
            models.QueueEntry.patient_id == patient.id,
            models.QueueEntry.status.in_(["WAITING", "IN_PROGRESS"]),
        )
        .first()
    )
    if existing_active:
        raise HTTPException(
            status_code=400,
            detail=f"You already have an active Token #{existing_active.token_number} in {existing_active.department}. Please complete or cancel it before taking a new token.",
        )

    # Assign doctor for department
    doc = db.query(models.Doctor).filter(models.Doctor.department == dept_name).first()

    async with token_lock:
        last_entry = (
            db.query(models.QueueEntry)
            .filter(models.QueueEntry.department == dept_name)
            .order_by(models.QueueEntry.token_number.desc())
            .first()
        )
        token_number = (last_entry.token_number + 1) if last_entry else 1

        entry = models.QueueEntry(
            patient_id=patient.id,
            department=dept_name,
            token_number=token_number,
            status="WAITING",
            doctor_id=doc.id if doc else None,
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)

    await broadcast_queue_event("TOKEN_ISSUED", entry, db)
    return serialize_queue_entry(entry, db)


@app.patch("/patient/queue/cancel-active")
async def cancel_patient_active_visit(
    user_patient: tuple[models.User, models.Patient] = Depends(get_current_patient),
    db: Session = Depends(get_db),
):
    """
    Allows patient to leave/cancel their own active WAITING queue token.
    """
    user, patient = user_patient

    entry = (
        db.query(models.QueueEntry)
        .filter(
            models.QueueEntry.patient_id == patient.id,
            models.QueueEntry.status == "WAITING",
        )
        .order_by(models.QueueEntry.id.desc())
        .first()
    )

    if not entry:
        raise HTTPException(
            status_code=404,
            detail="No active waiting queue token found to cancel.",
        )

    now = datetime.utcnow()
    entry.status = "CANCELLED"
    entry.completed_at = now
    db.commit()
    db.refresh(entry)

    await broadcast_queue_event("PATIENT_CANCELLED", entry, db)
    return serialize_queue_entry(entry, db)


# -------------------------------------------------------------
# Patient Appointments Endpoints
# -------------------------------------------------------------
@app.get("/patient/appointments")
def get_patient_appointments(
    user_patient: tuple[models.User, models.Patient] = Depends(get_current_patient),
    db: Session = Depends(get_db),
):
    """
    Retrieve all appointments for the authenticated patient.
    """
    user, patient = user_patient
    appts = (
        db.query(models.Appointment)
        .filter(models.Appointment.patient_id == patient.id)
        .order_by(models.Appointment.appointment_date.desc(), models.Appointment.id.desc())
        .all()
    )

    return [
        {
            "id": a.id,
            "patient_id": a.patient_id,
            "department": a.department,
            "doctor_id": a.doctor_id,
            "doctor_name": a.doctor.name if a.doctor else "Assigned Specialist",
            "doctor_specialization": a.doctor.specialization if a.doctor else None,
            "room_number": a.doctor.room_number if a.doctor else "Room 101",
            "appointment_date": a.appointment_date,
            "time_slot": a.time_slot,
            "reason": a.reason or "General Consultation",
            "status": a.status,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in appts
    ]


@app.post("/patient/appointments", status_code=201)
def book_appointment(
    data: AppointmentCreate,
    user_patient: tuple[models.User, models.Patient] = Depends(get_current_patient),
    db: Session = Depends(get_db),
):
    """
    Book a clinical appointment for the authenticated patient.
    """
    user, patient = user_patient
    dept_name = data.department.strip()

    if dept_name not in DEPARTMENT_MAP:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid department '{dept_name}'.",
        )

    doctor = None
    if data.doctor_id:
        doctor = db.get(models.Doctor, data.doctor_id)
        if not doctor or doctor.department != dept_name:
            raise HTTPException(
                status_code=400,
                detail="Selected doctor does not exist or does not belong to this department.",
            )
    else:
        doctor = db.query(models.Doctor).filter(models.Doctor.department == dept_name).first()

    appt = models.Appointment(
        patient_id=patient.id,
        doctor_id=doctor.id if doctor else None,
        department=dept_name,
        appointment_date=data.appointment_date.strip(),
        time_slot=data.time_slot.strip(),
        reason=(data.reason or "General Checkup").strip(),
        status="CONFIRMED",
    )
    db.add(appt)
    db.commit()
    db.refresh(appt)

    return {
        "id": appt.id,
        "patient_id": appt.patient_id,
        "department": appt.department,
        "doctor_id": appt.doctor_id,
        "doctor_name": doctor.name if doctor else "Assigned Specialist",
        "doctor_specialization": doctor.specialization if doctor else None,
        "room_number": doctor.room_number if doctor else "Room 101",
        "appointment_date": appt.appointment_date,
        "time_slot": appt.time_slot,
        "reason": appt.reason,
        "status": appt.status,
        "created_at": appt.created_at.isoformat(),
    }


@app.patch("/patient/appointments/{appointment_id}/cancel")
def cancel_appointment(
    appointment_id: int,
    user_patient: tuple[models.User, models.Patient] = Depends(get_current_patient),
    db: Session = Depends(get_db),
):
    """
    Cancel an upcoming appointment belonging strictly to the authenticated patient.
    """
    user, patient = user_patient
    appt = db.get(models.Appointment, appointment_id)

    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found.")

    if appt.patient_id != patient.id:
        raise HTTPException(
            status_code=403,
            detail="Access forbidden: You cannot modify appointments for another patient.",
        )

    if appt.status in ("COMPLETED", "CANCELLED"):
        raise HTTPException(
            status_code=400,
            detail=f"Appointment cannot be cancelled as it is already {appt.status}.",
        )

    appt.status = "CANCELLED"
    db.commit()
    db.refresh(appt)

    return {
        "id": appt.id,
        "status": appt.status,
        "message": "Appointment cancelled successfully.",
    }


# -------------------------------------------------------------
# Existing Hospital Staff Endpoints (Preserved 100%)
# -------------------------------------------------------------
@app.post("/patients", status_code=201)
def create_patient(
    patient_data: PatientCreate,
    db: Session = Depends(get_db),
):
    patient = models.Patient(
        name=patient_data.name.strip(),
        age=patient_data.age,
        phone=patient_data.phone.strip(),
    )

    db.add(patient)
    db.commit()
    db.refresh(patient)

    return {
        "id": patient.id,
        "name": patient.name,
        "age": patient.age,
        "phone": patient.phone,
    }


@app.get("/patients")
def list_patients(db: Session = Depends(get_db)):
    patients = (
        db.query(models.Patient)
        .order_by(models.Patient.id.desc())
        .all()
    )

    return [
        {
            "id": patient.id,
            "name": patient.name,
            "age": patient.age,
            "phone": patient.phone,
            "total_visits": len(patient.queue_entries) if patient.queue_entries else 0,
        }
        for patient in patients
    ]


@app.get("/patients/{patient_id}")
def get_patient(patient_id: int, db: Session = Depends(get_db)):
    patient = db.get(models.Patient, patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    return {
        "id": patient.id,
        "name": patient.name,
        "age": patient.age,
        "phone": patient.phone,
        "queue_history": [
            {
                "id": entry.id,
                "token_number": entry.token_number,
                "department": entry.department,
                "status": entry.status,
                "created_at": entry.created_at.isoformat() if entry.created_at else None,
            }
            for entry in sorted(patient.queue_entries, key=lambda e: e.id, reverse=True)
        ],
    }


@app.delete("/patients/{patient_id}")
def delete_patient(patient_id: int, db: Session = Depends(get_db)):
    """
    Delete a patient record and cascade-remove their linked user, queue entries, and appointments.
    """
    patient = db.get(models.Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    name = patient.name
    # Delete linked user account if exists
    db.query(models.User).filter(models.User.patient_id == patient_id).delete(synchronize_session=False)
    db.delete(patient)
    db.commit()

    return {"message": f"Patient '{name}' (ID #{patient_id}) deleted successfully", "id": patient_id}


@app.post("/queue", status_code=201)
async def create_queue_entry(
    queue_data: QueueCreate,
    db: Session = Depends(get_db),
):
    patient = db.get(models.Patient, queue_data.patient_id)

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Patient not found. Register the patient first.",
        )

    department = queue_data.department.strip()
    doc = db.query(models.Doctor).filter(models.Doctor.department == department).first()

    # Use lock to guarantee duplicate tokens cannot be generated under simultaneous requests
    async with token_lock:
        last_entry = (
            db.query(models.QueueEntry)
            .filter(models.QueueEntry.department == department)
            .order_by(models.QueueEntry.token_number.desc())
            .first()
        )

        token_number = (last_entry.token_number + 1) if last_entry else 1

        entry = models.QueueEntry(
            patient_id=patient.id,
            department=department,
            token_number=token_number,
            status="WAITING",
            doctor_id=doc.id if doc else None,
        )

        db.add(entry)
        db.commit()
        db.refresh(entry)

    # Broadcast real-time event to all connected WebSocket clients
    await broadcast_queue_event("TOKEN_ISSUED", entry, db)

    return serialize_queue_entry(entry, db)


@app.post("/register-and-queue", status_code=201)
async def register_and_queue(
    data: QuickRegisterQueue,
    db: Session = Depends(get_db),
):
    """
    Convenience endpoint: Registers a patient and issues a department token in one atomic step.
    Broadcasts real-time TOKEN_ISSUED event over WebSockets.
    """
    dept_name = data.department.strip()
    doc = db.query(models.Doctor).filter(models.Doctor.department == dept_name).first()

    async with token_lock:
        # 1. Register Patient
        patient = models.Patient(
            name=data.name.strip(),
            age=data.age,
            phone=(data.phone or "9999999999").strip(),
        )
        db.add(patient)
        db.commit()
        db.refresh(patient)

        # 2. Issue Token
        last_entry = (
            db.query(models.QueueEntry)
            .filter(models.QueueEntry.department == dept_name)
            .order_by(models.QueueEntry.token_number.desc())
            .first()
        )
        token_number = (last_entry.token_number + 1) if last_entry else 1

        entry = models.QueueEntry(
            patient_id=patient.id,
            department=dept_name,
            token_number=token_number,
            status="WAITING",
            doctor_id=doc.id if doc else None,
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)

    # Broadcast real-time event
    await broadcast_queue_event("TOKEN_ISSUED", entry, db)

    return serialize_queue_entry(entry, db)


@app.get("/queue")
def list_queue(
    department: Optional[str] = None,
    status: Optional[str] = None,
    token_number: Optional[int] = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.QueueEntry)

    if department:
        query = query.filter(models.QueueEntry.department == department.strip())

    if status:
        query = query.filter(models.QueueEntry.status == status.strip().upper())

    if token_number is not None:
        query = query.filter(models.QueueEntry.token_number == token_number)

    entries = query.order_by(
        models.QueueEntry.created_at.asc(),
        models.QueueEntry.id.asc(),
    ).all()

    return [serialize_queue_entry(entry, db) for entry in entries]


@app.get("/queue/track")
def track_token(
    token_number: int = Query(..., description="Token number to track"),
    department: Optional[str] = Query(None, description="Department name"),
    db: Session = Depends(get_db),
):
    """
    Patient tracking endpoint: Looks up status, queue position, and estimated wait time by token number.
    """
    query = db.query(models.QueueEntry).filter(models.QueueEntry.token_number == token_number)
    if department:
        query = query.filter(models.QueueEntry.department == department.strip())

    entry = query.order_by(models.QueueEntry.id.desc()).first()
    if not entry:
        raise HTTPException(
            status_code=404,
            detail=f"Token #{token_number} not found{' in ' + department if department else ''}. Please verify your token number.",
        )

    return serialize_queue_entry(entry, db)


@app.get("/queue/{queue_id}")
def get_queue_entry(queue_id: int, db: Session = Depends(get_db)):
    entry = db.get(models.QueueEntry, queue_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Queue entry not found")
    return serialize_queue_entry(entry, db)


@app.delete("/queue/{queue_id}")
async def delete_queue_entry(
    queue_id: int,
    db: Session = Depends(get_db),
):
    """
    Delete an individual queue entry from the system.
    Broadcasts real-time QUEUE_ENTRY_DELETED event to all connected staff & patient dashboards.
    """
    entry = db.get(models.QueueEntry, queue_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Queue entry not found")

    dept = entry.department
    patient_id = entry.patient_id
    token_num = entry.token_number

    db.delete(entry)
    db.commit()

    # Broadcast event so UI updates immediately
    await ws_manager.broadcast({
        "event": "QUEUE_ENTRY_DELETED",
        "queue_id": queue_id,
        "token_number": token_num,
        "department": dept,
        "patient_id": patient_id,
        "summary": compute_dashboard_summary(db),
        "timestamp": datetime.utcnow().isoformat(),
    })

    return {
        "message": f"Token #{token_num} (Queue #{queue_id}) deleted successfully",
        "id": queue_id,
        "token_number": token_num,
    }


@app.post("/queue/cleanup")
async def cleanup_queue(
    data: QueueCleanupRequest,
    db: Session = Depends(get_db),
):
    """
    Hospital Queue & Patient Data Cleanup:
    - 'stale_test': Removes automated test patients (Concurrent %, etc.) and stale waiting entries older than today.
    - 'completed_cancelled': Removes finished and cancelled visits to declutter the queue view.
    - 'older_than_today': Purges all queue records created before today.
    - 'reset_all': Wipes active queue entries and restarts token numbers from #1.
    """
    today_str = datetime.utcnow().date().isoformat()
    deleted_count = 0

    if data.mode == "stale_test":
        # 1. Delete test patients
        test_pats = db.query(models.Patient).filter(
            (models.Patient.name.like("Concurrent%")) |
            (models.Patient.name.like("Offline Event%")) |
            (models.Patient.name.like("Derma Patient%")) |
            (models.Patient.name.like("Ortho Patient%"))
        ).all()
        test_pat_ids = [p.id for p in test_pats]

        if test_pat_ids:
            q_del = db.query(models.QueueEntry).filter(models.QueueEntry.patient_id.in_(test_pat_ids)).delete(synchronize_session=False)
            deleted_count += q_del
            db.query(models.User).filter(models.User.patient_id.in_(test_pat_ids)).delete(synchronize_session=False)
            db.query(models.Patient).filter(models.Patient.id.in_(test_pat_ids)).delete(synchronize_session=False)

        # 2. Also remove stale WAITING entries created prior to today
        stale_waiting = db.query(models.QueueEntry).filter(
            models.QueueEntry.status == "WAITING",
            func.date(models.QueueEntry.created_at) < today_str,
        ).delete(synchronize_session=False)
        deleted_count += stale_waiting
        db.commit()

    elif data.mode == "completed_cancelled":
        query = db.query(models.QueueEntry).filter(models.QueueEntry.status.in_(["COMPLETED", "CANCELLED"]))
        if data.department and data.department != "ALL":
            query = query.filter(models.QueueEntry.department == data.department.strip())
        deleted_count = query.delete(synchronize_session=False)
        db.commit()

    elif data.mode == "older_than_today":
        query = db.query(models.QueueEntry).filter(func.date(models.QueueEntry.created_at) < today_str)
        if data.department and data.department != "ALL":
            query = query.filter(models.QueueEntry.department == data.department.strip())
        deleted_count = query.delete(synchronize_session=False)
        db.commit()

    elif data.mode == "reset_all":
        query = db.query(models.QueueEntry)
        if data.department and data.department != "ALL":
            query = query.filter(models.QueueEntry.department == data.department.strip())
        deleted_count = query.delete(synchronize_session=False)
        db.commit()

    # Broadcast real-time update
    await ws_manager.broadcast({
        "event": "QUEUE_CLEANUP",
        "mode": data.mode,
        "deleted_count": deleted_count,
        "summary": compute_dashboard_summary(db),
        "timestamp": datetime.utcnow().isoformat(),
    })

    return {
        "message": f"Successfully cleaned up {deleted_count} queue record(s).",
        "deleted_count": deleted_count,
        "mode": data.mode,
    }


@app.patch("/queue/{queue_id}/status")
async def update_queue_status(
    queue_id: int,
    status_update: StatusUpdate,
    db: Session = Depends(get_db),
):
    """
    Update a patient's queue status (WAITING, IN_PROGRESS, COMPLETED, CANCELLED).
    Tracks timestamps when service begins and finishes.
    Broadcasts corresponding real-time event.
    """
    new_status = status_update.status.strip().upper()
    if new_status not in VALID_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status '{new_status}'. Allowed statuses: {', '.join(sorted(VALID_STATUSES))}",
        )

    entry = db.get(models.QueueEntry, queue_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Queue entry not found")

    now = datetime.utcnow()
    entry.status = new_status

    if new_status == "IN_PROGRESS":
        entry.served_at = now
        event_name = "CONSULTATION_STARTED"
    elif new_status == "COMPLETED":
        if not entry.served_at:
            entry.served_at = now
        entry.completed_at = now
        event_name = "VISIT_COMPLETED"
    elif new_status == "CANCELLED":
        if not entry.served_at:
            entry.served_at = now
        entry.completed_at = now
        event_name = "PATIENT_NO_SHOW"
    else:
        event_name = "QUEUE_UPDATED"

    db.commit()
    db.refresh(entry)

    # Broadcast event after state is safely persisted in SQLite
    await broadcast_queue_event(event_name, entry, db)

    return serialize_queue_entry(entry, db)


@app.patch("/queue/{queue_id}/transfer")
async def transfer_patient(
    queue_id: int,
    transfer_data: TransferRequest,
    db: Session = Depends(get_db),
):
    """
    Transfer patient to another department:
    Marks existing entry as cancelled/transferred, issues new token in target department,
    and broadcasts PATIENT_TRANSFERRED event.
    """
    target_dept = transfer_data.department.strip()
    if target_dept not in DEPARTMENT_MAP:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid target department '{target_dept}'. Allowed departments: {', '.join(sorted(DEPARTMENT_MAP.keys()))}",
        )

    old_entry = db.get(models.QueueEntry, queue_id)
    if old_entry is None:
        raise HTTPException(status_code=404, detail="Queue entry not found")

    if old_entry.department == target_dept:
        raise HTTPException(
            status_code=400,
            detail=f"Patient is already registered in {target_dept}.",
        )

    old_dept = old_entry.department
    doc = db.query(models.Doctor).filter(models.Doctor.department == target_dept).first()

    async with token_lock:
        now = datetime.utcnow()
        # Mark previous visit as completed/transferred
        old_entry.status = "CANCELLED"
        old_entry.completed_at = now

        # Issue new token in target department
        last_entry = (
            db.query(models.QueueEntry)
            .filter(models.QueueEntry.department == target_dept)
            .order_by(models.QueueEntry.token_number.desc())
            .first()
        )
        new_token_number = (last_entry.token_number + 1) if last_entry else 1

        new_entry = models.QueueEntry(
            patient_id=old_entry.patient_id,
            department=target_dept,
            token_number=new_token_number,
            status="WAITING",
            doctor_id=doc.id if doc else None,
        )
        db.add(new_entry)
        db.commit()
        db.refresh(old_entry)
        db.refresh(new_entry)

    # Broadcast transfer event with both from_department and new department
    await broadcast_queue_event(
        "PATIENT_TRANSFERRED",
        new_entry,
        db,
        extra={
            "from_department": old_dept,
            "old_entry_id": old_entry.id,
            "message": f"Patient {new_entry.patient.name} transferred from {old_dept} to {target_dept} (New Token #{new_entry.token_number})",
        },
    )

    return serialize_queue_entry(new_entry, db)


@app.post("/queue/call-next")
async def call_next_patient(
    department: Optional[str] = Query(None, description="Department name"),
    db: Session = Depends(get_db),
):
    """
    Workflow convenience endpoint for doctor/desk staff:
    Finds the next WAITING patient, marks any existing IN_PROGRESS as COMPLETED,
    and moves the next patient to IN_PROGRESS.
    Broadcasts real-time events over WebSockets.
    """
    now = datetime.utcnow()

    # Query for currently serving
    serving_query = db.query(models.QueueEntry).filter(models.QueueEntry.status == "IN_PROGRESS")
    if department:
        serving_query = serving_query.filter(models.QueueEntry.department == department.strip())

    currently_serving = serving_query.all()
    for curr in currently_serving:
        curr.status = "COMPLETED"
        curr.completed_at = now

    # Query for oldest WAITING patient
    waiting_query = db.query(models.QueueEntry).filter(models.QueueEntry.status == "WAITING")
    if department:
        waiting_query = waiting_query.filter(models.QueueEntry.department == department.strip())

    next_patient = waiting_query.order_by(models.QueueEntry.created_at.asc(), models.QueueEntry.id.asc()).first()

    if not next_patient:
        db.commit()
        for curr in currently_serving:
            await broadcast_queue_event("VISIT_COMPLETED", curr, db)

        dept_msg = f" for {department}" if department else ""
        return {
            "message": f"No waiting patients found{dept_msg}",
            "called_patient": None,
        }

    next_patient.status = "IN_PROGRESS"
    next_patient.served_at = now
    db.commit()

    # Broadcast completed visits for previous patients
    for curr in currently_serving:
        await broadcast_queue_event("VISIT_COMPLETED", curr, db)

    db.refresh(next_patient)
    # Broadcast PATIENT_CALLED
    await broadcast_queue_event("PATIENT_CALLED", next_patient, db)

    return {
        "message": f"Called Token #{next_patient.token_number} ({next_patient.department})",
        "called_patient": serialize_queue_entry(next_patient, db),
    }


@app.get("/stats/summary")
def get_dashboard_summary(db: Session = Depends(get_db)):
    """
    Real-time aggregated statistics for the hospital dashboard:
    Counts patients across statuses, department breakdowns, and live estimated wait times.
    """
    return compute_dashboard_summary(db)
