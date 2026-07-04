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
unzip -l "$OUT" | grep -q ' manifest.json$' && echo "  OK — manifest.json at ZIP root" \
  || { echo "  ERROR — manifest.json not at root"; exit 1; }
