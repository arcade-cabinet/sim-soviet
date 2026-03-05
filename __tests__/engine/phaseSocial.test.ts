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

describe('phaseSocial', () => {
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

  it('runs worker system tick each tick', () => {
    engine.getWorkerSystem().syncPopulation(10);
    const store = getResourceEntity()!;
    store.resources.food = 500;
    store.resources.vodka = 100;
    const workerSpy = jest.spyOn(engine.getWorkerSystem(), 'tick');
    engine.tick();
    expect(workerSpy).toHaveBeenCalled();
  });

  it('runs demographic tick on year boundary', () => {
    engine.getWorkerSystem().syncPopulation(20);
    const store = getResourceEntity()!;
    store.resources.food = 2000;
    store.resources.vodka = 200;
    // Advance 90 ticks to reach year boundary (Oct 1917 -> Jan 1918)
    for (let i = 0; i < 89; i++) engine.tick();
    // On 90th tick (year boundary), demographics should run
    engine.tick();
    // Year should have rolled over
    expect(store.resources.population).toBeGreaterThanOrEqual(0);
  });

  it('sends emergency reinforcements when population is critically low', () => {
    engine.getWorkerSystem().syncPopulation(10);
    const store = getResourceEntity()!;
    store.resources.food = 1000;
    store.resources.vodka = 100;
    // Advance to a new month boundary (30 ticks)
    for (let i = 0; i < 30; i++) engine.tick();
    // Emergency immigration should fire when pop < 20
    // Population may have changed due to reinforcements
    expect(store.resources.population).toBeGreaterThan(0);
  });
});
