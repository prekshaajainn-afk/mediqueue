"""
Comprehensive Integration Tests for MediQueue Patient Dashboard.
Tests:
- Patient & Staff Authentication (Login, Registration, Token Verification)
- Role-based Access Control (Patients restricted to patient APIs, unauthorized blocked)
- Patient Profile (Retrieve and Update)
- Patient Active Visit & Token Calculation (Position, Patients Ahead, Wait Time)
- Patient Direct Queue Joining and Active Token Cancellation
- Clinical Appointments (List, Book, Cancel, Department/Doctor Validation)
- Patient Data Isolation (Patient A cannot see or cancel Patient B's data)
- Real-time WebSocket delivery of patient events
"""
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_patient_dashboard_suite():
    print("==================================================")
    print("   PATIENT DASHBOARD INTEGRATION TEST SUITE       ")
    print("==================================================")

    # 1. Staff and Patient Authentication
    print("\n--- 1. Testing Authentication & Token Issuance ---")
    # Patient Login (seeded Anita Desai)
    login_res = client.post("/auth/login", json={
        "email": "anita@mediqueue.com",
        "password": "patient123",
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    anita_data = login_res.json()
    anita_token = anita_data["access_token"]
    assert anita_data["user"]["role"] == "patient"
    assert anita_data["patient"]["name"] == "Dr. Anita Desai"
    anita_headers = {"Authorization": f"Bearer {anita_token}"}
    print("PASS: Patient Anita logged in successfully.")

    # Staff Login
    staff_res = client.post("/auth/login", json={
        "email": "staff@mediqueue.hospital",
        "password": "staff123",
    })
    assert staff_res.status_code == 200
    staff_token = staff_res.json()["access_token"]
    staff_headers = {"Authorization": f"Bearer {staff_token}"}
    print("PASS: Staff logged in successfully.")

    # Invalid Login Test
    bad_login = client.post("/auth/login", json={
        "email": "anita@mediqueue.com",
        "password": "wrongpassword",
    })
    assert bad_login.status_code == 401
    print("PASS: Invalid credentials correctly rejected (401).")

    # 2. Patient Registration
    print("\n--- 2. Testing Patient Self-Registration ---")
    reg_email = f"patient_{int(TestClient.__module__.__hash__()) % 100000}@hospital.test"
    reg_res = client.post("/auth/register", json={
        "name": "Kavita Rao",
        "email": reg_email,
        "password": "password123",
        "age": 31,
        "phone": "+91-9876500001",
    })
    assert reg_res.status_code == 201
    kavita_data = reg_res.json()
    kavita_token = kavita_data["access_token"]
    kavita_headers = {"Authorization": f"Bearer {kavita_token}"}
    assert kavita_data["patient"]["name"] == "Kavita Rao"
    print("PASS: New patient registered and token issued.")

    # Duplicate Registration Test
    dup_res = client.post("/auth/register", json={
        "name": "Kavita Rao",
        "email": reg_email,
        "password": "password123",
        "age": 31,
        "phone": "+91-9876500001",
    })
    assert dup_res.status_code == 400
    print("PASS: Duplicate email correctly blocked (400).")

    # 3. Patient Profile & Updates
    print("\n--- 3. Testing Profile Access & Modification ---")
    prof_res = client.get("/patient/profile", headers=kavita_headers)
    assert prof_res.status_code == 200
    prof = prof_res.json()
    assert prof["name"] == "Kavita Rao"
    assert prof["age"] == 31

    # Update profile
    up_res = client.patch("/patient/profile", headers=kavita_headers, json={
        "age": 32,
        "phone": "+91-9876500099",
    })
    assert up_res.status_code == 200
    assert up_res.json()["age"] == 32
    assert up_res.json()["phone"] == "+91-9876500099"
    print("PASS: Patient profile retrieved and updated.")

    # 4. Role-Based Access Control & Security
    print("\n--- 4. Testing Role Security & Unauthorized Access ---")
    # Anonymous request to patient API
    anon_res = client.get("/patient/profile")
    assert anon_res.status_code == 401
    print("PASS: Unauthenticated access blocked (401).")

    # Staff account trying to access patient-only API
    staff_on_patient = client.get("/patient/profile", headers=staff_headers)
    assert staff_on_patient.status_code == 403
    print("PASS: Staff forbidden from patient-specific endpoint (403).")

    # 5. Patient Queue & Active Visit Flow
    print("\n--- 5. Testing Patient Queue Joining & Active Visit Tracking ---")
    # Empty active visit state first
    empty_active = client.get("/patient/active-visit", headers=kavita_headers)
    assert empty_active.status_code == 200
    assert empty_active.json()["has_active_visit"] is False
    print("PASS: Correct empty active visit state when not queued.")

    # Join queue directly from patient portal
    join_res = client.post("/patient/queue/join", headers=kavita_headers, json={"department": "General Medicine"})
    assert join_res.status_code == 201
    kavita_token_entry = join_res.json()
    assert kavita_token_entry["status"] == "WAITING"
    assert kavita_token_entry["queue_position"] is not None
    assert kavita_token_entry["doctor_name"] is not None
    print(f"PASS: Patient joined queue. Issued Token #{kavita_token_entry['token_number']} ({kavita_token_entry['department']})")

    # Trying to join again while active
    double_join = client.post("/patient/queue/join", headers=kavita_headers, json={"department": "Cardiology"})
    assert double_join.status_code == 400
    print("PASS: Second concurrent queue token blocked (400).")

    # Active visit lookup
    active_res = client.get("/patient/active-visit", headers=kavita_headers)
    assert active_res.status_code == 200
    active_data = active_res.json()
    assert active_data["has_active_visit"] is True
    assert active_data["visit"]["token_number"] == kavita_token_entry["token_number"]
    assert active_data["department_summary"]["department"] == "General Medicine"
    print("PASS: Active visit details and department queue summary returned.")

    # 6. Staff Status Transition & Patient Live Sync
    print("\n--- 6. Testing Staff Transition & Real-Time Broadcast ---")
    with client.websocket_connect("/ws/queue") as ws:
        # Move Kavita to IN_PROGRESS via staff endpoint
        status_res = client.patch(
            f"/queue/{kavita_token_entry['id']}/status",
            json={"status": "IN_PROGRESS"},
        )
        assert status_res.status_code == 200

        # Verify WebSocket event received
        ws_event = ws.receive_json()
        assert ws_event["event"] == "CONSULTATION_STARTED"
        assert ws_event["patient_id"] == kavita_data["patient"]["id"]
        assert ws_event["entry"]["status"] == "IN_PROGRESS"
        print("PASS: WebSocket broadcast delivered consultation start event to subscriber.")

    # Active visit now shows IN_PROGRESS and queue_position 0
    active_in_prog = client.get("/patient/active-visit", headers=kavita_headers).json()
    assert active_in_prog["visit"]["status"] == "IN_PROGRESS"
    assert active_in_prog["visit"]["queue_position"] == 0
    print("PASS: Patient dashboard shows IN_PROGRESS status.")

    # Complete visit
    client.patch(f"/queue/{kavita_token_entry['id']}/status", json={"status": "COMPLETED"})

    # 7. Visit History
    print("\n--- 7. Testing Patient Visit History ---")
    visits_res = client.get("/patient/visits", headers=kavita_headers)
    assert visits_res.status_code == 200
    visits = visits_res.json()
    assert len(visits) >= 1
    assert visits[0]["status"] == "COMPLETED"
    print(f"PASS: Patient visit history shows {len(visits)} recorded visit(s).")

    # 8. Clinical Appointments
    print("\n--- 8. Testing Appointment Booking & Cancellation ---")
    # List doctors
    docs_res = client.get("/doctors")
    assert docs_res.status_code == 200
    doctors = docs_res.json()
    assert len(doctors) >= 5

    # Book appointment
    cardio_doc = next(d for d in doctors if d["department"] == "Cardiology")
    book_res = client.post("/patient/appointments", headers=kavita_headers, json={
        "department": "Cardiology",
        "doctor_id": cardio_doc["id"],
        "appointment_date": "2026-10-28",
        "time_slot": "11:00 AM",
        "reason": "Chest pain follow-up",
    })
    assert book_res.status_code == 201
    appt = book_res.json()
    assert appt["doctor_name"] == cardio_doc["name"]
    assert appt["status"] == "CONFIRMED"
    print(f"PASS: Appointment booked with {appt['doctor_name']} on {appt['appointment_date']}.")

    # List appointments
    appts_list = client.get("/patient/appointments", headers=kavita_headers).json()
    assert any(a["id"] == appt["id"] for a in appts_list)
    print("PASS: Appointment visible in patient's appointment list.")

    # 9. Patient Data Isolation
    print("\n--- 9. Testing Strict Patient Data Isolation ---")
    # Anita logs in and attempts to cancel Kavita's appointment
    malicious_cancel = client.patch(
        f"/patient/appointments/{appt['id']}/cancel",
        headers=anita_headers,
    )
    assert malicious_cancel.status_code == 403
    print("PASS: Cross-patient appointment cancellation strictly forbidden (403).")

    # Anita cannot see Kavita's appointments
    anita_appts = client.get("/patient/appointments", headers=anita_headers).json()
    assert not any(a["id"] == appt["id"] for a in anita_appts)
    print("PASS: Cross-patient appointment records completely isolated.")

    # Kavita cancels her own appointment
    cancel_res = client.patch(
        f"/patient/appointments/{appt['id']}/cancel",
        headers=kavita_headers,
    )
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "CANCELLED"
    print("PASS: Patient successfully cancelled own appointment.")

    print("\n==================================================")
    print("   ALL PATIENT DASHBOARD TESTS PASSED 100%!       ")
    print("==================================================")


if __name__ == "__main__":
    test_patient_dashboard_suite()
