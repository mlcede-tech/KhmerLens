# Privacy Policy

**KhmerLens** — Last updated: July 4, 2026

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

**How long:** Until you uninstall the extension or manually clear them

**Accessible to:** Only this extension; other extensions and websites cannot access your settings

**Synced data:** If you have Chrome sync enabled, your settings may sync across your Chrome-logged-in devices (this is optional and controlled by Chrome's sync settings)

### Dictionary Data

KhmerLens includes a compiled dictionary (~1.8 MB) with 21,514 Khmer words and English definitions:
- Built into the extension (no network download)
- Stored locally when you install the extension
- All word lookups performed locally, never transmitted

---

## What We DO NOT Transmit

When you hover over Khmer text:
1. We detect the word locally
2. We look it up in the local dictionary
3. We show a popup on your device
4. **Nothing is sent to any server**

The only exception is if you explicitly click an external link (e.g., a link to kheng.info in the popup) — in that case, you are navigating to an external website under your control.

---

## External Links

KhmerLens may include optional links to external resources:

- **kheng.info** — External Khmer resource (opened only when you explicitly click)
- Links are **user-initiated only** — we do not click them on your behalf
- When you click an external link, you are subject to that site's privacy policy

---

## Permissions Explained

### `storage`

Stores your extension settings locally. No data is sent to any server unless you enable Chrome sync (which is your choice, controlled by Chrome settings).

### `clipboardWrite`

Allows you to copy a word and its definition to your clipboard using the 'c' keyboard shortcut. This is performed locally; the clipboard is not accessed by any external service.

### Host Permissions (`<all_urls>`)

Allows the extension to:
- Read page content to detect Khmer text
- Show popups when you hover

**Important:** The extension reads text to identify Khmer characters. This is performed entirely locally. Page content is **never transmitted** to any server. The extension operates offline.

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
| Network requests | None (except optional user-clicked external links) |
| Third-party services | None |
| Local settings | Stored on your device only |
| Advertising | None |
| Selling data | We have no data to sell |

**KhmerLens respects your privacy.** All lookups are local, all settings are yours alone, and we collect zero data.
