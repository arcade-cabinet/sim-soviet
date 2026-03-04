/**
 * E2E tests for Phase 1 minimal HUD.
 *
 * Verifies that the game starts with a stripped-down UI:
 * only date, food, population visible in TopBar; no BUILD tab,
 * no ZONING, no Advisor (COMRADE KRUPNIK).
 */
import { expect, test } from '@playwright/test';
import { startGameAndDismiss } from './helpers';

test.describe('Minimal HUD (Phase 1)', () => {
  test.slow();

  test('game starts with minimal TopBar — date, pop, food visible', async ({ page }) => {
    await startGameAndDismiss(page);

    // Core resources should be visible
    await expect(page.getByTestId('date-label')).toBeVisible();
    await expect(page.getByTestId('pop-value')).toBeVisible();
    await expect(page.getByTestId('food-value')).toBeVisible();
  });

  test('BUILD tab is NOT visible', async ({ page }) => {
    await startGameAndDismiss(page);

    // BUILD tab was part of the Toolbar (removed in Phase 1)
    const buildTab = page.getByText('BUILD', { exact: true });
    await expect(buildTab).not.toBeVisible();
  });

  test('ZONING sub-tab is NOT visible', async ({ page }) => {
    await startGameAndDismiss(page);

    const zoning = page.getByText('ZONING', { exact: true });
    await expect(zoning).not.toBeVisible();
  });

  test('Advisor (COMRADE KRUPNIK) is NOT visible', async ({ page }) => {
    await startGameAndDismiss(page);

    // Advisor messages contain "COMRADE KRUPNIK"
    const advisor = page.getByText('COMRADE KRUPNIK');
    await expect(advisor).not.toBeVisible();
  });
});
