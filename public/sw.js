/**
 * Service Worker for SimSoviet 1917
 *
 * Strategy:
 * - Cache-first for static assets (models, textures, audio, HDRI)
 * - Network-first for app bundle (JS, CSS, HTML)
 * - Versioned cache name for clean upgrades
 */

const CACHE_NAME = 'simsoviet-v1';

/**
 * Asset path patterns that should use cache-first strategy.
 * These are large, immutable binary files that rarely change.
 */
const CACHE_FIRST_PATTERNS = [
  /^\/assets\//,
  /^\/models\//,
  /^\/hdri\//,
  /^\/textures\//,
  /^\/sim-soviet\/assets\//,
  /^\/sim-soviet\/models\//,
  /^\/sim-soviet\/hdri\//,
  /^\/sim-soviet\/textures\//,
  /\.glb$/,
  /\.hdr$/,
  /\.ogg$/,
  /\.mp3$/,
  /\.ktx2$/,
  /\.basis$/,
  /\.webp$/,
  /\.png$/,
  /\.jpg$/,
];

/**
 * Check if a URL pathname matches cache-first asset patterns.
 */
function isCacheFirstAsset(url) {
  const pathname = new URL(url).pathname;
  return CACHE_FIRST_PATTERNS.some((pattern) => pattern.test(pathname));
}

// ── Install ──
// Pre-cache nothing on install (assets are cached on first fetch).
// skipWaiting() activates the new SW immediately.
self.addEventListener('install', (event) => {
  console.log('[SW] Installing', CACHE_NAME);
  event.waitUntil(self.skipWaiting());
});

// ── Activate ──
// Clean up old caches and claim all clients immediately.
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating', CACHE_NAME);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          }),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ── Fetch ──
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Skip non-http(s) requests (e.g., chrome-extension://)
  if (!request.url.startsWith('http')) return;

  if (isCacheFirstAsset(request.url)) {
    // Cache-first: serve from cache, fall back to network + cache
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;

          return fetch(request).then((response) => {
            // Only cache successful responses
            if (response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          });
        }),
      ),
    );
  } else {
    // Network-first: try network, fall back to cache for app shell
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful app shell responses
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone);
            });
          }
          return response;
        })
        .catch(() =>
          caches.open(CACHE_NAME).then((cache) => cache.match(request)),
        ),
    );
  }
});
