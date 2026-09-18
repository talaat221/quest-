const CACHE_NAME = 'quest-shell-v15-preview';
const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/odyssey-sea.jpg',
  '/pixel-garden-hero.webp',
  '/xp-frame-mobile.png',
  '/garden-scene/v1/00-static-background.webp',
  '/garden-scene/v1/01-moon.webp',
  '/garden-scene/v1/02-cloud-upper-left.webp',
  '/garden-scene/v1/03-cloud-lower-left.webp',
  '/garden-scene/v1/04-cloud-center.webp',
  '/garden-scene/v1/05-cloud-right.webp',
  '/garden-scene/v1/06-tree-trunk.webp',
  '/garden-scene/v1/07-house.webp',
  '/garden-scene/v1/08-tree-canopy.webp',
  '/garden-scene/v1/09-chimney-smoke.webp',
  '/garden-scene/v1/10-lantern.webp',
  '/garden-scene/v1/10a-foundation-bush-left.webp',
  '/garden-scene/v1/10b-foundation-bush-right.webp',
  '/garden-scene/v1/11-cat.webp',
  '/garden-scene/v1/12-crop-1-mature.webp',
  '/garden-scene/v1/12-crop-2-mature.webp',
  '/garden-scene/v1/12-crop-3-mature.webp',
  '/garden-scene/v1/13-wind-leaves.webp'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Supabase and other external requests remain network-controlled. Quest data
  // itself is handled by the local-first sync layer in the app.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/', copy));
          return response;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});
