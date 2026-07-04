'use strict';

var DEFAULTS = {
  theme: 'auto',
  fontSize: 'medium',
  showRoman: true,
  highlight: true,
};

// chrome.storage.sync when running as an extension; localStorage fallback so
// the page still works when opened as a plain file (e.g. for previewing).
var store = (function () {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    return {
      get: function (d, cb) { chrome.storage.sync.get(d, cb); },
      set: function (v, cb) { chrome.storage.sync.set(v, cb); },
    };
  }
  return {
    get: function (d, cb) {
      var out = {};
      Object.keys(d).forEach(function (k) {
        var raw = localStorage.getItem('kl_' + k);
        out[k] = raw === null ? d[k] : JSON.parse(raw);
      });
      cb(out);
    },
    set: function (v, cb) {
      Object.keys(v).forEach(function (k) {
        localStorage.setItem('kl_' + k, JSON.stringify(v[k]));
      });
      if (cb) cb();
    },
  };
})();

var state = Object.assign({}, DEFAULTS);
var preview = document.getElementById('preview');
var previewRoman = document.getElementById('preview-roman');

var savedTimer = 0;
function flashSaved() {
  var el = document.getElementById('saved');
  el.classList.add('show');
  clearTimeout(savedTimer);
  savedTimer = setTimeout(function () { el.classList.remove('show'); }, 1400);
}

function resolveDark(theme) {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function renderPreview() {
  preview.classList.remove('kl-fs-small', 'kl-fs-medium', 'kl-fs-large');
  preview.classList.add('kl-fs-' + state.fontSize);
  preview.classList.remove('force-light', 'force-dark');
  preview.classList.add(resolveDark(state.theme) ? 'force-dark' : 'force-light');
  previewRoman.classList.toggle('hidden', !state.showRoman);
}

// --- segmented controls -------------------------------------------------
var segments = {};
document.querySelectorAll('.segmented').forEach(function (seg) {
  var name = seg.dataset.name;
  var btns = Array.prototype.slice.call(seg.querySelectorAll('button'));
  var thumb = seg.querySelector('.thumb');
  segments[name] = { seg: seg, btns: btns, thumb: thumb };

  btns.forEach(function (btn, i) {
    btn.addEventListener('click', function () { selectSegment(name, btn.dataset.value); });
    btn.addEventListener('keydown', function (ev) {
      var dir = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0;
      if (!dir) return;
      ev.preventDefault();
      var next = btns[(i + dir + btns.length) % btns.length];
      selectSegment(name, next.dataset.value);
      next.focus();
    });
  });
});

function paintSegment(name) {
  var s = segments[name];
  var idx = 0;
  s.btns.forEach(function (btn, i) {
    var on = btn.dataset.value === state[name];
    btn.setAttribute('aria-checked', on ? 'true' : 'false');
    btn.tabIndex = on ? 0 : -1;
    if (on) idx = i;
  });
  s.thumb.style.setProperty('--i', idx);
}

function selectSegment(name, value) {
  state[name] = value;
  paintSegment(name);
  renderPreview();
  save();
}

// --- toggles ------------------------------------------------------------
['showRoman', 'highlight'].forEach(function (id) {
  document.getElementById(id).addEventListener('change', function (e) {
    state[id] = e.target.checked;
    renderPreview();
    save();
  });
});

function save() {
  store.set({
    theme: state.theme,
    fontSize: state.fontSize,
    showRoman: state.showRoman,
    highlight: state.highlight,
  }, flashSaved);
}

// react to system theme changes while 'auto' is selected
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
  if (state.theme === 'auto') renderPreview();
});

// --- init ---------------------------------------------------------------
store.get(DEFAULTS, function (items) {
  state = Object.assign({}, DEFAULTS, items);
  document.getElementById('showRoman').checked = state.showRoman;
  document.getElementById('highlight').checked = state.highlight;
  paintSegment('theme');
  paintSegment('fontSize');
  renderPreview();
});
