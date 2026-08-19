"""Project logger, ported from the same `logger/logger.py` pattern used in
dsinvent and ts_piot: a custom Logger subclass with extra levels (SUCCESS,
COMPLETE), a colored console handler, and a one-file-per-day rotating file
handler, all controlled by a single module-level `py_logger` singleton
imported as `from logger.logger import py_logger`.

Deliberately dropped from the ported version (not applicable here): the
in-memory LOG_BUFFER + WebSocket broadcast handler (ts_piot) and the
PySide6 log-panel wiring (dsinvent/dsconfig) -- veles has neither a
WebSocket layer nor a desktop GUI. If a future admin-facing "recent logs"
view is wanted, re-add a buffer handler then.

Level is configurable via the LOG_LEVEL env var (read directly here, same
approach as the existing LOG_FUNCTIONS var) so local runs and the Docker
deployment can each set their own default in .env:
  - backend/.env(.example): LOG_LEVEL=DEBUG   (local dev, main.py)
  - root .env(.example):    LOG_LEVEL=INFO    (docker-compose deployment)
"""
from __future__ import annotations

import inspect
import logging
import os
import sys
import time
import traceback
from datetime import datetime
from functools import wraps
from pathlib import Path
from typing import Any


def _get_log_dir() -> Path:
    """backend/log/ locally; /app/log inside the Docker image (same relative
    layout, since the Dockerfile COPYs backend/ to WORKDIR /app). Falls back
    to cwd/log if the preferred location isn't writable."""
    log_dir = Path(__file__).resolve().parent.parent / "log"
    try:
        log_dir.mkdir(parents=True, exist_ok=True)
    except OSError:
        log_dir = Path.cwd() / "log"
        log_dir.mkdir(parents=True, exist_ok=True)
    return log_dir


class ColoredFormatter(logging.Formatter):
    """Console formatter with ANSI colors per level."""

    COLORS: dict[str, str] = {
        "COMPLETE": "\033[32m",
        "DEBUG": "\033[35m",
        "INFO": "\033[34m",
        "SUCCESS": "\033[36m",
        "WARNING": "\033[33m",
        "ERROR": "\033[31m",
        "CRITICAL": "\033[31m",
        "RESET": "\033[0m",
    }

    def format(self, record: logging.LogRecord) -> str:
        message = super().format(record)
        if record.levelname in self.COLORS:
            message = f"{self.COLORS[record.levelname]}{message}{self.COLORS['RESET']}"
        return message


_daily_file_handler: "DayRotatingFileHandler | None" = None


class DayRotatingFileHandler(logging.Handler):
    """One log file per calendar day: log/YYYY-MM-DD.log. Rotates when the
    date changes, not by size -- matches the dsinvent/ts_piot behavior."""

    def __init__(self, log_dir: Path | None = None, encoding: str = "utf-8"):
        super().__init__()
        self.createLock()
        self.terminator = "\n"
        self._log_dir = log_dir or _get_log_dir()
        self._encoding = encoding
        self._current_date: str | None = None
        self._stream = None

    def _open_new_file(self, dt: datetime) -> None:
        if self._stream is not None:
            try:
                self._stream.close()
            except Exception:
                pass
        name = dt.strftime("%Y-%m-%d.log")
        self._current_date = dt.strftime("%Y-%m-%d")
        self._stream = open(self._log_dir / name, "a", encoding=self._encoding)

    def emit(self, record: logging.LogRecord) -> None:
        try:
            with self.lock:
                now = datetime.now()
                today = now.strftime("%Y-%m-%d")
                if self._stream is None or today != self._current_date:
                    self._open_new_file(now)
                self._stream.write(self.format(record) + self.terminator)
                self._stream.flush()
        except Exception:
            self.handleError(record)

    def close(self) -> None:
        with self.lock:
            if self._stream is not None:
                try:
                    self._stream.close()
                except Exception:
                    pass
                self._stream = None
            super().close()


def _get_daily_file_handler() -> DayRotatingFileHandler:
    # One shared handler per process -- guarantees a single file per day
    # even if Logger() is instantiated more than once (e.g. per-module).
    global _daily_file_handler
    if _daily_file_handler is None:
        _daily_file_handler = DayRotatingFileHandler(log_dir=_get_log_dir())
    return _daily_file_handler


_LEVEL_MAPPING: dict[str, int] = {
    "CRITICAL": logging.CRITICAL,
    "ERROR": logging.ERROR,
    "WARNING": logging.WARNING,
    "INFO": logging.INFO,
    "DEBUG": logging.DEBUG,
}


class Logger(logging.Logger):
    """Adds SUCCESS (between INFO and WARNING) and COMPLETE (between DEBUG
    and INFO) levels on top of the standard ones, same numeric slots used in
    ts_piot's logger."""

    SUCCESS = 25
    logging.addLevelName(SUCCESS, "SUCCESS")

    COMPLETE = 11
    logging.addLevelName(COMPLETE, "COMPLETE")

    def __init__(self, name: str):
        super().__init__(name)

        file_handler = _get_daily_file_handler()
        file_handler.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))
        if file_handler not in self.handlers:
            self.addHandler(file_handler)

        console_handler = logging.StreamHandler()
        console_handler.setFormatter(ColoredFormatter("|%(levelname)-8s|%(asctime)s|: %(message)s"))
        self.addHandler(console_handler)

        # LOG_FUNCTIONS=1 turns on the @error_logger entry/exit/timing logs.
        self.are_functions_logged: bool = os.environ.get("LOG_FUNCTIONS", "").strip().lower() in (
            "1",
            "true",
            "yes",
        )

        self.set_lvl_log(os.environ.get("LOG_LEVEL", "DEBUG"))
        self.debug(
            f"LOG.0: Logger initialized. LOG_LEVEL={logging.getLevelName(self.level)} "
            f"LOG_FUNCTIONS={self.are_functions_logged}"
        )

    def success(self, msg: str, *args, **kwargs) -> None:
        if self.isEnabledFor(self.SUCCESS):
            self._log(self.SUCCESS, msg, args, **kwargs)

    def complete(self, msg: str, *args, **kwargs) -> None:
        if self.isEnabledFor(self.COMPLETE):
            self._log(self.COMPLETE, msg, args, **kwargs)

    def set_lvl_log(self, lvl_logger: str = "DEBUG") -> None:
        """Change the active level at runtime. Same name/shape as the
        dsinvent/ts_piot method, for consistency with that codebase."""
        new_level = _LEVEL_MAPPING.get(lvl_logger.upper(), logging.DEBUG)
        self.setLevel(new_level)
        for handler in self.handlers:
            handler.setLevel(new_level)
        self.debug(f"LOG.1: Log level changed to {logging.getLevelName(new_level)}")

    def set_are_functions_logged(self, value: bool) -> None:
        self.are_functions_logged = bool(value)
        self.debug(f"LOG.2: Function call logging set to: {self.are_functions_logged}")


py_logger: Logger = Logger("veles")


def error_logger():
    """Decorator: logs function entry/exit (+ timing, if LOG_FUNCTIONS=1) at
    COMPLETE level, and the full traceback at CRITICAL on any exception
    (then re-raises -- unlike the dsinvent version, this must not swallow
    exceptions inside a DRF view/serializer)."""

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            start_time: float | None = time.time() if py_logger.are_functions_logged else None
            try:
                result = func(*args, **kwargs)
                if start_time is not None:
                    py_logger.complete(
                        f"LOG.3: time={time.time() - start_time:.4f}s def={func.__name__} "
                        f"path={inspect.getfile(func)}"
                    )
                else:
                    py_logger.complete(f"LOG.4: def={func.__name__}")
                return result
            except Exception as err:
                py_logger.critical(
                    f"LOG.5: def={func.__name__}(...) error={err} "
                    f"path={inspect.getfile(func)}\n{traceback.format_exc()}"
                )
                raise

        return wrapper

    return decorator


if __name__ == "__main__":
    py_logger.debug("debug")
    py_logger.info("info")
    py_logger.success("success")
    py_logger.complete("complete")
    py_logger.warning("warning")
    py_logger.error("error")
    py_logger.critical("critical")
