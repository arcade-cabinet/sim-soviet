import type { SettlementSummary } from '../../src/game/engine/SettlementSummary';
import {
  buildSettlementRow,
  type SettlementContext,
} from '../../src/db/settlementWriter';

function makeSummary(overrides: Partial<SettlementSummary> = {}): SettlementSummary {
  return {
    year: 1941,
    month: 6,
    population: 150,
    buildingCount: 12,
    totalFood: 800,
    totalPower: 50,
    totalMorale: 0.6,
    activeCrisisCount: 1,
    activeCrisisTypes: new Set(['war']),
    trendDeltas: { food: -10, population: 2, morale: -0.05, power: 3 },
    yearsSinceLastWar: 0,
    yearsSinceLastFamine: 5,
    yearsSinceLastDisaster: 999,
    ...overrides,
  };
}

const defaultCtx: SettlementContext = {
  era: 'great_patriotic_war',
  landGrantRadius: 20,
};

describe('buildSettlementRow', () => {
  it('maps all SettlementSummary fields to the correct row columns', () => {
    const summary = makeSummary();
    const row = buildSettlementRow(summary, defaultCtx);

    expect(row.population).toBe(150);
    expect(row.totalBuildings).toBe(12);
    expect(row.year).toBe(1941);
    expect(row.month).toBe(6);
    expect(row.era).toBe('great_patriotic_war');
    expect(row.landGrantRadius).toBe(20);
    expect(row.trendFoodDelta).toBe(-10);
    expect(row.trendPopDelta).toBe(2);
    expect(row.trendMoraleDelta).toBe(-0.05);
    expect(row.trendPowerDelta).toBe(3);
    expect(row.yearsSinceLastWar).toBe(0);
    expect(row.yearsSinceLastFamine).toBe(5);
    expect(row.yearsSinceLastDisaster).toBe(999);
  });

  it('uses buildingCount for totalBuildings (not population)', () => {
    const row = buildSettlementRow(
      makeSummary({ population: 500, buildingCount: 42 }),
      defaultCtx,
    );
    expect(row.totalBuildings).toBe(42);
    expect(row.population).toBe(500);
  });

  it('uses context era and landGrantRadius', () => {
    const row = buildSettlementRow(makeSummary(), {
      era: 'stagnation',
      landGrantRadius: 50,
    });
    expect(row.era).toBe('stagnation');
    expect(row.landGrantRadius).toBe(50);
  });

  it('handles zero deltas', () => {
    const row = buildSettlementRow(
      makeSummary({
        trendDeltas: { food: 0, population: 0, morale: 0, power: 0 },
      }),
      defaultCtx,
    );
    expect(row.trendFoodDelta).toBe(0);
    expect(row.trendPopDelta).toBe(0);
    expect(row.trendMoraleDelta).toBe(0);
    expect(row.trendPowerDelta).toBe(0);
  });

  it('returns a plain object with exactly 13 keys', () => {
    const row = buildSettlementRow(makeSummary(), defaultCtx);
    expect(Object.keys(row)).toHaveLength(13);
  });

  it('does not include SettlementSummary-only fields (totalFood, totalPower, etc.)', () => {
    const row = buildSettlementRow(makeSummary(), defaultCtx) as Record<string, unknown>;
    expect(row).not.toHaveProperty('totalFood');
    expect(row).not.toHaveProperty('totalPower');
    expect(row).not.toHaveProperty('totalMorale');
    expect(row).not.toHaveProperty('activeCrisisCount');
    expect(row).not.toHaveProperty('activeCrisisTypes');
  });

  it('is a pure function — does not mutate inputs', () => {
    const summary = makeSummary();
    const ctx = { ...defaultCtx };
    const summaryBefore = JSON.stringify(summary, (_k, v) => v instanceof Set ? [...v] : v);
    const ctxBefore = JSON.stringify(ctx);

    buildSettlementRow(summary, ctx);

    const summaryAfter = JSON.stringify(summary, (_k, v) => v instanceof Set ? [...v] : v);
    const ctxAfter = JSON.stringify(ctx);
    expect(summaryAfter).toBe(summaryBefore);
    expect(ctxAfter).toBe(ctxBefore);
  });
});
