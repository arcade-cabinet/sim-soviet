const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Enable async import() chunks for code splitting on web.
// Three.js + scene components are loaded only when entering the game screen,
// keeping the initial menu bundle small.
config.transformer = {
  ...config.transformer,
  unstable_allowRequireContext: true,
};

// Allow Metro to resolve .wasm files as assets (required by expo-sqlite's web worker).
config.resolver = {
  ...config.resolver,
  assetExts: [...(config.resolver?.assetExts ?? []), 'wasm'],
};

// DEV-ONLY: Serve the `assets/` and `public/` directories as static files
// during local Metro development. The Access-Control-Allow-Origin: * header
// is required because Metro dev-server and the web app may run on different
// ports. This middleware is NEVER used in production builds — production
// assets are served by the hosting platform's own static file configuration
// with appropriate CORS policies.
//
// COOP/COEP headers: expo-sqlite's web backend (wa-sqlite) requires
// SharedArrayBuffer, which is only available in cross-origin isolated contexts.
// We set these headers on every Metro dev-server response so `openDatabaseSync`
// works locally. On GitHub Pages, the service worker (public/sw.js) injects
// the same headers into every fetch response.
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    const serveStatic = require('serve-static');
    const assetsDir = path.resolve(__dirname, 'assets');
    const publicDir = path.resolve(__dirname, 'public');

    /**
     * Inject Cross-Origin Isolation headers required by SharedArrayBuffer / wa-sqlite.
     * credentialless is more permissive than require-corp: cross-origin assets
     * without CORP headers are still served (minus cookies), so CDN assets work.
     *
     * @param res - Node HTTP ServerResponse to mutate with COOP/COEP headers
     */
    function setCOIHeaders(res) {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    }

    const staticHandler = serveStatic(assetsDir, {
      setHeaders: (res) => {
        // DEV-ONLY: permissive CORS for local Metro dev-server
        res.setHeader('Access-Control-Allow-Origin', '*');
        setCOIHeaders(res);
      },
    });
    const publicHandler = serveStatic(publicDir, {
      setHeaders: (res) => {
        // DEV-ONLY: permissive CORS for local Metro dev-server
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/wasm');
        setCOIHeaders(res);
      },
    });

    return (req, res, next) => {
      // Inject COOP/COEP on every Metro response so SharedArrayBuffer is
      // available on the dev server without needing a service worker.
      //
      // We monkey-patch res.writeHead because Metro calls writeHead internally
      // and would otherwise overwrite any headers set via res.setHeader before
      // calling the inner middleware. The patch ensures our headers survive.
      const originalWriteHead = res.writeHead.bind(res);
      /**
       * Monkey-patch writeHead so COOP/COEP headers survive Metro's internal
       * writeHead call, which would otherwise overwrite res.setHeader values.
       *
       * @param statusCode - HTTP status code forwarded to the original writeHead
       * @param statusMessage - Optional status message or headers object
       * @param headers - Optional headers object when statusMessage is a string
       */
      res.writeHead = function patchedWriteHead(statusCode, statusMessage, headers) {
        // Inject COI headers regardless of what Metro is writing.
        setCOIHeaders(res);
        if (typeof statusMessage === 'object') {
          return originalWriteHead(statusCode, statusMessage);
        }
        return originalWriteHead(statusCode, statusMessage, headers);
      };

      // Route /assets/* requests to the static file server
      if (req.url.startsWith('/assets/')) {
        req.url = req.url.slice('/assets'.length);
        return staticHandler(req, res, () => middleware(req, res, next));
      }
      // Route /wasm/* requests to public/wasm/ (Draco mesh decoder)
      if (req.url.startsWith('/wasm/')) {
        return publicHandler(req, res, () => middleware(req, res, next));
      }
      return middleware(req, res, next);
    };
  },
};

module.exports = config;
