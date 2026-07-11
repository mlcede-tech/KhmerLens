/**
 * KhmerLens content script: hover detection, popup UI, highlight, shortcuts.
 * Depends on lib/khmer.js (KhmerLensCore), lib/dictionary.js (KhmerLensDict),
 * lib/popup.js (KhmerLensPopup) — loaded before this file via the manifest.
 */
(function () {
  'use strict';

  // Guard against double injection: the background worker tracks injected
  // tabs, but if the same tab is ever injected twice we must not register a
  // second set of document listeners.
  if (globalThis.__khmerLensLoaded) return;
  globalThis.__khmerLensLoaded = true;

  var core = globalThis.KhmerLensCore;
  var dictApi = globalThis.KhmerLensDict;
  var popupMath = globalThis.KhmerLensPopup;
  var audioApi = globalThis.KhmerLensAudioLib;

  var enabled = false;
  var dict = null;        // loaded lazily on first enable
  var dictLoading = null;
  var audioIdx = null;    // bundled-recordings index, loaded with the dict
  var ttsVoice = null;    // Khmer speechSynthesis voice, if the OS has one

  var settings = {
    theme: 'auto',        // light | dark | auto
    fontSize: 'medium',   // small | medium | large
    showRoman: true,
    highlight: true,
    ankiEnabled: false,
  };

  // ---------------------------------------------------------------- state
  var host = null;        // shadow host element
  var shadow = null;
  var card = null;
  var visible = false;
  var current = null;     // {matches, index, node, cursorX, cursorY}
  var hoverTimer = 0;
  var lastMouse = { x: -1, y: -1 };
  var highlightStyleEl = null;

  // ------------------------------------------------------------- settings
  function loadSettings() {
    try {
      chrome.storage.sync.get(settings, function (items) {
        if (!chrome.runtime.lastError && items) {
          settings = Object.assign(settings, items);
          applyTheme();
        }
      });
    } catch (e) { /* storage unavailable (rare) */ }
  }
  try {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== 'sync') return;
      for (var k in changes) {
        if (k in settings) settings[k] = changes[k].newValue;
      }
      applyTheme();
    });
  } catch (e) { /* ignore */ }

  // ------------------------------------------------------------ dictionary
  function ensureDict() {
    if (dict) return Promise.resolve(dict);
    if (!dictLoading) {
      dictLoading = dictApi
        .load(chrome.runtime.getURL('data/dictionary.json'))
        .then(function (d) { dict = d; return d; });
    }
    return dictLoading;
  }

  // ----------------------------------------------------------------- audio
  function ensureAudio() {
    if (!audioApi) return; // lib/audio.js not loaded: no audio affordance
    if (!audioIdx) {
      audioApi
        .load(chrome.runtime.getURL('data/audio-index.json'))
        .then(function (idx) { audioIdx = idx; });
    }
    if (!ttsVoice && typeof speechSynthesis !== 'undefined') {
      ttsVoice = audioApi.pickKhmerVoice(speechSynthesis.getVoices());
      if (!ttsVoice) {
        // voices often arrive asynchronously after first getVoices() call
        speechSynthesis.addEventListener('voiceschanged', function onv() {
          ttsVoice = audioApi.pickKhmerVoice(speechSynthesis.getVoices());
          if (ttsVoice) speechSynthesis.removeEventListener('voiceschanged', onv);
        });
      }
    }
  }

  /** 'file' (bundled recording) | 'tts' (Khmer voice) | null */
  function audioModeFor(word) {
    if (audioIdx && audioIdx.file(word)) return 'file';
    if (ttsVoice) return 'tts';
    return null;
  }

  function speakCurrent() {
    var word = current.matches[current.index].word;
    var mode = audioModeFor(word);
    if (mode === 'file') {
      var player = new Audio(
        chrome.runtime.getURL('data/audio/' + audioIdx.file(word)));
      player.play().catch(function () { flashFoot('Audio failed'); });
    } else if (mode === 'tts') {
      var u = new SpeechSynthesisUtterance(word);
      u.voice = ttsVoice;
      u.lang = ttsVoice.lang;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    }
  }

  // ------------------------------------------------------------------ anki
  function addToAnki() {
    var m = current.matches[current.index];
    var entry = { word: m.word, senses: dict ? dict.senses(m.word) || [] : [] };
    try {
      chrome.runtime.sendMessage(
        { type: 'khmerlens:ankiAdd', entry: entry },
        function (resp) {
          if (chrome.runtime.lastError || !resp) {
            flashFoot('Anki: extension error');
          } else if (resp.ok) {
            flashFoot('Added to Anki ✓');
          } else if (resp.status === 'duplicate') {
            flashFoot('Already in deck');
          } else if (resp.status === 'unreachable') {
            flashFoot('Anki not running?');
          } else if (resp.status === 'unconfigured') {
            flashFoot('Set up Anki in options');
          } else {
            flashFoot('Anki: ' + (resp.message || 'failed'));
          }
        }
      );
    } catch (e) { flashFoot('Anki: extension error'); }
  }

  // -------------------------------------------------------------- popup UI
  var POPUP_CSS = null;
  function buildPopup() {
    if (host) return;
    host = document.createElement('div');
    host.id = 'khmerlens-host';
    host.style.cssText =
      'all:initial; position:fixed; left:0; top:0; z-index:2147483647;';
    shadow = host.attachShadow({ mode: 'open' });

    var style = document.createElement('style');
    style.textContent = POPUP_CSS || '';
    shadow.appendChild(style);

    card = document.createElement('div');
    card.className = 'kl-card kl-hidden';
    card.setAttribute('role', 'tooltip');
    shadow.appendChild(card);

    (document.body || document.documentElement).appendChild(host);
    applyTheme();
  }

  function applyTheme() {
    if (!card) return;
    var dark = settings.theme === 'dark' ||
      (settings.theme === 'auto' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    card.classList.toggle('kl-dark', dark);
    card.classList.remove('kl-fs-small', 'kl-fs-medium', 'kl-fs-large');
    card.classList.add('kl-fs-' + settings.fontSize);
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /**
   * Render the popup for the match at current.index.
   * All page-derived strings go through textContent — never innerHTML.
   */
  function renderPopup() {
    applyTheme(); // re-check auto theme (system scheme may have changed)
    var m = current.matches[current.index];
    var senses = dict.senses(m.word) || [];
    card.textContent = '';

    var head = el('div', 'kl-head');
    head.appendChild(el('span', 'kl-word', m.word));

    var audioMode = audioModeFor(m.word);
    if (audioMode) {
      var speak = el('button', 'kl-audio', '🔊');
      speak.type = 'button';
      speak.title = audioMode === 'file'
        ? 'Play native recording (S)'
        : 'Speak with system Khmer voice (S)';
      speak.addEventListener('click', function (ev) {
        ev.stopPropagation();
        speakCurrent();
      });
      head.appendChild(speak);
    }

    var band = dict.freqBand(m.word);
    if (band) {
      head.appendChild(el('span', 'kl-freq kl-freq-' + band,
        band === 'common' ? 'common' : 'frequent'));
    }
    if (current.matches.length > 1) {
      head.appendChild(el('span', 'kl-alt',
        (current.index + 1) + '/' + current.matches.length));
    }
    card.appendChild(head);

    if (settings.showRoman) {
      var romans = [];
      senses.forEach(function (s) {
        if (s[1] && romans.indexOf(s[1]) === -1) romans.push(s[1]);
      });
      if (romans.length) {
        card.appendChild(el('div', 'kl-roman', romans.join(' · ')));
      }
    }

    var body = el('div', 'kl-body');
    if (senses.length) {
      senses.forEach(function (s) {
        var line = el('div', 'kl-sense');
        if (s[0]) line.appendChild(el('span', 'kl-pos', s[0]));
        line.appendChild(el('span', 'kl-gloss', s[2]));
        body.appendChild(line);
      });
    } else {
      body.appendChild(el('div', 'kl-nogloss',
        'No English definition in the bundled dictionary.'));
    }
    card.appendChild(body);

    var foot = el('div', 'kl-foot');
    var ext = el('a', 'kl-ext', 'kheng.info ↗');
    ext.href = 'https://kheng.info/search/?query=' + encodeURIComponent(m.word);
    ext.target = '_blank';
    ext.rel = 'noopener noreferrer';
    foot.appendChild(ext);

    if (settings.ankiEnabled) {
      var anki = el('button', 'kl-anki', '★ Anki');
      anki.type = 'button';
      anki.title = 'Add this word to your Anki deck (A)';
      anki.addEventListener('click', function (ev) {
        ev.stopPropagation();
        addToAnki();
      });
      foot.appendChild(anki);
    } else {
      // v2 extension point: saved-word list (see docs/DESIGN.md). Disabled
      // affordance kept in the DOM so the layout is ready.
      var save = el('button', 'kl-save', '☆ Save');
      save.disabled = true;
      save.title = 'Word list coming in v2';
      foot.appendChild(save);
    }

    var keys = '⇧ alts · C copy · N next';
    if (audioMode) keys += ' · S sound';
    if (settings.ankiEnabled) keys += ' · A anki';
    foot.appendChild(el('span', 'kl-keys', keys));
    card.appendChild(foot);
  }

  function showPopupAt(x, y) {
    card.classList.remove('kl-hidden');
    // measure, then position (card must be visible to measure)
    card.style.left = '-9999px';
    card.style.top = '0px';
    var rect = card.getBoundingClientRect();
    var pos = popupMath.positionPopup({
      cursorX: x, cursorY: y,
      popupW: rect.width, popupH: rect.height,
      viewportW: window.innerWidth, viewportH: window.innerHeight,
    });
    card.style.left = pos.left + 'px';
    card.style.top = pos.top + 'px';
    visible = true;
  }

  function hidePopup() {
    if (!visible) return;
    visible = false;
    current = null;
    if (card) card.classList.add('kl-hidden');
    clearHighlight();
  }

  // -------------------------------------------------------------- highlight
  function ensureHighlightStyle() {
    if (highlightStyleEl && highlightStyleEl.isConnected) return;
    highlightStyleEl = document.createElement('style');
    highlightStyleEl.textContent =
      '::highlight(khmerlens){background-color:rgba(255,200,60,.45);}' +
      '@media (prefers-color-scheme: dark){' +
      '::highlight(khmerlens){background-color:rgba(255,190,40,.35);}}';
    (document.head || document.documentElement).appendChild(highlightStyleEl);
  }

  function setHighlight(node, start, end) {
    if (!settings.highlight || typeof Highlight === 'undefined' ||
        !CSS.highlights) return;
    try {
      ensureHighlightStyle();
      var range = new Range();
      range.setStart(node, start);
      range.setEnd(node, end);
      CSS.highlights.set('khmerlens', new Highlight(range));
    } catch (e) { /* node may be gone */ }
  }

  function clearHighlight() {
    try {
      if (CSS.highlights) CSS.highlights.delete('khmerlens');
    } catch (e) { /* ignore */ }
  }

  // ---------------------------------------------------------------- lookup
  function caretAt(x, y) {
    if (document.caretPositionFromPoint) {
      var p = document.caretPositionFromPoint(x, y);
      if (p) return { node: p.offsetNode, offset: p.offset };
    }
    if (document.caretRangeFromPoint) {
      var r = document.caretRangeFromPoint(x, y);
      if (r) return { node: r.startContainer, offset: r.startOffset };
    }
    return null;
  }

  function lookupAt(x, y) {
    var caret = caretAt(x, y);
    if (!caret || !caret.node || caret.node.nodeType !== Node.TEXT_NODE) {
      hidePopup();
      return;
    }
    var text = caret.node.data;
    var offset = Math.min(caret.offset, text.length - 1);
    if (offset < 0) { hidePopup(); return; }

    // caret can land just past the hovered char; also check offset-1
    var probe = offset;
    if (!core.isKhmerLetter(text[probe]) && probe > 0 &&
        core.isKhmerLetter(text[probe - 1])) {
      probe = offset - 1;
    }
    if (!core.isKhmerLetter(text[probe])) { hidePopup(); return; }

    var matches = core.findMatches(text, probe, dict.has.bind(dict), dict.maxWordLen)
      .filter(function (m) {
        var s = dict.senses(m.word);
        return s !== null; // includes gloss-less known words
      });

    // Prefer glossed matches, but never let a glossed single letter beat a
    // longer word (a learner wants the word boundary, not the alphabet).
    // Stable sort preserves the longest-first order within each score.
    var score = function (m) {
      var glossed = (dict.senses(m.word) || []).length ? 0 : 1;
      var single = m.word.length === 1 ? 2 : 0;
      return glossed + single;
    };
    matches.sort(function (a, b) { return score(a) - score(b); });

    if (!matches.length) {
      var fb = core.icuFallback(text, probe);
      if (fb) matches = [fb];
    }
    if (!matches.length) { hidePopup(); return; }

    // avoid re-render if same match under cursor
    var m0 = matches[0];
    if (visible && current && current.node === caret.node &&
        current.matches[current.index].start === m0.start &&
        current.matches[current.index].end === m0.end) {
      current.cursorX = x; current.cursorY = y;
      return;
    }

    current = { matches: matches, index: 0, node: caret.node, cursorX: x, cursorY: y };
    renderPopup();
    showPopupAt(x, y);
    setHighlight(caret.node, m0.start, m0.end);
  }

  // ---------------------------------------------------------------- events
  function onMouseMove(ev) {
    if (!enabled) return;
    // ignore moves over our own popup (e.g. reaching for the kheng.info
    // link) so the popup doesn't hide or re-render underneath the cursor
    if (host && (ev.target === host || host.contains(ev.target))) return;
    lastMouse.x = ev.clientX;
    lastMouse.y = ev.clientY;
    if (hoverTimer) clearTimeout(hoverTimer);
    hoverTimer = setTimeout(function () {
      hoverTimer = 0;
      if (!dict) {
        ensureDict().then(function () { lookupAt(lastMouse.x, lastMouse.y); });
      } else {
        lookupAt(lastMouse.x, lastMouse.y);
      }
    }, 50);
  }

  function isEditable(target) {
    if (!target) return false;
    if (target.isContentEditable) return true;
    var tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  function onKeyDown(ev) {
    if (!enabled || !visible || !current) return;
    if (isEditable(ev.target)) return;

    if (ev.key === 'Escape') {
      hidePopup();
      return;
    }
    if (ev.key === 'Shift' && current.matches.length > 1) {
      current.index = (current.index + 1) % current.matches.length;
      var m = current.matches[current.index];
      renderPopup();
      showPopupAt(current.cursorX, current.cursorY);
      setHighlight(current.node, m.start, m.end);
      ev.preventDefault();
      return;
    }
    if (ev.key === 'c' && !ev.metaKey && !ev.ctrlKey && !ev.altKey) {
      copyCurrent();
      ev.preventDefault();
      return;
    }
    if (ev.key === 'n' && !ev.metaKey && !ev.ctrlKey && !ev.altKey) {
      nextWord();
      ev.preventDefault();
      return;
    }
    if (ev.key === 's' && !ev.metaKey && !ev.ctrlKey && !ev.altKey) {
      speakCurrent();
      ev.preventDefault();
      return;
    }
    if (ev.key === 'a' && !ev.metaKey && !ev.ctrlKey && !ev.altKey &&
        settings.ankiEnabled) {
      addToAnki();
      ev.preventDefault();
    }
  }

  function copyCurrent() {
    var m = current.matches[current.index];
    var senses = dict ? dict.senses(m.word) || [] : [];
    var lines = [m.word];
    senses.forEach(function (s) {
      var parts = [];
      if (s[1]) parts.push(s[1]);
      if (s[0]) parts.push('(' + s[0] + ')');
      parts.push(s[2]);
      lines.push(parts.join(' '));
    });
    var payload = lines.join('\n');
    function fallbackCopy() {
      // execCommand path for non-secure contexts (plain http pages)
      try {
        var ta = document.createElement('textarea');
        ta.value = payload;
        ta.style.cssText = 'position:fixed;left:-9999px;top:0;';
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        ta.remove();
        flashFoot(ok ? 'Copied ✓' : 'Copy failed');
      } catch (e) { flashFoot('Copy failed'); }
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(payload).then(function () {
        flashFoot('Copied ✓');
      }, fallbackCopy);
    } else {
      fallbackCopy();
    }
  }

  function flashFoot(msg) {
    if (!card) return;
    var keys = card.querySelector('.kl-keys');
    if (keys) {
      var old = keys.textContent;
      keys.textContent = msg;
      setTimeout(function () { keys.textContent = old; }, 1200);
    }
  }

  /** Jump the popup to the next dictionary word after the current match. */
  function nextWord() {
    var m = current.matches[current.index];
    var node = current.node;
    var text = node.data;
    for (var i = m.end; i < text.length; i++) {
      if (core.isKhmerLetter(text[i])) {
        var matches = core.findMatches(text, i, dict.has.bind(dict), dict.maxWordLen);
        if (matches.length) {
          var range = new Range();
          range.setStart(node, matches[0].start);
          range.setEnd(node, matches[0].end);
          var r = range.getBoundingClientRect();
          current = {
            matches: matches, index: 0, node: node,
            cursorX: r.left, cursorY: r.bottom,
          };
          renderPopup();
          showPopupAt(r.left, r.bottom);
          setHighlight(node, matches[0].start, matches[0].end);
          return;
        }
      }
    }
    flashFoot('End of text');
  }

  function onScrollOrResize() {
    if (visible) hidePopup();
  }

  // -------------------------------------------------------- enable/disable
  function setEnabled(on) {
    if (on === enabled) return;
    enabled = on;
    if (enabled) {
      buildPopup();
      loadSettings();
      ensureAudio(); // small index + voice probe; safe in every frame
      // preload the dictionary only in the top frame; subframes load lazily
      // on first hover (all_frames would otherwise parse 1.8 MB per iframe)
      if (window === window.top) ensureDict();
      document.addEventListener('mousemove', onMouseMove, true);
      document.addEventListener('keydown', onKeyDown, true);
      window.addEventListener('scroll', onScrollOrResize, true);
      window.addEventListener('resize', onScrollOrResize);
      document.addEventListener('mouseleave', hidePopup);
    } else {
      document.removeEventListener('mousemove', onMouseMove, true);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
      document.removeEventListener('mouseleave', hidePopup);
      hidePopup();
    }
  }

  chrome.runtime.onMessage.addListener(function (msg) {
    if (msg && msg.type === 'khmerlens:setEnabled') {
      setEnabled(!!msg.enabled);
    }
  });

  // ask background for this tab's state (handles mid-session injection and
  // iframes created after toggle)
  try {
    chrome.runtime.sendMessage({ type: 'khmerlens:getEnabled' }, function (resp) {
      if (!chrome.runtime.lastError && resp && resp.enabled) setEnabled(true);
    });
  } catch (e) { /* extension context gone */ }

  // fetch popup CSS once (shadow DOM styles)
  fetch(chrome.runtime.getURL('content/popup.css'))
    .then(function (r) { return r.text(); })
    .then(function (css) {
      POPUP_CSS = css;
      if (shadow) {
        var style = shadow.querySelector('style');
        if (style) style.textContent = css;
      }
    })
    .catch(function () { /* keep fallback */ });

  /**
   * v2 extension point: audio pronunciation.
   * Implementations register via KhmerLensAudio.register(provider) where
   * provider = { canSpeak(word) -> bool, speak(word) -> Promise }.
   * The popup layout reserves .kl-head space for a speaker button.
   */
  globalThis.KhmerLensAudio = {
    provider: null,
    register: function (p) { this.provider = p; },
  };

  // Test hook: only exposed when a harness sets the flag before injection.
  // Lets the browser integration test drive the content script directly
  // without simulating the (un-simulatable) toolbar click.
  if (globalThis.__khmerLensTest) {
    globalThis.KhmerLensTest = {
      setEnabled: setEnabled,
      isVisible: function () { return visible; },
    };
  }
})();
