import { expect, test } from '@playwright/test';
import {
  advisorDismissBtn,
  advisorPanel,
  buildingButtons,
  canvas,
  dossier,
  HOUSING_BUILDING_COUNT,
  landingPage,
  quotaHud,
  startButton,
  startGame,
  startGameAndDismissAdvisor,
  TOP_ROW_BUTTON_COUNT,
  topBar,
  topRowButtons,
} from './helpers';

test.describe('Game Load', () => {
  test.describe('Landing Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
    });

    test('page loads with correct title', async ({ page }) => {
      await expect(page).toHaveTitle(/SimSoviet/i);
    });

    test('landing page is visible on load', async ({ page }) => {
      await expect(landingPage(page)).toBeVisible();
    });

    test('landing page shows game title', async ({ page }) => {
      await expect(page.getByText('SIMSOVET 2000')).toBeVisible();
    });

    test('landing page shows all four tabs', async ({ page }) => {
      await expect(page.getByText('NEW GAME')).toBeVisible();
      await expect(page.getByText('LOAD')).toBeVisible();
      await expect(page.getByText('SETTINGS')).toBeVisible();
      await expect(page.getByText('CREDITS')).toBeVisible();
    });

    test('new game tab contains assignment orders', async ({ page }) => {
      const doc = dossier(page);
      await expect(doc).toContainText('Assignment Orders');
      await expect(doc).toContainText('Central Committee');
    });

    test('start button is visible and has correct text', async ({ page }) => {
      const btn = startButton(page);
      await expect(btn).toBeVisible();
      await expect(btn).toContainText('BEGIN NEW ASSIGNMENT');
    });

    test('credits tab shows technology info', async ({ page }) => {
      await page.getByText('CREDITS').click();
      await page.waitForTimeout(300);
      await expect(page.getByText('Canvas 2D + React 19')).toBeVisible();
    });

    test('canvas element exists on the page', async ({ page }) => {
      await expect(canvas(page)).toBeAttached();
    });

    test('CRT overlay effects are present', async ({ page }) => {
      await expect(page.locator('.crt-overlay')).toBeAttached();
      await expect(page.locator('.scanlines')).toBeAttached();
    });

    test('game viewport container exists', async ({ page }) => {
      await expect(page.locator('.game-viewport')).toBeAttached();
    });
  });

  test.describe('Game UI After Start', () => {
    test('canvas is visible after starting game', async ({ page }) => {
      await startGame(page);
      await expect(canvas(page)).toBeVisible();
    });

    test('top bar displays resource stat icons', async ({ page }) => {
      await startGameAndDismissAdvisor(page);
      const header = topBar(page);
      await expect(header).toContainText('₽');
      await expect(header).toContainText('👤');
      await expect(header).toContainText('🥔');
      await expect(header).toContainText('🍾');
      await expect(header).toContainText('⚡');
      await expect(header).toContainText('📅');
    });

    test('top bar contains a pause button', async ({ page }) => {
      await startGameAndDismissAdvisor(page);
      const btn = page.locator('header button');
      await expect(btn).toBeVisible();
      await expect(btn).toContainText('⏸');
    });

    test('advisor appears after starting game', async ({ page }) => {
      await startGame(page);
      const advisor = advisorPanel(page);
      await expect(advisor).toBeVisible({ timeout: 3000 });
      await expect(advisor).toContainText('Comrade Vanya');
    });

    test('advisor can be dismissed', async ({ page }) => {
      await startGame(page);
      const advisor = advisorPanel(page);
      await expect(advisor).toBeVisible({ timeout: 3000 });
      await advisorDismissBtn(page).click();
      await expect(advisor).toBeHidden();
    });

    test('toolbar top row has correct button count', async ({ page }) => {
      await startGameAndDismissAdvisor(page);
      await expect(topRowButtons(page)).toHaveCount(TOP_ROW_BUTTON_COUNT);
    });

    test('toolbar shows Inspect and Purge (Bulldoze) buttons', async ({ page }) => {
      await startGameAndDismissAdvisor(page);
      const buttons = topRowButtons(page);
      await expect(buttons.first()).toContainText('🔍');
      await expect(buttons.last()).toContainText('💣');
    });

    test('toolbar shows category tabs', async ({ page }) => {
      await startGameAndDismissAdvisor(page);
      const topRow = topRowButtons(page);
      const allText = await topRow.allInnerTexts();
      const combined = allText.join(' ');
      expect(combined).toContain('🏢');
      expect(combined).toContain('🏭');
      expect(combined).toContain('⚡');
      expect(combined).toContain('🏥');
      expect(combined).toContain('🏛️');
      expect(combined).toContain('🎖️');
      expect(combined).toContain('🚂');
    });

    test('toolbar bottom row shows housing buildings by default', async ({ page }) => {
      await startGameAndDismissAdvisor(page);
      const buttons = buildingButtons(page);
      await expect(buttons).toHaveCount(HOUSING_BUILDING_COUNT);
    });

    test('toolbar building buttons have names and icons', async ({ page }) => {
      await startGameAndDismissAdvisor(page);
      const firstBuilding = buildingButtons(page).first();
      await expect(firstBuilding).toBeVisible();
      const text = await firstBuilding.innerText();
      expect(text.length).toBeGreaterThan(0);
    });

    test('quota HUD displays 5-year plan info', async ({ page }) => {
      await startGameAndDismissAdvisor(page);
      const hud = quotaHud(page);
      await expect(hud).toContainText('5-YEAR PLAN');
    });

    test('quota HUD shows quota type and remaining time', async ({ page }) => {
      await startGameAndDismissAdvisor(page);
      const hud = quotaHud(page);
      await expect(hud).toContainText('food');
      await expect(hud).toContainText('remaining');
    });

    test('quota HUD shows progress percentage', async ({ page }) => {
      await startGameAndDismissAdvisor(page);
      const hud = quotaHud(page);
      await expect(hud).toContainText('0%');
    });
  });
});
