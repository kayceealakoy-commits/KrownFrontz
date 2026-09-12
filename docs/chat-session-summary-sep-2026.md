# Krown Frontz / Kaycee — Chat Session Summary (Sep 2026)

Summary of setup, Blender integration, and product-preview work from the Sep 11, 2026 Cursor session.

## Workspace context

| Path | Role |
|------|------|
| `/home/alakob/Documents/Kaycee` | Cursor workspace root (also holds Blender installs) |
| `KrownFrontz/` | Website repo cloned from GitHub |
| `blender-5.2.1-linux-x64/` | Local Blender 5.2.1 LTS binary |
| `.venv-blender-mcp/` | Official Lab MCP server Python venv |

---

## 1. Cloned the website

- Repo: [https://github.com/kayceealakoy-commits/KrownFrontz](https://github.com/kayceealakoy-commits/KrownFrontz) (made public during the session)
- Cloned to: `Kaycee/KrownFrontz` (Blender folders left in place)
- Local preview: `python3 -m http.server 8080` in `KrownFrontz` → [http://127.0.0.1:8080/](http://127.0.0.1:8080/)
- Full Netlify/Stripe preview needs Node + `npm run dev` (Node was not installed in this environment)

---

## 2. Installed Blender on PATH

- Used existing extract: `Kaycee/blender-5.2.1-linux-x64`
- Symlinked `blender` → `~/.local/bin/blender`
- Installed desktop entry under `~/.local/share/applications/blender.desktop`
- Ensured `~/.bashrc` adds `~/.local/bin` to `PATH`

---

## 3. Connected Cursor → Blender (Official Lab MCP)

Stack chosen for Blender **5.2.1** (not community `uvx blender-mcp`):

```
Cursor Agent  --stdio MCP-->  blender-mcp (venv)
                           --TCP :9876-->  Lab MCP addon inside Blender
```

### What was installed

| Piece | Location / action |
|-------|-------------------|
| MCP Python server | `pip install git+https://projects.blender.org/lab/blender_mcp.git#subdirectory=mcp` into `.venv-blender-mcp` |
| Lab extensions repo | `blender -c extension repo-add lab --url https://lab.blender.org/` |
| Addon package `mcp` | Installed + enabled (`bl_ext.lab.mcp`), Online Access on |
| Cursor config | `~/.cursor/mcp.json` → command `.venv-blender-mcp/bin/blender-mcp`, port `9876` |

### How to use

1. Launch Blender (addon auto-starts MCP bridge on `127.0.0.1:9876`)
2. Cursor Settings → MCP → refresh **blender**
3. Ask the agent to inspect/manipulate the live scene

**Security note:** Lab MCP can run LLM-generated Python in Blender with no sandbox.

---

## 4. Grillz product images (Blender pipeline)

### Goal

Replace `image: null` on all **56** grillz SKUs with K9-style product stills (grillz on a full dental model).

### Pipeline added

| File | Role |
|------|------|
| `scripts/download_artec_cast.py` | Downloads Artec CC BY plaster cast into `assets/blender/source/` |
| `scripts/blender_build_dental_base.py` | Builds `assets/blender/dental_arch_base.blend` from that cast |
| `scripts/grillz_catalog_specs.py` | Maps each product id → teeth + style recipe |
| `scripts/blender_render_previews.py` | Procedural grillz + batch WEBP render |
| `assets/products/{id}.webp` | Output stills (800×800) |
| `scripts/sync_images.py` | Wires paths into `main.js` + `manifest.json` |

### Batch commands

```bash
BLENDER=/home/alakob/Documents/Kaycee/blender-5.2.1-linux-x64/blender
cd KrownFrontz
python scripts/download_artec_cast.py
$BLENDER --background --python scripts/blender_build_dental_base.py
$BLENDER --background assets/blender/dental_arch_base.blend \
  --python scripts/blender_render_previews.py -- --all
python scripts/sync_images.py --products-only
```

### Result / quality status

- All **56** grillz IDs were rendered and synced into `main.js` (`image: "assets/products/….webp"`).
- Kits still missing images: `impression-kit-uk`, `impression-kit-international`.
- **Dental base (current):** CGTrader upper+lower STLs (`upper_cast.stl` / `lower_cast.stl`) posed open-bite; tooth locators auto-calibrated from facial surfaces; caps shrinkwrapped onto the casts. See [`chat-session-summary-sep-2026-cast-pipeline.md`](chat-session-summary-sep-2026-cast-pipeline.md).
- **Earlier attempt:** Artec upper-only plaster (CC BY) — wrong framing + floating proxy caps; superseded by the CGTrader open-bite drop.
- Re-render: rebuild base → batch `--all` → `python scripts/sync_images.py --products-only`.

---

## 5. Out of scope this session

- Pushing website or assets to GitHub / Netlify
- Impression-kit / accessory photos (except existing `gift-card.jpg`)
- Per-material photo variants (gold-first previews only)
- Photoreal jeweler CAD quality without a scan mesh

---

## Quick reference

| Task | Command / place |
|------|-----------------|
| Open site locally | `cd KrownFrontz && python3 -m http.server 8080` |
| Run Blender | `blender` |
| Refresh Cursor↔Blender | Settings → MCP → blender |
| Rebuild product stills | See batch commands above |
| Sync images to shop | `python scripts/sync_images.py` |
