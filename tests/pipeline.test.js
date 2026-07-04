'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const DICT_PATH = path.join(__dirname, '..', 'extension', 'data', 'dictionary.json');
const data = JSON.parse(fs.readFileSync(DICT_PATH, 'utf8'));

test('dictionary format: version and meta', () => {
  assert.strictEqual(data.version, 1);
  assert.ok(data.meta.entryCount > 9000, 'expect >9k glossed entries');
  assert.ok(data.meta.totalWords > 20000);
  assert.ok(data.meta.maxWordLen >= 10 && data.meta.maxWordLen <= 60);
  assert.ok(Array.isArray(data.meta.sources) && data.meta.sources.length === 2);
});

test('dictionary format: senses are [pos, roman, gloss] triples', () => {
  let checked = 0;
  for (const [w, senses] of Object.entries(data.words)) {
    assert.ok(Array.isArray(senses));
    for (const s of senses) {
      assert.strictEqual(s.length, 3, `bad sense for ${w}`);
      assert.strictEqual(typeof s[0], 'string');
      assert.strictEqual(typeof s[1], 'string');
      assert.ok(typeof s[2] === 'string' && s[2].length > 0, `empty gloss for ${w}`);
    }
    if (++checked > 500) break;
  }
});

test('dictionary: headwords are NFC-normalized Khmer without ZWSP', () => {
  const bad = /[​‌‍﻿­]/;
  let checked = 0;
  for (const w of Object.keys(data.words)) {
    assert.ok(!bad.test(w), `invisible char in headword ${JSON.stringify(w)}`);
    assert.strictEqual(w, w.normalize('NFC'), `non-NFC headword ${w}`);
    if (++checked > 2000) break;
  }
});

test('dictionary: frequency ranks are positive integers', () => {
  let checked = 0;
  for (const [w, r] of Object.entries(data.freq)) {
    assert.ok(Number.isInteger(r) && r >= 1, `bad rank for ${w}: ${r}`);
    if (++checked > 500) break;
  }
});

test('dictionary: gloss-less wordlist entries exist for segmentation', () => {
  let empty = 0;
  for (const senses of Object.values(data.words)) {
    if (senses.length === 0) empty++;
  }
  assert.ok(empty > 5000, `expected many wordlist-only entries, got ${empty}`);
  assert.strictEqual(empty, data.meta.wordlistCount);
});
