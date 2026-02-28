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

// Serve the `assets/` directory as static files during web development.
// GLB models, audio files, and other binary assets are fetched at runtime
// from paths like /assets/models/soviet/*.glb and can't be bundled by Metro.
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    const serveStatic = require('serve-static');
    const assetsDir = path.resolve(__dirname, 'assets');
    const publicDir = path.resolve(__dirname, 'public');
    const staticHandler = serveStatic(assetsDir, {
      setHeaders: (res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
      },
    });
    const publicHandler = serveStatic(publicDir, {
      setHeaders: (res) => {
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
