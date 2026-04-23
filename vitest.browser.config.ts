import { playwright } from '@vitest/browser-playwright';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: '@',
        replacement: resolve(__dirname, './src'),
      },
      {
        find: /^react-native$/,
        replacement: 'react-native-web',
      },
      {
        find: /^expo-sqlite$/,
        replacement: resolve(__dirname, './e2e/vitest/shims/expo-sqlite.ts'),
      },
    ],
  },
  test: {
    include: ['e2e/vitest/**/*.browser.test.ts'],
    globalSetup: ['./e2e/vitest/globalSetup.ts'],
    reporters: ['default'],
    testTimeout: 180_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    browser: {
      enabled: true,
      headless: false,
      viewport: {
        width: 1280,
        height: 720,
      },
      api: {
        host: '127.0.0.1',
        port: 63315,
        strictPort: false,
        allowWrite: true,
      },
      provider: playwright({
        launchOptions: {
          channel: 'chrome',
          slowMo: Number(process.env.VITEST_BROWSER_SLOWMO ?? 0),
        },
        actionTimeout: 5_000,
      }),
      instances: [
        {
          browser: 'chromium',
        },
      ],
      screenshotDirectory: 'e2e/artifacts/vitest-browser/screenshots',
      trace: {
        mode: 'retain-on-failure',
        tracesDir: 'e2e/artifacts/vitest-browser/traces',
      },
    },
  },
});
