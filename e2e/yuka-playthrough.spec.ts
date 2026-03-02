/**
 * E2E playthrough tests across all three difficulty levels.
 *
 * Validates that the ChairmanAgent autopilot can sustain a commune
 * for a minimum number of years at each difficulty setting.
 * Population must remain a finite positive number throughout.
 *
 * Runs at 100x turbo speed with the autopilot (COMRADE ADVISOR) enabled.
 * Screenshots are captured at start and end of each test for visual verification.
 */
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import {
  startGameWithDifficulty,
  getPopulation,
  getEraText,
  enableAutopilot,
  setTurboSpeed,
  getGameYear,
  waitForYear,
} from './helpers';

// Increase timeout for long-running playthroughs
test.describe.configure({ timeout: 300_000 }); // 5 min per test

test.describe('Yuka Playthrough — Difficulty Levels', () => {
  const SCREENSHOT_DIR = 'e2e/screenshots';
  const START_YEAR = 1917;

  test.beforeAll(() => {
    for (const level of ['worker', 'comrade', 'tovarish']) {
      mkdirSync(`${SCREENSHOT_DIR}/${level}`, { recursive: true });
    }
  });

  test('worker difficulty — sustainable commune', async ({ page }) => {
    await startGameWithDifficulty(page, 'worker');
    await enableAutopilot(page);
    await setTurboSpeed(page);

    const startingPop = await getPopulation(page);
    expect(startingPop).toBeGreaterThan(0);
    expect(Number.isFinite(startingPop)).toBe(true);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/worker/start.png` });

    // Worker (easiest): survive at least 5 years
    await waitForYear(page, START_YEAR + 5);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/worker/1922.png` });
    const pop1922 = await getPopulation(page);
    expect(Number.isFinite(pop1922)).toBe(true);
    expect(pop1922).toBeGreaterThan(0);

    console.log(`Worker E2E: startPop=${startingPop}, pop@1922=${pop1922}`);
  });

  test('comrade difficulty — challenging but survivable', async ({ page }) => {
    await startGameWithDifficulty(page, 'comrade');
    await enableAutopilot(page);
    await setTurboSpeed(page);

    const startingPop = await getPopulation(page);
    expect(startingPop).toBeGreaterThan(0);
    expect(Number.isFinite(startingPop)).toBe(true);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/comrade/start.png` });

    // Comrade: survive at least 3 years
    await waitForYear(page, START_YEAR + 3);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/comrade/1920.png` });
    const pop1920 = await getPopulation(page);
    expect(Number.isFinite(pop1920)).toBe(true);
    expect(pop1920).toBeGreaterThan(0);

    console.log(`Comrade E2E: startPop=${startingPop}, pop@1920=${pop1920}`);
  });

  test('tovarish difficulty — survives initial years', async ({ page }) => {
    await startGameWithDifficulty(page, 'tovarish');
    await enableAutopilot(page);
    await setTurboSpeed(page);

    const startingPop = await getPopulation(page);
    expect(startingPop).toBeGreaterThan(0);
    expect(Number.isFinite(startingPop)).toBe(true);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/tovarish/start.png` });

    // Tovarish (hardest): survive at least 1 year
    await waitForYear(page, START_YEAR + 1);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/tovarish/1918.png` });
    const pop1918 = await getPopulation(page);
    expect(Number.isFinite(pop1918)).toBe(true);
    expect(pop1918).toBeGreaterThan(0);

    console.log(`Tovarish E2E: startPop=${startingPop}, pop@1918=${pop1918}`);
  });
});
