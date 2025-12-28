const CACHE_NAME = 'rentagol-v1';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './worker.js',
    './icon.png',
    './manifest.json'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});
