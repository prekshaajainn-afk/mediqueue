"""
Full End-to-End Live Workflow Verification for MediQueue:
Simulates Staff Dashboard and Patient Dashboard interacting concurrently over REST and WebSockets.
"""
import sys
import time
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_full_system_workflow():
    print("==================================================================")
    print("   MEDIQUEUE FULL SYSTEM INTEGRATION: STAFF & PATIENT SYNC        ")
    print("==================================================================")

    # 1. Verification of Public & Staff Endpoints
    print("\n[Step 1] Verifying Staff Dashboard Endpoints...")
    res = client.get("/health")
    assert res.status_code == 200
    res = client.get("/stats/summary")
    assert res.status_code == 200
    initial_stats = res.json()
    print(f"PASS: Hospital stats retrieved (Total patients: {initial_stats['total_patients']}, Queue: {initial_stats['total_queue']})")

    # 2. Authenticate Patient 1 (Dr. Anita Desai)
    print("\n[Step 2] Authenticating Patient 1 (Anita Desai)...")
    res_p1 = client.post("/auth/login", json={"email": "anita@mediqueue.com", "password": "patient123"})
    assert res_p1.status_code == 200
    p1_token = res_p1.json()["access_token"]
    p1_headers = {"Authorization": f"Bearer {p1_token}"}
    p1_id = res_p1.json()["patient"]["id"]
    print(f"PASS: Patient 1 authenticated with ID #{p1_id} ({res_p1.json()['patient']['name']})")

    # 3. Authenticate Patient 2 (Rohit Verma)
    print("\n[Step 3] Authenticating Patient 2 (Rohit Verma)...")
    res_p2 = client.post("/auth/login", json={"email": "rohit@mediqueue.com", "password": "patient123"})
    assert res_p2.status_code == 200
    p2_token = res_p2.json()["access_token"]
    p2_headers = {"Authorization": f"Bearer {p2_token}"}
    p2_id = res_p2.json()["patient"]["id"]
    print(f"PASS: Patient 2 authenticated with ID #{p2_id} ({res_p2.json()['patient']['name']})")

    # 4. Check initial active visits (Clean up any old active visits for test isolation)
    print("\n[Step 4] Checking Active Queue Status...")
    client.patch("/patient/queue/cancel-active", headers=p1_headers)
    client.patch("/patient/queue/cancel-active", headers=p2_headers)

    p1_active = client.get("/patient/active-visit", headers=p1_headers).json()
    p2_active = client.get("/patient/active-visit", headers=p2_headers).json()
    assert p1_active["has_active_visit"] is False
    assert p2_active["has_active_visit"] is False
    print("PASS: Both patients confirmed in clean empty queue state.")

    # 5. Open Real-Time WebSocket for Patient 1
    print("\n[Step 5] Connecting Patient 1 to Real-Time WebSocket Stream...")
    with client.websocket_connect("/ws/queue") as p1_ws:
        # Patient 1 Joins Orthopedics Queue
        print("  -> Patient 1 joining Orthopedics queue...")
        p1_join = client.post("/patient/queue/join", headers=p1_headers, json={"department": "Orthopedics"}).json()
        assert p1_join["status"] == "WAITING"
        p1_token_num = p1_join["token_number"]
        p1_queue_id = p1_join["id"]
        print(f"  -> Patient 1 issued Token #{p1_token_num} (Queue ID: {p1_queue_id})")

        # Verify WebSocket received TOKEN_ISSUED
        ws_ev1 = p1_ws.receive_json()
        assert ws_ev1["event"] == "TOKEN_ISSUED"
        assert ws_ev1["patient_id"] == p1_id
        assert ws_ev1["entry"]["token_number"] == p1_token_num
        print("PASS: Patient 1 received instant real-time TOKEN_ISSUED event via WebSocket!")

        # 6. Patient 2 Joins Same Department (Orthopedics)
        print("\n[Step 6] Patient 2 joining Orthopedics queue...")
        p2_join = client.post("/patient/queue/join", headers=p2_headers, json={"department": "Orthopedics"}).json()
        p2_token_num = p2_join["token_number"]
        p2_queue_id = p2_join["id"]
        assert p2_token_num == p1_token_num + 1

        # Patient 1's WS also receives Patient 2's token issued event for the department
        ws_ev2 = p1_ws.receive_json()
        assert ws_ev2["event"] == "TOKEN_ISSUED"

        # Check queue positions & wait times
        p1_state = client.get("/patient/active-visit", headers=p1_headers).json()["visit"]
        p2_state = client.get("/patient/active-visit", headers=p2_headers).json()["visit"]

        assert p2_state["patients_ahead"] == p1_state["patients_ahead"] + 1
        assert p2_state["queue_position"] == p1_state["queue_position"] + 1
        print(f"PASS: Relative queue position verified — Patient 1 is position #{p1_state['queue_position']} ({p1_state['patients_ahead']} ahead); Patient 2 is position #{p2_state['queue_position']} ({p2_state['patients_ahead']} ahead).")

        # 7. Staff Dashboard Calls Patient 1 into Consultation
        print("\n[Step 7] Hospital Staff starts consultation with Patient 1...")
        staff_start = client.patch(f"/queue/{p1_queue_id}/status", json={"status": "IN_PROGRESS"})
        assert staff_start.status_code == 200

        # Patient 1 receives CONSULTATION_STARTED via WebSocket
        ws_ev3 = p1_ws.receive_json()
        assert ws_ev3["event"] == "CONSULTATION_STARTED"
        assert ws_ev3["patient_id"] == p1_id
        assert ws_ev3["entry"]["status"] == "IN_PROGRESS"
        print("PASS: Patient 1 received instant CONSULTATION_STARTED event without page refresh!")

        # Check Patient 1's active status
        p1_in_prog = client.get("/patient/active-visit", headers=p1_headers).json()["visit"]
        assert p1_in_prog["status"] == "IN_PROGRESS"
        assert p1_in_prog["queue_position"] == 0

        # 8. Staff Dashboard Completes Patient 1's Consultation
        print("\n[Step 8] Hospital Staff completes Patient 1's consultation...")
        staff_comp = client.patch(f"/queue/{p1_queue_id}/status", json={"status": "COMPLETED"})
        assert staff_comp.status_code == 200

        ws_ev4 = p1_ws.receive_json()
        assert ws_ev4["event"] == "VISIT_COMPLETED"
        assert ws_ev4["patient_id"] == p1_id
        print("PASS: Patient 1 received VISIT_COMPLETED event via WebSocket!")

    # 9. Verify Patient 1 Visit History
    print("\n[Step 9] Verifying Patient 1 Visit History...")
    p1_history = client.get("/patient/visits", headers=p1_headers).json()
    assert any(v["id"] == p1_queue_id and v["status"] == "COMPLETED" for v in p1_history)
    completed_rec = next(v for v in p1_history if v["id"] == p1_queue_id)
    assert completed_rec["department"] == "Orthopedics"
    assert completed_rec["doctor_name"] is not None
    print(f"PASS: Consultation logged in history with doctor {completed_rec['doctor_name']}.")

    # 10. Appointment Flow & Strict Data Isolation
    print("\n[Step 10] Testing Appointment Booking & Data Isolation...")
    # Patient 1 books appointment
    appt_res = client.post("/patient/appointments", headers=p1_headers, json={
        "department": "Pediatrics",
        "appointment_date": "2026-11-01",
        "time_slot": "10:30 AM",
        "reason": "Child health check",
    })
    assert appt_res.status_code == 201
    appt_id = appt_res.json()["id"]
    print(f"PASS: Patient 1 booked Appointment #{appt_id} in Pediatrics.")

    # Patient 2 tries to view Patient 1's appointments
    p2_appts = client.get("/patient/appointments", headers=p2_headers).json()
    assert not any(a["id"] == appt_id for a in p2_appts)
    print("PASS: Patient 2 cannot see Patient 1's appointment.")

    # Patient 2 tries to cancel Patient 1's appointment
    unauth_cancel = client.patch(f"/patient/appointments/{appt_id}/cancel", headers=p2_headers)
    assert unauth_cancel.status_code == 403
    print("PASS: Patient 2 forbidden from cancelling Patient 1's appointment (403).")

    # Patient 1 cancels own appointment
    auth_cancel = client.patch(f"/patient/appointments/{appt_id}/cancel", headers=p1_headers)
    assert auth_cancel.status_code == 200
    assert auth_cancel.json()["status"] == "CANCELLED"
    print("PASS: Patient 1 cancelled own appointment successfully.")

    # Clean up Patient 2's active visit
    client.patch("/patient/queue/cancel-active", headers=p2_headers)

    print("\n==================================================================")
    print("   ALL STAFF & PATIENT CONCURRENT WORKFLOWS VERIFIED 100%!        ")
    print("==================================================================")


if __name__ == "__main__":
    test_full_system_workflow()
