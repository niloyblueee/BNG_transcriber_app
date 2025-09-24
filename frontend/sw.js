const CACHE_NAME = 'branscriber-cache-v2';
const PRECACHE_URLS = [
  '/',             // index.html in the built dist
  '/index.html',   // navigation fallback
  '/manifest.json',
  '/BranscriberLogo.svg'
];

// Install: cache only stable build files (don't assume source paths)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// Activate: remove old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch:
// - Navigation requests: network-first (so users get updates), fallback to cached index.html when offline.
// - Other GET requests: cache-first with runtime caching (works for hashed files in dist).
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // SPA navigation requests
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Optionally update cached index.html with the fresh network response
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', responseClone));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // For other requests, try cache first, then network and cache the result (runtime caching).
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          // If invalid response, just pass it through
          if (!networkResponse || networkResponse.status === 0) {
            return networkResponse;
          }

          // Cache same-origin or opaque responses (e.g., hashed assets or CDN resources)
          const shouldCache =
            networkResponse.status === 200 || networkResponse.type === 'opaque';

          if (shouldCache) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              // Put request as-is (hashed filenames from dist will be cached)
              cache.put(event.request, responseClone).catch(() => {
                // ignore quota errors or other put failures
              });
            });
          }

          return networkResponse;
        })
        .catch(() => {
          // If fetch fails and we have nothing cached, for images/icons you might return a placeholder.
          return cachedResponse;
        });
    })
  );
});
