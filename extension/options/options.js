'use strict';

var DEFAULTS = {
  theme: 'auto',
  fontSize: 'medium',
  showRoman: true,
  highlight: true,
  ankiEnabled: false,
  ankiUrl: 'http://127.0.0.1:8765',
  ankiDeck: '',
  ankiModel: '',
  ankiFieldMap: {},
  ankiTags: 'khmerlens',
};

var ANKI_ORIGINS = ['http://127.0.0.1/*', 'http://localhost/*'];

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
    ankiEnabled: state.ankiEnabled,
    ankiUrl: state.ankiUrl,
    ankiDeck: state.ankiDeck,
    ankiModel: state.ankiModel,
    ankiFieldMap: state.ankiFieldMap,
    ankiTags: state.ankiTags,
  }, flashSaved);
}

// --- Anki integration -----------------------------------------------------
var ankiApi = window.KhmerLensAnki;
var ankiUI = {
  toggle: document.getElementById('ankiEnabled'),
  config: document.getElementById('anki-config'),
  url: document.getElementById('ankiUrl'),
  connect: document.getElementById('anki-connect'),
  status: document.getElementById('anki-status'),
  deck: document.getElementById('ankiDeck'),
  model: document.getElementById('ankiModel'),
  fields: document.getElementById('anki-fields'),
  tags: document.getElementById('ankiTags'),
  origin: document.getElementById('anki-origin'),
};

function ankiStatus(msg, kind) {
  ankiUI.status.textContent = msg;
  ankiUI.status.className = 'field-help anki-status' + (kind ? ' ' + kind : '');
}

function ankiCall(action, params) {
  return fetch(state.ankiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: action, version: 6, params: params || {} }),
  }).then(function (r) { return r.json(); }).then(function (data) {
    if (data.error) throw new Error(data.error);
    return data.result;
  });
}

function fillSelect(select, names, selected) {
  select.textContent = '';
  names.forEach(function (name) {
    var opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    if (name === selected) opt.selected = true;
    select.appendChild(opt);
  });
  select.disabled = !names.length;
}

function renderFieldMap(fieldNames) {
  ankiUI.fields.textContent = '';
  fieldNames.forEach(function (fieldName) {
    var row = document.createElement('div');
    row.className = 'anki-field-row';
    var label = document.createElement('label');
    label.textContent = fieldName;
    var select = document.createElement('select');
    ankiApi.FIELD_SOURCES.forEach(function (src) {
      var opt = document.createElement('option');
      opt.value = src.id;
      opt.textContent = src.label;
      if ((state.ankiFieldMap[fieldName] || '') === src.id) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener('change', function () {
      state.ankiFieldMap[fieldName] = select.value;
      save();
    });
    row.appendChild(label);
    row.appendChild(select);
    ankiUI.fields.appendChild(row);
  });
}

function loadModelFields() {
  if (!state.ankiModel) return;
  ankiCall('modelFieldNames', { modelName: state.ankiModel }).then(function (names) {
    // keep an existing mapping for this model; otherwise guess one
    var known = Object.keys(state.ankiFieldMap);
    var sameModel = names.length === known.length &&
      names.every(function (n) { return known.indexOf(n) !== -1; });
    if (!sameModel) {
      state.ankiFieldMap = ankiApi.defaultFieldMap(names);
      save();
    }
    renderFieldMap(names);
  }).catch(function (e) {
    ankiStatus('Could not read note type fields: ' + e.message, 'error');
  });
}

function ankiConnect() {
  ankiStatus('Connecting…');
  ankiCall('version').then(function (version) {
    ankiStatus('Connected — AnkiConnect v' + version, 'ok');
    return Promise.all([ankiCall('deckNames'), ankiCall('modelNames')]);
  }).then(function (res) {
    var decks = res[0], models = res[1];
    if (!state.ankiDeck || decks.indexOf(state.ankiDeck) === -1) {
      state.ankiDeck = decks[0] || '';
    }
    if (!state.ankiModel || models.indexOf(state.ankiModel) === -1) {
      state.ankiModel = models[0] || '';
    }
    fillSelect(ankiUI.deck, decks, state.ankiDeck);
    fillSelect(ankiUI.model, models, state.ankiModel);
    save();
    loadModelFields();
  }).catch(function (e) {
    ankiStatus('Could not reach AnkiConnect (' + e.message + '). ' +
      'Is Anki open with the add-on installed? See troubleshooting below.', 'error');
  });
}

function requestAnkiPermission() {
  if (typeof chrome === 'undefined' || !chrome.permissions) {
    return Promise.resolve(true); // plain-file preview
  }
  return new Promise(function (resolve) {
    chrome.permissions.request({ origins: ANKI_ORIGINS }, function (granted) {
      resolve(!!granted);
    });
  });
}

function paintAnki() {
  ankiUI.toggle.checked = state.ankiEnabled;
  ankiUI.config.hidden = !state.ankiEnabled;
  ankiUI.url.value = state.ankiUrl;
  ankiUI.tags.value = state.ankiTags;
  if (ankiUI.origin && typeof chrome !== 'undefined' && chrome.runtime) {
    ankiUI.origin.textContent = 'chrome-extension://' + chrome.runtime.id;
  }
}

ankiUI.toggle.addEventListener('change', function (e) {
  if (e.target.checked) {
    requestAnkiPermission().then(function (granted) {
      if (!granted) {
        e.target.checked = false;
        ankiStatus('Permission to reach 127.0.0.1 was declined.', 'error');
        return;
      }
      state.ankiEnabled = true;
      paintAnki();
      save();
      ankiConnect();
    });
  } else {
    state.ankiEnabled = false;
    paintAnki();
    save();
  }
});

ankiUI.connect.addEventListener('click', ankiConnect);

ankiUI.url.addEventListener('change', function () {
  state.ankiUrl = ankiUI.url.value.trim() || DEFAULTS.ankiUrl;
  ankiUI.url.value = state.ankiUrl;
  save();
});

ankiUI.tags.addEventListener('change', function () {
  state.ankiTags = ankiUI.tags.value.trim();
  save();
});

ankiUI.deck.addEventListener('change', function () {
  state.ankiDeck = ankiUI.deck.value;
  save();
});

ankiUI.model.addEventListener('change', function () {
  state.ankiModel = ankiUI.model.value;
  state.ankiFieldMap = {};
  loadModelFields();
});

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
  paintAnki();
  if (state.ankiEnabled) ankiConnect();
});
