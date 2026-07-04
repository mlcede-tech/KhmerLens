#!/bin/bash
# Download raw dictionary sources for KhmerLens.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p raw/khmerlbdict

echo "Downloading kaikki.org Khmer Wiktionary extract (CC BY-SA 4.0)..."
curl -sSo raw/kaikki.org-dictionary-Khmer.jsonl \
  "https://kaikki.org/dictionary/Khmer/kaikki.org-dictionary-Khmer.jsonl"

echo "Downloading SIL khmerlbdict frequency list (MIT)..."
for f in seafreq.txt; do
  curl -sSo "raw/khmerlbdict/$f" \
    "https://raw.githubusercontent.com/silnrsi/khmerlbdict/master/src/$f"
done
curl -sSo raw/khmerlbdict/LICENSE \
  "https://raw.githubusercontent.com/silnrsi/khmerlbdict/master/LICENSE"

echo "Done. Now run: python3 build_dictionary.py"
