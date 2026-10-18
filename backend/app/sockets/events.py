import logging
from flask import request
from flask_socketio import emit, join_room, leave_room, disconnect
from app.services.session_manager import session_manager
from app.services.quiz_engine import quiz_engine
from app.services.leaderboard import leaderboard_service

logger = logging.getLogger("SocketEvents")

# Map of socket SID -> { "role": "team"|"admin", "team_id": ... }
connected_clients = {}

def register_socket_events(socketio):
    @socketio.on("connect")
    def handle_connect():
        logger.info(f"Client connected: {request.sid}")

    @socketio.on("disconnect")
    def handle_disconnect():
        sid = request.sid
        info = connected_clients.pop(sid, None)
        if info and info.get("role") == "team":
            team_id = info.get("team_id")
            # If no other sockets for this team are connected
            still_connected = any(c.get("team_id") == team_id for c in connected_clients.values())
            if not still_connected:
                quiz_engine.connected_teams.discard(team_id)
                # Broadcast updated connected count
                socketio.emit("telemetry_update", {
                    "connected_teams_count": len(quiz_engine.connected_teams)
                })
        logger.info(f"Client disconnected: {sid}")

    @socketio.on("join_quiz")
    def handle_join_quiz(data):
        """
        Authenticates connection and joins authorized room.
        Data: { "role": "team" | "admin", "team_id": "...", "token": "..." }
        """
        sid = request.sid
        role = data.get("role", "team")
        token = data.get("token")
        team_id = (data.get("team_id") or "").strip().upper()

        if role == "admin":
            from app.routes.auth import ADMIN_TOKEN
            if token != ADMIN_TOKEN:
                emit("auth_error", {"error": "Invalid admin token."})
                disconnect()
                return
            connected_clients[sid] = {"role": "admin"}
            join_room("admin_room")
            emit("joined_success", {"role": "admin", "state": quiz_engine.get_state()})
            return

        # For team participant
        if not team_id or not token:
            emit("auth_error", {"error": "Authentication token and Team ID are required."})
            disconnect()
            return

        if not session_manager.validate_session(team_id, token):
            emit("auth_error", {"error": "Invalid or expired session. Please re-login."})
            disconnect()
            return

        connected_clients[sid] = {"role": "team", "team_id": team_id}
        join_room(team_id) # Private team room
        join_room("quiz_participants") # Global broadcast room

        quiz_engine.connected_teams.add(team_id)

        # Send current quiz state to newly joined / reconnected team
        emit("joined_success", {
            "role": "team",
            "team_id": team_id,
            "state": quiz_engine.get_state()
        })

        # Broadcast telemetry update
        socketio.emit("telemetry_update", {
            "connected_teams_count": len(quiz_engine.connected_teams)
        })

    @socketio.on("submit_answer")
    def handle_submit_answer(data):
        sid = request.sid
        info = connected_clients.get(sid)
        if not info or info.get("role") != "team":
            emit("error", {"message": "Unauthorized socket submission."})
            return

        team_id = info["team_id"]
        question_id = data.get("question_id")
        selected_option = data.get("selected_option")
        request_id = data.get("request_id")

        if not question_id or not selected_option:
            emit("error", {"message": "Invalid answer payload."})
            return

        success, message, points = quiz_engine.submit_answer(
            team_id=team_id,
            question_id=question_id,
            selected_option=selected_option,
            request_id=request_id
        )

        emit("submission_status", {
            "success": success,
            "message": message,
            "points": points
        })

    @socketio.on("heartbeat")
    def handle_heartbeat(data):
        sid = request.sid
        info = connected_clients.get(sid)
        if info and info.get("role") == "team":
            team_id = info.get("team_id")
            token = data.get("token")
            session_manager.validate_session(team_id, token)
        emit("heartbeat_ack", {"time": True})
