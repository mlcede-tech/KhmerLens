/**
 * KhmerLens service worker: per-tab enable state + toolbar badge.
 * State lives in chrome.storage.session so it survives worker suspension
 * but resets when the browser closes.
 */
'use strict';

function getState() {
  return chrome.storage.session.get({ enabledTabs: {} })
    .then(function (o) { return o.enabledTabs; });
}

function setState(enabledTabs) {
  return chrome.storage.session.set({ enabledTabs: enabledTabs });
}

function updateBadge(tabId, on) {
  chrome.action.setBadgeText({ tabId: tabId, text: on ? 'ON' : '' });
  if (on) {
    chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: '#b45309' });
  }
}

function toggleTab(tab) {
  if (!tab || !tab.id) return;
  getState().then(function (enabledTabs) {
    var key = String(tab.id);
    var on = !enabledTabs[key];
    if (on) enabledTabs[key] = true;
    else delete enabledTabs[key];
    setState(enabledTabs).then(function () {
      updateBadge(tab.id, on);
      chrome.tabs.sendMessage(
        tab.id,
        { type: 'khmerlens:setEnabled', enabled: on },
        function () { void chrome.runtime.lastError; } // page may lack content script
      );
    });
  });
}

chrome.action.onClicked.addListener(toggleTab);

chrome.commands.onCommand.addListener(function (command, tab) {
  if (command === 'toggle-khmerlens') toggleTab(tab);
});

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (msg && msg.type === 'khmerlens:getEnabled' && sender.tab && sender.tab.id) {
    getState().then(function (enabledTabs) {
      sendResponse({ enabled: !!enabledTabs[String(sender.tab.id)] });
    });
    return true; // async response
  }
});

// re-assert badge after navigation (badge text persists per tab, but keep
// state consistent if the tab was toggled on)
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo) {
  if (changeInfo.status === 'loading') {
    getState().then(function (enabledTabs) {
      updateBadge(tabId, !!enabledTabs[String(tabId)]);
    });
  }
});

chrome.tabs.onRemoved.addListener(function (tabId) {
  getState().then(function (enabledTabs) {
    if (enabledTabs[String(tabId)]) {
      delete enabledTabs[String(tabId)];
      setState(enabledTabs);
    }
  });
});
