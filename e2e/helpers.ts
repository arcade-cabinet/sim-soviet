/**
 * E2E test helpers — shared selectors and utility functions.
 *
 * Updated for the redesigned UI:
 *   - SovietHUD (<header>) replaced TopBar — different resource icons
 *   - BottomStrip replaced Toolbar — no building category tabs
 *   - RadialBuildMenu replaced toolbar building selection
 *   - Money (₽) is no longer displayed in the HUD
 */
import type { Page } from '@playwright/test';

// ── Locator Factories ────────────────────────────────────────────────────────

/** The landing page full-screen overlay (tabbed dossier menu). */
export const landingPage = (page: Page) => page.locator('[class*="fixed inset-0"]').first();

/** The paper-textured dossier card (tab content area). */
export const dossier = (page: Page) => page.locator('[data-testid="dossier-content"]');

/** The "BEGIN NEW ASSIGNMENT" button on the landing page New Game tab. */
export const startButton = (page: Page) => page.getByText('BEGIN NEW ASSIGNMENT');

// Legacy alias for E2E tests that reference the old intro overlay
export const introOverlay = landingPage;

/** The main game canvas element. */
export const canvas = (page: Page) => page.locator('#gameCanvas');

/** The SovietHUD top bar (<header> element). Contains settlement info, resources, controls. */
export const sovietHud = (page: Page) => page.locator('header');

// Legacy alias — old tests use topBar
export const topBar = sovietHud;

/** The pause/resume button (inside the SovietHUD, uses aria-label). */
export const pauseButton = (page: Page) =>
  page.locator('header').getByRole('button', { name: /Pause|Resume/ });

/** The BottomStrip — context-sensitive bottom info bar. */
export const bottomStrip = (page: Page) => page.locator('div.border-t-2.border-\\[\\#8b0000\\]');

/**
 * The quota HUD overlay (top-left of viewport).
 * NOTE: QuotaHUD is NOT currently rendered in App.tsx.
 * This selector exists for future use when the component is wired.
 */
export const quotaHud = (page: Page) => page.locator('.quota-hud');

/** The advisor panel (Comrade Vanya). */
export const advisorPanel = (page: Page) => page.locator('.advisor-panel');

/** The advisor's dismiss button. */
export const advisorDismissBtn = (page: Page) => page.locator('.advisor-panel button');

/** The toast notification element. */
export const toast = (page: Page) => page.locator('.toast');

/** The Pravda news ticker. */
export const pravdaTicker = (page: Page) => page.locator('.pravda-ticker');

/** The game over modal. */
export const gameOverModal = (page: Page) =>
  page.locator('.intro-overlay').filter({ hasText: /Order of Lenin|KGB Notice/ });

// ── Condition-Based Wait Helpers ─────────────────────────────────────────────

/**
 * Wait for the game canvas AND React UI overlay to be fully mounted.
 * Checks: canvas has dimensions + <header> exists in DOM.
 * This ensures React has completed its first render cycle after game start.
 */
export async function waitForGameReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector('#gameCanvas') as HTMLCanvasElement | null;
      if (!canvas || canvas.width === 0 || canvas.height === 0) return false;
      // React UI overlay must also be mounted
      const header = document.querySelector('header');
      return !!header;
    },
    undefined,
    { timeout: 15_000 }
  );
}

/**
 * Wait for the game simulation to advance (date text changes).
 * SovietHUD shows date as "MonthName YYYY" in a .font-mono element.
 */
export async function waitForSimTick(page: Page, maxMs = 5000): Promise<void> {
  const initialDate = await getDateText(page);
  await page.waitForFunction(
    (prev) => {
      const el = document.querySelector('header .font-mono');
      if (!el) return false;
      const current = el.textContent?.trim() ?? '';
      return current !== prev && current.length > 0;
    },
    initialDate,
    { timeout: maxMs }
  );
}

/**
 * Wait for the worker count to change from a known value.
 */
export async function waitForWorkerChange(
  page: Page,
  previousCount: number,
  maxMs = 5000
): Promise<void> {
  await page.waitForFunction(
    (prev) => {
      const chip = document.querySelector('[title="Workers"]');
      if (!chip) return false;
      const text = chip.querySelector('.font-mono')?.textContent?.trim() ?? '';
      const current = Number.parseInt(text.replace(/,/g, ''), 10);
      return !Number.isNaN(current) && current !== prev;
    },
    previousCount,
    { timeout: maxMs }
  );
}

// ── Action Helpers ───────────────────────────────────────────────────────────

/**
 * Navigate to the app and start the game by stepping through the full
 * new-game flow: Landing Page → NewGameFlow (3 steps) → AssignmentLetter → playing.
 * Waits for each screen transition to complete before proceeding.
 *
 * Each step uses AnimatePresence with mode="wait", meaning the exit animation
 * must complete before the next component mounts. Small settle delays prevent
 * clicking during transitions on slow CI runners.
 */
export async function startGame(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Landing page — click "BEGIN NEW ASSIGNMENT" on the New Game tab
  await startButton(page).click();

  // Wait for NewGameFlow step 1 to render
  await page.getByText('I. ASSIGNMENT').waitFor({ timeout: 8000 });
  await page.waitForTimeout(300); // animation settle

  // NewGameFlow step 1 → step 2
  await page.getByText('Next').first().click();
  await page.getByText('II. PARAMETERS').waitFor({ timeout: 8000 });
  await page.waitForTimeout(300);

  // NewGameFlow step 2 → step 3
  await page.getByText('Next').first().click();
  await page.getByText('III. CONSEQUENCES').waitFor({ timeout: 8000 });
  await page.waitForTimeout(300);

  // NewGameFlow step 3 → AssignmentLetter
  // Use exact match to avoid matching "BEGIN NEW ASSIGNMENT" during exit animation
  await page.getByRole('button', { name: 'BEGIN', exact: true }).click();
  await page.getByText('Accept Assignment').waitFor({ timeout: 8000 });
  await page.waitForTimeout(300);

  // AssignmentLetter → Game
  await page.getByText('Accept Assignment').click();

  // Wait for the game canvas AND React UI overlay to be ready
  await waitForGameReady(page);
}

/**
 * Start the game and dismiss the initial advisor message.
 * Use this when you want a clean game state without overlays.
 */
export async function startGameAndDismissAdvisor(page: Page): Promise<void> {
  await startGame(page);
  const advisor = advisorPanel(page);
  try {
    // Wait for the advisor to appear (it's async, may not render immediately)
    await advisor.waitFor({ state: 'visible', timeout: 3000 });
    await advisorDismissBtn(page).click();
    await advisor.waitFor({ state: 'hidden', timeout: 3000 });
  } catch {
    // Advisor may not appear in all test scenarios — that's OK
  }
}

/**
 * Extract the worker count from the SovietHUD.
 * The Workers resource chip has title="Workers".
 */
export async function getWorkerCount(page: Page): Promise<number> {
  const chip = page.locator('[title="Workers"]');
  const text = await chip.locator('.font-mono').innerText();
  return Number.parseInt(text.replace(/,/g, ''), 10);
}

/**
 * Extract the food count from the SovietHUD.
 */
export async function getFoodCount(page: Page): Promise<number> {
  const chip = page.locator('[title="Food"]');
  const text = await chip.locator('.font-mono').innerText();
  return Number.parseInt(text.replace(/,/g, ''), 10);
}

/**
 * Extract the current date string (e.g., "October 1922") from the SovietHUD.
 * The date is in a .font-mono element inside the settlement info section.
 */
export async function getDateText(page: Page): Promise<string> {
  const dateEl = page.locator('header .font-mono').first();
  return (await dateEl.innerText()).trim();
}

/**
 * Click near the center of the game canvas.
 */
export async function clickCanvasCenter(page: Page): Promise<void> {
  const canvasEl = canvas(page);
  const box = await canvasEl.boundingBox();
  if (!box) throw new Error('Canvas has no bounding box');
  await canvasEl.click({
    position: { x: box.width / 2, y: box.height / 2 },
  });
}

/**
 * Click at a specific offset from the canvas center.
 */
export async function clickCanvasAt(page: Page, offsetX: number, offsetY: number): Promise<void> {
  const canvasEl = canvas(page);
  const box = await canvasEl.boundingBox();
  if (!box) throw new Error('Canvas has no bounding box');
  await canvasEl.click({
    position: {
      x: box.width / 2 + offsetX,
      y: box.height / 2 + offsetY,
    },
  });
}
