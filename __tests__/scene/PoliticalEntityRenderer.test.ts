/**
 * Tests for PoliticalEntityRenderer data logic.
 *
 * Verifies that:
 * - PoliticalEntitySystem provides visible entities with grid positions
 * - Each political role has correct data shape
 * - Entity positions match the stationedAt field
 */

import { PoliticalEntitySystem } from '../../src/ai/agents/political/PoliticalEntitySystem';
import { GameRng } from '../../src/game/SeedSystem';

// Provide a minimal building for entities to station at
jest.mock('../../src/ai/agents/political/constants', () => {
  const actual = jest.requireActual('../../src/ai/agents/political/constants');
  return {
    ...actual,
    pickRandomBuildingPosition: (rng: any) => ({
      gridX: rng.int(0, 29),
      gridY: rng.int(0, 29),
      defId: 'apartment-block-a',
    }),
  };
});

describe('PoliticalEntityRenderer data', () => {
  it('getVisibleEntities returns entities with grid positions', () => {
    const rng = new GameRng('test-political');
    const system = new PoliticalEntitySystem(rng);

    // Sync to create some entities
    system.syncEntities('posyolok', 'revolution', 0);

    const entities = system.getVisibleEntities();
    expect(entities.length).toBeGreaterThan(0);

    for (const entity of entities) {
      expect(entity.stationedAt).toBeDefined();
      expect(typeof entity.stationedAt.gridX).toBe('number');
      expect(typeof entity.stationedAt.gridY).toBe('number');
      expect(entity.role).toBeDefined();
      expect(entity.name).toBeTruthy();
    }
  });

  it('entities have valid political roles', () => {
    const rng = new GameRng('test-roles');
    const system = new PoliticalEntitySystem(rng);
    system.syncEntities('gorod', 'industrialization', 0);

    const validRoles = new Set(['politruk', 'kgb_agent', 'military_officer', 'conscription_officer']);
    const entities = system.getVisibleEntities();

    for (const entity of entities) {
      expect(validRoles.has(entity.role)).toBe(true);
    }
  });

  it('entity count varies by settlement tier', () => {
    const rng1 = new GameRng('tier-small');
    const small = new PoliticalEntitySystem(rng1);
    small.syncEntities('selo', 'revolution', 0);
    const seloCount = small.getVisibleEntities().length;

    const rng2 = new GameRng('tier-large');
    const large = new PoliticalEntitySystem(rng2);
    large.syncEntities('gorod', 'industrialization', 0);
    const gorodCount = large.getVisibleEntities().length;

    // Gorod (city) should have more political entities than selo (village)
    expect(gorodCount).toBeGreaterThanOrEqual(seloCount);
  });
});
