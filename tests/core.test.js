'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const core = require('../extension/lib/khmer.js');
const dictApi = require('../extension/lib/dictionary.js');

const ZWSP = '​';

// small hand-built dictionary for deterministic tests
const MINI = new Set([
  'ប្រទេស',      // country
  'កម្ពុជា',      // Cambodia
  'ប្រទេសកម្ពុជា', // (compound: not in real dict, here to test longest match)
  'មាន',         // to have
  'ប្រជាជន',     // population
  'ទីក្រុង',      // city
  'ទី',           // place
  'ក្រុង',        // city/town
  'ខ្ញុំ',         // I
  'ភ្នំពេញ',      // Phnom Penh
  'ភ្នំ',         // mountain
]);
const has = (w) => MINI.has(w);
const MAXLEN = 20;

test('isKhmerLetter basic', () => {
  assert.ok(core.isKhmerLetter('ក'));
  assert.ok(core.isKhmerLetter('ា'));
  assert.ok(!core.isKhmerLetter('a'));
  assert.ok(!core.isKhmerLetter('។')); // Khmer full stop = punctuation
  assert.ok(!core.isKhmerLetter('ៗ')); // repetition sign
  assert.ok(!core.isKhmerLetter('5'));
});

test('khmerRunAt finds contiguous Khmer run in mixed text', () => {
  const t = 'abc ខ្ញុំ 123';
  const run = core.khmerRunAt(t, 5);
  assert.ok(run);
  assert.strictEqual(t.slice(run.start, run.end), 'ខ្ញុំ');
});

test('khmerRunAt returns null on Latin', () => {
  assert.strictEqual(core.khmerRunAt('hello', 1), null);
});

test('khmerRunAt stops at Khmer punctuation', () => {
  const t = 'កម្ពុជា។មាន';
  const run = core.khmerRunAt(t, 0);
  assert.strictEqual(t.slice(run.start, run.end), 'កម្ពុជា');
});

test('stripInvisible removes ZWSP and maps indices', () => {
  const t = 'កម្ពុជា' + ZWSP + 'មាន';
  const s = core.stripInvisible(t);
  assert.strictEqual(s.clean, 'កម្ពុជាមាន');
  // index of 'ម' of មាន in original text is after the ZWSP
  const cleanIdx = s.clean.indexOf('មា');
  assert.strictEqual(s.map[cleanIdx], t.indexOf(ZWSP) + 1);
});

test('graphemeBoundaries never splits coeng clusters', () => {
  // ខ្ញុំ = ខ + ្ + ញ + ុ + ំ : one grapheme cluster
  const b = core.graphemeBoundaries('ខ្ញុំ');
  assert.deepStrictEqual(b, [0, 'ខ្ញុំ'.length]);
});

test('graphemeBoundaries on multi-cluster word', () => {
  // កម្ពុជា: ក | ម្ពុ | ជា
  const b = core.graphemeBoundaries('កម្ពុជា');
  assert.ok(b.includes(0));
  assert.ok(b.includes('កម្ពុជា'.length));
  assert.ok(b.length > 2, 'should have interior boundaries');
});

test('findMatches longest match first at word start', () => {
  const t = 'ប្រទេសកម្ពុជាមានប្រជាជន';
  const matches = core.findMatches(t, 0, has, MAXLEN);
  assert.ok(matches.length >= 2);
  assert.strictEqual(matches[0].word, 'ប្រទេសកម្ពុជា'); // longest
  assert.strictEqual(matches[1].word, 'ប្រទេស'); // shorter alternative
});

test('findMatches mid-word hover backtracks to word start', () => {
  const t = 'ប្រទេសកម្ពុជា';
  // hover on ជា (last cluster of កម្ពុជា)
  const idx = t.indexOf('ជា');
  const matches = core.findMatches(t, idx, has, MAXLEN);
  assert.ok(matches.length > 0);
  const words = matches.map((m) => m.word);
  assert.ok(words.includes('កម្ពុជា'), `expected កម្ពុជា in ${words}`);
  // all matches must cover the hovered position
  for (const m of matches) {
    assert.ok(m.start <= idx && m.end > idx);
  }
});

test('findMatches respects ZWSP as removable boundary', () => {
  const t = 'ប្រទេស' + ZWSP + 'កម្ពុជា';
  const matches = core.findMatches(t, 0, has, MAXLEN);
  const words = matches.map((m) => m.word);
  // compound match spans the ZWSP (stripped for lookup)
  assert.ok(words.includes('ប្រទេសកម្ពុជា'));
  // original-index span of compound covers whole original string
  const compound = matches.find((m) => m.word === 'ប្រទេសកម្ពុជា');
  assert.strictEqual(compound.start, 0);
  assert.strictEqual(compound.end, t.length);
});

test('findMatches never returns a match splitting a grapheme', () => {
  const t = 'ខ្ញុំមាន';
  const matches = core.findMatches(t, 0, has, MAXLEN);
  assert.ok(matches.length > 0);
  assert.strictEqual(matches[0].word, 'ខ្ញុំ');
});

test('findMatches on non-Khmer returns empty', () => {
  assert.deepStrictEqual(core.findMatches('hello world', 2, has, MAXLEN), []);
  assert.deepStrictEqual(core.findMatches('កម្ពុជា123', 8, has, MAXLEN), []);
});

test('findMatches segments ambiguous compound ទីក្រុង', () => {
  const t = 'ទីក្រុងធំ';
  const matches = core.findMatches(t, 0, has, MAXLEN);
  assert.strictEqual(matches[0].word, 'ទីក្រុង'); // longest wins over ទី
  const words = matches.map((m) => m.word);
  assert.ok(words.includes('ទី'));
});

test('icuFallback returns a segment when dictionary misses', () => {
  const t = 'ភ្នំពេញ';
  const fb = core.icuFallback(t, 0);
  assert.ok(fb);
  assert.ok(fb.word.length > 0);
  assert.strictEqual(fb.start, 0);
});

// ---------------------------------------------------------------- real data
const DICT_PATH = path.join(__dirname, '..', 'extension', 'data', 'dictionary.json');
const data = JSON.parse(fs.readFileSync(DICT_PATH, 'utf8'));
const dict = dictApi.createDictionary(data);

test('real dict: common words present with glosses', () => {
  for (const w of ['កម្ពុជា', 'ភ្នំពេញ', 'មាន', 'ខ្ញុំ', 'ទឹក', 'ស្រុក']) {
    const senses = dict.senses(w);
    assert.ok(senses && senses.length > 0, `missing gloss for ${w}`);
    assert.ok(senses[0][2].length > 0, `empty gloss for ${w}`);
  }
});

test('real dict: frequency ranks present', () => {
  assert.ok(dict.rank('បាន') >= 1);
  assert.strictEqual(dict.freqBand('បាន'), 'common');
});

test('real dict + corpus: findMatches produces a match on most sentences', () => {
  const corpusPath = path.join(__dirname, 'fixtures', 'corpus.json');
  if (!fs.existsSync(corpusPath)) {
    test.skip('corpus fixture not yet generated');
    return;
  }
  const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));
  assert.ok(corpus.sentences.length >= 20, 'corpus too small');
  let hit = 0;
  let total = 0;
  for (const s of corpus.sentences) {
    // probe a few positions per sentence
    for (let i = 0; i < s.length; i += 7) {
      if (!core.isKhmerLetter(s[i])) continue;
      total++;
      const m = core.findMatches(s, i, dict.has.bind(dict), dict.maxWordLen);
      if (m.length) hit++;
    }
  }
  const rate = hit / total;
  assert.ok(rate > 0.85, `match rate ${(rate * 100).toFixed(1)}% too low (${hit}/${total})`);
});

test('real dict + corpus: matches never split grapheme clusters', () => {
  const corpusPath = path.join(__dirname, 'fixtures', 'corpus.json');
  if (!fs.existsSync(corpusPath)) {
    test.skip('corpus fixture not yet generated');
    return;
  }
  const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));
  const seg = new Intl.Segmenter('km', { granularity: 'grapheme' });
  for (const s of corpus.sentences.slice(0, 15)) {
    for (let i = 0; i < s.length; i += 5) {
      if (!core.isKhmerLetter(s[i])) continue;
      for (const m of core.findMatches(s, i, dict.has.bind(dict), dict.maxWordLen)) {
        const sub = s.slice(m.start, m.end).replace(/[​‌‍﻿­]/g, '');
        assert.strictEqual(sub, m.word, `span mismatch at ${i} in "${s.slice(0, 30)}..."`);
        // word must round-trip through grapheme segmentation cleanly
        const rebuilt = [...seg.segment(m.word)].map((x) => x.segment).join('');
        assert.strictEqual(rebuilt, m.word);
      }
    }
  }
});
