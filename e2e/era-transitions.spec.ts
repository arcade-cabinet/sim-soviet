/**
 * E2E tests for era system and time progression.
 *
 * Verifies that the era label displays correctly, time advances
 * properly, and the era system is functional in the UI.
 */
import { expect, test } from '@playwright/test';
import { advanceGameTime, getDateText, getEraText, startGameAndDismiss } from './helpers';

const VALID_ERAS = [
  'REVOLUTION',
  'COLLECTIVIZATION',
  'INDUSTRIALIZATION',
  'GREAT PATRIOTIC WAR',
  'RECONSTRUCTION',
  'THAW & FREEZE',
  'ERA OF STAGNATION',
  'THE ETERNAL SOVIET',
];

test.describe('Era System', () => {
  // Each test loads a full game (55 GLB models) — CI runners need extra time
  test.slow();

  test('starting era is REVOLUTION', async ({ page }) => {
    await startGameAndDismiss(page);

    const era = await getEraText(page);
    // Default new game starts in the Revolution era
    expect(era).toBe('REVOLUTION');
  });

  test('era label remains valid after advancing time', async ({ page }) => {
    await startGameAndDismiss(page);

    await advanceGameTime(page, 3);

    const era = await getEraText(page);
    // Era should still be a valid era name
    expect(VALID_ERAS).toContain(era);
  });

  test('date and era are consistent after multiple ticks', async ({ page }) => {
    await startGameAndDismiss(page);

    const initialDate = await getDateText(page);
    const initialEra = await getEraText(page);

    await advanceGameTime(page, 5);

    const laterDate = await getDateText(page);
    const laterEra = await getEraText(page);

    // Date should have changed
    expect(laterDate).not.toBe(initialDate);
    // Era should still be valid
    expect(VALID_ERAS).toContain(laterEra);
    // In the starting ticks, era should still be REVOLUTION
    // (era transition requires years of game time)
    expect(laterEra).toBe(initialEra);
  });
});
