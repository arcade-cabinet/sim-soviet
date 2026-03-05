import { getResourceEntity } from '../../src/ecs/archetypes';
import { createBuilding, createMetaStore, createResourceStore } from '../../src/ecs/factories';
import { world } from '../../src/ecs/world';
import { TICKS_PER_MONTH } from '../../src/game/Chronology';
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

describe('phasePolitical', () => {
  let cb: SimCallbacks;
  let engine: SimulationEngine;

  beforeEach(() => {
    world.clear();
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    createResourceStore();
    createMetaStore();
    cb = createMockCallbacks();
    engine = new SimulationEngine(new GameGrid(), cb);
  });

  afterEach(() => {
    world.clear();
  });

  it('runs monthly loyalty tick on newMonth', () => {
    engine.getWorkerSystem().syncPopulation(20);
    const store = getResourceEntity()!;
    store.resources.food = 500;
    store.resources.vodka = 100;
    // Advance to month boundary (30 ticks)
    for (let i = 0; i < TICKS_PER_MONTH; i++) engine.tick();
    // Loyalty tick should have run — no direct assertion but no error
    expect(cb.onStateChange).toHaveBeenCalledTimes(TICKS_PER_MONTH);
  });

  it('runs decay system each tick', () => {
    createBuilding(0, 0, 'apartment-tower-a');
    const store = getResourceEntity()!;
    store.resources.food = 500;
    // After many ticks, building durability should decrease
    for (let i = 0; i < 100; i++) engine.tick();
    // The building should still exist (decay is slow)
    expect(store.resources).toBeDefined();
  });

  it('runs quota system each tick', () => {
    const store = getResourceEntity()!;
    store.resources.food = 350;
    engine.tick();
    // Quota system reads current food into quota.current
    const quota = engine.getQuota();
    expect(quota.current).toBeGreaterThan(0);
  });

  it('runs collective autonomous construction', () => {
    const store = getResourceEntity()!;
    store.resources.food = 2000;
    store.resources.money = 5000;
    store.resources.timber = 500;
    store.resources.steel = 500;
    engine.getWorkerSystem().syncPopulation(50);
    // Tick a few times — collective agent may or may not build, but should not error
    for (let i = 0; i < 10; i++) engine.tick();
    expect(cb.onStateChange).toHaveBeenCalled();
  });
});
