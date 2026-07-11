/**
 * KhmerLens Anki integration: pure helpers shared by the service worker
 * (importScripts) and the options page, testable under Node.
 *
 * Talks to AnkiConnect (https://foosoft.net/projects/anki-connect/), a local
 * HTTP API exposed by the Anki desktop add-on on http://127.0.0.1:8765.
 */
(function (root) {
  'use strict';

  /** What a note field can be filled with, keyed by source id. */
  var FIELD_SOURCES = [
    { id: '', label: '(leave empty)' },
    { id: 'word', label: 'Khmer word' },
    { id: 'roman', label: 'Romanization' },
    { id: 'gloss', label: 'Definition(s)' },
    { id: 'pos', label: 'Part of speech' },
    { id: 'wordRoman', label: 'Word + romanization' },
  ];

  /** Derive the source values from a dictionary entry {word, senses}. */
  function sourceValues(entry) {
    var senses = entry.senses || [];
    var romans = [];
    var poses = [];
    var glosses = [];
    senses.forEach(function (s) {
      if (s[1] && romans.indexOf(s[1]) === -1) romans.push(s[1]);
      if (s[0] && poses.indexOf(s[0]) === -1) poses.push(s[0]);
      if (s[2]) glosses.push((s[0] ? '(' + s[0] + ') ' : '') + s[2]);
    });
    var roman = romans.join(' · ');
    return {
      word: entry.word,
      roman: roman,
      pos: poses.join(', '),
      gloss: glosses.join('<br>'),
      wordRoman: roman ? entry.word + ' [' + roman + ']' : entry.word,
    };
  }

  /**
   * Build an AnkiConnect addNote payload.
   * settings: {ankiDeck, ankiModel, ankiFieldMap: {noteField: sourceId}, ankiTags}
   */
  function buildAddNote(settings, entry) {
    var values = sourceValues(entry);
    var fields = {};
    var map = settings.ankiFieldMap || {};
    Object.keys(map).forEach(function (noteField) {
      var src = map[noteField];
      fields[noteField] = src && values[src] != null ? values[src] : '';
    });
    var tags = String(settings.ankiTags || '')
      .split(/[,\s]+/)
      .filter(Boolean);
    return {
      action: 'addNote',
      version: 6,
      params: {
        note: {
          deckName: settings.ankiDeck,
          modelName: settings.ankiModel,
          fields: fields,
          tags: tags,
          options: { allowDuplicate: false, duplicateScope: 'deck' },
        },
      },
    };
  }

  /**
   * Guess a sensible mapping for a note type's field names, e.g.
   * ['Front','Back'] -> {Front:'word', Back:'gloss'}.
   */
  function defaultFieldMap(fieldNames) {
    var map = {};
    (fieldNames || []).forEach(function (name, i) {
      if (/roman|pronun|read|phonetic|ipa/i.test(name)) map[name] = 'roman';
      else if (/back|mean|def|english|translat|gloss/i.test(name)) map[name] = 'gloss';
      else if (/front|word|khmer|expression|term/i.test(name)) map[name] = 'word';
      else map[name] = i === 0 ? 'word' : i === 1 ? 'gloss' : '';
    });
    return map;
  }

  /** Is the mapping usable? At least one field must carry the word. */
  function validateSettings(settings) {
    if (!settings.ankiDeck) return 'No deck selected';
    if (!settings.ankiModel) return 'No note type selected';
    var map = settings.ankiFieldMap || {};
    var hasContent = Object.keys(map).some(function (f) { return map[f]; });
    if (!hasContent) return 'No fields mapped';
    return null;
  }

  /** Coarse classification of an AnkiConnect/network error for the UI. */
  function classifyError(message) {
    var m = String(message || '').toLowerCase();
    if (m.indexOf('duplicate') !== -1) return 'duplicate';
    if (m.indexOf('failed to fetch') !== -1 || m.indexOf('networkerror') !== -1 ||
        m.indexOf('refused') !== -1 || m.indexOf('load failed') !== -1) {
      return 'unreachable';
    }
    return 'other';
  }

  var api = {
    FIELD_SOURCES: FIELD_SOURCES,
    sourceValues: sourceValues,
    buildAddNote: buildAddNote,
    defaultFieldMap: defaultFieldMap,
    validateSettings: validateSettings,
    classifyError: classifyError,
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.KhmerLensAnki = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
