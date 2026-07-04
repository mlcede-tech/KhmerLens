/**
 * KhmerLens dictionary: loads data/dictionary.json once and provides lookup.
 * Works as a content script (globalThis.KhmerLensDict) and under Node tests
 * (pass a preloaded data object to createDictionary).
 */
(function (root) {
  'use strict';

  function createDictionary(data) {
    var words = data.words;
    var freq = data.freq;
    var maxWordLen = data.meta.maxWordLen;

    return {
      maxWordLen: maxWordLen,
      meta: data.meta,
      has: function (w) {
        return Object.prototype.hasOwnProperty.call(words, w);
      },
      /** senses: array of [pos, roman, glosses]; [] = known word, no gloss */
      senses: function (w) {
        return Object.prototype.hasOwnProperty.call(words, w) ? words[w] : null;
      },
      /** 1-based frequency rank, or 0 if unranked */
      rank: function (w) {
        return Object.prototype.hasOwnProperty.call(freq, w) ? freq[w] : 0;
      },
      /** coarse frequency band for the UI: 'common' | 'frequent' | '' */
      freqBand: function (w) {
        var r = this.rank(w);
        if (!r) return '';
        if (r <= 2000) return 'common';
        if (r <= 8000) return 'frequent';
        return '';
      },
    };
  }

  var loaded = null;
  function load(url, fetchFn) {
    if (!loaded) {
      loaded = (fetchFn || fetch)(url)
        .then(function (r) { return r.json(); })
        .then(createDictionary)
        .catch(function (err) {
          loaded = null; // allow retry on next hover
          throw err;
        });
    }
    return loaded;
  }

  var api = { createDictionary: createDictionary, load: load };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.KhmerLensDict = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
