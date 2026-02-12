import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? 'list' : 'html',
  timeout: 15_000,

  expect: {
    timeout: 5_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.05,
    },
  },

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 5_000,
    navigationTimeout: 10_000,
  },

  projects: [
    {
      name: 'Desktop Chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'iPhone SE',
      use: {
        ...devices['iPhone SE'],
      },
    },
    {
      name: 'Pixel 8a',
      use: {
        // Pixel 8a: 412x915 viewport, 2.625 device scale
        viewport: { width: 412, height: 915 },
        userAgent:
          'Mozilla/5.0 (Linux; Android 14; Pixel 8a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
        deviceScaleFactor: 2.625,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'iPad',
      use: {
        ...devices['iPad (gen 7)'],
      },
    },
  ],

  webServer: {
    command: process.env.CI
      ? 'pnpm exec vite preview --port 3000'
      : 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
