import { world } from '../../src/ecs/world';
import { createBuilding, placeNewBuilding } from '../../src/ecs/factories';
import {
  createPlaythroughEngine,
  advanceTicks,
  advanceMonths,
  getResources,
  getDate,
  isGameOver,
  getGameOverReason,
  getBuildingCount,
  assertResourceInvariants,
  buildBasicSettlement,
  TICKS_PER_YEAR,
  TICKS_PER_MONTH,
} from './helpers';

describe('Playthrough: First Year Survival', () => {
  afterEach(() => {
    world.clear();
    jest.restoreAllMocks();
  });

  // ── Scenario 1: Basic settlement survives a full year ─────────────────────

  it('basic settlement with adequate food survives a full year', () => {
    const { engine } = createPlaythroughEngine({
      resources: { food: 5000 },
    });

    buildBasicSettlement();

    // Tick through a full year (360 ticks) with quarterly checkpoints
    for (let quarter = 1; quarter <= 4; quarter++) {
      advanceTicks(engine, TICKS_PER_YEAR / 4);
      assertResourceInvariants();
    }

    expect(isGameOver()).toBe(false);
    expect(getResources().population).toBeGreaterThan(0);
  });

  // ── Scenario 2: Empty grid with no buildings doesn't crash ────────────────

  it('empty grid with no buildings runs a full year without crashing', () => {
    const { engine } = createPlaythroughEngine();

    expect(getBuildingCount()).toBe(0);

    // Should not throw for 360 ticks
    expect(() => advanceTicks(engine, TICKS_PER_YEAR)).not.toThrow();

    // No buildings means the game-over check (pop=0 + buildings>0) won't fire
    expect(isGameOver()).toBe(false);
  });

  // ── Scenario 3: Construction lifecycle completes ──────────────────────────

  it('building construction progresses through phases to completion', () => {
    const { engine } = createPlaythroughEngine({
      resources: { timber: 500, steel: 200, cement: 200, prefab: 100 },
    });

    // Need power for construction to proceed (constructionSystem needs resources + power grid)
    createBuilding(2, 0, 'power-station');

    // Place a new building that starts at 'foundation' phase
    const placed = placeNewBuilding(0, 0, 'collective-farm-hq');
    expect(placed.building!.constructionPhase).toBe('foundation');
    expect(placed.building!.constructionTicks).toBe(0);

    // Tick until construction completes (up to 200 ticks max)
    let completed = false;
    for (let i = 0; i < 200; i++) {
      engine.tick();
      const buildings = world.with('building', 'isBuilding').entities;
      const farm = buildings.find((e) => e.building!.defId === 'collective-farm-hq');
      if (farm && farm.building!.constructionPhase === 'complete') {
        completed = true;
        break;
      }
    }

    expect(completed).toBe(true);
  });

  // ── Scenario 4: Seasonal food production variance ─────────────────────────

  it('winter prevents farm food production', () => {
    // Start in month 1 (winter: farmMultiplier = 0.0)
    const { engine } = createPlaythroughEngine({
      meta: { date: { year: 1922, month: 1, tick: 0 } },
      resources: { food: 1000, population: 12 },
    });

    // Place powered farm (both instantly operational)
    createBuilding(0, 0, 'power-station');
    createBuilding(2, 0, 'collective-farm-hq');

    const initialFood = getResources().food;

    // Tick 10 times — in winter, farmModifier=0.0 so no food production
    // Food can only decrease (consumption/spoilage) or stay flat
    advanceTicks(engine, 10);

    const foodAfter = getResources().food;
    // Allow a small margin for floating point, but food should not have grown
    // from farming. It may have decreased due to consumption.
    expect(foodAfter).toBeLessThanOrEqual(initialFood + 1);
  });

  // ── Scenario 5: Grace period protects first year ──────────────────────────

  it('population=0 does not trigger game over during grace period', () => {
    const { engine } = createPlaythroughEngine({
      resources: { population: 0, food: 0 },
    });

    // Place a building so the "buildings > 0" condition is met
    createBuilding(0, 0, 'power-station');

    // Tick 100 times (well within the first year / 360 ticks)
    advanceTicks(engine, 100);

    // Grace period: no game over despite pop=0 + buildings present
    expect(isGameOver()).toBe(false);
  });

  it('population=0 triggers game over after grace period expires', () => {
    const { engine } = createPlaythroughEngine({
      resources: { population: 0, food: 0 },
    });

    // Place a building so the "buildings > 0" condition is met
    createBuilding(0, 0, 'power-station');

    // Tick past the grace period (360 ticks = 1 year)
    // Need totalTicks > TICKS_PER_YEAR for game over to fire
    advanceTicks(engine, TICKS_PER_YEAR + 1);

    expect(isGameOver()).toBe(true);
    expect(getGameOverReason()).toBeTruthy();
  });
});
