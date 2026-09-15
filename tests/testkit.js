/**
 * Shared test helpers for driving the KhmerLens content script in a real
 * browser without the extension's activeTab injection (which needs a toolbar
 * gesture Playwright can't simulate).
 *
 * Approach: serve the project over HTTP, define a minimal `chrome` shim in the
 * page before load, then inject the real lib + content scripts and flip the
 * guarded test hook. This exercises the actual content.js / lib code end to
 * end; only the tiny chrome.* surface it touches is mocked.
 */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MIME = {
  '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css',
  '.html': 'text/html; charset=utf-8', '.png': 'image/png',
};

function startServer() {
  const server = http.createServer(function (req, res) {
    var rel = decodeURIComponent(req.url.split('?')[0]);
    var file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, function (err, data) {
      if (err) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise(function (resolve) {
    server.listen(0, function () {
      var port = server.address().port;
      resolve({
        url: 'http://localhost:' + port,
        close: function () { return new Promise(function (r) { server.close(r); }); },
      });
    });
  });
}

// Install the chrome shim before any page script runs.
async function primePage(page, baseUrl) {
  await page.addInitScript(function (base) {
    var _sync = {};
    window.chrome = {
      runtime: {
        lastError: null,
        getURL: function (p) { return base + '/extension/' + p; },
        sendMessage: function (msg, cb) {
          if (msg && msg.type === 'khmerlens:ankiAdd') {
            window.__ankiAdds = (window.__ankiAdds || []).concat(msg.entry);
            if (cb) cb({ ok: true });
            return;
          }
          if (cb) cb({ enabled: false });
        },
        onMessage: { addListener: function () {} },
      },
      storage: {
        sync: {
          get: function (defs, cb) {
            var o = {};
            for (var k in defs) o[k] = (k in _sync) ? _sync[k] : defs[k];
            cb(o);
          },
          set: function (v, cb) { Object.assign(_sync, v); if (cb) cb(); },
        },
        onChanged: { addListener: function () {} },
      },
    };
    window.__khmerLensTest = true;
  }, baseUrl);
}

// Load the real content-script bundle and enable it.
async function enable(page, baseUrl) {
  var files = ['lib/khmer.js', 'lib/dictionary.js', 'lib/popup.js', 'lib/audio.js', 'lib/anki.js', 'content/content.js'];
  for (var f of files) {
    await page.addScriptTag({ url: baseUrl + '/extension/' + f });
  }
  await page.evaluate(function () { window.KhmerLensTest.setEnabled(true); });
  await page.waitForTimeout(650); // first dictionary load
}

module.exports = { startServer, primePage, enable, ROOT };
