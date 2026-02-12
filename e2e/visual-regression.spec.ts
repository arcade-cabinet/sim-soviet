import { expect, test } from '@playwright/test';
import {
  buildingButtons,
  introOverlay,
  quotaHud,
  startButton,
  startGameAndDismissAdvisor,
  toolbar,
  topBar,
} from './helpers';

/**
 * Visual regression tests using Playwright's screenshot comparison.
 *
 * These tests capture screenshots and compare them against baseline images.
 * On first run, baselines are created. Subsequent runs detect visual regressions.
 *
 * The Playwright config has maxDiffPixelRatio: 0.05 for tolerance
 * (accounts for anti-aliasing, font rendering differences, etc.)
 */

test.describe('Visual Regression', () => {
  test.describe('Intro Modal', () => {
    test('intro modal screenshot on load', async ({ page }) => {
      await page.goto('/');
      // Wait for fonts and layout to settle
      await page.waitForLoadState('networkidle');

      await expect(introOverlay(page)).toBeVisible();
      await expect(page).toHaveScreenshot('intro-modal.png', {
        fullPage: true,
      });
    });

    test('dossier card screenshot', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const dossierEl = page.locator('.dossier');
      await expect(dossierEl).toBeVisible();
      await expect(dossierEl).toHaveScreenshot('dossier-card.png');
    });

    test('TOP SECRET stamp screenshot', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const stamp = page.locator('.stamp');
      await expect(stamp).toBeVisible();
      await expect(stamp).toHaveScreenshot('top-secret-stamp.png');
    });
  });

  test.describe('Game Board', () => {
    test('game board after start screenshot', async ({ page }) => {
      await startGameAndDismissAdvisor(page);
      // Wait for canvas to render and sprites to load
      await page.waitForTimeout(2000);

      await expect(page).toHaveScreenshot('game-board-initial.png', {
        fullPage: true,
      });
    });

    test('game board with buildings placed screenshot', async ({ page }) => {
      await startGameAndDismissAdvisor(page);

      // Place a building to change the board state
      await buildingButtons(page).first().click();
      const canvasEl = page.locator('#gameCanvas');
      const box = await canvasEl.boundingBox();
      if (box) {
        await canvasEl.click({
          position: { x: box.width / 2, y: box.height / 2 },
        });
      }
      await page.waitForTimeout(2000);

      await expect(page).toHaveScreenshot('game-board-with-building.png', {
        fullPage: true,
      });
    });
  });

  test.describe('Toolbar', () => {
    test('toolbar default state screenshot', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const nav = toolbar(page);
      await expect(nav).toBeVisible();
      await expect(nav).toHaveScreenshot('toolbar-default.png');
    });

    test('toolbar with building selected screenshot', async ({ page }) => {
      await startGameAndDismissAdvisor(page);

      // Select a building
      await buildingButtons(page).first().click();

      const nav = toolbar(page);
      await expect(nav).toHaveScreenshot('toolbar-building-selected.png');
    });

    test('toolbar with bulldoze selected screenshot', async ({ page }) => {
      await startGameAndDismissAdvisor(page);

      // Select bulldoze
      const bulldozeBtn = page.locator('nav > div').first().locator('button').last();
      await bulldozeBtn.click();

      const nav = toolbar(page);
      await expect(nav).toHaveScreenshot('toolbar-bulldoze-selected.png');
    });

    test('toolbar industry category screenshot', async ({ page }) => {
      await startGameAndDismissAdvisor(page);

      // Switch to industry category
      const industryTab = page
        .locator('nav > div')
        .first()
        .locator('button')
        .filter({ hasText: '🏭' });
      await industryTab.click();

      const nav = toolbar(page);
      await expect(nav).toHaveScreenshot('toolbar-industry-category.png');
    });
  });

  test.describe('Top Bar', () => {
    test('top bar screenshot', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const header = topBar(page);
      await expect(header).toBeVisible();
      await expect(header).toHaveScreenshot('top-bar.png');
    });

    test('top bar paused state screenshot', async ({ page }) => {
      await startGameAndDismissAdvisor(page);

      // Pause the game
      await page.keyboard.press('Space');

      const header = topBar(page);
      await expect(header).toHaveScreenshot('top-bar-paused.png');
    });
  });

  test.describe('Quota HUD', () => {
    test('quota HUD screenshot', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const hud = quotaHud(page);
      await expect(hud).toBeVisible();
      await expect(hud).toHaveScreenshot('quota-hud.png');
    });
  });

  test.describe('Advisor Panel', () => {
    test('advisor panel screenshot', async ({ page }) => {
      await page.goto('/');
      await startButton(page).click();

      const advisor = page.locator('.advisor-panel');
      await expect(advisor).toBeVisible({ timeout: 3000 });
      await expect(advisor).toHaveScreenshot('advisor-panel.png');
    });
  });

  test.describe('CRT Effects', () => {
    test('full page with CRT overlay screenshot', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Full page screenshot captures CRT overlay and scanlines
      await expect(page).toHaveScreenshot('crt-effects-intro.png', {
        fullPage: true,
      });
    });
  });
});
