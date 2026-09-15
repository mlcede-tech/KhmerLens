/**
 * KhmerLens audio: bundled pronunciation recordings + Khmer TTS fallback.
 * Works as a content script (globalThis.KhmerLensAudioLib) and under Node
 * tests (pass a preloaded index object to createAudioIndex).
 */
(function (root) {
  'use strict';

  function createAudioIndex(data) {
    var words = (data && data.words) || {};
    return {
      meta: (data && data.meta) || {},
      /** relative file name under data/audio/, or null */
      file: function (w) {
        return Object.prototype.hasOwnProperty.call(words, w) ? words[w] : null;
      },
    };
  }

  /**
   * Pick a Khmer voice from speechSynthesis.getVoices().
   * Matches 'km', 'km-KH', 'km_KH' — but not e.g. 'kmr' (Kurmanji).
   */
  function pickKhmerVoice(voices) {
    for (var i = 0; i < (voices || []).length; i++) {
      if (/^km([-_]|$)/i.test(voices[i].lang || '')) return voices[i];
    }
    return null;
  }

  var loaded = null;
  function load(url, fetchFn) {
    if (!loaded) {
      loaded = (fetchFn || fetch)(url)
        .then(function (r) { return r.json(); })
        .then(createAudioIndex)
        .catch(function () {
          // missing/corrupt index: degrade to TTS-only
          loaded = Promise.resolve(createAudioIndex(null));
          return loaded;
        });
    }
    return loaded;
  }

  var api = {
    createAudioIndex: createAudioIndex,
    pickKhmerVoice: pickKhmerVoice,
    load: load,
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.KhmerLensAudioLib = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
