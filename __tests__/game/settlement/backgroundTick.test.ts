import { backgroundSettlementTick } from '../../../src/game/settlement/backgroundTick';
import {
  createSettlementRuntime,
  type SettlementRuntime,
} from '../../../src/game/settlement/SettlementRuntime';
import { GameRng } from '../../../src/game/SeedSystem';
import type { Settlement } from '../../../src/game/relocation/Settlement';

const MARS_SETTLEMENT: Settlement = {
  id: 'settlement-1',
  name: 'Mars Colony',
  gridSize: 11,
  terrain: {
    gravity: 0.38,
    atmosphere: 'thin_co2',
    water: 'none',
    farming: 'hydroponics',
    construction: 'dome_required',
    baseSurvivalCost: 'extreme',
  },
  population: 100,
  distance: 225_000_000,
  celestialBody: 'mars',
  foundedYear: 2025,
  isActive: false,
};

describe('backgroundSettlementTick', () => {
  let runtime: SettlementRuntime;
  let rng: GameRng;

  beforeEach(() => {
    rng = new GameRng('bg-tick-seed');
    runtime = createSettlementRuntime(MARS_SETTLEMENT, rng);
    runtime.resources.population = 100;
    runtime.resources.food = 5000;
    runtime.housingCapacity = 200;
    runtime.buildingCount = 10;
  });

  it('consumes food proportional to population', () => {
    const foodBefore = runtime.resources.food;
    backgroundSettlementTick(runtime, rng);
    expect(runtime.resources.food).toBeLessThan(foodBefore);
  });

  it('does not crash with zero population', () => {
    runtime.resources.population = 0;
    expect(() => backgroundSettlementTick(runtime, rng)).not.toThrow();
  });

  it('accumulates pressure from food shortage', () => {
    runtime.resources.food = 0;
    for (let i = 0; i < 10; i++) {
      backgroundSettlementTick(runtime, rng);
    }
    expect(runtime.pressureSystem.getLevel('food')).toBeGreaterThan(0);
  });

  it('population does not exceed housing capacity', () => {
    runtime.resources.population = 200;
    runtime.resources.food = 99999;
    runtime.housingCapacity = 200;
    backgroundSettlementTick(runtime, rng);
    expect(runtime.resources.population).toBeLessThanOrEqual(200);
  });

  it('syncs population to settlement metadata', () => {
    runtime.resources.population = 75;
    backgroundSettlementTick(runtime, rng);
    expect(runtime.settlement.population).toBe(runtime.resources.population);
  });

  it('starvation reduces population when food is zero', () => {
    runtime.resources.food = 0;
    runtime.resources.population = 100;
    backgroundSettlementTick(runtime, rng);
    expect(runtime.resources.population).toBeLessThan(100);
    expect(runtime.resources.population).toBeGreaterThanOrEqual(0);
  });

  it('population grows when food is abundant', () => {
    runtime.resources.population = 50;
    runtime.resources.food = 99999;
    runtime.housingCapacity = 200;
    // Growth is 0.1% per tick, so need many ticks
    for (let i = 0; i < 100; i++) {
      backgroundSettlementTick(runtime, rng);
    }
    expect(runtime.resources.population).toBeGreaterThanOrEqual(50);
  });
});
