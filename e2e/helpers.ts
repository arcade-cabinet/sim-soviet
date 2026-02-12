/**
 * E2E test helpers — shared selectors and utility functions.
 *
 * The current UI has NO element IDs on most components (except #gameCanvas).
 * All selectors use CSS classes, semantic HTML elements, or text content.
 */
import type { Page } from '@playwright/test';

// ── Locator Factories ────────────────────────────────────────────────────────

/** The intro modal full-screen overlay. */
export const introOverlay = (page: Page) => page.locator('.intro-overlay');

/** The paper-textured dossier card inside the intro modal. */
export const dossier = (page: Page) => page.locator('.dossier');

/** The "I Serve the Soviet Union" start button (only button inside intro). */
export const startButton = (page: Page) => page.locator('.intro-overlay button');

/** The main game canvas element. */
export const canvas = (page: Page) => page.locator('#gameCanvas');

/** The top stats bar (<header> element). */
export const topBar = (page: Page) => page.locator('header');

/** The pause/resume button (only button inside the header). */
export const pauseButton = (page: Page) => page.locator('header button');

/** The bottom toolbar (<nav> element). */
export const toolbar = (page: Page) => page.locator('nav');

/**
 * The toolbar's top row (Inspect + 7 category tabs + Bulldoze).
 * This is the first direct child div of the nav.
 */
export const toolbarTopRow = (page: Page) => page.locator('nav > div').first();

/**
 * The toolbar's bottom row (building buttons for the active category).
 * This is the second direct child div of the nav.
 */
export const toolbarBottomRow = (page: Page) => page.locator('nav > div').nth(1);

/** All buttons in the toolbar top row (Inspect, categories, Bulldoze). */
export const topRowButtons = (page: Page) => toolbarTopRow(page).locator('button');

/** All building buttons in the toolbar bottom row. */
export const buildingButtons = (page: Page) => toolbarBottomRow(page).locator('button');

/** The quota HUD overlay (top-left of viewport). */
export const quotaHud = (page: Page) => page.locator('.quota-hud');

/** The advisor panel (Comrade Vanya). */
export const advisorPanel = (page: Page) => page.locator('.advisor-panel');

/** The advisor's dismiss button. */
export const advisorDismissBtn = (page: Page) => page.locator('.advisor-panel button');

/** The toast notification element. */
export const toast = (page: Page) => page.locator('.toast');

/** The building inspector panel. */
export const buildingInspector = (page: Page) =>
  page.locator('[style*="soviet-gold"]').filter({ hasText: 'Position' });

/** The Pravda news ticker. */
export const pravdaTicker = (page: Page) => page.locator('.pravda-ticker');

/** The game over modal (reuses .intro-overlay + .dossier). */
export const gameOverModal = (page: Page) =>
  page.locator('.intro-overlay').filter({ hasText: /Order of Lenin|KGB Notice/ });

// ── Condition-Based Wait Helpers ─────────────────────────────────────────────

/** Wait for the game canvas to be rendered and interactive. */
export async function waitForGameReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector('#gameCanvas') as HTMLCanvasElement | null;
      if (!canvas) return false;
      return canvas.width > 0 && canvas.height > 0;
    },
    undefined,
    { timeout: 10_000 }
  );
}

/** Wait for the game simulation to advance (date text changes). */
export async function waitForSimTick(page: Page, maxMs = 5000): Promise<void> {
  const initialDate = await getDateText(page);
  await page.waitForFunction(
    (prev) => {
      const header = document.querySelector('header');
      if (!header) return false;
      const match = header.innerText.match(/📅\s*([A-Za-z\s]+\d{4})/);
      const current = match ? match[1].trim() : '';
      return current !== prev;
    },
    initialDate,
    { timeout: maxMs }
  );
}

/** Wait for money to change from a known value. */
export async function waitForMoneyChange(
  page: Page,
  previousMoney: number,
  maxMs = 5000
): Promise<void> {
  await page.waitForFunction(
    (prev) => {
      const header = document.querySelector('header');
      if (!header) return false;
      const match = header.innerText.match(/₽\s*(\d+)/);
      const current = match ? Number.parseInt(match[1], 10) : -1;
      return current !== prev;
    },
    previousMoney,
    { timeout: maxMs }
  );
}

// ── Action Helpers ───────────────────────────────────────────────────────────

/**
 * Navigate to the app and start the game by clicking the start button.
 * Waits for the intro modal to disappear and the canvas to be ready.
 */
export async function startGame(page: Page): Promise<void> {
  await page.goto('/');
  await startButton(page).click();
  await introOverlay(page).waitFor({ state: 'hidden', timeout: 3000 });
  await waitForGameReady(page);
}

/**
 * Start the game and dismiss the initial advisor message.
 * Use this when you want a clean game state without overlays.
 */
export async function startGameAndDismissAdvisor(page: Page): Promise<void> {
  await startGame(page);
  const advisor = advisorPanel(page);
  if (await advisor.isVisible()) {
    await advisorDismissBtn(page).click();
    await advisor.waitFor({ state: 'hidden', timeout: 2000 });
  }
}

/**
 * Extract the current money value from the top bar.
 * Parses the text next to the ruble sign (₽).
 */
export async function getMoney(page: Page): Promise<number> {
  const headerText = await topBar(page).innerText();
  const match = headerText.match(/₽\s*(\d+)/);
  return match ? Number.parseInt(match[1]!, 10) : -1;
}

/**
 * Extract the current population value from the top bar.
 */
export async function getPopulation(page: Page): Promise<number> {
  const headerText = await topBar(page).innerText();
  // The population stat uses 👤 icon
  const match = headerText.match(/👤\s*(\d+)/);
  return match ? Number.parseInt(match[1]!, 10) : -1;
}

/**
 * Extract the current date string (e.g. "JAN 1980") from the top bar.
 */
export async function getDateText(page: Page): Promise<string> {
  const headerText = await topBar(page).innerText();
  const match = headerText.match(/📅\s*([A-Za-z\s]+\d{4})/);
  return match ? match[1]!.trim() : '';
}

/**
 * Click a category tab in the toolbar by its label text.
 * Works on desktop where labels are visible.
 */
export async function selectCategory(page: Page, label: string): Promise<void> {
  const btn = toolbarTopRow(page).locator('button').filter({ hasText: label });
  await btn.click();
}

/**
 * Click a building button in the bottom row by its name text.
 */
export async function selectBuilding(page: Page, name: string): Promise<void> {
  const btn = buildingButtons(page).filter({ hasText: new RegExp(name, 'i') });
  await btn.first().click();
}

/**
 * Click the Inspect button in the toolbar (first button in top row).
 */
export async function selectInspect(page: Page): Promise<void> {
  await topRowButtons(page).first().click();
}

/**
 * Click the Bulldoze/Purge button in the toolbar (last button in top row).
 */
export async function selectBulldoze(page: Page): Promise<void> {
  await topRowButtons(page).last().click();
}

/**
 * Click near the center of the game canvas.
 * Returns the bounding box for reference.
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

// ── Constants ────────────────────────────────────────────────────────────────

/** Number of toolbar categories (Housing, Industry, Power, Services, Govt, Military, Infra). */
export const CATEGORY_COUNT = 7;

/** Total top-row buttons: 1 Inspect + 7 categories + 1 Bulldoze. */
export const TOP_ROW_BUTTON_COUNT = 9;

/** Number of housing buildings (default category on load). */
export const HOUSING_BUILDING_COUNT = 7;

/** Starting money for a new game. */
export const STARTING_MONEY = 2000;

/** Bulldoze cost (must match CanvasGestureManager.BULLDOZE_COST). */
export const BULLDOZE_COST = 20;
