import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  root: './app',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@app': resolve(__dirname, './app'),
      // Reactylon v3.5 imports XR modules from BabylonJS v8 that don't exist in v7.
      // Stub them until we upgrade or need XR.
      '@babylonjs/core/XR/motionController/webXROculusHandController.js': resolve(
        __dirname,
        'src/stubs/empty.ts',
      ),
    },
  },
});
