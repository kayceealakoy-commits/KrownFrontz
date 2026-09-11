# Krown Frontz — Catalog Session Summary

Summary of changes made during the Aug 2026 catalog and shop UX session.

## Files touched

| File | Role |
|------|------|
| `main.js` | Product catalog, design filters, legacy URL aliases, dynamic tooth filters |
| `tooth-picker.js` | Product-page tooth selection rules and validation |
| `index.html` | Footer link for Star design |

---

## 1. Removed 6-tooth vampire set

- Deleted `vampire-set-6` from the `PRODUCTS` array.
- Removed legacy aliases `vampire-6` and `vampire-6-gold`.
- Vampire design now has two products only: **Vampire Canines** and **2 x Vampire Canine & Lateral**.

---

## 2. Dynamic tooth-count filters

- Added `productsForStyle`, `availableTeethCounts`, and `normalizeShopFilters` in `main.js`.
- Tooth-count buttons only appear when products exist for the selected design (e.g. Vampire shows **All teeth** and **2 teeth** only).
- Invalid URL combos (e.g. `?style=vampire&teeth=6`) fall back to `teeth=all`.
- Style filter links drop invalid tooth counts when switching designs.

---

## 3. Basics and Window catalog consolidation

### Basics — simplified 4 / 6 / 8 sets

| Before | After |
|--------|-------|
| Top 4, Bottom 4 | **4 set** (`plain-4`) — arch chosen on product page |
| Top 6, Bottom 6 | **6 set** (`plain-6`) |
| Top 8, Bottom 8 | **8 set** (`plain-8`) |

Legacy aliases: `top-4`/`bottom-4` → `plain-4`, `top-6`/`bottom-6` → `plain-6`, `top-8`/`bottom-8` → `plain-8`.

### Window — dual-arch open face

- **6 on 6 open face** (`open-face-6-on-6`, £560)
- **8 on 8 open face** (`open-face-8-on-8`, £1,160)

Legacy aliases: `window-12`, `window-16`.

---

## 4. Star design category

New filter and three products:

| Product | Teeth | Selection |
|---------|-------|-----------|
| Star Canine | 1 | Single canine, any arch |
| Star Lateral | 1 | Single lateral, any arch |
| Abstract Star | 2 | 2 contiguous upper front teeth |

Footer link added on `index.html`: `shop.html?style=star`.

---

## 5. Tooth picker — arch-canines fix

- For `toothRule: "arch-canines"` (Canine - Canine, Vampire Canines), only canine positions (button **3 / C**) are selectable.
- Non-canine teeth are disabled/greyed out.

---

## 8. Removed Canines with Bar; added 4 on 4

- Removed **2 x Canines with Bar** (`canines-with-bar`) from the Bar design filter.
- Added **4 on 4** (`top-4-bottom-4`) to Basics — four contiguous teeth on upper and lower (£340 sterling from-price). Uses **interactive** tooth selection (`both-arch-contiguous`); 6 on 6 and 8 on 8 remain preset/read-only. Picker summary shows tooth-type abbreviations (CI, L, C, …) instead of full tooth names.
- Legacy aliases remapped: `basic-4`/`bar-4` → `plain-4`, `bar-6` → `plain-6`, `bar-8` → `plain-8`, `bar-12` → `top-6-bottom-6`, `full-gold` → `top-8-bottom-8`.

---

## 6. Basics — 4 Canine, 4 Lateral, 4 Central

Three products covering all four positions across both arches:

| Product | Rule | Teeth |
|---------|------|-------|
| 4 Canine | `both-arch-canines` | UR3, UL3, LR3, LL3 |
| 4 Lateral | `both-arch-laterals` | UR2, UL2, LR2, LL2 |
| 4 Central | `both-arch-centrals` | UR1, UL1, LR1, LL1 |

Clicking any valid tooth selects the full set.

Basics + **4 teeth** filter shows five products: 2 x Canine & Lateral, 4 set, 4 Canine, 4 Lateral, 4 Central.

---

## 7. Diamond — diamond-dust catalog

Nine new diamond-dust products (plus existing Diamond-dust 4-tooth, 6-tooth iced, 8-tooth iced):

### Singles (1 tooth)

- Diamond-dust Canine (£120)
- Diamond-dust Lateral (£125)
- Diamond-dust Central (£125)

### Doubles — one arch (2 teeth)

- Diamond-dust Canine - Canine
- Diamond-dust Lateral - Lateral
- Diamond-dust Central - Central

### Both arches (4 teeth)

- Diamond-dust 4 Canine
- Diamond-dust 4 Lateral
- Diamond-dust 4 Central

### Tooth picker additions

- New rules: `arch-centrals`, `both-arch-centrals`
- `SINGLE_CENTRAL_IDS` for central single-tooth products
- Dust singles registered in `SINGLE_CANINE_IDS` / `SINGLE_LATERAL_IDS`

Diamond filter tooth counts:

| Count | Products |
|-------|----------|
| 1 | 3 dust singles |
| 2 | 3 dust arch pairs |
| 4 | Dust 4-tooth + 4 Canine/Lateral/Central dust |
| 6 / 8 | Iced sets only |

---

## Verification URLs

- `shop.html?style=vampire` — 2 products; tooth filter shows 1 and 2 only
- `shop.html?style=basics&teeth=4` — 5 products
- `shop.html?style=star` — 3 products
- `shop.html?style=diamond&teeth=1` — 3 dust singles
- `shop.html?style=diamond&teeth=2` — 3 dust pairs
- `shop.html?style=diamond&teeth=4` — 4 products
- `shop.html?style=window` — includes 12 and 16 teeth options

---

## Design filter order (current)

All → Basics → Bar → Window → Heart → Star → Vampire → Diamond → Full custom

---

## See also

- [`chat-session-summary-aug-2026.md`](chat-session-summary-aug-2026.md) — 4 on 4 product, Canines with Bar removal, interactive picker, abbreviation summary, and “arch” copy cleanup from the same session.
