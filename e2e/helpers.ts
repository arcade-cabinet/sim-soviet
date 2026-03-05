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
  // CI with SwiftShader needs more time for WebGL canvas + asset loading
  const timeout = process.env.CI ? 120_000 : 45_000;
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector('canvas');
      if (!canvas || canvas.width === 0 || canvas.height === 0) return false;
      const pop = document.querySelector('[data-testid="pop-value"]');
      return !!pop;
    },
    undefined,
    { timeout },
  );
}

/**
 * Wait for the simulation to advance (date text changes).
 * Speeds up simulation to 3x first to reduce wait time.
 */
export async function waitForSimTick(page: Page, maxMs = process.env.CI ? 60_000 : 30_000): Promise<void> {
  // Dismiss any overlays that might block interaction
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // Speed up simulation
  const speed3x = page.getByText('\u25B6\u25B6\u25B6');
  if (await speed3x.first().isVisible().catch(() => false)) {
    await speed3x.first().click();
  }

  const initialDate = await getDateText(page);
  const deadline = Date.now() + maxMs;

  // Poll for date change, dismissing any blocking modals between checks
  while (Date.now() < deadline) {
    const newDate = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="date-label"]');
      return el?.textContent?.trim() ?? '';
    });
    if (newDate !== initialDate && newDate.length > 0) return;

    await dismissAnyModal(page);
    await page.waitForTimeout(500);
  }

  throw new Error(`waitForSimTick: date did not change within ${maxMs}ms (stuck at "${initialDate}")`);
}

// ── Action Helpers ───────────────────────────────────────────────────────────

/** Dismiss the IntroModal if it appears. */
async function dismissIntroModal(page: Page): Promise<void> {
  const ctaButton = page.getByText('ASSUME MAYORAL AUTHORITY');
  if (await ctaButton.isVisible().catch(() => false)) {
    await ctaButton.click();
    await page.waitForTimeout(800);
  }
}

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
  // Brief pause for difficulty selection UI state to settle
  await page.waitForTimeout(300);
  await page.getByText('BEGIN ASSIGNMENT').click();

  // Wait for game canvas + TopBar to be ready (loading screen fades)
  await waitForGameReady(page);

  await dismissIntroModal(page);
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
  // Brief pause for difficulty selection UI state to settle
  await page.waitForTimeout(300);
  await page.getByText('BEGIN ASSIGNMENT').click();

  // Wait for game canvas + TopBar to be ready (loading screen fades)
  await waitForGameReady(page);

  await dismissIntroModal(page);
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

  const tickTimeout = process.env.CI ? 60_000 : 30_000;

  for (let i = 0; i < ticks; i++) {
    const currentDate = await getDateText(page);
    const deadline = Date.now() + tickTimeout;

    // Poll for date change, dismissing any blocking modals between checks
    while (Date.now() < deadline) {
      const newDate = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="date-label"]');
        return el?.textContent?.trim() ?? '';
      });
      if (newDate !== currentDate && newDate.length > 0) break;

      // Dismiss any event/era/plan modals that pause the sim
      await dismissAnyModal(page);
      await page.waitForTimeout(500);
    }

    // Verify the date actually changed
    const finalDate = await getDateText(page);
    if (finalDate === currentDate) {
      throw new Error(
        `advanceGameTime: date did not change within ${tickTimeout}ms (stuck at "${currentDate}")`,
      );
    }
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

// ── Modal Dismissal ──────────────────────────────────────────────────────────

/**
 * Dismiss any blocking modal currently visible (plan, era, annual report, etc.).
 *
 * Checks for common modal CTA button texts and clicks the first visible one.
 * Also falls back to Escape key if no known button is found.
 */
export async function dismissAnyModal(page: Page): Promise<boolean> {
  const ctaTexts = [
    'IGNORE (AUTO-RESOLVE)',
    'REFUSAL IS NOT AN OPTION',
    'ASSUME MAYORAL AUTHORITY',
    'GLORY TO THE WORKERS',
    'FOR THE MOTHERLAND',
    'LONG LIVE THE PARTY',
    'ACCEPT MANDATE',
    'ACKNOWLEDGED',
    'Resume Service',
    'CONTINUE INTO ALTERNATE HISTORY',
    'CONTINUE',
    'DISMISS',
    'CLOSE',
    'OK',
  ];

  for (const text of ctaTexts) {
    const btn = page.getByText(text, { exact: false });
    if (await btn.first().isVisible({ timeout: 100 }).catch(() => false)) {
      // Use force:true because modal backdrops intercept pointer events
      await btn.first().click({ force: true, timeout: 1000 }).catch(() => {});
      await page.waitForTimeout(200);
      return true;
    }
  }

  // Fallback: try Escape key to dismiss any overlay
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  return false;
}

// ── Autopilot / Turbo Helpers ─────────────────────────────────────────────────

/** Enable autopilot via the exposed engine API (window.__simEngine). */
export async function enableAutopilot(page: Page): Promise<void> {
  await page.evaluate(() => {
    const engine = (window as any).__simEngine;
    if (engine?.enableAutopilot) {
      engine.enableAutopilot();
    }
  });
  await page.waitForTimeout(300);
}

/** Set turbo speed (100x) by clicking the ⏩⏩ button. Falls back to ⏩ (10x). */
export async function setTurboSpeed(page: Page): Promise<void> {
  // Dismiss any overlays first
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  const turbo100 = page.getByText('\u23E9\u23E9');
  if (await turbo100.first().isVisible().catch(() => false)) {
    await turbo100.first().click();
    return;
  }
  const turbo10 = page.getByText('\u23E9');
  if (await turbo10.first().isVisible().catch(() => false)) {
    await turbo10.first().click();
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

// ── Rich Snapshot Helpers ───────────────────────────────────────────────────

/** Structured game state captured for screenshot context. */
export interface GameSnapshotData {
  year: number;
  month: string;
  population: number;
  food: number;
  vodka: number;
  era: string;
  buildingCount: number;
  settlementTier: string;
  threatLevel: string;
  blackMarks: number;
  isGameOver: boolean;
}

/**
 * Extract the current game state from DOM testIDs and window.__simEngine.
 *
 * Reads visible values from DOM (pop, food, vodka, era, date) and deep state
 * from the simulation engine (buildingCount, settlementTier, threatLevel,
 * blackMarks, isGameOver).
 */
export async function extractGameState(page: Page): Promise<GameSnapshotData> {
  return page.evaluate(() => {
    // ── DOM reads ──
    const getText = (testId: string): string =>
      document.querySelector(`[data-testid="${testId}"]`)?.textContent?.trim() ?? '';

    const parseNum = (testId: string): number => {
      const raw = getText(testId).replace(/,/g, '');
      const n = parseInt(raw, 10);
      return isNaN(n) ? 0 : n;
    };

    const dateText = getText('date-label');
    const yearMatch = dateText.match(/(\d{4})/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : 0;
    const month = dateText.replace(/\d{4}/, '').trim();

    const population = parseNum('pop-value');
    const food = parseNum('food-value');
    const vodka = parseNum('vodka-value');
    const era = getText('era-label');

    // ── Engine reads (runtime access to TypeScript private fields) ──
    const engine = (window as any).__simEngine;
    let buildingCount = 0;
    let settlementTier = 'unknown';
    let threatLevel = 'unknown';
    let blackMarks = 0;
    let isGameOver = false;

    if (engine) {
      try {
        // Count occupied grid cells (buildings + infrastructure)
        const grid = engine.grid;
        if (grid && grid.grid) {
          for (const row of grid.grid) {
            for (const cell of row) {
              if (cell && cell.type !== null) buildingCount++;
            }
          }
        }
      } catch { /* grid unavailable */ }

      try {
        const settlement = engine.getSettlement?.();
        settlementTier = settlement?.getCurrentTier?.() ?? 'unknown';
      } catch { /* settlement unavailable */ }

      try {
        const kgb = engine.getPersonnelFile?.();
        threatLevel = kgb?.getThreatLevel?.() ?? 'unknown';
        blackMarks = kgb?.getBlackMarks?.() ?? 0;
      } catch { /* kgb unavailable */ }

      try {
        isGameOver = !!engine.ended;
      } catch { /* ended unavailable */ }
    }

    return {
      year,
      month,
      population,
      food,
      vodka,
      era,
      buildingCount,
      settlementTier,
      threatLevel,
      blackMarks,
      isGameOver,
    };
  });
}

/**
 * Inject a temporary debug overlay showing all game state values.
 *
 * The overlay is a fixed-position panel at top-left with green monospace text
 * on a black background. Element ID: 'e2e-debug-overlay'.
 */
export async function injectDebugOverlay(page: Page, data: GameSnapshotData): Promise<void> {
  await page.evaluate((d) => {
    // Remove existing overlay if present
    document.getElementById('e2e-debug-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'e2e-debug-overlay';
    Object.assign(overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      zIndex: '10000',
      background: '#000000',
      color: '#00ff00',
      fontFamily: 'monospace',
      fontSize: '12px',
      padding: '8px',
      lineHeight: '1.4',
      whiteSpace: 'pre',
      pointerEvents: 'none',
    });
    overlay.textContent = [
      `Year: ${d.year}  Month: ${d.month}`,
      `Pop: ${d.population}  Food: ${d.food}  Vodka: ${d.vodka}`,
      `Era: ${d.era}`,
      `Buildings: ${d.buildingCount}`,
      `Settlement: ${d.settlementTier}`,
      `Threat: ${d.threatLevel}  Marks: ${d.blackMarks}`,
      `Game Over: ${d.isGameOver}`,
    ].join('\n');
    document.body.appendChild(overlay);
  }, data);
}

/** Remove the debug overlay injected by injectDebugOverlay. */
export async function removeDebugOverlay(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.getElementById('e2e-debug-overlay')?.remove();
  });
}

/**
 * Capture a rich game snapshot: extract state, inject debug overlay,
 * take screenshot, then clean up.
 *
 * @param page - Playwright page instance
 * @param dir - Directory to save the screenshot in
 * @param label - Descriptive label for the screenshot filename
 * @param seq - Sequence number for ordered filenames
 * @returns The captured game state and screenshot filename
 */
export async function captureGameSnapshot(
  page: Page,
  dir: string,
  label: string,
  seq: number,
): Promise<{ data: GameSnapshotData; filename: string }> {
  const data = await extractGameState(page);

  // Build descriptive filename: {seq}-{label}-year-{YYYY}-pop{N}-era-{slug}.png
  const eraSlug = data.era.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const seqStr = String(seq).padStart(3, '0');
  const filename = `${seqStr}-${label}-year-${data.year}-pop${data.population}-era-${eraSlug}.png`;
  const filepath = `${dir}/${filename}`;

  await injectDebugOverlay(page, data);
  await page.screenshot({ path: filepath });
  await removeDebugOverlay(page);

  return { data, filename };
}

/**
 * Check if the game is over by querying the engine and falling back to DOM text.
 *
 * First checks window.__simEngine.ended (runtime access to private field).
 * If the engine is unavailable, searches the DOM for "GAME OVER" or "DISMISSED" text.
 */
export async function isGameOverVisible(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    // Primary: check engine state
    const engine = (window as any).__simEngine;
    if (engine) {
      try {
        if (engine.ended) return true;
      } catch { /* ignore */ }
    }

    // Fallback: search DOM for game-over text
    const bodyText = document.body.innerText?.toUpperCase() ?? '';
    return bodyText.includes('GAME OVER') || bodyText.includes('DISMISSED');
  });
}
