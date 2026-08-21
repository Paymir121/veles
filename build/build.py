"""
Сборка portable-версии Велес (Django + React → папка с Veles.exe).

Артефакты:
  build/dist/    — готовая папка veles_vX.Y.Z.N.commit-<hash>/
  build/work/    — рабочие файлы PyInstaller
  build/staging/ — SPA + collectstatic перед упаковкой
  build/*.spec   — генерируется на лету

Nuitka из dsinvent сюда не переносился: Django + Vite так не собираются.
PyInstaller onedir — тот же portable-формат (папка с exe, без инсталлятора).

Запуск из корня проекта:
  py build/build.py              — portable
  py build/build.py --installer  — portable + Veles_Setup.exe (нужен Inno Setup 6)
"""
from __future__ import annotations

import argparse
import ast
import codecs
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from datetime import timedelta

BUILD_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BUILD_DIR)
BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend")
FRONTEND_DIR = os.path.join(PROJECT_ROOT, "frontend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

DIST_DIR = os.path.join(BUILD_DIR, "dist")
WORK_DIR = os.path.join(BUILD_DIR, "work")
STAGING_DIR = os.path.join(BUILD_DIR, "staging")
DIST_DIR_REL = os.path.join("build", "dist")
WORK_DIR_REL = os.path.join("build", "work")
SPEC_DIR_REL = "build"
ICON_ICO = os.path.join(BUILD_DIR, "icon.ico")
INNO_SETUP_DOWNLOAD_URL = "https://jrsoftware.org/isdl.php"

try:
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    if sys.stdout.encoding != "UTF-8":
        sys.stdout = codecs.getwriter("utf-8")(sys.stdout.buffer, "replace")

from logger.logger import py_logger  # noqa: E402


def _backend_python() -> str:
    scripts = "Scripts" if os.name == "nt" else "bin"
    exe = "python.exe" if os.name == "nt" else "python"
    candidate = os.path.join(BACKEND_DIR, ".venv", scripts, exe)
    if os.path.isfile(candidate):
        return candidate
    return sys.executable


def _read_settings_version_parts(default: tuple[int, int, int, int] = (0, 1, 0, 0)) -> tuple[int, int, int, int]:
    cfg_path = os.path.join(BACKEND_DIR, "veles", "app_version.py")
    try:
        with open(cfg_path, encoding="utf-8") as f:
            tree = ast.parse(f.read(), filename=cfg_path)
        major = minor = patch = build = None
        for node in tree.body:
            if not isinstance(node, ast.ClassDef) or node.name != "Settings":
                continue
            for child in node.body:
                if not isinstance(child, ast.AnnAssign):
                    continue
                if not isinstance(child.target, ast.Name):
                    continue
                if not isinstance(child.value, ast.Constant) or not isinstance(child.value.value, int):
                    continue
                name = child.target.id
                if name == "major":
                    major = child.value.value
                elif name == "minor":
                    minor = child.value.value
                elif name == "patch":
                    patch = child.value.value
                elif name == "build":
                    build = child.value.value
            if all(isinstance(v, int) for v in (major, minor, patch, build)):
                return major, minor, patch, build
    except Exception as exc:
        py_logger.warning(f"Не удалось прочитать версию из app_version.py: {exc}")
    return default


def _read_setting_constant(name: str, default: str) -> str:
    cfg_path = os.path.join(BACKEND_DIR, "veles", "app_version.py")
    try:
        with open(cfg_path, encoding="utf-8") as f:
            tree = ast.parse(f.read(), filename=cfg_path)
        for node in tree.body:
            if not isinstance(node, ast.AnnAssign):
                continue
            if not isinstance(node.target, ast.Name) or node.target.id != name:
                continue
            val = node.value
            if isinstance(val, ast.Constant) and isinstance(val.value, str) and val.value.strip():
                return val.value.strip()
    except Exception as exc:
        py_logger.warning(f"Не удалось прочитать {name} из app_version.py: {exc}")
    return default


def _get_git_head_hash(default: str = "nogit", short_len: int = 8) -> str:
    n = max(5, min(10, int(short_len)))
    try:
        result = subprocess.run(
            ["git", "rev-parse", f"--short={n}", "HEAD"],
            cwd=PROJECT_ROOT,
            check=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        h = (result.stdout or "").strip().lower()
        if 5 <= len(h) <= 10:
            return h
    except Exception as exc:
        py_logger.warning(f"Не удалось получить git hash HEAD: {exc}")
    return default


def _write_build_meta(build_hash: str) -> None:
    path = os.path.join(BACKEND_DIR, "veles", "build_meta.py")
    content = (
        '"""\n'
        "Build metadata for runtime versioning.\n\n"
        "This file is updated by build/build.py before packaging.\n"
        '"""\n\n'
        f'BUILD_HASH = "{build_hash}"\n'
    )
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(content)


VERSION_PREFIX = _read_setting_constant("VERSION_PREFIX", "v")
FOLDER_NAME_PREFIX = _read_setting_constant("FOLDER_NAME_PREFIX", "veles_")
MAJOR, MINOR, PATCH, BUILD = _read_settings_version_parts()
BUILD_HASH = _get_git_head_hash()
_write_build_meta(BUILD_HASH)
from veles.app_version import settings as st  # noqa: E402

OUTPUT_DIR_NAME = f"{FOLDER_NAME_PREFIX}{st.APP_VERSION}"
FILE_VERSION = f"{MAJOR}.{MINOR}.{PATCH}.{BUILD}"


def format_duration(seconds: float) -> str:
    td = timedelta(seconds=seconds)
    hours, remainder = divmod(td.seconds, 3600)
    minutes, secs = divmod(remainder, 60)
    if td.days > 0:
        return f"{td.days}д {hours:02d}:{minutes:02d}:{secs:02d}"
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    if minutes > 0:
        return f"{minutes:02d}:{secs:02d}"
    if seconds < 10:
        return f"{secs:02d}.{int((seconds % 1) * 100):02d}с"
    return f"{seconds:.0f}с"


def _notify_build_done(title: str, body: str) -> None:
    if sys.platform != "win32":
        return
    ps1 = None
    try:

        def _esc(s: str) -> str:
            return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("'", "’")

        script = "\n".join(
            [
                "$null = [Windows.UI.Notifications.ToastNotificationManager,"
                " Windows.UI.Notifications, ContentType = WindowsRuntime]",
                "$null = [Windows.Data.Xml.Dom.XmlDocument,"
                " Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime]",
                "$xml = [Windows.Data.Xml.Dom.XmlDocument]::new()",
                "$xml.LoadXml('<toast><visual><binding template=\"ToastGeneric\">"
                f"<text>{_esc(title)}</text><text>{_esc(body)}</text>"
                "</binding></visual></toast>')",
                "$toast = [Windows.UI.Notifications.ToastNotification]::new($xml)",
                "[Windows.UI.Notifications.ToastNotificationManager]"
                "::CreateToastNotifier('Велес').Show($toast)",
            ]
        )
        fd, ps1 = tempfile.mkstemp(suffix=".ps1")
        with os.fdopen(fd, "w", encoding="utf-8-sig") as f:
            f.write(script)
        subprocess.run(
            ["powershell", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", ps1],
            capture_output=True,
            timeout=10,
            creationflags=subprocess.CREATE_NO_WINDOW,
        )
    except Exception:
        pass
    finally:
        if ps1:
            try:
                os.remove(ps1)
            except Exception:
                pass


class ProgressIndicator:
    def __init__(self):
        self.running = False
        self.thread = None
        self.current_stage = ""
        self.start_time = None
        self.frames = ["-", "\\", "|", "/"]

    def _animate(self):
        i = 0
        while self.running:
            elapsed = time.time() - self.start_time
            try:
                print(
                    f"\r{self.frames[i]} {self.current_stage} [{format_duration(elapsed)}]",
                    end="",
                    flush=True,
                )
            except UnicodeEncodeError:
                simple_frames = [".", "o", "O"]
                print(
                    f"\r{simple_frames[i % 3]} {self.current_stage} [{format_duration(elapsed)}]",
                    end="",
                    flush=True,
                )
            i = (i + 1) % len(self.frames)
            time.sleep(0.1)

    def start(self, stage_name: str):
        self.current_stage = stage_name
        self.running = True
        self.start_time = time.time()
        self.thread = threading.Thread(target=self._animate, daemon=True)
        self.thread.start()

    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join(timeout=1.0)
        print("\r" + " " * 100 + "\r", end="", flush=True)
        if self.start_time:
            elapsed = time.time() - self.start_time
            py_logger.success(f"{self.current_stage} [{format_duration(elapsed)}]")


class CommandRunner:
    @staticmethod
    def run(cmd: str, description: str = "", cwd: str | None = None, env: dict | None = None) -> bool:
        progress = ProgressIndicator()
        if description:
            progress.start(description + "...")
        try:
            subprocess.run(
                cmd,
                check=True,
                capture_output=True,
                text=True,
                shell=True,
                encoding="utf-8",
                errors="replace",
                cwd=cwd,
                env=env,
            )
            progress.stop()
            py_logger.info(f"✅ {description} завершено")
            return True
        except subprocess.CalledProcessError as e:
            progress.stop()
            py_logger.error(f"❌ Ошибка при {description.lower()}: {e}")
            if e.stderr:
                py_logger.info("Детали ошибки:")
                for line in e.stderr.split("\n"):
                    if line.strip():
                        py_logger.info(f"  {line}")
            if e.stdout:
                py_logger.info("Вывод:")
                for line in e.stdout.split("\n")[-20:]:
                    if line.strip():
                        py_logger.info(f"  {line}")
            return False
        except Exception as e:
            progress.stop()
            py_logger.error(f"❌ Неожиданная ошибка при {description.lower()}: {e}")
            return False


def _get_icon_path() -> str | None:
    if os.path.isfile(ICON_ICO):
        return os.path.normpath(os.path.abspath(ICON_ICO))
    return None


def _warn_if_missing_maps_key() -> None:
    env_path = os.path.join(FRONTEND_DIR, ".env")
    key = ""
    if os.path.isfile(env_path):
        with open(env_path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("VITE_YANDEX_MAPS_API_KEY=") and not line.startswith("#"):
                    key = line.split("=", 1)[1].strip().strip('"').strip("'")
    if not key or key.startswith("your-"):
        py_logger.warning(
            "VITE_YANDEX_MAPS_API_KEY не задан в frontend/.env — карта в portable-сборке не заработает. "
            "Ключ вшивается в JS на этапе npm run build."
        )


class BuildCleaner:
    @staticmethod
    def _force_remove(func, path, exc):
        try:
            os.chmod(path, 0o700)
            func(path)
        except Exception:
            pass

    @staticmethod
    def _rmtree(path: str) -> None:
        if not os.path.exists(path):
            return
        last_err = None
        for attempt in range(5):
            try:
                shutil.rmtree(path, onexc=BuildCleaner._force_remove)
                return
            except OSError as e:
                last_err = e
                time.sleep(0.4 * (attempt + 1))
        if sys.platform == "win32":
            result = subprocess.run(
                f'cmd /c rd /s /q "{path}"',
                shell=True,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
            )
            if result.returncode == 0 or not os.path.exists(path):
                return
        py_logger.warning(f"⚠️ Не удалось полностью удалить {path}: {last_err}")

    @staticmethod
    def clean() -> bool:
        py_logger.info("🧹 Очистка предыдущей сборки...")
        for folder in (DIST_DIR, WORK_DIR, STAGING_DIR):
            BuildCleaner._rmtree(folder)
            if os.path.exists(folder):
                py_logger.error(
                    f"❌ Не удалось удалить '{folder}'. "
                    "Закройте Veles.exe и окна проводника с этой папкой, затем повторите."
                )
                return False
            py_logger.info(f"🗑 Папка '{folder}' удалена")
        os.makedirs(DIST_DIR, exist_ok=True)
        os.makedirs(STAGING_DIR, exist_ok=True)
        py_logger.info(f"📁 Создана папка сборки '{DIST_DIR}'")
        return True


class FrontendBuilder:
    def __init__(self, runner: CommandRunner):
        self.runner = runner

    def build(self) -> bool:
        if shutil.which("npm") is None:
            py_logger.error("npm не найден в PATH. Установите Node.js.")
            return False
        if not os.path.isdir(os.path.join(FRONTEND_DIR, "node_modules")):
            if not self.runner.run("npm install", "npm install", cwd=FRONTEND_DIR):
                return False
        _warn_if_missing_maps_key()
        return self.runner.run("npm run build", "Сборка фронтенда (Vite)", cwd=FRONTEND_DIR)

    def copy_to_staging(self) -> bool:
        src = os.path.join(FRONTEND_DIR, "dist")
        dest = os.path.join(STAGING_DIR, "spa")
        if not os.path.isfile(os.path.join(src, "index.html")):
            py_logger.error(f"Нет {src}/index.html после npm run build")
            return False
        if os.path.exists(dest):
            shutil.rmtree(dest)
        shutil.copytree(src, dest)
        py_logger.info(f"📦 SPA скопирован в {dest}")
        return True


class DjangoStaticCollector:
    def __init__(self, runner: CommandRunner):
        self.runner = runner

    def collect(self) -> bool:
        python = _backend_python()
        env = os.environ.copy()
        env["DJANGO_SETTINGS_MODULE"] = "veles.settings.portable"
        env["VELES_BUNDLE_DIR"] = STAGING_DIR
        env["VELES_DATA_DIR"] = os.path.join(STAGING_DIR, "data")
        env["VELES_LOG_DIR"] = os.path.join(STAGING_DIR, "data", "log")
        cmd = f'"{python}" manage.py collectstatic --noinput'
        return self.runner.run(cmd, "collectstatic (WhiteNoise)", cwd=BACKEND_DIR, env=env)


def _rel_from_build(path: str) -> str:
    return os.path.relpath(path, BUILD_DIR).replace("\\", "/")


def _write_pyinstaller_spec() -> str:
    spec_path = os.path.join(BUILD_DIR, "veles.spec")
    entry = _rel_from_build(os.path.join(PROJECT_ROOT, "portable.py"))
    spa_rel = _rel_from_build(os.path.join(STAGING_DIR, "spa"))
    static_rel = _rel_from_build(os.path.join(STAGING_DIR, "staticfiles"))
    accounts_rel = _rel_from_build(os.path.join(BACKEND_DIR, "accounts"))
    genealogy_rel = _rel_from_build(os.path.join(BACKEND_DIR, "genealogy"))
    veles_rel = _rel_from_build(os.path.join(BACKEND_DIR, "veles"))
    logger_rel = _rel_from_build(os.path.join(BACKEND_DIR, "logger"))
    icon_str = "None"
    if os.path.isfile(ICON_ICO):
        icon_str = repr(os.path.normpath(ICON_ICO))

    spec_content = f'''# -*- mode: python ; coding: utf-8 -*-
# Сгенерировано build.py
from PyInstaller.utils.hooks import collect_all, collect_submodules

datas = [
    ({repr(spa_rel)}, "spa"),
    ({repr(static_rel)}, "staticfiles"),
    ({repr(accounts_rel)}, "accounts"),
    ({repr(genealogy_rel)}, "genealogy"),
    ({repr(veles_rel)}, "veles"),
    ({repr(logger_rel)}, "logger"),
]
binaries = []
hiddenimports = [
    "veles",
    "veles.settings",
    "veles.settings.base",
    "veles.settings.portable",
    "veles.urls",
    "veles.wsgi",
    "veles.spa",
    "veles.paths",
    "veles.app_version",
    "veles.build_meta",
    "accounts",
    "accounts.models",
    "accounts.apps",
    "genealogy",
    "genealogy.models",
    "genealogy.apps",
    "logger",
    "logger.logger",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.db.backends.sqlite3",
    "django.db.backends.sqlite3.base",
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "djoser",
    "corsheaders",
    "django_filters",
    "environ",
    "whitenoise",
    "whitenoise.middleware",
    "waitress",
    "PIL",
]
for pkg in (
    "django",
    "rest_framework",
    "rest_framework_simplejwt",
    "djoser",
    "corsheaders",
    "django_filters",
    "whitenoise",
    "waitress",
    "environ",
    "PIL",
):
    pkg_datas, pkg_bins, pkg_hidden = collect_all(pkg)
    datas += pkg_datas
    binaries += pkg_bins
    hiddenimports += pkg_hidden
    hiddenimports += collect_submodules(pkg)

a = Analysis(
    [{repr(entry)}],
    pathex=[{repr(PROJECT_ROOT)}, {repr(BACKEND_DIR)}],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={{}},
    runtime_hooks=[],
    excludes=[
        "psycopg2",
        "psycopg2-binary",
        "pytest",
        "pytest_django",
        "factory_boy",
        "coverage",
        "tkinter",
        "matplotlib",
        "numpy",
        "pandas",
    ],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="Veles",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon={icon_str},
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="Veles",
)
'''
    with open(spec_path, "w", encoding="utf-8") as f:
        f.write(spec_content)
    return spec_path


class PyInstallerBuilder:
    def __init__(self, runner: CommandRunner):
        self.runner = runner

    def install(self) -> bool:
        python = _backend_python()
        return self.runner.run(
            f'"{python}" -m pip install pyinstaller waitress whitenoise',
            "Установка PyInstaller / waitress / whitenoise",
        )

    def ensure_icon(self) -> bool:
        python = _backend_python()
        script = os.path.join(BUILD_DIR, "create_icon.py")
        ok = self.runner.run(
            f'"{python}" "{script}"',
            "Иконка exe из frontend/public/favicon.svg",
            cwd=PROJECT_ROOT,
        )
        if ok and os.path.isfile(ICON_ICO):
            py_logger.info(f"📌 Иконка exe: {ICON_ICO}")
            return True
        py_logger.error("Не удалось собрать icon.ico из favicon.svg проекта")
        return False

    def build(self) -> bool:
        if not self.ensure_icon():
            return False
        _write_pyinstaller_spec()
        python = _backend_python()
        cmd = (
            f'"{python}" -m PyInstaller '
            "--clean "
            f"--distpath={DIST_DIR_REL} "
            f"--workpath={WORK_DIR_REL} "
            f'"{os.path.join(SPEC_DIR_REL, "veles.spec")}"'
        )
        return self.runner.run(cmd, "Компиляция (PyInstaller)", cwd=PROJECT_ROOT)


def _normalize_dist() -> None:
    output_dir = os.path.join(DIST_DIR, OUTPUT_DIR_NAME)
    pyinstaller_dir = os.path.join(DIST_DIR, "Veles")
    if os.path.isdir(pyinstaller_dir) and not os.path.isdir(output_dir):
        try:
            os.rename(pyinstaller_dir, output_dir)
            py_logger.info(f"📁 dist/ : Veles/ → {OUTPUT_DIR_NAME}/")
        except Exception as e:
            py_logger.warning(f"⚠️ Не удалось переименовать Veles/ в {OUTPUT_DIR_NAME}/: {e}")


def _portable_output_dir() -> str:
    versioned = os.path.join(DIST_DIR, OUTPUT_DIR_NAME)
    if os.path.isdir(versioned):
        return versioned
    return os.path.join(DIST_DIR, "Veles")


def _verify_portable_dist(output_dir: str) -> bool:
    """Incomplete COLLECT (failed rmtree / overlapping builds) yields an exe
    that dies in the bootloader with no Python logs: missing python314.dll."""
    internal = os.path.join(output_dir, "_internal")
    required = [
        os.path.join(output_dir, "Veles.exe"),
        os.path.join(internal, "python314.dll"),
        os.path.join(internal, "base_library.zip"),
        os.path.join(internal, "_sqlite3.pyd"),
        os.path.join(internal, "spa", "index.html"),
    ]
    missing = [path for path in required if not os.path.isfile(path)]
    if not missing:
        py_logger.info(f"✅ Проверка dist: {output_dir}")
        return True
    py_logger.error("❌ Сборка неполная — exe упадёт сразу, без логов приложения:")
    for path in missing:
        py_logger.error(f"  нет {path}")
    return False


def _find_iscc() -> str | None:
    if sys.platform != "win32":
        return None
    which = shutil.which("iscc")
    if which and os.path.isfile(which):
        return os.path.normpath(which)
    prog64 = os.environ.get("ProgramFiles", "C:\\Program Files")
    prog = os.environ.get("ProgramFiles(x86)", "C:\\Program Files (x86)")
    for base in (prog64, prog):
        for name in ("Inno Setup 6", "Inno Setup 5"):
            iscc = os.path.join(base, name, "ISCC.exe")
            if os.path.isfile(iscc):
                return iscc
    return None


def _copy_installer_icon() -> bool:
    dest = os.path.join(BUILD_DIR, "favicon.ico")
    if not os.path.isfile(ICON_ICO):
        py_logger.warning("build/icon.ico не найден — установщик без своей иконки.")
        return False
    try:
        shutil.copy2(ICON_ICO, dest)
        py_logger.info("Иконка для установщика: build/favicon.ico")
        return True
    except Exception as e:
        py_logger.error(f"Не удалось скопировать иконку: {e}")
        return False


class InstallerBuilder:
    ISS_NAME = "build_installer.iss"

    def __init__(self, runner: CommandRunner):
        self.runner = runner

    def build(self) -> bool:
        iscc = _find_iscc()
        if not iscc:
            py_logger.error("Inno Setup не найден. Установите Inno Setup 6 и добавьте ISCC в PATH.")
            py_logger.info(f"Скачать: {INNO_SETUP_DOWNLOAD_URL}")
            py_logger.info("Ожидаемый путь: Program Files\\Inno Setup 6\\ISCC.exe")
            return False
        iss_path = os.path.join(BUILD_DIR, self.ISS_NAME)
        if not os.path.isfile(iss_path):
            py_logger.error(f"Файл установщика не найден: {iss_path}")
            return False
        _copy_installer_icon()
        iscc_quoted = iscc if " " not in iscc else f'"{iscc}"'
        iss_quoted = iss_path if " " not in iss_path else f'"{iss_path}"'
        cmd = (
            f"{iscc_quoted} "
            f"/DMyAppDistDir={OUTPUT_DIR_NAME} "
            f"/DMyAppVersion={FILE_VERSION} "
            f"{iss_quoted}"
        )
        return self.runner.run(cmd, "Сборка установщика (Inno Setup)", cwd=BUILD_DIR)


class BuildManager:
    def __init__(self, build_installer: bool = False):
        self.command_runner = CommandRunner()
        self.cleaner = BuildCleaner()
        self.frontend = FrontendBuilder(self.command_runner)
        self.django_static = DjangoStaticCollector(self.command_runner)
        self.builder = PyInstallerBuilder(self.command_runner)
        self._build_installer = build_installer

    def check_environment(self):
        py_logger.info("🔍 Проверка окружения...")
        py_logger.info(f"🐍 Python: {_backend_python()} ({sys.version.split()[0]})")
        py_logger.info(f"📁 Папка сборки: {BUILD_DIR}")
        if not os.path.isfile(os.path.join(BACKEND_DIR, "manage.py")):
            py_logger.error("backend/manage.py не найден")
            return False
        return True

    def run(self):
        start_time = time.time()
        py_logger.info("🚀 Начало сборки (PyInstaller)\n" + "=" * 60)
        if not self.check_environment():
            return
        if not self.cleaner.clean():
            return
        if not self.builder.install():
            py_logger.error("❌ Не удалось установить зависимости сборки")
            return
        if not self.frontend.build() or not self.frontend.copy_to_staging():
            py_logger.error("❌ Сборка фронтенда не удалась")
            return
        if not self.django_static.collect():
            py_logger.error("❌ collectstatic не удался")
            return
        if not self.builder.build():
            py_logger.error("❌ PyInstaller не собрал exe")
            return
        _normalize_dist()
        result_dir = _portable_output_dir()
        if not _verify_portable_dist(result_dir):
            py_logger.error(
                "❌ Сборка отброшена: в папке нет python314.dll / SPA. Не запускайте этот exe."
            )
            return
        if self._build_installer and sys.platform == "win32":
            installer_builder = InstallerBuilder(self.command_runner)
            if not installer_builder.build():
                py_logger.warning("⚠️ Сборка установщика не выполнена")
            else:
                setup_exe = os.path.join(DIST_DIR, "Veles_Setup.exe")
                if os.path.isfile(setup_exe):
                    py_logger.info(f"📦 Установщик: {setup_exe}")
        py_logger.info("\n" + "=" * 60)
        py_logger.success("🎉 Сборка завершена!")
        py_logger.complete(f"⏱ Время: {format_duration(time.time() - start_time)}")
        py_logger.info(f"📁 Результат: {result_dir}")
        py_logger.info("Запуск: Veles.exe в этой папке (консоль, Ctrl+C — стоп). Данные — в data/ рядом с exe.")
        if sys.platform == "win32":
            py_logger.info("")
            py_logger.info("Если Windows блокирует exe («не удалось проверить издателя»):")
            py_logger.info("  1. ПКМ по exe → Свойства → «Разблокировать» → ОК")
            py_logger.info("  2. Или в окне блокировки: «Подробнее» → «Всё равно выполнить»")
        _notify_build_done(
            f"Велес {st.APP_VERSION}",
            f"Сборка завершена за {format_duration(time.time() - start_time)}",
        )


def _parse_args():
    parser = argparse.ArgumentParser(
        description="Сборка Велес: portable-папка с exe. С --installer — ещё установочный файл."
    )
    parser.add_argument(
        "--installer",
        action="store_true",
        default=False,
        help="После сборки создать установочный exe (Inno Setup).",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    try:
        BuildManager(build_installer=args.installer).run()
    except KeyboardInterrupt:
        py_logger.warning("⏹ Сборка прервана пользователем")
    except Exception as e:
        py_logger.error(f"💥 Критическая ошибка: {e}")
        raise
    finally:
        _write_build_meta("nogit")
        py_logger.complete("=" * 60)
