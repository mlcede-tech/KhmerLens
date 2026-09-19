# KhmerLens Paste Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an in-page side panel where the user pastes Khmer text, so KhmerLens hover-translation works on sources it can't read directly (Google Docs, canvas-rendered editors, PDFs).

**Architecture:** The panel is a light-DOM container injected into the current page by the existing content script when the lens is enabled. Because the hover engine reads words with `document.caretPositionFromPoint` (which does **not** descend into shadow roots), the panel's editable text area must live in the light DOM - then the existing detection engine reads it with no changes. A new browser-action popup gives the user an on/off toggle switch; turning it on enables the lens on the tab and opens the panel.

**Tech Stack:** Chrome MV3, vanilla ES5-style JS (matching existing `var`/IIFE code), no build step. Tests: `node --test` (unit) and Playwright via `node browser-verify.js` (live browser).

**Spec:** This plan is self-contained; the design was settled in conversation. Key decisions are captured in Global Constraints and Task 0 below.

## Global Constraints

Every task's requirements implicitly include these. Values are copied from the existing codebase and must not be violated.

- **Manifest V3**, `minimum_chrome_version` stays `"105"`.
- **No new permissions.** Keep `["activeTab", "scripting", "storage", "clipboardWrite"]` exactly. Do **not** add `clipboardRead`, `host_permissions`, or `<all_urls>` content scripts. `browser-verify.js` Part B asserts there are NO broad host permissions - that assertion must keep passing.
- **The panel's editable area is light DOM, never a shadow root.** The definition popup stays in its shadow root (it is output, not hovered); the paste area is input the user hovers, so the caret APIs must reach it.
- **No `innerHTML` for any page-derived or user-pasted string.** Use `textContent` / DOM node creation, matching `content.js` (`el()` helper). Pasted text is inserted as a plain text node only.
- **Code style:** vanilla JS, `'use strict'`, `var`, IIFE module exposing one global (e.g. `globalThis.KhmerLensPanel`), matching `content/content.js` and `lib/*.js`. No frameworks, no bundler.
- **Panel styles are self-contained.** Wrap the panel root with `all: initial` and scope every rule so the host page's CSS cannot leak in and the panel's CSS cannot leak out. Ship panel CSS as an inline string constant inside `panel.js` (do **not** add a new `web_accessible_resources` entry).
- **Panel lives in the top frame only** (`window === window.top`). Do not inject it into iframes.

---

## File Structure

**New files:**
- `extension/content/panel.js` - builds/opens/closes the side panel, sanitizes paste to plain text. Exposes `globalThis.KhmerLensPanel = { open, close, toggle, isOpen }`. Injected before `content.js`.
- `extension/action/action.html` - browser-action popup markup (toggle switch + hint text).
- `extension/action/action.css` - popup styles.
- `extension/action/action.js` - reads current tab's enabled state, drives the toggle by messaging the background worker.
- `tests/panel.test.js` - unit tests for the pure paste-normalization helper.

**Modified files:**
- `extension/manifest.json` - add `"default_popup": "action/action.html"` to the `action` block.
- `extension/background.js` - add `content/panel.js` to `CONTENT_FILES`; add a `khmerlens:toggle` message handler that toggles the active tab; remove the now-superseded `chrome.action.onClicked` listener (setting `default_popup` stops it firing). Keep the `Alt+K` command working.
- `extension/content/content.js` - in `setEnabled(on)`, open the panel when enabling and close it when disabling (top frame only).
- `tests/testkit.js:73` - add `'content/panel.js'` to the `files` array so the live-browser harness loads it.
- `tests/browser-verify.js` - add a Part C that opens the panel, pastes Khmer text, hovers it, and asserts the popup appears.

---

## Task 0: Lock the interaction + technical decisions (read first, no code)

These are settled. Do not re-litigate them mid-build; if reality contradicts one, stop and flag it.

1. **Entry point:** Clicking the toolbar icon opens a small popup containing one labeled toggle switch: "KhmerLens on this tab". Turning it **on** enables the lens on the tab (existing inject/enable flow) and opens the paste panel. Turning it **off** disables the lens and closes the panel. `Alt+K` remains a second way to toggle.
2. **Why a popup instead of the current one-click toggle:** the user asked for a visible switch. Setting `default_popup` automatically disables `chrome.action.onClicked`, so that listener is removed and the popup drives toggling via a `khmerlens:toggle` message to the background worker (which calls the existing `toggleTab`).
3. **Panel = light DOM.** Confirmed load-bearing: `caretAt()` in `content/content.js:232` uses `document.caretPositionFromPoint`/`caretRangeFromPoint`, which return the shadow *host* - not inner text - for content inside a shadow root. So the editable area is a plain `contenteditable` div in the light DOM, wrapped in an `all: initial` container for isolation.
4. **Paste is forced to plain text.** On the editable's `paste` event: `preventDefault`, read `clipboardData.getData('text/plain')`, normalize it, and insert it as a single text node. This prevents Google Docs' HTML from fragmenting words across nested spans, which would break word matching.
5. **Known v1 limitations (acceptable, document them):** scrolling inside the panel hides the definition popup until the next hover (the lens's `onScrollOrResize` hides on any scroll); the panel is fixed to the right edge and not draggable/resizable. Both are fine for v1.

- [ ] **Step 1: Confirm the caret-API fact in the running extension before building.** Load the unpacked extension, enable it on any page, and in the page console run:

```js
var d = document.createElement('div');
d.attachShadow({ mode: 'open' }).innerHTML = '<div contenteditable>កម្ពុជា</div>';
document.body.appendChild(d);
var r = d.getBoundingClientRect();
var c = document.caretPositionFromPoint(r.left + 5, r.top + 5);
console.log(c && c.offsetNode); // EXPECT: the shadow host <div>, NOT a text node
```

Expected: logs the host element (proving shadow DOM hides text from the caret API). If it instead logs a text node inside the shadow root on the target Chrome version, the light-DOM constraint can be relaxed - note it and continue; the light-DOM approach still works either way.

---

## Task 1: Pure paste-normalization helper (unit-tested)

Extract the one piece of paste logic that is pure and testable before touching any DOM.

**Files:**
- Create: `extension/content/panel.js` (start the IIFE + the helper only)
- Test: `tests/panel.test.js`

**Interfaces:**
- Produces: `globalThis.KhmerLensPanel.normalizePastedText(raw: string) -> string`. Collapses `\r\n` and `\r` to `\n`, and trims a leading BOM if present. Does **not** strip Khmer combining marks, ZWSP, or ordinary whitespace (the matcher already handles ZWSP).

- [ ] **Step 1: Write the failing test**

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');

// panel.js assigns to globalThis.KhmerLensPanel; load it into this context.
global.globalThis = global;
require('../extension/content/panel.js');
const { normalizePastedText } = globalThis.KhmerLensPanel;

test('collapses CRLF and CR to LF', () => {
  assert.strictEqual(normalizePastedText('a\r\nb\rc'), 'a\nb\nc');
});

test('strips a leading BOM', () => {
  assert.strictEqual(normalizePastedText('﻿កម្ពុជា'), 'កម្ពុជា');
});

test('preserves Khmer text and ZWSP untouched', () => {
  const s = 'ប្រទេស​កម្ពុជា';
  assert.strictEqual(normalizePastedText(s), s);
});

test('returns empty string for non-string input', () => {
  assert.strictEqual(normalizePastedText(null), '');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tests && node --test panel.test.js`
Expected: FAIL - `panel.js` does not exist yet / `normalizePastedText` undefined.

- [ ] **Step 3: Write minimal implementation**

Create `extension/content/panel.js` with the module skeleton and the helper. Guard against running its DOM code under Node (the unit test has no `document`):

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tests && node --test panel.test.js`
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add extension/content/panel.js tests/panel.test.js
git commit -m "feat(panel): add paste-text normalizer with unit tests"
```

---

## Task 2: Build the panel DOM, open/close/toggle, and paste sanitization

**Files:**
- Modify: `extension/content/panel.js`

**Interfaces:**
- Consumes: `normalizePastedText` from Task 1.
- Produces on `globalThis.KhmerLensPanel`:
  - `open() -> void` - creates (once) and shows the panel in the top frame; no-op in subframes.
  - `close() -> void` - hides the panel (keeps the DOM for reuse).
  - `toggle() -> void`
  - `isOpen() -> boolean`
  - `getEditableEl() -> HTMLElement | null` - the `contenteditable` div (used by the browser test to locate pasted text).

- [ ] **Step 1: Add the DOM builder, CSS string, and paste handler**

Append inside the IIFE, before `globalThis.KhmerLensPanel = api;`. Requirements:

- `PANEL_CSS`: an inline string. Root selector `#khmerlens-panel` gets `all: initial` reset plus: `position: fixed; top: 12px; right: 12px; width: 340px; max-height: 80vh; z-index: 2147483646;` (one below the popup card's `2147483647` at `content/content.js:79`, so definitions render above the panel). Style the header, buttons, and a `.klp-body` editable area (`overflow: auto; min-height: 160px;`, comfortable Khmer line-height ~2.0, ~18px font). Scope every rule under `#khmerlens-panel`. Inject it via a `<style id="khmerlens-panel-style">` appended to `document.head` once.
- `build()`:
  - Create `var root = document.createElement('div'); root.id = 'khmerlens-panel';`.
  - Header row: a title span `"KhmerLens - paste Khmer here"`, a `Clear` button, and a `×` close button. Use `textContent` only. Close button calls `close()`; Clear button empties the editable via `editable.textContent = ''`.
  - Body: `var editable = document.createElement('div'); editable.className = 'klp-body'; editable.setAttribute('contenteditable', 'plaintext-only'); editable.setAttribute('spellcheck', 'false'); editable.setAttribute('dir', 'auto');` (fall back handled by the paste listener if `plaintext-only` is unsupported).
  - Paste listener on `editable`:

```js
editable.addEventListener('paste', function (e) {
  e.preventDefault();
  var raw = (e.clipboardData || window.clipboardData).getData('text/plain');
  var text = normalizePastedText(raw);
  var sel = window.getSelection();
  if (!sel || !sel.rangeCount) { editable.appendChild(document.createTextNode(text)); return; }
  var range = sel.getRangeAt(0);
  range.deleteContents();
  range.insertNode(document.createTextNode(text));
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
});
```

  - Append header + body to `root`, append `root` to `document.body`, keep module-level refs (`panelRoot`, `editableEl`).
- `open()`: if `window !== window.top` return; if not built, `build()`; set `panelRoot.hidden = false`.
- `close()`: if `panelRoot`, set `panelRoot.hidden = true`.
- `toggle()`, `isOpen()`, `getEditableEl()` as described in Interfaces.
- Extend `api` with `open, close, toggle, isOpen, getEditableEl`.

- [ ] **Step 2: Confirm the unit test still passes (helper untouched under Node)**

Run: `cd tests && node --test panel.test.js`
Expected: PASS (4/4). The DOM code must not execute at load under Node - it only runs when `open()` is called in a browser.

- [ ] **Step 3: Commit**

```bash
git add extension/content/panel.js
git commit -m "feat(panel): build light-DOM side panel with plain-text paste"
```

---

## Task 3: Inject panel.js and open/close it with the lens

**Files:**
- Modify: `extension/background.js:17-22` (add to `CONTENT_FILES`)
- Modify: `extension/content/content.js:432-450` (inside `setEnabled`)
- Modify: `tests/testkit.js:73` (add to the harness file list)

**Interfaces:**
- Consumes: `globalThis.KhmerLensPanel.open` / `.close` from Task 2.

- [ ] **Step 1: Register panel.js for injection**

In `extension/background.js`, add `'content/panel.js'` to `CONTENT_FILES` **before** `'content/content.js'` (content.js references the panel):

```js
var CONTENT_FILES = [
  'lib/khmer.js',
  'lib/dictionary.js',
  'lib/popup.js',
  'content/panel.js',
  'content/content.js',
];
```

- [ ] **Step 2: Open/close the panel from setEnabled**

In `extension/content/content.js`, inside `setEnabled(on)` (starts at line 429), open the panel when enabling and close it when disabling - top frame only, guarded so a missing global never throws:

```js
    if (enabled) {
      buildPopup();
      loadSettings();
      if (window === window.top) {
        ensureDict();
        try { if (globalThis.KhmerLensPanel) globalThis.KhmerLensPanel.open(); } catch (e) {}
      }
      document.addEventListener('mousemove', onMouseMove, true);
      // ... existing listeners unchanged ...
    } else {
      // ... existing removeEventListener calls unchanged ...
      hidePopup();
      try { if (globalThis.KhmerLensPanel) globalThis.KhmerLensPanel.close(); } catch (e) {}
    }
```

- [ ] **Step 3: Add panel.js to the live-browser harness**

In `tests/testkit.js:73`, add `'content/panel.js'` before `'content/content.js'`:

```js
var files = ['lib/khmer.js', 'lib/dictionary.js', 'lib/popup.js', 'content/panel.js', 'content/content.js'];
```

- [ ] **Step 4: Verify existing browser tests still pass (no regression)**

Run: `cd tests && npm install --no-save && node browser-verify.js`
Expected: Part A and Part B all `[PASS]`. The panel now opens during Part A's enabled pages but must not break any existing hover/popup/permission checks.

- [ ] **Step 5: Commit**

```bash
git add extension/background.js extension/content/content.js tests/testkit.js
git commit -m "feat(panel): open the paste panel when KhmerLens is enabled"
```

---

## Task 4: Live-browser test - paste into the panel and hover it

**Files:**
- Modify: `tests/browser-verify.js` (add `partC`, call it from the runner)

**Interfaces:**
- Consumes: `globalThis.KhmerLensPanel.getEditableEl` / `.isOpen` from Task 2, `popupState(page)` helper already in `browser-verify.js`.

- [ ] **Step 1: Write the failing test (Part C)**

Add a `partC` function and invoke it from the main runner (near the `partA()`/`partB()` calls at the bottom). It loads an ordinary blank page, enables the lens (which opens the panel), sets clean Khmer text directly into the editable, hovers a Khmer syllable there, and asserts the popup shows a gloss:

```js
async function partC() {
  console.log('\n- Part C: paste panel -');
  const server = await kit.startServer();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await kit.primePage(page, server.url);
  await page.goto(server.url + '/tests/fixtures/pages/basic.html'); // any served page
  await kit.enable(page, server.url);

  const opened = await page.evaluate(() => !!(globalThis.KhmerLensPanel && globalThis.KhmerLensPanel.isOpen()));
  check('panel opens when enabled', opened);

  // put clean Khmer into the editable (simulates a paste result)
  const placed = await page.evaluate(() => {
    const ed = globalThis.KhmerLensPanel.getEditableEl();
    if (!ed) return false;
    ed.appendChild(document.createTextNode('ប្រទេសកម្ពុជាមានប្រជាជន'));
    return true;
  });
  check('editable found and filled', placed);

  const pt = await page.evaluate(() => {
    const ed = globalThis.KhmerLensPanel.getEditableEl();
    const walker = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT);
    const node = walker.nextNode();
    const r = new Range(); r.setStart(node, 2); r.setEnd(node, 3);
    const rect = r.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });
  await page.mouse.move(pt.x, pt.y);
  await page.waitForTimeout(120);
  const st = await popupState(page);
  check('popup appears over pasted panel text', st.visible, st.word);
  check('popup shows a gloss for pasted text', !!st.gloss, st.gloss && st.gloss.slice(0, 40));

  await browser.close();
  await server.close();
}
```

Also add `await partC();` to the runner alongside the existing `await partA(); await partB();` calls.

- [ ] **Step 2: Run to verify it currently passes end-to-end**

Run: `cd tests && node browser-verify.js`
Expected: Part C prints `[PASS]` for all four checks. (If `basic.html` is not the fixture filename, list `tests/fixtures/pages/` and use an existing Khmer fixture page - any served HTML page works as the host.)

- [ ] **Step 3: Commit**

```bash
git add tests/browser-verify.js
git commit -m "test(panel): verify hover translation works on pasted panel text"
```

---

## Task 5: Browser-action popup with the on/off toggle switch

**Files:**
- Create: `extension/action/action.html`, `extension/action/action.css`, `extension/action/action.js`
- Modify: `extension/manifest.json` (`action.default_popup`)
- Modify: `extension/background.js` (add `khmerlens:toggle` handler; remove `chrome.action.onClicked`)

**Interfaces:**
- Produces (background message API): `{ type: 'khmerlens:toggle' }` → toggles the active tab (calls existing `toggleTab`), responds `{ enabled: boolean }`. Reuses existing `{ type: 'khmerlens:getEnabled' }` for initial state.

- [ ] **Step 1: Add the popup files**

`extension/action/action.html` - minimal, no inline script (CSP), links `action.css` and `action.js`:

```html
<!doctype html>
<html>
<head><meta charset="utf-8"><link rel="stylesheet" href="action.css"></head>
<body>
  <div class="wrap">
    <label class="row">
      <span>KhmerLens on this tab</span>
      <input type="checkbox" id="toggle" class="switch">
    </label>
    <p class="hint">When on, hover Khmer text to translate. Paste text that
      KhmerLens can’t reach (Google Docs, PDFs) into the side panel.</p>
    <p class="hint" id="blocked" hidden>This page can’t run KhmerLens.</p>
  </div>
  <script src="action.js"></script>
</body>
</html>
```

`extension/action/action.css` - style `.switch` as a toggle (reuse the amber `#b45309` accent from the badge in `background.js:31`). Keep it self-contained; ~240px wide.

`extension/action/action.js`:

```js
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
```

- [ ] **Step 2: Wire the manifest**

In `extension/manifest.json`, add `default_popup` to the existing `action` block (keep the existing `default_title` and icons):

```json
  "action": {
    "default_popup": "action/action.html",
    "default_title": "KhmerLens",
    "default_icon": { "16": "icons/icon16.png", "32": "icons/icon32.png", "48": "icons/icon48.png", "128": "icons/icon128.png" }
  },
```

- [ ] **Step 3: Update the background worker**

In `extension/background.js`:
- Remove `chrome.action.onClicked.addListener(toggleTab);` (line 92) - `default_popup` supersedes it.
- Extend `toggleTab` (or wrap it) so it can report the resulting state and whether the page was blocked. Simplest: have it return `{ enabled, blocked }`. The existing restricted-page `catch` (lines 60-70) should set a `blocked` result instead of only styling the badge.
- Add to the existing `onMessage` listener (line 99):

```js
  if (msg && msg.type === 'khmerlens:toggle') {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = tabs && tabs[0];
      if (!tab) { sendResponse({ enabled: false }); return; }
      toggleTab(tab).then(function (r) { sendResponse(r || { enabled: false }); });
    });
    return true; // async
  }
```

Keep the `chrome.commands.onCommand` `Alt+K` handler (lines 94-96) unchanged.

- [ ] **Step 4: Verify the permission model is unchanged**

Run: `cd tests && node browser-verify.js`
Expected: Part B still `[PASS]`, including `manifest has NO broad host_permissions` and `manifest requests activeTab, not <all_urls>`.

- [ ] **Step 5: Manual smoke (record result in the commit body)**

Load unpacked at `chrome://extensions`, open a YouTube tab, click the icon, flip the switch on. Expected: badge shows `ON`, the paste panel appears top-right. Paste Khmer text (e.g. from a Google Doc) and hover - definitions pop up. Flip off: panel disappears, badge clears. Try the switch on a `chrome://` page: the "This page can’t run KhmerLens" hint shows and the switch snaps back off.

- [ ] **Step 6: Commit**

```bash
git add extension/action extension/manifest.json extension/background.js
git commit -m "feat(action): add toolbar toggle switch that drives the lens + panel"
```

---

## Task 6: Docs + final full-suite verification

**Files:**
- Modify: `README.md` (document the panel + toggle)
- Modify: `docs/store-listing.md` and `docs/DESIGN.md` if they enumerate features/permissions (verify no permission claims changed)

- [ ] **Step 1: Update README**

Add a short "Paste panel" section: what it's for (translating text KhmerLens can't read in place - Google Docs, PDFs, canvas editors), and how (icon → toggle on → paste → hover). Note no new permissions were added.

- [ ] **Step 2: Run the full suite**

Run: `cd tests && node --test && node browser-verify.js`
Expected: all unit tests pass; Part A, B, and C all `[PASS]`.

- [ ] **Step 3: Commit**

```bash
git add README.md docs/store-listing.md docs/DESIGN.md
git commit -m "docs: document the paste panel and toolbar toggle"
```

---

## Self-Review notes for the executor

- **Injection order matters:** `panel.js` must be listed before `content.js` in both `background.js` `CONTENT_FILES` and `tests/testkit.js`, or `content.js`'s `KhmerLensPanel` reference is undefined at enable time. (It's guarded with `try/catch`, so a wrong order fails silently as "panel never opens" rather than a crash - check Part C if the panel doesn't appear.)
- **The one thing that can quietly fail:** if a future change moves the paste area into a shadow root for styling, hover will stop working inside it (Task 0, Step 1 proves why). Keep the editable in light DOM.
- **Name check:** the folder is `action/` (browser-action popup) - distinct from the existing `lib/popup.js` (tooltip-position math) and `content/popup.css` (definition-card styles). Don't conflate them.
- **No new permissions** - if any task tempts you to add `clipboardRead` for a "Paste" button, don't; manual `Ctrl+V` into the editable needs nothing. A paste button is a v2 idea, out of scope.
