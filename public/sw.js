const CACHE_NAME = 'quest-shell-v30-rewards-page';
const APP_SHELL = [
  '/',
  '/manifest.webmanifest?v=quest-cottage-v1',
  '/apple-touch-icon.png?v=quest-cottage-v1',
  '/icon-192.png?v=quest-cottage-v1',
  '/icon-512.png?v=quest-cottage-v1',
  '/icon-maskable-512.png?v=quest-cottage-v1',
  '/favicon.ico?v=quest-cottage-v1',
  '/favicon-32x32.png?v=quest-cottage-v1',
  '/odyssey-sea.jpg',
  '/pixel-garden-hero.webp',
  '/xp-frame-mobile.png',
  '/daily-anchors/panel-v1.webp',
  '/today-quests/panel-v1.webp',
  '/today-quests/row-v1.svg',
  '/home-finish/farm-streak-v1.webp',
  '/home-finish/stop-day-v1.webp',
  '/home-finish/navigation-v1.webp',
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

// Web Push wakes this worker even with no Quest window open. Never rely on a
// setTimeout in a page or worker for background scheduling.
self.addEventListener('push', event => {
  let payload;
  try { payload = event.data?.json(); } catch { payload = null; }
  const title = String(payload?.title || 'A little reminder from Quest').slice(0, 140);
  const options = {
    body: String(payload?.body || 'Open Quest to see your next step.').slice(0, 300),
    icon: '/icon-192.png?v=quest-cottage-v1',
    badge: '/favicon-32x32.png?v=quest-cottage-v1',
    tag: String(payload?.tag || 'quest-reminder').slice(0, 80),
    data: payload?.data || { url: self.location.origin + '/#home' },
  };
  event.waitUntil((async () => {
    await self.registration.showNotification(title, options);
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) client.postMessage({ type: 'QUEST_REMINDER', payload: { ...payload, title, body: options.body, data: options.data } });
  })());
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    let target = new URL('/#home', self.location.origin);
    try { const candidate = new URL(event.notification.data?.url, self.location.origin); if (candidate.origin === self.location.origin) target = candidate; } catch { /* Use Home. */ }
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin !== target.origin) continue;
      const navigated = await client.navigate(target.href);
      if (navigated) return navigated.focus();
    }
    return self.clients.openWindow(target.href);
  })());
});
