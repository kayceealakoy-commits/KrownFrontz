"""
Map each KrownFrontz grillz product id to teeth + style recipe for Blender previews.

Tooth labels match blender_build_dental_base.py:
  Upper: UR1..UR7, UL1..UL7
  Lower: LR1..LR7, LL1..LL7
  1=central, 2=lateral, 3=canine, 4=1st premolar, ...
"""

from __future__ import annotations

from typing import Any

# Contiguous front sets (upper by default)
FRONT_4 = ["UR2", "UR1", "UL1", "UL2"]
FRONT_6 = ["UR3", "UR2", "UR1", "UL1", "UL2", "UL3"]
FRONT_8 = ["UR4", "UR3", "UR2", "UR1", "UL1", "UL2", "UL3", "UL4"]
LOWER_4 = ["LR2", "LR1", "LL1", "LL2"]
LOWER_6 = ["LR3", "LR2", "LR1", "LL1", "LL2", "LL3"]
LOWER_8 = ["LR4", "LR3", "LR2", "LR1", "LL1", "LL2", "LL3", "LL4"]


def _both(upper: list[str]) -> list[str]:
    out: list[str] = list(upper)
    for t in upper:
        out.append("L" + t[1:])
    return out


def _spec(
    teeth: list[str],
    style: str,
    *,
    finish: str = "gold",
    cutout_teeth: list[str] | None = None,
    bar: bool = False,
    vampire: bool = False,
    dust: bool = False,
    iced: bool = False,
    inlay_teeth: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "teeth": teeth,
        "style": style,
        "finish": finish,
        "cutout_teeth": cutout_teeth or [],
        "bar": bar,
        "vampire": vampire,
        "dust": dust,
        "iced": iced,
        "inlay_teeth": inlay_teeth or [],
    }


# All 56 catalog grillz products (representative tooth placement for product cards).
PRODUCT_SPECS: dict[str, dict[str, Any]] = {
    # --- Basics ---
    "canine": _spec(["UL3"], "solid"),
    "lateral": _spec(["UL2"], "solid"),
    "central": _spec(["UL1"], "solid"),
    "canine-canine": _spec(["UR3", "UL3"], "solid"),
    "lateral-lateral": _spec(["UR2", "UL2"], "solid"),
    "canine-lateral-2x": _spec(["UR3", "UR2", "UL2", "UL3"], "solid"),
    "lateral-canine": _spec(["UL2", "UL3"], "solid"),
    "canine-window": _spec(
        ["UL3", "UL2"],
        "mixed",
        cutout_teeth=["UL2"],
    ),
    "plain-4": _spec(FRONT_4, "solid"),
    "canines-4": _spec(["UR3", "UL3", "LR3", "LL3"], "solid"),
    "laterals-4": _spec(["UR2", "UL2", "LR2", "LL2"], "solid"),
    "centrals-4": _spec(["UR1", "UL1", "LR1", "LL1"], "solid"),
    "plain-6": _spec(FRONT_6, "solid"),
    "plain-8": _spec(FRONT_8, "solid"),
    "top-4-bottom-4": _spec(FRONT_4 + LOWER_4, "solid"),
    "top-6-bottom-6": _spec(FRONT_6 + LOWER_6, "solid"),
    "top-8-bottom-8": _spec(FRONT_8 + LOWER_8, "solid"),
    # --- Bar ---
    "window-canine-bar": _spec(
        ["UL3", "UL2"],
        "mixed",
        cutout_teeth=["UL3"],
        bar=True,
        inlay_teeth=["UL2"],
    ),
    "canine-bar": _spec(
        ["UL3", "UL2"],
        "mixed",
        bar=True,
        inlay_teeth=["UL2"],
    ),
    "heart-canine-bar": _spec(
        ["UL3", "UL2"],
        "heart",
        cutout_teeth=["UL3"],
        bar=True,
        inlay_teeth=["UL2"],
    ),
    "canines-bar-2x": _spec(
        LOWER_6,
        "mixed",
        bar=True,
        inlay_teeth=["LR2", "LR1", "LL1", "LL2"],
    ),
    # --- Window ---
    "window-canine": _spec(["UL3"], "window", cutout_teeth=["UL3"]),
    "window-lateral": _spec(["UL2"], "window", cutout_teeth=["UL2"]),
    "window-canine-lateral-2": _spec(
        ["UL3", "UL2"],
        "window",
        cutout_teeth=["UL3", "UL2"],
    ),
    "open-face-4": _spec(FRONT_4, "window", cutout_teeth=FRONT_4),
    "open-face-6": _spec(FRONT_6, "window", finish="silver", cutout_teeth=FRONT_6),
    "window-set-8": _spec(FRONT_8, "window", finish="silver", cutout_teeth=FRONT_8),
    "open-face-6-on-6": _spec(
        FRONT_6 + LOWER_6,
        "window",
        finish="silver",
        cutout_teeth=FRONT_6 + LOWER_6,
    ),
    "open-face-8-on-8": _spec(
        FRONT_8 + LOWER_8,
        "window",
        finish="silver",
        cutout_teeth=FRONT_8 + LOWER_8,
    ),
    # --- Heart / Star / Vampire ---
    "heart-canine": _spec(["UL3"], "heart", cutout_teeth=["UL3"]),
    "heart-lateral": _spec(["UL2"], "heart", cutout_teeth=["UL2"]),
    "star-canine": _spec(["UL3"], "star", cutout_teeth=["UL3"]),
    "star-lateral": _spec(["UL2"], "star", cutout_teeth=["UL2"]),
    "vampire-canines": _spec(["UR3", "UL3"], "vampire", vampire=True),
    "vampire-canine-lateral-2": _spec(
        ["UL3", "UL2"],
        "vampire",
        vampire=True,
    ),
    # --- Diamond dust ---
    "dust-canine": _spec(["UL3"], "dust", dust=True),
    "dust-lateral": _spec(["UL2"], "dust", dust=True),
    "dust-central": _spec(["UL1"], "dust", dust=True),
    "dust-canine-pair": _spec(["UR3", "UL3"], "dust", dust=True),
    "dust-lateral-pair": _spec(["UR2", "UL2"], "dust", dust=True),
    "dust-central-pair": _spec(["UR1", "UL1"], "dust", dust=True),
    "dust-canines-4": _spec(["UR3", "UL3", "LR3", "LL3"], "dust", dust=True),
    "dust-laterals-4": _spec(["UR2", "UL2", "LR2", "LL2"], "dust", dust=True),
    "dust-centrals-4": _spec(["UR1", "UL1", "LR1", "LL1"], "dust", dust=True),
    "diamond-dust-4": _spec(FRONT_4, "dust", dust=True),
    # --- Hand-set diamond / iced ---
    "diamond-canine": _spec(["UL3"], "iced", finish="iced", iced=True),
    "diamond-lateral": _spec(["UL2"], "iced", finish="iced", iced=True),
    "diamond-heart-canine": _spec(
        ["UL3"],
        "heart",
        finish="iced",
        cutout_teeth=["UL3"],
        iced=True,
    ),
    "diamond-window-canine": _spec(
        ["UL3"],
        "window",
        finish="iced",
        cutout_teeth=["UL3"],
        iced=True,
    ),
    "diamond-canine-canine": _spec(
        ["UR3", "UL3"],
        "iced",
        finish="iced",
        iced=True,
    ),
    "diamond-lateral-lateral": _spec(
        ["UR2", "UL2"],
        "iced",
        finish="iced",
        iced=True,
    ),
    "diamond-lateral-canine": _spec(
        ["UL3", "UL2"],
        "iced",
        finish="iced",
        iced=True,
    ),
    "diamond-window-canine-inlay": _spec(
        ["UL3", "UL2"],
        "mixed",
        finish="iced",
        cutout_teeth=["UL3"],
        bar=True,
        iced=True,
        inlay_teeth=["UL2"],
    ),
    "diamond-window-lateral-canine": _spec(
        ["UL3", "UL2"],
        "window",
        finish="iced",
        cutout_teeth=["UL3", "UL2"],
        iced=True,
    ),
    "window-canine-diamond-inlay": _spec(
        ["UL3", "UL2"],
        "mixed",
        finish="iced",
        cutout_teeth=["UL3"],
        bar=True,
        iced=True,
        inlay_teeth=["UL2"],
    ),
}


def all_product_ids() -> list[str]:
    return list(PRODUCT_SPECS.keys())


def get_spec(product_id: str) -> dict[str, Any]:
    if product_id not in PRODUCT_SPECS:
        raise KeyError(f"Unknown product id: {product_id}")
    return PRODUCT_SPECS[product_id]
