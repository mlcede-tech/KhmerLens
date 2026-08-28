# KhmerLens

A Chrome extension (Manifest V3) that displays instant English definitions when hovering over Khmer text on any webpage.

## Overview

KhmerLens solves the problem of reading Khmer text on the web without breaking your flow. Hover over any Khmer word, and a popup appears with:

- The Khmer word
- Romanization (Wiktionary phonetic)
- Part of speech (noun, verb, adjective, etc.)
- English definitions
- Frequency badge (common / frequent, based on the SIL frequency list)
- Pronunciation audio where available (bundled native recordings, or the system's Khmer text-to-speech voice)
- Optional one-key export of the word into an existing Anki deck (via the local AnkiConnect add-on)

The extension works fully offline with no data collection. All lookups are performed locally using a compiled dictionary of 21,514 Khmer words. The optional Anki integration talks only to the Anki app running on your own machine.

## Installation

### Quick Load (Development)

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `extension/` folder from your KhmerLens project
5. Click the toolbar icon to toggle the extension ON/OFF per tab (badge shows "ON" when active)

**Requirements:** Chrome 105 or later

### From Source

Clone the repository:
```bash
git clone <repo-url>
cd Khmer\ Lens/extension
```

Follow the "Quick Load" steps above, using the cloned `extension/` folder.

## Usage

### Basic Usage

1. Click the toolbar icon (or press Alt+K) to activate KhmerLens on the current tab — the badge shows "ON"
2. Hover over any Khmer text on the page
3. A popup appears with the word, definitions, and metadata
4. Move the cursor away or press Esc to dismiss

KhmerLens uses Chrome's `activeTab` model: it requests no host permissions and only reads a page after you activate it there. Because that access ends when you navigate, KhmerLens turns off on the new page — click the icon (or Alt+K) again to re-activate.

### Keyboard Shortcuts

| Key | Action |
| --- | --- |
| **Alt+K** | Toggle KhmerLens on the current tab (configurable at `chrome://extensions/shortcuts`) |
| **Shift** | Cycle to next/shorter match (while popup open) |
| **c** | Copy word + definition to clipboard |
| **n** | Jump to next Khmer word on page |
| **s** | Play pronunciation (bundled recording, or system Khmer voice if installed) |
| **a** | Add the word to Anki (when Anki integration is enabled) |
| **Esc** | Hide popup |

## Options

Access settings by right-clicking the extension icon → **Options**:

- **Theme:** Light, Dark, or Auto (follows system)
- **Font Size:** Adjust popup text size
- **Romanization:** Show/hide romanization (Wiktionary phonetic scheme)
- **On-page Highlight:** Highlight Khmer text when hovering
- **Anki integration:** Enable/disable, AnkiConnect address, target deck, note type, per-field mapping (word / romanization / definition / part of speech), and tags

### Audio pronunciation

The popup shows a 🔊 button when audio is available for the hovered word:

- **Bundled recordings** — freely licensed (CC BY-SA 4.0) native-speaker recordings from Wikimedia Commons and Lingua Libre, shipped inside the extension (works offline). Coverage is currently small (17 words) because few free Khmer recordings exist; rerun `data-pipeline/fetch_audio.py` to pick up new ones.
- **System Khmer voice** — if your OS provides a Khmer text-to-speech voice, every word becomes speakable via the same button.

### Anki integration

Adds the hovered word to an existing deck in the Anki desktop app, using the [AnkiConnect](https://ankiweb.net/shared/info/2055492159) add-on's local API (`http://127.0.0.1:8765` — nothing leaves your machine):

1. In Anki: Tools → Add-ons → Get Add-ons → code `2055492159`, restart Anki.
2. In KhmerLens options: enable **Add words to Anki** (Chrome asks once for permission to reach `127.0.0.1`), click **Connect**, then pick your deck, note type, and how fields are filled.
3. Hover a word and press **A** (or click ★ Anki). Duplicates within the deck are detected and skipped.

## Dictionary

The extension ships with a compiled dictionary (`extension/data/dictionary.json`, ~1.8 MB) containing:

- **9,420 words with English definitions** from Wiktionary (via kaikki.org)
- **12,094 frequency-list words** for segmentation support (no definitions) from SIL khmerlbdict seafreq.txt

**Total: 21,514 lookup words**

### How Segmentation Works

Khmer text has no spaces. The extension combines:

1. Chrome's `Intl.Segmenter` (ICU-based)
2. Longest-match dictionary lookup
3. Grapheme cluster and zero-width space awareness

This allows accurate word identification even when words run together.

## Rebuilding the Dictionary

Rebuild the dictionary if you need to update word lists or test changes:

```bash
cd data-pipeline
./download.sh
python3 build_dictionary.py
```

**Requirements:** Python 3.10 or later (no third-party dependencies)

This downloads fresh Wiktionary data from kaikki.org and rebuilds `extension/data/dictionary.json`.

## Repository Layout

```
Khmer Lens/
├── README.md                    # This file
├── ATTRIBUTION.md               # Data sources and licenses
├── docs/
│   ├── store-listing.md        # Chrome Web Store listing
│   └── privacy-policy.md       # Privacy policy
├── extension/                   # Chrome extension (load unpacked)
│   ├── manifest.json
│   ├── background.js            # Service worker (per-tab toggle, badge)
│   ├── lib/                     # khmer.js, dictionary.js, popup.js (pure logic)
│   ├── content/                 # content.js + popup.css (hover UI)
│   ├── options/                 # Settings page
│   ├── icons/
│   └── data/
│       └── dictionary.json      # Compiled dictionary (~1.8 MB)
├── data-pipeline/               # Dictionary build scripts
│   ├── download.sh
│   ├── build_dictionary.py
│   └── raw/                     # downloaded sources (not redistributed)
└── tests/                       # node --test suite + browser-verify.js
    ├── *.test.js
    ├── browser-verify.js        # Playwright extension verification
    └── fixtures/                # Khmer corpus + saved test pages
```

## Testing

Run the test suite:

```bash
cd tests
node --test
```

**Requirements:** Node 18 or later

## Privacy & Data

KhmerLens collects **no data whatsoever**:

- No analytics tracking
- No network requests at runtime
- All word lookups performed locally
- Settings stored locally (or synced via Chrome sync if enabled)
- External links (kheng.info) only opened on explicit user click

See [privacy-policy.md](docs/privacy-policy.md) for details.

## Inspiration

KhmerLens was inspired by [Zhongwen](https://github.com/cschiller/zhongwen), a similar popup dictionary for Chinese text. No code was copied.

## License & Attribution

The compiled dictionary is a derived work of Wiktionary content and is redistributable under **CC BY-SA 4.0**.

Dictionary sources:
- Wiktionary (CC BY-SA 4.0)
- SIL khmerlbdict seafreq.txt (MIT License, © 2015 SIL NRSI)

See [ATTRIBUTION.md](ATTRIBUTION.md) for complete attribution and license text.

## Contributing

Contributions are welcome. Before submitting a pull request:

1. Run tests: `cd tests && node --test`
2. Rebuild the dictionary if you modified word lists
3. Test the extension in Chrome with `Load unpacked`

## Support

For issues, feature requests, or questions, please open an issue in the repository.
