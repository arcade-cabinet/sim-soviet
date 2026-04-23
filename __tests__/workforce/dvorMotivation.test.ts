import type { DvorState } from '../../src/ai/agents/workforce/dvorMotivation';
import { evaluateNeeds, findNearestHousing, tickMotivation } from '../../src/ai/agents/workforce/dvorMotivation';
import type { BuildingComponent, Position } from '../../src/ecs/world';

/** Helper: create a minimal BuildingComponent with housing capacity. */
function makeBuilding(defId: string, housingCap: number, residentCount = 0): BuildingComponent {
  return {
    defId,
    level: 0,
    powered: true,
    powerReq: 0,
    powerOutput: 0,
    housingCap,
    pollution: 0,
    fear: 0,
    workerCount: 0,
    residentCount,
    avgMorale: 0,
    avgSkill: 0,
    avgLoyalty: 0,
    avgVodkaDep: 0,
    trudodniAccrued: 0,
    householdCount: 0,
  };
}

/** Helper: create a housing entry for findNearestHousing. */
function makeHousingEntry(gridX: number, gridY: number, housingCap: number, residentCount = 0) {
  return {
    position: { gridX, gridY } as Position,
    building: makeBuilding('izba', housingCap, residentCount),
  };
}

/** Helper: create a DvorState for testing. */
function makeDvor(overrides: Partial<DvorState> = {}): DvorState {
  return {
    dvorId: 'dvor-1',
    position: { gridX: 5, gridY: 5 },
    isDisplaced: true,
    householdSize: 4,
    foodLevel: 0.5,
    shelterLevel: 0,
    ...overrides,
  };
}

// ─── evaluateNeeds ───────────────────────────────────────────────────────────

describe('evaluateNeeds', () => {
  it('returns "shelter" when shelterLevel is 0 (highest priority)', () => {
    const dvor = makeDvor({ shelterLevel: 0, foodLevel: 0.5 });
    expect(evaluateNeeds(dvor)).toBe('shelter');
  });

  it('returns "shelter" when shelterLevel is below threshold', () => {
    const dvor = makeDvor({ shelterLevel: 0.2, foodLevel: 0.1 });
    expect(evaluateNeeds(dvor)).toBe('shelter');
  });

  it('returns "food" when sheltered but food is critically low', () => {
    const dvor = makeDvor({ shelterLevel: 1.0, foodLevel: 0.1 });
    expect(evaluateNeeds(dvor)).toBe('food');
  });

  it('returns "food" when sheltered but food is zero', () => {
    const dvor = makeDvor({ shelterLevel: 0.8, foodLevel: 0 });
    expect(evaluateNeeds(dvor)).toBe('food');
  });

  it('returns "party" when both shelter and food are adequate', () => {
    const dvor = makeDvor({ shelterLevel: 1.0, foodLevel: 0.8 });
    expect(evaluateNeeds(dvor)).toBe('party');
  });

  it('returns "party" when all needs are maximally satisfied', () => {
    const dvor = makeDvor({ shelterLevel: 1.0, foodLevel: 1.0 });
    expect(evaluateNeeds(dvor)).toBe('party');
  });
});

// ─── findNearestHousing ──────────────────────────────────────────────────────

describe('findNearestHousing', () => {
  it('returns null when no buildings exist', () => {
    const result = findNearestHousing({ gridX: 5, gridY: 5 }, []);
    expect(result).toBeNull();
  });

  it('returns null when all buildings are at capacity', () => {
    const buildings = [makeHousingEntry(3, 3, 10, 10), makeHousingEntry(7, 7, 5, 5)];
    const result = findNearestHousing({ gridX: 5, gridY: 5 }, buildings);
    expect(result).toBeNull();
  });

  it('returns the nearest building with capacity', () => {
    const buildings = [
      makeHousingEntry(10, 10, 10, 5), // far, has capacity
      makeHousingEntry(6, 6, 10, 5), // near, has capacity
    ];
    const result = findNearestHousing({ gridX: 5, gridY: 5 }, buildings);
    expect(result).not.toBeNull();
    expect(result!.position.gridX).toBe(6);
    expect(result!.position.gridY).toBe(6);
  });

  it('skips buildings with no remaining capacity', () => {
    const buildings = [
      makeHousingEntry(6, 6, 10, 10), // near but full
      makeHousingEntry(10, 10, 10, 3), // far, has capacity
    ];
    const result = findNearestHousing({ gridX: 5, gridY: 5 }, buildings);
    expect(result).not.toBeNull();
    expect(result!.position.gridX).toBe(10);
    expect(result!.position.gridY).toBe(10);
  });

  it('selects the closest among multiple buildings with capacity', () => {
    const buildings = [
      makeHousingEntry(0, 0, 10, 0), // distance ~7.07
      makeHousingEntry(4, 5, 10, 0), // distance = 1
      makeHousingEntry(8, 8, 10, 0), // distance ~4.24
    ];
    const result = findNearestHousing({ gridX: 5, gridY: 5 }, buildings);
    expect(result).not.toBeNull();
    expect(result!.position.gridX).toBe(4);
    expect(result!.position.gridY).toBe(5);
  });
});

// ─── tickMotivation ──────────────────────────────────────────────────────────

describe('tickMotivation', () => {
  it('returns "wait" when dvor is not displaced', () => {
    const dvor = makeDvor({ isDisplaced: false, shelterLevel: 1.0 });
    const result = tickMotivation(dvor, []);
    expect(result.action).toBe('wait');
  });

  it('returns "wait" when no housing is available', () => {
    const dvor = makeDvor({ isDisplaced: true, shelterLevel: 0 });
    const result = tickMotivation(dvor, []);
    expect(result.action).toBe('wait');
    expect(result.target).toBeUndefined();
  });

  it('returns "move" when housing exists but dvor is far away', () => {
    const dvor = makeDvor({ isDisplaced: true, shelterLevel: 0, position: { gridX: 0, gridY: 0 } });
    const buildings = [makeHousingEntry(10, 10, 10, 0)];
    const result = tickMotivation(dvor, buildings);
    expect(result.action).toBe('move');
    expect(result.target).toBeDefined();
    expect(result.target!.gridX).toBe(10);
    expect(result.target!.gridY).toBe(10);
  });

  it('returns "absorb" when dvor is adjacent to (or at) the housing', () => {
    const dvor = makeDvor({ isDisplaced: true, shelterLevel: 0, position: { gridX: 10, gridY: 10 } });
    const buildings = [makeHousingEntry(10, 10, 10, 0)];
    const result = tickMotivation(dvor, buildings);
    expect(result.action).toBe('absorb');
    expect(result.target).toBeDefined();
  });

  it('returns "absorb" when within arrival distance (adjacent tile)', () => {
    const dvor = makeDvor({ isDisplaced: true, shelterLevel: 0, position: { gridX: 9, gridY: 10 } });
    const buildings = [makeHousingEntry(10, 10, 10, 0)];
    const result = tickMotivation(dvor, buildings);
    expect(result.action).toBe('absorb');
  });

  it('sheltered dvory with low food seek food (return "wait" — food not spatial)', () => {
    const dvor = makeDvor({ isDisplaced: false, shelterLevel: 1.0, foodLevel: 0 });
    const result = tickMotivation(dvor, []);
    // Food seeking is handled by consumption system, not spatial movement
    expect(result.action).toBe('wait');
  });

  it('returns "move" toward nearest housing among multiple options', () => {
    const dvor = makeDvor({ isDisplaced: true, shelterLevel: 0, position: { gridX: 5, gridY: 5 } });
    const buildings = [
      makeHousingEntry(0, 0, 10, 0),
      makeHousingEntry(6, 6, 10, 0), // nearest
      makeHousingEntry(15, 15, 10, 0),
    ];
    const result = tickMotivation(dvor, buildings);
    expect(result.target!.gridX).toBe(6);
    expect(result.target!.gridY).toBe(6);
  });
});
