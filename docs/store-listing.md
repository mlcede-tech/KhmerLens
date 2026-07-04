# Chrome Web Store Listing

This document contains the text and metadata for the KhmerLens Chrome Web Store listing.

---

## Store Metadata

**Name:** KhmerLens

**Category:** Education / Language Tools

**Short Description (Max 132 characters):**

```
Instant Khmer-to-English dictionary popup. Hover over any Khmer text on any webpage for instant definitions.
```

Character count: 110/132 ✓

---

## Full Description

Instant Khmer-to-English popup dictionary for Chrome. Perfect for language learners, translators, and Khmer readers.

**What does KhmerLens do?**

Hover over any Khmer word on any webpage, and a popup appears instantly with:
- The Khmer word
- Romanization (Wiktionary phonetic)
- Part of speech (noun, verb, adjective, etc.)
- English definitions
- Frequency badge (common, medium, rare)

**Key Features:**

- **Instant lookups** — No clicking, no submitting. Just hover over Khmer text.
- **Complete offline** — All 21,514 words are built in. No internet required, no data sent anywhere.
- **Zero tracking** — We collect zero data. No analytics, no network requests, no tracking.
- **Smart segmentation** — Khmer has no spaces. KhmerLens uses dictionary-aware segmentation to find words accurately, even in long strings.
- **Customizable** — Choose light/dark theme, adjust font size, toggle romanization, and toggle on-page highlighting.
- **Keyboard shortcuts** — Shift to cycle matches, c to copy, n to jump to next word, Esc to hide.

**Getting Started**

1. Click the toolbar icon to toggle on/off (badge shows "ON" when active)
2. Hover over any Khmer text
3. Read the definition in the popup
4. Use keyboard shortcuts (Shift, c, n, Esc) for faster interaction

**Dictionary Stats**

- **21,514 total words**
  - 9,420 words with full English definitions (from Wiktionary)
  - 12,094 frequency-list words for accurate segmentation (from SIL khmerlbdict)
- **~1.8 MB dictionary** compiled and stored locally

**Permissions**

- **storage** — Stores your settings (theme, font size, etc.) locally
- **clipboardWrite** — Allows you to copy word + definition with the 'c' shortcut
- **Read all webpage content** — Detects Khmer text and hovering for popups

**Privacy**

- We collect **zero data** — no analytics, no tracking, no network requests
- Settings are stored locally on your device
- External links (kheng.info) open only when you click them
- All dictionary lookups happen offline, locally

**Inspired by Zhongwen** (a Chinese popup dictionary), but built from scratch with no code reused.

**License**

Dictionary content is licensed under CC BY-SA 4.0, combining data from Wiktionary and SIL International.

See [Attribution](../ATTRIBUTION.md) for complete source information.

---

## Permission Justifications

### storage

**Purpose:** Save user preferences (theme, font size, romanization toggle, etc.)

**What we store:**
- User settings (light/dark/auto theme)
- Font size preference
- Romanization display toggle
- On-page highlight toggle

**What we do NOT store:**
- Browsing history
- Words you've looked up
- Personal data

### clipboardWrite

**Purpose:** Copy word + definition to clipboard with the 'c' keyboard shortcut

**When used:** Only when the user explicitly presses 'c' while a popup is showing

**What we copy:** The Khmer word + English definition (nothing more)

### Manifest Host Permissions (all_urls / <all_urls>)

**Purpose:** Detect Khmer text on any webpage and show popups

**Why all URLs are needed:**
- Khmer text appears on many different websites
- We need to inject our content script on every page to detect Khmer characters
- All lookups are performed locally (no data sent to any server)

**What we do with page content:**
- Read text only to detect Khmer characters
- Show popups when you hover
- Never transmit page content or browsing data

---

## Screenshots (Placeholder Paths)

Include the following screenshots in your Web Store listing:

1. **screenshot-1.png** — Main popup showing word definition
2. **screenshot-2.png** — Options page showing customization choices
3. **screenshot-3.png** — Keyboard shortcuts and usage tips

*(Actual images to be generated separately)*

---

## Additional Links

- **Repository:** [GitHub link to be added]
- **Report a bug:** [Issue tracker link to be added]
- **Support email:** [Support contact to be added]

---

## Store Publishing Checklist

- [ ] Extension tested in Chrome 105+
- [ ] Icon (128x128 px) prepared
- [ ] Screenshots (1280x800 px minimum) prepared
- [ ] Privacy policy reviewed and accurate
- [ ] All permissions justified and necessary
- [ ] Store description (full and short) proofread
- [ ] Category selected (Education / Language Tools)
- [ ] Supported languages listed
- [ ] Version number set
- [ ] Terms of service and privacy policy links verified
