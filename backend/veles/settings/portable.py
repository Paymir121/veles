"""Settings for the portable Windows exe (and `py portable.py` from source).

SQLite, SPA, media and logs all live in the writable data dir next to the
exe. Django admin static is served by WhiteNoise from the frozen bundle.
"""
from __future__ import annotations

import os
import secrets
from pathlib import Path

from veles.paths import bundle_dir, data_dir, spa_dir

from .base import *  # noqa: F401, F403

DEBUG = False
SERVE_SPA = True

_data = data_dir()
_bundle = bundle_dir()

SPA_DIR = spa_dir()
STATIC_ROOT = _bundle / "staticfiles"
MEDIA_ROOT = _data / "media"
MEDIA_ROOT.mkdir(parents=True, exist_ok=True)

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": str(_data / "db.sqlite3"),
    }
}


def _read_or_create_secret(path: Path) -> str:
    if path.is_file():
        value = path.read_text(encoding="utf-8").strip()
        if value:
            return value
    value = secrets.token_urlsafe(50)
    path.write_text(value, encoding="utf-8")
    return value


SECRET_KEY = os.environ.get("SECRET_KEY") or _read_or_create_secret(_data / ".secret_key")

ALLOWED_HOSTS = env.list(  # noqa: F405
    "ALLOWED_HOSTS",
    default=["127.0.0.1", "localhost", "[::1]"],
)
_bind_host = os.environ.get("VELES_HOST", "127.0.0.1").strip()
if _bind_host in {"0.0.0.0", "::"} and "*" not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append("*")

_port = os.environ.get("VELES_PORT", "8000").strip() or "8000"
CSRF_TRUSTED_ORIGINS = [
    f"http://127.0.0.1:{_port}",
    f"http://localhost:{_port}",
]

# WhiteNoise after SecurityMiddleware (first item in the base list).
_mw = list(MIDDLEWARE)  # noqa: F405
if "whitenoise.middleware.WhiteNoiseMiddleware" not in _mw:
    _mw.insert(1, "whitenoise.middleware.WhiteNoiseMiddleware")
MIDDLEWARE = _mw

STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedStaticFilesStorage",
    },
}

CORS_ALLOWED_ORIGINS = []
