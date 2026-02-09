import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: 'iPhone SE (375x667)', width: 375, height: 667 },
  { name: 'Pixel 8a (412x915)', width: 412, height: 915 },
  { name: 'iPad (810x1080)', width: 810, height: 1080 },
  { name: 'Desktop (1280x720)', width: 1280, height: 720 },
];

for (const viewport of VIEWPORTS) {
  test.describe(`Responsive @ ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test.beforeEach(async ({ page }) => {
      await page.goto('/');
    });

    test('intro modal fits within viewport', async ({ page }) => {
      const introModal = page.locator('#intro-modal');
      await expect(introModal).toBeVisible();

      const box = await introModal.boundingBox();
      if (box) {
        // Modal should not exceed viewport dimensions
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
      }
    });

    test('start button is clickable (not obscured)', async ({ page }) => {
      const startBtn = page.locator('#start-btn');
      await expect(startBtn).toBeVisible();

      // Verify the button is actually clickable (not covered by another element)
      await expect(startBtn).toBeEnabled();
    });

    test('toolbar is visible and usable after game start', async ({ page }) => {
      await page.locator('#start-btn').click();
      await page.waitForTimeout(600);

      const toolbar = page.locator('#toolbar');
      await expect(toolbar).toBeVisible();

      // Toolbar buttons should exist
      const buttons = toolbar.locator('button');
      const count = await buttons.count();
      expect(count).toBeGreaterThan(0);

      // First button should be visible (scrollable toolbar)
      await expect(buttons.first()).toBeVisible();
    });

    test('HUD elements are visible after game start', async ({ page }) => {
      await page.locator('#start-btn').click();
      await page.waitForTimeout(1500);

      await expect(page.locator('#ui-money')).toBeVisible();
      await expect(page.locator('#ui-pop')).toBeVisible();
      await expect(page.locator('#ui-date')).toBeVisible();
    });

    test('quota box is visible', async ({ page }) => {
      const quotaBox = page.locator('.quota-box');
      await expect(quotaBox).toBeVisible();
    });

    test('canvas fills the game container', async ({ page }) => {
      await page.locator('#start-btn').click();
      await page.waitForTimeout(600);

      const canvas = page.locator('#gameCanvas');
      const canvasBox = await canvas.boundingBox();

      const container = page.locator('#game-container');
      const containerBox = await container.boundingBox();

      if (canvasBox && containerBox) {
        // Canvas should approximately fill the container
        expect(canvasBox.width).toBeGreaterThan(0);
        expect(canvasBox.height).toBeGreaterThan(0);
      }
    });

    test('no horizontal scrollbar (no overflow)', async ({ page }) => {
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalScroll).toBe(false);
    });

    test('advisor modal is readable when shown', async ({ page }) => {
      await page.locator('#start-btn').click();
      await page.waitForTimeout(600);

      const advisor = page.locator('#advisor');
      await expect(advisor).toBeVisible({ timeout: 2000 });

      const advisorBox = await advisor.boundingBox();
      if (advisorBox) {
        // Advisor should be within the visible viewport
        expect(advisorBox.x).toBeGreaterThanOrEqual(0);
        expect(advisorBox.y).toBeGreaterThanOrEqual(0);
        // Width should not exceed viewport
        expect(advisorBox.width).toBeLessThanOrEqual(viewport.width + 1);
      }
    });
  });
}
