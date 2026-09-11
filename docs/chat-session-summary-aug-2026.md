# Krown Frontz — Chat Session Summary (Aug 2026)

Summary of catalog, product-page, and copy changes from the Aug 2026 Cursor session.

## Files touched

| File | Role |
|------|------|
| `main.js` | Catalog, legacy aliases, 4 on 4 product, dual-arch pricing, product blurbs |
| `tooth-picker.js` | Interactive 4 on 4 selection; abbreviation summary labels |
| `lib/pricing.js` | Server-side 4 on 4 pricing |
| `lib/catalog-data.js` | Generated from `main.js` via sync script |
| `scripts/sync-pricing-lib.py` | Exports `DUAL_ARCH_4ON4_IDS` |
| `scripts/test-checkout-logic.js` | 4 on 4 pricing and checkout assertions |
| `terms-of-service.html` | Removed “arch” from customer-facing policy copy |

---

## 1. Removed Canines with Bar; added 4 on 4

- Deleted **2 x Canines with Bar** (`canines-with-bar`) from the shop and Bar filter.
- Added **4 on 4** (`top-4-bottom-4`) to Basics — four contiguous teeth on upper and lower.
- **From-price:** £340 sterling (confirmed during planning).
- Pricing uses `DUAL_ARCH_4ON4_IDS` and `DUAL_ARCH_STERLING_BASE["4on4"] = 340`, same pattern as 6 on 6 / 8 on 8.

### Legacy URL remaps (formerly pointed at `canines-with-bar`)

| Old alias | Remap to |
|-----------|----------|
| `basic-4`, `basic-4-gold`, `bar-4` | `plain-4` |
| `bar-6`, `classic-6-gold` | `plain-6` |
| `bar-8`, `bar-8-gold` | `plain-8` |
| `bar-12` | `top-6-bottom-6` |
| `full-gold` | `top-8-bottom-8` |

---

## 2. Interactive tooth selection for 4 on 4

- 4 on 4 was initially preset/read-only (like 6 on 6 and 8 on 8).
- Removed from `isPresetDualArchProduct` so customers can pick their own 4+4 contiguous blocks.
- Product fields unchanged: `toothRule: "both-arch-contiguous"`, `chartMode: "both"`, `teeth: "8"`.
- 6 on 6 and 8 on 8 remain preset/read-only.

---

## 3. Compact picker summary for 4 on 4

- Full tooth-name lists (e.g. “Upper left lateral, Upper left central, …”) were too bulky.
- Added `formatAbbrevLabels()` and `formatSelectionSummary()` in `tooth-picker.js`.
- For `both-arch-contiguous` products, summary and cart label use button abbreviations: **CI, L, C, P1, …** in chart order.
- Example complete selection label: `C, L, CI, CI, C, L, CI, CI`.

---

## 4. Removed “arch” from website copy

Customer-facing text only — internal code (`toothRule`, cart `arch` field, CSS classes) unchanged.

| Product / page | Before | After |
|----------------|--------|-------|
| 2 x Lateral | …on one arch. | …on upper or lower. |
| 2 x Canine & Lateral | …both sides of one arch. | …on both sides. |
| 4 on 4 | Plain dual-arch set. | Plain set. |
| 6 on 6 open face | …teeth per arch. | …teeth each. |
| Diamond-dust / diamond pairs (5) | …of one arch. | …on upper or lower. |
| Terms of service | style, material, teeth, and arch | style, material, and teeth |

---

## Verification

- `node scripts/test-checkout-logic.js` — passes (4 on 4 at £340, alias/catalog parity).
- `python scripts/sync-pricing-lib.py` — regenerates `lib/catalog-data.js` after catalog edits.
- `product.html?id=top-4-bottom-4` — interactive picker, abbreviation summary, £340 from-price.
- `product.html?id=canine-lateral-2x` — blurb: “Canine and lateral caps on both sides.”
- Shop → Bar — no Canines with Bar card.
- Shop → Basics — 4 on 4 listed alongside 4 set, 6 on 6, 8 on 8.

---

## Related docs

- [`catalog-session-summary.md`](catalog-session-summary.md) — broader Aug 2026 catalog session (filters, diamond dust, star, etc.)
