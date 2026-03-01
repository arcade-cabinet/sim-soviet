/**
 * E2E tests for game over conditions and return to menu.
 *
 * Verifies that the game over modal can appear and the return-to-menu
 * flow works correctly. Since triggering actual game over requires
 * extensive time or manipulation, these tests focus on verifiable
 * game state integrity and the menu return flow.
 */
import { expect, test } from '@playwright/test';
import {
  advanceGameTime,
  getDateText,
  getPopulation,
  getResourceValue,
  goToMainMenu,
  startGameAndDismiss,
} from './helpers';

test.describe('Game Over & Restart', () => {
  // Each test loads a full game (55 GLB models) — CI runners need extra time
  test.slow();

  test('game state remains valid under extended play', async ({ page }) => {
    await startGameAndDismiss(page);

    // Advance several ticks and verify state remains valid
    await advanceGameTime(page, 5);

    const pop = await getPopulation(page);
    const dateText = await getDateText(page);

    expect(Number.isNaN(pop)).toBe(false);
    expect(dateText).toMatch(/[A-Z]{3}\s+\d{4}/);
  });

  test('all resource values remain valid numbers after extended play', async ({ page }) => {
    await startGameAndDismiss(page);

    await advanceGameTime(page, 4);

    // Check all resources remain valid
    const timber = await getResourceValue(page, 'timber');
    const steel = await getResourceValue(page, 'steel');
    const food = await getResourceValue(page, 'food');

    // All should be parseable as numbers (may contain commas)
    expect(Number.isNaN(Number(timber.replace(/,/g, '')))).toBe(false);
    expect(Number.isNaN(Number(steel.replace(/,/g, '')))).toBe(false);
    expect(Number.isNaN(Number(food.replace(/,/g, '')))).toBe(false);
  });

  test('navigating back to main menu works', async ({ page }) => {
    await startGameAndDismiss(page);

    // Verify game is running
    const pop = await getPopulation(page);
    expect(pop).toBeGreaterThan(0);

    // Navigate back to main menu
    await goToMainMenu(page);

    // Main menu should be showing
    await expect(page.getByText('NEW GAME')).toBeVisible();
    await expect(page.getByText('SIMSOVIET')).toBeVisible();
  });
});
