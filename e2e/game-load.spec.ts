import { test, expect } from '@playwright/test';

test.describe('Game Load', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page loads with correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/SimSoviet/i);
  });

  test('intro modal is visible on load', async ({ page }) => {
    const introModal = page.locator('#intro-modal');
    await expect(introModal).toBeVisible();
  });

  test('intro modal contains ministry briefing text', async ({ page }) => {
    const briefing = page.locator('.dossier');
    await expect(briefing).toContainText('MINISTRY OF PLANNING');
    await expect(briefing).toContainText('Director of Sector 7G');
    await expect(briefing).toContainText('Coal Plants');
    await expect(briefing).toContainText('Potatoes');
    await expect(briefing).toContainText('Vodka');
  });

  test('start button is visible and has correct text', async ({ page }) => {
    const startBtn = page.locator('#start-btn');
    await expect(startBtn).toBeVisible();
    await expect(startBtn).toContainText('I SERVE THE SOVIET UNION');
  });

  test('clicking start button hides the intro modal', async ({ page }) => {
    const introModal = page.locator('#intro-modal');
    const startBtn = page.locator('#start-btn');

    await startBtn.click();

    // The modal fades out over 500ms
    await expect(introModal).toBeHidden({ timeout: 2000 });
  });

  test('canvas element exists on the page', async ({ page }) => {
    const canvas = page.locator('#gameCanvas');
    await expect(canvas).toBeAttached();
  });

  test('canvas is visible after dismissing intro', async ({ page }) => {
    await page.locator('#start-btn').click();
    const canvas = page.locator('#gameCanvas');
    await expect(canvas).toBeVisible();
  });

  test('top bar shows SIMSOVET branding', async ({ page }) => {
    const title = page.locator('h1').first();
    await expect(title).toContainText('SIMSOVET');
  });

  test('HUD elements show initial values after start', async ({ page }) => {
    await page.locator('#start-btn').click();

    // Wait for the UI to update
    await page.waitForTimeout(1500);

    const moneyEl = page.locator('#ui-money');
    const popEl = page.locator('#ui-pop');

    await expect(moneyEl).toBeVisible();
    await expect(popEl).toBeVisible();
  });

  test('advisor appears after clicking start', async ({ page }) => {
    await page.locator('#start-btn').click();

    const advisor = page.locator('#advisor');
    await expect(advisor).toBeVisible({ timeout: 2000 });

    const advisorText = page.locator('#advisor-text');
    await expect(advisorText).toContainText('Coal Plant');
  });

  test('advisor can be dismissed', async ({ page }) => {
    await page.locator('#start-btn').click();

    const advisor = page.locator('#advisor');
    await expect(advisor).toBeVisible({ timeout: 2000 });

    const dismissBtn = page.locator('#dismiss-advisor');
    await dismissBtn.click();

    await expect(advisor).toBeHidden();
  });

  test('toolbar contains building buttons', async ({ page }) => {
    const toolbar = page.locator('#toolbar');
    const buttons = toolbar.locator('button');

    // Should have buttons for: none, road, power, housing, farm, distillery, gulag, bulldoze
    await expect(buttons).toHaveCount(8);
  });

  test('quota HUD displays 5-year plan info', async ({ page }) => {
    const quotaBox = page.locator('.quota-box');
    await expect(quotaBox).toContainText('5-YEAR PLAN');
    await expect(quotaBox).toContainText('GOAL');
    await expect(quotaBox).toContainText('TIME LEFT');
  });
});
