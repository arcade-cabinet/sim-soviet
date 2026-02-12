import { expect, test } from '@playwright/test';
import {
  advisorDismissBtn,
  advisorPanel,
  canvas,
  dossier,
  landingPage,
  sovietHud,
  startButton,
  startGame,
  startGameAndDismissAdvisor,
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

    test('React root container exists', async ({ page }) => {
      await expect(page.locator('#root')).toBeAttached();
    });
  });

  test.describe('Game UI After Start', () => {
    test('canvas is visible after starting game', async ({ page }) => {
      await startGame(page);
      await expect(canvas(page)).toBeVisible();
    });

    test('SovietHUD displays resource chips', async ({ page }) => {
      await startGameAndDismissAdvisor(page);
      const hud = sovietHud(page);
      // SovietHUD shows: Workers (👷), Food (🌾), Vodka (🍾), Power (⚡), Blat (🤝)
      await expect(hud).toContainText('👷');
      await expect(hud).toContainText('🌾');
      await expect(hud).toContainText('🍾');
      await expect(hud).toContainText('⚡');
      await expect(hud).toContainText('🤝');
    });

    test('SovietHUD displays settlement name and date', async ({ page }) => {
      await startGameAndDismissAdvisor(page);
      const hud = sovietHud(page);
      // Date is in font-mono format: "MonthName YYYY"
      const dateEl = hud.locator('.font-mono').first();
      const dateText = await dateEl.innerText();
      expect(dateText).toMatch(/\d{4}/);
    });

    test('SovietHUD contains a pause button', async ({ page }) => {
      await startGameAndDismissAdvisor(page);
      const btn = page.locator('header').getByRole('button', { name: /Pause|Resume/ });
      await expect(btn).toBeVisible();
    });

    test('SovietHUD contains speed controls', async ({ page }) => {
      await startGameAndDismissAdvisor(page);
      const hud = sovietHud(page);
      await expect(hud.getByRole('button', { name: 'Speed 1x' })).toBeVisible();
      await expect(hud.getByRole('button', { name: 'Speed 2x' })).toBeVisible();
      await expect(hud.getByRole('button', { name: 'Speed 3x' })).toBeVisible();
    });

    test('advisor appears after starting game', async ({ page }) => {
      await startGame(page);
      const advisor = advisorPanel(page);
      await expect(advisor).toBeVisible({ timeout: 3000 });
      await expect(advisor).toContainText('Krupnik');
    });

    test('advisor can be dismissed', async ({ page }) => {
      await startGame(page);
      const advisor = advisorPanel(page);
      await expect(advisor).toBeVisible({ timeout: 3000 });
      await advisorDismissBtn(page).click();
      await expect(advisor).toBeHidden();
    });

    test('canvas has expected dimensions after start', async ({ page }) => {
      await startGameAndDismissAdvisor(page);
      const canvasEl = canvas(page);
      const box = await canvasEl.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThan(100);
      expect(box!.height).toBeGreaterThan(100);
    });
  });
});
