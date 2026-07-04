# Store assets

Chrome Web Store listing images for KhmerLens. Regenerate any time with:

```bash
cd tests && node gen-store-assets.js      # requires: npm install (playwright)
```

The script downscales 2× captures to the exact dimensions the store requires.

| File | Dimensions | Store slot |
| --- | --- | --- |
| `screenshot-1.png` | 1280×800 | Screenshot — popup on a Khmer Wikipedia article (light) |
| `screenshot-2.png` | 1280×800 | Screenshot — popup on a Khmer news page, alternates cycle (dark) |
| `screenshot-3.png` | 1280×800 | Screenshot — options page with live preview |
| `promo-tile.png` | 440×280 | Small promo tile |
| `promo-tile.html` | — | Source for the promo tile (edit, then regenerate) |

## Upload checklist

- **Store icon**: use `extension/icons/icon128.png` (128×128).
- **Screenshots**: upload 1–5 of the `screenshot-*.png` files. At least one is required.
- **Small promo tile**: `promo-tile.png` (optional but recommended).
- **Marquee promo (1400×560)**: not provided; optional, only needed for featured placement.

All screenshots are captures of the real extension running in Chromium via
Playwright — no mockups. See `docs/store-listing.md` for the listing copy and
permission justifications, and `docs/privacy-policy.md` for the policy text
(host it at a public URL and paste that URL into the dashboard).
