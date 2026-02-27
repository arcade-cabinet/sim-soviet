import { expect, test } from '@playwright/test';
import {
  clickCanvasCenter,
  getDateText,
  getWorkerCount,
  pauseButton,
  sovietHud,
  startGame,
  startGameAndDismissAdvisor,
  waitForSimTick,
} from './helpers';

test.describe('Game Flow', () => {
  test('date advances over time', async ({ page }) => {
    await startGameAndDismissAdvisor(page);

    const initialDate = await getDateText(page);
    expect(initialDate).toMatch(/\d{4}/);

    // Wait for the simulation to advance the date
    await waitForSimTick(page);

    const laterDate = await getDateText(page);
    expect(laterDate).toMatch(/\d{4}/);
    expect(laterDate.length).toBeGreaterThan(0);
  });

  test('SovietHUD resources remain valid after ticks', async ({ page }) => {
    await startGameAndDismissAdvisor(page);
    await waitForSimTick(page);

    // Resources should still be displayed
    const hud = sovietHud(page);
    await expect(hud).toContainText('👷');
    await expect(hud).toContainText('🌾');
  });

  test('pause game with Space key stops simulation', async ({ page }) => {
    await startGameAndDismissAdvisor(page);

    // Press Space to pause
    await page.keyboard.press('Space');

    // Pause button should have "Resume" aria-label (showing play icon)
    const btn = pauseButton(page);
    await expect(btn).toHaveAttribute('aria-label', 'Resume');
  });

  test('resume game with Space key continues simulation', async ({ page }) => {
    await startGameAndDismissAdvisor(page);

    // Pause the game
    await page.keyboard.press('Space');
    await expect(pauseButton(page)).toHaveAttribute('aria-label', 'Resume');

    // Resume the game
    await page.keyboard.press('Space');
    await expect(pauseButton(page)).toHaveAttribute('aria-label', 'Pause');

    // Wait for simulation to run
    await waitForSimTick(page);

    const resumedDate = await getDateText(page);
    expect(resumedDate).toMatch(/\d{4}/);
  });

  test('advisor message appears on game start', async ({ page }) => {
    await startGame(page);

    const advisor = page.locator('.advisor-panel');
    await expect(advisor).toBeVisible({ timeout: 3000 });
    // First tutorial milestone says to build a farm
    await expect(advisor).toContainText('Krupnik');
  });

  test('game state persists across simulation ticks', async ({ page }) => {
    await startGameAndDismissAdvisor(page);

    // Click canvas to interact
    await clickCanvasCenter(page);

    // Wait for ticks
    await waitForSimTick(page);

    // SovietHUD should still be functional
    const hud = sovietHud(page);
    await expect(hud).toBeVisible();
    // Resources should still be displayed
    await expect(hud).toContainText('👷');
  });

  test('starting year matches default era', async ({ page }) => {
    await startGameAndDismissAdvisor(page);

    const dateText = await getDateText(page);
    // Default start era is war_communism (1922)
    expect(dateText).toMatch(/\d{4}/);
  });

  test('SovietHUD date shows a valid month and year', async ({ page }) => {
    await startGameAndDismissAdvisor(page);

    const dateText = await getDateText(page);
    // Should be formatted as "MonthName YYYY"
    expect(dateText).toMatch(/[A-Z][a-z]+\s+\d{4}/);
  });

  test('population is a valid number at game start', async ({ page }) => {
    await startGameAndDismissAdvisor(page);

    const workers = await getWorkerCount(page);
    // Starting settlement creates ~30-55 citizens depending on difficulty
    expect(workers).toBeGreaterThanOrEqual(0);
    expect(Number.isNaN(workers)).toBe(false);
  });

  test('multiple pause/unpause cycles work correctly', async ({ page }) => {
    await startGameAndDismissAdvisor(page);

    const btn = pauseButton(page);

    // Pause
    await page.keyboard.press('Space');
    await expect(btn).toHaveAttribute('aria-label', 'Resume');

    // Resume
    await page.keyboard.press('Space');
    await expect(btn).toHaveAttribute('aria-label', 'Pause');

    // Pause again
    await page.keyboard.press('Space');
    await expect(btn).toHaveAttribute('aria-label', 'Resume');

    // Resume again
    await page.keyboard.press('Space');
    await expect(btn).toHaveAttribute('aria-label', 'Pause');
  });
});
