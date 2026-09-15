'use strict';
const test = require('node:test');
const assert = require('node:assert');

const anki = require('../extension/lib/anki.js');

const ENTRY = {
  word: 'កម្ពុជា',
  senses: [['proper noun', 'kampuciə', 'Cambodia (a country in Southeast Asia)']],
};

const SETTINGS = {
  ankiDeck: 'Khmer',
  ankiModel: 'Basic',
  ankiFieldMap: { Front: 'word', Back: 'gloss' },
  ankiTags: 'khmerlens vocab',
};

test('sourceValues derives all sources from senses', () => {
  const v = anki.sourceValues(ENTRY);
  assert.strictEqual(v.word, 'កម្ពុជា');
  assert.strictEqual(v.roman, 'kampuciə');
  assert.strictEqual(v.pos, 'proper noun');
  assert.strictEqual(v.gloss, '(proper noun) Cambodia (a country in Southeast Asia)');
  assert.strictEqual(v.wordRoman, 'កម្ពុជា [kampuciə]');
});

test('sourceValues dedupes romanizations and joins multiple senses', () => {
  const v = anki.sourceValues({
    word: 'វត្ត',
    senses: [['noun', 'vŏət', 'wat, pagoda'], ['noun', 'vŏət', 'respect, esteem']],
  });
  assert.strictEqual(v.roman, 'vŏət');
  assert.strictEqual(v.gloss, '(noun) wat, pagoda<br>(noun) respect, esteem');
});

test('sourceValues handles gloss-less entries', () => {
  const v = anki.sourceValues({ word: 'ទី', senses: [] });
  assert.strictEqual(v.word, 'ទី');
  assert.strictEqual(v.gloss, '');
  assert.strictEqual(v.wordRoman, 'ទី'); // no roman -> no brackets
});

test('buildAddNote maps fields per settings', () => {
  const payload = anki.buildAddNote(SETTINGS, ENTRY);
  assert.strictEqual(payload.action, 'addNote');
  assert.strictEqual(payload.version, 6);
  const note = payload.params.note;
  assert.strictEqual(note.deckName, 'Khmer');
  assert.strictEqual(note.modelName, 'Basic');
  assert.strictEqual(note.fields.Front, 'កម្ពុជា');
  assert.match(note.fields.Back, /Cambodia/);
  assert.deepStrictEqual(note.tags, ['khmerlens', 'vocab']);
  assert.strictEqual(note.options.allowDuplicate, false);
  assert.strictEqual(note.options.duplicateScope, 'deck');
});

test('buildAddNote leaves unmapped fields empty', () => {
  const payload = anki.buildAddNote(
    { ...SETTINGS, ankiFieldMap: { Front: 'word', Back: '', Extra: 'roman' } },
    ENTRY
  );
  assert.strictEqual(payload.params.note.fields.Back, '');
  assert.strictEqual(payload.params.note.fields.Extra, 'kampuciə');
});

test('defaultFieldMap recognizes common field names', () => {
  assert.deepStrictEqual(
    anki.defaultFieldMap(['Front', 'Back']),
    { Front: 'word', Back: 'gloss' }
  );
  assert.deepStrictEqual(
    anki.defaultFieldMap(['Expression', 'Meaning', 'Reading', 'Notes']),
    { Expression: 'word', Meaning: 'gloss', Reading: 'roman', Notes: '' }
  );
  // unknown names fall back positionally
  assert.deepStrictEqual(
    anki.defaultFieldMap(['A', 'B', 'C']),
    { A: 'word', B: 'gloss', C: '' }
  );
});

test('validateSettings catches missing configuration', () => {
  assert.strictEqual(anki.validateSettings(SETTINGS), null);
  assert.match(anki.validateSettings({ ...SETTINGS, ankiDeck: '' }), /deck/i);
  assert.match(anki.validateSettings({ ...SETTINGS, ankiModel: '' }), /note type/i);
  assert.match(
    anki.validateSettings({ ...SETTINGS, ankiFieldMap: { Front: '', Back: '' } }),
    /fields/i
  );
});

test('classifyError buckets AnkiConnect and network errors', () => {
  assert.strictEqual(
    anki.classifyError('cannot create note because it is a duplicate'),
    'duplicate');
  assert.strictEqual(anki.classifyError('Failed to fetch'), 'unreachable');
  assert.strictEqual(anki.classifyError('TypeError: NetworkError when attempting'), 'unreachable');
  assert.strictEqual(anki.classifyError('model was not found: X'), 'other');
});
