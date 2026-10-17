# Micro Library — Architecture / 01

A fresh static architecture viewer using the supplied FBX model. Upload the contents of this folder to the root of a new GitHub Pages repository.

## Files
- `index.html`, `app.js`, `styles.css`
- `house-model.fbx`
- `assets/ar/architecture-exterior.usdz`
- `assets/ar/architecture-interior.usdz`
- `.nojekyll`
- `assets/images/ar-launch.png` (kept for convenience; the page now embeds this image in the HTML so the AR card itself cannot show a broken image if this path is missing)

## iPhone AR
1. Open the published HTTPS page directly in Safari for best compatibility (avoid opening it in the WhatsApp in-app browser).
2. Tap the **VIEW IN YOUR SPACE** AR card.
3. iOS may show a native **View in AR?** confirmation. Tap **View in AR** in that iPhone prompt to continue into Quick Look.
4. In Quick Look, choose the AR / placement view and move the iPhone to scan the surface.

The native iOS confirmation prompt is expected; it is not an error. The link opens a static, hosted USDZ model. Both USDZ archives have been repackaged with required 64-byte file-data alignment; do not open or recompress these files with a normal ZIP tool before uploading them.

## Interactions
- Orbit and zoom the 3D model.
- Reveal/close the roof to inspect the interior in the web viewer.
- Adjust time of day and model colour.
- Reset the view and appearance.
- iPhone uses Apple AR Quick Look. Supported Android browsers use WebXR when available.

## Deploy
Upload all files and the entire `assets` folder to repository root. Enable GitHub Pages from `main` / root. Keep the two `.usdz` files and `house-model.fbx` with their exact names.


## If the iPhone still stays in 3D mode
If Quick Look opens the object but its AR placement control is disabled, open the published page in the Safari app (not WhatsApp or another app’s embedded browser), close the old preview, reload the page and test again. The page can open Quick Look from an embedded browser while that browser still fails to hand off AR placement.
