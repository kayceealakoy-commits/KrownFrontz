"""Import / normalize KrownFrontz grillz photos into assets/products/{id}.webp.

Import mode: map displayNames to loose photos in the KrownFrontz site root and
write 800x800 WEBPs with content-aware cast zoom (match canine.webp height frac).

Normalize mode (--normalize-existing): rewrite every existing products/*.webp to
the same cast height fraction (skips gift-card).
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "Pillow is required. Install with: pip install pillow\n" + str(exc)
    ) from exc

ROOT = Path(__file__).resolve().parents[1]
MAIN_JS = ROOT / "main.js"
PRODUCTS_DIR = ROOT / "assets" / "products"
SOURCE_DIR = ROOT
REF_CAST_WEBP = PRODUCTS_DIR / "canine.webp"

TARGET_SIZE = 800
WEBP_QUALITY = 85
# Brightness threshold for cast vs black background (0–255 on L channel).
CONTENT_THRESH = 40
# Fallback if canine.webp missing.
DEFAULT_CAST_HEIGHT_FRAC = 0.651
SKIP_IDS: set[str] = set()

SKIP_NAMES = {
    "_headers",
    "deno.lock",
    "package-lock.json",
    "package.json",
    "netlify.toml",
    ".netlifyignore",
    ".gitignore",
    ".env.example",
}

IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp"}

EXPLICIT_SOURCE_BY_ID: dict[str, str] = {
    "lateral-canine": "canine & lateral.png",
    "window-canine-diamond-inlay": "window canine & diamond inlay.png",
    "diamond-lateral": "diamond lateral.png",
    "diamond-lateral-canine": "diamond lateral & canine.png",
    "top-8-bottom-8": "8 on 8",
}


def extract_bracketed(source: str, start: int) -> tuple[str, int]:
    opener = source[start]
    closer = "}" if opener == "{" else "]"
    depth = 0
    in_string = False
    string_char = ""
    escape = False
    for i in range(start, len(source)):
        ch = source[i]
        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == string_char:
                in_string = False
            continue
        if ch in ("'", '"', "`"):
            in_string = True
            string_char = ch
            continue
        if ch == opener:
            depth += 1
        elif ch == closer:
            depth -= 1
            if depth == 0:
                return source[start : i + 1], i + 1
    raise ValueError("Unbalanced brackets while parsing main.js")


def parse_products(text: str) -> list[tuple[str, str]]:
    match = re.search(r"const PRODUCTS\s*=\s*\[", text)
    if not match:
        raise ValueError("Could not find PRODUCTS in main.js")
    section, _ = extract_bracketed(text, match.end() - 1)
    products: list[tuple[str, str]] = []
    for im in re.finditer(r'id:\s*"([^"]+)"', section):
        chunk = section[im.start() : im.start() + 400]
        dn = re.search(r'displayName:\s*"([^"]+)"', chunk)
        if not dn:
            continue
        products.append((im.group(1), dn.group(1)))
    return products


def normalize_label(label: str) -> str:
    s = label.lower().strip()
    s = s.replace("diamond-dust", "diamond dust")
    s = re.sub(r"\s*x\s*", "x ", s)
    s = s.replace("2x ", "2x ").replace("4x ", "4x ")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def candidate_norms(display_name: str) -> list[str]:
    base = normalize_label(display_name)
    variants = [base]
    if base.endswith("lateral") and not base.endswith("laterals"):
        variants.append(base + "s")
    if base.endswith("canine") and "canines" not in base and not base.endswith(
        "canines"
    ):
        if base.startswith("2x ") or base.startswith("4x "):
            variants.append(base + "s")
    if " & " in base:
        left, right = base.split(" & ", 1)
        variants.append(normalize_label(f"{right} & {left}"))
    seen: set[str] = set()
    out: list[str] = []
    for v in variants:
        if v not in seen:
            seen.add(v)
            out.append(v)
    return out


def looks_like_image(path: Path) -> bool:
    if path.name in SKIP_NAMES or path.name.startswith("."):
        return False
    suffix = path.suffix.lower()
    if suffix in IMAGE_SUFFIXES:
        return True
    if suffix:
        return False
    try:
        with path.open("rb") as fh:
            head = fh.read(8)
    except OSError:
        return False
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return True
    if head.startswith(b"\xff\xd8\xff"):
        return True
    if head.startswith(b"RIFF") and b"WEBP" in head:
        return True
    return False


def index_source_files(directory: Path) -> dict[str, Path]:
    index: dict[str, Path] = {}
    for path in directory.iterdir():
        if not path.is_file():
            continue
        if not looks_like_image(path):
            continue
        suffix = path.suffix.lower()
        stem = path.stem if suffix else path.name
        key = normalize_label(stem)
        index.setdefault(key, path)
        index.setdefault(normalize_label(path.name), path)
    return index


def resolve_source(
    product_id: str,
    display_name: str,
    file_index: dict[str, Path],
    used: set[Path],
) -> Path | None:
    if product_id in EXPLICIT_SOURCE_BY_ID:
        name = EXPLICIT_SOURCE_BY_ID[product_id]
        path = SOURCE_DIR / name
        if path.is_file() and path not in used and looks_like_image(path):
            return path
        key = normalize_label(Path(name).stem if Path(name).suffix else name)
        hit = file_index.get(key)
        if hit and hit not in used:
            return hit
        return None

    for key in candidate_norms(display_name):
        hit = file_index.get(key)
        if hit and hit not in used:
            return hit
    return None


def content_bbox(im: Image.Image, thresh: int = CONTENT_THRESH) -> tuple[int, int, int, int] | None:
    """Return inclusive (left, top, right, bottom) of non-black content, or None."""
    gray = im.convert("L")
    mask = gray.point(lambda p: 255 if p > thresh else 0)
    box = mask.getbbox()
    if not box:
        return None
    left, top, right, bottom = box  # right/bottom are exclusive in PIL
    return left, top, right - 1, bottom - 1


def cast_height_frac(im: Image.Image, thresh: int = CONTENT_THRESH) -> float | None:
    box = content_bbox(im, thresh)
    if not box:
        return None
    _l, top, _r, bottom = box
    return (bottom - top + 1) / im.size[1]


def measure_target_frac() -> float:
    if not REF_CAST_WEBP.is_file():
        print(
            f"WARN: {REF_CAST_WEBP.name} missing; using DEFAULT_CAST_HEIGHT_FRAC="
            f"{DEFAULT_CAST_HEIGHT_FRAC}",
            file=sys.stderr,
        )
        return DEFAULT_CAST_HEIGHT_FRAC
    with Image.open(REF_CAST_WEBP) as im:
        im = im.convert("RGB")
        frac = cast_height_frac(im)
    if frac is None or frac <= 0.05:
        return DEFAULT_CAST_HEIGHT_FRAC
    return frac


def fit_cast_to_square(
    im: Image.Image,
    size: int,
    target_frac: float,
) -> Image.Image:
    """Scale so cast height == target_frac * size, centered on black square."""
    im = im.convert("RGB")
    box = content_bbox(im)
    if box is None:
        # Fallback: classic contain-fit
        w, h = im.size
        scale = size / max(w, h)
        new_w = max(1, int(round(w * scale)))
        new_h = max(1, int(round(h * scale)))
        resized = im.resize((new_w, new_h), Image.Resampling.LANCZOS)
        canvas = Image.new("RGB", (size, size), (0, 0, 0))
        canvas.paste(resized, ((size - new_w) // 2, (size - new_h) // 2))
        return canvas

    _l, top, _r, bottom = box
    cast_h = bottom - top + 1
    target_h = target_frac * size
    scale = target_h / cast_h
    new_w = max(1, int(round(im.size[0] * scale)))
    new_h = max(1, int(round(im.size[1] * scale)))
    resized = im.resize((new_w, new_h), Image.Resampling.LANCZOS)

    canvas = Image.new("RGB", (size, size), (0, 0, 0))
    # Center the resized image; if larger than canvas, crop center
    x = (size - new_w) // 2
    y = (size - new_h) // 2
    if new_w <= size and new_h <= size:
        canvas.paste(resized, (x, y))
        return canvas

    # Crop overflow from center of resized
    left = max(0, (new_w - size) // 2)
    top_c = max(0, (new_h - size) // 2)
    cropped = resized.crop((left, top_c, left + size, top_c + size))
    if cropped.size != (size, size):
        # Pad if somehow short on an edge
        canvas.paste(cropped, (0, 0))
        return canvas
    return cropped


def save_webp(im: Image.Image, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest, "WEBP", quality=WEBP_QUALITY, method=6)


def to_square_webp(src: Path, dest: Path, target_frac: float, size: int = TARGET_SIZE) -> None:
    with Image.open(src) as im:
        out = fit_cast_to_square(im, size, target_frac)
        save_webp(out, dest)


def normalize_existing(target_frac: float) -> int:
    paths = sorted(PRODUCTS_DIR.glob("*.webp"))
    if not paths:
        print(f"No WEBPs in {PRODUCTS_DIR}")
        return 0

    print(f"Normalize existing WEBPs → cast height frac {target_frac:.4f}")
    print(f"Products dir: {PRODUCTS_DIR}")
    print(f"Count:        {len(paths)}")
    print()

    for path in paths:
        with Image.open(path) as im:
            before = cast_height_frac(im.convert("RGB"))
            out = fit_cast_to_square(im, TARGET_SIZE, target_frac)
        save_webp(out, path)
        after = cast_height_frac(out)
        b = f"{before:.3f}" if before is not None else "n/a"
        a = f"{after:.3f}" if after is not None else "n/a"
        print(f"  OK  {path.stem:35} h_frac {b} → {a}")

    print(f"\nNormalized {len(paths)} WEBPs")
    return 0


def import_from_sources(target_frac: float) -> int:
    text = MAIN_JS.read_text(encoding="utf-8")
    products = parse_products(text)
    file_index = index_source_files(SOURCE_DIR)

    mapped: list[tuple[str, str, Path]] = []
    skipped: list[tuple[str, str, str]] = []
    used: set[Path] = set()

    for product_id, display_name in products:
        if product_id in SKIP_IDS:
            skipped.append((product_id, display_name, "skipped id (kept existing)"))
            continue
        src = resolve_source(product_id, display_name, file_index, used)
        if src is None:
            skipped.append(
                (product_id, display_name, "no source in KrownFrontz (kept existing)")
            )
            continue
        used.add(src)
        mapped.append((product_id, display_name, src))

    unused = sorted(
        {p for p in file_index.values()} - used,
        key=lambda p: p.name.lower(),
    )

    print(f"Source dir:   {SOURCE_DIR}")
    print(f"Products:     {len(products)}")
    print(f"Mapped:       {len(mapped)}")
    print(f"Skipped:      {len(skipped)}")
    print(f"Unused:       {len(unused)}")
    print(f"Target frac:  {target_frac:.4f}")
    print()

    for product_id, display_name, src in mapped:
        dest = PRODUCTS_DIR / f"{product_id}.webp"
        to_square_webp(src, dest, target_frac)
        print(f"  OK  {product_id:35} ← {src.name}")

    if skipped:
        print("\nSkipped:")
        for product_id, display_name, reason in skipped:
            print(f"  --  {product_id:35} ({display_name}) — {reason}")

    if unused:
        print("\nUnused KrownFrontz files:")
        for path in unused:
            print(f"  ??  {path.name}")

    print(f"\nWrote {len(mapped)} WEBPs to {PRODUCTS_DIR}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--normalize-existing",
        action="store_true",
        help="Rewrite all assets/products/*.webp to match canine cast height frac",
    )
    parser.add_argument(
        "--target-frac",
        type=float,
        default=None,
        help="Override target cast height fraction (default: measure canine.webp)",
    )
    args = parser.parse_args(argv)

    target_frac = args.target_frac if args.target_frac is not None else measure_target_frac()
    print(f"Using target cast height frac: {target_frac:.4f}")

    if args.normalize_existing:
        return normalize_existing(target_frac)
    return import_from_sources(target_frac)


if __name__ == "__main__":
    raise SystemExit(main())
