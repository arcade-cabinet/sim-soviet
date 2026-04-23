import { getMetaEntity, getResourceEntity } from '../../src/ecs/archetypes';
import { createMetaStore, createResourceStore } from '../../src/ecs/factories';
import { world } from '../../src/ecs/world';
import { GameGrid } from '../../src/game/GameGrid';
import type { SimCallbacks } from '../../src/game/SimulationEngine';
import { SimulationEngine } from '../../src/game/SimulationEngine';

function createMockCallbacks(): SimCallbacks {
  return {
    onToast: jest.fn(),
    onAdvisor: jest.fn(),
    onPravda: jest.fn(),
    onStateChange: jest.fn(),
  };
}

describe('tickContext (buildTickContext)', () => {
  let engine: SimulationEngine;

  beforeEach(() => {
    world.clear();
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    createResourceStore();
    createMetaStore();
    engine = new SimulationEngine(new GameGrid(), createMockCallbacks());
  });

  afterEach(() => {
    world.clear();
  });

  it('populates meta entity with chronology data after tick', () => {
    engine.tick();
    const meta = getMetaEntity()!;
    expect(meta.gameMeta.date.year).toBe(1917);
    expect(meta.gameMeta.date.month).toBe(10);
    expect(meta.gameMeta.date.tick).toBe(8); // HOURS_PER_TICK = 8
  });

  it('starts in entity mode (population < 200)', () => {
    const store = getResourceEntity()!;
    expect(store.resources.population).toBeLessThan(200);
    engine.tick();
    // No raion means entity mode — verify no aggregate-mode toast
    expect(store.resources.raion).toBeUndefined();
  });

  it('computes modifiers after chronology phase', () => {
    // After a tick, meta should be populated with quota and era data —
    // these are downstream effects of modifiers being computed
    engine.tick();
    const meta = getMetaEntity()!;
    expect(meta.gameMeta.currentEra).toBe('revolution');
    expect(meta.gameMeta.quota.type).toBe('food');
  });

  it('uses default difficulty preset when no governor is set', () => {
    engine.tick();
    // Without governor, diffConfig should be the comrade difficulty preset
    // which sets quota target to 400 (default 400 * 1.0)
    const meta = getMetaEntity()!;
    expect(meta.gameMeta.quota.target).toBe(400);
  });
});
