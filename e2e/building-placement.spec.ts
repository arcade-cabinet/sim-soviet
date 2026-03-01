/**
 * E2E tests for building placement and toolbar interaction.
 *
 * Verifies that the build toolbar opens, building categories are navigable,
 * and toolbar state changes correctly when interacting with build tools.
 */
import { expect, test } from '@playwright/test';
import { getPopulation, openToolbar, startGameAndDismiss } from './helpers';

test.describe('Build Toolbar', () => {
  // Each test loads a full game (55 GLB models) — CI runners need extra time
  test.slow();

  test('BUILD tab opens with ZONING sub-tab visible', async ({ page }) => {
    await startGameAndDismiss(page);

    await openToolbar(page);

    // ZONING sub-tab should be visible when BUILD is active
    await expect(page.getByText('ZONING')).toBeVisible();
    await expect(page.getByText('INFRASTRUCTURE')).toBeVisible();
    await expect(page.getByText('STATE')).toBeVisible();
  });

  test('switching build sub-tabs works', async ({ page }) => {
    await startGameAndDismiss(page);

    await openToolbar(page);

    // Switch to INFRASTRUCTURE sub-tab
    await page.getByText('INFRASTRUCTURE').click();
    await page.waitForTimeout(300);

    // Switch to STATE sub-tab
    await page.getByText('STATE').click();
    await page.waitForTimeout(300);

    // Switch back to ZONING
    await page.getByText('ZONING').click();
    await page.waitForTimeout(300);

    // All sub-tabs should still be visible (BUILD is still active)
    await expect(page.getByText('ZONING')).toBeVisible();
  });

  test('primary navigation tabs are all visible', async ({ page }) => {
    await startGameAndDismiss(page);

    // All 5 primary tabs should be visible
    await expect(page.getByText('BUILD')).toBeVisible();
    await expect(page.getByText('MANDATES')).toBeVisible();
    await expect(page.getByText('WORKERS')).toBeVisible();
    await expect(page.getByText('REPORTS')).toBeVisible();
    await expect(page.getByText('PURGE')).toBeVisible();
  });

  test('switching to non-build tab hides sub-tabs', async ({ page }) => {
    await startGameAndDismiss(page);

    // Open BUILD first to confirm sub-tabs appear
    await openToolbar(page);
    await expect(page.getByText('ZONING')).toBeVisible();

    // Switch to MANDATES — sub-tabs should disappear
    await page.getByText('MANDATES').click();
    await page.waitForTimeout(300);

    // ZONING sub-tab should no longer be visible
    await expect(page.getByText('ZONING')).not.toBeVisible();
  });

  test('game has valid population while toolbar is open', async ({ page }) => {
    await startGameAndDismiss(page);

    await openToolbar(page);

    // Population should still be valid even with toolbar open
    const pop = await getPopulation(page);
    expect(pop).toBeGreaterThan(0);
  });
});
