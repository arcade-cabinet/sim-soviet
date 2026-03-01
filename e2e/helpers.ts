/**
 * E2E test helpers — shared selectors and utility functions.
 *
 * Adapted for the current React Native Web UI (TopBar with testIDs).
 * React Native Web maps `testID` to `data-testid` in the DOM.
 */
import type { Page } from '@playwright/test';

// ── Locator Factories ────────────────────────────────────────────────────────

/** Population value from the TopBar. */
export const popValue = (page: Page) => page.getByTestId('pop-value');

/** Food value from the TopBar. */
export const foodValue = (page: Page) => page.getByTestId('food-value');

/** Date label from the TopBar calendar section. */
export const dateLabel = (page: Page) => page.getByTestId('date-label');

/** Era label from the TopBar. */
export const eraLabel = (page: Page) => page.getByTestId('era-label');

/** Timber value from the TopBar. */
export const timberValue = (page: Page) => page.getByTestId('timber-value');

/** The R3F canvas element. */
export const canvas = (page: Page) => page.locator('canvas');

// ── Condition-Based Wait Helpers ─────────────────────────────────────────────

/**
 * Wait for the game UI to be fully rendered after asset loading.
 * Checks: canvas exists + pop-value testID exists in DOM (TopBar mounted).
 */
export async function waitForGameReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector('canvas');
      if (!canvas || canvas.width === 0 || canvas.height === 0) return false;
      const pop = document.querySelector('[data-testid="pop-value"]');
      return !!pop;
    },
    undefined,
    { timeout: 45_000 },
  );
}

/**
 * Wait for the simulation to advance (date text changes).
 * Speeds up simulation to 3x first to reduce wait time.
 */
export async function waitForSimTick(page: Page, maxMs = 30_000): Promise<void> {
  // Dismiss any overlays that might block interaction
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // Speed up simulation
  const speed3x = page.getByText('\u25B6\u25B6\u25B6');
  if (await speed3x.first().isVisible().catch(() => false)) {
    await speed3x.first().click();
  }

  const initialDate = await getDateText(page);
  await page.waitForFunction(
    (prev) => {
      const el = document.querySelector('[data-testid="date-label"]');
      if (!el) return false;
      const current = el.textContent?.trim() ?? '';
      return current !== prev && current.length > 0;
    },
    initialDate,
    { timeout: maxMs },
  );
}

// ── Action Helpers ───────────────────────────────────────────────────────────

/**
 * Navigate to the app and start a new game.
 * Flow: MainMenu → NewGameSetup → Game Loading → IntroModal → Playing
 */
export async function startGame(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // MainMenu → click "NEW GAME"
  await page.getByText('NEW GAME').click();

  // NewGameSetup → click "BEGIN ASSIGNMENT"
  await page.getByText('BEGIN ASSIGNMENT').waitFor({ timeout: 5_000 });
  await page.waitForTimeout(300);
  await page.getByText('BEGIN ASSIGNMENT').click();

  // Wait for game canvas + TopBar to be ready (loading screen fades)
  await waitForGameReady(page);

  // IntroModal → click "ASSUME MAYORAL AUTHORITY"
  const ctaButton = page.getByText('ASSUME MAYORAL AUTHORITY');
  try {
    await ctaButton.waitFor({ state: 'visible', timeout: 10_000 });
    await ctaButton.click();
    // Wait for intro modal to fade
    await page.waitForTimeout(800);
  } catch {
    // IntroModal may not appear in all scenarios
  }
}

/**
 * Start the game and dismiss any initial advisor messages.
 */
export async function startGameAndDismiss(page: Page): Promise<void> {
  await startGame(page);
  // Press Escape to dismiss any overlays (advisor, etc.)
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

// ── Data Extraction ──────────────────────────────────────────────────────────

/** Get the population count from the TopBar. */
export async function getPopulation(page: Page): Promise<number> {
  const text = await popValue(page).innerText();
  return Number.parseInt(text.replace(/,/g, ''), 10);
}

/** Get the food count from the TopBar. */
export async function getFood(page: Page): Promise<number> {
  const text = await foodValue(page).innerText();
  return Number.parseInt(text.replace(/,/g, ''), 10);
}

/** Get the current date string from the TopBar. */
export async function getDateText(page: Page): Promise<string> {
  return (await dateLabel(page).innerText()).trim();
}

/** Get the current era label from the TopBar. */
export async function getEraText(page: Page): Promise<string> {
  return (await eraLabel(page).innerText()).trim();
}

/** Get the timber count from the TopBar. */
export async function getTimber(page: Page): Promise<number> {
  const text = await timberValue(page).innerText();
  return Number.parseInt(text.replace(/,/g, ''), 10);
}
