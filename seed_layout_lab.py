#!/usr/bin/env python3
"""Seed the layout-lab tree without wiping the real family.

Usage:
    py seed_layout_lab.py

Only deletes people tagged notes=layout-lab, then inserts the synthetic
cases (couples, in-laws, half-siblings, sibling holes, depth mismatch, …).
"""
from __future__ import annotations

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
    result = subprocess.run(
        [str(venv_python), "manage.py", "seed_layout_lab"],
        cwd=BACKEND_DIR,
    )
    sys.exit(result.returncode)


if __name__ == "__main__":
    main()
