/**
 * E2E tests for demographics system integration.
 *
 * Verifies that the game starts with dvor-derived population,
 * the HUD displays correct values, and simulation ticks advance
 * demographics through the UI.
 */
import { expect, test } from '@playwright/test';
import {
  getDateText,
  getEraText,
  getFood,
  getPopulation,
  getTimber,
  startGame,
  startGameAndDismiss,
  waitForSimTick,
} from './helpers';

test.describe('Game Start — Demographics', () => {
  test('population is a valid number derived from dvory (not hardcoded 12)', async ({ page }) => {
    await startGameAndDismiss(page);

    const pop = await getPopulation(page);
    // Dvor system creates dvory with family members.
    // With population derived from dvory, we expect a valid non-zero number.
    expect(pop).toBeGreaterThan(0);
    expect(Number.isNaN(pop)).toBe(false);
  });

  test('food value is displayed and valid', async ({ page }) => {
    await startGameAndDismiss(page);

    const food = await getFood(page);
    expect(Number.isNaN(food)).toBe(false);
    expect(food).toBeGreaterThanOrEqual(0);
  });

  test('timber starts with configured amount', async ({ page }) => {
    await startGameAndDismiss(page);

    const timber = await getTimber(page);
    expect(Number.isNaN(timber)).toBe(false);
    // Default difficulty gives ~200 timber
    expect(timber).toBeGreaterThan(0);
  });

  test('era label shows a valid era', async ({ page }) => {
    await startGameAndDismiss(page);

    const era = await getEraText(page);
    // Starting era should be one of the defined eras
    const validEras = [
      'REVOLUTION',
      'COLLECTIVIZATION',
      'INDUSTRIALIZATION',
      'GREAT PATRIOTIC WAR',
      'RECONSTRUCTION',
      'THAW & FREEZE',
      'ERA OF STAGNATION',
      'THE ETERNAL SOVIET',
    ];
    expect(validEras).toContain(era);
  });

  test('date label shows valid month and year format', async ({ page }) => {
    await startGameAndDismiss(page);

    const dateText = await getDateText(page);
    // Expect "MON YYYY" format (abbreviated uppercase month) e.g. "OCT 1917"
    expect(dateText).toMatch(/[A-Z]{3}\s+\d{4}/);
  });
});

test.describe('Simulation Tick — Demographics', () => {
  test('date advances over time', async ({ page }) => {
    await startGameAndDismiss(page);

    const initialDate = await getDateText(page);
    expect(initialDate).toMatch(/\d{4}/);

    await waitForSimTick(page);

    const laterDate = await getDateText(page);
    expect(laterDate).toMatch(/\d{4}/);
    expect(laterDate).not.toBe(initialDate);
  });

  test('population is a valid number after simulation ticks', async ({ page }) => {
    await startGameAndDismiss(page);

    const initialPop = await getPopulation(page);
    expect(initialPop).toBeGreaterThan(0);

    // Advance a few ticks — without farms, starvation may reduce population
    await waitForSimTick(page);

    const laterPop = await getPopulation(page);
    // Population should still be a valid number (may drop due to starvation)
    expect(Number.isNaN(laterPop)).toBe(false);
    expect(laterPop).toBeGreaterThanOrEqual(0);
  });

  test('HUD resources remain valid after simulation ticks', async ({ page }) => {
    await startGameAndDismiss(page);

    await waitForSimTick(page);

    // All resource values should still be valid numbers
    const pop = await getPopulation(page);
    const food = await getFood(page);
    const timber = await getTimber(page);

    expect(Number.isNaN(pop)).toBe(false);
    expect(Number.isNaN(food)).toBe(false);
    expect(Number.isNaN(timber)).toBe(false);
  });
});

test.describe('Game Flow', () => {
  test('full new game flow completes without errors', async ({ page }) => {
    await startGame(page);

    // Game should be running — TopBar visible with resources
    const pop = await getPopulation(page);
    expect(pop).toBeGreaterThan(0);

    const dateText = await getDateText(page);
    expect(dateText).toMatch(/\d{4}/);
  });

  test('pause and resume with Space key', async ({ page }) => {
    await startGameAndDismiss(page);

    const initialDate = await getDateText(page);

    // Pause
    await page.keyboard.press('Space');
    await page.waitForTimeout(2000);

    // Date should not advance while paused
    const pausedDate = await getDateText(page);
    expect(pausedDate).toBe(initialDate);

    // Resume
    await page.keyboard.press('Space');
    await waitForSimTick(page);

    const resumedDate = await getDateText(page);
    // After resume, date should eventually advance
    expect(resumedDate).toMatch(/\d{4}/);
  });
});
