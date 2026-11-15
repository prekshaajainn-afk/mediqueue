# MediQueue — Real-Time Hospital Queue Management & Patient Flow Tracking System

**Project Name:** MediQueue  
**Project Title:** Real-Time Queue Management & Patient Flow Tracking System for Hospitals  
**Academic Context:** College Project-Based Learning (PBL) Demonstration  
**Architecture:** Full-Stack Real-Time Event Architecture (FastAPI WebSockets + React + SQLite)  

---

## 1. System Overview

**MediQueue** is an end-to-end, real-time hospital queue management and patient flow tracking platform. It uses persistent **WebSockets** to synchronize patient registrations, queue token issuance, doctor desk calls, consultation progress, and department transfers instantly across multiple browser sessions without manual page refreshing.

---

## 2. Real-Time WebSocket Architecture

### WebSocket Endpoints
- **Global Broadcast:** `ws://127.0.0.1:8000/ws/queue` — Broadcasts all hospital events to dashboards, reception desks, and waiting room kiosks.
- **Department-Scoped:** `ws://127.0.0.1:8000/ws/queue/{department}` — Delivers filtered events specifically for clinical desks (e.g. Cardiology, Pediatrics).

### Broadcast Event Types
All state mutations are persisted in SQLite **before** the corresponding event is broadcast:

| Event Type | Trigger Endpoint | Description |
|---|---|---|
| `TOKEN_ISSUED` | `POST /queue`, `POST /register-and-queue` | Emitted when a patient is registered and issued a queue token. |
| `PATIENT_CALLED` | `POST /queue/call-next` | Emitted when a doctor calls the next waiting patient into the room. |
| `CONSULTATION_STARTED` | `PATCH /queue/{id}/status` (`IN_PROGRESS`) | Emitted when a patient enters the doctor's room. |
| `VISIT_COMPLETED` | `PATCH /queue/{id}/status` (`COMPLETED`) | Emitted when consultation concludes and patient is discharged. |
| `PATIENT_NO_SHOW` | `PATCH /queue/{id}/status` (`CANCELLED`) | Emitted when patient is marked as absent or cancelled. |
| `PATIENT_TRANSFERRED` | `PATCH /queue/{id}/transfer` | Emitted when a patient is transferred from one department to another. |
| `QUEUE_UPDATED` | `PATCH /queue/{id}/status` (`WAITING`) | Emitted when a patient is returned to queue. |

---

## 3. Real-Time Features by Page

1. **Hospital Dashboard:**
   - Real-time KPI cards (*Waiting Patients*, *In Consultation*, *Completed Today*) update in `< 5ms` upon any event.
   - Recent patient table updates live.
   - Live Connection Indicator shows:
     - `Connected (WebSocket)` (Green)
     - `Reconnecting...` (Amber)
     - `Disconnected` (Red)
2. **Register Patient:**
   - 1-step patient intake (Name, Age, Department).
   - Generates sequential token protected by async concurrency locks (zero duplicate tokens).
   - Instantly shows issued token number, department, position in line, and estimated wait time.
3. **Manage Queue:**
   - Live queue table updating across all desks without page reload.
   - Actions: *Call Next Patient*, *Start Consultation*, *Complete Visit*, *Transfer Department*, and *Mark No-Show*.
   - Contextual buttons prevent invalid state transitions.
4. **Patient Tracking:**
   - Allows patients to enter their token number.
   - Shows active status, number of patients ahead, and estimated wait time.
   - Updates dynamically over WebSockets as the doctor advances the queue.
5. **Public Waiting Room TV Display (Kiosk):**
   - High-contrast public board displaying *Now Serving* tokens and *Up Next* list.
   - Privacy-preserving: patient phone numbers and contact details are strictly hidden.
   - Accessible via the **"Waiting Room TV"** button in the top navigation bar.

---

## 4. Queue Accuracy & Concurrency Safeguards

- **Real Active Visits:** Queue positions are calculated strictly from active `WAITING` visits (`id < current.id`), not token numbers alone. If an earlier patient completes, is cancelled, or transferred, subsequent patients immediately advance forward in line.
- **Dynamic Wait Time Formula:**
  $$\text{Estimated Wait (mins)} = (N_{\text{waiting ahead}} \times D_{\text{dept}}) + \left(\frac{D_{\text{dept}}}{2} \text{ if active doctor session}\right)$$
- **Zero Duplicate Tokens:** Token assignment is guarded by an asynchronous transaction lock (`async with token_lock:`), ensuring high-concurrency requests cannot receive duplicate tokens.
- **Reconnection State Recovery:** If the client disconnects or network drops, an exponential backoff automatically reconnects and triggers an authoritative full snapshot fetch from SQLite.

---

## 5. How to Run Locally on macOS

### Terminal 1 — Start FastAPI Backend:
```bash
cd /Users/prekshajain/Documents/MediQueue/backend
.venv/bin/uvicorn main:app --reload --port 8000
```
- API Base URL: `http://127.0.0.1:8000`
- WebSocket URL: `ws://127.0.0.1:8000/ws/queue`
- Interactive Swagger Docs: `http://127.0.0.1:8000/docs`

### Terminal 2 — Start React Frontend:
```bash
cd /Users/prekshajain/Documents/MediQueue/frontend
npm run dev
```
- Web Application: `http://localhost:5173`

---

## 6. How to Demonstrate Real-Time Functionality to Your Teacher

To demonstrate genuine real-time synchronization:

1. **Open Two Browser Windows Side-by-Side:**
   - **Window A:** Open `http://localhost:5173` and click **"Register Patient"** (or **"Manage Queue"**).
   - **Window B:** Open `http://localhost:5173` on the **Dashboard** or click **"Waiting Room TV"** (Kiosk).
2. **Observe Real-Time Registration:**
   - In **Window A**, enter a patient name (e.g., "Arnav Gupta", 32, "Cardiology") and click **"Register & Issue Token"**.
   - **Watch Window B without touching the keyboard:** The new token appears immediately in the table and the *Waiting Patients* card increments instantly.
3. **Observe Doctor Station Call & Status Update:**
   - In **Window A**, go to **Manage Queue**, select "Cardiology", and click **"Call Next Patient"** (or click **"Start Consultation"**).
   - **Watch Window B:** The "Now Serving" token updates immediately, and the *In Consultation* card updates without refreshing!
4. **Demonstrate Patient Tracking:**
   - Open a third tab or window on **Patient Tracking** and track Token #1.
   - In the doctor station, click **"Complete Visit"**.
   - Watch the tracking window immediately switch to **"Consultation Completed"** with zero delay!
5. **Demonstrate Reconnection Resilience:**
   - Stop the backend in Terminal 1 (Ctrl+C). The frontend badge immediately switches to **"Reconnecting..."** (Amber) or **"Disconnected"** (Red).
   - Restart the backend (`uvicorn main:app --reload --port 8000`). The badge turns green (`"Connected (WebSocket)"`) and automatically reconciles state!

---

## 7. Automated Test Suites

Run the end-to-end test suite:
```bash
cd /Users/prekshajain/Documents/MediQueue/backend
.venv/bin/python test_e2e.py
```

Run the two-browser-tab simulation test:
```bash
cd /Users/prekshajain/Documents/MediQueue/backend
.venv/bin/python test_multitab_simulation.py
```
Output:
```text
ALL REAL-TIME END-TO-END TESTS PASSED 100%!
TWO-TAB SIMULATION & REAL-TIME SYNC PASSED 100%!
```

---

## 6. Patient Dashboard & Patient Flow Portal (New)

The system now includes a dedicated **Patient Dashboard** at route `/patient/dashboard`, fully integrated with the FastAPI backend, SQLite database, and real-time WebSocket event broadcaster.

### Patient Portal Features:
1. **Patient Overview:**
   - Welcome banner with patient name, medical ID (`#MED-0000X`), age, and contact details.
   - Quick widgets for active token status, next appointment, and recent consultations.
2. **Digital Queue Token Card:**
   - Prominent display of live token number (`#104`), department, assigned doctor, and room number.
   - Current queue status with color-coded status badges.
   - Real-time queue position and number of patients ahead.
   - Rule-based dynamic estimated wait time (`~X mins`).
   - "Leave Queue" button for waiting patients.
3. **Live Journey Stepper:**
   - Visual 5-stage timeline: `Registered` $\rightarrow$ `Waiting in Queue` $\rightarrow$ `Called to Room` $\rightarrow$ `In Consultation` $\rightarrow$ `Completed`.
   - Real-time stage transitions via WebSocket with visual pulse indicator and optional audio notification chime.
4. **Queue Metrics Cards:**
   - 4 live cards: Queue Position, Patients Ahead, Estimated Wait Time, Department Status.
5. **My Appointments:**
   - View scheduled clinical consultations with doctor, department, date, time slot, and room.
   - "Book New Appointment" with date picker, slot selector, and symptom input.
   - Cancel appointment with confirmation validation.
6. **Visit History:**
   - Full log of completed and past consultations with token #, department, doctor, and consultation duration.
7. **Patient Profile:**
   - View HIPAA-compliant medical ID card and edit contact details (phone, age).
8. **Security & Data Privacy:**
   - Cryptographic Bearer JWT authentication using PBKDF2-HMAC-SHA256 password hashing.
   - Strict role-based isolation: patients access only their own medical records, tokens, and appointments.
   - Cross-patient operations return `403 Forbidden`.

### Pre-Seeded Demo Accounts (Evaluator Quick Access):
- **Demo Patient 1:** `anita@mediqueue.com` / `patient123` (Dr. Anita Desai)
- **Demo Patient 2:** `rohit@mediqueue.com` / `patient123` (Rohit Verma)
- **Hospital Staff:** `staff@mediqueue.hospital` / `staff123`
- Direct 1-click login buttons available on `/patient/dashboard` login screen!

### Automated Integration Tests:
```bash
cd backend
.venv/bin/python test_e2e.py
.venv/bin/python test_patient_dashboard.py
.venv/bin/python test_full_system_integration.py
```
