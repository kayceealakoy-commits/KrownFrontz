"""Extract catalog/pricing constants from main.js into lib/catalog-data.js for the Stripe API."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAIN = ROOT / "main.js"
OUT = ROOT / "lib" / "catalog-data.js"

NAMES = [
    "KIT_SHARED_INCLUDES",
    "SHIPPING_ZONES",
    "MATERIAL_OPTIONS",
    "MATERIAL_ID_ALIASES",
    "STONE_OPTIONS",
    "HAND_SET_DIAMOND_PRICES",
    "IMPRESSION_KITS",
    "ACCESSORIES",
    "PRODUCT_ID_ALIASES",
    "PRODUCTS",
    "BASE_TIERS",
    "PRECIOUS_SINGLE_9CT",
    "PRECIOUS_SINGLE_14CT",
    "DUAL_ARCH_4ON4_IDS",
    "DUAL_ARCH_6ON6_IDS",
    "DUAL_ARCH_8ON8_IDS",
]


def extract_const(source: str, name: str) -> str:
    pattern = rf"(const {re.escape(name)}\s*=\s*)"
    match = re.search(pattern, source)
    if not match:
        raise ValueError(f"Could not find const {name}")
    start = match.end()
    if source[start] in "[{":
        return _extract_bracketed(source, start)
    end = source.find(";", start)
    if end == -1:
        raise ValueError(f"Could not find end of const {name}")
    return source[start:end].strip()


def _extract_bracketed(source: str, start: int) -> str:
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
                return source[start : i + 1]
    raise ValueError("Unbalanced brackets while extracting catalog data")


def main() -> None:
    source = MAIN.read_text(encoding="utf-8")
    parts = []
    inline_names = {"KIT_SHARED_INCLUDES"}
    module_names = [n for n in NAMES if n not in inline_names]

    for name in inline_names:
        if name in NAMES:
            value = extract_const(source, name)
            parts.append(f"const {name} = {value};")
            parts.append("")

    parts.append("module.exports = {")
    for name in module_names:
        value = extract_const(source, name)
        parts.append(f"  {name}: {value},")
    parts.append("};")
    OUT.write_text("\n".join(parts) + "\n", encoding="utf-8")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
