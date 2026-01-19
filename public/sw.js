// VERSION: 2.0.8 - FORZAR ACTUALIZACIÓN
const CACHE_NAME = 'sanse-perfumes-v2.0.8';

// Al instalar, saltamos la espera para activar el nuevo worker inmediatamente
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

// Al activar, borramos CUALQUIER cache vieja que exista
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    console.log('Borrando cache antigua:', cacheName);
                    return caches.delete(cacheName);
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Estrategia: NETWORK FIRST para todo.
// Intentamos traerlo de internet, y si falla (offline), usamos la cache.
self.addEventListener('fetch', (event) => {
    // Solo cacheamos GETs
    if (event.request.method !== 'GET') return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Si la respuesta es buena, la guardamos en cache
                if (response && response.status === 200) {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return response;
            })
            .catch(() => {
                // Si falla internet, intentamos buscar en cache
                return caches.match(event.request);
            })
    );
});
