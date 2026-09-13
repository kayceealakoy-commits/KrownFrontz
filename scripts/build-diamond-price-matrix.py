"""Build HAND_SET_DIAMOND_PRICES from K9GrillzUK diamond collection (K9 price - £30)."""
from __future__ import annotations

import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAIN = ROOT / "main.js"
K9_URL = "https://k9grillzuk.co.uk/collections/diamond-collection/products.json?limit=50"
DISCOUNT_GBP = 30

KROWN_TO_K9_HANDLE = {
    "diamond-canine": "diamond-canine-1",
    "diamond-lateral": "diamond-lateral",
    "diamond-heart-canine": "diamond-heart-canine",
    "diamond-window-canine": "diamond-window-canine",
    "diamond-canine-canine": "diamond-canine-canine",
    "diamond-lateral-lateral": "diamond-lateral-lateral",
    "diamond-lateral-canine": "diamond-lateral-canine",
    "diamond-window-canine-inlay": "diamond-window-canine-bar",
    "diamond-window-lateral-canine": "diamond-window-lateral-canine",
    "window-canine-diamond-inlay": "window-canine-diamond-bar",
}

K9_MATERIAL_TO_KROWN = {
    "Sterling Silver": "sterling-silver",
    "Silver": "sterling-silver",
    "9ct Yellow Gold": "9ct-yellow-gold",
    "9ct White Gold": "9ct-white-gold",
    "18ct Yellow Gold": "14ct-yellow-gold",
    "18ct White Gold": "14ct-white-gold",
}

KROWN_MATERIALS_FROM_K9 = {
    "sterling-silver": ["Sterling Silver", "Silver"],
    # Dental gold is a non-precious alloy: same rates as argentium, not 9ct.
    "argentium-silver": ["Sterling Silver", "Silver"],
    "dental-gold": ["Sterling Silver", "Silver"],
    "9ct-yellow-gold": ["9ct Yellow Gold"],
    "9ct-white-gold": ["9ct White Gold"],
    "14ct-yellow-gold": ["18ct Yellow Gold"],
    "14ct-white-gold": ["18ct White Gold"],
}

K9_STONE_TO_ID = {
    "Cubic Zirconia": "cubic-zirconia",
    "Moissanite": "moissanite",
    "VVS Lab Diamonds": "vvs-lab-diamonds",
    "VS Natural Diamonds": "vs-natural-diamonds",
}

EXCLUDED_STONES = {"VVS Natural Diamonds"}


def round_price(amount: float) -> int:
    return int(round(amount / 5) * 5)


def fetch_products() -> dict[str, dict]:
    with urllib.request.urlopen(K9_URL, timeout=60) as resp:
        data = json.load(resp)
    return {p["handle"]: p for p in data["products"]}


def variant_lookup(product: dict) -> dict[tuple[str, str], float]:
    lookup: dict[tuple[str, str], float] = {}
    for variant in product["variants"]:
        mat = variant.get("option1") or ""
        stone = variant.get("option2") or ""
        if stone in EXCLUDED_STONES:
            continue
        lookup[(mat, stone)] = float(variant["price"])
    return lookup


def build_matrix(products_by_handle: dict[str, dict]) -> dict:
    matrix: dict = {}
    for krown_id, k9_handle in KROWN_TO_K9_HANDLE.items():
        product = products_by_handle.get(k9_handle)
        if not product:
            raise ValueError(f"Missing K9 product: {k9_handle}")
        variants = variant_lookup(product)
        matrix[krown_id] = {}
        for krown_mat, k9_mats in KROWN_MATERIALS_FROM_K9.items():
            matrix[krown_id][krown_mat] = {}
            for k9_stone, stone_id in K9_STONE_TO_ID.items():
                price = None
                for k9_mat in k9_mats:
                    key = (k9_mat, k9_stone)
                    if key in variants:
                        price = round_price(variants[key] - DISCOUNT_GBP)
                        break
                if price is None:
                    raise ValueError(
                        f"No K9 price for {krown_id} / {krown_mat} / {k9_stone}"
                    )
                if krown_mat in ("argentium-silver", "dental-gold"):
                    price += 10
                matrix[krown_id][krown_mat][stone_id] = price
    return matrix


def format_js_object(matrix: dict, indent: int = 0) -> str:
    pad = "  " * indent
    inner_pad = "  " * (indent + 1)
    lines = ["{"]
    product_ids = list(matrix.keys())
    for pi, product_id in enumerate(product_ids):
        lines.append(f'{inner_pad}"{product_id}": {{')
        materials = list(matrix[product_id].keys())
        for mi, material_id in enumerate(materials):
            lines.append(f'{inner_pad}  "{material_id}": {{')
            stones = list(matrix[product_id][material_id].keys())
            for si, stone_id in enumerate(stones):
                price = matrix[product_id][material_id][stone_id]
                comma = "," if si < len(stones) - 1 else ""
                lines.append(f'{inner_pad}    "{stone_id}": {price}{comma}')
            mat_comma = "," if mi < len(materials) - 1 else ""
            lines.append(f"{inner_pad}  }}{mat_comma}")
        prod_comma = "," if pi < len(product_ids) - 1 else ""
        lines.append(f"{inner_pad}}}{prod_comma}")
    lines.append(f"{pad}}}")
    return "\n".join(lines)


def replace_const(source: str, name: str, value: str) -> str:
    pattern = rf"const {re.escape(name)}\s*=\s*"
    match = re.search(pattern, source)
    if not match:
        raise ValueError(f"Could not find const {name} in main.js")
    start = match.start()
    brace_start = source.find("{", match.end())
    if brace_start == -1:
        raise ValueError(f"Expected object for {name}")
    depth = 0
    for i in range(brace_start, len(source)):
        if source[i] == "{":
            depth += 1
        elif source[i] == "}":
            depth -= 1
            if depth == 0:
                end = source.find(";", i) + 1
                return source[:start] + f"const {name} = {value};" + source[end:]
    raise ValueError(f"Unbalanced braces for {name}")


def ensure_stone_constants(source: str) -> str:
    if "const STONE_OPTIONS" in source:
        return source
    insert_after = "const MATERIAL_ID_ALIASES = {"
    idx = source.find(insert_after)
    if idx == -1:
        raise ValueError("Could not find MATERIAL_ID_ALIASES")
    end = source.find("};", idx) + 2
    block = """

const STONE_OPTIONS = [
  { id: "cubic-zirconia", label: "Cubic Zirconia" },
  { id: "moissanite", label: "Moissanite" },
  { id: "vvs-lab-diamonds", label: "VVS Lab Diamonds" },
  { id: "vs-natural-diamonds", label: "VS Natural Diamonds" },
];

const STONE_LABELS = Object.fromEntries(STONE_OPTIONS.map((s) => [s.id, s.label]));

const DEFAULT_STONE_ID = "cubic-zirconia";

const HAND_SET_DIAMOND_PRICES = {};
"""
    return source[:end] + block + source[end:]


def main() -> None:
    products = fetch_products()
    matrix = build_matrix(products)
    js_matrix = format_js_object(matrix)

    source = MAIN.read_text(encoding="utf-8")
    source = ensure_stone_constants(source)
    source = replace_const(source, "HAND_SET_DIAMOND_PRICES", js_matrix)
    MAIN.write_text(source, encoding="utf-8")
    print(f"Updated HAND_SET_DIAMOND_PRICES in {MAIN}")
    print(f"Products: {len(matrix)}")


if __name__ == "__main__":
    main()
