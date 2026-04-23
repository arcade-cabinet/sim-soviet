/**
 * @fileoverview Tests for the sequential tutorial directive array.
 *
 * P1F-2: Verifies that the first directive is agriculture (farm), not housing,
 * so the DirectiveHUD opening instruction aligns with Krupnik's opening toast
 * ("Build a farm — your people will need food before they need anything else.").
 */

// Mock ECS archetypes (not needed for ordering tests)
jest.mock('@/ecs/archetypes', () => ({
  buildingsLogic: { entities: [] },
  operationalBuildings: { entities: [] },
  getResourceEntity: () => null,
}));

// Mock buildingDefs (not needed for ordering tests)
jest.mock('@/data/buildingDefs', () => ({
  getBuildingDef: () => null,
}));

// Mock GameState (used by countGridCellType)
jest.mock('@/engine/GameState', () => ({
  gameState: { grid: [] },
}));

import { DIRECTIVES } from '@/engine/Directives';

describe('DIRECTIVES ordering', () => {
  it('has at least 2 directives', () => {
    expect(DIRECTIVES.length).toBeGreaterThanOrEqual(2);
  });

  it('first directive is agriculture (farm), not housing — P1F-2', () => {
    const first = DIRECTIVES[0];
    expect(first.text.toLowerCase()).toContain('agriculture');
    expect(first.text.toLowerCase()).not.toContain('housing');
    expect(first.text.toLowerCase()).not.toContain('residential');
  });

  it('second directive is housing, not agriculture — P1F-2', () => {
    const second = DIRECTIVES[1];
    expect(second.text.toLowerCase()).toContain('housing');
  });

  it('every directive has a non-empty text and a positive reward (except the sentinel)', () => {
    // The last entry is a sentinel "Awaiting Further Orders..." with reward 0
    const nonSentinel = DIRECTIVES.filter((d) => d.reward > 0);
    for (const d of nonSentinel) {
      expect(d.text.length).toBeGreaterThan(0);
      expect(d.reward).toBeGreaterThan(0);
      expect(d.target).toBeGreaterThan(0);
    }
  });

  it('all directives have a check function', () => {
    for (const d of DIRECTIVES) {
      expect(typeof d.check).toBe('function');
    }
  });
});
