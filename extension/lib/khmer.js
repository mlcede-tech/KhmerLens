/**
 * KhmerLens core segmentation + longest-match logic.
 * Pure functions, no DOM/chrome dependencies — shared by the content script
 * (classic script, exposes globalThis.KhmerLens) and Node unit tests.
 */
(function (root) {
  'use strict';

  var ZWSP = '​';
  // Invisible characters treated as soft boundaries and stripped for lookup:
  // ZWSP, ZWNJ, ZWJ, BOM/ZWNBSP, soft hyphen
  var INVISIBLE_RE = /[​‌‍﻿­]/;

  function isKhmerChar(ch) {
    if (!ch) return false;
    var c = ch.codePointAt(0);
    return (c >= 0x1780 && c <= 0x17FF) || (c >= 0x19E0 && c <= 0x19FF);
  }

  // Khmer punctuation / signs that never begin or belong inside a word lookup
  var KHMER_PUNCT = /[។-ៜ៰-៹᧠-᧿]/; // ។៕៖ៗ៘… lek attak, symbols

  function isKhmerLetter(ch) {
    return isKhmerChar(ch) && !KHMER_PUNCT.test(ch);
  }

  var wordSegmenter = null;
  var graphemeSegmenter = null;
  function getWordSegmenter() {
    if (!wordSegmenter) {
      wordSegmenter = new Intl.Segmenter('km', { granularity: 'word' });
    }
    return wordSegmenter;
  }
  function getGraphemeSegmenter() {
    if (!graphemeSegmenter) {
      graphemeSegmenter = new Intl.Segmenter('km', { granularity: 'grapheme' });
    }
    return graphemeSegmenter;
  }

  /**
   * Extract the contiguous run of Khmer letters (plus invisible separators)
   * around `offset` in `text`. Returns {start, end} in original indices,
   * or null when the character at offset is not a Khmer letter.
   */
  function khmerRunAt(text, offset) {
    if (offset < 0 || offset >= text.length) return null;
    var isRunChar = function (ch) {
      return isKhmerLetter(ch) || INVISIBLE_RE.test(ch);
    };
    if (!isKhmerLetter(text[offset])) return null;
    var start = offset;
    while (start > 0 && isRunChar(text[start - 1])) start--;
    var end = offset + 1;
    while (end < text.length && isRunChar(text[end])) end++;
    // trim invisible chars at the edges
    while (start < end && !isKhmerLetter(text[start])) start++;
    while (end > start && !isKhmerLetter(text[end - 1])) end--;
    return start < end ? { start: start, end: end } : null;
  }

  /**
   * Remove invisible separator chars from text, returning the cleaned string
   * plus an index map cleanIdx -> originalIdx (length = clean.length + 1,
   * final element maps clean end -> original end).
   */
  function stripInvisible(text) {
    var clean = '';
    var map = [];
    for (var i = 0; i < text.length; i++) {
      if (!INVISIBLE_RE.test(text[i])) {
        map.push(i);
        clean += text[i];
      }
    }
    map.push(text.length);
    return { clean: clean, map: map };
  }

  /** Grapheme-cluster boundary indices of `text` (includes 0 and length). */
  function graphemeBoundaries(text) {
    var bounds = [0];
    var it = getGraphemeSegmenter().segment(text);
    for (var seg of it) {
      bounds.push(seg.index + seg.segment.length);
    }
    return bounds;
  }

  /** ICU word-segment [start,end) ranges of `text` that are word-like. */
  function icuWords(text) {
    var words = [];
    for (var seg of getWordSegmenter().segment(text)) {
      if (seg.isWordLike) {
        words.push({ start: seg.index, end: seg.index + seg.segment.length, word: seg.segment });
      }
    }
    return words;
  }

  // How far back (in code units) from the hover point we search for a word start.
  var MAX_BACKTRACK = 30;

  /**
   * Find dictionary matches covering the hover position.
   *
   * @param {string} text     the text (e.g. a text node's data)
   * @param {number} offset   hover offset within text
   * @param {function} hasWord   (word) => truthy if in dictionary
   * @param {number} maxWordLen  longest dictionary word, in code units
   * @returns {Array<{word, start, end}>} matches in display order:
   *   sorted by start asc, then length desc; all cover the hover grapheme.
   *   start/end are ORIGINAL text indices (ZWSP-safe). `word` is the cleaned
   *   lookup key. Empty array if nothing matched.
   */
  function findMatches(text, offset, hasWord, maxWordLen) {
    var run = khmerRunAt(text, offset);
    if (!run) return [];

    // work on the cleaned run
    var runText = text.slice(run.start, run.end);
    var stripped = stripInvisible(runText);
    var clean = stripped.clean;
    var map = stripped.map;

    // hover offset in cleaned coordinates (position of first clean char at/after it)
    var hoverOrig = offset - run.start;
    var hoverClean = 0;
    while (hoverClean < clean.length && map[hoverClean] < hoverOrig) hoverClean++;
    if (hoverClean >= clean.length) hoverClean = clean.length - 1;

    var bounds = graphemeBoundaries(clean);
    var boundSet = new Set(bounds);

    // grapheme start containing the hover position
    var gStart = 0;
    for (var i = 0; i < bounds.length - 1; i++) {
      if (bounds[i] <= hoverClean && hoverClean < bounds[i + 1]) { gStart = bounds[i]; break; }
    }
    var gEnd = clean.length;
    for (var j = 0; j < bounds.length - 1; j++) {
      if (bounds[j] === gStart) { gEnd = bounds[j + 1]; break; }
    }

    // candidate starts: grapheme boundaries within MAX_BACKTRACK before gStart,
    // biased by ICU word starts (tried in order: earliest ICU-aligned first
    // is handled by sorting below).
    var icu = icuWords(clean);
    var icuStarts = new Set(icu.map(function (w) { return w.start; }));

    var starts = [];
    for (var b of bounds) {
      if (b <= gStart && gStart - b <= MAX_BACKTRACK) starts.push(b);
    }

    var matches = [];
    var seen = new Set();
    for (var s of starts) {
      var maxEnd = Math.min(clean.length, s + maxWordLen);
      for (var e = maxEnd; e > gEnd - 1 && e > s; e--) {
        if (!boundSet.has(e)) continue;
        if (e < gEnd) break; // must cover the hovered grapheme
        var cand = clean.slice(s, e);
        if (hasWord(cand)) {
          var key = s + ':' + e;
          if (!seen.has(key)) {
            seen.add(key);
            matches.push({
              word: cand,
              start: run.start + map[s],
              end: run.start + map[e],
              cleanStart: s,
              cleanEnd: e,
              icuAligned: icuStarts.has(s),
            });
          }
        }
      }
    }

    // Order: matches starting at the hovered grapheme first (longest first),
    // then earlier starts (longest first) — earlier ICU-aligned starts get
    // priority over non-aligned ones at the same distance.
    matches.sort(function (a, b) {
      var aAtHover = a.cleanStart === gStart ? 0 : 1;
      var bAtHover = b.cleanStart === gStart ? 0 : 1;
      if (aAtHover !== bAtHover) return aAtHover - bAtHover;
      if (a.cleanStart !== b.cleanStart) {
        // among backtracked starts prefer ICU-aligned, then closer to hover
        if (a.icuAligned !== b.icuAligned) return a.icuAligned ? -1 : 1;
        return b.cleanStart - a.cleanStart;
      }
      return (b.cleanEnd - b.cleanStart) - (a.cleanEnd - a.cleanStart);
    });
    return matches;
  }

  /**
   * ICU fallback segment covering offset, for when the dictionary has no
   * match. Returns {word, start, end} in original indices or null.
   */
  function icuFallback(text, offset) {
    var run = khmerRunAt(text, offset);
    if (!run) return null;
    var runText = text.slice(run.start, run.end);
    var stripped = stripInvisible(runText);
    var hoverOrig = offset - run.start;
    var hoverClean = 0;
    while (hoverClean < stripped.clean.length && stripped.map[hoverClean] < hoverOrig) hoverClean++;
    for (var w of icuWords(stripped.clean)) {
      if (w.start <= hoverClean && hoverClean < w.end) {
        return {
          word: w.word,
          start: run.start + stripped.map[w.start],
          end: run.start + stripped.map[w.end],
        };
      }
    }
    return null;
  }

  var api = {
    isKhmerChar: isKhmerChar,
    isKhmerLetter: isKhmerLetter,
    khmerRunAt: khmerRunAt,
    stripInvisible: stripInvisible,
    graphemeBoundaries: graphemeBoundaries,
    icuWords: icuWords,
    findMatches: findMatches,
    icuFallback: icuFallback,
    ZWSP: ZWSP,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.KhmerLensCore = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
