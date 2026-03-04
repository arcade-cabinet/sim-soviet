import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // Game tests share state, run sequentially
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: 1,
  reporter: isCI ? 'list' : 'html',
  // Playthrough tests need up to 5 minutes; other tests 60s local / 180s CI
  timeout: isCI ? 180_000 : 300_000,

  expect: {
    timeout: isCI ? 30_000 : 10_000,
  },

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: isCI ? 45_000 : 60_000,
    navigationTimeout: isCI ? 60_000 : 60_000,
    // Always headed — WebGL needs real GPU rendering pipeline.
    // CI: run via xvfb-run for virtual display (see CI workflow).
    // Local: opens real Chrome window.
    headless: false,
    channel: 'chrome',
  },

  projects: [
    {
      name: 'Desktop Chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
  ],

  webServer: {
    // CI: serve pre-built dist/ (already built by CI workflow) — much faster than Expo dev server
    // Local: start Expo dev server with hot reload
    command: isCI
      ? 'npx --yes serve dist -l 3000 -s'
      : 'npx expo start --web --port 3000',
    url: 'http://localhost:3000',
    reuseExistingServer: !isCI,
    timeout: isCI ? 30_000 : 120_000,
  },
});
