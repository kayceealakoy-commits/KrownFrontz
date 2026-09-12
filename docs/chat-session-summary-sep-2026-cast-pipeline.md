# Krown Frontz — Chat Session Summary (Sep 11, 2026 evening)

Follow-up to [`chat-session-summary-sep-2026.md`](chat-session-summary-sep-2026.md). Focus: dental cast quality, CAD options, upper+lower mesh drop, and full 56 re-render.

## Problem raised

Shop product cards showed bad stills:

1. Cast looked like a **flipped / wrong-orientation** arch (flat base on top, unnatural tooth read).
2. **Gold grillz floated / clipped** — not fitted to real tooth surfaces.
3. Earlier Artec-only pipeline used hidden procedural tooth proxies + shrinkwrap hope; not CAD-style shells on the scan.

## Decisions

| Choice | Outcome |
|--------|---------|
| Cast source | User chose **drop** a free CGTrader upper+lower model (not buy Rhino yet; Blender-only for stills) |
| CAD path | Stay on **Blender** for catalog stills; Rhino optional later for manufacturing-grade jewelry CAD |
| Open bite | Import separate maxillary + mandibular STLs and pose as open-bite frontal product shot |

## Mesh dropped by user

Path: `assets/blender/source/`

| File | Role |
|------|------|
| `upper_cast.stl` | Maxillary (from CGTrader pack) |
| `lower_cast.stl` | Mandibular |
| `full_arch_cast.obj/` | Original unzipped CGTrader folder (Exocad teeth libraries pack) |
| `FULL_ARCH_ATTRIBUTION.md` | Royalty Free credit note |
| `DROP_CAST_HERE.md` | Drop / rebuild instructions |

Source listing: [Upper and Lower jaws modeled perfectly](https://www.cgtrader.com/free-3d-print-models/science/laboratory/upper-and-lower-jaws-modeled-perfectly) (NCT-Dental-Design, Royalty Free).

Legacy Artec upper-only OBJ remains in the same folder for reference (CC BY); not used for the current open-bite base.

## Pipeline changes

### Base builder — [`scripts/blender_build_dental_base.py`](../scripts/blender_build_dental_base.py)

- Imports `upper_cast.stl` + `lower_cast.stl`
- Orients: anterior toward camera (`-Y`); upper hung (teeth down); lower teeth up
- Open-bite pose + black studio lights/camera
- **Auto-calibrates** `Tooth_*` locators by sampling camera-facing surface centers on each cast
- Saves `assets/blender/dental_arch_base.blend`

### Grillz render — [`scripts/blender_render_previews.py`](../scripts/blender_render_previews.py)

- Caps are **shrinkwrapped shells** onto `DentalCast_Upper` / `DentalCast_Lower` (not floating procedural crown duplicates)
- Catalog recipes still from [`scripts/grillz_catalog_specs.py`](../scripts/grillz_catalog_specs.py) (56 IDs)
- Batch WEBP → `assets/products/{id}.webp`
- Sync: `python scripts/sync_images.py --products-only`

### Rebuild commands

```bash
BLENDER=/home/alakob/Documents/Kaycee/blender-5.2.1-linux-x64/blender
cd KrownFrontz
$BLENDER --background --python scripts/blender_build_dental_base.py
$BLENDER --background assets/blender/dental_arch_base.blend \
  --python scripts/blender_render_previews.py -- --all
python scripts/sync_images.py --products-only
```

## Result

- All **56** grillz WEBPs re-rendered and wired into `main.js`
- Kits still missing images: `impression-kit-uk`, `impression-kit-international`
- Large mesh sources gitignored (`.stl` / unzipped pack / debug blends)

## Quality status (honest)

- **Fixed:** real upper+lower cast; frontal framing; gold sits on teeth (not free-floating proxies).
- **Still short of K9 jeweler CAD:** metal can look slightly “nuggety” (ico-sphere → shrinkwrap), not smooth crown shells; typodont is not a classic plaster open-bite photo prop.
- **Next upgrades (if wanted):** smoother facial plaque blanks, per-style Boolean cutouts refined on fitted shells, optional Rhino CAD export → Blender render, or a better plaster-look scan drop.

## Out of scope this session

- GitHub / Netlify push
- Impression-kit photos
- Buying/installing Rhino
- Per-material photo variants

## Quick reference

| Task | Place |
|------|--------|
| Drop new casts | `assets/blender/source/upper_cast.stl` + `lower_cast.stl` |
| Attribution | `assets/blender/source/FULL_ARCH_ATTRIBUTION.md` |
| Rebuild stills | Commands above |
| Prior session notes | [`chat-session-summary-sep-2026.md`](chat-session-summary-sep-2026.md) |
