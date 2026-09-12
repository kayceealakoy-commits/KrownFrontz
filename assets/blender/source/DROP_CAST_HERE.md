# Drop your upper+lower dental cast here

## Current cast (in use)
- `upper_cast.stl` + `lower_cast.stl` — from CGTrader “Upper and Lower jaws modeled perfectly”
- See `FULL_ARCH_ATTRIBUTION.md`

Rebuild after replacing files:

```bash
BLENDER=/path/to/blender
$BLENDER --background --python scripts/blender_build_dental_base.py
$BLENDER --background assets/blender/dental_arch_base.blend \
  --python scripts/blender_render_previews.py -- --all
python scripts/sync_images.py --products-only
```

## Accepted formats for a new drop
`.obj` / `.stl` / `.ply` — name as `upper_cast.stl` + `lower_cast.stl`
