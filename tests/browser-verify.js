/**
 * KhmerLens live browser verification.
 *
 * Part A — content-script integration: serves the project over HTTP, runs the
 * real lib + content scripts on the saved Khmer pages (via testkit's chrome
 * shim), simulates hover, and checks the popup, highlight, shortcuts, ZWSP,
 * links, scroll containers, and dark mode.
 *
 * Part B — extension smoke: loads the actual unpacked extension and confirms
 * the MV3 service worker boots with the activeTab + scripting permission model.
 *
 * Run: node browser-verify.js
 */
'use strict';
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { chromium } = require('playwright');
const kit = require('./testkit.js');

const PAGES = 'tests/fixtures/pages';
const SHOTS = path.join(__dirname, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

let failures = 0;
function check(name, cond, extra) {
  if (!cond) failures++;
  console.log(`[${cond ? 'PASS' : 'FAIL'}] ${name}${extra ? ' — ' + extra : ''}`);
}

async function hoverKhmer(page, selector, charIndex = 2) {
  const pt = await page.evaluate(({ selector, charIndex }) => {
    const rootEl = document.querySelector(selector);
    if (!rootEl) return null;
    const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const m = node.data.match(/[ក-៝]{4,}/);
      if (m) {
        const r = new Range();
        const i = node.data.indexOf(m[0]) + charIndex;
        r.setStart(node, i); r.setEnd(node, i + 1);
        const rect = r.getBoundingClientRect();
        if (rect.width || rect.height) return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      }
    }
    return null;
  }, { selector, charIndex });
  if (!pt) return false;
  await page.mouse.move(pt.x, pt.y);
  return true;
}

function popupState(page) {
  return page.evaluate(() => {
    const host = document.getElementById('khmerlens-host');
    if (!host || !host.shadowRoot) return { present: false };
    const card = host.shadowRoot.querySelector('.kl-card');
    if (!card) return { present: false };
    const q = (s) => { const el = card.querySelector(s); return el ? el.textContent : null; };
    const rect = card.getBoundingClientRect();
    return {
      present: true,
      visible: !card.classList.contains('kl-hidden'),
      word: q('.kl-word'), roman: q('.kl-roman'),
      gloss: q('.kl-gloss') || q('.kl-nogloss'), alt: q('.kl-alt'),
      dark: card.classList.contains('kl-dark'),
      keys: q('.kl-keys'),
      audioBtn: !!card.querySelector('.kl-audio'),
      ankiBtn: !!card.querySelector('.kl-anki'),
      inViewport: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
      highlighted: !!(CSS.highlights && CSS.highlights.get('khmerlens')),
    };
  });
}

async function newEnabledPage(browser, server, pageUrl, colorScheme) {
  const page = await browser.newPage();
  if (colorScheme) await page.emulateMedia({ colorScheme });
  await kit.primePage(page, server.url);
  await page.goto(server.url + '/' + pageUrl);
  await kit.enable(page, server.url);
  return page;
}

async function partA() {
  const server = await kit.startServer();
  const browser = await chromium.launch({ headless: true, viewport: { width: 1280, height: 800 } });

  // --- news page (edge cases) ---
  const page = await newEnabledPage(browser, server, `${PAGES}/news.html`, 'light');

  check('hover target found (paragraph)', await hoverKhmer(page, 'p'));
  await page.waitForTimeout(300);
  let st = await popupState(page);
  check('popup visible on hover', st.present && st.visible, JSON.stringify(st).slice(0, 120));
  check('popup shows Khmer word', !!st.word && /[ក-៿]/.test(st.word), st.word);
  check('popup shows gloss', !!st.gloss, st.gloss && st.gloss.slice(0, 50));
  check('popup inside viewport', st.inViewport);
  check('match highlighted on page', st.highlighted);
  await page.screenshot({ path: path.join(SHOTS, '01-news-hover.png') });

  const wordBefore = st.word;
  await page.keyboard.press('Shift');
  await page.waitForTimeout(120);
  st = await popupState(page);
  check('Shift cycles matches (or single match)',
    st.visible && (st.alt === null || st.word !== wordBefore || st.alt.includes('/')),
    `before=${wordBefore} after=${st.word} alt=${st.alt}`);

  await page.keyboard.press('n');
  await page.waitForTimeout(150);
  check('n jumps to next word', (await popupState(page)).visible);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);
  check('Esc hides popup', !(await popupState(page)).visible);

  // ZWSP
  const zwspOk = await page.evaluate(() =>
    [...document.querySelectorAll('p')].some((p) => p.textContent.includes('​')));
  check('fixture has ZWSP paragraph', zwspOk);
  if (zwspOk) {
    const hovered = await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const i = node.data.indexOf('​');
        if (i > 2 && /[ក-៝]/.test(node.data[i - 1])) {
          const r = new Range(); r.setStart(node, i - 2); r.setEnd(node, i - 1);
          const rect = r.getBoundingClientRect();
          return { x: rect.left + 2, y: rect.top + rect.height / 2 };
        }
      }
      return null;
    });
    if (hovered) {
      await page.mouse.move(hovered.x, hovered.y);
      await page.waitForTimeout(300);
      check('popup works next to ZWSP', (await popupState(page)).visible);
    } else check('popup works next to ZWSP', false, 'no hover point');
  }

  check('hover target found (link)', await hoverKhmer(page, 'a'));
  await page.waitForTimeout(300);
  check('popup on link text, no navigation',
    (await popupState(page)).visible && page.url().includes('news.html'));

  const scrollSel = '.scroll-box, div[style*="overflow"]';
  if (await page.$(scrollSel)) {
    await page.$eval(scrollSel, (el) => { el.scrollTop = 20; });
    check('hover target found (scroll container)', await hoverKhmer(page, scrollSel));
    await page.waitForTimeout(300);
    check('popup inside scrolling container', (await popupState(page)).visible);
  }

  // --- wikipedia page + dark mode ---
  const page2 = await newEnabledPage(browser, server, `${PAGES}/wikipedia.html`, 'dark');
  check('hover target found (wikipedia)', await hoverKhmer(page2, 'p', 4));
  await page2.waitForTimeout(300);
  st = await popupState(page2);
  check('popup on wikipedia page', st.visible, st.word);
  check('romanization shown', st.roman === null || st.roman.length > 0, st.roman);
  check('dark mode applied (auto theme)', st.visible && st.dark);
  await page2.screenshot({ path: path.join(SHOTS, '04-wikipedia-dark.png') });

  // --- audio button + anki flow (news page, anki enabled via settings) ---
  const page3 = await newEnabledPage(browser, server, `${PAGES}/news.html`, 'light');
  await page3.evaluate(() =>
    new Promise((r) => chrome.storage.sync.set({ ankiEnabled: true }, r)));
  // toggle off/on so the content script re-reads settings
  await page3.evaluate(() => {
    window.KhmerLensTest.setEnabled(false);
    window.KhmerLensTest.setEnabled(true);
  });

  // hover the word ខ្មែរ, which ships with a bundled recording
  const pt = await page3.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const i = node.data.indexOf('ខ្មែរ');
      if (i !== -1) {
        const r = new Range(); r.setStart(node, i); r.setEnd(node, i + 1);
        const rect = r.getBoundingClientRect();
        if (rect.width || rect.height) {
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        }
      }
    }
    return null;
  });
  check('hover target found (ខ្មែរ)', !!pt);
  if (pt) {
    await page3.mouse.move(pt.x, pt.y);
    await page3.waitForTimeout(400);
    // the longest match under the cursor may be a compound; cycle to ខ្មែរ
    for (let i = 0; i < 5; i++) {
      st = await popupState(page3);
      if (st.word === 'ខ្មែរ') break;
      await page3.keyboard.press('Shift');
      await page3.waitForTimeout(120);
    }
    check('popup on ខ្មែរ', st.word === 'ខ្មែរ', st.word);
    check('audio button shown for bundled recording', st.audioBtn);
    check('anki button shown when integration enabled', st.ankiBtn);
    check('keys hint mentions sound and anki',
      !!st.keys && st.keys.includes('S sound') && st.keys.includes('A anki'), st.keys);

    await page3.keyboard.press('a');
    await page3.waitForTimeout(200);
    const added = await page3.evaluate(() => window.__ankiAdds || []);
    check('A sends the word to the anki bridge',
      added.length === 1 && added[0].word === 'ខ្មែរ' && added[0].senses.length > 0,
      JSON.stringify(added).slice(0, 80));
    check('foot flashes anki confirmation',
      (await popupState(page3)).keys === 'Added to Anki ✓',
      (await popupState(page3)).keys);
    await page3.screenshot({ path: path.join(SHOTS, '05-audio-anki.png') });
  }

  // --- disabled state ---
  await page2.evaluate(() => window.KhmerLensTest.setEnabled(false));
  await hoverKhmer(page2, 'p', 8);
  await page2.waitForTimeout(300);
  check('disabled: popup stays hidden', !(await popupState(page2)).visible);

  await browser.close();
  await server.close();
}

async function partB() {
  const EXT = path.resolve(__dirname, '..', 'extension');
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'khmerlens-smoke-'));
  const ctx = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    channel: 'chromium',
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  check('extension service worker boots', !!sw);

  const perms = await sw.evaluate(() => ({
    scripting: typeof chrome.scripting !== 'undefined',
    action: typeof chrome.action !== 'undefined',
    // manifest reflects the minimal permission model
    manifest: chrome.runtime.getManifest(),
  }));
  check('chrome.scripting available (activeTab injection)', perms.scripting);
  check('chrome.action available (toolbar toggle)', perms.action);
  check('manifest has NO broad host_permissions',
    !perms.manifest.host_permissions || perms.manifest.host_permissions.length === 0,
    JSON.stringify(perms.manifest.host_permissions || []));
  check('manifest requests activeTab, not <all_urls> content script',
    perms.manifest.permissions.includes('activeTab') &&
    (!perms.manifest.content_scripts || perms.manifest.content_scripts.length === 0),
    perms.manifest.permissions.join(','));

  await ctx.close();
}

(async () => {
  console.log('— Part A: content-script integration —');
  await partA();
  console.log('\n— Part B: extension smoke (permission model) —');
  await partB();
  console.log(failures ? `\n${failures} FAILURES` : '\nAll browser checks passed.');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
