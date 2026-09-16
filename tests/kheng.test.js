'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const { parseKhengDefinition } = require('../extension/lib/kheng.js');

const PAGES = path.join(__dirname, 'fixtures', 'pages');
function docFor(name) {
  const html = fs.readFileSync(path.join(PAGES, name), 'utf8');
  return new JSDOM(html).window.document;
}

test('parses the headword entry from a kheng.info hit', () => {
  const r = parseKhengDefinition(docFor('kheng-hit.html'), 'សប្បាយ');
  assert.strictEqual(r.found, true);
  assert.strictEqual(r.exact, true);
  assert.strictEqual(r.lemma, 'សប្បាយ');
  // adjective + noun senses, in order
  assert.ok(r.senses.length >= 2, 'expected multiple senses');
  assert.strictEqual(r.senses[0][0], 'adj');
  assert.match(r.senses[0][2], /happy/);
  assert.strictEqual(r.senses[1][0], 'n');
  assert.match(r.senses[1][2], /happiness/);
});

test('drops IPA, audio, and compound rows from the gloss', () => {
  const r = parseKhengDefinition(docFor('kheng-hit.html'), 'សប្បាយ');
  const joined = r.senses.map((s) => s[2]).join(' | ');
  assert.doesNotMatch(joined, /IPA/, 'IPA label leaked into gloss');
  assert.doesNotMatch(joined, /sapbaay/, 'IPA transcription leaked into gloss');
  // compounds (e.g. សប្បាយចិត្ត "to be content") must not appear as senses
  assert.doesNotMatch(joined, /content, satisfied/);
});

test('returns not-found for a query with no results', () => {
  const r = parseKhengDefinition(docFor('kheng-miss.html'), 'ខសខសខស');
  assert.strictEqual(r.found, false);
  assert.deepStrictEqual(r.senses, []);
});

test('exact is false when the returned lemma differs from the query', () => {
  const r = parseKhengDefinition(docFor('kheng-hit.html'), 'សប');
  assert.strictEqual(r.found, true);
  assert.strictEqual(r.exact, false);
  assert.strictEqual(r.lemma, 'សប្បាយ');
});

test('accepts a raw HTML string as well as a document', () => {
  const html = fs.readFileSync(path.join(PAGES, 'kheng-hit.html'), 'utf8');
  // no DOMParser under node -> string path returns empty rather than throwing
  const r = parseKhengDefinition(html, 'សប្បាយ');
  assert.strictEqual(r.found, false);
});

test('guards against empty and malformed input', () => {
  assert.strictEqual(parseKhengDefinition(null, 'x').found, false);
  assert.strictEqual(parseKhengDefinition(undefined).found, false);
  const emptyDoc = new JSDOM('<main></main>').window.document;
  assert.strictEqual(parseKhengDefinition(emptyDoc, 'x').found, false);
});
