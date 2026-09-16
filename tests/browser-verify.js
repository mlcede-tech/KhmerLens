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
      status: q('.kl-status'),
      audioBtn: !!card.querySelector('.kl-audio'),
      copyBtn: !!card.querySelector('.kl-copy'),
      nextBtn: !!card.querySelector('.kl-next'),
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
    check('copy button rendered', st.copyBtn);
    check('next button rendered', st.nextBtn);
    const hasAnkiButton = await page3.evaluate(() => {
      const host = document.getElementById('khmerlens-host');
      const card = host && host.shadowRoot && host.shadowRoot.querySelector('.kl-card');
      return !!(card && card.querySelector('.kl-anki'));
    });
    check('clickable anki button rendered when Anki is enabled', hasAnkiButton);

    // keyboard shortcut still works
    await page3.keyboard.press('a');
    await page3.waitForTimeout(200);
    let added = await page3.evaluate(() => window.__ankiAdds || []);
    check('A sends the word to the anki bridge',
      added.length === 1 && added[0].word === 'ខ្មែរ' && added[0].senses.length > 0,
      JSON.stringify(added).slice(0, 80));
    check('foot flashes anki confirmation',
      (await popupState(page3)).status === 'Added to Anki ✓',
      (await popupState(page3)).status);
    await page3.waitForTimeout(1300); // let the flash message clear

    // clicking the button does the same thing
    await page3.click('.kl-anki');
    await page3.waitForTimeout(200);
    added = await page3.evaluate(() => window.__ankiAdds || []);
    check('clicking Anki button sends the word to the anki bridge',
      added.length === 2 && added[1].word === 'ខ្មែរ',
      JSON.stringify(added).slice(0, 120));

    // copy and next buttons are clickable too
    await page3.click('.kl-copy');
    await page3.waitForTimeout(200);
    check('foot flashes copy confirmation',
      (await popupState(page3)).status === 'Copied ✓',
      (await popupState(page3)).status);
    await page3.waitForTimeout(1300);

    const wordBeforeNextClick = (await popupState(page3)).word;
    await page3.click('.kl-next');
    await page3.waitForTimeout(200);
    check('clicking Next moves to another word',
      (await popupState(page3)).visible && (await popupState(page3)).word !== wordBeforeNextClick,
      (await popupState(page3)).word);

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

async function partC() {
  console.log('\n— Part C: paste panel —');
  const server = await kit.startServer();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await kit.primePage(page, server.url);
  await page.goto(server.url + '/' + PAGES + '/news.html'); // any served page; panel is an overlay
  await kit.enable(page, server.url);

  const closedOnEnable = await page.evaluate(() => !(globalThis.KhmerLensPanel && globalThis.KhmerLensPanel.isOpen()));
  check('panel stays closed when KhmerLens is enabled (opens only via its own toggle)', closedOnEnable);

  const opened = await page.evaluate(() => {
    globalThis.KhmerLensPanel.open();
    return globalThis.KhmerLensPanel.isOpen();
  });
  check('panel opens on explicit open()', opened);

  // put clean Khmer into the editable (simulates a paste result)
  const placed = await page.evaluate(() => {
    const ed = globalThis.KhmerLensPanel.getEditableEl();
    if (!ed) return false;
    ed.appendChild(document.createTextNode('ប្រទេសកម្ពុជាមានប្រជាជន'));
    return true;
  });
  check('editable found and filled', placed);

  const pt = await page.evaluate(() => {
    const ed = globalThis.KhmerLensPanel.getEditableEl();
    const walker = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT);
    const node = walker.nextNode();
    const r = new Range(); r.setStart(node, 2); r.setEnd(node, 3);
    const rect = r.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });
  await page.mouse.move(pt.x, pt.y);
  await page.waitForTimeout(120);
  const st = await popupState(page);
  check('popup appears over pasted panel text', st.visible, st.word);
  check('popup shows a gloss for pasted text', !!st.gloss, st.gloss && st.gloss.slice(0, 40));

  await browser.close();
  await server.close();
}

async function partD() {
  console.log('\n— Part D: independent paste-panel toggle —');
  const server = await kit.startServer();
  const browser = await chromium.launch();

  // D1: content.js's khmerlens:togglePanel / khmerlens:getPanelOpen handling,
  // driven the way the background worker's chrome.tabs.sendMessage would.
  // testkit's onMessage.addListener is a no-op stub, so capture the real
  // listener here instead of invoking it.
  const page = await browser.newPage();
  await kit.primePage(page, server.url);
  await page.addInitScript(() => {
    window.__listeners = [];
    window.chrome.runtime.onMessage = {
      addListener: function (fn) { window.__listeners.push(fn); },
    };
  });
  await page.goto(server.url + '/' + PAGES + '/news.html');
  await kit.enable(page, server.url);

  const dispatch = (msg) => page.evaluate((msg) => new Promise((resolve) => {
    let responded = false;
    for (const fn of window.__listeners) {
      const r = fn(msg, {}, (resp) => { responded = true; resolve(resp); });
      if (r === true) return;
    }
    if (!responded) resolve(undefined);
  }), msg);

  let resp = await dispatch({ type: 'khmerlens:getPanelOpen' });
  check('getPanelOpen reports closed (panel does not auto-open on enable)', resp && resp.open === false, JSON.stringify(resp));

  resp = await dispatch({ type: 'khmerlens:togglePanel' });
  check('togglePanel opens it and reports open:true', resp && resp.open === true, JSON.stringify(resp));
  check('panel DOM actually reflects open state',
    (await page.evaluate(() => globalThis.KhmerLensPanel.isOpen())) === true);

  resp = await dispatch({ type: 'khmerlens:togglePanel' });
  check('togglePanel again closes it', resp && resp.open === false, JSON.stringify(resp));
  await page.close();

  // D2: action.html/action.js — the popup's own "Paste panel" switch, driven
  // against a mocked background so it can be tested without an activeTab
  // gesture (Playwright can't simulate a real toolbar click; see partB).
  const page2 = await browser.newPage();
  await page2.addInitScript(() => {
    let enabled = false;
    let panelOpen = false;
    window.chrome = {
      runtime: {
        lastError: null,
        sendMessage: function (msg, cb) {
          if (msg.type === 'khmerlens:getEnabled') { cb({ enabled }); return; }
          if (msg.type === 'khmerlens:toggle') {
            enabled = !enabled;
            if (!enabled) panelOpen = false; // matches content.js: disabling closes the panel
            cb({ enabled, blocked: false });
            return;
          }
          if (msg.type === 'khmerlens:getPanelOpen') { cb({ open: panelOpen }); return; }
          if (msg.type === 'khmerlens:togglePanel') { panelOpen = !panelOpen; cb({ open: panelOpen }); }
        },
      },
    };
  });
  await page2.goto(server.url + '/extension/action/action.html');

  check('panel switch starts disabled (KhmerLens off)',
    (await page2.$eval('#panelToggle', (el) => el.disabled)) === true);

  await page2.click('#toggle');
  await page2.waitForTimeout(30);
  check('enabling KhmerLens enables the panel switch, unchecked (panel does not auto-open)',
    (await page2.$eval('#panelToggle', (el) => el.disabled)) === false &&
    (await page2.$eval('#panelToggle', (el) => el.checked)) === false);

  await page2.click('#panelToggle');
  await page2.waitForTimeout(30);
  check('panel switch turns on independently, KhmerLens stays on',
    (await page2.$eval('#panelToggle', (el) => el.checked)) === true &&
    (await page2.$eval('#toggle', (el) => el.checked)) === true);

  await page2.click('#toggle'); // KhmerLens off
  await page2.waitForTimeout(30);
  check('disabling KhmerLens disables and unchecks the panel switch',
    (await page2.$eval('#panelToggle', (el) => el.disabled)) === true &&
    (await page2.$eval('#panelToggle', (el) => el.checked)) === false);

  await browser.close();
  await server.close();
}

async function partE() {
  console.log('\n— Part E: kheng.info live lookup —');
  const server = await kit.startServer();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await kit.primePage(page, server.url);
  await page.goto(server.url + '/' + PAGES + '/news.html');
  await kit.enable(page, server.url);

  // Turn the opt-in lookup on (and Anki, to check fetched senses feed a card),
  // then re-read settings (mirrors Part A's anki flow).
  await page.evaluate(() =>
    new Promise((r) => chrome.storage.sync.set({ khengEnabled: true, ankiEnabled: true }, r)));
  await page.evaluate(() => {
    window.KhmerLensTest.setEnabled(false);
    window.KhmerLensTest.setEnabled(true);
  });

  // "មករ" is a gloss-less dictionary word, but its prefix "មក" is a glossed
  // word that wins first place at the hover point; the gloss-less full word is
  // an alternate segmentation reachable by Shift-cycling (real user behavior).
  // The panel no longer opens automatically, so open it explicitly.
  await page.evaluate(() => {
    globalThis.KhmerLensPanel.open();
    const ed = globalThis.KhmerLensPanel.getEditableEl();
    ed.appendChild(document.createTextNode('មករ'));
  });

  const pt = await page.evaluate(() => {
    const ed = globalThis.KhmerLensPanel.getEditableEl();
    const walker = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT);
    let node; while ((node = walker.nextNode())) { if (node.data.trim()) break; }
    const r = new Range(); r.setStart(node, 0); r.setEnd(node, 1);
    const rect = r.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });
  await page.mouse.move(pt.x, pt.y);
  await page.waitForTimeout(300);

  const hasKhengBtn = () => page.evaluate(() => {
    const host = document.getElementById('khmerlens-host');
    const card = host && host.shadowRoot && host.shadowRoot.querySelector('.kl-card');
    return !!(card && card.querySelector('.kl-kheng'));
  });

  // Cycle alternates until the gloss-less match (which offers the button) shows.
  let st = await popupState(page);
  check('popup shows on hover', st.visible, st.word);
  let btnShown = await hasKhengBtn();
  for (let i = 0; i < 5 && !btnShown; i++) {
    await page.keyboard.press('Shift');
    await page.waitForTimeout(150);
    btnShown = await hasKhengBtn();
  }
  check('K kheng.info button appears for a gloss-less match', btnShown);
  const word = (await popupState(page)).word;

  // The pill lives in the popup body; confirm its center actually hit-tests to
  // our shadow host (i.e. a real click lands on it, not on page text beneath).
  const clickable = await page.evaluate(() => {
    const host = document.getElementById('khmerlens-host');
    const card = host.shadowRoot.querySelector('.kl-card');
    const btn = card.querySelector('.kl-kheng');
    const r = btn.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return hit === host; // shadow content reports the host as the hit target
  });
  check('lookup button is the topmost element at its center (pointer-events)', clickable);

  // Feed the service-worker stub the saved hit fixture, then click the button
  // (exercises the real click path — regressed once when the pill inherited the
  // card's pointer-events:none).
  const hitHtml = fs.readFileSync(
    path.join(__dirname, 'fixtures', 'pages', 'kheng-hit.html'), 'utf8');
  await page.evaluate((html) => { window.__khengHtml = html; }, hitHtml);

  await page.click('.kl-kheng');
  await page.waitForTimeout(300);
  st = await popupState(page);
  check('fetched kheng.info definition renders in the popup',
    !!st.gloss && /happy/.test(st.gloss), st.gloss && st.gloss.slice(0, 50));
  check('the queried word was sent to the lookup bridge',
    (await page.evaluate(() => window.__khengQueries || [])).includes(word));
  const source = await page.evaluate(() => {
    const host = document.getElementById('khmerlens-host');
    const card = host && host.shadowRoot && host.shadowRoot.querySelector('.kl-card');
    const s = card && card.querySelector('.kl-source');
    return s ? s.textContent : null;
  });
  check('fetched definition is labeled via kheng.info', source === 'via kheng.info', source);
  check('lookup CTA is gone once a definition is shown',
    !(await page.evaluate(() => {
      const host = document.getElementById('khmerlens-host');
      const card = host && host.shadowRoot && host.shadowRoot.querySelector('.kl-card');
      return !!(card && card.querySelector('.kl-kheng'));
    })));

  // The popup is still on the gloss-less match with fetched senses; adding it
  // to Anki should carry those senses, not a blank definition.
  await page.click('.kl-anki');
  await page.waitForTimeout(200);
  const adds = await page.evaluate(() => window.__ankiAdds || []);
  const last = adds[adds.length - 1];
  check('Anki card uses the fetched kheng.info senses',
    !!last && last.senses.length > 0 && /happy/.test(last.senses[0][2]),
    last && JSON.stringify(last).slice(0, 80));

  // Turning the feature off removes the affordance (re-hover; first match again).
  await page.evaluate(() =>
    new Promise((r) => chrome.storage.sync.set({ khengEnabled: false }, r)));
  await page.evaluate(() => {
    window.KhmerLensTest.setEnabled(false);
    window.KhmerLensTest.setEnabled(true);
  });
  await page.mouse.move(pt.x, pt.y);
  await page.waitForTimeout(300);
  let offBtn = await hasKhengBtn();
  for (let i = 0; i < 5 && !offBtn; i++) {
    await page.keyboard.press('Shift');
    await page.waitForTimeout(150);
    offBtn = await hasKhengBtn();
  }
  check('no K button when the feature is disabled', !offBtn);

  await browser.close();
  await server.close();
}

(async () => {
  console.log('— Part A: content-script integration —');
  await partA();
  console.log('\n— Part B: extension smoke (permission model) —');
  await partB();
  await partC();
  await partD();
  await partE();
  console.log(failures ? `\n${failures} FAILURES` : '\nAll browser checks passed.');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
