# Firefox (addons.mozilla.org) submission

Everything needed to upload KhmerLens to addons.mozilla.org (AMO).

## 1. Build

```bash
./package.sh
```

This writes both builds. Firefox files:

- `dist/KhmerLens-firefox-v<version>.zip`: the file you upload
- `dist/firefox/`: the same thing unpacked, for testing

The Firefox manifest is generated from `extension/manifest.json` by `firefox-manifest.py`. Don't edit a Firefox manifest by hand. Change the Chrome one and rebuild.

## 2. Test in Firefox before uploading

```bash
npx web-ext run --source-dir dist/firefox
```

This opens a clean Firefox profile with the extension installed. Check:

- [ ] Toolbar popup opens and the switch turns KhmerLens on (badge shows ON)
- [ ] Hovering Khmer text shows the popup with a definition (try a Khmer Wikipedia page)
- [ ] Alt+K toggles it on and off
- [ ] Audio button plays for a word that has a recording
- [ ] Paste panel opens and works
- [ ] Options page opens and settings save
- [ ] Turning on kheng.info lookup asks for permission, then a lookup works
- [ ] Navigating to a new page turns it off again (expected, same as Chrome)

Optional: lint with the same checks AMO runs on upload (last result: 0 errors, 0 warnings):

```bash
npx web-ext lint --source-dir dist/firefox
```

## 3. Upload

1. Sign in at https://addons.mozilla.org/developers/ (free Firefox account).
2. Submit a New Add-on → **On this site** (listed publicly).
3. Upload `dist/KhmerLens-firefox-v<version>.zip`. Compatibility: Firefox only (leave Android unticked unless you test it there).
4. **Source code question:** answer **No**. The code isn't minified or bundled. `data/dictionary.json` is data, not code. If a reviewer asks how it's built, point them to `data-pipeline/` in the repo.
5. Fill in the listing (section 4), then submit. The add-on usually goes live right after automated checks. A human review can come later.

The add-on ID is `khmerlens@khmeralphabet.com` (set in `firefox-manifest.py`). It's permanent after the first upload. Never change it, or Firefox treats the next version as a different add-on.

## 4. Listing text

**Name:** KhmerLens - Khmer Popup Dictionary

**Add-on URL slug:** khmerlens

**Summary** (max 250 characters):

```
Hover over Khmer text on any webpage to see English definitions, romanization and pronunciation. Works offline with a built-in 21,000-word dictionary.
```

**Description:** reuse "Full Description" from `docs/store-listing.md`, with these changes:

- "popup dictionary for Chrome" → "popup dictionary for Firefox"
- Replace the "Zero tracking" bullet and the Privacy section's first bullet, which say "no network requests". That isn't quite true because of the two optional features. Use:
  > No analytics, no tracking. Dictionary lookups happen offline. The only network requests come from two optional features you switch on yourself: kheng.info lookup and Anki export (which only talks to Anki on your own computer).

**Categories:** Language Support, Search Tools

**Tags:** khmer, cambodian, dictionary, language learning, translation

**Support site / email:** your khmeralphabet site and contact email

**License:** you pick this on AMO. The extension code has no license in the repo yet. "All Rights Reserved" is fine if you don't want to open-source it. The bundled dictionary data stays CC BY-SA 4.0 either way (see `ATTRIBUTION.md`).

**Privacy policy:** paste `docs/privacy-policy.md`.

**Screenshots:** `docs/store-assets/screenshot-1.png` to `screenshot-3.png`. AMO accepts the same files. The Chrome promo tile isn't used.

**Icon:** taken from the extension automatically.

## 5. Notes to reviewer

Paste this in the "Notes to Reviewer" box:

```
KhmerLens is a Khmer-English popup dictionary. It uses activeTab + scripting only: nothing is injected until the user clicks the toolbar button or presses Alt+K on a tab.

All dictionary data is bundled (data/dictionary.json, generated from Wiktionary and SIL data; build scripts are in the project's data-pipeline folder). No analytics, no remote code.

Optional host permissions, requested only when the user turns the feature on in Options:
- http://127.0.0.1/* and http://localhost/*: AnkiConnect, the local Anki desktop add-on, to export a word to the user's own Anki deck.
- https://kheng.info/*: fetches the definition of a single word the user clicks on when the bundled dictionary has none.

To test: open any page with Khmer text (e.g. https://km.wikipedia.org), click the toolbar icon, flip the switch on, hover over Khmer words.
```

## 6. Data collection declaration

The manifest declares no data collection (`data_collection_permissions: none`). That's correct for the offline dictionary and for Anki (which stays on your machine).

One grey area: the optional kheng.info lookup sends the clicked word to a third-party site. It only happens when the user clicks, and it's explained in the reviewer notes. If a reviewer asks for a declaration anyway, the fix is to declare `websiteContent` as optional data collection and request it when the user enables the feature. That's a small code change.

## 7. Updates

1. Bump `version` in `extension/manifest.json`.
2. Run `./package.sh`.
3. On AMO: your add-on → Upload New Version → the new Firefox zip.
