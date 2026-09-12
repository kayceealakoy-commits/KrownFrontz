Product preview images
========================

Photo drop workflow (recommended)
---------------------------------

1. Save your photo using the product id as the filename, for example:

     assets/products/diamond-canine.webp

   Supported formats: .webp, .jpg, .jpeg, .png

2. Sync into the catalog:

     python scripts/sync_images.py

   Or: npm run sync-images

3. Refresh the shop or product page in your browser.



Priority drop list (biggest quality jump first)
-----------------------------------------------

Drop these first when you have photos ready — kits and top styles lift the
whole shop the most:

  1. impression-kit-uk
  2. impression-kit-international
  3. canine / central / lateral (basics)
  4. One photo each for bar, window, heart, star, vampire (any tooth count)
  5. Remaining catalog ids (see main.js PRODUCTS)

Kit files use the same naming and sync as styles:

     assets/products/impression-kit-uk.webp
     assets/products/impression-kit-international.webp



Pillow previews (optional, no Blender)
--------------------------------------

1. Generate stylized arch renders:

     python scripts/generate_product_previews.py --style window

2. Sync (same command as above):

     python scripts/sync_images.py



manifest.json is updated automatically from files on disk.
imageAlt in main.js is left unchanged.



Optional Blender pipeline
-------------------------

Product stills use the Artec "Plaster cast of teeth" mesh (CC BY).
See assets/blender/source/ATTRIBUTION.md for credit requirements.

Download the cast (if missing), build the dental base, then batch-render:

     python scripts/download_artec_cast.py
     BLENDER=/path/to/blender
     $BLENDER --background --python scripts/blender_build_dental_base.py
     $BLENDER --background assets/blender/dental_arch_base.blend \
       --python scripts/blender_render_previews.py -- --all

Single product:

     $BLENDER --background assets/blender/dental_arch_base.blend \
       --python scripts/blender_render_previews.py -- --id canine

Then run sync-images (also updates main.js image fields).



Legacy command
--------------

wire_product_images.py still works and calls the same product sync.
