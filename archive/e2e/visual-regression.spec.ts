import { expect, test } from '@playwright/test';
import { dossier, landingPage, sovietHud, startGameAndDismissAdvisor } from './helpers';

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
  });

  test.describe('SovietHUD', () => {
    test('SovietHUD screenshot', async ({ page }) => {
      await startGameAndDismissAdvisor(page);

      const hud = sovietHud(page);
      await expect(hud).toBeVisible();
      await expect(hud).toHaveScreenshot('soviet-hud.png');
    });

    test('SovietHUD paused state screenshot', async ({ page }) => {
      await startGameAndDismissAdvisor(page);

      // Pause the game
      await page.keyboard.press('Space');

      const hud = sovietHud(page);
      await expect(hud).toHaveScreenshot('soviet-hud-paused.png');
    });
  });

  test.describe('CRT Effects', () => {
    test('full page with CRT overlay screenshot', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot('crt-effects-landing.png', {
        fullPage: true,
      });
    });
  });
});
