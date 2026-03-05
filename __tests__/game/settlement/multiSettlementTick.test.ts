import { world } from '../../../src/ecs/world';
import {
  advanceTicks,
  buildBasicSettlement,
  createPlaythroughEngine,
  getResources,
  isGameOver,
} from '../../playthrough/helpers';

describe('Multi-settlement tick loop', () => {
  afterEach(() => {
    world.clear();
    jest.restoreAllMocks();
  });

  it('engine creates primary SettlementRuntime on construction', () => {
    const { engine } = createPlaythroughEngine({
      resources: { food: 5000, money: 10000, population: 50, power: 100 },
      seed: 'multi-settlement',
    });
    buildBasicSettlement();

    const runtimes = engine.getSettlementRuntimes();
    expect(runtimes.length).toBe(1);
    expect(runtimes[0].settlement.id).toBe('primary');
  });

  it('ticks background settlements alongside active', () => {
    const { engine } = createPlaythroughEngine({
      resources: { food: 5000, money: 10000, population: 50, power: 100 },
      seed: 'multi-settlement-bg',
    });
    buildBasicSettlement();

    // Add a secondary settlement via relocation engine
    engine.getRelocationEngine().getRegistry().addSettlement(
      'Mars Colony',
      {
        gravity: 0.38,
        atmosphere: 'thin_co2',
        water: 'none',
        farming: 'hydroponics',
        construction: 'dome_required',
        baseSurvivalCost: 'extreme',
      },
      'mars',
      225_000_000,
      2025,
    );

    // Sync runtimes to match registry
    engine.syncSettlementRuntimes();

    const runtimes = engine.getSettlementRuntimes();
    expect(runtimes.length).toBe(2);

    // Give background settlement resources
    runtimes[1].resources.population = 50;
    runtimes[1].resources.food = 5000;
    runtimes[1].housingCapacity = 100;

    // Tick 10 times — both should tick
    advanceTicks(engine, 10);

    // Background settlement should have consumed food
    expect(runtimes[1].resources.food).toBeLessThan(5000);
  });

  it('serializes and restores SettlementRuntimes', () => {
    const { engine } = createPlaythroughEngine({
      resources: { food: 5000, money: 10000, population: 50, power: 100 },
      seed: 'multi-settle-save',
    });
    buildBasicSettlement();

    // Add secondary settlement
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
    runtimes[1].resources.population = 30;
    runtimes[1].resources.food = 2000;
    runtimes[1].pressureSystem.applySpike('food', 0.3);

    // Serialize
    const saved = engine.serializeSubsystems();
    expect(saved.settlementRuntimes).toBeDefined();
    expect(saved.settlementRuntimes!.length).toBe(2);

    // Restore into fresh engine
    const { engine: restored } = createPlaythroughEngine({
      resources: { food: 5000, money: 10000, population: 50, power: 100 },
      seed: 'multi-settle-save',
    });
    buildBasicSettlement();
    restored.restoreSubsystems(saved);

    const restoredRuntimes = restored.getSettlementRuntimes();
    expect(restoredRuntimes.length).toBe(2);
    expect(restoredRuntimes[1].resources.population).toBe(30);
    expect(restoredRuntimes[1].resources.food).toBe(2000);
    expect(restoredRuntimes[1].pressureSystem.getLevel('food')).toBeCloseTo(0.3, 1);
  });

  it('syncSettlementRuntimes does not duplicate existing runtimes', () => {
    const { engine } = createPlaythroughEngine({
      resources: { food: 5000, money: 10000, population: 50, power: 100 },
      seed: 'multi-settle-dedup',
    });
    buildBasicSettlement();

    engine.syncSettlementRuntimes();
    engine.syncSettlementRuntimes();
    expect(engine.getSettlementRuntimes().length).toBe(1);

    engine.getRelocationEngine().getRegistry().addSettlement(
      'Colony 2',
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
    expect(engine.getSettlementRuntimes().length).toBe(2);

    // Calling again should not add duplicates
    engine.syncSettlementRuntimes();
    expect(engine.getSettlementRuntimes().length).toBe(2);
  });
});
