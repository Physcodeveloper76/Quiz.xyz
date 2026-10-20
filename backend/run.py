import os
import sys

# Set standard encoding to utf-8 if possible
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from app import create_app, socketio

app = create_app()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"Starting Live Team Quiz Backend on http://localhost:{port}")
    socketio.run(app, host="0.0.0.0", port=port, debug=False, allow_unsafe_werkzeug=True)
