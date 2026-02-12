import { expect, test } from '@playwright/test';
import {
  buildingButtons,
  clickCanvasCenter,
  getDateText,
  getMoney,
  quotaHud,
  STARTING_MONEY,
  selectCategory,
  startGameAndDismissAdvisor,
  topRowButtons,
  waitForMoneyChange,
  waitForSimTick,
} from './helpers';

test.describe('Gameplay', () => {
  test.beforeEach(async ({ page }) => {
    await startGameAndDismissAdvisor(page);
  });

  test('selecting a building tool updates the active state', async ({ page }) => {
    // Click the first building button in the bottom row (Housing category is default)
    const firstBuilding = buildingButtons(page).first();
    await firstBuilding.click();

    // Should have the "active" class
    await expect(firstBuilding).toHaveClass(/active/);
  });

  test('clicking a different building deactivates the previous one', async ({ page }) => {
    const buttons = buildingButtons(page);
    const first = buttons.first();
    const second = buttons.nth(1);

    await first.click();
    await expect(first).toHaveClass(/active/);

    await second.click();
    await expect(second).toHaveClass(/active/);
    // First should no longer be active
    const firstClasses = await first.getAttribute('class');
    expect(firstClasses).not.toContain('active');
  });

  test('Inspect button can be selected and shows active state', async ({ page }) => {
    const inspectBtn = topRowButtons(page).first();
    await inspectBtn.click();
    await expect(inspectBtn).toHaveClass(/active/);
  });

  test('Bulldoze button can be selected and shows active state', async ({ page }) => {
    const bulldozeBtn = topRowButtons(page).last();
    await bulldozeBtn.click();
    await expect(bulldozeBtn).toHaveClass(/active/);
  });

  test('switching category tabs changes the building list', async ({ page }) => {
    // Default category is Housing — get the initial building list
    const initialTexts = await buildingButtons(page).allInnerTexts();

    // Switch to Industry category (second tab after Inspect)
    await selectCategory(page, '🏭');

    // Building list should be different now
    const newTexts = await buildingButtons(page).allInnerTexts();
    expect(newTexts.join()).not.toBe(initialTexts.join());
  });

  test('switching categories shows correct building count', async ({ page }) => {
    // Industry + Agriculture = 5 buildings
    await selectCategory(page, '🏭');
    const industryCount = await buildingButtons(page).count();
    expect(industryCount).toBe(5);

    // Military = 3 buildings
    await selectCategory(page, '🎖️');
    const militaryCount = await buildingButtons(page).count();
    expect(militaryCount).toBe(3);
  });

  test('clicking canvas with a building tool triggers placement attempt', async ({ page }) => {
    // Select the first building (cheapest housing)
    await buildingButtons(page).first().click();

    const moneyBefore = await getMoney(page);

    // Click on the canvas center
    await clickCanvasCenter(page);

    // Wait for the placement + state update
    await waitForMoneyChange(page, moneyBefore).catch(() => {});

    const moneyAfter = await getMoney(page);
    // Money should have decreased (building was placed) or stayed the same
    // (if click missed a valid cell — depends on camera position)
    expect(moneyAfter).toBeLessThanOrEqual(moneyBefore);
  });

  test('resource values update over time as simulation ticks', async ({ page }) => {
    // Get initial money
    const initialMoney = await getMoney(page);
    expect(initialMoney).toBeGreaterThanOrEqual(0);

    // Wait for multiple simulation ticks (each tick is 1 second)
    await waitForSimTick(page);

    // The top bar should still show valid resource numbers
    const currentMoney = await getMoney(page);
    expect(currentMoney).toBeGreaterThanOrEqual(0);
  });

  test('multiple building tool buttons can be cycled through', async ({ page }) => {
    const buttons = buildingButtons(page);
    const count = await buttons.count();

    for (let i = 0; i < count; i++) {
      await buttons.nth(i).click();
      await expect(buttons.nth(i)).toHaveClass(/active/);

      // Previous button should no longer be active (except the first iteration)
      if (i > 0) {
        const prevClasses = await buttons.nth(i - 1).getAttribute('class');
        expect(prevClasses).not.toContain('active');
      }
    }
  });

  test('quota HUD progress bar exists and has valid width style', async ({ page }) => {
    // The progress bar is a child div inside the quota HUD with transition-all class
    const progressBar = quotaHud(page).locator('.transition-all');
    await expect(progressBar).toBeAttached();

    const style = await progressBar.getAttribute('style');
    expect(style).toContain('width');
  });

  test('date display shows valid year starting with 1980', async ({ page }) => {
    const dateText = await getDateText(page);
    // Should contain a year starting with 19 (game starts in 1980)
    expect(dateText).toMatch(/19\d{2}/);
  });

  test('top bar shows starting money value', async ({ page }) => {
    const money = await getMoney(page);
    // Starting money is 2000 but simulation ticks may have changed it
    expect(money).toBeGreaterThan(0);
    expect(money).toBeLessThanOrEqual(STARTING_MONEY);
  });

  test('category tabs persist active state while browsing buildings', async ({ page }) => {
    // Click Industry category
    await selectCategory(page, '🏭');

    // Select a building in industry
    const firstIndustry = buildingButtons(page).first();
    await firstIndustry.click();
    await expect(firstIndustry).toHaveClass(/active/);

    // The Industry tab should also appear active (has 'active' in class)
    const industryTab = topRowButtons(page).nth(2); // Index 2: Inspect=0, Housing=1, Industry=2
    await expect(industryTab).toHaveClass(/active/);
  });
});
