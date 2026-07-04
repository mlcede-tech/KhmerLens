/**
 * Generate Chrome Web Store assets into docs/store-assets/:
 *   screenshot-1..3.png  1280x800  (store screenshots)
 *   promo-tile.png       440x280   (small promo tile)
 *
 * Screenshots 1-2 load the real unpacked extension and capture the live
 * popup; screenshot 3 is the options page. Run: node gen-store-assets.js
 */
'use strict';
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { chromium } = require('playwright');

const EXT = path.resolve(__dirname, '..', 'extension');
const PAGES = path.join(__dirname, 'fixtures', 'pages');
const OUT = path.resolve(__dirname, '..', 'docs', 'store-assets');
const OPTIONS = 'file://' + path.join(EXT, 'options', 'options.html');
const PROMO = 'file://' + path.join(OUT, 'promo-tile.html');
fs.mkdirSync(OUT, { recursive: true });

async function enable(sw, page) {
  await page.bringToFront();
  await sw.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const o = await chrome.storage.session.get({ enabledTabs: {} });
    o.enabledTabs[String(tab.id)] = true;
    await chrome.storage.session.set(o);
    await chrome.tabs.sendMessage(tab.id, { type: 'khmerlens:setEnabled', enabled: true });
  });
}

// hover a specific Khmer word (first occurrence of `word`, else first long run)
async function hoverWord(page, word) {
  const pt = await page.evaluate((word) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      let i = word ? node.data.indexOf(word) : -1;
      if (i < 0) {
        const m = node.data.match(/[ក-៝]{5,}/);
        if (!m) continue;
        i = node.data.indexOf(m[0]);
      }
      const r = new Range();
      r.setStart(node, i + 1);
      r.setEnd(node, i + 2);
      const rect = r.getBoundingClientRect();
      if (rect.width || rect.height) {
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      }
    }
    return null;
  }, word);
  if (!pt) throw new Error('no hover target for ' + word);
  await page.mouse.move(pt.x, pt.y);
  await page.waitForTimeout(700);
}

(async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'khmerlens-assets-'));
  const ctx = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    channel: 'chromium',
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2, // crisp 2x capture (store accepts, downscales cleanly)
  });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');

  // 1. popup on Wikipedia article (light)
  const p1 = await ctx.newPage();
  await p1.emulateMedia({ colorScheme: 'light' });
  await p1.goto('file://' + path.join(PAGES, 'wikipedia.html'));
  await enable(sw, p1);
  await p1.waitForTimeout(300);
  await hoverWord(p1, null);
  await p1.screenshot({ path: path.join(OUT, 'screenshot-1.png') });

  // 2. popup on news page (dark)
  const p2 = await ctx.newPage();
  await p2.emulateMedia({ colorScheme: 'dark' });
  await p2.goto('file://' + path.join(PAGES, 'news.html'));
  await enable(sw, p2);
  await p2.waitForTimeout(300);
  await hoverWord(p2, 'ភ្នំពេញ');
  await p2.screenshot({ path: path.join(OUT, 'screenshot-2.png') });

  // 3. options page (light)
  const p3 = await ctx.newPage();
  await p3.emulateMedia({ colorScheme: 'light' });
  await p3.goto(OPTIONS);
  await p3.waitForTimeout(400);
  await p3.screenshot({ path: path.join(OUT, 'screenshot-3.png') });

  // promo tile (exact 440x280, 2x)
  const promo = await ctx.newPage();
  await promo.setViewportSize({ width: 440, height: 280 });
  await promo.goto(PROMO);
  await promo.waitForTimeout(300);
  await promo.screenshot({ path: path.join(OUT, 'promo-tile.png'),
    clip: { x: 0, y: 0, width: 440, height: 280 } });

  await ctx.close();

  // report dimensions
  const { execSync } = require('node:child_process');
  for (const f of ['screenshot-1.png', 'screenshot-2.png', 'screenshot-3.png', 'promo-tile.png']) {
    const size = fs.statSync(path.join(OUT, f)).size;
    console.log(`${f}  ${(size / 1024).toFixed(0)} KB`);
  }
  console.log('Assets written to docs/store-assets/');
})().catch((e) => { console.error(e); process.exit(1); });
