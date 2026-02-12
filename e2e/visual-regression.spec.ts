import { expect, test } from '@playwright/test';
import {
  buildingButtons,
  dossier,
  landingPage,
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
 *
 * To generate/update baselines:
 *   npx playwright test e2e/visual-regression.spec.ts --update-snapshots
 *
 * For CI (Linux baselines):
 *   docker run --rm -v $(pwd):/work -w /work mcr.microsoft.com/playwright:v1.52.0 \
 *     npx playwright test e2e/visual-regression.spec.ts --update-snapshots
 */

test.describe('Visual Regression', () => {
  test.describe('Landing Page (Tabbed Dossier)', () => {
    test('landing page screenshot on load', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await expect(landingPage(page)).toBeVisible();
      await expect(page).toHaveScreenshot('landing-page.png', {
        fullPage: true,
      });
    });

    test('dossier tab content screenshot', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const dossierEl = dossier(page);
      await expect(dossierEl).toBeVisible();
      await expect(dossierEl).toHaveScreenshot('dossier-tab-content.png');
    });

    test('credits tab screenshot', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await page.getByText('CREDITS').click();
      await page.waitForTimeout(300); // Animation settle

      await expect(page).toHaveScreenshot('credits-tab.png', {
        fullPage: true,
      });
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
      await startGameAndDismissAdvisor(page);

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
      await startGameAndDismissAdvisor(page);

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

  test.describe('CRT Effects', () => {
    test('full page with CRT overlay screenshot', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Full page screenshot captures CRT overlay and scanlines
      await expect(page).toHaveScreenshot('crt-effects-landing.png', {
        fullPage: true,
      });
    });
  });
});
