import {
  getOffscreenBuildings,
  tickOffscreenBuildings,
  aggregateOffscreenResults,
  type OffscreenBuilding,
  type OffscreenTickResult,
} from '../../src/game/engine/offscreenTick';
import type { BuildingTickContext } from '../../src/ai/agents/economy/buildingTick';

const CTX: BuildingTickContext = {
  weather: 'clear',
  season: 'summer',
  activeCrisisModifier: 1.0,
};

function makeBuilding(overrides: Partial<OffscreenBuilding> = {}): OffscreenBuilding {
  return {
    id: 'farm-1',
    defId: 'kolkhoz',
    resourceType: 'food',
    workerCount: 10,
    avgSkill: 80,
    avgMorale: 70,
    avgLoyalty: 60,
    powered: true,
    baseRate: 2.0,
    tileFertility: 90,
    ...overrides,
  };
}

describe('getOffscreenBuildings', () => {
  const allBuildings: OffscreenBuilding[] = [
    makeBuilding({ id: 'a' }),
    makeBuilding({ id: 'b' }),
    makeBuilding({ id: 'c' }),
    makeBuilding({ id: 'd' }),
  ];

  it('returns buildings not in the visible set', () => {
    const visibleIds = new Set(['a', 'c']);
    const result = getOffscreenBuildings(allBuildings, visibleIds);
    expect(result.map((b) => b.id)).toEqual(['b', 'd']);
  });

  it('returns all buildings when none are visible', () => {
    const result = getOffscreenBuildings(allBuildings, new Set());
    expect(result).toHaveLength(4);
  });

  it('returns empty when all buildings are visible', () => {
    const visibleIds = new Set(['a', 'b', 'c', 'd']);
    const result = getOffscreenBuildings(allBuildings, visibleIds);
    expect(result).toEqual([]);
  });

  it('handles empty allBuildings', () => {
    const result = getOffscreenBuildings([], new Set(['a']));
    expect(result).toEqual([]);
  });
});

describe('tickOffscreenBuildings', () => {
  it('returns tick results for each building', () => {
    const buildings = [
      makeBuilding({ id: 'farm-1', resourceType: 'food' }),
      makeBuilding({ id: 'distillery-1', resourceType: 'vodka', baseRate: 1.0 }),
    ];
    const results = tickOffscreenBuildings(buildings, CTX);
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('farm-1');
    expect(results[0].resourceType).toBe('food');
    expect(results[0].netOutput).toBeGreaterThan(0);
    expect(results[1].id).toBe('distillery-1');
    expect(results[1].resourceType).toBe('vodka');
  });

  it('returns zero output for unpowered buildings', () => {
    const buildings = [makeBuilding({ powered: false })];
    const results = tickOffscreenBuildings(buildings, CTX);
    expect(results[0].netOutput).toBe(0);
  });

  it('returns zero output for buildings with no workers', () => {
    const buildings = [makeBuilding({ workerCount: 0 })];
    const results = tickOffscreenBuildings(buildings, CTX);
    expect(results[0].netOutput).toBe(0);
  });

  it('handles empty building list', () => {
    const results = tickOffscreenBuildings([], CTX);
    expect(results).toEqual([]);
  });

  it('applies weather and season modifiers', () => {
    const buildings = [makeBuilding()];
    const summerClear = tickOffscreenBuildings(buildings, CTX);
    const winterStorm = tickOffscreenBuildings(buildings, {
      weather: 'storm',
      season: 'winter',
      activeCrisisModifier: 1.0,
    });
    expect(winterStorm[0].netOutput).toBeLessThan(summerClear[0].netOutput);
  });

  it('applies crisis modifier', () => {
    const buildings = [makeBuilding()];
    const normal = tickOffscreenBuildings(buildings, CTX);
    const crisis = tickOffscreenBuildings(buildings, {
      ...CTX,
      activeCrisisModifier: 0.5,
    });
    expect(crisis[0].netOutput).toBeCloseTo(normal[0].netOutput * 0.5, 5);
  });
});

describe('aggregateOffscreenResults', () => {
  it('sums outputs by resource type', () => {
    const results: OffscreenTickResult[] = [
      { id: 'a', resourceType: 'food', netOutput: 10 },
      { id: 'b', resourceType: 'food', netOutput: 5 },
      { id: 'c', resourceType: 'vodka', netOutput: 3 },
      { id: 'd', resourceType: 'power', netOutput: 100 },
      { id: 'e', resourceType: 'money', netOutput: 50 },
    ];
    const agg = aggregateOffscreenResults(results);
    expect(agg.totalFood).toBe(15);
    expect(agg.totalVodka).toBe(3);
    expect(agg.totalPower).toBe(100);
    expect(agg.totalMoney).toBe(50);
  });

  it('returns zeros for empty results', () => {
    const agg = aggregateOffscreenResults([]);
    expect(agg).toEqual({ totalFood: 0, totalVodka: 0, totalPower: 0, totalMoney: 0 });
  });

  it('handles results with only one resource type', () => {
    const results: OffscreenTickResult[] = [
      { id: 'a', resourceType: 'food', netOutput: 7 },
      { id: 'b', resourceType: 'food', netOutput: 3 },
    ];
    const agg = aggregateOffscreenResults(results);
    expect(agg.totalFood).toBe(10);
    expect(agg.totalVodka).toBe(0);
    expect(agg.totalPower).toBe(0);
    expect(agg.totalMoney).toBe(0);
  });

  it('ignores unknown resource types', () => {
    const results: OffscreenTickResult[] = [
      { id: 'a', resourceType: 'food', netOutput: 5 },
      { id: 'b', resourceType: 'lumber' as any, netOutput: 99 },
    ];
    const agg = aggregateOffscreenResults(results);
    expect(agg.totalFood).toBe(5);
    expect(agg.totalVodka).toBe(0);
    expect(agg.totalPower).toBe(0);
    expect(agg.totalMoney).toBe(0);
  });
});
