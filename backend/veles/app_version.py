"""Application version, used by the portable exe and by build/build.py.

Kept import-light (no Django) so the build script can read it without
bootstrapping settings.
"""
from __future__ import annotations

from typing import Final

try:
    from veles.build_meta import BUILD_HASH as _BUILD_HASH
except Exception:
    _BUILD_HASH = "nogit"


def _short_build_hash(value: str, default: str = "nogit", min_len: int = 5, max_len: int = 10) -> str:
    text = str(value or "").strip().lower()
    if len(text) < min_len:
        return default
    return text[:max_len]


VERSION_PREFIX: Final[str] = "v"
APP_NAME_PREFIX: Final[str] = "Велес"
FOLDER_NAME_PREFIX: Final[str] = "veles_"


class Settings:
    """Runtime version bits. Numbers are bumped here, not in build.py."""

    major: int = 0
    minor: int = 1
    patch: int = 0
    build: int = 0
    hash: str = _short_build_hash(_BUILD_HASH)
    APP_VERSION: str = f"{VERSION_PREFIX}{major}.{minor}.{patch}.{build}.commit-{hash}"
    APP_NAME: str = f"{APP_NAME_PREFIX} {APP_VERSION}"
    FOLDER_NAME: str = f"{FOLDER_NAME_PREFIX}{APP_VERSION}"


settings = Settings()
