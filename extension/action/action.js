'use strict';
var toggle = document.getElementById('toggle');
var panelToggle = document.getElementById('panelToggle');
var blocked = document.getElementById('blocked');

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
