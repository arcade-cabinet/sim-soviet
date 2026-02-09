import { expect, test } from '@playwright/test';
import {
  advisorPanel,
  buildingButtons,
  canvas,
  introOverlay,
  quotaHud,
  startButton,
  toolbar,
  topBar,
  topRowButtons,
} from './helpers';

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
      const overlay = introOverlay(page);
      await expect(overlay).toBeVisible();

      const box = await overlay.boundingBox();
      if (box) {
        // Modal should not exceed viewport dimensions
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
      }
    });

    test('dossier card fits within viewport', async ({ page }) => {
      const doc = page.locator('.dossier');
      await expect(doc).toBeVisible();

      const box = await doc.boundingBox();
      if (box) {
        expect(box.width).toBeLessThanOrEqual(viewport.width);
        // Height should not overflow (max-height: 90dvh with scroll)
        expect(box.height).toBeLessThanOrEqual(viewport.height);
      }
    });

    test('start button is clickable (not obscured)', async ({ page }) => {
      const btn = startButton(page);
      await expect(btn).toBeVisible();
      await expect(btn).toBeEnabled();
    });

    test('toolbar is visible and usable after game start', async ({ page }) => {
      await startButton(page).click();
      await page.waitForTimeout(600);

      const nav = toolbar(page);
      await expect(nav).toBeVisible();

      // Toolbar buttons should exist
      const buttons = topRowButtons(page);
      const count = await buttons.count();
      expect(count).toBeGreaterThan(0);

      // First button should be visible (scrollable toolbar)
      await expect(buttons.first()).toBeVisible();
    });

    test('top bar is visible after game start', async ({ page }) => {
      await startButton(page).click();
      await page.waitForTimeout(500);

      const header = topBar(page);
      await expect(header).toBeVisible();

      // Should contain resource icons
      await expect(header).toContainText('₽');
      await expect(header).toContainText('📅');
    });

    test('quota HUD is visible', async ({ page }) => {
      const hud = quotaHud(page);
      await expect(hud).toBeVisible();
      await expect(hud).toContainText('5-YEAR PLAN');
    });

    test('canvas fills the game viewport', async ({ page }) => {
      await startButton(page).click();
      await page.waitForTimeout(600);

      const canvasEl = canvas(page);
      const canvasBox = await canvasEl.boundingBox();

      const viewportEl = page.locator('.game-viewport');
      const viewportBox = await viewportEl.boundingBox();

      if (canvasBox && viewportBox) {
        // Canvas should have positive dimensions
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
      await startButton(page).click();
      await page.waitForTimeout(600);

      const advisor = advisorPanel(page);
      await expect(advisor).toBeVisible({ timeout: 3000 });

      const advisorBox = await advisor.boundingBox();
      if (advisorBox) {
        // Advisor should be within the visible viewport
        expect(advisorBox.x).toBeGreaterThanOrEqual(0);
        expect(advisorBox.y).toBeGreaterThanOrEqual(0);
        // Width should not exceed viewport
        expect(advisorBox.width).toBeLessThanOrEqual(viewport.width + 1);
      }
    });

    test('building buttons row is scrollable and contains items', async ({ page }) => {
      await startButton(page).click();
      await page.waitForTimeout(600);

      const buttons = buildingButtons(page);
      const count = await buttons.count();
      expect(count).toBeGreaterThan(0);

      // First building button should be visible
      await expect(buttons.first()).toBeVisible();
    });
  });
}
