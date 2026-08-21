"""
Создаёт build/icon.ico из frontend/public/favicon.svg — той же иконки, что
вкладка браузера (index.html → /favicon.svg).

Старый icon.ico (заглушка «В» / чужой проект) каждый раз перезаписывается.
Рендер — по path из SVG через Pillow, без cairosvg и без браузера Playwright.
"""
from __future__ import annotations

import math
import os
import re
import sys
import xml.etree.ElementTree as ET

BUILD_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BUILD_DIR)
FAVICON_SVG = os.path.join(PROJECT_ROOT, "frontend", "public", "favicon.svg")
BUILD_ICON_ICO = os.path.join(BUILD_DIR, "icon.ico")

_CMD = re.compile(
    r"([MmZzLlHhVvCcSsQqTtAa])|([+-]?(?:\d*\.\d+|\d+)(?:[eE][+-]?\d+)?)"
)


def _tokens(d: str) -> list[str]:
    return [m.group(0) for m in _CMD.finditer(d)]


def _nums(items: list[str], i: int, n: int) -> tuple[list[float], int]:
    out = [float(items[i + k]) for k in range(n)]
    return out, i + n


def _cubic(p0, p1, p2, p3, steps: int = 16) -> list[tuple[float, float]]:
    pts = []
    for s in range(1, steps + 1):
        t = s / steps
        u = 1 - t
        x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0]
        y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]
        pts.append((x, y))
    return pts


def _arc_to_points(x1, y1, rx, ry, phi_deg, large, sweep, x2, y2, steps: int = 20):
    """SVG elliptical arc → polyline. W3C endpoint-to-center conversion."""
    if rx == 0 or ry == 0:
        return [(x2, y2)]
    phi = math.radians(phi_deg)
    dx = (x1 - x2) / 2
    dy = (y1 - y2) / 2
    x1p = math.cos(phi) * dx + math.sin(phi) * dy
    y1p = -math.sin(phi) * dx + math.cos(phi) * dy
    rx, ry = abs(rx), abs(ry)
    lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry)
    if lam > 1:
        s = math.sqrt(lam)
        rx, ry = rx * s, ry * s
    num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
    den = rx * rx * y1p * y1p + ry * ry * x1p * x1p
    coeff = 0 if den == 0 else math.sqrt(max(0, num / den))
    if large == sweep:
        coeff = -coeff
    cxp = coeff * rx * y1p / ry
    cyp = coeff * -ry * x1p / rx
    cx = math.cos(phi) * cxp - math.sin(phi) * cyp + (x1 + x2) / 2
    cy = math.sin(phi) * cxp + math.cos(phi) * cyp + (y1 + y2) / 2

    def angle(ux, uy, vx, vy):
        dot = ux * vx + uy * vy
        nrm = math.hypot(ux, uy) * math.hypot(vx, vy)
        if nrm == 0:
            return 0.0
        a = math.acos(max(-1, min(1, dot / nrm)))
        if ux * vy - uy * vx < 0:
            a = -a
        return a

    th1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
    dth = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
    if not sweep and dth > 0:
        dth -= 2 * math.pi
    elif sweep and dth < 0:
        dth += 2 * math.pi
    pts = []
    for s in range(1, steps + 1):
        t = th1 + dth * s / steps
        x = math.cos(phi) * rx * math.cos(t) - math.sin(phi) * ry * math.sin(t) + cx
        y = math.sin(phi) * rx * math.cos(t) + math.cos(phi) * ry * math.sin(t) + cy
        pts.append((x, y))
    return pts


def path_to_points(d: str) -> list[tuple[float, float]]:
    items = _tokens(d)
    i = 0
    cmd = None
    cx = cy = 0.0
    sx = sy = 0.0
    pts: list[tuple[float, float]] = []
    while i < len(items):
        if items[i].isalpha():
            cmd = items[i]
            i += 1
            if cmd in "Zz":
                pts.append((sx, sy))
                cx, cy = sx, sy
                continue
        if cmd is None:
            break
        rel = cmd.islower()
        c = cmd.upper()
        if c == "M":
            (x, y), i = _nums(items, i, 2)
            if rel:
                x, y = cx + x, cy + y
            cx, cy = x, y
            sx, sy = x, y
            pts.append((cx, cy))
            cmd = "l" if rel else "L"
        elif c == "L":
            (x, y), i = _nums(items, i, 2)
            if rel:
                x, y = cx + x, cy + y
            cx, cy = x, y
            pts.append((cx, cy))
        elif c == "H":
            (x,), i = _nums(items, i, 1)
            cx = cx + x if rel else x
            pts.append((cx, cy))
        elif c == "V":
            (y,), i = _nums(items, i, 1)
            cy = cy + y if rel else y
            pts.append((cx, cy))
        elif c == "C":
            vals, i = _nums(items, i, 6)
            x1, y1, x2, y2, x, y = vals
            if rel:
                x1, y1, x2, y2, x, y = cx + x1, cy + y1, cx + x2, cy + y2, cx + x, cy + y
            pts.extend(_cubic((cx, cy), (x1, y1), (x2, y2), (x, y)))
            cx, cy = x, y
        elif c == "A":
            vals, i = _nums(items, i, 7)
            rx, ry, phi, large, sweep, x, y = vals
            if rel:
                x, y = cx + x, cy + y
            pts.extend(_arc_to_points(cx, cy, rx, ry, phi, int(large), int(sweep), x, y))
            cx, cy = x, y
        else:
            raise ValueError(f"unsupported SVG command {cmd}")
    return pts


def _fill_hex(elem: ET.Element) -> str | None:
    fill = elem.attrib.get("fill")
    if fill and fill.startswith("#") and fill.lower() not in {"#000", "#000000"}:
        return fill
    style = elem.attrib.get("style", "")
    m = re.search(r"fill:(#[0-9a-fA-F]{3,8})", style)
    if m:
        hex_color = m.group(1)
        if hex_color.lower() not in {"#000", "#000000"}:
            return hex_color
    return None


def _parse_hex(color: str) -> tuple[int, int, int, int]:
    color = color.lstrip("#")
    if len(color) == 3:
        color = "".join(ch * 2 for ch in color)
    if len(color) == 6:
        color += "ff"
    r, g, b, a = int(color[0:2], 16), int(color[2:4], 16), int(color[4:6], 16), int(color[6:8], 16)
    return r, g, b, a


def svg_logo_to_ico(svg_path: str, ico_path: str, size: int = 256) -> None:
    from PIL import Image, ImageDraw

    tree = ET.parse(svg_path)
    root = tree.getroot()
    vb = (root.attrib.get("viewBox") or "0 0 48 46").split()
    vx, vy, vw, vh = map(float, vb)
    paths = []
    for elem in root.iter():
        tag = elem.tag.split("}")[-1]
        if tag != "path" or "d" not in elem.attrib:
            continue
        fill = _fill_hex(elem)
        if not fill:
            continue
        paths.append((elem.attrib["d"], fill))
    # First filled path is the lightning silhouette used as the tab icon.
    if not paths:
        raise RuntimeError(f"в {svg_path} нет path с заливкой")

    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    pad = size * 0.08
    sx = (size - 2 * pad) / vw
    sy = (size - 2 * pad) / vh
    scale = min(sx, sy)
    ox = pad + (size - 2 * pad - vw * scale) / 2 - vx * scale
    oy = pad + (size - 2 * pad - vh * scale) / 2 - vy * scale

    d, fill = paths[0]
    pts = [(ox + x * scale, oy + y * scale) for x, y in path_to_points(d)]
    if len(pts) >= 3:
        draw.polygon(pts, fill=_parse_hex(fill))

    os.makedirs(os.path.dirname(ico_path) or ".", exist_ok=True)
    img.save(ico_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (256, 256)])


def main() -> None:
    if not os.path.isfile(FAVICON_SVG):
        print(f"Нет иконки проекта: {FAVICON_SVG}")
        sys.exit(1)
    svg_logo_to_ico(FAVICON_SVG, BUILD_ICON_ICO)
    print("ICO из frontend/public/favicon.svg")


if __name__ == "__main__":
    main()
