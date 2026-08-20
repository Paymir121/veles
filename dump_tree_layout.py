#!/usr/bin/env python3
"""Dump the current tree grid as readable text for layout debugging.

Usage:
    py dump_tree_layout.py
    py dump_tree_layout.py --q Логинов
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND_DIR = ROOT / "backend"


def main() -> None:
    venv_python = BACKEND_DIR / ".venv" / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python")
    if not venv_python.exists():
        print("backend/.venv not found.", file=sys.stderr)
        sys.exit(1)
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    result = subprocess.run(
        [str(venv_python), "manage.py", "dump_tree_layout", *sys.argv[1:]],
        cwd=BACKEND_DIR,
        env=env,
    )
    sys.exit(result.returncode)


if __name__ == "__main__":
    main()
