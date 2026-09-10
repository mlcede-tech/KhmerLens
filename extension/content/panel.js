/**
 * KhmerLens paste panel: an in-page, light-DOM side panel where the user
 * pastes Khmer text so the hover engine (which reads light-DOM text nodes via
 * caretPositionFromPoint) can translate it. Injected before content.js.
 */
(function () {
  'use strict';

  function normalizePastedText(raw) {
    if (typeof raw !== 'string') return '';
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
    return raw.replace(/\r\n?/g, '\n');
  }

  var api = { normalizePastedText: normalizePastedText };

  // DOM wiring (open/close/toggle/isOpen) is added in later tasks and only
  // runs in a browser; the unit test loads this file under Node for the helper.
  globalThis.KhmerLensPanel = api;
})();
