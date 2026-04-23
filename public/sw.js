/**
 * Service Worker for SimSoviet 1917
 *
 * Strategy:
 * - Cache-first for static assets (models, textures, audio, HDRI)
 * - Network-first for app bundle (JS, CSS, HTML)
 * - Versioned cache name for clean upgrades
 * - Content-Type validation before caching
 *
 * Cross-Origin Isolation (COOP/COEP):
 * expo-sqlite's web backend (wa-sqlite) uses SharedArrayBuffer for its
 * synchronous worker-channel protocol. Browsers only expose SharedArrayBuffer
 * when the document is cross-origin isolated, which requires:
 *   Cross-Origin-Opener-Policy: same-origin
 *   Cross-Origin-Embedder-Policy: credentialless
 * We use `credentialless` (not `require-corp`) so that cross-origin CDN assets
 * are still loaded (without credentials) rather than being blocked entirely.
 * GitHub Pages cannot serve custom HTTP headers, so we inject them here in the
 * service-worker fetch handler by rewriting every response through
 * addCrossOriginHeaders(). The service worker is registered before any SQLite
 * init, so the page reloads itself once the SW is active (see App.web.tsx).
 */

// Version is tied to app releases — bump on deploy to bust stale caches.
const CACHE_VERSION = '1.1.2';
const CACHE_NAME = `simsoviet-v${CACHE_VERSION}`;

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
 * Content-Types that are allowed to be cached.
 * Prevents caching unexpected content (e.g., error pages, redirects).
 */
const CACHEABLE_CONTENT_TYPES = new Set([
  'application/javascript',
  'application/json',
  'application/octet-stream',
  'application/wasm',
  'audio/ogg',
  'audio/mpeg',
  'font/woff2',
  'image/jpeg',
  'image/png',
  'image/webp',
  'model/gltf-binary',
  'text/css',
  'text/html',
  'text/javascript',
]);

/**
 * Check if a URL pathname matches cache-first asset patterns.
 */
function isCacheFirstAsset(url) {
  const pathname = new URL(url).pathname;
  return CACHE_FIRST_PATTERNS.some((pattern) => pattern.test(pathname));
}

/**
 * Check if a response has a cacheable Content-Type.
 * Falls back to true for missing Content-Type headers (binary assets).
 */
function hasCacheableContentType(response) {
  const contentType = response.headers.get('Content-Type');
  if (!contentType) return true; // Allow caching when no Content-Type (binary assets)
  const mimeType = contentType.split(';')[0].trim().toLowerCase();
  return CACHEABLE_CONTENT_TYPES.has(mimeType);
}

/**
 * Rewrite a Response to add Cross-Origin-Opener-Policy and
 * Cross-Origin-Embedder-Policy headers. These make the page
 * cross-origin isolated so SharedArrayBuffer is available.
 *
 * We must copy the response because Headers are immutable on fetch responses.
 * The body is streamed — we don't buffer it — so this is low overhead.
 *
 * @param response - The fetch Response object to rewrite with COOP/COEP headers
 * @returns A new Response with COOP/COEP headers applied, or the original response unchanged for opaque (no-cors) responses
 */
function addCrossOriginHeaders(response) {
  // Skip opaque responses (cross-origin no-cors) — we cannot rewrite them,
  // and rewriting would break them (opaque type, status 0).
  if (response.type === 'opaque') return response;

  const newHeaders = new Headers(response.headers);
  newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
  // credentialless is safer than require-corp: cross-origin resources that
  // don't set Cross-Origin-Resource-Policy are still loaded (without cookies
  // / auth headers) rather than being blocked. This prevents 3D asset CDN
  // fetches from breaking while still enabling SharedArrayBuffer.
  newHeaders.set('Cross-Origin-Embedder-Policy', 'credentialless');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
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
    // Cache-first: serve from cache, fall back to network + cache.
    // Always rewrite the response with COOP/COEP headers.
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return addCrossOriginHeaders(cached);

          return fetch(request).then((response) => {
            // Only cache successful responses with expected Content-Types
            if (response.ok && hasCacheableContentType(response)) {
              cache.put(request, response.clone());
            }
            return addCrossOriginHeaders(response);
          });
        }),
      ),
    );
  } else {
    // Network-first: try network, fall back to cache for app shell.
    // Always rewrite the response with COOP/COEP headers.
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful app shell responses with expected Content-Types
          if (response.ok && hasCacheableContentType(response)) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone);
            });
          }
          return addCrossOriginHeaders(response);
        })
        .catch(() =>
          caches.open(CACHE_NAME).then((cache) =>
            cache.match(request).then((cached) => {
              if (cached) return addCrossOriginHeaders(cached);
              // Cache miss on network failure — return a real offline response
              // so respondWith() never resolves to undefined (which throws).
              return addCrossOriginHeaders(
                new Response('Offline: requested resource is not available in cache.', {
                  status: 503,
                  statusText: 'Service Unavailable',
                  headers: { 'Content-Type': 'text/plain; charset=utf-8' },
                }),
              );
            }),
          ),
        ),
    );
  }
});
