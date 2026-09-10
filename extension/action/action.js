'use strict';
var toggle = document.getElementById('toggle');
var blocked = document.getElementById('blocked');

function queryActiveTab(cb) {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    cb(tabs && tabs[0]);
  });
}

chrome.runtime.sendMessage({ type: 'khmerlens:getEnabled' }, function (resp) {
  if (chrome.runtime.lastError) return;
  toggle.checked = !!(resp && resp.enabled);
});

toggle.addEventListener('change', function () {
  chrome.runtime.sendMessage({ type: 'khmerlens:toggle' }, function (resp) {
    if (chrome.runtime.lastError || !resp) return;
    toggle.checked = !!resp.enabled;
    if (resp.blocked) { blocked.hidden = false; toggle.checked = false; }
  });
});
