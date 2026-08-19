#!/usr/bin/env python3
"""Reset the database's demo/test data to a known-good state.

Usage:
    py init.py           (or: python init.py, if python is on your PATH)

DESTRUCTIVE ON PURPOSE (this is a test environment): every run wipes all
existing Person/BurialPlace/Union rows and reloads them fresh from
backend/genealogy/fixtures/demo_data.json (plain, human-readable JSON). The
seed_demo_data management command refuses to run unless DEBUG=True, as a
guard rail against ever wiping a real deployment by mistake. Does not touch
User accounts -- the seeded admin/admin login survives a reset.
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
        print(
            "backend/.venv not found. Create it first:\n"
            "    cd backend && python -m venv .venv && "
            f"{'.venv\\Scripts\\activate' if sys.platform == 'win32' else 'source .venv/bin/activate'} "
            "&& pip install -r requirements.txt",
            file=sys.stderr,
        )
        sys.exit(1)

    result = subprocess.run([str(venv_python), "manage.py", "seed_demo_data"], cwd=BACKEND_DIR)
    sys.exit(result.returncode)


if __name__ == "__main__":
    main()
