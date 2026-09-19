'use strict';
var toggle = document.getElementById('toggle');
var panelToggle = document.getElementById('panelToggle');
var ankiToggle = document.getElementById('ankiToggle');
var khengToggle = document.getElementById('khengToggle');
var blocked = document.getElementById('blocked');
var settingsLink = document.getElementById('settings');

var ANKI_ORIGINS = ['http://127.0.0.1/*', 'http://localhost/*'];
var KHENG_ORIGINS = ['https://kheng.info/*'];

// --- theme: honor the stored setting the way the lookup card does ---------
function resolveDark(theme) {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyTheme(theme) {
  var root = document.documentElement;
  root.classList.remove('force-light', 'force-dark');
  // 'auto' adds no class, so the prefers-color-scheme media query governs.
  if (theme === 'light') root.classList.add('force-light');
  else if (theme === 'dark') root.classList.add('force-dark');
}

// --- permission helpers (mirror options.js) -------------------------------
function requestPermission(origins) {
  if (typeof chrome === 'undefined' || !chrome.permissions) {
    return Promise.resolve(true);
  }
  return new Promise(function (resolve) {
    chrome.permissions.request({ origins: origins }, function (granted) {
      resolve(!!granted);
    });
  });
}

function removePermission(origins) {
  if (typeof chrome === 'undefined' || !chrome.permissions) {
    return Promise.resolve();
  }
  return new Promise(function (resolve) {
    chrome.permissions.remove({ origins: origins }, function () { resolve(); });
  });
}

function hasPermission(origins) {
  if (typeof chrome === 'undefined' || !chrome.permissions) {
    return Promise.resolve(true);
  }
  return new Promise(function (resolve) {
    chrome.permissions.contains({ origins: origins }, function (has) {
      resolve(!!has);
    });
  });
}

// --- per-tab on/off + paste panel (service worker, unchanged) -------------
function refreshPanelToggle(enabled) {
  panelToggle.disabled = !enabled;
  if (!enabled) { panelToggle.checked = false; return; }
  chrome.runtime.sendMessage({ type: 'khmerlens:getPanelOpen' }, function (resp) {
    if (chrome.runtime.lastError) return;
    panelToggle.checked = !!(resp && resp.open);
  });
}

chrome.runtime.sendMessage({ type: 'khmerlens:getEnabled' }, function (resp) {
  if (chrome.runtime.lastError) return;
  var enabled = !!(resp && resp.enabled);
  toggle.checked = enabled;
  refreshPanelToggle(enabled);
});

toggle.addEventListener('change', function () {
  chrome.runtime.sendMessage({ type: 'khmerlens:toggle' }, function (resp) {
    if (chrome.runtime.lastError || !resp) return;
    toggle.checked = !!resp.enabled;
    if (resp.blocked) { blocked.hidden = false; toggle.checked = false; }
    refreshPanelToggle(toggle.checked);
  });
});

panelToggle.addEventListener('change', function () {
  chrome.runtime.sendMessage({ type: 'khmerlens:togglePanel' }, function (resp) {
    if (chrome.runtime.lastError || !resp) return;
    panelToggle.checked = !!resp.open;
  });
});

// --- Anki export toggle (chrome.storage.sync) -----------------------------
ankiToggle.addEventListener('change', function (e) {
  if (e.target.checked) {
    requestPermission(ANKI_ORIGINS).then(function (granted) {
      if (!granted) { e.target.checked = false; return; }
      chrome.storage.sync.set({ ankiEnabled: true });
    });
  } else {
    // Mirror options.js: flip the flag, leave the host permission in place.
    chrome.storage.sync.set({ ankiEnabled: false });
  }
});

// --- kheng.info lookups toggle --------------------------------------------
khengToggle.addEventListener('change', function (e) {
  if (e.target.checked) {
    requestPermission(KHENG_ORIGINS).then(function (granted) {
      if (!granted) { e.target.checked = false; return; }
      chrome.storage.sync.set({ khengEnabled: true });
    });
  } else {
    removePermission(KHENG_ORIGINS).then(function () {
      chrome.storage.sync.set({ khengEnabled: false });
    });
  }
});

// --- Settings link --------------------------------------------------------
settingsLink.addEventListener('click', function (e) {
  e.preventDefault();
  if (chrome.runtime && chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  }
});

// --- init preference-backed controls --------------------------------------
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
  chrome.storage.sync.get(
    { theme: 'auto', ankiEnabled: false, khengEnabled: false },
    function (items) {
      applyTheme(items.theme);
      ankiToggle.checked = !!items.ankiEnabled;
      // kheng is on only if the flag AND the host permission are present.
      hasPermission(KHENG_ORIGINS).then(function (granted) {
        khengToggle.checked = !!(items.khengEnabled && granted);
      });
    }
  );
}
