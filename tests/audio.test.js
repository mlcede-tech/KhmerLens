'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const audio = require('../extension/lib/audio.js');

test('createAudioIndex looks up bundled files', () => {
  const idx = audio.createAudioIndex({
    version: 1,
    meta: { count: 1 },
    words: { 'ខ្មែរ': '819855d5513f.ogg' },
  });
  assert.strictEqual(idx.file('ខ្មែរ'), '819855d5513f.ogg');
  assert.strictEqual(idx.file('មាន'), null);
});

test('createAudioIndex degrades gracefully on missing data', () => {
  const idx = audio.createAudioIndex(null);
  assert.strictEqual(idx.file('ខ្មែរ'), null);
});

test('pickKhmerVoice matches km/km-KH but not kmr or others', () => {
  const km = { lang: 'km-KH', name: 'Khmer' };
  assert.strictEqual(audio.pickKhmerVoice([{ lang: 'en-US' }, km]), km);
  assert.strictEqual(audio.pickKhmerVoice([{ lang: 'km' }]).lang, 'km');
  assert.strictEqual(audio.pickKhmerVoice([{ lang: 'km_KH' }]).lang, 'km_KH');
  assert.strictEqual(audio.pickKhmerVoice([{ lang: 'kmr' }]), null); // Kurmanji
  assert.strictEqual(audio.pickKhmerVoice([]), null);
  assert.strictEqual(audio.pickKhmerVoice(undefined), null);
});

test('shipped audio-index.json is consistent with files on disk', () => {
  const dataDir = path.join(__dirname, '..', 'extension', 'data');
  const idxData = JSON.parse(fs.readFileSync(path.join(dataDir, 'audio-index.json')));
  assert.strictEqual(idxData.version, 1);
  const files = Object.values(idxData.words);
  assert.strictEqual(idxData.meta.count, files.length);
  for (const f of files) {
    assert.ok(/^[0-9a-f]{12}\.(ogg|wav|mp3)$/.test(f), `unsafe filename: ${f}`);
    assert.ok(fs.existsSync(path.join(dataDir, 'audio', f)), `missing file: ${f}`);
  }
  // every indexed word must be a dictionary word (else the button never shows)
  const dict = JSON.parse(fs.readFileSync(path.join(dataDir, 'dictionary.json')));
  for (const w of Object.keys(idxData.words)) {
    assert.ok(w in dict.words, `indexed word not in dictionary: ${w}`);
  }
  // credits must cover every file (CC BY-SA attribution requirement)
  const credited = new Set(idxData.credits.map((c) => c.file));
  for (const f of files) assert.ok(credited.has(f), `uncredited file: ${f}`);
});
