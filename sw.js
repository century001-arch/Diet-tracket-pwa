const CACHE_NAME = 'nutrisnap-cache-v6';
const CORE_ASSETS = ['./', './index.html', './style.css', './app.js', './db.js', './foods.js', './manifest.json'];
const OPTIONAL_ASSETS = ['./assets/icon.svg', './assets/icon-192.png', './assets/icon-512.png'];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(async (c) => {
            await c.addAll(CORE_ASSETS);
            await Promise.allSettled(OPTIONAL_ASSETS.map(a => c.add(a)));
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((ks) =>
            Promise.all(ks.map((k) => k !== CACHE_NAME ? caches.delete(k) : null))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    if (e.request.url.includes('generativelanguage.googleapis.com')) return;
    if (e.request.url.includes('openfoodfacts.org')) return;
    e.respondWith(caches.match(e.request).then((res) => res || fetch(e.request)));
});
