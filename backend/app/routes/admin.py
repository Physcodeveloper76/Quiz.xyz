import io
import csv
import time
import uuid
from flask import Blueprint, request, jsonify, Response
from app.database import db
from app.services.session_manager import session_manager, hash_password
from app.services.quiz_engine import quiz_engine
from app.services.leaderboard import leaderboard_service
from app.services.supabase_service import supabase_service

admin_bp = Blueprint("admin", __name__)

def check_admin():
    from app.routes.auth import ADMIN_TOKEN
    token = request.headers.get("Authorization", "").replace("Bearer ", "").strip()
    return token == ADMIN_TOKEN

@admin_bp.before_request
def authenticate():
    if request.method == "OPTIONS":
        return
    if not check_admin():
        return jsonify({"error": "Admin authorization required."}), 403

# --- TEAMS MANAGEMENT ---

@admin_bp.route("/api/admin/teams", methods=["GET"])
def list_teams():
    teams = db.teams.find()
    sessions = session_manager.get_active_sessions()
    result = []
    for t in teams:
        has_session = t["team_id"] in sessions
        result.append({
            "team_id": t["team_id"],
            "team_name": t.get("team_name", t["team_id"]),
            "is_active": t.get("is_active", True),
            "created_at": t.get("created_at"),
            "has_active_session": has_session,
            "connected": t["team_id"] in quiz_engine.connected_teams
        })
    return jsonify(result)

@admin_bp.route("/api/admin/teams", methods=["POST"])
def create_team():
    data = request.get_json() or {}
    team_id = (data.get("team_id") or "").strip().upper()
    team_name = (data.get("team_name") or team_id).strip()
    password = data.get("password") or "pass123"

    if not team_id:
        return jsonify({"error": "Team ID is required."}), 400

    existing = db.teams.find_one({"team_id": team_id})
    if existing:
        return jsonify({"error": f"Team ID {team_id} already exists."}), 409

    db.teams.insert_one({
        "team_id": team_id,
        "team_name": team_name,
        "password_hash": hash_password(password),
        "is_active": True,
        "created_at": time.time()
    })

    return jsonify({"success": True, "team_id": team_id, "team_name": team_name})

@admin_bp.route("/api/admin/teams/import-csv", methods=["POST"])
def import_teams_csv():
    """Bulk import teams from CSV string: team_id,team_name,password."""
    data = request.get_json() or {}
    csv_text = data.get("csv", "")
    if not csv_text:
        return jsonify({"error": "CSV text is required."}), 400

    reader = csv.reader(io.StringIO(csv_text.strip()))
    count = 0
    errors = []
    for row in reader:
        if not row or not row[0].strip() or row[0].strip().lower() == "team_id":
            continue
        team_id = row[0].strip().upper()
        team_name = row[1].strip() if len(row) > 1 and row[1].strip() else team_id
        password = row[2].strip() if len(row) > 2 and row[2].strip() else "pass123"
        try:
            db.teams.update_one(
                {"team_id": team_id},
                {"$set": {
                    "team_id": team_id,
                    "team_name": team_name,
                    "password_hash": hash_password(password),
                    "is_active": True,
                    "created_at": time.time()
                }},
                upsert=True
            )
            count += 1
        except Exception as e:
            errors.append(f"{team_id}: {str(e)}")

    return jsonify({"success": True, "imported_count": count, "errors": errors})

@admin_bp.route("/api/admin/teams/<team_id>/release", methods=["POST"])
def release_team_session(team_id):
    team_id = team_id.upper()
    session_manager.release_session(team_id)
    if quiz_engine.socketio:
        quiz_engine.socketio.emit("session_revoked", {"team_id": team_id}, room=team_id)
    return jsonify({"success": True, "message": f"Session for {team_id} released."})

@admin_bp.route("/api/admin/teams/<team_id>/reset-password", methods=["POST"])
def reset_password(team_id):
    team_id = team_id.upper()
    data = request.get_json() or {}
    new_pwd = data.get("password") or "pass123"
    db.teams.update_one(
        {"team_id": team_id},
        {"$set": {"password_hash": hash_password(new_pwd)}}
    )
    return jsonify({"success": True, "message": f"Password reset for {team_id}."})

@admin_bp.route("/api/admin/teams/<team_id>", methods=["DELETE"])
def delete_team(team_id):
    team_id = team_id.upper()
    db.teams.delete_one({"team_id": team_id})
    session_manager.release_session(team_id)
    return jsonify({"success": True})

# --- QUESTIONS MANAGEMENT ---

@admin_bp.route("/api/admin/questions", methods=["GET"])
def list_questions():
    questions = db.questions.find({"quiz_id": quiz_engine.default_quiz_id}, sort=[("order", 1)])
    return jsonify(questions)

@admin_bp.route("/api/admin/questions", methods=["POST"])
def add_question():
    data = request.get_json() or {}
    q_id = f"q_{uuid.uuid4().hex[:8]}"
    count = db.questions.count_documents({"quiz_id": quiz_engine.default_quiz_id})

    new_q = {
        "question_id": q_id,
        "quiz_id": quiz_engine.default_quiz_id,
        "order": data.get("order", count + 1),
        "prompt": data.get("prompt", "Untitled Question"),
        "options": data.get("options", [
            {"id": "A", "text": "Option A"},
            {"id": "B", "text": "Option B"},
            {"id": "C", "text": "Option C"},
            {"id": "D", "text": "Option D"}
        ]),
        "correct_option": data.get("correct_option", "A"),
        "duration_seconds": int(data.get("duration_seconds", 20)),
        "max_points": int(data.get("max_points", 1000))
    }
    db.questions.insert_one(new_q)
    return jsonify({"success": True, "question": new_q})

@admin_bp.route("/api/admin/questions/<q_id>", methods=["PUT"])
def update_question(q_id):
    data = request.get_json() or {}
    update_doc = {}
    for key in ["prompt", "options", "correct_option", "duration_seconds", "max_points", "order"]:
        if key in data:
            update_doc[key] = data[key]
    
    db.questions.update_one({"question_id": q_id}, {"$set": update_doc})
    return jsonify({"success": True, "updated": update_doc})

@admin_bp.route("/api/admin/questions/<q_id>", methods=["DELETE"])
def delete_question(q_id):
    db.questions.delete_one({"question_id": q_id})
    return jsonify({"success": True})

# --- QUIZ CONTROL ROOM ---

@admin_bp.route("/api/admin/quiz/start", methods=["POST"])
def start_quiz():
    success, msg = quiz_engine.start_quiz()
    return jsonify({"success": success, "message": msg, "state": quiz_engine.get_state()})

@admin_bp.route("/api/admin/quiz/advance", methods=["POST"])
def advance_quiz():
    success, msg = quiz_engine.advance_question()
    return jsonify({"success": success, "message": msg, "state": quiz_engine.get_state()})

@admin_bp.route("/api/admin/quiz/pause", methods=["POST"])
def pause_quiz():
    success, msg = quiz_engine.pause_quiz()
    return jsonify({"success": success, "message": msg, "state": quiz_engine.get_state()})

@admin_bp.route("/api/admin/quiz/resume", methods=["POST"])
def resume_quiz():
    success, msg = quiz_engine.resume_quiz()
    return jsonify({"success": success, "message": msg, "state": quiz_engine.get_state()})

@admin_bp.route("/api/admin/quiz/reveal", methods=["POST"])
def reveal_quiz():
    quiz_engine.trigger_reveal(reason="host_forced")
    return jsonify({"success": True, "state": quiz_engine.get_state()})

@admin_bp.route("/api/admin/quiz/reset", methods=["POST"])
def reset_quiz():
    success, msg = quiz_engine.reset_quiz()
    return jsonify({"success": success, "message": msg, "state": quiz_engine.get_state()})

@admin_bp.route("/api/admin/export", methods=["GET"])
def export_csv():
    """Generates official CSV results export."""
    leaderboard = leaderboard_service.get_leaderboard(quiz_engine.default_quiz_id)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Rank", "Team ID", "Team Name", "Total Score", "Correct Answers", "Total Response Time (ms)"])
    for row in leaderboard:
        writer.writerow([
            row.get("rank"),
            row.get("team_id"),
            row.get("team_name"),
            row.get("total_score"),
            row.get("correct_count"),
            int(row.get("total_time_ms", 0))
        ])

    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment;filename=quiz_results_export.csv"}
    )

# --- SUPABASE LEADERBOARD INTEGRATION ---

@admin_bp.route("/api/admin/supabase/status", methods=["GET"])
def supabase_status():
    status = supabase_service.get_status()
    return jsonify(status)

@admin_bp.route("/api/admin/supabase/push", methods=["POST"])
def supabase_push():
    leaderboard = leaderboard_service.get_leaderboard(quiz_engine.default_quiz_id, sync_to_supabase=False)
    success = supabase_service.sync_leaderboard_to_supabase(leaderboard, quiz_engine.default_quiz_id)
    if success:
        return jsonify({"success": True, "message": f"Successfully pushed {len(leaderboard)} team records to Supabase.", "leaderboard": leaderboard})
    return jsonify({"success": False, "error": "Failed to push to Supabase. Please verify SUPABASE_URL, SUPABASE_KEY, and table creation."}), 400

@admin_bp.route("/api/admin/supabase/pull", methods=["POST"])
def supabase_pull():
    leaderboard, err = leaderboard_service.pull_and_sync_from_supabase(quiz_engine.default_quiz_id)
    if err:
        return jsonify({"success": False, "error": err}), 400

    # Broadcast updated leaderboard to all connected participants & admin screens
    if quiz_engine.socketio:
        quiz_engine.socketio.emit("leaderboard_update", {"leaderboard": leaderboard})

    return jsonify({
        "success": True,
        "message": f"Successfully pulled {len(leaderboard)} records from Supabase and broadcasted updates.",
        "leaderboard": leaderboard
    })

@admin_bp.route("/api/admin/supabase/team/<team_id>/marks", methods=["PUT"])
def supabase_update_team_marks(team_id):
    data = request.get_json() or {}
    marks = data.get("marks")
    if marks is None:
        return jsonify({"error": "Marks value is required."}), 400

    try:
        marks = float(marks)
    except ValueError:
        return jsonify({"error": "Marks must be a valid number."}), 400

    # Update in Supabase if configured
    if supabase_service.is_configured():
        supabase_service.update_team_marks_in_supabase(team_id, marks, quiz_engine.default_quiz_id)

    # Update local DB
    db.results.update_one(
        {"quiz_id": quiz_engine.default_quiz_id, "team_id": team_id},
        {"$set": {"total_score": marks, "marks": marks, "finalized_at": time.time()}},
        upsert=True
    )

    # Recalculate leaderboard ranks and broadcast
    leaderboard = leaderboard_service.get_leaderboard(quiz_engine.default_quiz_id)
    if quiz_engine.socketio:
        quiz_engine.socketio.emit("leaderboard_update", {"leaderboard": leaderboard})

    return jsonify({"success": True, "team_id": team_id, "marks": marks, "leaderboard": leaderboard})

