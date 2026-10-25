#!/bin/bash
# Package the KhmerLens extension into an upload-ready ZIP for the
# Chrome Web Store. The manifest sits at the ZIP root (Chrome requires this).
#
# Usage: ./package.sh   ->   dist/KhmerLens-v<version>.zip
set -euo pipefail
cd "$(dirname "$0")"

VERSION=$(python3 -c "import json;print(json.load(open('extension/manifest.json'))['version'])")
OUT="dist/KhmerLens-v${VERSION}.zip"
mkdir -p dist
rm -f "$OUT"

# Zip the *contents* of extension/ (so manifest.json is at the archive root).
# Exclude OS cruft; everything under extension/ is shipping code + data.
( cd extension && zip -rq "../$OUT" . -x '*.DS_Store' -x '__MACOSX*' )

echo "Wrote $OUT"
unzip -l "$OUT" | tail -n +2 | head -30
echo "---"
echo "Size: $(du -h "$OUT" | cut -f1)"
echo "Verify manifest is at root:"
LISTING=$(unzip -l "$OUT")
if echo "$LISTING" | grep -q ' manifest.json$'; then
  echo "  OK - manifest.json at ZIP root"
else
  echo "  ERROR - manifest.json not at root"
  exit 1
fi

# ---- Firefox (addons.mozilla.org) ----
# Same files, with the manifest swapped for a Firefox one generated from the
# Chrome manifest. dist/firefox/ is kept so it can be loaded in about:debugging.
FF_DIR="dist/firefox"
FF_OUT="dist/KhmerLens-firefox-v${VERSION}.zip"
rm -rf "$FF_DIR" "$FF_OUT"
mkdir -p "$FF_DIR"
( cd extension && tar cf - --exclude '.DS_Store' . ) | ( cd "$FF_DIR" && tar xf - )
python3 firefox-manifest.py extension/manifest.json "$FF_DIR/manifest.json"
( cd "$FF_DIR" && zip -rq "../../$FF_OUT" . )

echo "---"
echo "Wrote $FF_OUT (unpacked copy in $FF_DIR/)"
echo "Size: $(du -h "$FF_OUT" | cut -f1)"
