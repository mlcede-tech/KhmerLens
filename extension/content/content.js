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
  var khengApi = globalThis.KhmerLensKheng; // kheng.info parser (lib/kheng.js)

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
    khengEnabled: false,
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
    var bundled = dict ? dict.senses(m.word) : null;
    var entry;
    // Prefer a live kheng.info definition when the bundled dictionary has no
    // glosses for this word — kheng.js senses share the [pos, roman, gloss]
    // shape lib/anki.js expects, so no field mapping is needed here.
    if (m.khengSenses && !(bundled && bundled.length)) {
      entry = { word: m.khengLemma || m.word, senses: m.khengSenses };
    } else {
      entry = { word: m.word, senses: bundled || [] };
    }
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

  // ------------------------------------------------------------- kheng.info
  // Fetched definitions are cached so repeat hovers don't refetch. A session
  // mirror (khengMem) fronts a chrome.storage.local store capped to the newest
  // entries via a stored insertion-order list. All storage access is wrapped:
  // failures fall back to the network, never break the lookup.
  var KHENG_CACHE_MAX = 500;
  var khengMem = {};      // word -> { senses, lemma }
  var khengOrder = [];    // insertion order of words, oldest first

  try {
    chrome.storage.local.get('khengCache', function (items) {
      if (chrome.runtime.lastError || !items || !items.khengCache) return;
      var store = items.khengCache;
      for (var w in store) {
        if (Object.prototype.hasOwnProperty.call(store, w) && store[w]) {
          khengMem[w] = store[w];
          khengOrder.push(w);
        }
      }
    });
  } catch (e) { /* storage unavailable: memory cache still works */ }

  function khengCacheGet(word) {
    return khengMem[word] || null;
  }

  function khengCachePut(word, senses, lemma) {
    khengMem[word] = { senses: senses, lemma: lemma };
    var i = khengOrder.indexOf(word);
    if (i !== -1) khengOrder.splice(i, 1);
    khengOrder.push(word);
    while (khengOrder.length > KHENG_CACHE_MAX) {
      delete khengMem[khengOrder.shift()];
    }
    try {
      var store = {};
      khengOrder.forEach(function (w) { store[w] = khengMem[w]; });
      chrome.storage.local.set({ khengCache: store });
    } catch (e) { /* non-fatal: memory cache still holds it this session */ }
  }

  /**
   * Whether the kheng.info affordance applies to the current match: true when
   * the bundled dictionary has no glosses (a gloss-less known word or the
   * no-match ICU fallback). Shared by the render and the keyboard shortcut so
   * they stay in lockstep.
   */
  function khengApplicable() {
    if (!current) return false;
    var m = current.matches[current.index];
    var senses = dict ? dict.senses(m.word) || [] : [];
    return senses.length === 0;
  }

  function lookupKheng() {
    if (!current) return;
    var m = current.matches[current.index];
    var word = m.word;

    var cached = khengCacheGet(word);
    if (cached) {
      m.khengSenses = cached.senses;
      m.khengLemma = cached.lemma;
      renderPopup();
      showPopupAt(current.cursorX, current.cursorY);
      return;
    }

    flashFoot('Looking up…');
    try {
      chrome.runtime.sendMessage(
        { type: 'khmerlens:khengLookup', word: word },
        function (resp) {
          if (chrome.runtime.lastError || !resp) {
            flashFoot('kheng.info unreachable');
            return;
          }
          if (resp.ok) {
            var doc = new DOMParser().parseFromString(resp.html, 'text/html');
            var r = khengApi.parseKhengDefinition(doc, word);
            if (r.found) {
              m.khengSenses = r.senses;
              m.khengLemma = r.lemma;
              khengCachePut(word, r.senses, r.lemma);
              // still current match? (cursor may have moved during the fetch)
              if (current && current.matches[current.index] === m) {
                renderPopup();
                showPopupAt(current.cursorX, current.cursorY);
              }
            } else {
              flashFoot('Not found on kheng.info');
            }
          } else if (resp.status === 'no-permission') {
            flashFoot('Enable kheng.info lookup in options');
          } else {
            flashFoot('kheng.info unreachable');
          }
        }
      );
    } catch (e) { flashFoot('kheng.info unreachable'); }
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
    // Fall back to a live kheng.info definition once one has been fetched for
    // this match, so it renders through the same sense-line path as the dict.
    if (!senses.length && m.khengSenses) senses = m.khengSenses;
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

    foot.appendChild(el('span', 'kl-status'));

    var actions = el('div', 'kl-actions');

    if (current.matches.length > 1) {
      var alt = el('button', 'kl-act kl-alt-btn', '⇧ Alt');
      alt.type = 'button';
      alt.title = 'Cycle alternate segmentations (Shift)';
      alt.addEventListener('click', function (ev) {
        ev.stopPropagation();
        cycleMatch();
      });
      actions.appendChild(alt);
    }

    var copyBtn = el('button', 'kl-act kl-copy', 'C Copy');
    copyBtn.type = 'button';
    copyBtn.title = 'Copy word + definition (C)';
    copyBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      copyCurrent();
    });
    actions.appendChild(copyBtn);

    var nextBtn = el('button', 'kl-act kl-next', 'N Next');
    nextBtn.type = 'button';
    nextBtn.title = 'Jump to next dictionary word (N)';
    nextBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      nextWord();
    });
    actions.appendChild(nextBtn);

    // Live kheng.info lookup: only offered when the bundled dictionary has no
    // gloss for this word (khengApplicable). The external link + "No English
    // definition" message stay; this button is the live-fetch affordance.
    if (settings.khengEnabled && khengApplicable()) {
      var khengBtn = el('button', 'kl-act kl-kheng', 'K kheng.info');
      khengBtn.type = 'button';
      khengBtn.title = 'Fetch definition from kheng.info (K)';
      khengBtn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        lookupKheng();
      });
      actions.appendChild(khengBtn);
    }

    if (settings.ankiEnabled) {
      var anki = el('button', 'kl-act kl-anki', 'A Anki');
      anki.type = 'button';
      anki.title = 'Add to Anki (A)';
      anki.addEventListener('click', function (ev) {
        ev.stopPropagation();
        addToAnki();
      });
      actions.appendChild(anki);
    } else {
      // v2 extension point: saved-word list (see docs/DESIGN.md). Disabled
      // affordance kept in the DOM so the layout is ready.
      var save = el('button', 'kl-act kl-save', '☆ Save');
      save.disabled = true;
      save.title = 'Word list coming in v2';
      actions.appendChild(save);
    }

    foot.appendChild(actions);
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
    if (current) {
      current.popupRect = {
        left: pos.left, top: pos.top,
        right: pos.left + rect.width, bottom: pos.top + rect.height,
      };
    }
  }

  // Bounding box enclosing both the hovered word and the open popup, plus a
  // small margin. While the cursor is inside it we leave the popup alone —
  // otherwise every mousemove on the way from the word to e.g. the kheng.info
  // link re-runs the lookup, and since the popup is re-positioned relative to
  // wherever the cursor now is, it keeps hopping just out of reach.
  function inSafeZone(x, y) {
    if (!current || !current.wordRect || !current.popupRect) return false;
    var a = current.wordRect, b = current.popupRect, m = 12;
    var left = Math.min(a.left, b.left) - m;
    var top = Math.min(a.top, b.top) - m;
    var right = Math.max(a.right, b.right) + m;
    var bottom = Math.max(a.bottom, b.bottom) + m;
    return x >= left && x <= right && y >= top && y <= bottom;
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

    var wordRect = null;
    try {
      var wr = new Range();
      wr.setStart(caret.node, m0.start);
      wr.setEnd(caret.node, m0.end);
      wordRect = wr.getBoundingClientRect();
    } catch (e) { /* node may be gone */ }

    current = {
      matches: matches, index: 0, node: caret.node, cursorX: x, cursorY: y,
      wordRect: wordRect, popupRect: null,
    };
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
    // also ignore moves in the gap between the hovered word and the popup —
    // otherwise the cursor's path there keeps re-triggering lookups that
    // reposition (or hide) the popup before it can be reached
    if (visible && inSafeZone(ev.clientX, ev.clientY)) return;
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
    // The paste panel's own editable area is contenteditable, so it would
    // otherwise be caught by the isEditable() guard below and silently eat
    // all of KhmerLens's shortcuts. Let those through for the panel's own
    // editable element specifically; any other editable target (a page's
    // own input, textarea, or contenteditable) still blocks the shortcuts.
    var panel = globalThis.KhmerLensPanel;
    var isPanelEditable = !!(panel && panel.getEditableEl &&
      ev.target === panel.getEditableEl());
    if (!isPanelEditable && isEditable(ev.target)) return;

    if (ev.key === 'Escape') {
      hidePopup();
      return;
    }
    if (ev.key === 'Shift' && current.matches.length > 1) {
      cycleMatch();
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
      return;
    }
    // bare `k`: live kheng.info lookup. Excludes altKey so Alt+K stays the
    // browser toggle; only fires when the button would be shown.
    if (ev.key === 'k' && !ev.metaKey && !ev.ctrlKey && !ev.altKey &&
        settings.khengEnabled && khengApplicable()) {
      lookupKheng();
      ev.preventDefault();
    }
  }

  /** Cycle to the next alternate segmentation for the current cursor spot. */
  function cycleMatch() {
    if (!current || current.matches.length < 2) return;
    current.index = (current.index + 1) % current.matches.length;
    var m = current.matches[current.index];
    try {
      var wr = new Range();
      wr.setStart(current.node, m.start);
      wr.setEnd(current.node, m.end);
      current.wordRect = wr.getBoundingClientRect();
    } catch (e) { /* node may be gone */ }
    renderPopup();
    showPopupAt(current.cursorX, current.cursorY);
    setHighlight(current.node, m.start, m.end);
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
    var status = card.querySelector('.kl-status');
    if (status) {
      var old = status.textContent;
      status.textContent = msg;
      setTimeout(function () { status.textContent = old; }, 1200);
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
            wordRect: r, popupRect: null,
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
      if (window === window.top) {
        ensureDict();
        try { if (globalThis.KhmerLensPanel) globalThis.KhmerLensPanel.open(); } catch (e) { console.debug('KhmerLens panel:', e); }
      }
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
      try { if (globalThis.KhmerLensPanel) globalThis.KhmerLensPanel.close(); } catch (e) { console.debug('KhmerLens panel:', e); }
    }
  }

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg && msg.type === 'khmerlens:setEnabled') {
      setEnabled(!!msg.enabled);
      return;
    }
    if (msg && (msg.type === 'khmerlens:togglePanel' || msg.type === 'khmerlens:getPanelOpen')) {
      var panel = globalThis.KhmerLensPanel;
      if (panel && msg.type === 'khmerlens:togglePanel') panel.toggle();
      sendResponse({ open: !!(panel && panel.isOpen()) });
      return;
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
