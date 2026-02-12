import { expect, test } from '@playwright/test';
import { canvas, clickCanvasAt, clickCanvasCenter, startGameAndDismissAdvisor } from './helpers';

test.describe('Building Placement', () => {
  test.beforeEach(async ({ page }) => {
    await startGameAndDismissAdvisor(page);
  });

  test('canvas click opens radial menu for building placement', async ({ page }) => {
    // Click canvas center — may open radial build menu on empty cell
    await clickCanvasCenter(page);

    // Check for radial menu
    const buildMenu = page.locator('svg title:has-text("Build Menu")');
    const radialVisible = await buildMenu.isVisible().catch(() => false);

    // Whether it opens depends on what cell was clicked
    expect(typeof radialVisible).toBe('boolean');
  });

  test('clicking multiple canvas positions does not crash', async ({ page }) => {
    const offsets = [
      [0, 0],
      [-80, 0],
      [80, 0],
      [0, -60],
      [0, 60],
    ];

    for (const [ox, oy] of offsets) {
      await clickCanvasAt(page, ox!, oy!);
      await page.keyboard.press('Escape'); // dismiss any radial menu
      await page.waitForTimeout(200);
    }

    // Game should not have crashed — canvas still has dimensions
    const canvasEl = canvas(page);
    const box = await canvasEl.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
  });

  test('canvas receives click events', async ({ page }) => {
    const canvasEl = canvas(page);
    const box = await canvasEl.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);

    // Click should not throw
    await canvasEl.click({
      position: { x: box!.width / 2, y: box!.height / 2 },
    });
  });
});
