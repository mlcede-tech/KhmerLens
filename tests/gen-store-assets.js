/**
 * Generate Chrome Web Store assets into docs/store-assets/:
 *   screenshot-1..3.png  1280x800   promo-tile.png  440x280
 *
 * Screenshots run the real content script on the saved Khmer pages (via
 * testkit's chrome shim, matching the extension's activeTab model), so the
 * popup shown is the genuine article. Run: node gen-store-assets.js
 */
'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');
const kit = require('./testkit.js');

const OUT = path.resolve(__dirname, '..', 'docs', 'store-assets');
const PAGES = 'tests/fixtures/pages';
fs.mkdirSync(OUT, { recursive: true });

async function hover(page, word) {
  const pt = await page.evaluate((word) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      let i = word ? node.data.indexOf(word) : -1;
      if (i < 0) { const m = node.data.match(/[ក-៝]{5,}/); if (!m) continue; i = node.data.indexOf(m[0]); }
      const r = new Range(); r.setStart(node, i + 1); r.setEnd(node, i + 2);
      const rect = r.getBoundingClientRect();
      if (rect.width || rect.height) return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    return null;
  }, word);
  if (!pt) throw new Error('no hover target for ' + word);
  await page.mouse.move(pt.x, pt.y);
  await page.waitForTimeout(600);
}

async function shot(browser, server, pageUrl, scheme, hoverWord, out) {
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  if (scheme) await page.emulateMedia({ colorScheme: scheme });
  if (pageUrl.endsWith('options.html')) {
    await page.goto(server.url + '/' + pageUrl);
    await page.waitForTimeout(400);
  } else {
    await kit.primePage(page, server.url);
    await page.goto(server.url + '/' + pageUrl);
    await kit.enable(page, server.url);
    await hover(page, hoverWord);
  }
  await page.screenshot({ path: path.join(OUT, out) });
  await page.close();
}

(async () => {
  const server = await kit.startServer();
  const browser = await chromium.launch({ headless: true, deviceScaleFactor: 2 });

  await shot(browser, server, `${PAGES}/wikipedia.html`, 'light', null, 'screenshot-1.png');
  await shot(browser, server, `${PAGES}/news.html`, 'dark', 'ភ្នំពេញ', 'screenshot-2.png');
  await shot(browser, server, 'extension/options/options.html', 'light', null, 'screenshot-3.png');

  // promo tile 440x280
  const promo = await browser.newPage();
  await promo.setViewportSize({ width: 440, height: 280 });
  await promo.goto(server.url + '/docs/store-assets/promo-tile.html');
  await promo.waitForTimeout(300);
  await promo.screenshot({ path: path.join(OUT, 'promo-tile.png'), clip: { x: 0, y: 0, width: 440, height: 280 } });
  await promo.close();

  await browser.close();
  await server.close();

  // downscale 2x captures to exact store dimensions with a Python one-liner
  const { execSync } = require('node:child_process');
  execSync(`python3 - <<'PY'
from PIL import Image
t = {'screenshot-1.png':(1280,800),'screenshot-2.png':(1280,800),'screenshot-3.png':(1280,800),'promo-tile.png':(440,280)}
import os
for f,(w,h) in t.items():
    p = os.path.join(${JSON.stringify(OUT)}, f)
    im = Image.open(p).convert('RGB').resize((w,h), Image.LANCZOS)
    im.save(p, 'PNG', optimize=True)
    print(f, im.size)
PY`, { stdio: 'inherit' });
  console.log('Assets written to docs/store-assets/');
})().catch((e) => { console.error(e); process.exit(1); });
