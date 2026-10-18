import os
import time
import secrets
from flask import Blueprint, request, jsonify
from app.database import db
from app.services.session_manager import session_manager, hash_password, verify_password
from app.services.quiz_engine import quiz_engine

auth_bp = Blueprint("auth", __name__)

ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
ADMIN_TOKEN = secrets.token_hex(24)

def ensure_starter_teams():
    """Populates starter teams if database is empty."""
    if db.teams.count_documents({}) == 0:
        starters = [
            ("TEAM001", "Quantum Voyagers", "pass123"),
            ("TEAM002", "Cyber Knights", "pass123"),
            ("TEAM003", "Binary Bandits", "pass123"),
            ("TEAM004", "Neural Ninjas", "pass123"),
            ("TEAM005", "Apex Legends", "pass123"),
            ("TEAM006", "Data Dynamos", "pass123"),
            ("TEAM007", "Cloud Shifters", "pass123"),
            ("TEAM008", "Code Mavericks", "pass123"),
        ]
        for tid, name, pwd in starters:
            db.teams.insert_one({
                "team_id": tid,
                "team_name": name,
                "password_hash": hash_password(pwd),
                "is_active": True,
                "created_at": time.time()
            })

ensure_starter_teams()

@auth_bp.route("/api/auth/login", methods=["POST"])
def team_login():
    data = request.get_json() or {}
    team_id = (data.get("team_id") or "").strip().upper()
    password = data.get("password") or ""

    if not team_id or not password:
        return jsonify({"error": "Team ID and password are required."}), 400

    team = db.teams.find_one({"team_id": team_id})
    if not team:
        return jsonify({"error": "Invalid Team ID or password."}), 401

    if not team.get("is_active", True):
        return jsonify({"error": "This team account has been disabled by the organizer."}), 403

    if not verify_password(team.get("password_hash", ""), password):
        return jsonify({"error": "Invalid Team ID or password."}), 401

    # Atomic session lease claim
    success, result, token = session_manager.claim_session(team_id)
    if not success:
        return jsonify({"error": result, "code": "CONCURRENT_SESSION_REJECTED"}), 409

    return jsonify({
        "success": True,
        "token": token,
        "session_id": result,
        "role": "team",
        "team": {
            "team_id": team["team_id"],
            "team_name": team.get("team_name", team_id)
        },
        "quiz_state": quiz_engine.get_state()
    })

@auth_bp.route("/api/auth/admin-login", methods=["POST"])
def admin_login():
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")

    if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
        return jsonify({
            "success": True,
            "token": ADMIN_TOKEN,
            "role": "admin",
            "username": ADMIN_USERNAME,
            "quiz_state": quiz_engine.get_state()
        })
    
    return jsonify({"error": "Invalid organizer credentials."}), 401

@auth_bp.route("/api/auth/logout", methods=["POST"])
def logout():
    data = request.get_json() or {}
    team_id = data.get("team_id")
    if team_id:
        session_manager.release_session(team_id)
    return jsonify({"success": True})

@auth_bp.route("/api/me", methods=["GET"])
def get_me():
    token = request.headers.get("Authorization", "").replace("Bearer ", "").strip()
    team_id = request.headers.get("X-Team-ID", "").strip().upper()

    if token == ADMIN_TOKEN:
        return jsonify({
            "role": "admin",
            "username": ADMIN_USERNAME,
            "quiz_state": quiz_engine.get_state()
        })

    if team_id and session_manager.validate_session(team_id, token):
        team = db.teams.find_one({"team_id": team_id})
        return jsonify({
            "role": "team",
            "team": {
                "team_id": team["team_id"],
                "team_name": team.get("team_name", team_id)
            },
            "quiz_state": quiz_engine.get_state()
        })

    return jsonify({"error": "Unauthorized or session expired."}), 401
