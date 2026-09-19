/**
 * KhmerLens kheng.info parser: turns a kheng.info /search/ result page into
 * KhmerLens sense triples, so a definition fetched live can render through the
 * same popup/Anki path as the bundled dictionary.
 *
 * Pure and DOM-based. `parseKhengDefinition` accepts either an HTML string
 * (parsed with DOMParser when available) or an already-parsed Document/Element,
 * so it runs in the content script (native DOMParser) and under Node tests
 * (a jsdom document passed in). No network here - the service worker fetches.
 */
(function (root) {
  'use strict';

  var ZERO_WIDTH = /[​‌‍﻿]/g;

  function normalize(s) {
    return (s || '').replace(ZERO_WIDTH, '').normalize('NFC').trim();
  }

  function toRoot(doc) {
    if (!doc) return null;
    if (typeof doc === 'string') {
      if (typeof DOMParser === 'undefined') return null;
      return new DOMParser().parseFromString(doc, 'text/html');
    }
    return doc; // Document or Element with querySelector
  }

  /**
   * Split a kheng.info definition cell into [pos, '', gloss] triples.
   * The cell looks like: (<i>adj</i>) gloss…<br><br>(<i>n</i>) gloss…<br><br>
   * <span class="IPA">…</span>. Senses are separated by double <br>; the POS
   * sits in parentheses at the start of each. IPA/audio nodes are dropped.
   */
  function extractSenses(defCell) {
    var clone = defCell.cloneNode(true);
    var drop = clone.querySelectorAll('.IPA, .speaker');
    Array.prototype.forEach.call(drop, function (n) { n.remove(); });

    var senses = [];
    var buf = '';
    var brRun = 0;

    function flush() {
      var text = buf.replace(/\s+/g, ' ').trim();
      buf = '';
      if (!text) return;
      var pos = '';
      var gloss = text;
      var m = text.match(/^\(([^)]*)\)\s*([\s\S]*)$/);
      if (m) { pos = m[1].trim(); gloss = m[2].trim(); }
      if (gloss) senses.push([pos, '', gloss]);
    }

    Array.prototype.forEach.call(clone.childNodes, function (node) {
      if (node.nodeType === 1 && node.tagName === 'BR') {
        brRun++;
        buf += ' ';
        if (brRun >= 2) { flush(); brRun = 0; }
        return;
      }
      var t = node.textContent || '';
      if (t.trim()) { brRun = 0; buf += t; }
    });
    flush();
    return senses;
  }

  /**
   * Parse a kheng.info search result.
   * @param {string|Document|Element} doc  HTML string or parsed DOM.
   * @param {string} [word]  the queried headword, for the exact-match flag.
   * @returns {{found:boolean, exact:boolean, lemma:string, senses:Array}}
   *   found  - a headword entry with at least one gloss was present
   *   exact  - the entry's lemma equals the queried word (normalized)
   *   lemma  - kheng.info's headword text (use this for the no-match fallback)
   *   senses - [[pos, '', gloss], …], same shape as dictionary.js senses
   */
  function parseKhengDefinition(doc, word) {
    var empty = { found: false, exact: false, lemma: '', senses: [] };
    var el = toRoot(doc);
    if (!el || !el.querySelector) return empty;

    // The direct Khmer→English match is the first result row; compounds live
    // in a later table and must not be mistaken for the headword.
    var row = el.querySelector('tr.definition_row2');
    if (!row) return empty;
    var lemmaCell = row.querySelector('.lemma');
    var defCell = row.querySelector('.definition');
    if (!defCell) return empty;

    var lemma = lemmaCell ? normalize(clonedText(lemmaCell)) : '';
    var senses = extractSenses(defCell);
    if (!senses.length) return { found: false, exact: false, lemma: lemma, senses: [] };

    return {
      found: true,
      exact: !!word && lemma === normalize(word),
      lemma: lemma,
      senses: senses,
    };
  }

  /** Lemma text without the audio speaker glyph. */
  function clonedText(lemmaCell) {
    var clone = lemmaCell.cloneNode(true);
    var drop = clone.querySelectorAll('.speaker');
    Array.prototype.forEach.call(drop, function (n) { n.remove(); });
    return clone.textContent || '';
  }

  var api = {
    parseKhengDefinition: parseKhengDefinition,
    normalize: normalize,
    searchUrl: function (word) {
      return 'https://kheng.info/search/?query=' + encodeURIComponent(word);
    },
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.KhmerLensKheng = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
