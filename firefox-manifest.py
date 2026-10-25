"""Write a Firefox manifest.json derived from the Chrome one.

Usage: python3 firefox-manifest.py <chrome manifest> <output path>

Firefox differences:
- background runs as an event page ("scripts"), not a service worker, so the
  helper libs that background.js pulls in via importScripts on Chrome are
  listed here instead.
- AMO requires an add-on ID and a data collection declaration.
"""
import json
import sys

# Permanent once the add-on is uploaded to AMO. Never change it.
GECKO_ID = "khmerlens@khmeralphabet.com"


def main(src: str, dst: str) -> None:
    with open(src, encoding="utf-8") as f:
        manifest = json.load(f)

    manifest.pop("minimum_chrome_version", None)
    manifest["background"] = {
        "scripts": ["lib/anki.js", "lib/kheng.js", "background.js"]
    }
    manifest["browser_specific_settings"] = {
        "gecko": {
            "id": GECKO_ID,
            "strict_min_version": "140.0",
            "data_collection_permissions": {"required": ["none"]},
        }
    }

    with open(dst, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
        f.write("\n")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
