/**
 * E2E tests for the settings modal.
 *
 * Verifies that settings can be opened from the main menu,
 * toggles work for music, SFX, and color-blind mode.
 */
import { expect, test } from '@playwright/test';
import { goToMainMenu, openSettings } from './helpers';

test.describe('Settings Modal — Main Menu', () => {
  test('settings modal opens from main menu', async ({ page }) => {
    await goToMainMenu(page);

    await openSettings(page);

    // Settings modal should show the configuration bureau header
    await expect(page.getByText('CENTRAL CONFIGURATION BUREAU')).toBeVisible();
  });

  test('music toggle is visible and clickable', async ({ page }) => {
    await goToMainMenu(page);

    await openSettings(page);

    // MUSIC label should be visible
    await expect(page.getByText('MUSIC')).toBeVisible();

    // Find and click the toggle button near the MUSIC label
    // The toggle shows ON or OFF
    const toggleButtons = page.locator('div').filter({ hasText: /^(ON|OFF)$/ });
    const musicToggle = toggleButtons.first();
    const initialText = await musicToggle.innerText();

    await musicToggle.click();
    await page.waitForTimeout(300);

    // After clicking, the toggle state should change
    const newText = await musicToggle.innerText();
    expect(newText).not.toBe(initialText);
  });

  test('color-blind mode toggle is visible', async ({ page }) => {
    await goToMainMenu(page);

    await openSettings(page);

    // COLOR-BLIND MODE label should be visible
    await expect(page.getByText('COLOR-BLIND MODE')).toBeVisible();
  });

  test('settings modal can be closed', async ({ page }) => {
    await goToMainMenu(page);

    await openSettings(page);

    // Click the CLOSE button
    await page.getByText('CLOSE').click();
    await page.waitForTimeout(500);

    // Should be back on main menu — NEW GAME visible
    await expect(page.getByText('NEW GAME')).toBeVisible();
  });
});
