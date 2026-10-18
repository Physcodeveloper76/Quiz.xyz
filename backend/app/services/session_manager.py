import time
import uuid
import secrets
import hashlib
from app.database import db

# Argon2 password hashing with secure SHA-256 fallback
try:
    from argon2 import PasswordHasher
    from argon2.exceptions import VerifyMismatchError
    ph = PasswordHasher()
    def hash_password(password: str) -> str:
        return ph.hash(password)
    def verify_password(hashed: str, password: str) -> bool:
        if hashed.startswith("$argon2"):
            try:
                return ph.verify(hashed, password)
            except VerifyMismatchError:
                return False
        # Fallback check
        return secrets.compare_digest(hashed, hashlib.sha256(password.encode()).hexdigest())
except ImportError:
    def hash_password(password: str) -> str:
        return hashlib.sha256(password.encode()).hexdigest()
    def verify_password(hashed: str, password: str) -> bool:
        return secrets.compare_digest(hashed, hashlib.sha256(password.encode()).hexdigest())

SESSION_LEASE_SECONDS = 180  # 3 minutes lease window

class SessionManager:
    @staticmethod
    def claim_session(team_id: str) -> tuple[bool, str, str]:
        """
        Atomically claims a session for a team.
        Returns: (success, session_id_or_error, session_token)
        """
        now = time.time()
        existing_session = db.team_sessions.find_one({"team_id": team_id})

        # Check if an active non-expired session exists
        if existing_session:
            expires_at = existing_session.get("lease_expires_at", 0)
            revoked_at = existing_session.get("revoked_at")
            if not revoked_at and expires_at > now:
                return False, "Another device is currently logged in with this team account. Please log out first or contact the host.", ""

        session_id = str(uuid.uuid4())
        session_token = secrets.token_hex(32)
        lease_expires_at = now + SESSION_LEASE_SECONDS

        session_doc = {
            "team_id": team_id,
            "session_id": session_id,
            "session_token": session_token,
            "created_at": now,
            "last_heartbeat_at": now,
            "lease_expires_at": lease_expires_at,
            "revoked_at": None
        }

        # Atomically upsert the session record
        db.team_sessions.update_one(
            {"team_id": team_id},
            {"$set": session_doc},
            upsert=True
        )

        return True, session_id, session_token

    @staticmethod
    def validate_session(team_id: str, session_token: str) -> bool:
        """Validates that the session token is valid, matches team, and has not expired or been revoked."""
        if not team_id or not session_token:
            return False
        
        session = db.team_sessions.find_one({"team_id": team_id})
        if not session:
            return False
        
        if session.get("revoked_at") is not None:
            return False
        
        if not secrets.compare_digest(session.get("session_token", ""), session_token):
            return False
        
        now = time.time()
        # Allow grace period for active socket connections
        if session.get("lease_expires_at", 0) < now - 30:
            return False
        
        # Extend lease on valid activity
        db.team_sessions.update_one(
            {"team_id": team_id},
            {"$set": {
                "last_heartbeat_at": now,
                "lease_expires_at": now + SESSION_LEASE_SECONDS
            }}
        )
        return True

    @staticmethod
    def release_session(team_id: str) -> bool:
        """Admin release or voluntary logout of a team session."""
        db.team_sessions.delete_one({"team_id": team_id})
        return True

    @staticmethod
    def revoke_session(team_id: str) -> bool:
        """Revokes an active session immediately."""
        db.team_sessions.update_one(
            {"team_id": team_id},
            {"$set": {
                "revoked_at": time.time(),
                "lease_expires_at": 0
            }}
        )
        return True

    @staticmethod
    def get_active_sessions():
        """Returns map of active team sessions."""
        now = time.time()
        sessions = db.team_sessions.find({
            "revoked_at": None,
            "lease_expires_at": {"$gt": now}
        })
        return {s["team_id"]: s for s in sessions}

session_manager = SessionManager()
