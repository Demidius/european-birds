// Only Bird Atlas files and caches belong to this worker. Other apps share this origin.
const CACHE_PREFIX = 'bird-atlas-shell-';
const CACHE = CACHE_PREFIX + 'v2';
const BASE = new URL(self.registration.scope);
const SHELL = [
  './', 'index.html', 'study.html', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png',
  'pwa.js', 'scheduler.js', 'data-birds.js', 'data-passerines.js', 'data-regions.js',
  'data-photos.js', 'data-poland-additions.js', 'data-extra-photos.js', 'study-data.js', 'data-biology.js',
  'biology.js', 'etymology.js', 'practice.js', 'firebase-config.js', 'app.js', 'study-tree.js', 'tree-map.js',
  'style.css', 'study-tree.css', 'study-tree-drill.css', 'cards.css', 'tree-map.css',
  'biology.css', 'rpg.css', 'study-tree-fork.css', 'etymology.css', 'practice.css',
  'assets/fonts/fonts.css',
  ...['handjet', 'manrope'].flatMap(font => [400, 500, 600, 700].map(weight => `assets/fonts/${font}-${weight}.ttf`)),
  'assets/fonts/manrope-800.ttf'
].map(path => new URL(path, BASE).href);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(CACHE_PREFIX) && name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== BASE.origin || !url.pathname.startsWith(BASE.pathname)) return;
  // Photos/audio use normal browser caching; do not download the whole collection for installation.
  if (!SHELL.includes(url.origin + url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request);
      if (response.ok && response.type !== 'opaqueredirect') {
        // One copy per path even when the page requests a new ?v= version.
        await cache.put(url.origin + url.pathname, response.clone()).catch(() => {});
      }
      return response;
    } catch {
      return (await cache.match(url.origin + url.pathname)) || Response.error();
    }
  })());
});
