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
