# Attribution and Licenses

KhmerLens uses data and libraries from multiple open-source projects. This document provides complete attribution, source information, and license details.

## Dictionary Data Sources

### Wiktionary (9,420 Khmer Words with Definitions)

**Source:** https://kaikki.org/  
**License:** Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)  
**Attribution:** Wiktionary contributors, https://www.wiktionary.org/  
**What was used:** Khmer word entries with English definitions, romanizations (Wiktionary phonetic scheme), and parts of speech.

### SIL khmerlbdict (12,094 Frequency-List Words)

**Source:** https://github.com/silnrsi/khmerlbdict  
**License:** MIT License  
**Copyright:** © 2015 SIL NRSI (SIL International)  
**Attribution:** SIL International, https://www.sil.org/  
**What was used:** Khmer frequency list (`seafreq.txt`) containing word tokens for segmentation support, without English definitions.

---

## Compiled Dictionary

The compiled dictionary file (`extension/data/dictionary.json`, ~1.8 MB) is a **derived work** combining:
- Wiktionary content (CC BY-SA 4.0)
- SIL khmerlbdict frequency list (MIT License)

### License of Compiled Dictionary

**The compiled dictionary is redistributable under CC BY-SA 4.0.**

This license was chosen because the primary source (Wiktionary) is licensed under CC BY-SA 4.0, which requires any derivative works to be licensed under the same terms. The MIT-licensed frequency data is compatible with this requirement.

### CC BY-SA 4.0 Summary

You are free to:
- Use the compiled dictionary in any project (commercial or non-commercial)
- Modify the dictionary
- Share it with others

Provided you:
- **Attribute** the original sources (Wiktionary and SIL khmerlbdict)
- **License** any derivative work under the same CC BY-SA 4.0 terms

For the full license text, see: https://creativecommons.org/licenses/by-sa/4.0/

---

## Extension Inspiration

KhmerLens was inspired by **Zhongwen** (中文), a popup dictionary for Chinese text.

**Source:** https://github.com/ccaohuu/Zhongwen  
**License:** GNU General Public License v2 (GPL-2.0)  
**Note:** No code from Zhongwen was reused in KhmerLens. The extension was designed independently, taking only the *concept* of a hover-based popup dictionary.

---

## Chrome Web Store & Manifest V3

The KhmerLens extension uses the Chrome Web Store and Manifest V3 specifications provided by Google.

**Chrome Web Store:** https://chrome.google.com/webstore/  
**Manifest V3 Specification:** https://developer.chrome.com/docs/extensions/mv3/

---

## Additional Data and Code

### Browser APIs Used

- Chrome Extensions APIs (Manifest V3)
  - `chrome.storage` (for user settings)
  - `chrome.tabs` (for per-tab state)
  - `chrome.clipboardWrite` (for copy functionality)
  - `chrome.scripting` (for content injection)

### Standard Libraries (No Attribution Required)

- `Intl.Segmenter` (ICU segmentation, built into modern browsers)
- ECMAScript standard library (DOM APIs, etc.)

---

## Summary of License Compliance

| Source | License | Used For | Compliant |
|--------|---------|----------|-----------|
| Wiktionary | CC BY-SA 4.0 | Definitions, romanization, POS | Yes - attributed, compiled work licensed CC BY-SA 4.0 |
| SIL khmerlbdict | MIT | Frequency list, segmentation | Yes - MIT-compatible with CC BY-SA 4.0 |
| Zhongwen | GPL-2.0 | Inspiration only | Yes - no code reused |

---

## How to Properly Attribute KhmerLens

If you use or distribute the KhmerLens dictionary or extension, include the following attribution:

> **KhmerLens** — https://github.com/[username]/khmer-lens
>
> Includes data from:
> - Wiktionary (https://www.wiktionary.org/) — CC BY-SA 4.0
> - SIL khmerlbdict (https://github.com/silnrsi/khmerlbdict) — MIT License, © 2015 SIL International
>
> KhmerLens is inspired by Zhongwen (https://github.com/ccaohuu/Zhongwen).

---

## Questions?

For questions about licensing, attribution, or data sources, please open an issue in the repository or contact the maintainers.
