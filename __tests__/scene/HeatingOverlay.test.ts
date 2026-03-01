/**
 * Tests for HeatingOverlay data logic.
 *
 * Verifies that:
 * - Heating state is accessible from the EconomySystem
 * - Cold seasons are correctly identified
 * - Heating failing state produces correct visual indicators
 * - Non-cold seasons don't trigger heating overlay
 */

import { EconomySystem } from '../../src/game/economy';

/** Mirrors the isColdSeason logic from HeatingOverlay.tsx. */
function isColdSeason(season: string): boolean {
  return season === 'winter' || season === 'autumn';
}

describe('HeatingOverlay data', () => {
  it('winter is a cold season', () => {
    expect(isColdSeason('winter')).toBe(true);
  });

  it('autumn is a cold season', () => {
    expect(isColdSeason('autumn')).toBe(true);
  });

  it('spring is not a cold season', () => {
    expect(isColdSeason('spring')).toBe(false);
  });

  it('summer is not a cold season', () => {
    expect(isColdSeason('summer')).toBe(false);
  });

  it('heating state defaults to pechka tier', () => {
    const sys = new EconomySystem('revolution', 'comrade');
    const heating = sys.getHeating();
    expect(heating.tier).toBe('pechka');
    expect(heating.failing).toBe(false);
  });

  it('heating fails in winter without resources', () => {
    const sys = new EconomySystem('revolution', 'comrade');
    // Process winter month without heating resource
    sys.processHeating(50, 1, false); // January, no fuel
    const heating = sys.getHeating();
    expect(heating.failing).toBe(true);
  });

  it('heating is operational in winter with resources', () => {
    const sys = new EconomySystem('revolution', 'comrade');
    sys.processHeating(50, 12, true); // December, has fuel
    const heating = sys.getHeating();
    expect(heating.failing).toBe(false);
  });

  it('heating does not fail in summer regardless of resources', () => {
    const sys = new EconomySystem('revolution', 'comrade');
    sys.processHeating(50, 7, false); // July, no fuel
    const heating = sys.getHeating();
    expect(heating.failing).toBe(false);
  });
});
