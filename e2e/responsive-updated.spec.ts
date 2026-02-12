import { expect, test } from '@playwright/test';
import {
  advisorPanel,
  canvas,
  dossier,
  landingPage,
  sovietHud,
  startButton,
  startGame,
  startGameAndDismissAdvisor,
} from './helpers';

/**
 * Updated responsive tests that leverage Playwright's project system.
 *
 * These tests run on ALL 4 configured projects (Desktop Chrome, iPhone SE,
 * Pixel 8a, iPad) automatically via the Playwright config. Each test handles
 * differences between mobile and desktop gracefully.
 */

test.describe('Responsive Layout', () => {
  test.describe('Landing Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
    });

    test('landing page covers full viewport', async ({ page }) => {
      const overlay = landingPage(page);
      await expect(overlay).toBeVisible();

      const box = await overlay.boundingBox();
      const viewport = page.viewportSize();
      if (box && viewport) {
        expect(box.width).toBeGreaterThanOrEqual(viewport.width - 1);
        expect(box.height).toBeGreaterThanOrEqual(viewport.height - 1);
      }
    });

    test('dossier card does not overflow viewport horizontally', async ({ page }) => {
      const doc = dossier(page);
      const box = await doc.boundingBox();
      const viewport = page.viewportSize();

      if (box && viewport) {
        expect(box.width).toBeLessThanOrEqual(viewport.width);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 2);
      }
    });

    test('start button is fully visible and tappable', async ({ page }) => {
      const btn = startButton(page);
      await expect(btn).toBeVisible();
      await expect(btn).toBeEnabled();

      const box = await btn.boundingBox();
      const viewport = page.viewportSize();
      if (box && viewport) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
      }
    });

    test('no page-level horizontal scroll', async ({ page }) => {
      const hasHScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHScroll).toBe(false);
    });

    test('no page-level vertical scroll', async ({ page }) => {
      const hasVScroll = await page.evaluate(() => {
        return document.documentElement.scrollHeight > document.documentElement.clientHeight;
      });
      expect(hasVScroll).toBe(false);
    });
  });

  test.describe('Game Layout', () => {
    test.beforeEach(async ({ page }) => {
      await startGameAndDismissAdvisor(page);
    });

    test('SovietHUD spans full width', async ({ page }) => {
      const hud = sovietHud(page);
      const box = await hud.boundingBox();
      const viewport = page.viewportSize();

      if (box && viewport) {
        expect(box.width).toBeGreaterThanOrEqual(viewport.width - 2);
        expect(box.x).toBeLessThanOrEqual(1);
      }
    });

    test('SovietHUD resource icons are visible', async ({ page }) => {
      const hud = sovietHud(page);
      await expect(hud).toContainText('👷');
      await expect(hud).toContainText('🌾');
    });

    test('canvas fills available viewport space', async ({ page }) => {
      const canvasEl = canvas(page);
      const canvasBox = await canvasEl.boundingBox();

      if (canvasBox) {
        expect(canvasBox.width).toBeGreaterThan(0);
        expect(canvasBox.height).toBeGreaterThan(0);
      }
    });

    test('canvas is below the SovietHUD', async ({ page }) => {
      const hudBox = await sovietHud(page).boundingBox();
      const canvasBox = await canvas(page).boundingBox();

      if (hudBox && canvasBox) {
        // Canvas should start at or below the HUD bottom
        expect(canvasBox.y).toBeGreaterThanOrEqual(hudBox.y + hudBox.height - 1);
      }
    });

    test('SovietHUD resources are within viewport', async ({ page }) => {
      const hud = sovietHud(page);
      const box = await hud.boundingBox();
      const viewport = page.viewportSize();
      if (box && viewport) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
      }
    });

    test('no elements overflow beyond viewport', async ({ page }) => {
      const hasOverflow = await page.evaluate(() => {
        return (
          document.documentElement.scrollWidth > document.documentElement.clientWidth ||
          document.documentElement.scrollHeight > document.documentElement.clientHeight
        );
      });
      expect(hasOverflow).toBe(false);
    });
  });

  test.describe('Advisor Responsiveness', () => {
    test('advisor fits within viewport when shown', async ({ page }) => {
      await startGame(page);

      const advisor = advisorPanel(page);
      await expect(advisor).toBeVisible({ timeout: 3000 });

      const box = await advisor.boundingBox();
      const viewport = page.viewportSize();
      if (box && viewport) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
      }
    });

    test('advisor dismiss button is tappable', async ({ page }) => {
      await startGame(page);

      const advisor = advisorPanel(page);
      await expect(advisor).toBeVisible({ timeout: 3000 });

      const dismissBtn = advisor.locator('button');
      await expect(dismissBtn).toBeVisible();
      await expect(dismissBtn).toBeEnabled();

      const box = await dismissBtn.boundingBox();
      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(40);
        expect(box.height).toBeGreaterThanOrEqual(20);
      }
    });
  });

  test.describe('Touch Interactions', () => {
    test('canvas has touch-action none for gesture handling', async ({ page }) => {
      await startGameAndDismissAdvisor(page);

      const canvasEl = canvas(page);
      const touchAction = await canvasEl.evaluate((el) => {
        return window.getComputedStyle(el).touchAction;
      });
      expect(touchAction).toBe('none');
    });
  });

  test.describe('CRT Effects', () => {
    test('CRT overlay does not block interactions', async ({ page }) => {
      await page.goto('/');

      // CRT overlay has pointer-events: none
      const crtPointerEvents = await page.locator('.crt-overlay').evaluate((el) => {
        return window.getComputedStyle(el).pointerEvents;
      });
      expect(crtPointerEvents).toBe('none');

      const scanlinesPointerEvents = await page.locator('.scanlines').evaluate((el) => {
        return window.getComputedStyle(el).pointerEvents;
      });
      expect(scanlinesPointerEvents).toBe('none');
    });

    test('CRT overlay covers full viewport', async ({ page }) => {
      await page.goto('/');

      const crt = page.locator('.crt-overlay');
      const box = await crt.boundingBox();
      const viewport = page.viewportSize();

      if (box && viewport) {
        expect(box.width).toBeGreaterThanOrEqual(viewport.width - 1);
        expect(box.height).toBeGreaterThanOrEqual(viewport.height - 1);
      }
    });
  });
});
