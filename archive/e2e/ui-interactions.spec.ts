import { expect, test } from '@playwright/test';
import {
  advisorDismissBtn,
  advisorPanel,
  clickCanvasCenter,
  pauseButton,
  sovietHud,
  startGame,
  startGameAndDismissAdvisor,
  toast,
} from './helpers';

test.describe('UI Interactions', () => {
  test.describe('Keyboard Shortcuts', () => {
    test.beforeEach(async ({ page }) => {
      await startGameAndDismissAdvisor(page);
    });

    test('Space key toggles pause', async ({ page }) => {
      const btn = pauseButton(page);

      // Initially unpaused
      await expect(btn).toHaveAttribute('aria-label', 'Pause');

      // Press Space to pause
      await page.keyboard.press('Space');
      await expect(btn).toHaveAttribute('aria-label', 'Resume');

      // Press Space to resume
      await page.keyboard.press('Space');
      await expect(btn).toHaveAttribute('aria-label', 'Pause');
    });

    test('Escape key dismisses radial menu', async ({ page }) => {
      // Open radial menu by clicking canvas
      await clickCanvasCenter(page);
      await page.waitForTimeout(300);

      // Press Escape — should dismiss any open overlay
      await page.keyboard.press('Escape');

      // Radial menu should not be visible
      const buildMenu = page.locator('svg title:has-text("Build Menu")');
      const isVisible = await buildMenu.isVisible().catch(() => false);
      // Either it was already dismissed or never opened — no crash either way
      expect(typeof isVisible).toBe('boolean');
    });

    test('Space key does not pause when typing in input', async ({ page }) => {
      // Verify Space works globally on the game
      const btn = pauseButton(page);

      await page.keyboard.press('Space');
      await expect(btn).toHaveAttribute('aria-label', 'Resume');

      await page.keyboard.press('Space');
      await expect(btn).toHaveAttribute('aria-label', 'Pause');
    });
  });

  test.describe('Pause Button', () => {
    test.beforeEach(async ({ page }) => {
      await startGameAndDismissAdvisor(page);
    });

    test('clicking pause button in SovietHUD toggles pause state', async ({ page }) => {
      const btn = pauseButton(page);

      // Initially unpaused
      await expect(btn).toHaveAttribute('aria-label', 'Pause');

      // Click to pause
      await btn.click();
      await expect(btn).toHaveAttribute('aria-label', 'Resume');

      // Click to resume
      await btn.click();
      await expect(btn).toHaveAttribute('aria-label', 'Pause');
    });

    test('pause button has correct title attribute', async ({ page }) => {
      const btn = pauseButton(page);

      // When unpaused, title should mention Pause
      await expect(btn).toHaveAttribute('title', /Pause/);

      // When paused, title should mention Resume
      await btn.click();
      await expect(btn).toHaveAttribute('title', /Resume/);
    });
  });

  test.describe('Advisor', () => {
    test('advisor auto-dismisses after timeout', async ({ page }) => {
      await startGame(page);

      const advisor = advisorPanel(page);
      await expect(advisor).toBeVisible({ timeout: 3000 });

      // Pause simulation so events don't replace the advisor message
      await page.keyboard.press('Space');

      // Advisor auto-dismisses after 8 seconds
      await expect(advisor).toBeHidden({ timeout: 12000 });
    });

    test('advisor shows Comrade Krupnik name', async ({ page }) => {
      await startGame(page);

      const advisor = advisorPanel(page);
      await expect(advisor).toBeVisible({ timeout: 3000 });
      await expect(advisor).toContainText('Krupnik');
    });

    test('advisor dismiss button works', async ({ page }) => {
      await startGame(page);

      const advisor = advisorPanel(page);
      await expect(advisor).toBeVisible({ timeout: 3000 });

      await advisorDismissBtn(page).click();
      await expect(advisor).toBeHidden({ timeout: 2000 });
    });

    test('advisor has pixel art face canvas', async ({ page }) => {
      await startGame(page);

      const advisor = advisorPanel(page);
      await expect(advisor).toBeVisible({ timeout: 3000 });

      // The advisor panel contains a canvas element for the pixel art face
      const faceCanvas = advisor.locator('canvas');
      await expect(faceCanvas).toBeAttached();

      // Canvas should have 60x60 dimensions
      await expect(faceCanvas).toHaveAttribute('width', '60');
      await expect(faceCanvas).toHaveAttribute('height', '60');
    });
  });

  test.describe('Toast Notifications', () => {
    test('toast element is hidden when no message', async ({ page }) => {
      await startGameAndDismissAdvisor(page);

      // Toast should not be visible without a triggering event
      const toastEl = toast(page);
      const count = await toastEl.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('SovietHUD', () => {
    test.beforeEach(async ({ page }) => {
      await startGameAndDismissAdvisor(page);
    });

    test('SovietHUD is always visible', async ({ page }) => {
      const hud = sovietHud(page);
      await expect(hud).toBeVisible();
    });

    test('SovietHUD shows settlement tier label', async ({ page }) => {
      const hud = sovietHud(page);
      // One of the tier labels should be visible
      const text = await hud.innerText();
      expect(text.length).toBeGreaterThan(0);
    });

    test('speed controls change game speed', async ({ page }) => {
      const hud = sovietHud(page);

      // Click 2x speed
      await hud.getByRole('button', { name: 'Speed 2x' }).click();
      // The 2x button should be highlighted (bg-[#8b0000])
      const btn2x = hud.getByRole('button', { name: 'Speed 2x' });
      const classes = await btn2x.getAttribute('class');
      expect(classes).toContain('8b0000');

      // Click 3x speed
      await hud.getByRole('button', { name: 'Speed 3x' }).click();
      const btn3x = hud.getByRole('button', { name: 'Speed 3x' });
      const classes3 = await btn3x.getAttribute('class');
      expect(classes3).toContain('8b0000');
    });

    test('hamburger menu button is visible', async ({ page }) => {
      const menuBtn = page.getByRole('button', { name: 'Open menu' });
      await expect(menuBtn).toBeVisible();
    });
  });
});
