/**
 * KhmerLens live browser verification.
 * Loads the unpacked extension in headless Chromium via Playwright, opens the
 * saved Khmer test pages, simulates hover, checks the popup, and screenshots.
 *
 * Run: node browser-verify.js
 */
'use strict';
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { chromium } = require('playwright');

const EXT = path.resolve(__dirname, '..', 'extension');
const PAGES = path.join(__dirname, 'fixtures', 'pages');
const SHOTS = path.join(__dirname, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

let failures = 0;
function check(name, cond, extra) {
  const mark = cond ? 'PASS' : 'FAIL';
  if (!cond) failures++;
  console.log(`[${mark}] ${name}${extra ? ' — ' + extra : ''}`);
}

async function enableOnPage(sw, page) {
  // simulate the toolbar click for this tab (Playwright cannot click the
  // real toolbar icon): reuse the background's state + message path
  await page.bringToFront();
  await sw.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const o = await chrome.storage.session.get({ enabledTabs: {} });
    o.enabledTabs[String(tab.id)] = true;
    await chrome.storage.session.set(o);
    await chrome.tabs.sendMessage(tab.id, {
      type: 'khmerlens:setEnabled', enabled: true,
    });
  });
}

async function hoverKhmer(page, selector, charIndex = 2) {
  // find the first Khmer text node inside selector and mouse-move onto it
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
        r.setStart(node, i);
        r.setEnd(node, i + 1);
        const rect = r.getBoundingClientRect();
        if (rect.width || rect.height) {
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        }
      }
    }
    return null;
  }, { selector, charIndex });
  if (!pt) return false;
  await page.mouse.move(pt.x, pt.y);
  return true;
}

async function popupState(page) {
  return page.evaluate(() => {
    const host = document.getElementById('khmerlens-host');
    if (!host || !host.shadowRoot) return { present: false };
    const card = host.shadowRoot.querySelector('.kl-card');
    if (!card) return { present: false };
    const visible = !card.classList.contains('kl-hidden');
    const q = (s) => {
      const el = card.querySelector(s);
      return el ? el.textContent : null;
    };
    const rect = card.getBoundingClientRect();
    return {
      present: true,
      visible,
      word: q('.kl-word'),
      roman: q('.kl-roman'),
      gloss: q('.kl-gloss') || q('.kl-nogloss'),
      alt: q('.kl-alt'),
      dark: card.classList.contains('kl-dark'),
      inViewport: rect.left >= 0 && rect.top >= 0 &&
        rect.right <= innerWidth && rect.bottom <= innerHeight,
      highlighted: !!(CSS.highlights && CSS.highlights.get('khmerlens')),
    };
  });
}

(async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'khmerlens-'));
  const ctx = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    channel: 'chromium', // full browser in new-headless mode (MV3 SW support)
    args: [
      `--disable-extensions-except=${EXT}`,
      `--load-extension=${EXT}`,
    ],
    viewport: { width: 1280, height: 800 },
  });

  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  check('service worker started', !!sw);

  // ---------------------------------------------------------- news page
  const page = await ctx.newPage();
  await page.goto('file://' + path.join(PAGES, 'news.html'));
  await enableOnPage(sw, page);
  await page.waitForTimeout(300);

  check('hover target found (paragraph)', await hoverKhmer(page, 'p'));
  await page.waitForTimeout(900); // debounce + first dictionary load
  let st = await popupState(page);
  check('popup visible on hover', st.present && st.visible, JSON.stringify(st));
  check('popup shows Khmer word', !!st.word && /[ក-៿]/.test(st.word), st.word);
  check('popup shows gloss', !!st.gloss, st.gloss && st.gloss.slice(0, 60));
  check('popup inside viewport', st.inViewport);
  check('match highlighted on page', st.highlighted);
  await page.screenshot({ path: path.join(SHOTS, '01-news-hover.png') });

  // cycle alternatives with Shift
  const wordBefore = st.word;
  await page.keyboard.press('Shift');
  await page.waitForTimeout(120);
  st = await popupState(page);
  check('Shift cycles matches (or single match)',
    st.visible && (st.alt === null || st.word !== wordBefore || st.alt.includes('/')),
    `before=${wordBefore} after=${st.word} alt=${st.alt}`);
  await page.screenshot({ path: path.join(SHOTS, '02-news-cycled.png') });

  // n = next word
  await page.keyboard.press('n');
  await page.waitForTimeout(150);
  const stNext = await popupState(page);
  check('n jumps to next word', stNext.visible, stNext.word);

  // Esc hides
  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);
  st = await popupState(page);
  check('Esc hides popup', st.present && !st.visible);

  // ---------------------------------------------------- ZWSP paragraph
  const zwspOk = await page.evaluate(() => {
    const els = [...document.querySelectorAll('p')];
    return els.some((p) => p.textContent.includes('​'));
  });
  check('fixture has ZWSP paragraph', zwspOk);
  if (zwspOk) {
    const hovered = await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const i = node.data.indexOf('​');
        if (i > 2 && /[ក-៝]/.test(node.data[i - 1])) {
          const r = new Range();
          r.setStart(node, i - 2);
          r.setEnd(node, i - 1);
          const rect = r.getBoundingClientRect();
          return { x: rect.left + 2, y: rect.top + rect.height / 2 };
        }
      }
      return null;
    });
    if (hovered) {
      await page.mouse.move(hovered.x, hovered.y);
      await page.waitForTimeout(400);
      st = await popupState(page);
      check('popup works next to ZWSP', st.visible, st.word);
    } else {
      check('popup works next to ZWSP', false, 'no hover point found');
    }
  }

  // ------------------------------------------------------- link hover
  check('hover target found (link)', await hoverKhmer(page, 'a'));
  await page.waitForTimeout(400);
  st = await popupState(page);
  check('popup on link text, no navigation', st.visible && page.url().includes('news.html'));
  await page.screenshot({ path: path.join(SHOTS, '03-news-link.png') });

  // -------------------------------------------------- scrolling container
  const scrollSel = 'div[style*="overflow"], .scroll-box';
  if (await page.$(scrollSel)) {
    await page.$eval(scrollSel, (el) => { el.scrollTop = 20; });
    check('hover target found (scroll container)', await hoverKhmer(page, scrollSel));
    await page.waitForTimeout(400);
    st = await popupState(page);
    check('popup inside scrolling container', st.visible, st.word);
  }

  // ------------------------------------------------------ wikipedia page
  const page2 = await ctx.newPage();
  await page2.goto('file://' + path.join(PAGES, 'wikipedia.html'));
  await enableOnPage(sw, page2);
  await page2.waitForTimeout(300);
  check('hover target found (wikipedia)', await hoverKhmer(page2, 'p', 4));
  await page2.waitForTimeout(700);
  st = await popupState(page2);
  check('popup on wikipedia page', st.visible, `${st.word} | ${st.gloss && st.gloss.slice(0, 50)}`);
  check('romanization shown', st.roman === null || st.roman.length > 0, st.roman);
  await page2.screenshot({ path: path.join(SHOTS, '04-wikipedia.png') });

  // ------------------------------------------------------------ dark mode
  await page2.emulateMedia({ colorScheme: 'dark' });
  await hoverKhmer(page2, 'p', 8);
  await page2.waitForTimeout(400);
  st = await popupState(page2);
  check('dark mode applied (auto theme)', st.visible && st.dark);
  await page2.screenshot({ path: path.join(SHOTS, '05-wikipedia-dark.png') });

  // ------------------------------------------------------ disabled state
  await page2.bringToFront();
  await sw.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    await chrome.tabs.sendMessage(tab.id, {
      type: 'khmerlens:setEnabled', enabled: false,
    });
  });
  await page2.waitForTimeout(150);
  await hoverKhmer(page2, 'p', 2);
  await page2.waitForTimeout(400);
  st = await popupState(page2);
  check('disabled: popup stays hidden', !st.present || !st.visible);

  await ctx.close();
  console.log(failures ? `\n${failures} FAILURES` : '\nAll browser checks passed.');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
