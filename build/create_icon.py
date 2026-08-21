"""
Создаёт build/icon.ico для exe / Inno Setup из frontend/public/favicon.svg —
той же иконки, что вкладка браузера (index.html → /favicon.svg).

Не использует заглушку «как в dsinvent» и не переиспользует старый icon.ico:
каждый запуск перезаписывает файл из SVG проекта.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile

BUILD_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BUILD_DIR)
FRONTEND_DIR = os.path.join(PROJECT_ROOT, "frontend")
FAVICON_SVG = os.path.join(FRONTEND_DIR, "public", "favicon.svg")
BUILD_ICON_ICO = os.path.join(BUILD_DIR, "icon.ico")
RENDER_MJS = os.path.join(BUILD_DIR, "render_favicon.mjs")


def _save_ico(png_path: str) -> None:
    from PIL import Image

    img = Image.open(png_path).convert("RGBA")
    img = img.resize((256, 256), Image.Resampling.LANCZOS)
    sizes = [(16, 16), (32, 32), (48, 48), (256, 256)]
    os.makedirs(BUILD_DIR, exist_ok=True)
    img.save(BUILD_ICON_ICO, format="ICO", sizes=sizes)


def create_ico_from_svg_cairosvg() -> bool:
    try:
        import io

        import cairosvg
        from PIL import Image
    except ImportError:
        return False
    if not os.path.isfile(FAVICON_SVG):
        return False
    try:
        png_data = cairosvg.svg2png(url=FAVICON_SVG, output_width=256, output_height=256)
        img = Image.open(io.BytesIO(png_data)).convert("RGBA")
        sizes = [(16, 16), (32, 32), (48, 48), (256, 256)]
        os.makedirs(BUILD_DIR, exist_ok=True)
        img.save(BUILD_ICON_ICO, format="ICO", sizes=sizes)
        return True
    except Exception:
        return False


def create_ico_from_svg_playwright() -> bool:
    if not os.path.isfile(FAVICON_SVG) or not os.path.isfile(RENDER_MJS):
        return False
    if not os.path.isdir(os.path.join(FRONTEND_DIR, "node_modules", "playwright")):
        return False
    node = shutil.which("node")
    if not node:
        return False
    fd, png_path = tempfile.mkstemp(suffix=".png")
    os.close(fd)
    try:
        result = subprocess.run(
            [node, RENDER_MJS, "256", png_path],
            cwd=FRONTEND_DIR,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        if result.returncode != 0 or not os.path.isfile(png_path) or os.path.getsize(png_path) == 0:
            if result.stderr:
                print(result.stderr[-800:], file=sys.stderr)
            return False
        _save_ico(png_path)
        return True
    except Exception:
        return False
    finally:
        try:
            os.remove(png_path)
        except OSError:
            pass


def main() -> None:
    if not os.path.isfile(FAVICON_SVG):
        print(f"Нет иконки проекта: {FAVICON_SVG}")
        sys.exit(1)
    if os.path.isfile(BUILD_ICON_ICO):
        os.remove(BUILD_ICON_ICO)
    if create_ico_from_svg_cairosvg():
        print("ICO из frontend/public/favicon.svg (cairosvg)")
        return
    if create_ico_from_svg_playwright():
        print("ICO из frontend/public/favicon.svg (Playwright)")
        return
    print(
        "Не удалось собрать ICO из frontend/public/favicon.svg. "
        "Нужен cairosvg или Playwright в frontend/node_modules."
    )
    sys.exit(1)


if __name__ == "__main__":
    main()
