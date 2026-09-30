# Spectra icon

A monochrome spiral galaxy with a subtle S silhouette. Generated with the built-in
`imagegen` tool; the original transparent image is preserved in `spectra.png`.

- `spectra.png`: 1254 × 1254 transparent PNG master.
- `spectra-icon.png`: 256 × 256 transparent PNG for the UI alpha mask.
- `spectra-extension.svg` / `spectra-extension.png`: a neutral tile containing the
  unchanged mark, with a light background so the extension-list icon stays visible
  in both editor themes. The SVG layout is rasterized to PNG for the manifest.
- `spectra-light.svg` / `spectra-dark.svg`: black / white tab icons. These are
  self-contained SVG wrappers around a 64px raster alpha mask, not vector artwork.
- `../public/spectra-favicon.svg`: the same mask with light/dark browser theme support.
- `../public/spectra.ico`: transparent ICO containing 16, 24, 32, 48, 64, 128 and 256px
  PNG frames. The mark is black; use the adaptive favicon on dark browser chrome.
- `spectra-preview.png`: presentation of the mark on light/dark backgrounds and at
  small icon sizes.

PNG sizes were exported with macOS `sips`; the ICO packages those PNGs without
additional dependencies. The UI uses the image as an alpha mask with `currentColor`
so it follows the editor theme without changing its silhouette or CSP.

## Generation prompt

```text
Use case: logo-brand.
Asset type: final standalone application icon for Spectra, a creative design tool inside the Cursor editor.
Primary request: a beautifully crafted, distinctive monochrome cosmic symbol. A compact spiral galaxy / orbital celestial form which subtly reads as an S, designed with the restraint and optical precision of a premium independent software brand.
Subject and geometry: two broad, elegantly tapered interlocking orbital crescents rotating around a small open negative-space nucleus, with a graceful diagonal movement from lower left to upper right. The upper and lower arms suggest the letter S without literally typesetting a letter. A few carefully controlled curves, bold ink silhouette, generous open negative spaces, balanced visual weight. The overall silhouette is compact and close to circular, not a long thin swoosh. It should read as a sophisticated cosmic sigil, not a generic planet illustration.
Style: exceptionally clean flat vector-like logo, custom geometric mark with smooth deliberate Bézier-like contours and crisp edges. One single solid ink color: pure black (#000000); transparent everywhere else. No interior gray, no shading, no texture, no gradient. Anti-aliased boundary is fine.
Composition: one centered icon on a square 1024 × 1024 transparent canvas, occupying approximately 78–82% of both width and height, with clear safe margins. Sturdy shapes and open channels that stay legible at 16, 24, and 32 pixels.
Constraints: icon only; NO text or wordmark, no typography, no surrounding app tile, no background, no multiple concepts, no mockup, no tiny stars or detached decorative dots, no common AI sparkle, no rocket, no atom symbol, no 3D bevel, no lighting or drop shadow, no watermark. Output actual transparency. Take care over the contour and optical balance; the result should feel designed, memorable, and finished.
```
