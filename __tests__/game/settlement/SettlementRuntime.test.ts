import {
  createSettlementRuntime,
  serializeRuntime,
  restoreRuntime,
  type SettlementRuntime,
} from '../../../src/game/settlement/SettlementRuntime';
import { GameGrid } from '../../../src/game/GameGrid';
import { GameRng } from '../../../src/game/SeedSystem';
import type { Settlement } from '../../../src/game/relocation/Settlement';

const EARTH_SETTLEMENT: Settlement = {
  id: 'primary',
  name: 'Settlement',
  gridSize: 20,
  terrain: {
    gravity: 1.0,
    atmosphere: 'breathable',
    water: 'rivers',
    farming: 'soil',
    construction: 'standard',
    baseSurvivalCost: 'low',
  },
  population: 50,
  distance: 0,
  celestialBody: 'earth',
  foundedYear: 1917,
  isActive: true,
};

describe('SettlementRuntime', () => {
  it('creates a runtime with per-settlement grid and pressure', () => {
    const rng = new GameRng('test-seed');
    const runtime = createSettlementRuntime(EARTH_SETTLEMENT, rng);

    expect(runtime.settlement.id).toBe('primary');
    expect(runtime.grid).toBeInstanceOf(GameGrid);
    expect(runtime.grid.getSize()).toBe(20);
    expect(runtime.pressureSystem).toBeDefined();
    expect(runtime.populationMode).toBe('entity');
    expect(runtime.resources).toBeDefined();
    expect(runtime.resources.food).toBe(0);
    expect(runtime.buildingCount).toBe(0);
    expect(runtime.housingCapacity).toBe(0);
  });

  it('creates separate runtimes with independent pressure state', () => {
    const rng = new GameRng('test-seed');
    const runtimeA = createSettlementRuntime(EARTH_SETTLEMENT, rng);
    const runtimeB = createSettlementRuntime(
      { ...EARTH_SETTLEMENT, id: 'settlement-1', name: 'Mars Colony', isActive: false },
      rng,
    );

    runtimeA.pressureSystem.applySpike('food', 0.5);
    expect(runtimeA.pressureSystem.getLevel('food')).toBe(0.5);
    expect(runtimeB.pressureSystem.getLevel('food')).toBe(0);
  });

  it('creates grid with correct size from settlement', () => {
    const rng = new GameRng('test-seed');
    const small = createSettlementRuntime(
      { ...EARTH_SETTLEMENT, gridSize: 11 },
      rng,
    );
    expect(small.grid.getSize()).toBe(11);
  });
});

describe('SettlementRuntime serialization', () => {
  it('round-trips through serialize/restore', () => {
    const rng = new GameRng('test-seed');
    const runtime = createSettlementRuntime(EARTH_SETTLEMENT, rng);
    runtime.resources.food = 5000;
    runtime.resources.population = 100;
    runtime.populationMode = 'aggregate';
    runtime.buildingCount = 15;
    runtime.housingCapacity = 200;
    runtime.pressureSystem.applySpike('food', 0.7);

    const saved = serializeRuntime(runtime);
    expect(saved.settlementId).toBe('primary');
    expect(saved.resources.food).toBe(5000);
    expect(saved.populationMode).toBe('aggregate');

    const restored = restoreRuntime(saved, EARTH_SETTLEMENT, rng);
    expect(restored.resources.food).toBe(5000);
    expect(restored.resources.population).toBe(100);
    expect(restored.populationMode).toBe('aggregate');
    expect(restored.buildingCount).toBe(15);
    expect(restored.housingCapacity).toBe(200);
    expect(restored.pressureSystem.getLevel('food')).toBeCloseTo(0.7, 1);
  });

  it('serialized data does not share references with original', () => {
    const rng = new GameRng('test-seed');
    const runtime = createSettlementRuntime(EARTH_SETTLEMENT, rng);
    runtime.resources.food = 1000;

    const saved = serializeRuntime(runtime);
    runtime.resources.food = 9999;

    expect(saved.resources.food).toBe(1000);
  });
});
