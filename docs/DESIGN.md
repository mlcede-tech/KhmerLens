# KhmerLens — architecture notes and v2 extension points

## Architecture (v1)

```
extension/
  manifest.json          MV3; content scripts on <all_urls>, all_frames
  background.js          service worker: per-tab enable state + badge
  lib/khmer.js           pure segmentation/longest-match logic (Node-testable)
  lib/dictionary.js      dictionary load + lookup (Node-testable)
  lib/popup.js           popup positioning math (Node-testable)
  content/content.js     hover detection, shadow-DOM popup, highlight, keys
  content/popup.css      popup card styles (injected into shadow root)
  data/dictionary.json   compiled dictionary (see /data-pipeline)
  options/               options page (chrome.storage.sync settings)
```

Lookup flow: `mousemove` (debounced 50 ms) → `caretPositionFromPoint` →
`KhmerLensCore.findMatches(text, offset, dict.has, dict.maxWordLen)` →
render popup + CSS Custom Highlight. `findMatches` strips zero-width
spaces (keeping an index map back to the original text), snaps all
candidate boundaries to grapheme clusters (`Intl.Segmenter` grapheme), and
tries hash lookups from candidate starts (grapheme boundaries up to 30
code units back, ICU word starts preferred) with longest-first ends.

The dictionary is loaded once per frame on first use (eagerly in the top
frame, lazily in iframes) and held in memory; there are no per-mousemove
scans of the full dictionary.

## v2 extension point: saved-word list with Anki export

UI affordance already present: the disabled "☆ Save" button in the popup
footer (`content.js`, `renderPopup`). To implement:

1. Enable the button and wire `click` to `saveWord(entry)`.
2. Storage schema (designed for `chrome.storage.local`; sync has a 100 KB
   quota which is too small for a word list):

```js
// key: "wordlist"
{
  version: 1,
  words: [
    {
      w: "កម្ពុជា",          // headword
      r: "kampuciə",          // romanization at save time
      g: "Cambodia; ...",     // gloss snapshot
      pos: "proper noun",
      rank: 812,              // frequency rank snapshot (0 = unranked)
      src: "https://...",     // page URL where saved
      ctx: "…sentence…",      // sentence context (from the text node)
      t: 1720000000000        // saved-at epoch ms
    }
  ]
}
```

3. Anki export = TSV download (`word \t roman \t gloss \t ctx`), generated
   in the options page from `chrome.storage.local`. No new permissions
   needed.

## v2 extension point: audio pronunciation

`content.js` exposes `globalThis.KhmerLensAudio`:

```js
KhmerLensAudio.register({
  canSpeak(word) -> boolean,
  speak(word)   -> Promise<void>,
});
```

The popup head (`.kl-head`) is a flex row with room for a speaker button;
when a provider is registered, render the button and call `speak()` on
click. Candidate backends: Web Speech API (`speechSynthesis` has no Khmer
voice on most platforms today), recorded audio keyed by headword, or a
TTS service (would require a network permission disclosure).

## Deliberate v1 limitations

- `nextWord` (N key) only advances within the current text node.
- Text inside closed shadow roots is not reachable (`caretPositionFromPoint`
  does not pierce them without `shadowRoots` support).
- Cross-origin iframes get their own content script instance and work, but
  each pays its own (lazy) dictionary load.
