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

  // ---------------------------------------------------------------------
  // DOM wiring: builds a light-DOM side panel (not shadow DOM) so the hover
  // engine's caretPositionFromPoint() in content.js can see pasted text.
  // Isolation is achieved via `all: initial` on the root plus scoping every
  // rule under #khmerlens-panel, instead of shadow DOM encapsulation.
  // ---------------------------------------------------------------------

  var PANEL_CSS =
    '#khmerlens-panel {' +
    '  all: initial;' +
    '  position: fixed;' +
    '  top: 12px;' +
    '  right: 12px;' +
    '  width: 340px;' +
    '  max-height: 80vh;' +
    '  z-index: 2147483646;' +
    '  display: flex;' +
    '  flex-direction: column;' +
    '  background: #ffffff;' +
    '  border: 1px solid #d0d0d0;' +
    '  border-radius: 8px;' +
    '  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);' +
    '  font-family: Arial, sans-serif;' +
    '  color: #1a1a1a;' +
    '}' +
    '#khmerlens-panel[hidden] {' +
    '  display: none;' +
    '}' +
    '#khmerlens-panel * {' +
    '  box-sizing: border-box;' +
    '}' +
    '#khmerlens-panel .klp-header {' +
    '  display: flex;' +
    '  align-items: center;' +
    '  gap: 8px;' +
    '  padding: 8px 10px;' +
    '  border-bottom: 1px solid #e0e0e0;' +
    '  background: #f5f5f5;' +
    '  border-radius: 8px 8px 0 0;' +
    '}' +
    '#khmerlens-panel .klp-title {' +
    '  flex: 1;' +
    '  font-size: 13px;' +
    '  font-weight: bold;' +
    '  white-space: nowrap;' +
    '  overflow: hidden;' +
    '  text-overflow: ellipsis;' +
    '}' +
    '#khmerlens-panel button {' +
    '  all: unset;' +
    '  cursor: pointer;' +
    '  font-family: Arial, sans-serif;' +
    '  font-size: 13px;' +
    '  padding: 4px 8px;' +
    '  border-radius: 4px;' +
    '  color: #1a1a1a;' +
    '}' +
    '#khmerlens-panel button:hover {' +
    '  background: #e0e0e0;' +
    '}' +
    '#khmerlens-panel .klp-close {' +
    '  font-size: 16px;' +
    '  line-height: 1;' +
    '  padding: 2px 8px;' +
    '}' +
    '#khmerlens-panel .klp-body {' +
    '  overflow: auto;' +
    '  min-height: 160px;' +
    '  flex: 1;' +
    '  padding: 12px;' +
    '  font-size: 18px;' +
    '  line-height: 2.0;' +
    '  outline: none;' +
    '  white-space: pre-wrap;' +
    '  word-break: break-word;' +
    '}';

  var panelRoot = null;
  var editableEl = null;

  function injectStyle() {
    if (document.getElementById('khmerlens-panel-style')) return;
    var style = document.createElement('style');
    style.id = 'khmerlens-panel-style';
    style.textContent = PANEL_CSS;
    document.head.appendChild(style);
  }

  function build() {
    injectStyle();

    var root = document.createElement('div');
    root.id = 'khmerlens-panel';

    var header = document.createElement('div');
    header.className = 'klp-header';

    var title = document.createElement('span');
    title.className = 'klp-title';
    title.textContent = 'KhmerLens - paste Khmer here';

    var clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.textContent = 'Clear';

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'klp-close';
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', 'Close');

    header.appendChild(title);
    header.appendChild(clearBtn);
    header.appendChild(closeBtn);

    var editable = document.createElement('div');
    editable.className = 'klp-body';
    editable.setAttribute('contenteditable', 'plaintext-only');
    editable.setAttribute('spellcheck', 'false');
    editable.setAttribute('dir', 'auto');

    clearBtn.addEventListener('click', function () {
      editable.textContent = '';
    });

    closeBtn.addEventListener('click', function () {
      close();
    });

    editable.addEventListener('paste', function (e) {
      e.preventDefault();
      var raw = (e.clipboardData || window.clipboardData).getData('text/plain');
      var text = normalizePastedText(raw);
      var sel = window.getSelection();
      if (!sel || !sel.rangeCount) {
        editable.appendChild(document.createTextNode(text));
        return;
      }
      var range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    });

    root.appendChild(header);
    root.appendChild(editable);
    document.body.appendChild(root);

    panelRoot = root;
    editableEl = editable;
  }

  function open() {
    if (window !== window.top) return;
    if (!panelRoot) build();
    panelRoot.hidden = false;
  }

  function close() {
    if (panelRoot) panelRoot.hidden = true;
  }

  function toggle() {
    if (isOpen()) {
      close();
    } else {
      open();
    }
  }

  function isOpen() {
    return !!panelRoot && !panelRoot.hidden;
  }

  function getEditableEl() {
    return editableEl;
  }

  api.open = open;
  api.close = close;
  api.toggle = toggle;
  api.isOpen = isOpen;
  api.getEditableEl = getEditableEl;

  globalThis.KhmerLensPanel = api;
})();
