"""
Создаёт build/icon.ico для exe / Inno Setup.
Если cairosvg доступен — из frontend/public/favicon.svg, иначе простая иконка
в цветах палитры Велеса (#2563eb).
"""
from __future__ import annotations

import os
import sys

BUILD_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BUILD_DIR)
FAVICON_SVG = os.path.join(PROJECT_ROOT, "frontend", "public", "favicon.svg")
BUILD_ICON_ICO = os.path.join(BUILD_DIR, "icon.ico")


def create_ico_from_svg() -> bool:
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
        img.save(BUILD_ICON_ICO, format="ICO", sizes=sizes)
        return True
    except Exception:
        return False


def create_simple_ico() -> bool:
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        return False
    color = (37, 99, 235, 255)  # --accent light #2563eb
    w, h = 256, 256
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    margin = 16
    draw.rounded_rectangle(
        [margin, margin, w - margin, h - margin],
        radius=48,
        fill=color,
    )
    try:
        font_path = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts", "segoeui.ttf")
        font = ImageFont.truetype(font_path, 140)
    except OSError:
        font = ImageFont.load_default()
    text = "В"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(
        ((w - tw) / 2 - bbox[0], (h - th) / 2 - bbox[1] - 8),
        text,
        font=font,
        fill=(255, 255, 255, 255),
    )
    sizes = [(16, 16), (32, 32), (48, 48), (256, 256)]
    os.makedirs(BUILD_DIR, exist_ok=True)
    img.save(BUILD_ICON_ICO, format="ICO", sizes=sizes)
    return True


def main() -> None:
    os.makedirs(BUILD_DIR, exist_ok=True)
    if create_ico_from_svg():
        print("ICO создан из frontend/public/favicon.svg")
    elif create_simple_ico():
        print("Создана простая ICO-иконка (cairosvg не найден или SVG не собрался)")
    else:
        print("Не удалось создать иконку (установите Pillow в backend/.venv)")
        sys.exit(1)


if __name__ == "__main__":
    main()
