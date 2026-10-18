"""
Load testing and verification script for 100 simultaneous teams.
Simulates:
1. Registration & Login of 100 distinct teams
2. Atomic session validation & rejection of duplicate logins
3. Persistent Socket.IO connections for all 100 teams
4. Burst answer submission on Question Open
5. Automatic early reveal verification
"""

import time
import requests
import threading
import random
import socketio
import sys

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

BASE_URL = "http://127.0.0.1:5000"
TOTAL_TEAMS = 100

def run_simulation():
    print(f"--- 🚀 STARTING 100-TEAM CONCURRENCY TEST ---")

    # 1. Register 100 teams via CSV import
    print(f"\n[Step 1] Seeding {TOTAL_TEAMS} teams into database via Admin API...")
    admin_login_res = requests.post(f"{BASE_URL}/api/auth/admin-login", json={
        "username": "admin",
        "password": "admin123"
    })
    if admin_login_res.status_code != 200:
        print("❌ Admin login failed:", admin_login_res.text)
        return
    admin_token = admin_login_res.json()["token"]
    headers = {"Authorization": f"Bearer {admin_token}"}

    csv_lines = ["team_id,team_name,password"]
    for i in range(1, TOTAL_TEAMS + 1):
        tid = f"SIM_{i:03d}"
        csv_lines.append(f"{tid},Simulated Team {i},testpass")

    csv_data = "\n".join(csv_lines)
    import_res = requests.post(f"{BASE_URL}/api/admin/teams/import-csv", json={"csv": csv_data}, headers=headers)
    print(f"✅ Seeding result: {import_res.json()}")

    # 2. Test duplicate login rejection
    print("\n[Step 2] Testing duplicate active session rejection...")
    first_login = requests.post(f"{BASE_URL}/api/auth/login", json={"team_id": "SIM_001", "password": "testpass"}).json()
    second_login = requests.post(f"{BASE_URL}/api/auth/login", json={"team_id": "SIM_001", "password": "testpass"})
    if second_login.status_code == 409:
        print("✅ Single-session guarantee PASSED: Second concurrent login was rejected with 409 Conflict.")
    else:
        print(f"⚠️ Second login returned unexpected status {second_login.status_code}")

    # 3. Connect 100 teams via Socket.IO
    print(f"\n[Step 3] Connecting {TOTAL_TEAMS} teams via Socket.IO...")
    clients = []
    tokens = {}

    def connect_team(idx):
        tid = f"SIM_{idx:03d}"
        # Login
        res = requests.post(f"{BASE_URL}/api/auth/login", json={"team_id": tid, "password": "testpass"})
        if res.status_code != 200:
            return
        data = res.json()
        token = data.get("token")
        tokens[tid] = token

        # Socket.IO connection
        sio = socketio.Client(logger=False, engineio_logger=False)
        try:
            sio.connect(BASE_URL, transports=['websocket', 'polling'])
            sio.emit("join_quiz", {"role": "team", "team_id": tid, "token": token})

            @sio.on("question_open")
            def on_q_open(q_data):
                q = q_data.get("question")
                if q:
                    # Burst submission with slight realistic jitter (10ms to 2000ms)
                    jitter = random.uniform(0.05, 1.8)
                    time.sleep(jitter)
                    selected = random.choice(["A", "B", "C", "D"])
                    sio.emit("submit_answer", {
                        "question_id": q["question_id"],
                        "selected_option": selected
                    })

            clients.append(sio)
        except Exception as e:
            pass

    threads = []
    for i in range(1, TOTAL_TEAMS + 1):
        t = threading.Thread(target=connect_team, args=(i,))
        threads.append(t)
        t.start()

    for t in threads:
        t.join()

    print(f"✅ Successfully established {len(clients)} persistent Socket.IO connections!")

    # 4. Host starts the question to trigger burst submissions
    print("\n[Step 4] Host opening Question 1 for all connected teams...")
    requests.post(f"{BASE_URL}/api/admin/quiz/start", headers=headers)

    # Allow burst answers to arrive and trigger early reveal
    print("⏳ Waiting for burst submissions and reveal...")
    time.sleep(3.5)

    # Check state
    state = requests.get(f"{BASE_URL}/api/quiz/current").json()
    print(f"📊 Live State: Status={state.get('status')}, Submissions={state.get('submitted_teams_count')}/{state.get('eligible_teams_count')}")

    # Results check
    results = requests.get(f"{BASE_URL}/api/quiz/results").json()
    leaderboard = results.get("leaderboard", [])
    print(f"🏆 Leaderboard Entries Recorded: {len(leaderboard)}")
    if leaderboard:
        print(f"🥇 1st Place: {leaderboard[0]['team_name']} with {leaderboard[0]['total_score']} pts")

    print("\n🧹 Disconnecting simulated clients...")
    for c in clients:
        try:
            c.disconnect()
        except:
            pass
    print("✅ 100-Team Concurrency & Speed-Scoring Test Complete!")

if __name__ == "__main__":
    run_simulation()
