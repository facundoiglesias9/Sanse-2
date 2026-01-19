// Version: 1.0.3
const CACHE_NAME = 'sanse-perfumes-v1';
const urlsToCache = [
    '/',
    '/manifest.webmanifest',
    '/icon.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            }
            )
    );
});
