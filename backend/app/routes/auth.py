import os
import time
import secrets
from flask import Blueprint, request, jsonify
from app.database import db
from app.services.session_manager import session_manager, hash_password, verify_password
from app.services.quiz_engine import quiz_engine
from app.services.supabase_service import supabase_service

auth_bp = Blueprint("auth", __name__)

ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
ADMIN_TOKEN = secrets.token_hex(24)

def check_password_match(stored_password, provided_password):
    if not stored_password or not provided_password:
        return False
    # Direct plaintext match (for passwords entered in Supabase Table Editor or CSV)
    if str(stored_password).strip() == str(provided_password).strip():
        return True
    # Argon2 / Bcrypt hash match
    try:
        return verify_password(stored_password, provided_password)
    except Exception:
        return False

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
    identifier = (data.get("team_id") or data.get("team_name") or "").strip()
    password = data.get("password") or ""

    if not identifier or not password:
        return jsonify({"error": "Team ID (or Name) and password are required."}), 400

    team = None

    # 1. Check Supabase public.login_credentials table first (Unified table for Teams & Organizers)
    if supabase_service.is_configured():
        cred = supabase_service.get_credential_from_supabase(identifier, role="team")
        if cred:
            if not cred.get("is_active", True):
                return jsonify({"error": "This team account has been disabled in Supabase."}), 403

            stored_pwd = cred.get("password", "")
            if not check_password_match(stored_pwd, password):
                return jsonify({"error": "Invalid team credentials."}), 401

            actual_tid = str(cred["username"]).strip().upper()
            team_name = str(cred.get("name") or actual_tid)

            # Sync team into local memory DB
            db.teams.update_one(
                {"team_id": actual_tid},
                {"$set": {
                    "team_id": actual_tid,
                    "team_name": team_name,
                    "is_active": True,
                    "synced_from_supabase": True
                }},
                upsert=True
            )
            team = {"team_id": actual_tid, "team_name": team_name}

        # 1b. Fallback to public.teams table if login_credentials didn't have it
        if not team:
            supa_team = supabase_service.get_team_from_supabase(identifier)
            if supa_team:
                if not supa_team.get("is_active", True):
                    return jsonify({"error": "This team account has been disabled in Supabase."}), 403

                stored_pwd = supa_team.get("password", "")
                if not check_password_match(stored_pwd, password):
                    return jsonify({"error": "Invalid team credentials."}), 401

                actual_tid = str(supa_team["team_id"]).strip().upper()
                team_name = str(supa_team.get("team_name") or actual_tid)

                db.teams.update_one(
                    {"team_id": actual_tid},
                    {"$set": {
                        "team_id": actual_tid,
                        "team_name": team_name,
                        "is_active": True,
                        "synced_from_supabase": True
                    }},
                    upsert=True
                )
                team = {"team_id": actual_tid, "team_name": team_name}

    # 2. Fall back to local DB if not found in Supabase
    if not team:
        clean_id = identifier.upper()
        local_team = db.teams.find_one({"$or": [{"team_id": clean_id}, {"team_name": identifier}]})
        if not local_team:
            return jsonify({"error": "Invalid Team ID or password."}), 401

        if not local_team.get("is_active", True):
            return jsonify({"error": "This team account has been disabled."}), 403

        stored = local_team.get("password_hash") or local_team.get("password", "")
        if not check_password_match(stored, password):
            return jsonify({"error": "Invalid Team ID or password."}), 401

        team = {"team_id": local_team["team_id"], "team_name": local_team.get("team_name", local_team["team_id"])}

    team_id = team["team_id"]
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
            "team_name": team["team_name"]
        },
        "quiz_state": quiz_engine.get_state()
    })

@auth_bp.route("/api/auth/admin-login", methods=["POST"])
def admin_login():
    data = request.get_json() or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return jsonify({"error": "Username and password are required."}), 400

    authenticated = False
    admin_display_name = username

    # 1. Check Supabase public.login_credentials table first (role = 'organizer')
    if supabase_service.is_configured():
        cred = supabase_service.get_credential_from_supabase(username, role="organizer")
        if cred:
            if not cred.get("is_active", True):
                return jsonify({"error": "This organizer account has been disabled in Supabase."}), 403
            stored_pwd = cred.get("password", "")
            if check_password_match(stored_pwd, password):
                authenticated = True
                admin_display_name = cred.get("name") or cred.get("username", username)

        # 1b. Fallback to public.admins table
        if not authenticated:
            supa_admin = supabase_service.get_admin_from_supabase(username)
            if supa_admin:
                stored_pwd = supa_admin.get("password", "")
                if check_password_match(stored_pwd, password):
                    authenticated = True
                    admin_display_name = supa_admin.get("username", username)

    # 2. Fall back to environment credentials
    if not authenticated:
        if username.lower() == ADMIN_USERNAME.lower() and password == ADMIN_PASSWORD:
            authenticated = True
            admin_display_name = ADMIN_USERNAME

    if authenticated:
        return jsonify({
            "success": True,
            "token": ADMIN_TOKEN,
            "role": "admin",
            "username": admin_display_name,
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
