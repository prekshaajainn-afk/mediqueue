"""
Two-Browser-Tab Concurrency & Real-Time Synchronization Simulation.
Models two simultaneous users / browser windows interacting with MediQueue:
- Tab 1: Reception Desk / Dashboard
- Tab 2: Doctor Station / Waiting Room Display
Verifies instant event propagation across clients without manual refresh.
"""
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_two_tabs_simulation():
    print("==================================================")
    print("  SIMULATING TWO REAL-TIME BROWSER TABS / WINDOWS ")
    print("==================================================")

    # Open Tab 1 and Tab 2 simultaneous WebSocket sessions
    with client.websocket_connect("/ws/queue") as tab1_ws:
        print("\n[Tab 1]: Connected to /ws/queue (Reception / Dashboard)")

        with client.websocket_connect("/ws/queue") as tab2_ws:
            print("[Tab 2]: Connected to /ws/queue (Doctor Station / Waiting Hall)")

            # Scenario A: Tab 1 registers a new patient
            print("\n--- Scenario A: Tab 1 registers patient 'Vikas Khanna' in Cardiology ---")
            reg_res = client.post("/register-and-queue", json={
                "name": "Vikas Khanna",
                "age": 45,
                "department": "Cardiology"
            })
            assert reg_res.status_code == 201
            entry = reg_res.json()
            token_num = entry["token_number"]
            print(f"[Backend]: Created Token #{token_num} in Cardiology")

            # Verify Tab 2 receives the real-time event instantly without refresh
            tab2_event = tab2_ws.receive_json()
            assert tab2_event["event"] == "TOKEN_ISSUED"
            assert tab2_event["entry"]["token_number"] == token_num
            assert tab2_event["entry"]["patient_name"] == "Vikas Khanna"
            print(f"[Tab 2]: RECEIVED REAL-TIME EVENT -> TOKEN_ISSUED for Token #{token_num} (Instant zero-refresh update!)")

            # Tab 1 also receives confirmation
            tab1_event = tab1_ws.receive_json()
            assert tab1_event["event"] == "TOKEN_ISSUED"

            # Scenario B: Tab 2 (Doctor Desk) calls next patient
            print(f"\n--- Scenario B: Tab 2 doctor calls next patient in Cardiology ---")
            call_res = client.post("/queue/call-next?department=Cardiology")
            assert call_res.status_code == 200

            # Drain any prior visit completion events and verify Tab 1 receives PATIENT_CALLED
            tab1_called = None
            for _ in range(5):
                ev = tab1_ws.receive_json()
                if ev["event"] == "PATIENT_CALLED":
                    tab1_called = ev
                    break

            assert tab1_called is not None
            called_token = tab1_called["entry"]["token_number"]
            print(f"[Tab 1]: RECEIVED REAL-TIME EVENT -> PATIENT_CALLED for Token #{called_token} (Dashboard updated instantly!)")

            # Scenario C: Tab 2 transfers patient to Orthopedics
            print(f"\n--- Scenario C: Tab 2 transfers Token #{called_token} to Orthopedics ---")
            transfer_res = client.patch(f"/queue/{tab1_called['entry']['id']}/transfer", json={
                "department": "Orthopedics"
            })
            assert transfer_res.status_code == 200
            new_ortho_token = transfer_res.json()["token_number"]

            # Verify Tab 1 receives PATIENT_TRANSFERRED event
            tab1_transfer = tab1_ws.receive_json()
            assert tab1_transfer["event"] == "PATIENT_TRANSFERRED"
            assert tab1_transfer["from_department"] == "Cardiology"
            assert tab1_transfer["department"] == "Orthopedics"
            print(f"[Tab 1]: RECEIVED REAL-TIME EVENT -> PATIENT_TRANSFERRED to Orthopedics (New Token #{new_ortho_token})")

    # Scenario D: Reconnection Recovery
    print("\n--- Scenario D: Client disconnects, event occurs offline, client reconnects ---")
    with client.websocket_connect("/ws/queue") as temp_ws:
        pass # Disconnected immediately

    # Offline action: register another patient
    offline_res = client.post("/register-and-queue", json={
        "name": "Offline Synced Patient",
        "age": 30,
        "department": "General Medicine"
    }).json()

    # Reconnect and fetch authoritative snapshot
    reconnected_queue = client.get("/queue").json()
    assert any(e["id"] == offline_res["id"] for e in reconnected_queue)
    print(f"[Reconnected Client]: Successfully reconciled full state from SQLite (found Token #{offline_res['token_number']})")

    print("\n==================================================")
    print("  TWO-TAB SIMULATION & REAL-TIME SYNC PASSED 100%! ")
    print("==================================================")

if __name__ == "__main__":
    test_two_tabs_simulation()
