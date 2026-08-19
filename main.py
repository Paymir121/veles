#!/usr/bin/env python3
"""Run backend (Django) and frontend (Vite) dev servers together, no Docker.

Usage:
    py main.py                      # both servers (or: .\\run.ps1 / run.bat)
    py main.py --backend-only
    py main.py --frontend-only

Note: on this machine `python`/`python3` are not on PATH (only a non-functional
Windows Store alias resolves) -- use the `py` launcher instead, which finds the
real interpreter. `run.ps1`/`run.bat` do this for you.
"""
from __future__ import annotations

import argparse
import shutil
import signal
import socket
import subprocess
import sys
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND_DIR = ROOT / "backend"
FRONTEND_DIR = ROOT / "frontend"
BACKEND_PORT = 8000
BACKEND_READY_TIMEOUT = 30.0

processes: list[subprocess.Popen] = []
processes_lock = threading.Lock()


def stream_output(process: subprocess.Popen, prefix: str) -> None:
    assert process.stdout is not None
    for line in process.stdout:
        print(f"[{prefix}] {line.rstrip()}")


def wait_for_backend(timeout: float = BACKEND_READY_TIMEOUT) -> bool:
    """Poll until something is actually listening on BACKEND_PORT.

    Without this, Vite (ready in ~300ms) starts serving the page before
    Django (system checks + the autoreloader's subprocess fork) has bound
    its port, a few seconds later -- the browser's first request(s) to
    /api/tree/ hit ECONNREFUSED and the tree page shows a permanent "failed
    to load" error until the user manually reloads.
    """
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with socket.create_connection(("127.0.0.1", BACKEND_PORT), timeout=0.5):
                return True
        except OSError:
            time.sleep(0.2)
    return False


def check_backend_ready() -> str | None:
    venv_python = BACKEND_DIR / ".venv" / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python")
    if not (BACKEND_DIR / "manage.py").exists():
        return f"backend/manage.py not found — has the Django project been scaffolded yet in {BACKEND_DIR}?"
    if not venv_python.exists():
        return (
            "backend/.venv not found. Create it and install dependencies first:\n"
            f"    cd backend && python -m venv .venv && "
            f"{'.venv\\Scripts\\activate' if sys.platform == 'win32' else 'source .venv/bin/activate'} "
            f"&& pip install -r requirements.txt"
        )
    return None


def check_frontend_ready() -> str | None:
    if not (FRONTEND_DIR / "package.json").exists():
        return f"frontend/package.json not found — has the Vite project been scaffolded yet in {FRONTEND_DIR}?"
    if not (FRONTEND_DIR / "node_modules").exists():
        return "frontend/node_modules not found. Install dependencies first:\n    cd frontend && npm install"
    if shutil.which("npm") is None:
        return "npm not found on PATH. Install Node.js first."
    return None


def start_backend() -> subprocess.Popen:
    venv_python = BACKEND_DIR / ".venv" / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python")
    return subprocess.Popen(
        [str(venv_python), "manage.py", "runserver", "0.0.0.0:8000"],
        cwd=BACKEND_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )


def start_frontend() -> subprocess.Popen:
    npm = shutil.which("npm")
    assert npm is not None
    # --force: ignore Vite's dependency-optimization cache (node_modules/.vite)
    # and re-bundle from scratch on every start. Without this, editing files
    # under node_modules (e.g. verifying a library's own source) or certain
    # dependency-graph changes can keep serving a stale pre-transformed
    # module to the browser even after a restart.
    return subprocess.Popen(
        [npm, "run", "dev", "--", "--force"],
        cwd=FRONTEND_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        shell=False,
    )


def shutdown(*_args) -> None:
    print("\nStopping...")
    with processes_lock:
        for process in processes:
            process.terminate()
        for process in processes:
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
    sys.exit(0)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--backend-only", action="store_true")
    parser.add_argument("--frontend-only", action="store_true")
    args = parser.parse_args()

    run_backend = not args.frontend_only
    run_frontend = not args.backend_only

    if run_backend:
        error = check_backend_ready()
        if error:
            print(f"[backend] {error}", file=sys.stderr)
            sys.exit(1)
    if run_frontend:
        error = check_frontend_ready()
        if error:
            print(f"[frontend] {error}", file=sys.stderr)
            sys.exit(1)

    signal.signal(signal.SIGINT, shutdown)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, shutdown)

    if run_backend:
        with processes_lock:
            backend_process = start_backend()
            processes.append(backend_process)
        threading.Thread(target=stream_output, args=(backend_process, "backend"), daemon=True).start()

        if run_frontend:
            # Only meaningful when starting both together -- --backend-only
            # has no frontend waiting on it, --frontend-only has no backend
            # here at all.
            print("[main] Waiting for backend to start...")
            if not wait_for_backend():
                print(
                    f"[main] Backend did not start listening on port {BACKEND_PORT} within "
                    f"{BACKEND_READY_TIMEOUT:.0f}s -- starting frontend anyway, but it will "
                    "likely fail to load data until the backend catches up.",
                    file=sys.stderr,
                )

    if run_frontend:
        with processes_lock:
            frontend_process = start_frontend()
            processes.append(frontend_process)
        threading.Thread(target=stream_output, args=(frontend_process, "frontend"), daemon=True).start()

    print("Running. Backend: http://localhost:8000  Frontend: http://localhost:5173  (Ctrl+C to stop)")
    try:
        for process in processes:
            process.wait()
    except KeyboardInterrupt:
        pass
    shutdown()


if __name__ == "__main__":
    main()
