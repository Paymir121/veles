#!/usr/bin/env python3
"""Portable Veles: one process serves Django + the built SPA, then opens a browser.

Usage:
    py portable.py                  # from the repo (needs frontend/dist)
    Veles.exe                       # frozen by build/build.py

Stop with Ctrl+C. A second launch on a busy port just re-opens the browser.

If the window flashes and dies: look at crash.log next to the exe. If even
that is missing, the bootloader failed (typically no python314.dll in
_internal — incomplete PyInstaller COLLECT).
"""
from __future__ import annotations

import argparse
import os
import socket
import sys
import threading
import traceback
import webbrowser
from pathlib import Path


def _crash_log_path() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent / "crash.log"
    return Path(__file__).resolve().parent / "crash.log"


def _write_crash_log(text: str) -> Path | None:
    path = _crash_log_path()
    try:
        path.write_text(text, encoding="utf-8")
        return path
    except OSError:
        return None


def _install_crash_hook() -> None:
    def hook(exc_type, exc, tb):
        text = "".join(traceback.format_exception(exc_type, exc, tb))
        path = _write_crash_log(text)
        sys.stderr.write(text)
        if path is not None:
            sys.stderr.write(f"\nЗаписано в {path}\n")
        if getattr(sys, "frozen", False):
            try:
                input("Enter — закрыть окно...")
            except Exception:
                pass

    sys.excepthook = hook


_install_crash_hook()


def _prepare_source_path() -> None:
    if getattr(sys, "frozen", False):
        return
    backend = Path(__file__).resolve().parent / "backend"
    if str(backend) not in sys.path:
        sys.path.insert(0, str(backend))


_prepare_source_path()

from veles.paths import data_dir, is_frozen, spa_dir  # noqa: E402


def _load_data_env() -> None:
    env_file = data_dir() / ".env"
    if not env_file.is_file():
        return
    try:
        import environ

        environ.Env.read_env(env_file)
    except Exception:
        pass


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Запуск Велеса как локального сервера.")
    parser.add_argument("--host", default=os.environ.get("VELES_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("VELES_PORT", "8000")))
    parser.add_argument(
        "--no-browser",
        action="store_true",
        help="Не открывать браузер (для проверки из скрипта).",
    )
    return parser.parse_args()


def port_in_use(host: str, port: int) -> bool:
    probe_host = "127.0.0.1" if host in {"0.0.0.0", "::"} else host
    try:
        with socket.create_connection((probe_host, port), timeout=0.5):
            return True
    except OSError:
        return False


def main() -> int:
    args = parse_args()
    os.environ["VELES_HOST"] = args.host
    os.environ["VELES_PORT"] = str(args.port)
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "veles.settings.portable")
    os.environ.setdefault("VELES_DATA_DIR", str(data_dir()))
    os.environ.setdefault("VELES_LOG_DIR", str(data_dir() / "log"))
    _load_data_env()

    from logger.logger import py_logger
    from veles.app_version import settings as app_settings

    spa = spa_dir()
    if not (spa / "index.html").is_file():
        py_logger.error(
            f"Нет собранного фронтенда ({spa / 'index.html'}). "
            "Соберите: cd frontend && npm run build  (или py build/build.py)"
        )
        return 1

    import django
    from django.core.management import call_command
    from django.core.wsgi import get_wsgi_application

    django.setup()
    call_command("migrate", interactive=False, run_syncdb=True)
    if not is_frozen():
        call_command("collectstatic", interactive=False, verbosity=0)

    url = f"http://{args.host if args.host not in {'0.0.0.0', '::'} else '127.0.0.1'}:{args.port}/"
    py_logger.info(f"{app_settings.APP_NAME} → {url}")
    py_logger.info(f"Данные: {data_dir()}")
    py_logger.info("Остановка: Ctrl+C")

    if port_in_use(args.host, args.port):
        py_logger.warning(f"Порт {args.port} уже занят — открываю браузер к уже запущенному серверу.")
        if not args.no_browser:
            webbrowser.open(url)
        return 0

    if not args.no_browser:
        threading.Timer(1.0, lambda: webbrowser.open(url)).start()

    from waitress import serve

    serve(get_wsgi_application(), host=args.host, port=args.port, threads=6, ident="veles")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\nВелес остановлен.")
        raise SystemExit(0)
    except Exception:
        text = traceback.format_exc()
        path = _write_crash_log(text)
        sys.stderr.write(text)
        if path is not None:
            sys.stderr.write(f"\nЗаписано в {path}\n")
        if getattr(sys, "frozen", False):
            try:
                input("Enter — закрыть окно...")
            except Exception:
                pass
        raise SystemExit(1)
