#!/usr/bin/env python3
"""Fetch freely-licensed Khmer pronunciation recordings for KhmerLens.

Sources (all hosted on Wikimedia Commons):
  1. Audio linked from Wiktionary entries (kaikki.org extract, `sounds` field)
  2. Commons Category:Khmer pronunciation  (files named "Km-<word>.ogg")
  3. Lingua Libre recordings               (files named "LL-Q9205 (khm)-<speaker>-<word>.wav")

Only recordings whose word exists in the built dictionary are kept, so run
build_dictionary.py first.

Output:
  ../extension/data/audio/<sha1-12>.<ext>   audio files
  ../extension/data/audio-index.json        word -> file map + per-file credits

Index format (versioned, consumed by extension/lib/audio.js):
{
  "version": 1,
  "meta": { "built": "...", "count": N },
  "words": { "<khmer word>": "<file>" },
  "credits": [ { "file": ..., "title": ..., "author": ..., "license": ..., "url": ... } ]
}
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

HERE = Path(__file__).parent
RAW = HERE / "raw"
KAIKKI = RAW / "kaikki.org-dictionary-Khmer.jsonl"
DICT = HERE.parent / "extension" / "data" / "dictionary.json"
AUDIO_DIR = HERE.parent / "extension" / "data" / "audio"
INDEX = HERE.parent / "extension" / "data" / "audio-index.json"

COMMONS_API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = "KhmerLens-pipeline/1.0 (https://github.com/mlimcede-tech/KhmerLens)"

# Characters stripped from headwords (matches build_dictionary.py)
STRIP_RE = re.compile(r"[​‌‍﻿]")


def norm(word: str) -> str:
    return unicodedata.normalize("NFC", STRIP_RE.sub("", word.strip()))


def api_get(params: dict[str, str]) -> dict:
    qs = urllib.parse.urlencode({**params, "format": "json"})
    req = urllib.request.Request(
        f"{COMMONS_API}?{qs}", headers={"User-Agent": USER_AGENT}
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)


def word_from_km_filename(title: str) -> str | None:
    """'File:Km-ខ្មែរ.ogg' -> 'ខ្មែរ'"""
    m = re.match(r"File:Km-(.+)\.(ogg|oga|wav|mp3|flac)$", title, re.I)
    return norm(m.group(1)) if m else None


def word_from_ll_filename(title: str) -> str | None:
    """'File:LL-Q9205 (khm)-<speaker>-កំប្រុក.wav' -> 'កំប្រុក'
    Khmer words never contain '-', so the word is the last dash segment."""
    m = re.match(r"File:LL-Q9205 \(khm\)-.+-([^-]+)\.(ogg|oga|wav|mp3|flac)$", title, re.I)
    return norm(m.group(1)) if m else None


def collect_candidates(dict_words: set[str]) -> dict[str, str]:
    """Return {word: commons file title} for dictionary words with recordings.
    Earlier sources win (Wiktionary-linked first)."""
    candidates: dict[str, str] = {}

    def add(word: str | None, title: str) -> None:
        if word and word in dict_words and word not in candidates:
            candidates[word] = title

    # 1. Wiktionary-linked audio from the kaikki extract
    with KAIKKI.open() as fh:
        for line in fh:
            e = json.loads(line)
            w = norm(e.get("word", ""))
            for s in e.get("sounds", []):
                name = s.get("audio")
                if name:
                    add(w, f"File:{name}")

    # 2. Commons Category:Khmer pronunciation
    cont: dict[str, str] = {}
    while True:
        data = api_get({
            "action": "query", "list": "categorymembers",
            "cmtitle": "Category:Khmer pronunciation",
            "cmtype": "file", "cmlimit": "500", **cont,
        })
        for m in data["query"]["categorymembers"]:
            add(word_from_km_filename(m["title"]), m["title"])
        cont = data.get("continue", {})
        if not cont:
            break

    # 3. Lingua Libre Khmer recordings (language Qid 9205)
    cont = {}
    while True:
        data = api_get({
            "action": "query", "list": "search", "srnamespace": "6",
            "srsearch": 'intitle:"LL-Q9205 (khm)"', "srlimit": "500", **cont,
        })
        for m in data["query"]["search"]:
            add(word_from_ll_filename(m["title"]), m["title"])
        cont = data.get("continue", {})
        if not cont:
            break

    return candidates


def file_info(titles: list[str]) -> dict[str, dict]:
    """Fetch download URL + attribution for up to 50 file titles."""
    out: dict[str, dict] = {}
    for i in range(0, len(titles), 50):
        data = api_get({
            "action": "query", "titles": "|".join(titles[i:i + 50]),
            "prop": "imageinfo",
            "iiprop": "url|extmetadata",
        })
        for page in data["query"]["pages"].values():
            info = (page.get("imageinfo") or [{}])[0]
            if not info.get("url"):
                continue
            meta = info.get("extmetadata", {})
            def field(key: str) -> str:
                return re.sub(r"<[^>]+>", "", meta.get(key, {}).get("value", "")).strip()
            out[page["title"]] = {
                "url": info["url"],
                "descurl": info.get("descriptionurl", ""),
                "author": field("Artist") or "unknown",
                "license": field("LicenseShortName") or "see file page",
            }
    return out


def build() -> int:
    dict_words = set(json.loads(DICT.read_text())["words"])
    candidates = collect_candidates(dict_words)
    print(f"recordings matching dictionary words: {len(candidates)}")

    infos = file_info(sorted(set(candidates.values())))
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)

    words: dict[str, str] = {}
    credits: list[dict] = []
    for word, title in sorted(candidates.items()):
        info = infos.get(title)
        if not info:
            print(f"  skip (no file info): {title}")
            continue
        ext = title.rsplit(".", 1)[-1].lower()
        fname = hashlib.sha1(word.encode()).hexdigest()[:12] + "." + ext
        dest = AUDIO_DIR / fname
        if not dest.exists():
            req = urllib.request.Request(info["url"], headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=60) as resp:
                dest.write_bytes(resp.read())
            time.sleep(0.5)  # be polite to Commons
        words[word] = fname
        credits.append({
            "file": fname,
            "title": title,
            "author": info["author"],
            "license": info["license"],
            "url": info["descurl"],
        })
        print(f"  {word} -> {fname} ({info['license']})")

    index = {
        "version": 1,
        "meta": {"built": date.today().isoformat(), "count": len(words)},
        "words": words,
        "credits": credits,
    }
    INDEX.write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")))
    total_kb = sum(f.stat().st_size for f in AUDIO_DIR.iterdir()) / 1024
    print(f"index: {INDEX} ({len(words)} words, audio {total_kb:.0f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(build())
