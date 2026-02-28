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

// DEV-ONLY: Serve the `assets/` and `public/` directories as static files
// during local Metro development. The Access-Control-Allow-Origin: * header
// is required because Metro dev-server and the web app may run on different
// ports. This middleware is NEVER used in production builds — production
// assets are served by the hosting platform's own static file configuration
// with appropriate CORS policies.
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    const serveStatic = require('serve-static');
    const assetsDir = path.resolve(__dirname, 'assets');
    const publicDir = path.resolve(__dirname, 'public');
    const staticHandler = serveStatic(assetsDir, {
      setHeaders: (res) => {
        // DEV-ONLY: permissive CORS for local Metro dev-server
        res.setHeader('Access-Control-Allow-Origin', '*');
      },
    });
    const publicHandler = serveStatic(publicDir, {
      setHeaders: (res) => {
        // DEV-ONLY: permissive CORS for local Metro dev-server
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/wasm');
      },
    });

    return (req, res, next) => {
      // Route /assets/* requests to the static file server
      if (req.url.startsWith('/assets/')) {
        req.url = req.url.slice('/assets'.length);
        return staticHandler(req, res, () => middleware(req, res, next));
      }
      // Route /wasm/* requests to public/wasm/ (sql.js WASM binary)
      if (req.url.startsWith('/wasm/')) {
        return publicHandler(req, res, () => middleware(req, res, next));
      }
      return middleware(req, res, next);
    };
  },
};

module.exports = config;
