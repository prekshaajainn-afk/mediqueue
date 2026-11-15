# MediQueue — System Architecture & Real-Time WebSocket Design

This document details the real-time event-driven architecture, WebSocket lifecycle, database design, and queuing formulas for MediQueue.

---

## 1. Real-Time WebSocket Architecture

```mermaid
sequenceDiagram
    autonumber
    actor Reception as Receptionist / Tab A
    actor Doctor as Doctor Desk / Tab B
    actor Kiosk as Waiting Lobby TV / Tab C
    participant WS_Hub as FastAPI WebSocket Hub (/ws/queue)
    participant Engine as Queue State & Wait Engine
    participant DB as SQLite3 Database

    Note over Reception, Kiosk: All clients establish persistent WebSocket connections
    Reception->>WS_Hub: Connect ws://127.0.0.1:8000/ws/queue
    Doctor->>WS_Hub: Connect ws://127.0.0.1:8000/ws/queue
    Kiosk->>WS_Hub: Connect ws://127.0.0.1:8000/ws/queue

    Note over Reception, DB: 1. Patient Registration & Token Issuance
    Reception->>Engine: POST /register-and-queue (Name: "Eleanor", Dept: "Cardiology")
    Engine->>DB: Atomic INSERT patients & queue_entries
    DB-->>Engine: Committed (Token #5, Status: WAITING)
    Engine->>WS_Hub: Broadcast event: TOKEN_ISSUED
    WS_Hub-->>Doctor: Event TOKEN_ISSUED (Pushes into live queue)
    WS_Hub-->>Kiosk: Event TOKEN_ISSUED (Appends to Next In Line)
    WS_Hub-->>Reception: Event TOKEN_ISSUED (Updates summary cards)

    Note over Doctor, DB: 2. Doctor Calls Patient
    Doctor->>Engine: POST /queue/call-next?department=Cardiology
    Engine->>DB: UPDATE status = 'IN_PROGRESS', served_at = NOW()
    DB-->>Engine: Committed
    Engine->>WS_Hub: Broadcast event: PATIENT_CALLED
    WS_Hub-->>Kiosk: Event PATIENT_CALLED (Now Serving: #5)
    WS_Hub-->>Reception: Event PATIENT_CALLED (In Consultation +1)

    Note over Doctor, DB: 3. Department Transfer
    Doctor->>Engine: PATCH /queue/5/transfer (Target: Dermatology)
    Engine->>DB: UPDATE old = 'CANCELLED', INSERT new in Dermatology
    DB-->>Engine: Committed
    Engine->>WS_Hub: Broadcast event: PATIENT_TRANSFERRED
    WS_Hub-->>Kiosk: Updates both Cardiology & Dermatology boards
```

---

## 2. Queue Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> WAITING : Token Issued (/register-and-queue)
    WAITING --> IN_PROGRESS : Doctor Calls Token (/queue/call-next or Start)
    WAITING --> CANCELLED : Patient No-Show / Cancelled
    WAITING --> CANCELLED_TRANSFER : Transferred to Target Department
    IN_PROGRESS --> COMPLETED : Consultation Finished (Discharged)
    IN_PROGRESS --> CANCELLED : Terminated Early / No-Show
    IN_PROGRESS --> CANCELLED_TRANSFER : Transferred Mid-Visit
    CANCELLED_TRANSFER --> WAITING : Auto-Enqueued in Target Department with New Token
    COMPLETED --> [*]
    CANCELLED --> [*]
```

---

## 3. Waiting-Time Calculation Model

$$\text{Estimated Wait Time (minutes)} = (N_{\text{active waiting ahead}} \times D_{\text{dept}}) + \left(\frac{D_{\text{dept}}}{2} \text{ if active doctor session}\right)$$

### Department Standard Baselines:
- **Cardiology:** 15 minutes
- **Orthopedics:** 12 minutes
- **General Medicine:** 10 minutes
- **Pediatrics:** 10 minutes
- **Dermatology:** 10 minutes

*Queue depth $N_{\text{active waiting ahead}}$ is dynamically evaluated from SQLite for entries with $\text{status} = \text{'WAITING'}$ and $\text{id} < \text{current\_entry.id}$. When patients ahead are completed, marked no-show, or transferred, queue depth decreases instantaneously and broadcasts to all clients.*
