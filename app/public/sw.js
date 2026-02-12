// SimSoviet 2000 — Vanilla Service Worker
// Cache-first for static assets, network-first for HTML

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `simSoviet-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `simSoviet-dynamic-${CACHE_VERSION}`;

// Extensions that use cache-first strategy
const CACHE_FIRST_EXT = /\.(?:png|jpg|jpeg|svg|webp|ogg|mp3|wav|woff2?|ttf|eot)$/i;

self.addEventListener('install', (_event) => {
  // Skip waiting so the new SW activates immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests except Google Fonts
  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isGoogleFonts =
    url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com';

  if (!isSameOrigin && !isGoogleFonts) return;

  // Cache-first for static assets (sprites, audio, fonts)
  if (CACHE_FIRST_EXT.test(url.pathname) || isGoogleFonts) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              event.waitUntil(
                caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone))
              );
            }
            return response;
          })
      )
    );
    return;
  }

  // Network-first for HTML and other documents
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          event.waitUntil(
            caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, clone))
          );
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
