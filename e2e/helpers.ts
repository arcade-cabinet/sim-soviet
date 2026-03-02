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
 * Navigate to the app, select a difficulty, and start a new game.
 * Flow: MainMenu → NewGameSetup (select difficulty) → Game Loading → IntroModal → Playing
 *
 * @param page - Playwright page instance
 * @param difficulty - One of 'worker', 'comrade', or 'tovarish'
 */
export async function startGameWithDifficulty(
  page: Page,
  difficulty: 'worker' | 'comrade' | 'tovarish',
): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // MainMenu → click "NEW GAME"
  await page.getByText('NEW GAME').click();

  // NewGameSetup → select difficulty, then start
  await page.getByText('BEGIN ASSIGNMENT').waitFor({ timeout: 5_000 });
  await page.getByText(difficulty.toUpperCase()).first().click();
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
 * Navigate to the app and start a new game with default settings.
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

// ── Resource Helpers ────────────────────────────────────────────────────────

/** Vodka value from the TopBar. */
export const vodkaValue = (page: Page) => page.getByTestId('vodka-value');

/** Steel value from the TopBar. */
export const steelValue = (page: Page) => page.getByTestId('steel-value');

/** Power value from the TopBar. */
export const powerValue = (page: Page) => page.getByTestId('power-value');

/**
 * Read a specific resource value from the TopBar by testID suffix.
 * Supported: pop, food, timber, vodka, steel, cement, power.
 */
export async function getResourceValue(page: Page, resource: string): Promise<string> {
  const el = page.getByTestId(`${resource}-value`);
  return (await el.innerText()).trim();
}

// ── Navigation Helpers ──────────────────────────────────────────────────────

/**
 * Open the build toolbar by clicking the BUILD primary tab.
 * Waits for the ZONING sub-tab to appear as confirmation.
 */
export async function openToolbar(page: Page): Promise<void> {
  await page.getByText('BUILD').first().click();
  await page.getByText('ZONING').waitFor({ state: 'visible', timeout: 5_000 });
}

/**
 * Open the settings modal. Works from both MainMenu and in-game overflow.
 */
export async function openSettings(page: Page): Promise<void> {
  // Try the MainMenu SETTINGS button first
  const menuSettings = page.getByText('SETTINGS');
  if (await menuSettings.first().isVisible().catch(() => false)) {
    await menuSettings.first().click();
  }
  // Wait for the settings modal to appear
  await page.getByText('CENTRAL CONFIGURATION BUREAU').waitFor({
    state: 'visible',
    timeout: 5_000,
  });
}

/**
 * Open the save/load panel via the TopBar overflow menu.
 */
export async function openSavePanel(page: Page): Promise<void> {
  // Click the overflow menu button (hamburger ≡)
  const overflowBtn = page.getByText('\u2261');
  await overflowBtn.first().click();
  await page.waitForTimeout(300);

  // Click SAVE / LOAD in the overflow menu
  await page.getByText('SAVE / LOAD').first().click();
  await page.waitForTimeout(500);
}

/**
 * Advance game time by waiting for multiple date changes.
 * Sets speed to 3x and waits for the specified number of date transitions.
 */
export async function advanceGameTime(page: Page, ticks = 3): Promise<void> {
  // Dismiss overlays
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // Speed up simulation to 3x
  const speed3x = page.getByText('\u25B6\u25B6\u25B6');
  if (await speed3x.first().isVisible().catch(() => false)) {
    await speed3x.first().click();
  }

  for (let i = 0; i < ticks; i++) {
    const currentDate = await getDateText(page);
    await page.waitForFunction(
      (prev) => {
        const el = document.querySelector('[data-testid="date-label"]');
        if (!el) return false;
        const current = el.textContent?.trim() ?? '';
        return current !== prev && current.length > 0;
      },
      currentDate,
      { timeout: 30_000 },
    );
  }
}

/**
 * Navigate to main menu from any screen.
 */
export async function goToMainMenu(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // Wait for "NEW GAME" to be visible as confirmation we're on the menu
  await page.getByText('NEW GAME').waitFor({ state: 'visible', timeout: 10_000 });
}

// ── Autopilot / Turbo Helpers ─────────────────────────────────────────────────

/** Enable autopilot via the settings modal. */
export async function enableAutopilot(page: Page): Promise<void> {
  await openSettings(page);
  const toggle = page.getByText('COMRADE ADVISOR');
  await toggle.click();
  await page.keyboard.press('Escape'); // close settings
  await page.waitForTimeout(300);
}

/** Set turbo speed (100x). */
export async function setTurboSpeed(page: Page): Promise<void> {
  const turboBtn = page.getByText('⏩⏩');
  if (await turboBtn.first().isVisible().catch(() => false)) {
    await turboBtn.first().click();
  }
}

/** Get the current game year from the date label. */
export async function getGameYear(page: Page): Promise<number> {
  const dateText = await getDateText(page);
  const match = dateText.match(/(\d{4})/);
  return match ? parseInt(match[1], 10) : 0;
}

/** Wait for the game year to reach a target. */
export async function waitForYear(page: Page, targetYear: number, timeoutMs = 120_000): Promise<void> {
  await page.waitForFunction(
    (target) => {
      const el = document.querySelector('[data-testid="date-label"]');
      if (!el) return false;
      const match = el.textContent?.match(/(\d{4})/);
      return match ? parseInt(match[1], 10) >= target : false;
    },
    targetYear,
    { timeout: timeoutMs },
  );
}
