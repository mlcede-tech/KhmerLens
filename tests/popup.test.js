'use strict';
const test = require('node:test');
const assert = require('node:assert');

const { positionPopup } = require('../extension/lib/popup.js');

const base = {
  popupW: 300, popupH: 200,
  viewportW: 1280, viewportH: 800,
};

test('popup goes below-right of cursor by default', () => {
  const p = positionPopup({ ...base, cursorX: 100, cursorY: 100 });
  assert.strictEqual(p.placement, 'below-right');
  assert.ok(p.left > 100 && p.top > 100);
});

test('popup flips left near right edge', () => {
  const p = positionPopup({ ...base, cursorX: 1200, cursorY: 100 });
  assert.strictEqual(p.placement, 'below-left');
  assert.ok(p.left + base.popupW < 1200);
});

test('popup flips above near bottom edge', () => {
  const p = positionPopup({ ...base, cursorX: 100, cursorY: 750 });
  assert.ok(p.placement.startsWith('above'));
  assert.ok(p.top + base.popupH < 750);
});

test('popup flips both near bottom-right corner', () => {
  const p = positionPopup({ ...base, cursorX: 1250, cursorY: 780 });
  assert.strictEqual(p.placement, 'above-left');
  assert.ok(p.left >= 8 && p.top >= 8);
});

test('popup clamps inside viewport at top-left', () => {
  const p = positionPopup({ ...base, cursorX: 2, cursorY: 2 });
  assert.ok(p.left >= 8 && p.top >= 8);
  assert.ok(p.left + base.popupW <= base.viewportW);
});

test('popup never leaves viewport even when popup is huge', () => {
  const p = positionPopup({
    cursorX: 640, cursorY: 400,
    popupW: 360, popupH: 700,
    viewportW: 1280, viewportH: 800,
  });
  assert.ok(p.top >= 8);
});
