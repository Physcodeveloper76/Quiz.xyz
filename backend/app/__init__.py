import os
from flask import Flask, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO
from app.services.quiz_engine import quiz_engine

socketio = SocketIO(
    cors_allowed_origins="*",
    async_mode="threading",
    ping_timeout=20,
    ping_interval=10
)

def create_app():
    dist_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))
    
    app = Flask(__name__, static_folder=dist_dir if os.path.exists(dist_dir) else None)
    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "super-secret-championship-quiz-key-12345")

    # CORS configuration
    CORS(app, resources={r"/*": {"origins": "*"}})

    # Register Blueprints
    from app.routes.auth import auth_bp
    from app.routes.admin import admin_bp
    from app.routes.quiz import quiz_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(quiz_bp)

    # Initialize SocketIO with app
    socketio.init_app(app)

    # Inject socketio into quiz_engine
    quiz_engine.set_socketio(socketio)

    # Register socket event handlers
    from app.sockets.events import register_socket_events
    register_socket_events(socketio)

    @app.route("/health", methods=["GET"])
    @app.route("/api/health", methods=["GET"])
    def health():
        return {"status": "ok", "app": "Live Team Quiz Platform Backend"}

    # Serve Frontend SPA from Flask
    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_frontend(path):
        if app.static_folder and os.path.exists(os.path.join(app.static_folder, path)) and path != "":
            return send_from_directory(app.static_folder, path)
        elif app.static_folder and os.path.exists(os.path.join(app.static_folder, "index.html")):
            return send_from_directory(app.static_folder, "index.html")
        else:
            return """
            <!DOCTYPE html>
            <html>
            <head><title>WebForge Live</title></head>
            <body style="font-family:sans-serif;background:#0A0D14;color:#F1F5F9;display:flex;align-items:center;justify-content:center;height:90vh;">
                <div style="text-align:center;padding:40px;border:1px solid rgba(255,255,255,0.1);border-radius:16px;">
                    <h1 style="color:#6366F1;">⚡ WebForge Live Server</h1>
                    <p style="color:#94A3B8;">The backend is running. Open the frontend dev server at:</p>
                    <a href="http://127.0.0.1:3000" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#6366F1;color:white;text-decoration:none;border-radius:8px;font-weight:bold;">Open Frontend UI (Port 3000)</a>
                </div>
            </body>
            </html>
            """

    return app
