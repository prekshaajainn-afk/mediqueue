import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "mediqueue.db")

# ------------------------------------------------------------------
# Database URL Resolution
# In production (Render): DATABASE_URL env var points to Supabase PostgreSQL.
# In local development: falls back to the local SQLite file.
# ------------------------------------------------------------------
DATABASE_URL = os.environ.get("DATABASE_URL")
if DATABASE_URL:
    # Force SQLAlchemy to use psycopg2 driver explicitly (not psycopg3).
    # SQLAlchemy 2.x defaults to psycopg3 with generic postgresql://, so we pin the dialect.
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)
    elif DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)
else:
    DATABASE_URL = f"sqlite:///{DB_PATH}"

# SQLite requires check_same_thread=False; PostgreSQL does not need this
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_schema():
    """Ensure all required tables, columns, and initial records exist.
    Supports both SQLite (local dev) and PostgreSQL (production).
    """
    import models
    import auth

    # Create all tables from SQLAlchemy models (works for both SQLite and PostgreSQL)
    Base.metadata.create_all(bind=engine)

    is_sqlite = DATABASE_URL.startswith("sqlite")

    with engine.connect() as conn:
        if is_sqlite:
            # SQLite: use PRAGMA to check existing columns before adding
            cursor = conn.execute(text("PRAGMA table_info(queue_entries)"))
            existing_cols = {row[1] for row in cursor.fetchall()}

            if "served_at" not in existing_cols:
                try:
                    conn.execute(text("ALTER TABLE queue_entries ADD COLUMN served_at DATETIME"))
                    conn.commit()
                except Exception:
                    pass

            if "completed_at" not in existing_cols:
                try:
                    conn.execute(text("ALTER TABLE queue_entries ADD COLUMN completed_at DATETIME"))
                    conn.commit()
                except Exception:
                    pass

            if "doctor_id" not in existing_cols:
                try:
                    conn.execute(text("ALTER TABLE queue_entries ADD COLUMN doctor_id INTEGER REFERENCES doctors(id)"))
                    conn.commit()
                except Exception:
                    pass
        else:
            # PostgreSQL: use ADD COLUMN IF NOT EXISTS (safe to run repeatedly)
            try:
                conn.execute(text("ALTER TABLE queue_entries ADD COLUMN IF NOT EXISTS served_at TIMESTAMP"))
                conn.execute(text("ALTER TABLE queue_entries ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP"))
                conn.execute(text("ALTER TABLE queue_entries ADD COLUMN IF NOT EXISTS doctor_id INTEGER REFERENCES doctors(id)"))
                conn.commit()
            except Exception:
                pass

    # Seed initial doctors and demo accounts if not already present
    db = SessionLocal()
    try:
        # Seed Doctors
        if db.query(models.Doctor).count() == 0:
            initial_doctors = [
                models.Doctor(
                    name="Dr. Sarah Jenkins",
                    department="General Medicine",
                    specialization="Senior General Physician",
                    room_number="Room 101",
                    available=1,
                ),
                models.Doctor(
                    name="Dr. Rajesh Sharma",
                    department="Cardiology",
                    specialization="Consultant Cardiologist",
                    room_number="Room 203",
                    available=1,
                ),
                models.Doctor(
                    name="Dr. Marcus Vance",
                    department="Orthopedics",
                    specialization="Orthopedic Surgeon & Specialist",
                    room_number="Room 105",
                    available=1,
                ),
                models.Doctor(
                    name="Dr. Priya Patel",
                    department="Pediatrics",
                    specialization="Senior Pediatric Specialist",
                    room_number="Room 108",
                    available=1,
                ),
                models.Doctor(
                    name="Dr. Elena Rostova",
                    department="Dermatology",
                    specialization="Consultant Dermatologist",
                    room_number="Room 212",
                    available=1,
                ),
            ]
            db.add_all(initial_doctors)
            db.commit()

        # Seed Staff user
        staff_user = db.query(models.User).filter(models.User.email == "staff@mediqueue.hospital").first()
        if not staff_user:
            staff_user = models.User(
                email="staff@mediqueue.hospital",
                hashed_password=auth.hash_password("staff123"),
                role="staff",
                patient_id=None,
            )
            db.add(staff_user)
            db.commit()

        # Seed Demo Patient Anita Desai
        anita_user = db.query(models.User).filter(models.User.email == "anita@mediqueue.com").first()
        if not anita_user:
            anita_patient = db.query(models.Patient).filter(models.Patient.name == "Dr. Anita Desai").first()
            if not anita_patient:
                anita_patient = models.Patient(
                    name="Dr. Anita Desai",
                    age=42,
                    phone="+91-9876543210",
                )
                db.add(anita_patient)
                db.commit()
                db.refresh(anita_patient)

            anita_user = models.User(
                email="anita@mediqueue.com",
                hashed_password=auth.hash_password("patient123"),
                role="patient",
                patient_id=anita_patient.id,
            )
            db.add(anita_user)
            db.commit()

        # Seed Demo Patient Rohit Verma
        rohit_user = db.query(models.User).filter(models.User.email == "rohit@mediqueue.com").first()
        if not rohit_user:
            rohit_patient = db.query(models.Patient).filter(models.Patient.name == "Rohit Verma").first()
            if not rohit_patient:
                rohit_patient = models.Patient(
                    name="Rohit Verma",
                    age=29,
                    phone="+91-9123456780",
                )
                db.add(rohit_patient)
                db.commit()
                db.refresh(rohit_patient)

            rohit_user = models.User(
                email="rohit@mediqueue.com",
                hashed_password=auth.hash_password("patient123"),
                role="patient",
                patient_id=rohit_patient.id,
            )
            db.add(rohit_user)
            db.commit()

    finally:
        db.close()
