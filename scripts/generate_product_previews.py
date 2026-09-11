"""
Generate stylized 3D dental-arch product preview images for the Krown Frontz catalog.

Run from repo root:
  python scripts/generate_product_previews.py
  python scripts/generate_product_previews.py --style window

Optional (if Blender is installed):
  blender --background scripts/blender_product_preview.blend --python scripts/blender_render_previews.py
"""

from __future__ import annotations

import argparse
import json
import math
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "assets" / "products"
MAIN_JS = ROOT / "main.js"
SIZE = 800

# Upper arch tooth slots left-to-right (viewer): UR4..UR1, UL1..UL4
ARCH_SLOTS = 8

PALETTE = {
    "bg": (8, 8, 10),
    "gum": (168, 98, 108),
    "gum_dark": (120, 62, 72),
    "tooth": (238, 232, 220),
    "tooth_shadow": (195, 185, 170),
    "tooth_highlight": (255, 252, 245),
    "window_hole": (12, 12, 16),
    "gold": (212, 175, 55),
    "gold_dark": (140, 108, 28),
    "gold_light": (255, 220, 120),
    "silver": (192, 198, 205),
    "silver_dark": (120, 128, 138),
    "silver_light": (235, 240, 245),
}


def arch_points(cx: float, cy: float, radius: float, count: int) -> list[tuple[float, float, float]]:
    """Return (x, y, angle) for teeth along a shallow arc."""
    spread = math.radians(58)
    start = -math.pi / 2 - spread / 2
    step = spread / max(count - 1, 1)
    return [
        (
            cx + radius * math.cos(start + i * step),
            cy + radius * math.sin(start + i * step) * 0.42,
            start + i * step + math.pi / 2,
        )
        for i in range(count)
    ]


def lerp(a: int, b: int, t: float) -> int:
    return int(a + (b - a) * t)


def finish_colors(finish: str) -> tuple[tuple[int, int, int], tuple[int, int, int], tuple[int, int, int]]:
    if finish == "silver":
        return PALETTE["silver_dark"], PALETTE["silver"], PALETTE["silver_light"]
    return PALETTE["gold_dark"], PALETTE["gold"], PALETTE["gold_light"]


def draw_gum(draw: ImageDraw.ImageDraw, points: list[tuple[float, float, float]], width: float) -> None:
    if len(points) < 2:
        return
    gum_pts = [(x, y + width * 0.35) for x, y, _ in points]
    for i in range(len(gum_pts) - 1):
        draw.line([gum_pts[i], gum_pts[i + 1]], fill=PALETTE["gum_dark"], width=int(width * 0.9))
    for x, y, _ in points:
        draw.ellipse(
            (x - width * 0.55, y + width * 0.05, x + width * 0.55, y + width * 0.95),
            fill=PALETTE["gum"],
        )


def draw_tooth_base(
    img: Image.Image,
    draw: ImageDraw.ImageDraw,
    x: float,
    y: float,
    angle: float,
    w: float,
    h: float,
) -> None:
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    left = x - w / 2
    top = y - h / 2
    d.rounded_rectangle((left, top, left + w, top + h), radius=w * 0.22, fill=PALETTE["tooth_shadow"])
    d.rounded_rectangle(
        (left + 2, top + 2, left + w - 2, top + h - 4),
        radius=w * 0.2,
        fill=PALETTE["tooth"],
    )
    d.rounded_rectangle(
        (left + w * 0.15, top + 3, left + w * 0.55, top + h * 0.35),
        radius=w * 0.12,
        fill=PALETTE["tooth_highlight"],
    )
    rotated = layer.rotate(-math.degrees(angle), center=(x, y), resample=Image.Resampling.BICUBIC)
    img.alpha_composite(rotated)


def draw_grillz_cap(
    img: Image.Image,
    draw: ImageDraw.ImageDraw,
    x: float,
    y: float,
    angle: float,
    w: float,
    h: float,
    finish: str,
    window: bool = False,
) -> None:
    dark, mid, light = finish_colors(finish)
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    left = x - w / 2
    top = y - h / 2
    d.rounded_rectangle((left, top, left + w, top + h), radius=w * 0.2, fill=dark)
    d.rounded_rectangle((left + 2, top + 2, left + w - 2, top + h - 2), radius=w * 0.18, fill=mid)
    d.rounded_rectangle(
        (left + w * 0.12, top + 4, left + w * 0.5, top + h * 0.32),
        radius=w * 0.1,
        fill=light,
    )
    if window:
        hole_w, hole_h = w * 0.42, h * 0.48
        hx, hy = x - hole_w / 2, y - hole_h / 2 + h * 0.08
        d.rounded_rectangle((hx, hy, hx + hole_w, hy + hole_h), radius=w * 0.08, fill=PALETTE["window_hole"])
    rotated = layer.rotate(-math.degrees(angle), center=(x, y), resample=Image.Resampling.BICUBIC)
    img.alpha_composite(rotated)


def draw_open_face_frame(
    img: Image.Image,
    slots: list[int],
    all_points: list[tuple[float, float, float]],
    finish: str,
    tooth_w: float,
    tooth_h: float,
) -> None:
    if not slots:
        return
    indices = sorted(slots)
    xs = [all_points[i][0] for i in indices]
    ys = [all_points[i][1] for i in indices]
    min_x, max_x = min(xs) - tooth_w * 0.65, max(xs) + tooth_w * 0.65
    min_y, max_y = min(ys) - tooth_h * 0.55, max(ys) + tooth_h * 0.55
    dark, mid, light = finish_colors(finish)
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    frame = 10
    d.rounded_rectangle((min_x, min_y, max_x, max_y), radius=18, fill=mid, outline=dark, width=frame)
    d.rounded_rectangle(
        (min_x + frame + 4, min_y + frame + 4, max_x - frame - 4, max_y - frame - 4),
        radius=12,
        fill=PALETTE["window_hole"],
    )
    d.arc(
        (min_x, min_y - 8, min_x + tooth_w, min_y + tooth_h),
        start=200,
        end=340,
        fill=light,
        width=3,
    )
    img.alpha_composite(layer)


def render_arch(
    img: Image.Image,
    draw: ImageDraw.ImageDraw,
    cx: float,
    cy: float,
    radius: float,
    caps: dict[int, dict],
    finish: str,
    open_face_slots: list[int] | None = None,
    tooth_w: float = 52,
    tooth_h: float = 72,
) -> None:
    points = arch_points(cx, cy, radius, ARCH_SLOTS)
    draw_gum(draw, points, tooth_w)

    cap_slots = set(caps.keys())
    open_slots = set(open_face_slots or [])

    for i, (x, y, angle) in enumerate(points):
        if i in open_slots:
            continue
        draw_tooth_base(img, draw, x, y, angle, tooth_w, tooth_h)

    if open_face_slots:
        draw_open_face_frame(img, open_face_slots, points, finish, tooth_w, tooth_h)
        for i in open_face_slots:
            x, y, angle = points[i]
            draw_tooth_base(img, draw, x, y, angle, tooth_w * 0.72, tooth_h * 0.55)

    for i, (x, y, angle) in enumerate(points):
        if i in open_slots:
            continue
        if i not in cap_slots:
            continue
        spec = caps[i]
        draw_grillz_cap(
            img,
            draw,
            x,
            y,
            angle,
            tooth_w * spec.get("scale_w", 1.05),
            tooth_h * spec.get("scale_h", 1.08),
            spec.get("finish", finish),
            window=spec.get("window", False),
        )


def render_product(spec: dict) -> Image.Image:
    img = Image.new("RGBA", (SIZE, SIZE), PALETTE["bg"])
    draw = ImageDraw.Draw(img)

    # subtle vignette
    vignette = Image.new("L", (SIZE, SIZE), 0)
    vd = ImageDraw.Draw(vignette)
    vd.ellipse((-80, -40, SIZE + 80, SIZE + 120), fill=210)
    vignette = vignette.filter(ImageFilter.GaussianBlur(40))
    dark_layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 180))
    img = Image.composite(dark_layer, img, Image.eval(vignette, lambda p: 255 - p))
    draw = ImageDraw.Draw(img)

    finish = spec.get("finish", "gold")
    if spec.get("dual_arch"):
        render_arch(
            img,
            draw,
            SIZE * 0.5,
            SIZE * 0.36,
            SIZE * 0.34,
            spec.get("upper_caps", {}),
            finish,
            spec.get("upper_open_face"),
            tooth_w=46,
            tooth_h=62,
        )
        render_arch(
            img,
            draw,
            SIZE * 0.5,
            SIZE * 0.68,
            SIZE * 0.32,
            spec.get("lower_caps", {}),
            finish,
            spec.get("lower_open_face"),
            tooth_w=44,
            tooth_h=58,
        )
    else:
        render_arch(
            img,
            draw,
            SIZE * 0.5,
            SIZE * 0.48,
            SIZE * 0.36,
            spec.get("caps", {}),
            finish,
            spec.get("open_face"),
        )

    return img


# Tooth slot map (viewer left→right): UR4 UR3 UR2 UR1 UL1 UL2 UL3 UL4
# Indices:                      0    1    2    3    4    5    6    7

WINDOW_PREVIEW_SPECS: dict[str, dict] = {
    "window-canine": {
        "finish": "gold",
        "caps": {1: {"window": True}},
    },
    "window-lateral": {
        "finish": "gold",
        "caps": {2: {"window": True}},
    },
    "window-canine-lateral-2": {
        "finish": "gold",
        "caps": {1: {"window": True}, 2: {"window": True, "scale_w": 1.02}},
    },
    "open-face-4": {
        "finish": "gold",
        "open_face": [3, 4, 5, 6],
    },
    "open-face-6": {
        "finish": "silver",
        "open_face": [2, 3, 4, 5, 6, 7],
    },
    "window-set-8": {
        "finish": "silver",
        "open_face": [0, 1, 2, 3, 4, 5, 6, 7],
    },
    "open-face-6-on-6": {
        "finish": "silver",
        "dual_arch": True,
        "upper_open_face": [2, 3, 4, 5, 6, 7],
        "lower_open_face": [2, 3, 4, 5, 6, 7],
    },
    "open-face-8-on-8": {
        "finish": "silver",
        "dual_arch": True,
        "upper_open_face": [0, 1, 2, 3, 4, 5, 6, 7],
        "lower_open_face": [0, 1, 2, 3, 4, 5, 6, 7],
    },
}


def parse_catalog_products() -> list[dict]:
    text = MAIN_JS.read_text(encoding="utf-8")
    blocks = re.findall(
        r'id:\s*"([^"]+)"[\s\S]*?finish:\s*"([^"]+)"[\s\S]*?style:\s*"([^"]+)"',
        text,
    )
    return [{"id": pid, "finish": finish, "style": style} for pid, finish, style in blocks]


def spec_for_product(product_id: str, finish: str) -> dict | None:
    if product_id in WINDOW_PREVIEW_SPECS:
        spec = dict(WINDOW_PREVIEW_SPECS[product_id])
        if "finish" not in WINDOW_PREVIEW_SPECS[product_id]:
            spec["finish"] = finish
        return spec
    return None


def generate(style_filter: str | None = None) -> list[str]:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    generated: list[str] = []

    for product in parse_catalog_products():
        pid = product["id"]
        if style_filter and product["style"] != style_filter:
            continue
        spec = spec_for_product(pid, product["finish"])
        if not spec:
            continue
        img = render_product(spec)
        out_path = OUT_DIR / f"{pid}.webp"
        img.convert("RGB").save(out_path, "WEBP", quality=88, method=6)
        generated.append(pid)
        print(f"Wrote {out_path.relative_to(ROOT)}")

    manifest = OUT_DIR / "manifest.json"
    existing = json.loads(manifest.read_text(encoding="utf-8")) if manifest.exists() else {}
    for pid in generated:
        existing[pid] = f"assets/products/{pid}.webp"
    manifest.write_text(json.dumps(existing, indent=2) + "\n", encoding="utf-8")
    return generated


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate product preview images")
    parser.add_argument("--style", default="window", help="Catalog style to render (default: window)")
    args = parser.parse_args()
    ids = generate(args.style)
    if not ids:
        raise SystemExit(f"No preview specs for style={args.style!r}")
    print(f"Generated {len(ids)} previews: {', '.join(ids)}")


if __name__ == "__main__":
    main()
