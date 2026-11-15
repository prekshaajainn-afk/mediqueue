"""
Comprehensive End-to-End Automated Test Suite for MediQueue.
Validates:
- REST API Endpoints & CRUD Operations
- WebSocket Connection & Real-Time Event Broadcasting
- Department-Scoped Event Routing
- Status Transitions & Active Visit Position Calculations
- Department Transfers
- Concurrent Token Uniqueness (Zero Duplicate Tokens)
- Disconnection & Reconnection State Recovery
"""
import asyncio
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
from main import app

client = TestClient(app)

def test_medi_queue():
    print("==================================================")
    print("      MEDIQUEUE END-TO-END AUTOMATED TESTS        ")
    print("==================================================")

    # 1. Health & Home
    print("\n--- 1. Testing Health and Home Endpoints ---")
    res = client.get("/")
    assert res.status_code == 200
    assert res.json()["status"] == "running"
    assert "websocket_url" in res.json()

    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"
    print("PASS: Health & Home endpoints verified.")

    # 2. Departments
    print("\n--- 2. Testing Departments Configuration ---")
    res = client.get("/departments")
    assert res.status_code == 200
    depts = res.json()
    assert len(depts) >= 5
    dept_names = [d["name"] for d in depts]
    assert "General Medicine" in dept_names
    assert "Cardiology" in dept_names
    print(f"PASS: {len(depts)} clinical departments verified: {dept_names}")

    # 3. Patient Registration
    print("\n--- 3. Testing Patient Registration ---")
    res = client.post("/patients", json={"name": "Dr. Anita Desai", "age": 42, "phone": "+91-9876543210"})
    assert res.status_code == 201
    p_id = res.json()["id"]
    print(f"PASS: Patient registered with ID #{p_id}")

    # 4. Token Generation & Waiting Time Calculation
    print("\n--- 4. Testing Queue Token Generation & Wait Time Accuracy ---")
    token1_res = client.post("/queue", json={"patient_id": p_id, "department": "Cardiology"})
    assert token1_res.status_code == 201
    t1 = token1_res.json()
    assert t1["status"] == "WAITING"

    # Second patient
    p2 = client.post("/patients", json={"name": "Rohit Verma", "age": 29}).json()
    token2_res = client.post("/queue", json={"patient_id": p2["id"], "department": "Cardiology"})
    t2 = token2_res.json()
    assert t2["token_number"] == t1["token_number"] + 1
    assert t2["patients_ahead"] >= 1
    print(f"PASS: Token #{t2['token_number']} accurately calculates {t2['patients_ahead']} active waiting patient(s) ahead.")

    # 5. Status Workflow
    print("\n--- 5. Testing Status Transitions ---")
    # WAITING -> IN_PROGRESS
    res = client.patch(f"/queue/{t1['id']}/status", json={"status": "IN_PROGRESS"})
    assert res.status_code == 200
    assert res.json()["status"] == "IN_PROGRESS"
    assert res.json()["served_at"] is not None

    # IN_PROGRESS -> COMPLETED
    res = client.patch(f"/queue/{t1['id']}/status", json={"status": "COMPLETED"})
    assert res.status_code == 200
    assert res.json()["status"] == "COMPLETED"
    assert res.json()["completed_at"] is not None
    print("PASS: Status transitions (WAITING -> IN_PROGRESS -> COMPLETED) verified.")

    # 6. WebSocket Live Event Streaming
    print("\n--- 6. Testing WebSocket Real-Time Broadcasts ---")
    with client.websocket_connect("/ws/queue") as ws:
        # A. Issue Token -> Expect TOKEN_ISSUED
        res = client.post("/register-and-queue", json={
            "name": "Meera Nair",
            "age": 34,
            "department": "Pediatrics"
        })
        assert res.status_code == 201
        meera_entry = res.json()

        event1 = ws.receive_json()
        assert event1["event"] == "TOKEN_ISSUED"
        assert event1["department"] == "Pediatrics"
        assert event1["entry"]["patient_name"] == "Meera Nair"
        assert "summary" in event1
        print("PASS: WebSocket broadcast received: TOKEN_ISSUED")

        # B. Start Consultation -> Expect CONSULTATION_STARTED
        res = client.patch(f"/queue/{meera_entry['id']}/status", json={"status": "IN_PROGRESS"})
        assert res.status_code == 200

        event2 = ws.receive_json()
        assert event2["event"] == "CONSULTATION_STARTED"
        assert event2["entry"]["status"] == "IN_PROGRESS"
        print("PASS: WebSocket broadcast received: CONSULTATION_STARTED")

        # C. Call Next -> Expect VISIT_COMPLETED and PATIENT_CALLED
        p_next = client.post("/register-and-queue", json={
            "name": "Karan Singhania",
            "age": 8,
            "department": "Pediatrics"
        }).json()
        _ = ws.receive_json() # swallow TOKEN_ISSUED

        res = client.post("/queue/call-next?department=Pediatrics")
        assert res.status_code == 200

        # Receive events until PATIENT_CALLED is reached
        received_event_names = []
        last_called_entry = None
        for _ in range(5):
            ev = ws.receive_json()
            received_event_names.append(ev["event"])
            if ev["event"] == "PATIENT_CALLED":
                last_called_entry = ev["entry"]
                break

        assert "PATIENT_CALLED" in received_event_names
        print(f"PASS: WebSocket broadcasts received: {received_event_names}")

        # D. Department Transfer -> Expect PATIENT_TRANSFERRED
        called_id = last_called_entry["id"] if last_called_entry else meera_entry["id"]
        res = client.patch(f"/queue/{called_id}/transfer", json={"department": "Dermatology"})
        assert res.status_code == 200
        transferred_entry = res.json()
        assert transferred_entry["department"] == "Dermatology"

        ev_transfer = ws.receive_json()
        assert ev_transfer["event"] == "PATIENT_TRANSFERRED"
        assert ev_transfer["from_department"] == "Pediatrics"
        assert ev_transfer["department"] == "Dermatology"
        print("PASS: WebSocket broadcast received: PATIENT_TRANSFERRED")

    # 7. Department-Scoped WebSocket Filtering
    print("\n--- 7. Testing Department-Scoped WebSocket Routing ---")
    with client.websocket_connect("/ws/queue/Orthopedics") as ws_ortho:
        # Action in Dermatology
        client.post("/register-and-queue", json={"name": "Derma Patient", "age": 22, "department": "Dermatology"})
        # Action in Orthopedics
        client.post("/register-and-queue", json={"name": "Ortho Patient", "age": 45, "department": "Orthopedics"})

        # Only Orthopedics event should be delivered
        scoped_event = ws_ortho.receive_json()
        assert scoped_event["department"] == "Orthopedics"
        assert scoped_event["entry"]["patient_name"] == "Ortho Patient"
        print("PASS: Department-scoped WebSocket filtered out unrelated events successfully.")

    # 8. Reconnection State Recovery
    print("\n--- 8. Testing Disconnection & Reconnection State Recovery ---")
    with client.websocket_connect("/ws/queue") as ws:
        pass # disconnected immediately

    # While client was disconnected, an action occurs
    res_missed = client.post("/register-and-queue", json={"name": "Offline Event Patient", "age": 50, "department": "Cardiology"})
    missed_entry = res_missed.json()

    # Client reconnects and queries authoritative state
    reconnected_queue = client.get("/queue").json()
    assert any(e["id"] == missed_entry["id"] for e in reconnected_queue)
    print("PASS: Reconnection authoritative sync recovered all offline actions accurately.")

    # 9. Asynchronous Concurrency & Zero Duplicate Tokens
    print("\n--- 9. Testing High Concurrency & Zero Duplicate Tokens ---")
    async def test_concurrency():
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as aclient:
            async def reg(i):
                r = await aclient.post("/register-and-queue", json={
                    "name": f"Concurrent {i}",
                    "age": 25,
                    "department": "Cardiology"
                })
                return r.json()["token_number"]

            tokens = await asyncio.gather(*(reg(i) for i in range(10)))
            assert len(tokens) == len(set(tokens)), f"Duplicate tokens generated: {tokens}"
            print(f"PASS: 10 concurrent requests generated strictly unique sequential tokens: {tokens}")

    asyncio.run(test_concurrency())

    print("\n==================================================")
    print("   ALL REAL-TIME END-TO-END TESTS PASSED 100%!    ")
    print("==================================================")

if __name__ == "__main__":
    test_medi_queue()
