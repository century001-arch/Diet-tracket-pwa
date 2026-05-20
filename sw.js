const CACHE_NAME = 'nutrisnap-cache-v1';
const ASSETS = ['./', './index.html', './style.css', './app.js', './db.js', './manifest.json', './assets/icon-192.png', './assets/icon-512.png'];

self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS))); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.map((k) => k !== CACHE_NAME ? caches.delete(k) : null)))); });
self.addEventListener('fetch', (e) => {
    if (e.request.url.includes('api.openai.com')) return;
    e.respondWith(caches.match(e.request).then((res) => res || fetch(e.request)));
});
