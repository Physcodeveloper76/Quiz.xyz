import os
import sys
import time
import signal
import subprocess
import webbrowser

# Set standard output encoding for Windows consoles
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

ROOT_DIR = os.path.abspath(os.path.dirname(__file__))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")

processes = []

def clean_exit(sig=None, frame=None):
    print("\n\nShutting down WebForge Live services...")
    for p in processes:
        if p and p.poll() is None:
            try:
                if sys.platform == "win32":
                    subprocess.call(['taskkill', '/F', '/T', '/PID', str(p.pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                else:
                    p.terminate()
            except Exception:
                pass
    print("All services stopped cleanly. Goodbye!")
    sys.exit(0)

# Register termination handlers
signal.signal(signal.SIGINT, clean_exit)
signal.signal(signal.SIGTERM, clean_exit)

def main():
    print("=" * 65)
    print("      ⚡ WEBFORGE LIVE — CHAMPIONSHIP QUIZ PLATFORM ⚡      ")
    print("=" * 65)
    print("\n[1/3] Launching Backend Flask + Socket.IO server on port 5000...")

    backend_cmd = [sys.executable, os.path.join(BACKEND_DIR, "run.py")]
    backend_proc = subprocess.Popen(
        backend_cmd,
        cwd=BACKEND_DIR,
        shell=(sys.platform == "win32")
    )
    processes.append(backend_proc)

    print("[2/3] Launching Frontend Vite dev server on port 3000...")
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
    frontend_cmd = [npm_cmd, "run", "dev", "--", "--host", "127.0.0.1", "--port", "3000"]
    frontend_proc = subprocess.Popen(
        frontend_cmd,
        cwd=FRONTEND_DIR,
        shell=(sys.platform == "win32")
    )
    processes.append(frontend_proc)

    time.sleep(2)

    target_url = "http://127.0.0.1:3000"
    backup_url = "http://127.0.0.1:5000"

    print("\n[3/3] Services are LIVE!")
    print(f"  ➜ Frontend Arena:    {target_url}")
    print(f"  ➜ Backend API & Hub: {backup_url}")
    print("\nCredentials:")
    print("  • Host / Admin:  admin / admin123")
    print("  • Teams (Demo):  TEAM001 to TEAM008 / pass123")
    print("\nPress Ctrl+C at any time to stop all services.")
    print("-" * 65)

    # Automatically open browser
    try:
        webbrowser.open(target_url)
    except Exception:
        pass

    # Keep main thread alive monitoring children
    try:
        while True:
            if backend_proc.poll() is not None:
                print("Backend service terminated unexpectedly.")
                break
            if frontend_proc.poll() is not None:
                print("Frontend service terminated unexpectedly.")
                break
            time.sleep(1)
    except KeyboardInterrupt:
        clean_exit()

if __name__ == "__main__":
    main()
