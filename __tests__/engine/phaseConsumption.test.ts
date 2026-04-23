import { getResourceEntity } from '../../src/ecs/archetypes';
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

describe('phaseConsumption', () => {
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

  it('consumes food based on population', () => {
    const store = getResourceEntity()!;
    store.resources.population = 15;
    store.resources.food = 100;
    engine.tick();
    // Food should decrease from consumption
    expect(getResourceEntity()!.resources.food).toBeLessThan(100);
  });

  it('consumes zero food when population is zero', () => {
    const store = getResourceEntity()!;
    store.resources.population = 0;
    store.resources.food = 100;
    engine.tick();
    // No consumption, only minor spoilage from storage system
    expect(getResourceEntity()!.resources.food).toBeGreaterThan(99);
    expect(getResourceEntity()!.resources.food).toBeLessThanOrEqual(100);
  });

  it('activates foraging when food is critically low', () => {
    const store = getResourceEntity()!;
    engine.getWorkerSystem().syncPopulation(50);
    store.resources.food = 0;
    store.resources.vodka = 100;
    // Tick several times with zero food to trigger foraging
    for (let i = 0; i < 10; i++) {
      store.resources.food = 0;
      engine.tick();
    }
    // Foraging system should have either gathered some food or fired cannibalism
    // Either way, the system ran without error
    expect(cb.onToast).toHaveBeenCalled();
  });

  it('runs storage agent tick (spoilage)', () => {
    const store = getResourceEntity()!;
    store.resources.food = 1000;
    store.resources.population = 0;
    engine.tick();
    // Storage system applies spoilage to overflow food
    expect(getResourceEntity()!.resources.food).toBeLessThan(1000);
  });
});
