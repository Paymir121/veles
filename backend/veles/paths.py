"""Frozen vs source path helpers for the portable Windows build.

Writable state (SQLite, media, logs, secret key) lives next to the exe in
``data/``. Read-only bundle content (SPA, Django static) lives in
``sys._MEIPASS`` when frozen, or ``backend/`` when running from source.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path


def is_frozen() -> bool:
    return bool(getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"))


def bundle_dir() -> Path:
    """Read-only assets: SPA bundle, collectstatic output, packaged Python."""
    override = os.environ.get("VELES_BUNDLE_DIR")
    if override:
        return Path(override).resolve()
    if is_frozen():
        return Path(sys._MEIPASS)
    return Path(__file__).resolve().parent.parent


def exe_dir() -> Path:
    if is_frozen():
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent.parent


def data_dir() -> Path:
    """Writable runtime data. Override with VELES_DATA_DIR (used at build time)."""
    override = os.environ.get("VELES_DATA_DIR")
    if override:
        path = Path(override).resolve()
    elif is_frozen():
        path = exe_dir() / "data"
    else:
        path = bundle_dir()
    path.mkdir(parents=True, exist_ok=True)
    return path


def project_root() -> Path:
    if is_frozen():
        return exe_dir()
    return Path(__file__).resolve().parent.parent.parent


def spa_dir() -> Path:
    """Vite production bundle: frozen ``spa/``, otherwise ``frontend/dist``."""
    override = os.environ.get("VELES_SPA_DIR")
    if override:
        return Path(override).resolve()
    packaged = bundle_dir() / "spa"
    if is_frozen() or packaged.is_dir():
        return packaged
    return project_root() / "frontend" / "dist"
