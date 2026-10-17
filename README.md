# Field Study — Architecture 01 (fresh rebuild)

This is a new static website built from the supplied `WHITE MODEL(1).fbx` model. All site files are at the repository root; the model uses the repository-safe filename `house-model.fbx`.

## Deploy
1. Create a new GitHub repository. Do not initialize it with another README or files.
2. Upload the *contents* of this folder to the repository root (not the ZIP and not the containing folder).
3. In Settings → Pages, select **Deploy from a branch**, choose `main` and `/ (root)`.
4. Open the HTTPS GitHub Pages URL in Safari on your iPhone.

## AR path
- iPhone/iPad Safari: the page uses a direct static `rel="ar"` link to `assets/ar/architecture-exterior.usdz` or `assets/ar/architecture-interior.usdz`. These files are prepared in the ZIP; no in-browser USDZ export or simulated anchor click is used.
- Other browsers: when immersive WebXR AR with hit-test is supported, a WebXR surface placement button is shown.
- In-app iOS browsers can block/alter Quick Look. Use Share → Open in Safari if the page is opened inside WhatsApp or another app.

## Asset details
- `house-model.fbx`: exact uploaded ASCII FBX, renamed only to remove spaces/parentheses.
- `assets/ar/*.usdz`: static Quick Look assets generated from the same model. The visible `Architecture` prim is a direct child of the default anchored `Root` prim; both files are ZIP_STORED as required for USDZ packaging. Exterior and interior are separate assets so Quick Look doesn't require JavaScript to change the geometry after launch.
- Three.js modules and fonts load from their public CDNs, so the 3D viewer requires an internet connection. The model and AR files are local to the site.

Note: Apple's native Quick Look view takes over the screen during AR, so page controls do not remain over the native camera view. The page's color and light controls affect the web 3D preview; the two static AR assets are white exterior/interior models.
