# KhmerLens — final report

## What works

- **Hover dictionary**: hover any Khmer word → popup with the word (large
  Khmer type), Wiktionary romanization, part of speech, English glosses,
  and a frequency badge. Verified live in headless Chromium (Playwright,
  extension loaded unpacked) on a saved Khmer Wikipedia page and a
  realistic Khmer news page — 21/21 browser checks pass, screenshots in
  `tests/screenshots/`.
- **Dictionary**: 9,420 glossed Khmer words (Wiktionary via kaikki.org,
  CC BY-SA 4.0) + 12,094 gloss-less frequency-list words (SIL khmerlbdict,
  MIT) = 21,514 lookup words, 1.8 MB, fully offline, reproducible via
  `data-pipeline/download.sh && python3 build_dictionary.py`.
- **Segmentation**: longest-match over the wordlist, snapped to grapheme
  clusters (never splits coeng/vowel clusters — asserted in tests), with
  ICU (`Intl.Segmenter`) word boundaries as hints and fallback; zero-width
  spaces treated as boundary hints and stripped for lookup. Mid-word hover
  backtracks up to 30 code units to find the covering word.
- **Measured coverage** on 29 real Khmer Wikipedia sentences, probing
  every 3rd position: **87.0%** of probes surface a glossed match, 5.7%
  a known word without a gloss (popup offers a kheng.info link), 7.3% no
  match (ICU fallback segment shown).
- **UX**: shadow-DOM popup card, light/dark/auto themes, viewport-edge
  flipping, CSS Custom Highlight API for on-page match highlight (no DOM
  mutation, safe inside links), 50 ms hover debounce, per-tab toggle with
  ON badge, Alt+K shortcut, Shift/C/N/Esc keys, options page, iframes and
  scrolling containers verified.
- **Permission model**: `activeTab` + `scripting`, **no host permissions**.
  KhmerLens injects only when the user activates it on a tab, so the install
  shows no "read data on all sites" warning. Trade-off: activation ends on
  navigation (re-activate on the new page).
- **Tests**: 29 node unit tests (segmentation edge cases with coeng,
  ZWSP, mixed Khmer/Latin/digits, Khmer punctuation; dictionary format;
  popup positioning) + the Playwright live-browser suite.

## Review cycles run

Two full build→test→browser→self-review cycles, as required:

- **Cycle 1 findings (fixed)**: hover-through when moving onto the
  popup's own link; every iframe eagerly parsing the 1.8 MB dictionary
  (now lazy outside the top frame); a failed dictionary fetch being
  cached forever; clipboard failing on plain-http pages (execCommand
  fallback added); dark mode not re-evaluated after popup creation;
  confusing shortcut-hint wording; broken ZWSP test fixture.
- **Cycle 2 findings (fixed)**: missing spec-required on/off keyboard
  shortcut (Alt+K added via `chrome.commands`); glossed single-letter
  entries outranking longer real words at hover point (ranking now
  penalizes single-grapheme matches). Re-run of all suites: clean.

## Known weaknesses (honest)

1. **Segmentation is heuristic.** ICU's Khmer dictionary merges/splits
   some compounds (observed: ចង់ទៅ merged, ទីក្រុង split), and
   longest-match can overshoot when a long compound happens to be in the
   dictionary but the writer meant two words. Shift-cycling mitigates
   this, but ~7% of positions in the test corpus still produce no
   dictionary match at all.
2. **Gloss coverage is intermediate-learner grade, not exhaustive.**
   9,420 glossed words covers common vocabulary well (87% of probed
   positions), but technical news vocabulary, names, and newer loanwords
   often fall into the gloss-less bucket. No Khmer-Khmer definitions
   (Headley/kheng.info data is not redistributable — external link only).
3. **Romanization is inconsistent in style** across Wiktionary entries
   (about 16% of glossed entries have none at all).
4. **Not reachable**: text in closed shadow roots, `<input>`/`<textarea>`
   content, PDFs, and images. `nextWord` (N) stays within one text node.
5. **Frequency list domain skew**: seafreq.txt is built from a specific
   corpus (SIL line-breaking work); ranks are indicative, not canonical.
6. **file:// pages** need "Allow access to file URLs" enabled manually.

## v2 candidates

1. Saved-word list + Anki export (schema and disabled UI affordance
   already in place — see `docs/DESIGN.md`).
2. Audio pronunciation via the `KhmerLensAudio` provider stub.
3. Better segmentation: bigram frequencies for match ranking, or a
   proper Khmer word-break model (e.g. khmer-nltk ported to JS/WASM).
4. Multi-node matching so words spanning inline elements (`<b>`,
   links) match across boundaries; `nextWord` across nodes.
5. Khmer→Khmer definitions if a redistributable source appears; more
   glosses by merging other CC-licensed lexicons.
6. Popup pinning (click to keep open) and in-popup sub-word lookups.
