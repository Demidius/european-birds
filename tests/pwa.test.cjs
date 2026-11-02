const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const base = 'https://demidius.github.io/european-birds/';

function worker() {
  const handlers = {}, deleted = [], stored = new Map();
  const cache = {
    async addAll(urls) {
      for (const url of urls) {
        const local = new URL(url).pathname.slice('/european-birds/'.length) || 'index.html';
        assert.ok(fs.existsSync(path.join(root, local)), `missing offline asset: ${local}`);
        stored.set(url, new Response(local));
      }
    },
    async put(url, response) { stored.set(url, response); },
    async match(url) { return stored.get(url); }
  };
  let online = true;
  const context = vm.createContext({URL, Response,
    self: {registration: {scope: base}, addEventListener: (name, handler) => { handlers[name] = handler; },
      skipWaiting: async () => {}, clients: {claim: async () => {}}},
    caches: {open: async () => cache,
      keys: async () => ['bird-atlas-shell-v0', 'bird-atlas-shell-v1', 'skill-tree-v4', 'another-app'],
      delete: async name => { deleted.push(name); }},
    fetch: async () => { if (!online) throw new Error('offline'); return new Response('fresh'); }
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'), context);
  const lifecycle = name => new Promise((resolve, reject) => handlers[name]({waitUntil: p => p.then(resolve, reject)}));
  const request = url => { let response; handlers.fetch({request: {url, method: 'GET'}, respondWith: p => { response = p; }}); return response; };
  return {lifecycle, request, deleted, stored, goOffline() { online = false; }};
}

test('Offline shell exists and covers both pages and all linked scripts/styles/fonts', async () => {
  const w = worker(); await w.lifecycle('install');
  for (const file of ['index.html', 'study.html']) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    for (const [, asset] of html.matchAll(/(?:src|href)="([^"?#]+)(?:\?[^"#]*)?"/g)) {
      if (!/\.(js|css|webmanifest|png|svg)$/.test(asset)) continue;
      assert.ok(w.stored.has(new URL(asset, base).href), `${file}: ${asset}`);
    }
  }
});

test('Worker leaves English caches, other apps, remote requests and bird media alone', async () => {
  const w = worker(); await w.lifecycle('activate');
  assert.deepEqual(w.deleted, ['bird-atlas-shell-v0']);
  for (const url of ['https://demidius.github.io/english-skill-tree/app.js',
    'https://example.org/app.js', base+'assets/photos/bird.jpg']) assert.equal(w.request(url), undefined);
});

test('Fresh files replace old versions, with offline fallback across version queries', async () => {
  const w = worker(); await w.lifecycle('install');
  const url = base+'app.js';
  assert.equal(await (await w.request(url+'?v=2')).text(), 'fresh');
  w.goOffline();
  assert.equal(await (await w.request(url+'?v=3')).text(), 'fresh');
  assert.ok(w.stored.has(url)); assert.equal(w.stored.has(url+'?v=2'), false);
  assert.equal(await (await w.request(base+'study.html')).text(), 'study.html');
});

test('Install button prompts only on click, can retry after dismissal and hides in the app', async () => {
  const {JSDOM} = require('jsdom');
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'study.html'), 'utf8'), {url: base+'study.html', runScripts: 'outside-only'});
  const w = dom.window, media = {matches: false, addEventListener() {}};
  w.matchMedia = () => media;
  w.HTMLDialogElement.prototype.showModal = function() { this.open = true; };
  w.HTMLDialogElement.prototype.close = function() { this.open = false; };
  let calls = 0;
  try {
    w.eval(fs.readFileSync(path.join(root, 'pwa.js'), 'utf8'));
    const button = w.document.getElementById('installAppBtn'), dialog = w.document.getElementById('installAppDialog');
    assert.equal(button.hidden, false);
    button.click(); assert.equal(dialog.open, true);
    w.document.getElementById('closeInstallApp').click(); assert.equal(dialog.open, false);
    const prompt = new w.Event('beforeinstallprompt', {cancelable: true});
    prompt.prompt = async () => { calls++; }; prompt.userChoice = Promise.resolve({outcome: 'dismissed'});
    w.dispatchEvent(prompt); assert.equal(calls, 0); assert.equal(prompt.defaultPrevented, true);
    button.click(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls, 1); assert.equal(button.disabled, false); assert.equal(button.hidden, false);
    w.dispatchEvent(new w.Event('appinstalled')); assert.equal(button.hidden, true);
    media.matches = true;
    w.eval(fs.readFileSync(path.join(root, 'pwa.js'), 'utf8')); assert.equal(button.hidden, true);
  } finally { w.close(); }
});
