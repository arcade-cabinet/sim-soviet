/**
 * Tests for resource gating (isResourceTracked) and carrying capacity
 * (computeCarryingCapacity, computeCarryingCapacityFromResources).
 */

import type { TerrainProfile } from '../../src/ai/agents/core/worldBranches';
import type { Resources } from '../../src/ecs/world';
import {
  isResourceTracked,
  computeCarryingCapacity,
  computeCarryingCapacityFromResources,
  type CarryingCapacityInput,
  type GatedResource,
} from '../../src/game/engine/resourceTracking';

// ─── Terrain Profiles ────────────────────────────────────────────────────────

const EARTH_DEFAULT: TerrainProfile = {
  gravity: 1.0,
  atmosphere: 'breathable',
  water: 'rivers',
  farming: 'soil',
  construction: 'standard',
  baseSurvivalCost: 'low',
};

const EARTH_ARCTIC: TerrainProfile = {
  gravity: 1.0,
  atmosphere: 'breathable',
  water: 'ice_deposits',
  farming: 'greenhouse',
  construction: 'standard',
  baseSurvivalCost: 'very_high',
};

const LUNAR: TerrainProfile = {
  gravity: 0.16,
  atmosphere: 'none',
  water: 'ice_deposits',
  farming: 'hydroponics',
  construction: 'pressurized_domes',
  baseSurvivalCost: 'extreme',
};

const MARS: TerrainProfile = {
  gravity: 0.38,
  atmosphere: 'thin_co2',
  water: 'subsurface',
  farming: 'greenhouse',
  construction: 'pressurized_domes',
  baseSurvivalCost: 'very_high',
};

const TITAN: TerrainProfile = {
  gravity: 0.14,
  atmosphere: 'thick_n2_ch4',
  water: 'methane_lakes',
  farming: 'impossible',
  construction: 'pressurized_domes',
  baseSurvivalCost: 'extreme',
};

// ─── isResourceTracked ──────────────────────────────────────────────────────

describe('isResourceTracked', () => {
  describe('oxygen', () => {
    it('is NOT tracked on open-air Earth (breathable atmosphere, no dome)', () => {
      expect(isResourceTracked('oxygen', EARTH_DEFAULT, false)).toBe(false);
    });

    it('IS tracked on Earth inside a dome', () => {
      expect(isResourceTracked('oxygen', EARTH_DEFAULT, true)).toBe(true);
    });

    it('IS tracked on the Moon (no atmosphere)', () => {
      expect(isResourceTracked('oxygen', LUNAR, false)).toBe(true);
    });

    it('IS tracked on Mars (thin CO2)', () => {
      expect(isResourceTracked('oxygen', MARS, false)).toBe(true);
    });

    it('IS tracked on Titan (thick N2/CH4)', () => {
      expect(isResourceTracked('oxygen', TITAN, false)).toBe(true);
    });

    it('IS tracked on Arctic Earth with dome', () => {
      expect(isResourceTracked('oxygen', EARTH_ARCTIC, true)).toBe(true);
    });
  });

  describe('water', () => {
    it('is NOT tracked on Earth with rivers', () => {
      expect(isResourceTracked('water', EARTH_DEFAULT, false)).toBe(false);
    });

    it('IS tracked on Arctic (ice deposits)', () => {
      expect(isResourceTracked('water', EARTH_ARCTIC, false)).toBe(true);
    });

    it('IS tracked on Moon (ice deposits)', () => {
      expect(isResourceTracked('water', LUNAR, false)).toBe(true);
    });

    it('IS tracked on Mars (subsurface)', () => {
      expect(isResourceTracked('water', MARS, false)).toBe(true);
    });

    it('IS tracked on Titan (methane lakes)', () => {
      expect(isResourceTracked('water', TITAN, false)).toBe(true);
    });
  });

  describe('always-tracked resources', () => {
    const alwaysTracked: GatedResource[] = ['hydrogen', 'rareEarths', 'uranium', 'rocketFuel'];

    for (const resource of alwaysTracked) {
      it(`${resource} is always tracked regardless of terrain`, () => {
        expect(isResourceTracked(resource, EARTH_DEFAULT, false)).toBe(true);
        expect(isResourceTracked(resource, LUNAR, false)).toBe(true);
        expect(isResourceTracked(resource, MARS, true)).toBe(true);
      });
    }
  });
});

// ─── computeCarryingCapacity ────────────────────────────────────────────────

describe('computeCarryingCapacity', () => {
  function makeInput(overrides?: Partial<CarryingCapacityInput>): CarryingCapacityInput {
    return {
      housingCapacity: 1000,
      foodProductionPerTick: 500,
      foodConsumptionPerCapita: 1.0,
      waterTracked: false,
      waterCapacity: 0,
      waterPerCapita: 0.5,
      oxygenTracked: false,
      oxygenCapacity: 0,
      oxygenPerCapita: 1.0,
      powerCapacity: 100,
      powerPerCapita: 0, // no per-capita power demand = no power constraint
      terrainLimit: 100_000_000,
      ...overrides,
    };
  }

  it('returns housing capacity when that is the binding constraint', () => {
    const K = computeCarryingCapacity(makeInput({
      housingCapacity: 200,
      foodProductionPerTick: 10000,
    }));
    expect(K).toBe(200);
  });

  it('returns food capacity when that is the binding constraint', () => {
    const K = computeCarryingCapacity(makeInput({
      housingCapacity: 10000,
      foodProductionPerTick: 100,
      foodConsumptionPerCapita: 1.0,
    }));
    // 100 / 1.0 = 100
    expect(K).toBe(100);
  });

  it('returns terrain limit when that is the binding constraint', () => {
    const K = computeCarryingCapacity(makeInput({
      housingCapacity: 1_000_000,
      foodProductionPerTick: 1_000_000,
      terrainLimit: 500,
    }));
    expect(K).toBe(500);
  });

  it('ignores water when not tracked', () => {
    const K = computeCarryingCapacity(makeInput({
      waterTracked: false,
      waterCapacity: 0,
      waterPerCapita: 0.5,
    }));
    // Water should not constrain — K = min(housing=1000, food=500, terrain=100M) = 500
    expect(K).toBe(500);
  });

  it('constrains by water when tracked', () => {
    const K = computeCarryingCapacity(makeInput({
      waterTracked: true,
      waterCapacity: 50, // 50 total water
      waterPerCapita: 0.5, // 0.5 per person → supports 100
    }));
    // min(1000, 500, 100, 100M) = 100
    expect(K).toBe(100);
  });

  it('ignores oxygen when not tracked', () => {
    const K = computeCarryingCapacity(makeInput({
      oxygenTracked: false,
      oxygenCapacity: 0,
      oxygenPerCapita: 1.0,
    }));
    // Oxygen not tracked → not a constraint
    expect(K).toBe(500); // min(housing=1000, food=500)
  });

  it('constrains by oxygen when tracked', () => {
    const K = computeCarryingCapacity(makeInput({
      oxygenTracked: true,
      oxygenCapacity: 75, // 75 oxygen production
      oxygenPerCapita: 1.0, // 1.0 per person → supports 75
    }));
    // min(1000, 500, 75, 100M) = 75
    expect(K).toBe(75);
  });

  it('constrains by power when per-capita demand exists', () => {
    const K = computeCarryingCapacity(makeInput({
      powerCapacity: 50,
      powerPerCapita: 1.0, // 1.0 per person → supports 50
    }));
    // min(1000, 500, 50, 100M) = 50
    expect(K).toBe(50);
  });

  it('ignores power when per-capita demand is zero', () => {
    const K = computeCarryingCapacity(makeInput({
      powerCapacity: 50,
      powerPerCapita: 0,
    }));
    // powerPerCapita=0 → no constraint from power
    expect(K).toBe(500);
  });

  it('returns minimum 1 even with zero capacity', () => {
    const K = computeCarryingCapacity(makeInput({
      housingCapacity: 0,
      foodProductionPerTick: 0,
      terrainLimit: 0,
    }));
    expect(K).toBe(1);
  });

  it('handles Infinity gracefully for food with zero per-capita', () => {
    const K = computeCarryingCapacity(makeInput({
      foodConsumptionPerCapita: 0,
      housingCapacity: 300,
    }));
    // food capacity = Infinity → K = min(300, Infinity, 100M) = 300
    expect(K).toBe(300);
  });

  it('computes correct K with all constraints active (off-Earth scenario)', () => {
    const K = computeCarryingCapacity({
      housingCapacity: 500,
      foodProductionPerTick: 200,
      foodConsumptionPerCapita: 1.0,
      waterTracked: true,
      waterCapacity: 100,
      waterPerCapita: 0.5,
      oxygenTracked: true,
      oxygenCapacity: 150,
      oxygenPerCapita: 1.0,
      powerCapacity: 300,
      powerPerCapita: 2.0,
      terrainLimit: 1_000_000,
    });
    // housing=500, food=200, water=200, oxygen=150, power=150, terrain=1M
    // min = 150 (tied between oxygen and power)
    expect(K).toBe(150);
  });
});

// ─── computeCarryingCapacityFromResources ──────────────────────────────────

describe('computeCarryingCapacityFromResources', () => {
  function makeResources(overrides?: Partial<Resources>): Resources {
    return {
      money: 0,
      food: 0,
      vodka: 0,
      power: 100,
      powerUsed: 0,
      population: 0,
      trudodni: 0,
      blat: 0,
      timber: 0,
      steel: 0,
      cement: 0,
      prefab: 0,
      seedFund: 0,
      emergencyReserve: 0,
      storageCapacity: 0,
      oxygen: 0,
      oxygenProduction: 0,
      hydrogen: 0,
      water: 0,
      waterRecycling: 0,
      rareEarths: 0,
      uranium: 0,
      rocketFuel: 0,
      ...overrides,
    };
  }

  it('on Earth with rivers, water and oxygen are not constraints', () => {
    const K = computeCarryingCapacityFromResources(
      makeResources(),
      EARTH_DEFAULT,
      false,
      500, // housing
      200, // food production per tick
    );
    // On Earth default: oxygen not tracked, water not tracked
    // K = min(500, 200/1.0, 100M terrain) = 200
    expect(K).toBe(200);
  });

  it('on Moon, oxygen and water ARE constraints', () => {
    const K = computeCarryingCapacityFromResources(
      makeResources({
        oxygenProduction: 50,
        water: 30,
        waterRecycling: 20, // total water capacity = 50
      }),
      LUNAR,
      false,
      500, // housing
      200, // food production
    );
    // Lunar: oxygen tracked, water tracked
    // oxygen capacity = 50, per capita = 1.0 → supports 50
    // water capacity = 30+20 = 50, per capita = 0.5 → supports 100
    // food = 200, housing = 500, terrain extreme = 1,000,000
    // K = min(500, 200, 100, 50, 1M) = 50
    expect(K).toBe(50);
  });

  it('on Arctic Earth, water is tracked but oxygen is not', () => {
    const K = computeCarryingCapacityFromResources(
      makeResources({
        water: 100,
        waterRecycling: 0,
      }),
      EARTH_ARCTIC,
      false,
      500, // housing
      300, // food
    );
    // Arctic: water tracked (ice_deposits), oxygen NOT tracked (breathable)
    // water = 100 / 0.5 = 200
    // K = min(500, 300, 200, 10M terrain) = 200
    expect(K).toBe(200);
  });

  it('returns at least 1 with zero resources', () => {
    const K = computeCarryingCapacityFromResources(
      makeResources(),
      EARTH_DEFAULT,
      false,
      0,
      0,
    );
    expect(K).toBeGreaterThanOrEqual(1);
  });
});
