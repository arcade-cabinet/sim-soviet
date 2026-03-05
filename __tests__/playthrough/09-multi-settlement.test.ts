import { world } from '../../src/ecs/world';
import {
  advanceTicks,
  buildBasicSettlement,
  createPlaythroughEngine,
  getResources,
  isGameOver,
  TICKS_PER_MONTH,
} from './helpers';

describe('Playthrough: Multi-Settlement', () => {
  afterEach(() => {
    world.clear();
    jest.restoreAllMocks();
  });

  it('dual-settlement tick: both settlements evolve independently', () => {
    const { engine } = createPlaythroughEngine({
      resources: { food: 99999, money: 99999, population: 100, power: 500 },
      seed: 'multi-settle-dual',
    });
    buildBasicSettlement({ housing: 5, farms: 5, power: 3 });

    // Add secondary settlement
    engine.getRelocationEngine().getRegistry().addSettlement(
      'Siberian Camp',
      {
        gravity: 1.0,
        atmosphere: 'breathable',
        water: 'rivers',
        farming: 'soil',
        construction: 'standard',
        baseSurvivalCost: 'medium',
      },
      'earth',
      3000,
      1930,
    );
    engine.syncSettlementRuntimes();

    const runtimes = engine.getSettlementRuntimes();
    expect(runtimes.length).toBe(2);

    // Seed background settlement with resources
    runtimes[1].resources.population = 50;
    runtimes[1].resources.food = 5000;
    runtimes[1].housingCapacity = 100;
    runtimes[1].buildingCount = 5;

    // Maintain active settlement resources to prevent game-over
    for (let i = 0; i < 60; i++) {
      const res = getResources();
      res.food = Math.max(res.food, 50000);
      res.money = Math.max(res.money, 50000);
      res.population = Math.max(res.population, 50);
      engine.tick();
    }

    expect(isGameOver()).toBe(false);

    // Background settlement should have consumed some food
    expect(runtimes[1].resources.food).toBeLessThan(5000);
    // Background settlement population should still be alive
    expect(runtimes[1].resources.population).toBeGreaterThan(0);
  });

  it('cross-settlement save/load preserves all runtimes', () => {
    const { engine } = createPlaythroughEngine({
      resources: { food: 99999, money: 99999, population: 50, power: 100 },
      seed: 'multi-save-load',
    });
    buildBasicSettlement();

    engine.getRelocationEngine().getRegistry().addSettlement(
      'Lunar Base',
      {
        gravity: 0.16,
        atmosphere: 'none',
        water: 'none',
        farming: 'hydroponics',
        construction: 'dome_required',
        baseSurvivalCost: 'extreme',
      },
      'moon',
      384_400,
      1970,
    );
    engine.syncSettlementRuntimes();

    const runtimes = engine.getSettlementRuntimes();
    runtimes[1].resources.population = 25;
    runtimes[1].resources.food = 1000;
    runtimes[1].pressureSystem.applySpike('food', 0.4);

    advanceTicks(engine, 10);

    // Serialize
    const saved = engine.serializeSubsystems();

    // Restore
    const { engine: restored } = createPlaythroughEngine({
      resources: { food: 99999, money: 99999, population: 50, power: 100 },
      seed: 'multi-save-load',
    });
    buildBasicSettlement();
    restored.restoreSubsystems(saved);

    const restoredRuntimes = restored.getSettlementRuntimes();
    expect(restoredRuntimes.length).toBe(2);
    expect(restoredRuntimes[1].settlement.name).toBe('Lunar Base');
    expect(restoredRuntimes[1].resources.population).toBe(runtimes[1].resources.population);
    expect(restoredRuntimes[1].pressureSystem.getLevel('food')).toBeGreaterThan(0);

    // Should continue ticking after restore
    expect(() => advanceTicks(restored, 10)).not.toThrow();
  });

  it('independent pressure: crisis in one settlement does not affect another', () => {
    const { engine } = createPlaythroughEngine({
      resources: { food: 99999, money: 99999, population: 100, power: 500 },
      seed: 'multi-pressure',
    });
    buildBasicSettlement({ housing: 5, farms: 5, power: 3 });

    engine.getRelocationEngine().getRegistry().addSettlement(
      'Starving Camp',
      {
        gravity: 1.0,
        atmosphere: 'breathable',
        water: 'rivers',
        farming: 'soil',
        construction: 'standard',
        baseSurvivalCost: 'low',
      },
      'earth',
      2000,
      1935,
    );
    engine.syncSettlementRuntimes();

    const runtimes = engine.getSettlementRuntimes();

    // Background settlement: no food -> pressure should rise
    runtimes[1].resources.population = 100;
    runtimes[1].resources.food = 0;
    runtimes[1].housingCapacity = 200;

    for (let i = 0; i < 30; i++) {
      const res = getResources();
      res.food = Math.max(res.food, 50000);
      res.money = Math.max(res.money, 50000);
      engine.tick();
    }

    // Background settlement should have high food pressure
    expect(runtimes[1].pressureSystem.getLevel('food')).toBeGreaterThan(0.1);

    // The two settlements should have independent pressure
    const primaryPressure = runtimes[0].pressureSystem.getLevel('food');
    const bgPressure = runtimes[1].pressureSystem.getLevel('food');
    // Background settlement with no food should have higher food pressure
    expect(bgPressure).toBeGreaterThan(primaryPressure);
  });

  it('background settlement population starves without food', () => {
    const { engine } = createPlaythroughEngine({
      resources: { food: 99999, money: 99999, population: 50, power: 100 },
      seed: 'bg-starvation',
    });
    buildBasicSettlement();

    engine.getRelocationEngine().getRegistry().addSettlement(
      'Doomed Camp',
      {
        gravity: 1.0,
        atmosphere: 'breathable',
        water: 'rivers',
        farming: 'soil',
        construction: 'standard',
        baseSurvivalCost: 'low',
      },
      'earth',
      1000,
      1930,
    );
    engine.syncSettlementRuntimes();

    const runtimes = engine.getSettlementRuntimes();
    runtimes[1].resources.population = 100;
    runtimes[1].resources.food = 0; // No food at all
    runtimes[1].housingCapacity = 200;

    // Tick many times — population should decline
    for (let i = 0; i < 200; i++) {
      const res = getResources();
      res.food = Math.max(res.food, 50000);
      res.money = Math.max(res.money, 50000);
      engine.tick();
    }

    expect(runtimes[1].resources.population).toBeLessThan(100);
  });
});
