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

### Pronunciation Recordings (17 words)

**Sources:** [Wikimedia Commons — Category:Khmer pronunciation](https://commons.wikimedia.org/wiki/Category:Khmer_pronunciation) and [Lingua Libre](https://lingualibre.org/) (recordings hosted on Wikimedia Commons)
**License:** Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)
**What was used:** Native-speaker recordings of Khmer words, bundled in `extension/data/audio/` and indexed by `extension/data/audio-index.json` (rebuilt with `data-pipeline/fetch_audio.py`).

| Word | Bundled file | Original file | Author | License |
|------|--------------|---------------|--------|---------|
| កាហ្វេ | `698cb4253c8c.wav` | [LL-Q9205 (khm)-咽頭べさ-កាហ្វេ.wav](https://commons.wikimedia.org/wiki/File:LL-Q9205_(khm)-%E5%92%BD%E9%A0%AD%E3%81%B9%E3%81%95-%E1%9E%80%E1%9E%B6%E1%9E%A0%E1%9F%92%E1%9E%9C%E1%9F%81.wav) | Speaker: 咽頭べさ; Recorder: 咽頭べさ | CC BY-SA 4.0 |
| កាហ្វេទឹកកក | `4eecfc149e9b.wav` | [LL-Q9205 (khm)-咽頭べさ-កាហ្វេទឹកកក.wav](https://commons.wikimedia.org/wiki/File:LL-Q9205_(khm)-%E5%92%BD%E9%A0%AD%E3%81%B9%E3%81%95-%E1%9E%80%E1%9E%B6%E1%9E%A0%E1%9F%92%E1%9E%9C%E1%9F%81%E1%9E%91%E1%9E%B9%E1%9E%80%E1%9E%80%E1%9E%80.wav) | Speaker: 咽頭べさ; Recorder: 咽頭べさ | CC BY-SA 4.0 |
| កាំភ្លើង | `ebe72c5bd55e.wav` | [LL-Q9205 (khm)-咽頭べさ-កាំភ្លើង.wav](https://commons.wikimedia.org/wiki/File:LL-Q9205_(khm)-%E5%92%BD%E9%A0%AD%E3%81%B9%E3%81%95-%E1%9E%80%E1%9E%B6%E1%9F%86%E1%9E%97%E1%9F%92%E1%9E%9B%E1%9E%BE%E1%9E%84.wav) | Speaker: 咽頭べさ; Recorder: 咽頭べさ | CC BY-SA 4.0 |
| កាំភ្លើងធំ | `6b8d22b7a626.wav` | [LL-Q9205 (khm)-咽頭べさ-កាំភ្លើងធំ.wav](https://commons.wikimedia.org/wiki/File:LL-Q9205_(khm)-%E5%92%BD%E9%A0%AD%E3%81%B9%E3%81%95-%E1%9E%80%E1%9E%B6%E1%9F%86%E1%9E%97%E1%9F%92%E1%9E%9B%E1%9E%BE%E1%9E%84%E1%9E%92%E1%9F%86.wav) | Speaker: 咽頭べさ; Recorder: 咽頭べさ | CC BY-SA 4.0 |
| កាំភ្លើងមេរៀម | `69a4c80aaf0c.wav` | [LL-Q9205 (khm)-咽頭べさ-កាំភ្លើងមេរៀម.wav](https://commons.wikimedia.org/wiki/File:LL-Q9205_(khm)-%E5%92%BD%E9%A0%AD%E3%81%B9%E3%81%95-%E1%9E%80%E1%9E%B6%E1%9F%86%E1%9E%97%E1%9F%92%E1%9E%9B%E1%9E%BE%E1%9E%84%E1%9E%98%E1%9F%81%E1%9E%9A%E1%9F%80%E1%9E%98.wav) | Speaker: 咽頭べさ; Recorder: 咽頭べさ | CC BY-SA 4.0 |
| កំប្រុក | `77935b474176.wav` | [LL-Q9205 (khm)-咽頭べさ-កំប្រុក.wav](https://commons.wikimedia.org/wiki/File:LL-Q9205_(khm)-%E5%92%BD%E9%A0%AD%E3%81%B9%E3%81%95-%E1%9E%80%E1%9F%86%E1%9E%94%E1%9F%92%E1%9E%9A%E1%9E%BB%E1%9E%80.wav) | Speaker: 咽頭べさ; Recorder: 咽頭べさ | CC BY-SA 4.0 |
| ក្ដាម | `ef26a845ed7a.wav` | [LL-Q9205 (khm)-咽頭べさ-ក្ដាម.wav](https://commons.wikimedia.org/wiki/File:LL-Q9205_(khm)-%E5%92%BD%E9%A0%AD%E3%81%B9%E3%81%95-%E1%9E%80%E1%9F%92%E1%9E%8A%E1%9E%B6%E1%9E%98.wav) | Speaker: 咽頭べさ; Recorder: 咽頭べさ | CC BY-SA 4.0 |
| ខ្ញែរសមុទ្រ | `5f389825e2d6.wav` | [LL-Q9205 (khm)-Intobesa (咽頭べさ)-ខ្ញែរសមុទ្រ.wav](https://commons.wikimedia.org/wiki/File:LL-Q9205_(khm)-Intobesa_(%E5%92%BD%E9%A0%AD%E3%81%B9%E3%81%95)-%E1%9E%81%E1%9F%92%E1%9E%89%E1%9F%82%E1%9E%9A%E1%9E%9F%E1%9E%98%E1%9E%BB%E1%9E%91%E1%9F%92%E1%9E%9A.wav) | Speaker: Intobesa; Recorder: 咽頭べさ | CC BY-SA 4.0 |
| ខ្មែរ | `819855d5513f.ogg` | [Km-ខ្មែរ.ogg](https://commons.wikimedia.org/wiki/File:Km-%E1%9E%81%E1%9F%92%E1%9E%98%E1%9F%82%E1%9E%9A.ogg) | Trezoo | CC BY-SA 4.0 |
| ជំពុលទឹក | `52ae155a4f20.wav` | [LL-Q9205 (khm)-Intobesa (咽頭べさ)-ជំពុលទឹក.wav](https://commons.wikimedia.org/wiki/File:LL-Q9205_(khm)-Intobesa_(%E5%92%BD%E9%A0%AD%E3%81%B9%E3%81%95)-%E1%9E%87%E1%9F%86%E1%9E%96%E1%9E%BB%E1%9E%9B%E1%9E%91%E1%9E%B9%E1%9E%80.wav) | Speaker: Intobesa; Recorder: 咽頭べさ | CC BY-SA 4.0 |
| ដើរ | `7ef9ad753c9d.wav` | [LL-Q9205 (khm)-Intobesa (咽頭べさ)-ដើរ.wav](https://commons.wikimedia.org/wiki/File:LL-Q9205_(khm)-Intobesa_(%E5%92%BD%E9%A0%AD%E3%81%B9%E3%81%95)-%E1%9E%8A%E1%9E%BE%E1%9E%9A.wav) | Speaker: Intobesa; Recorder: 咽頭べさ | CC BY-SA 4.0 |
| ដែរ | `9a9b73929a0b.wav` | [LL-Q9205 (khm)-Intobesa (咽頭べさ)-ដែរ.wav](https://commons.wikimedia.org/wiki/File:LL-Q9205_(khm)-Intobesa_(%E5%92%BD%E9%A0%AD%E3%81%B9%E3%81%95)-%E1%9E%8A%E1%9F%82%E1%9E%9A.wav) | Speaker: Intobesa; Recorder: 咽頭べさ | CC BY-SA 4.0 |
| ធ្មេញ | `6aad45f07f64.wav` | [LL-Q9205 (khm)-咽頭べさ-ធ្មេញ.wav](https://commons.wikimedia.org/wiki/File:LL-Q9205_(khm)-%E5%92%BD%E9%A0%AD%E3%81%B9%E3%81%95-%E1%9E%92%E1%9F%92%E1%9E%98%E1%9F%81%E1%9E%89.wav) | Speaker: 咽頭べさ; Recorder: 咽頭べさ | CC BY-SA 4.0 |
| បរទេស | `ab645a545a86.ogg` | [Km-បរទេស.ogg](https://commons.wikimedia.org/wiki/File:Km-%E1%9E%94%E1%9E%9A%E1%9E%91%E1%9F%81%E1%9E%9F.ogg) | Nisetpdajsankha | CC BY-SA 4.0 |
| ពញា | `4884c5d08ae4.ogg` | [Km-ពញា.ogg](https://commons.wikimedia.org/wiki/File:Km-%E1%9E%96%E1%9E%89%E1%9E%B6.ogg) | Nisetpdajsankha | CC BY-SA 4.0 |
| ពាក្យ | `9b699804f8d8.ogg` | [Km-ពាក្យ.ogg](https://commons.wikimedia.org/wiki/File:Km-%E1%9E%96%E1%9E%B6%E1%9E%80%E1%9F%92%E1%9E%99.ogg) | Trezoo | CC BY-SA 4.0 |
| សុខ | `eb36696ba317.wav` | [LL-Q9205 (khm)-咽頭べさ-សុខ.wav](https://commons.wikimedia.org/wiki/File:LL-Q9205_(khm)-%E5%92%BD%E9%A0%AD%E3%81%B9%E3%81%95-%E1%9E%9F%E1%9E%BB%E1%9E%81.wav) | Speaker: 咽頭べさ; Recorder: 咽頭べさ | CC BY-SA 4.0 |

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
