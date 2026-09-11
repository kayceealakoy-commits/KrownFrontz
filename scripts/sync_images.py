"""Sync product and client images from drop folders into main.js."""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAIN_JS = ROOT / "main.js"
PRODUCTS_DIR = ROOT / "assets" / "products"
CLIENTS_DIR = ROOT / "assets" / "clients"
MANIFEST = PRODUCTS_DIR / "manifest.json"

IMAGE_EXTENSIONS = {".webp", ".jpg", ".jpeg", ".png"}
EXTENSION_PRIORITY = {".webp": 0, ".png": 1, ".jpg": 2, ".jpeg": 3}
IGNORED_PRODUCT_FILES = {"README.txt", "manifest.json", ".gitkeep"}
DEFAULT_CLIENT_ALT = "Client wearing custom Krown Frontz grillz"


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


def parse_product_ids(text: str) -> set[str]:
    match = re.search(r"const PRODUCTS\s*=\s*\[", text)
    if not match:
        raise ValueError("Could not find PRODUCTS in main.js")
    section, _ = extract_bracketed(text, match.end() - 1)
    return set(re.findall(r'\bid:\s*"([^"]+)"', section))


def parse_kit_ids(text: str) -> set[str]:
    match = re.search(r"const IMPRESSION_KITS\s*=\s*\[", text)
    if not match:
        return set()
    section, _ = extract_bracketed(text, match.end() - 1)
    return set(re.findall(r'\bid:\s*"([^"]+)"', section))


def parse_catalog_ids(text: str) -> set[str]:
    return parse_product_ids(text) | parse_kit_ids(text)


def wire_catalog_image(text: str, item_id: str, image_path: str) -> tuple[str, bool]:
    pattern = rf'(id:\s*"{re.escape(item_id)}"[\s\S]*?image:\s*)(?:null|"[^"]*")'
    new_text, count = re.subn(pattern, rf'\1"{image_path}"', text, count=1)
    return new_text, count > 0


def scan_product_images() -> dict[str, Path]:
    if not PRODUCTS_DIR.exists():
        return {}
    by_id: dict[str, Path] = {}
    for path in PRODUCTS_DIR.iterdir():
        if not path.is_file():
            continue
        if path.name in IGNORED_PRODUCT_FILES:
            continue
        if path.suffix.lower() not in IMAGE_EXTENSIONS:
            continue
        stem = path.stem
        existing = by_id.get(stem)
        if existing is None:
            by_id[stem] = path
            continue
        if EXTENSION_PRIORITY[path.suffix.lower()] < EXTENSION_PRIORITY[existing.suffix.lower()]:
            by_id[stem] = path
    return by_id


def relative_web_path(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def wire_product_image(text: str, product_id: str, image_path: str) -> tuple[str, bool]:
    return wire_catalog_image(text, product_id, image_path)


def parse_client_looks(text: str) -> dict[str, str]:
    match = re.search(r"const CLIENT_LOOKS\s*=\s*\[", text)
    if not match:
        return {}
    section, _ = extract_bracketed(text, match.end() - 1)
    alts: dict[str, str] = {}
    for src, alt in re.findall(
        r'src:\s*"assets/clients/([^"]+)"[\s\S]*?alt:\s*"([^"]*)"',
        section,
    ):
        alts[src] = alt
    return alts


def read_alt_sidecar(image_path: Path) -> str | None:
    sidecar = image_path.with_suffix(image_path.suffix + ".alt.txt")
    if not sidecar.exists():
        sidecar = image_path.with_name(f"{image_path.stem}.alt.txt")
    if not sidecar.exists():
        return None
    text = sidecar.read_text(encoding="utf-8").strip()
    return text or None


def scan_client_images() -> list[Path]:
    if not CLIENTS_DIR.exists():
        return []
    files = [
        path
        for path in CLIENTS_DIR.iterdir()
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    ]
    return sorted(files, key=lambda p: p.name.lower())


def format_client_looks(entries: list[tuple[str, str]]) -> str:
    lines = ["const CLIENT_LOOKS = ["]
    for src, alt in entries:
        escaped_alt = alt.replace("\\", "\\\\").replace('"', '\\"')
        lines.append(f'  {{ src: "assets/clients/{src}", alt: "{escaped_alt}" }},')
    lines.append("];")
    return "\n".join(lines)


def replace_client_looks(text: str, new_block: str) -> str:
    match = re.search(r"const CLIENT_LOOKS\s*=\s*\[", text)
    if not match:
        raise ValueError("Could not find CLIENT_LOOKS in main.js")
    _, end = extract_bracketed(text, match.end() - 1)
    semicolon = text.find(";", end)
    if semicolon == -1:
        raise ValueError("Could not find end of CLIENT_LOOKS in main.js")
    return text[: match.start()] + new_block + text[semicolon + 1 :]


def sync_products(*, dry_run: bool = False) -> dict[str, int]:
    text = MAIN_JS.read_text(encoding="utf-8")
    catalog_ids = parse_catalog_ids(text)
    images = scan_product_images()

    manifest: dict[str, str] = {}
    unknown: list[str] = []
    wired = 0
    failed: list[str] = []

    for stem, path in sorted(images.items()):
        rel = relative_web_path(path)
        if stem not in catalog_ids:
            unknown.append(path.name)
            continue
        manifest[stem] = rel
        text, ok = wire_catalog_image(text, stem, rel)
        if ok:
            wired += 1
        else:
            failed.append(stem)

    missing = sorted(catalog_ids - set(manifest.keys()))

    if not dry_run:
        PRODUCTS_DIR.mkdir(parents=True, exist_ok=True)
        MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        MAIN_JS.write_text(text, encoding="utf-8")

    print(f"Products: wired {wired} image(s) from {PRODUCTS_DIR.relative_to(ROOT)}")
    if unknown:
        print(f"  Warning: no catalog match for {len(unknown)} file(s): {', '.join(unknown)}")
    if failed:
        print(f"  Warning: could not wire {len(failed)} product(s): {', '.join(failed)}")
    if missing:
        preview = ", ".join(missing[:8])
        suffix = "..." if len(missing) > 8 else ""
        print(f"  {len(missing)} catalog product(s) still without images: {preview}{suffix}")

    return {"wired": wired, "unknown": len(unknown), "missing": len(missing)}


def sync_clients(*, dry_run: bool = False) -> dict[str, int]:
    text = MAIN_JS.read_text(encoding="utf-8")
    existing_alts = parse_client_looks(text)
    images = scan_client_images()

    entries: list[tuple[str, str]] = []
    for path in images:
        filename = path.name
        sidecar_alt = read_alt_sidecar(path)
        alt = sidecar_alt or existing_alts.get(filename) or DEFAULT_CLIENT_ALT
        entries.append((filename, alt))

    new_block = format_client_looks(entries)

    if not dry_run:
        text = replace_client_looks(text, new_block)
        MAIN_JS.write_text(text, encoding="utf-8")

    print(f"Clients: synced {len(entries)} slide(s) from {CLIENTS_DIR.relative_to(ROOT)}")
    if not entries:
        print("  (no image files found — carousel will be empty until you add photos)")

    return {"synced": len(entries)}


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Wire assets/products and assets/clients images into main.js"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report changes without writing main.js or manifest.json",
    )
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--products-only", action="store_true")
    group.add_argument("--clients-only", action="store_true")
    args = parser.parse_args()

    run_products = not args.clients_only
    run_clients = not args.products_only

    if args.dry_run:
        print("Dry run — no files will be modified.\n")

    if run_products:
        sync_products(dry_run=args.dry_run)
    if run_clients:
        sync_clients(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
