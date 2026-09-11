Client look photos
==================

Photo drop workflow
-------------------
1. Drop JPG, PNG, or WebP photos into this folder, for example:
     look-01.jpg
     look-02.webp
2. Optional: add a sidecar alt-text file next to each image:
     look-01.alt.txt
   (one line describing the photo for accessibility)
3. Sync into the homepage carousel:
     python scripts/sync_images.py
   Or: npm run sync-images
4. Refresh the homepage.

Files are sorted by filename (A to Z) for carousel order.
Existing alt text in main.js is preserved when the filename matches.
New photos without a sidecar use: "Client wearing custom Krown Frontz grillz"
