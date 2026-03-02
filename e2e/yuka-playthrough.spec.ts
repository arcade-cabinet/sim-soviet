/**
 * E2E 200-year playthrough test using Yuka autopilot + turbo speed.
 *
 * Validates that the ChairmanAgent can sustain a commune from 1917 to 2117
 * across all 8 eras without the population collapsing to zero.
 *
 * Runs at 100x turbo speed with the autopilot (COMRADE ADVISOR) enabled.
 * Screenshots are captured at historical checkpoints for visual verification.
 */
import { test, expect } from '@playwright/test';
import {
  startGame,
  getPopulation,
  getEraText,
  enableAutopilot,
  setTurboSpeed,
  getGameYear,
  waitForYear,
} from './helpers';

// Increase timeout for long-running playthroughs
test.describe.configure({ timeout: 300_000 }); // 5 min per test

test.describe('Yuka Playthrough — 200 Year Sustainability', () => {
  const SCREENSHOT_DIR = 'e2e/screenshots';

  test('worker difficulty — sustainable commune (1917-2117)', async ({ page }) => {
    // Start game with default settings (Worker difficulty)
    await startGame(page);
    await enableAutopilot(page);
    await setTurboSpeed(page);

    const startingPop = await getPopulation(page);
    expect(startingPop).toBeGreaterThan(0);

    // Checkpoint: Year 5 — population should have grown
    await waitForYear(page, 1922);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/worker/1922.png` });
    expect(await getPopulation(page)).toBeGreaterThan(startingPop);

    // Checkpoint: Year 20
    await waitForYear(page, 1937);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/worker/1937.png` });
    expect(await getPopulation(page)).toBeGreaterThan(startingPop);

    // Checkpoint: Year 50
    await waitForYear(page, 1967);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/worker/1967.png` });
    expect(await getPopulation(page)).toBeGreaterThan(100);

    // Checkpoint: Year 100
    await waitForYear(page, 2017);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/worker/2017.png` });
    expect(await getPopulation(page)).toBeGreaterThan(200);

    // Final: Year 200
    await waitForYear(page, 2117);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/worker/2117.png` });
    const finalPop = await getPopulation(page);
    expect(finalPop).toBeGreaterThan(0);
    console.log(`Worker playthrough complete: final pop = ${finalPop}`);
  });
});
