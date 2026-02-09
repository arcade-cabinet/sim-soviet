import { expect, test } from '@playwright/test';
import {
  advisorDismissBtn,
  advisorPanel,
  buildingButtons,
  canvas,
  dossier,
  HOUSING_BUILDING_COUNT,
  introOverlay,
  quotaHud,
  startButton,
  TOP_ROW_BUTTON_COUNT,
  topBar,
  topRowButtons,
} from './helpers';

test.describe('Game Load', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page loads with correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/SimSoviet/i);
  });

  test('intro modal is visible on load', async ({ page }) => {
    await expect(introOverlay(page)).toBeVisible();
  });

  test('intro modal contains ministry briefing text', async ({ page }) => {
    const doc = dossier(page);
    await expect(doc).toContainText('Ministry of Planning');
    await expect(doc).toContainText('Director of Sector 7G');
    await expect(doc).toContainText('Coal Plants');
    await expect(doc).toContainText('Potatoes');
    await expect(doc).toContainText('Vodka');
  });

  test('intro modal shows TOP SECRET stamp', async ({ page }) => {
    const stamp = page.locator('.stamp');
    await expect(stamp).toBeVisible();
    await expect(stamp).toContainText('Top Secret');
  });

  test('intro modal lists player objectives', async ({ page }) => {
    const doc = dossier(page);
    await expect(doc).toContainText('Your objectives');
    await expect(doc).toContainText('Build Housing');
    await expect(doc).toContainText('Build Coal Plants');
    await expect(doc).toContainText('Produce Potatoes');
    await expect(doc).toContainText('Produce Vodka');
  });

  test('start button is visible and has correct text', async ({ page }) => {
    const btn = startButton(page);
    await expect(btn).toBeVisible();
    await expect(btn).toContainText('I Serve the Soviet Union');
  });

  test('clicking start button hides the intro modal', async ({ page }) => {
    await startButton(page).click();
    await expect(introOverlay(page)).toBeHidden({ timeout: 2000 });
  });

  test('canvas element exists on the page', async ({ page }) => {
    await expect(canvas(page)).toBeAttached();
  });

  test('canvas is visible after dismissing intro', async ({ page }) => {
    await startButton(page).click();
    await expect(canvas(page)).toBeVisible();
  });

  test('top bar displays resource stat icons', async ({ page }) => {
    const header = topBar(page);
    // Resource icons are always visible on all viewports
    await expect(header).toContainText('₽');
    await expect(header).toContainText('👤');
    await expect(header).toContainText('🥔');
    await expect(header).toContainText('🍾');
    await expect(header).toContainText('⚡');
    await expect(header).toContainText('📅');
  });

  test('top bar contains a pause button', async ({ page }) => {
    const btn = page.locator('header button');
    await expect(btn).toBeVisible();
    // Initially showing pause icon (game is running)
    await expect(btn).toContainText('⏸');
  });

  test('advisor appears after clicking start', async ({ page }) => {
    await startButton(page).click();

    const advisor = advisorPanel(page);
    await expect(advisor).toBeVisible({ timeout: 3000 });
    await expect(advisor).toContainText('Comrade Vanya');
    await expect(advisor).toContainText('Coal Plant');
  });

  test('advisor can be dismissed', async ({ page }) => {
    await startButton(page).click();

    const advisor = advisorPanel(page);
    await expect(advisor).toBeVisible({ timeout: 3000 });

    await advisorDismissBtn(page).click();
    await expect(advisor).toBeHidden();
  });

  test('toolbar top row has correct button count', async ({ page }) => {
    // Top row: 1 Inspect + 7 category tabs + 1 Bulldoze = 9
    await expect(topRowButtons(page)).toHaveCount(TOP_ROW_BUTTON_COUNT);
  });

  test('toolbar shows Inspect and Purge (Bulldoze) buttons', async ({ page }) => {
    const buttons = topRowButtons(page);
    // Inspect is first, Bulldoze/Purge is last
    await expect(buttons.first()).toContainText('🔍');
    await expect(buttons.last()).toContainText('💣');
  });

  test('toolbar shows category tabs', async ({ page }) => {
    const topRow = topRowButtons(page);
    // Categories between Inspect and Bulldoze: Housing, Industry, Power, Services, Govt, Military, Infra
    // Check for category emoji icons which are always visible
    const allText = await topRow.allInnerTexts();
    const combined = allText.join(' ');
    expect(combined).toContain('🏢'); // Housing
    expect(combined).toContain('🏭'); // Industry
    expect(combined).toContain('⚡'); // Power
    expect(combined).toContain('🏥'); // Services
    expect(combined).toContain('🏛️'); // Govt
    expect(combined).toContain('🎖️'); // Military
    expect(combined).toContain('🚂'); // Infra
  });

  test('toolbar bottom row shows housing buildings by default', async ({ page }) => {
    const buttons = buildingButtons(page);
    await expect(buttons).toHaveCount(HOUSING_BUILDING_COUNT);
  });

  test('toolbar building buttons have names and icons', async ({ page }) => {
    const firstBuilding = buildingButtons(page).first();
    await expect(firstBuilding).toBeVisible();
    // Each building button has an emoji icon and a name
    const text = await firstBuilding.innerText();
    expect(text.length).toBeGreaterThan(0);
  });

  test('quota HUD displays 5-year plan info', async ({ page }) => {
    const hud = quotaHud(page);
    await expect(hud).toContainText('5-YEAR PLAN');
  });

  test('quota HUD shows quota type and remaining time', async ({ page }) => {
    const hud = quotaHud(page);
    await expect(hud).toContainText('food');
    await expect(hud).toContainText('remaining');
  });

  test('quota HUD shows progress percentage', async ({ page }) => {
    const hud = quotaHud(page);
    // Initial quota progress is 0%
    await expect(hud).toContainText('0%');
  });

  test('CRT overlay effects are present', async ({ page }) => {
    await expect(page.locator('.crt-overlay')).toBeAttached();
    await expect(page.locator('.scanlines')).toBeAttached();
  });

  test('game viewport container exists', async ({ page }) => {
    await expect(page.locator('.game-viewport')).toBeAttached();
  });
});
