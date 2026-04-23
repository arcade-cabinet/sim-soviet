/**
 * Tests for pressure normalization functions.
 * Each domain normalizer maps existing game metrics to 0-1 pressure.
 */

import type { PressureReadContext } from '../../../src/ai/agents/crisis/pressure/PressureDomains';
import {
  normalizeAllDomains,
  normalizeDemographic,
  normalizeEconomic,
  normalizeFood,
  normalizeHealth,
  normalizeHousing,
  normalizeInfrastructure,
  normalizeLoyalty,
  normalizeMorale,
  normalizePolitical,
  normalizePower,
} from '../../../src/ai/agents/crisis/pressure/pressureNormalization';

/** Helper to create a baseline context with sensible defaults (no stress). */
function createBaseCtx(): PressureReadContext {
  return {
    foodState: 'surplus',
    starvationCounter: 0,
    starvationGraceTicks: 90,
    averageMorale: 100,
    averageLoyalty: 100,
    sabotageCount: 0,
    flightCount: 0,
    population: 100,
    housingCapacity: 200,
    suspicionLevel: 0,
    blackMarks: 0,
    blat: 0,
    powerShortage: false,
    unpoweredCount: 0,
    totalBuildings: 10,
    averageDurability: 100,
    growthRate: 0.02,
    laborRatio: 0.6,
    sickCount: 0,
    quotaDeficit: 0,
    productionTrend: 1.0,
    carryingCapacity: 10000,
    season: 'summer',
    weather: 'clear',
  };
}

// ─── Food ────────────────────────────────────────────────────────────────────

describe('normalizeFood', () => {
  it('returns 0 for surplus', () => {
    const ctx = createBaseCtx();
    ctx.foodState = 'surplus';
    expect(normalizeFood(ctx)).toBe(0);
  });

  it('returns 0.2 for stable', () => {
    const ctx = createBaseCtx();
    ctx.foodState = 'stable';
    expect(normalizeFood(ctx)).toBe(0.2);
  });

  it('returns 0.5 for rationing', () => {
    const ctx = createBaseCtx();
    ctx.foodState = 'rationing';
    expect(normalizeFood(ctx)).toBe(0.5);
  });

  it('returns 0.8 at starvation start (counter=0)', () => {
    const ctx = createBaseCtx();
    ctx.foodState = 'starvation';
    ctx.starvationCounter = 0;
    expect(normalizeFood(ctx)).toBeCloseTo(0.8);
  });

  it('ramps to 1.0 as starvation counter approaches grace', () => {
    const ctx = createBaseCtx();
    ctx.foodState = 'starvation';
    ctx.starvationCounter = 90;
    ctx.starvationGraceTicks = 90;
    expect(normalizeFood(ctx)).toBeCloseTo(1.0);
  });

  it('caps at 1.0 for counter beyond grace', () => {
    const ctx = createBaseCtx();
    ctx.foodState = 'starvation';
    ctx.starvationCounter = 200;
    ctx.starvationGraceTicks = 90;
    expect(normalizeFood(ctx)).toBe(1.0);
  });
});

// ─── Morale ──────────────────────────────────────────────────────────────────

describe('normalizeMorale', () => {
  it('returns 0 for max morale (100)', () => {
    const ctx = createBaseCtx();
    ctx.averageMorale = 100;
    expect(normalizeMorale(ctx)).toBe(0);
  });

  it('returns 1 for zero morale', () => {
    const ctx = createBaseCtx();
    ctx.averageMorale = 0;
    expect(normalizeMorale(ctx)).toBe(1);
  });

  it('returns 0.5 for mid morale', () => {
    const ctx = createBaseCtx();
    ctx.averageMorale = 50;
    expect(normalizeMorale(ctx)).toBeCloseTo(0.5);
  });
});

// ─── Loyalty ─────────────────────────────────────────────────────────────────

describe('normalizeLoyalty', () => {
  it('returns 0 for full loyalty and no incidents', () => {
    const ctx = createBaseCtx();
    expect(normalizeLoyalty(ctx)).toBe(0);
  });

  it('reflects loyalty drop', () => {
    const ctx = createBaseCtx();
    ctx.averageLoyalty = 50;
    // 0.7 * (1 - 50/100) + 0.3 * 0 = 0.35
    expect(normalizeLoyalty(ctx)).toBeCloseTo(0.35);
  });

  it('reflects incident spikes', () => {
    const ctx = createBaseCtx();
    ctx.sabotageCount = 5;
    ctx.flightCount = 5;
    // 0.7 * 0 + 0.3 * 1.0 = 0.3
    expect(normalizeLoyalty(ctx)).toBeCloseTo(0.3);
  });
});

// ─── Housing ─────────────────────────────────────────────────────────────────

describe('normalizeHousing', () => {
  it('returns 0 when under 80% occupancy', () => {
    const ctx = createBaseCtx();
    ctx.population = 50;
    ctx.housingCapacity = 200;
    expect(normalizeHousing(ctx)).toBe(0);
  });

  it('returns ~0.29 at 100% occupancy', () => {
    const ctx = createBaseCtx();
    ctx.population = 100;
    ctx.housingCapacity = 100;
    expect(normalizeHousing(ctx)).toBeCloseTo(0.286, 2);
  });

  it('returns 1 at 150%+ occupancy', () => {
    const ctx = createBaseCtx();
    ctx.population = 150;
    ctx.housingCapacity = 100;
    expect(normalizeHousing(ctx)).toBe(1);
  });

  it('handles zero housing capacity', () => {
    const ctx = createBaseCtx();
    ctx.housingCapacity = 0;
    ctx.population = 100;
    expect(normalizeHousing(ctx)).toBe(1);
  });
});

// ─── Political ───────────────────────────────────────────────────────────────

describe('normalizePolitical', () => {
  it('returns 0 when all clean', () => {
    const ctx = createBaseCtx();
    expect(normalizePolitical(ctx)).toBe(0);
  });

  it('returns max of suspicion, marks, blat', () => {
    const ctx = createBaseCtx();
    ctx.suspicionLevel = 0.3;
    ctx.blackMarks = 5; // 5/7 ≈ 0.714
    ctx.blat = 10; // 10/30 ≈ 0.333
    expect(normalizePolitical(ctx)).toBeCloseTo(5 / 7, 2);
  });

  it('caps at 1', () => {
    const ctx = createBaseCtx();
    ctx.blackMarks = 10;
    expect(normalizePolitical(ctx)).toBe(1);
  });
});

// ─── Power ───────────────────────────────────────────────────────────────────

describe('normalizePower', () => {
  it('returns 0 when no shortage', () => {
    const ctx = createBaseCtx();
    expect(normalizePower(ctx)).toBe(0);
  });

  it('returns 0.3+ when shortage with some unpowered', () => {
    const ctx = createBaseCtx();
    ctx.powerShortage = true;
    ctx.unpoweredCount = 2;
    ctx.totalBuildings = 10;
    // 2/10 + 0.3 = 0.5
    expect(normalizePower(ctx)).toBeCloseTo(0.5);
  });
});

// ─── Infrastructure ──────────────────────────────────────────────────────────

describe('normalizeInfrastructure', () => {
  it('returns 0 for full durability', () => {
    const ctx = createBaseCtx();
    expect(normalizeInfrastructure(ctx)).toBe(0);
  });

  it('returns 1 for zero durability', () => {
    const ctx = createBaseCtx();
    ctx.averageDurability = 0;
    expect(normalizeInfrastructure(ctx)).toBe(1);
  });
});

// ─── Demographic ─────────────────────────────────────────────────────────────

describe('normalizeDemographic', () => {
  it('returns low pressure for growing population with good labor ratio', () => {
    const ctx = createBaseCtx();
    ctx.growthRate = 0.02;
    ctx.laborRatio = 0.6;
    // growthPressure = clamp01(-0.02 * 20) = 0
    // laborPressure = 1 - 0.6 = 0.4
    // capacityPressure = 0 (pop 100 < 0.85 * 10000)
    // 0 * 0.4 + 0.4 * 0.3 + 0 * 0.3 = 0.12
    expect(normalizeDemographic(ctx)).toBeCloseTo(0.12);
  });

  it('returns high pressure for declining population', () => {
    const ctx = createBaseCtx();
    ctx.growthRate = -0.04;
    ctx.laborRatio = 0.3;
    // growthPressure = clamp01(0.8) = 0.8
    // laborPressure = 1 - 0.3 = 0.7
    // capacityPressure = 0 (pop 100 < 0.85 * 10000)
    // 0.8 * 0.4 + 0.7 * 0.3 + 0 * 0.3 = 0.32 + 0.21 = 0.53
    expect(normalizeDemographic(ctx)).toBeCloseTo(0.53);
  });

  it('returns capacity pressure when population approaches carrying capacity', () => {
    const ctx = createBaseCtx();
    ctx.growthRate = 0.02;
    ctx.laborRatio = 0.6;
    ctx.population = 950;
    ctx.carryingCapacity = 1000;
    // growthPressure = 0
    // laborPressure = 0.4
    // ratio = 0.95, capacityPressure = (0.95 - 0.85) / 0.15 = 0.667
    // 0 * 0.4 + 0.4 * 0.3 + 0.667 * 0.3 = 0.12 + 0.2 = 0.32
    expect(normalizeDemographic(ctx)).toBeCloseTo(0.32, 1);
  });
});

// ─── Health ──────────────────────────────────────────────────────────────────

describe('normalizeHealth', () => {
  it('returns 0 for no sick', () => {
    const ctx = createBaseCtx();
    expect(normalizeHealth(ctx)).toBe(0);
  });

  it('returns high for 20%+ sick', () => {
    const ctx = createBaseCtx();
    ctx.sickCount = 20;
    ctx.population = 100;
    // 20/100 * 5 = 1.0
    expect(normalizeHealth(ctx)).toBe(1);
  });

  it('handles zero population', () => {
    const ctx = createBaseCtx();
    ctx.population = 0;
    ctx.sickCount = 5;
    expect(normalizeHealth(ctx)).toBe(0);
  });
});

// ─── Economic ────────────────────────────────────────────────────────────────

describe('normalizeEconomic', () => {
  it('returns 0 when quota met and production growing', () => {
    const ctx = createBaseCtx();
    expect(normalizeEconomic(ctx)).toBe(0);
  });

  it('reflects quota deficit weighted at 60%', () => {
    const ctx = createBaseCtx();
    ctx.quotaDeficit = 0.5;
    ctx.productionTrend = 1.0;
    // 0.5 * 0.6 + 0 * 0.4 = 0.3
    expect(normalizeEconomic(ctx)).toBeCloseTo(0.3);
  });

  it('reflects production decline weighted at 40%', () => {
    const ctx = createBaseCtx();
    ctx.quotaDeficit = 0;
    ctx.productionTrend = 0.0;
    // 0 * 0.6 + 1.0 * 0.4 = 0.4
    expect(normalizeEconomic(ctx)).toBeCloseTo(0.4);
  });
});

// ─── normalizeAllDomains ─────────────────────────────────────────────────────

describe('normalizeAllDomains', () => {
  it('returns all 10 domains', () => {
    const ctx = createBaseCtx();
    const readings = normalizeAllDomains(ctx);
    expect(Object.keys(readings)).toHaveLength(10);
    expect(readings).toHaveProperty('food');
    expect(readings).toHaveProperty('economic');
  });

  it('returns all zeros for unstressed context', () => {
    const ctx = createBaseCtx();
    const readings = normalizeAllDomains(ctx);
    // Food surplus = 0, morale 100 = 0, power no shortage = 0, etc.
    // Only demographic has some non-zero due to labor ratio < 1.0
    expect(readings.food).toBe(0);
    expect(readings.morale).toBe(0);
    expect(readings.power).toBe(0);
  });
});
