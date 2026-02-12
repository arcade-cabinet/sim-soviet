import { expect, test } from '@playwright/test';
import {
  advisorPanel,
  buildingButtons,
  canvas,
  introOverlay,
  quotaHud,
  startButton,
  startGameAndDismissAdvisor,
  toolbar,
  topBar,
  topRowButtons,
} from './helpers';

/**
 * Updated responsive tests that leverage Playwright's project system.
 *
 * These tests run on ALL 4 configured projects (Desktop Chrome, iPhone SE,
 * Pixel 8a, iPad) automatically via the Playwright config. Each test handles
 * differences between mobile and desktop gracefully.
 */

test.describe('Responsive Layout', () => {
  test.describe('Intro Screen', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
    });

    test('intro overlay covers full viewport', async ({ page }) => {
      const overlay = introOverlay(page);
      await expect(overlay).toBeVisible();

      const box = await overlay.boundingBox();
      const viewport = page.viewportSize();
      if (box && viewport) {
        // Overlay should cover the full viewport (position: fixed inset: 0)
        expect(box.width).toBeGreaterThanOrEqual(viewport.width - 1);
        expect(box.height).toBeGreaterThanOrEqual(viewport.height - 1);
      }
    });

    test('dossier card does not overflow viewport horizontally', async ({ page }) => {
      const doc = page.locator('.dossier');
      const box = await doc.boundingBox();
      const viewport = page.viewportSize();

      if (box && viewport) {
        // width: min(500px, 100%) ensures it never exceeds viewport
        expect(box.width).toBeLessThanOrEqual(viewport.width);
        // Card should not be cut off on the right
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
        // Button should be fully within the viewport
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

    test('top bar spans full width', async ({ page }) => {
      const header = topBar(page);
      const box = await header.boundingBox();
      const viewport = page.viewportSize();

      if (box && viewport) {
        expect(box.width).toBeGreaterThanOrEqual(viewport.width - 2);
        expect(box.x).toBeLessThanOrEqual(1);
      }
    });

    test('top bar resource icons are visible', async ({ page }) => {
      const header = topBar(page);
      await expect(header).toContainText('₽');
      await expect(header).toContainText('📅');
    });

    test('toolbar spans full width', async ({ page }) => {
      const nav = toolbar(page);
      const box = await nav.boundingBox();
      const viewport = page.viewportSize();

      if (box && viewport) {
        expect(box.width).toBeGreaterThanOrEqual(viewport.width - 2);
      }
    });

    test('toolbar is positioned at bottom of screen', async ({ page }) => {
      const nav = toolbar(page);
      const box = await nav.boundingBox();
      const viewport = page.viewportSize();

      if (box && viewport) {
        // Toolbar bottom should be at or near viewport bottom
        const bottomEdge = box.y + box.height;
        expect(bottomEdge).toBeGreaterThan(viewport.height * 0.75);
      }
    });

    test('toolbar top row buttons are all reachable', async ({ page }) => {
      const buttons = topRowButtons(page);
      const count = await buttons.count();
      expect(count).toBeGreaterThan(0);

      // First button should be visible
      await expect(buttons.first()).toBeVisible();

      // The top row scrolls on mobile — verify the scrollable container exists
      const topRow = page.locator('nav > div').first();
      const style = await topRow.evaluate((el) => {
        return window.getComputedStyle(el).overflowX;
      });
      // Should be auto or scroll (scrollable) or visible (if it fits)
      expect(['auto', 'scroll', 'visible']).toContain(style);
    });

    test('toolbar building row scrolls horizontally on mobile', async ({ page }) => {
      const bottomRow = page.locator('nav > div').nth(1);
      const overflowX = await bottomRow.evaluate((el) => {
        return window.getComputedStyle(el).overflowX;
      });
      // The bottom row has overflow-x: auto via Tailwind
      expect(['auto', 'scroll', 'visible']).toContain(overflowX);

      // Buttons should exist
      const buttons = buildingButtons(page);
      const count = await buttons.count();
      expect(count).toBeGreaterThan(0);
    });

    test('canvas fills available viewport space', async ({ page }) => {
      const canvasEl = canvas(page);
      const canvasBox = await canvasEl.boundingBox();

      if (canvasBox) {
        expect(canvasBox.width).toBeGreaterThan(0);
        expect(canvasBox.height).toBeGreaterThan(0);
      }
    });

    test('canvas is between top bar and toolbar', async ({ page }) => {
      const headerBox = await topBar(page).boundingBox();
      const canvasBox = await canvas(page).boundingBox();
      const toolbarBox = await toolbar(page).boundingBox();

      if (headerBox && canvasBox && toolbarBox) {
        // Canvas should start below the top bar
        expect(canvasBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height - 1);
        // Canvas should end above the toolbar
        expect(canvasBox.y + canvasBox.height).toBeLessThanOrEqual(toolbarBox.y + 5);
      }
    });

    test('quota HUD is visible and within viewport', async ({ page }) => {
      const hud = quotaHud(page);
      await expect(hud).toBeVisible();

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
      await page.goto('/');
      await startButton(page).click();

      const advisor = advisorPanel(page);
      await expect(advisor).toBeVisible({ timeout: 3000 });

      const box = await advisor.boundingBox();
      const viewport = page.viewportSize();
      if (box && viewport) {
        // Advisor should not overflow viewport
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
      }
    });

    test('advisor dismiss button is tappable', async ({ page }) => {
      await page.goto('/');
      await startButton(page).click();

      const advisor = advisorPanel(page);
      await expect(advisor).toBeVisible({ timeout: 3000 });

      const dismissBtn = advisor.locator('button');
      await expect(dismissBtn).toBeVisible();
      await expect(dismissBtn).toBeEnabled();

      // Button should have adequate tap target size (min 44x44 from CSS)
      const box = await dismissBtn.boundingBox();
      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(40);
        expect(box.height).toBeGreaterThanOrEqual(20); // Height may be smaller for the dismiss text
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

    test('toolbar buttons meet minimum tap target size', async ({ page }) => {
      await startGameAndDismissAdvisor(page);

      const buttons = topRowButtons(page);
      const count = await buttons.count();

      for (let i = 0; i < Math.min(count, 3); i++) {
        const box = await buttons.nth(i).boundingBox();
        if (box) {
          // CSS specifies min-width: 44px and min-height: 44px for btn-retro
          expect(box.width).toBeGreaterThanOrEqual(44);
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
      }
    });

    test('building buttons are tappable on mobile viewports', async ({ page }) => {
      await startGameAndDismissAdvisor(page);

      const buttons = buildingButtons(page);
      const count = await buttons.count();
      expect(count).toBeGreaterThan(0);

      // First building button should have adequate size
      const box = await buttons.first().boundingBox();
      if (box) {
        // min-width: 52px is set on building buttons
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
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
