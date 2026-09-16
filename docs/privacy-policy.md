# Privacy Policy

**KhmerLens** — Last updated: July 12, 2026

## Overview

KhmerLens is a Khmer-to-English dictionary popup extension for Chrome. This privacy policy explains what data we collect, how we use it, and your rights.

**The short version:** We collect **zero data**. Everything happens locally on your device.

---

## What We Do NOT Collect

KhmerLens **does not collect, transmit, or share any of the following:**

- Browsing history
- Pages you visit
- Words you look up
- Search queries
- Personal information
- Location data
- Device identifiers
- Cookies or tracking pixels
- Analytics or usage metrics

We have **zero analytics, zero tracking, and zero external requests** at runtime.

---

## What We Store Locally

KhmerLens stores the following data **on your device only** using Chrome's `storage` API:

### User Settings (Local Storage)

Your preferences are saved to your device:
- Theme selection (light, dark, auto)
- Font size preference
- Romanization display toggle (on/off)
- On-page highlight toggle (on/off)
- Anki integration settings (on/off, AnkiConnect address, deck, note type, field mapping, tags)

**How long:** Until you uninstall the extension or manually clear them

**Accessible to:** Only this extension; other extensions and websites cannot access your settings

**Synced data:** If you have Chrome sync enabled, your settings may sync across your Chrome-logged-in devices (this is optional and controlled by Chrome's sync settings)

### Dictionary Data

KhmerLens includes a compiled dictionary (~1.8 MB) with 21,514 Khmer words and English definitions:
- Built into the extension (no network download)
- Stored locally when you install the extension
- All word lookups performed locally, never transmitted

### Pronunciation Audio

Pronunciation recordings (freely licensed, from Wikimedia Commons / Lingua Libre contributors) are bundled inside the extension and played locally. If no recording exists, KhmerLens can use your operating system's Khmer text-to-speech voice, which also runs locally. No audio request leaves your device.

---

## What We DO NOT Transmit

When you hover over Khmer text:
1. We detect the word locally
2. We look it up in the local dictionary
3. We show a popup on your device
4. **Nothing is sent to any server**

There are two exceptions, both user-initiated:

- If you explicitly click an external link (e.g., a link to kheng.info in the popup), you are navigating to an external website under your control.
- If you have turned on the optional **"Look up missing definitions on kheng.info"** feature (off by default) and click the **Look up on kheng.info** button — or press the **K** key — for a word that has no bundled English definition, KhmerLens sends **only that single Khmer word** to kheng.info to fetch its definition. No page content, browsing history, or personal data is included. The fetched result is cached briefly on your device. See [External Lookup](#optional-external-lookup-khenginfo) below.

---

## External Links

KhmerLens may include optional links to external resources:

- **kheng.info** — External Khmer resource (opened only when you explicitly click)
- Links are **user-initiated only** — we do not click them on your behalf
- When you click an external link, you are subject to that site's privacy policy

## Optional External Lookup (kheng.info)

KhmerLens includes an **opt-in** feature, **off by default**, called **"Look up missing definitions on kheng.info"**:

- **Opt-in and permission-gated:** It does nothing unless you enable it in the options page, which requests an optional host permission for `https://kheng.info/*`. If you never enable it, this permission is never requested and no request is ever made.
- **On demand, one word at a time:** Only for a word that has **no bundled English definition**, and only when you click the **Look up on kheng.info** button or press the **K** key, KhmerLens sends **that single Khmer word** to kheng.info to fetch its definition, which is then shown inline (and can fill an Anki card).
- **Sends only the word:** No page content, browsing history, personal data, or other information is transmitted — just the one Khmer word you asked to look up.
- **Cached locally:** Fetched definitions are cached briefly on your device to avoid repeat requests; nothing is bundled or redistributed.
- When this feature is off, behavior is unchanged and kheng.info is reached only via the user-clicked external link above.

---

## Permissions Explained

### `storage`

Stores your extension settings locally. No data is sent to any server unless you enable Chrome sync (which is your choice, controlled by Chrome settings).

### `clipboardWrite`

Allows you to copy a word and its definition to your clipboard using the 'c' keyboard shortcut. This is performed locally; the clipboard is not accessed by any external service.

### `activeTab` and `scripting`

KhmerLens requests **no host permissions** and does not run on any website automatically. It reads a page only when you explicitly activate it on that tab (toolbar icon or Alt+K), using Chrome's `activeTab` permission; `scripting` is the mechanism that loads KhmerLens into the tab at that moment. The access is temporary and is revoked when you navigate away.

**Important:** When active, the extension reads text solely to identify the Khmer word under your cursor. This is performed entirely locally. Page content is **never transmitted** to any server. The extension operates offline.

### Optional: `http://127.0.0.1/*` and `http://localhost/*` (Anki integration)

Requested **only if you enable the Anki integration** in the options page. It lets KhmerLens talk to the AnkiConnect add-on of the Anki desktop app **running on your own computer** (loopback address — this traffic never leaves your device). When you press **A** or click **★ Anki** on a word, that word, its romanization, and its definition are sent to your local Anki app and nowhere else. If you never enable the integration, this permission is never requested.

### Optional: `https://kheng.info/*` (external lookup)

Requested **only if you enable the "Look up missing definitions on kheng.info" feature** in the options page. It lets KhmerLens fetch a definition from kheng.info for a word that has no bundled English definition. A request is made only when you click the **Look up on kheng.info** button or press **K**, and it contains **only that single Khmer word** — no page content, browsing history, or personal data. Results are cached briefly on your device. If you never enable the feature, this permission is never requested.

---

## Changes to Settings

You can manage the extension's permissions at any time:

1. Open Chrome → **Settings** → **Extensions** → **KhmerLens**
2. Toggle permissions on/off under "Permissions"
3. Uninstall if desired

---

## Children's Privacy

KhmerLens does not knowingly collect information from children under 13. The extension is suitable for all ages and collects no personal data.

---

## Third-Party Services

KhmerLens **does not use any third-party analytics, tracking, or data collection services.** The extension runs entirely locally with no external dependencies.

---

## Data Retention

KhmerLens stores user settings locally until:
- You uninstall the extension
- You manually clear the settings via Chrome settings
- You clear all data for this extension

Settings stored via Chrome sync will follow your Chrome account's retention policies.

---

## Your Rights

You have the right to:
- **Access** your settings (visible in the Options page)
- **Modify** your settings at any time
- **Delete** your settings by uninstalling the extension
- **Opt out** of Chrome sync if you don't want settings synced across devices

---

## Contact

For questions about this privacy policy or KhmerLens, please open an issue in the project repository.

---

## Changes to This Policy

We may update this privacy policy as needed. If we make material changes, we will notify you via an updated extension listing or announcement in the repository.

---

## Summary

| Item | Our Practice |
|------|--------------|
| Data collection | None |
| Tracking | None |
| Analytics | None |
| Network requests | None (except optional user-clicked external links; the optional Anki integration, which talks only to the Anki app on your own computer; and the optional kheng.info lookup, which — when you enable it and click — sends only the single hovered word) |
| Third-party services | None |
| Local settings | Stored on your device only |
| Advertising | None |
| Selling data | We have no data to sell |

**KhmerLens respects your privacy.** All lookups are local, all settings are yours alone, and we collect zero data.
