"""
Blender headless render helper (optional).

Requires a base .blend with dental arch, camera, and lights named:
  Arch_Upper, Camera, KeyLight, FillLight

Usage:
  blender --background path/to/base.blend --python scripts/blender_render_previews.py -- --style window
"""

import json
import sys
from pathlib import Path

try:
    import bpy
except ImportError as exc:
    raise SystemExit("Run this script inside Blender: blender --background --python ...") from exc

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "assets" / "products"
MANIFEST = OUT_DIR / "manifest.json"

# Map product id -> collection name suffix in Blender (create matching collections)
WINDOW_COLLECTIONS = {
    "window-canine": "Window_Canine",
    "window-lateral": "Window_Lateral",
    "window-canine-lateral-2": "Window_Canine_Lateral",
    "open-face-4": "OpenFace_4",
    "open-face-6": "OpenFace_6",
    "window-set-8": "OpenFace_8",
    "open-face-6-on-6": "OpenFace_6on6",
    "open-face-8-on-8": "OpenFace_8on8",
}


def hide_all_product_collections() -> None:
    for coll in bpy.data.collections:
        if coll.name.startswith("Product_"):
            coll.hide_render = True


def render_product(product_id: str, collection_suffix: str) -> None:
    coll_name = f"Product_{collection_suffix}"
    coll = bpy.data.collections.get(coll_name)
    if not coll:
        print(f"Skip {product_id}: missing collection {coll_name}")
        return
    hide_all_product_collections()
    coll.hide_render = False
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / f"{product_id}.webp"
    bpy.context.scene.render.filepath = str(out.with_suffix(""))
    bpy.context.scene.render.image_settings.file_format = "WEBP"
    bpy.ops.render.render(write_still=True)
    print(f"Rendered {out}")


def main() -> None:
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    else:
        argv = []
    style = "window"
    if "--style" in argv:
        style = argv[argv.index("--style") + 1]
    if style != "window":
        print(f"Only window batch wired in Blender helper (got {style})")
    manifest: dict[str, str] = {}
    if MANIFEST.exists():
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    for product_id, suffix in WINDOW_COLLECTIONS.items():
        render_product(product_id, suffix)
        manifest[product_id] = f"assets/products/{product_id}.webp"
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
