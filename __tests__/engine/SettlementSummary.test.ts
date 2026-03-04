import { buildSettlementSummary, type SettlementSummary } from '../../src/game/engine/SettlementSummary';

describe('SettlementSummary', () => {
  it('builds from minimal inputs', () => {
    const summary = buildSettlementSummary({
      year: 1920, month: 3, population: 100, buildingCount: 5,
      totalFood: 500, totalPower: 100, totalMorale: 65,
      activeCrisisCount: 0, activeCrisisTypes: new Set(),
      trendDeltas: { food: 10, population: 2, morale: -1, power: 0 },
      yearsSinceLastWar: 3, yearsSinceLastFamine: 5, yearsSinceLastDisaster: 10,
    });
    expect(summary.year).toBe(1920);
    expect(summary.population).toBe(100);
    expect(summary.trendDeltas.food).toBe(10);
  });

  it('is the same shape regardless of game year', () => {
    const early = buildSettlementSummary({ year: 1917, month: 1, population: 10, buildingCount: 1, totalFood: 50, totalPower: 0, totalMorale: 50, activeCrisisCount: 0, activeCrisisTypes: new Set(), trendDeltas: { food: 0, population: 0, morale: 0, power: 0 }, yearsSinceLastWar: Infinity, yearsSinceLastFamine: Infinity, yearsSinceLastDisaster: Infinity });
    const late = buildSettlementSummary({ year: 9999, month: 12, population: 500000000, buildingCount: 30, totalFood: 999999, totalPower: 999999, totalMorale: 80, activeCrisisCount: 3, activeCrisisTypes: new Set(['war', 'famine']), trendDeltas: { food: -100, population: -500, morale: -5, power: -200 }, yearsSinceLastWar: 0, yearsSinceLastFamine: 0, yearsSinceLastDisaster: 50 });
    expect(Object.keys(early).sort()).toEqual(Object.keys(late).sort());
  });
});
