const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Metro doesn't resolve package.json `exports` fields reliably.
// Map three/webgpu and three/tsl to their actual source files so the
// WebGPU-aware Three.js namespace is bundled correctly.
config.resolver = {
  ...config.resolver,
  resolveRequest: (context, moduleName, platform) => {
    if (moduleName === 'three/webgpu') {
      return { type: 'sourceFile', filePath: require.resolve('three/src/Three.WebGPU.js') };
    }
    if (moduleName === 'three/tsl') {
      return { type: 'sourceFile', filePath: require.resolve('three/src/Three.TSL.js') };
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

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
