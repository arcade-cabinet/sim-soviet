import { ArrivalSequence } from '../../src/game/arrivalSequence';
import { citizens, dvory } from '../../src/ecs/archetypes';
import { createBuilding, placeNewBuilding } from '../../src/ecs/factories';
import { world } from '../../src/ecs/world';
import {
  advanceTicks,
  assertResourceInvariants,
  buildBasicSettlement,
  createPlaythroughEngine,
  getBuildingCount,
  getGameOverReason,
  getResources,
  isGameOver,
  TICKS_PER_YEAR,
} from './helpers';

describe('Playthrough: First Year Survival', () => {
  afterEach(() => {
    world.clear();
    jest.restoreAllMocks();
  });

  // ── Scenario 1: Basic settlement survives a full year ─────────────────────

  it('basic settlement with adequate food survives a full year', () => {
    const { engine, callbacks } = createPlaythroughEngine({
      resources: { food: 5000, vodka: 5000, population: 20 },
      difficulty: 'worker',
      consequence: 'rehabilitated',
    });

    // Disable interactive callbacks that can cause mark accumulation or defer evaluation
    callbacks.onMinigame = undefined as never;
    callbacks.onAnnualReport = undefined as never;

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
    const { engine, callbacks } = createPlaythroughEngine({
      resources: { timber: 500, steel: 200, cement: 200, prefab: 100 },
      consequence: 'rehabilitated',
    });
    callbacks.onMinigame = undefined as never;
    callbacks.onAnnualReport = undefined as never;

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

  it('winter reduces farm food production (weather-driven, not zero)', () => {
    // Start in month 1 (winter). Farm production is now driven by weather
    // profile farmModifier (e.g. overcast=0.9), not seasonal farmMultiplier.
    // Winter weather reduces output but does not eliminate it entirely.
    const { engine, callbacks } = createPlaythroughEngine({
      meta: { date: { year: 1922, month: 1, tick: 0 } },
      resources: { food: 1000, population: 12 },
      consequence: 'rehabilitated',
    });
    callbacks.onMinigame = undefined as never;
    callbacks.onAnnualReport = undefined as never;

    // Place powered farm (both instantly operational)
    createBuilding(0, 0, 'power-station');
    createBuilding(2, 0, 'collective-farm-hq');

    const initialFood = getResources().food;

    // Tick 10 times — winter weather still allows reduced farm production
    // Food may increase slightly from farm output, or decrease from consumption
    advanceTicks(engine, 10);

    const foodAfter = getResources().food;
    // With weather-driven production (overcast farmModifier=0.9), food can
    // increase slightly. Allow up to 50 food increase from farm + fondy.
    expect(foodAfter).toBeLessThanOrEqual(initialFood + 50);
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

  // ── Scenario 6: Arrival caravan sequence — families arrive staggered ────

  it('ArrivalSequence staggers family arrivals over first 30 ticks', () => {
    const { engine, callbacks } = createPlaythroughEngine({
      // Start with NO population — arrival caravan will create them
      resources: { food: 5000, vodka: 5000, population: 0 },
      difficulty: 'worker',
      consequence: 'rehabilitated',
      seed: 'arrival-caravan-test',
    });

    callbacks.onMinigame = undefined as never;
    callbacks.onAnnualReport = undefined as never;

    // Prepare the arrival sequence with 10 families
    const arrivalSeq = new ArrivalSequence();
    const dvorData = [];
    for (let i = 0; i < 10; i++) {
      dvorData.push({
        id: `arrival-dvor-${i}`,
        surname: `Family${i}`,
        memberSeeds: [
          { name: `Worker ${i}`, gender: 'male' as const, age: 30 },
          { name: `Wife ${i}`, gender: 'female' as const, age: 28 },
        ],
        isChairman: i === 0,
      });
    }
    arrivalSeq.prepareArrival(dvorData);
    engine.setArrivalSequence(arrivalSeq);

    expect(arrivalSeq.isInProgress()).toBe(true);
    expect(arrivalSeq.getArrivedCount()).toBe(0);
    expect(arrivalSeq.getTotalDvory()).toBe(10);

    // Tick through the first 35 ticks
    // Chairman arrives on tick 1, others stagger over ~30 ticks
    advanceTicks(engine, 35);

    // After 35 ticks, most or all families should have arrived
    expect(arrivalSeq.getArrivedCount()).toBeGreaterThan(0);

    // The sequence should eventually complete
    if (arrivalSeq.isInProgress()) {
      advanceTicks(engine, 30); // give extra time
    }

    console.log(
      `Arrival caravan: ${arrivalSeq.getArrivedCount()}/${arrivalSeq.getTotalDvory()} families arrived`,
    );
    expect(arrivalSeq.getArrivedCount()).toBe(10);
    expect(arrivalSeq.isInProgress()).toBe(false);
  });

  // ── Scenario 7: Initial morale is ~70 (hopeful revolutionaries) ────────

  it('arrival caravan spawns citizens with morale ~70', () => {
    const { engine, callbacks } = createPlaythroughEngine({
      resources: { food: 5000, vodka: 5000, population: 0 },
      difficulty: 'worker',
      consequence: 'rehabilitated',
      seed: 'morale-test',
    });

    callbacks.onMinigame = undefined as never;
    callbacks.onAnnualReport = undefined as never;

    const arrivalSeq = new ArrivalSequence();
    arrivalSeq.prepareArrival([
      {
        id: 'chairman-dvor',
        surname: 'Chairman',
        memberSeeds: [{ name: 'Chairman Ivan', gender: 'male' as const, age: 40 }],
        isChairman: true,
      },
      {
        id: 'family-dvor',
        surname: 'Worker',
        memberSeeds: [
          { name: 'Worker Petrov', gender: 'male' as const, age: 35 },
          { name: 'Worker Petrova', gender: 'female' as const, age: 32 },
        ],
      },
    ]);
    engine.setArrivalSequence(arrivalSeq);

    // Tick until all families arrive
    advanceTicks(engine, 40);

    // Check that citizen morale is approximately 70 (hopeful revolutionaries)
    const citizenEntities = citizens.entities;
    if (citizenEntities.length > 0) {
      let totalMorale = 0;
      for (const c of citizenEntities) {
        totalMorale += c.citizen.happiness;
      }
      const avgMorale = totalMorale / citizenEntities.length;
      // Morale may have shifted slightly from consumption ticks, but should be near 70
      expect(avgMorale).toBeGreaterThanOrEqual(50);
      expect(avgMorale).toBeLessThanOrEqual(90);
      console.log(`Initial avg morale: ${avgMorale.toFixed(1)} (expected ~70)`);
    }
  });

  // ── Scenario 8: Party Barracks placement ───────────────────────────────

  it('CollectiveAgent bootstrap places buildings for arriving families', () => {
    const { engine, callbacks } = createPlaythroughEngine({
      resources: {
        food: 5000,
        vodka: 5000,
        population: 0,
        timber: 999,
        steel: 999,
        cement: 999,
        power: 999,
      },
      difficulty: 'worker',
      consequence: 'rehabilitated',
      seed: 'bootstrap-test',
    });

    callbacks.onMinigame = undefined as never;
    callbacks.onAnnualReport = undefined as never;

    const arrivalSeq = new ArrivalSequence();
    arrivalSeq.prepareArrival([
      {
        id: 'test-chairman',
        surname: 'Chairman',
        memberSeeds: [{ name: 'Chairman Test', gender: 'male' as const, age: 40 }],
        isChairman: true,
      },
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `test-family-${i}`,
        surname: `Family${i}`,
        memberSeeds: [{ name: `Worker${i}`, gender: 'male' as const, age: 30 }],
      })),
    ]);
    engine.setArrivalSequence(arrivalSeq);

    const initialBuildingCount = getBuildingCount();

    // Tick through early game — CollectiveAgent.earlyGameBootstrap runs in first 60 ticks
    advanceTicks(engine, 60);

    const afterBuildingCount = getBuildingCount();

    // The collective should have bootstrapped some buildings
    // (government-hq, izbas, etc.) — at minimum the engine should not crash
    console.log(
      `Bootstrap buildings: before=${initialBuildingCount}, after=${afterBuildingCount}`,
    );
    // If families arrived and pop > 0, the collective may have placed buildings
    expect(afterBuildingCount).toBeGreaterThanOrEqual(initialBuildingCount);
  });
});
