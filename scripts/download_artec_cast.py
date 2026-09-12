#!/usr/bin/env python3
"""Download the Artec CC BY plaster dental cast into assets/blender/source/."""

from __future__ import annotations

import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "assets" / "blender" / "source"
ZIP_NAME = "plaster-cast-of-teeth-obj.zip"
OBJ_NAME = "artec_plaster_cast_teeth.obj"
URL = (
    "https://cdn.artec3d.com/content-hub-3dmodels/plaster-cast-of-teeth-obj.zip"
    "?VersionId=GXEVwvmI8AB8EH4HKamLdonS17Dp3Plu"
)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    zip_path = OUT_DIR / ZIP_NAME
    obj_path = OUT_DIR / OBJ_NAME

    if not zip_path.exists():
        print(f"Downloading {URL}")
        urllib.request.urlretrieve(URL, zip_path)
        print(f"Saved {zip_path} ({zip_path.stat().st_size / 1e6:.1f} MB)")
    else:
        print(f"Using existing {zip_path}")

    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(OUT_DIR)
    extracted = OUT_DIR / "Teeth.obj"
    if extracted.exists():
        extracted.replace(obj_path)
    if not obj_path.exists():
        raise SystemExit(f"Expected OBJ missing after extract: {obj_path}")
    print(f"Ready: {obj_path} ({obj_path.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
