from flask import Blueprint, request, jsonify
from app.database import db
from app.services.quiz_engine import quiz_engine
from app.services.leaderboard import leaderboard_service
from app.services.session_manager import session_manager

quiz_bp = Blueprint("quiz", __name__)

@quiz_bp.route("/api/quiz/current", methods=["GET"])
def get_current_quiz():
    state = quiz_engine.get_state()
    team_id = request.headers.get("X-Team-ID", "").strip().upper()
    submission = None
    if team_id and state.get("current_question_id"):
        submission = db.answers.find_one({
            "quiz_id": quiz_engine.default_quiz_id,
            "question_id": state["current_question_id"],
            "team_id": team_id
        })
        if submission:
            submission = {
                "selected_option": submission.get("selected_option"),
                "is_correct": submission.get("is_correct") if state.get("status") in ("REVEAL", "QUESTION_CLOSED", "COMPLETED") else None,
                "points": submission.get("points") if state.get("status") in ("REVEAL", "QUESTION_CLOSED", "COMPLETED") else None,
                "received_at": submission.get("received_at")
            }

    state["team_submission"] = submission
    return jsonify(state)

@quiz_bp.route("/api/quiz/results", methods=["GET"])
def get_quiz_results():
    leaderboard = leaderboard_service.get_leaderboard(quiz_engine.default_quiz_id)
    return jsonify({
        "quiz_id": quiz_engine.default_quiz_id,
        "leaderboard": leaderboard,
        "status": quiz_engine.get_state().get("status")
    })

@quiz_bp.route("/api/quiz/submit", methods=["POST"])
def submit_answer():
    token = request.headers.get("Authorization", "").replace("Bearer ", "").strip()
    team_id = request.headers.get("X-Team-ID", "").strip().upper()
    if not team_id or not session_manager.validate_session(team_id, token):
        return jsonify({"error": "Unauthorized or session expired."}), 401

    data = request.get_json() or {}
    question_id = data.get("question_id")
    selected_option = data.get("selected_option")
    request_id = data.get("request_id")

    if not question_id or not selected_option:
        return jsonify({"error": "question_id and selected_option are required."}), 400

    success, msg, points = quiz_engine.submit_answer(team_id, question_id, selected_option, request_id)
    if not success:
        return jsonify({"error": msg}), 400

    return jsonify({"success": True, "message": msg, "points": points, "selected_option": selected_option})
