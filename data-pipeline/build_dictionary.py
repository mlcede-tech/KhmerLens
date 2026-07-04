#!/usr/bin/env python3
"""Build KhmerLens dictionary from raw sources.

Sources (see download.sh):
  raw/kaikki.org-dictionary-Khmer.jsonl  - Wiktionary extract (CC BY-SA 4.0)
  raw/khmerlbdict/seafreq.txt            - SIL frequency wordlist (MIT)

Output:
  ../extension/data/dictionary.json

Format (versioned, consumed by extension/lib/dictionary.js):
{
  "version": 1,
  "meta": { "built": "...", "entryCount": N, "wordlistCount": M,
            "maxWordLen": L, "sources": [...] },
  "words": {
    "<khmer word>": [ [pos, romanization, "gloss1; gloss2"], ... ]
    # empty list [] => word known (from frequency list) but no gloss
  },
  "freq": { "<khmer word>": rank }   # 1 = most frequent
}
"""
from __future__ import annotations

import json
import re
import sys
import unicodedata
from datetime import date
from pathlib import Path

HERE = Path(__file__).parent
RAW = HERE / "raw"
OUT = HERE.parent / "extension" / "data" / "dictionary.json"

KAIKKI = RAW / "kaikki.org-dictionary-Khmer.jsonl"
SEAFREQ = RAW / "khmerlbdict" / "seafreq.txt"

# Khmer block U+1780-U+17FF plus Khmer symbols U+19E0-U+19FF
KHMER_RE = re.compile(r"[ក-៿᧠-᧿]")
# Characters stripped from headwords before lookup keys are formed
STRIP_RE = re.compile(r"[​‌‍﻿]")

POS_LABELS = {
    "noun": "noun", "verb": "verb", "adj": "adjective", "adv": "adverb",
    "name": "proper noun", "prep": "preposition", "num": "numeral",
    "pron": "pronoun", "conj": "conjunction", "intj": "interjection",
    "classifier": "classifier", "particle": "particle", "phrase": "phrase",
    "prefix": "prefix", "det": "determiner", "suffix": "suffix",
    "proverb": "proverb", "character": "character", "punct": "punctuation",
    "adnominal": "adnominal", "root": "root", "romanization": "romanization",
}


def norm(word: str) -> str:
    """Normalization applied to both headwords and page text before lookup."""
    return unicodedata.normalize("NFC", STRIP_RE.sub("", word.strip()))


def extract_romanization(entry: dict) -> str:
    for form in entry.get("forms", []):
        if form.get("tags") == ["romanization"]:
            return form.get("form", "")
    # fall back to head_templates expansion "word • (roman)"
    for ht in entry.get("head_templates", []):
        m = re.search(r"•\s*\(([^)]+)\)", ht.get("expansion", ""))
        if m:
            return m.group(1)
    return ""


def extract_glosses(entry: dict) -> list[str]:
    glosses: list[str] = []
    for sense in entry.get("senses", []):
        for g in sense.get("glosses") or []:
            g = g.strip()
            if g and g not in glosses:
                glosses.append(g)
    return glosses


def build() -> None:
    words: dict[str, list[list[str]]] = {}
    skipped_nonkhmer = 0
    skipped_nogloss = 0

    with KAIKKI.open() as fh:
        for line in fh:
            e = json.loads(line)
            w = norm(e.get("word", ""))
            # keep only headwords that are entirely Khmer-script (plus ZWSP
            # already stripped); mixed Latin headwords are romanization pages
            if not w or not KHMER_RE.search(w):
                skipped_nonkhmer += 1
                continue
            glosses = extract_glosses(e)
            if not glosses:
                skipped_nogloss += 1
                continue
            pos = POS_LABELS.get(e.get("pos", ""), e.get("pos", ""))
            roman = extract_romanization(e)
            sense = [pos, roman, "; ".join(glosses)]
            words.setdefault(w, [])
            # merge exact duplicate senses (kaikki sometimes repeats)
            if sense not in words[w]:
                words[w].append(sense)

    entry_count = len(words)

    # Frequency ranks + gloss-less wordlist supplement from SIL seafreq
    freq: dict[str, int] = {}
    wordlist_only = 0
    with SEAFREQ.open() as fh:
        rank = 0
        for line in fh:
            parts = line.rstrip("\n").split("\t")
            if len(parts) != 2:
                continue
            w = norm(parts[0])
            if not w or not KHMER_RE.search(w):
                continue
            rank += 1
            if w not in freq:
                freq[w] = rank
            if w not in words:
                words[w] = []  # known word, no gloss -> segmentation support
                wordlist_only += 1

    max_word_len = max(len(w) for w in words)  # UTF-16 code units == python len for BMP

    out = {
        "version": 1,
        "meta": {
            "built": date.today().isoformat(),
            "entryCount": entry_count,
            "wordlistCount": wordlist_only,
            "totalWords": len(words),
            "maxWordLen": max_word_len,
            "sources": [
                {
                    "name": "Wiktionary (via kaikki.org)",
                    "url": "https://kaikki.org/dictionary/Khmer/",
                    "license": "CC BY-SA 4.0",
                },
                {
                    "name": "SIL khmerlbdict (seafreq)",
                    "url": "https://github.com/silnrsi/khmerlbdict",
                    "license": "MIT",
                },
            ],
        },
        "words": words,
        "freq": freq,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w") as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))

    size_mb = OUT.stat().st_size / 1e6
    print(f"glossed entries:      {entry_count}")
    print(f"wordlist-only words:  {wordlist_only}")
    print(f"total lookup words:   {len(words)}")
    print(f"frequency ranks:      {len(freq)}")
    print(f"max word length:      {max_word_len} code units")
    print(f"skipped non-Khmer:    {skipped_nonkhmer}, no-gloss: {skipped_nogloss}")
    print(f"output: {OUT} ({size_mb:.1f} MB)")


if __name__ == "__main__":
    sys.exit(build())
