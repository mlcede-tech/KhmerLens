# Chrome Web Store Listing

This document contains the text and metadata for the KhmerLens Chrome Web Store listing.

---

## Store Metadata

**Name:** KhmerLens

**Category:** Education / Language Tools

**Short Description (Max 132 characters):**

```
Hover any Khmer word for an instant English definition, audio, and Anki cards. Works offline. No tracking.
```

Character count: 106/132 ✓

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

- **Instant lookups** - No clicking, no submitting. Just hover over Khmer text.
- **Complete offline** - All 21,514 words are built in. No internet required by default, and nothing is sent anywhere.
- **Zero tracking** - We collect zero data. No analytics, no tracking.
- **Smart segmentation** - Khmer has no spaces. KhmerLens uses dictionary-aware segmentation to find words accurately, even in long strings.
- **Pronunciation** - Press S or click the speaker button to hear a word: bundled native-speaker recordings (offline), or your system's Khmer voice if you have one.
- **Anki flashcards (optional)** - Press A or click the Anki button to save a word straight into your Anki deck via the AnkiConnect add-on. Choose the deck, note type, field mapping and tags. Duplicates are skipped, and everything stays on your computer.
- **Look up missing words on kheng.info (optional, off by default)** - For words with no bundled definition, fetch one on demand with a single click (or press K) and see it right in the popup.
- **Paste panel** - Can't hover text in Google Docs, PDFs or canvas editors? Turn on the paste panel, paste the Khmer text into it, and hover as usual.
- **Freeze and navigate** - Press F to freeze the popup while you read, N to jump to the next Khmer word, B to go back to the previous one.
- **Clickable actions** - Copy, next, alternate matches, pronunciation and Anki are all buttons in the popup, not just shortcuts.
- **Responsive popup** - The popup stays out of the way of the word you are reading and stays put while you move your cursor onto it.
- **Customizable** - Choose light/dark/auto theme, adjust font size, toggle romanization, and toggle on-page highlighting from a tabbed options page with a Quick Start guide.
- **Keyboard shortcuts** - Alt+K to toggle on the current tab, Shift to cycle matches, C to copy, N next word, B previous word, S speak, A add to Anki, K kheng.info lookup, F freeze, Esc to hide.

**Getting Started**

1. Click the toolbar icon to open the popup, then flip the switch ON (or press Alt+K, which toggles the tab directly) - badge shows "ON" when active
2. Hover over any Khmer text
3. Read the definition in the popup
4. Use keyboard shortcuts (Shift, C, N, B, S, A, K, F, Esc) or the popup buttons for faster interaction
5. Open Options (right-click the icon) to set up Anki, pronunciation and appearance

**Dictionary Stats**

- **21,514 total words**
  - 9,420 words with full English definitions (from Wiktionary)
  - 12,094 frequency-list words for accurate segmentation (from SIL khmerlbdict)
- **~1.8 MB dictionary** compiled and stored locally

**Permissions**

- **storage** - Stores your settings (theme, font size, etc.) locally
- **clipboardWrite** - Allows you to copy word + definition with the C shortcut or button
- **Optional permissions (asked only if you enable them)** - access to `127.0.0.1` for the Anki integration, and to `kheng.info` for live lookups
- **activeTab + scripting** - Detects Khmer text and hovering for popups, but only on tabs you explicitly activate (toolbar click or Alt+K); no broad "read and change all your data on all websites" access

**Privacy**

- We collect **zero data** - no analytics, no tracking, and no network requests unless you turn on an optional feature
- Settings are stored locally on your device
- External links (kheng.info) open only when you click them
- All dictionary lookups happen offline, locally
- **Optional live lookup (off by default):** you can turn on an opt-in feature that fetches a definition from kheng.info for a word that has no bundled definition. It requests a permission when you enable it, and sends only that single word, only when you click the button (or press K)

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

### activeTab

**Purpose:** Read the text on the current page so KhmerLens can detect the Khmer word under the cursor and show its definition.

**Why activeTab (and not broad host access):** KhmerLens requests **no host permissions** and does **not** run on any site automatically. It only gains access to a page when you explicitly activate it - by opening the popup and flipping the switch, or pressing Alt+K, on that tab. The access is temporary and is revoked when you navigate away.

**What we do with page content:**
- Read text only to detect Khmer characters under the cursor
- Show a popup when you hover
- Never transmit page content or browsing data

### scripting

**Purpose:** Inject the KhmerLens content script into the tab at the moment you activate it (the mechanism that pairs with activeTab).

**When used:** Only after you turn KhmerLens on via the popup switch or press Alt+K on a tab. Nothing is injected until then.

---

## Screenshots

Provided in `docs/store-assets/` (captures of the live extension, exact store dimensions):

1. **screenshot-1.png** (1280×800) - popup on a Khmer Wikipedia article
2. **screenshot-2.png** (1280×800) - popup on a Khmer news page, alternates cycle (dark)
3. **screenshot-3.png** (1280×800) - options page with live preview
4. **promo-tile.png** (440×280) - small promo tile

Store icon: `extension/icons/icon128.png`.

---

## Additional Links

- **Repository:** https://github.com/mlcede-tech/KhmerLens
- **Report a bug:** https://github.com/mlcede-tech/KhmerLens/issues

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
