/**
 * KhmerLens service worker.
 *
 * Injection model: activeTab + scripting (no host permissions). The content
 * script is injected only when the user activates KhmerLens on a tab (toolbar
 * click or the Alt+K command), which grants a temporary activeTab permission.
 * activeTab is revoked when the tab navigates, so we clear the tab's state on
 * navigation and the user re-activates on the new page.
 *
 * State lives in chrome.storage.session so it survives worker suspension but
 * resets when the browser closes:
 *   enabledTabs[tabId]  = true   -> KhmerLens is on for this tab
 *   injectedTabs[tabId] = true   -> content scripts are present in this tab
 */
'use strict';

importScripts('lib/anki.js');

var CONTENT_FILES = [
  'lib/khmer.js',
  'lib/dictionary.js',
  'lib/popup.js',
  'lib/audio.js',
  'lib/anki.js',
  'content/content.js',
];

var ANKI_DEFAULTS = {
  ankiEnabled: false,
  ankiUrl: 'http://127.0.0.1:8765',
  ankiDeck: '',
  ankiModel: '',
  ankiFieldMap: {},
  ankiTags: 'khmerlens',
};

/**
 * Add the hovered word to the user's Anki deck via AnkiConnect.
 * Runs here because content scripts can't reach 127.0.0.1 (page CSP/CORS);
 * the extension's optional host permission applies to worker fetches.
 */
async function ankiAdd(entry) {
  var settings = await chrome.storage.sync.get(ANKI_DEFAULTS);
  if (!settings.ankiEnabled) return { ok: false, status: 'disabled' };
  var invalid = KhmerLensAnki.validateSettings(settings);
  if (invalid) return { ok: false, status: 'unconfigured', message: invalid };

  try {
    var resp = await fetch(settings.ankiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(KhmerLensAnki.buildAddNote(settings, entry)),
    });
    var data = await resp.json();
    if (data.error) {
      return { ok: false, status: KhmerLensAnki.classifyError(data.error), message: data.error };
    }
    return { ok: true, noteId: data.result };
  } catch (e) {
    return { ok: false, status: KhmerLensAnki.classifyError(e && e.message), message: String(e) };
  }
}

function getSession() {
  return chrome.storage.session.get({ enabledTabs: {}, injectedTabs: {} });
}

function updateBadge(tabId, on) {
  chrome.action.setBadgeText({ tabId: tabId, text: on ? 'ON' : '' });
  if (on) {
    chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: '#b45309' });
  }
}

function injectInto(tabId) {
  return chrome.scripting.executeScript({
    target: { tabId: tabId, allFrames: true },
    files: CONTENT_FILES,
  });
}

async function toggleTab(tab) {
  if (!tab || !tab.id) return;
  var tabId = tab.id;
  var key = String(tabId);
  var s = await getSession();
  var turningOn = !s.enabledTabs[key];

  if (turningOn) {
    // Record enabled state BEFORE injecting: the content script asks us for
    // its state on load (getEnabled) and self-enables from the answer.
    s.enabledTabs[key] = true;
    await chrome.storage.session.set({ enabledTabs: s.enabledTabs });

    if (!s.injectedTabs[key]) {
      try {
        await injectInto(tabId);
        s.injectedTabs[key] = true;
        await chrome.storage.session.set({ injectedTabs: s.injectedTabs });
      } catch (e) {
        // restricted page (chrome://, Web Store, PDF viewer, etc.)
        delete s.enabledTabs[key];
        await chrome.storage.session.set({ enabledTabs: s.enabledTabs });
        chrome.action.setBadgeText({ tabId: tabId, text: '' });
        chrome.action.setTitle({
          tabId: tabId,
          title: 'KhmerLens can’t run on this page',
        });
        return;
      }
    } else {
      // already injected (e.g. toggled off then on without navigating)
      sendEnabled(tabId, true);
    }
    updateBadge(tabId, true);
  } else {
    delete s.enabledTabs[key];
    await chrome.storage.session.set({ enabledTabs: s.enabledTabs });
    sendEnabled(tabId, false);
    updateBadge(tabId, false);
  }
}

function sendEnabled(tabId, enabled) {
  chrome.tabs.sendMessage(
    tabId,
    { type: 'khmerlens:setEnabled', enabled: enabled },
    function () { void chrome.runtime.lastError; }
  );
}

chrome.action.onClicked.addListener(toggleTab);

chrome.commands.onCommand.addListener(function (command, tab) {
  if (command === 'toggle-khmerlens') toggleTab(tab);
});

// Content script asks for its tab's state right after injection.
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (msg && msg.type === 'khmerlens:getEnabled' && sender.tab && sender.tab.id) {
    getSession().then(function (s) {
      sendResponse({ enabled: !!s.enabledTabs[String(sender.tab.id)] });
    });
    return true; // async response
  }
  if (msg && msg.type === 'khmerlens:ankiAdd' && msg.entry) {
    ankiAdd(msg.entry).then(sendResponse);
    return true; // async response
  }
});

// Navigation revokes activeTab and tears down injected scripts: clear the
// tab's state so the user re-activates on the new page.
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo) {
  if (changeInfo.status !== 'loading') return;
  var key = String(tabId);
  getSession().then(function (s) {
    if (!s.enabledTabs[key] && !s.injectedTabs[key]) return;
    delete s.enabledTabs[key];
    delete s.injectedTabs[key];
    chrome.storage.session.set({
      enabledTabs: s.enabledTabs,
      injectedTabs: s.injectedTabs,
    });
    chrome.action.setBadgeText({ tabId: tabId, text: '' });
  });
});

chrome.tabs.onRemoved.addListener(function (tabId) {
  var key = String(tabId);
  getSession().then(function (s) {
    if (!s.enabledTabs[key] && !s.injectedTabs[key]) return;
    delete s.enabledTabs[key];
    delete s.injectedTabs[key];
    chrome.storage.session.set({
      enabledTabs: s.enabledTabs,
      injectedTabs: s.injectedTabs,
    });
  });
});
