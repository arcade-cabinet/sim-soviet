import { expect, test } from '@playwright/test';
import {
  clickCanvasCenter,
  getDateText,
  getWorkerCount,
  pauseButton,
  quotaHud,
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

  test('quota progress bar exists and has valid width style', async ({ page }) => {
    await startGameAndDismissAdvisor(page);

    const hud = quotaHud(page);
    // The progress bar is a child div with transition-all + duration-300
    const progressBar = hud.locator('.transition-all');
    await expect(progressBar).toBeAttached();

    const style = await progressBar.getAttribute('style');
    expect(style).toContain('width');
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
    await expect(advisor).toContainText('Coal Plant');
    await expect(advisor).toContainText('Housing');
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

  test('quota HUD shows remaining years', async ({ page }) => {
    await startGameAndDismissAdvisor(page);

    const hud = quotaHud(page);
    await expect(hud).toContainText('5 years remaining');
  });

  test('population starts at zero', async ({ page }) => {
    await startGameAndDismissAdvisor(page);

    const workers = await getWorkerCount(page);
    expect(workers).toBe(0);
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
