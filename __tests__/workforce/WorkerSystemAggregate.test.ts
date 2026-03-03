/**
 * Tests for WorkerSystem aggregate mode — when RaionPool is defined on the
 * resource store, the system should operate on building workforces and
 * raion-level statistics instead of individual citizen entities.
 */

import type { WorkerTickContext } from '../../src/ai/agents/workforce/WorkerSystem';
import { WorkerSystem } from '../../src/ai/agents/workforce/WorkerSystem';
import type { BuildingComponent, RaionPool, Resources } from '../../src/ecs/world';
import { world } from '../../src/ecs/world';

/** Helper: create a minimal BuildingComponent with workforce fields zeroed. */
function makeBuilding(defId: string, opts?: Partial<BuildingComponent>): BuildingComponent {
  return {
    defId,
    level: 0,
    powered: true,
    powerReq: 0,
    powerOutput: 0,
    housingCap: 0,
    pollution: 0,
    fear: 0,
    workerCount: 0,
    residentCount: 0,
    avgMorale: 50,
    avgSkill: 30,
    avgLoyalty: 50,
    avgVodkaDep: 10,
    trudodniAccrued: 0,
    householdCount: 0,
    ...opts,
  };
}

/** Helper: create a minimal RaionPool, distributing laborForce across working-age buckets. */
function makeRaion(overrides?: Partial<RaionPool>): RaionPool {
  const maleBuckets = overrides?.maleAgeBuckets ?? new Array(20).fill(0);
  const femaleBuckets = overrides?.femaleAgeBuckets ?? new Array(20).fill(0);
  const laborForce = overrides?.laborForce ?? 200;

  // If no explicit age buckets provided, distribute laborForce evenly
  // across working-age buckets (3-12) so bucket sums stay consistent.
  if (!overrides?.maleAgeBuckets && !overrides?.femaleAgeBuckets && laborForce > 0) {
    const bucketsCount = 10; // buckets 3-12
    const perBucket = Math.floor(laborForce / 2 / bucketsCount);
    const maleRemainder = Math.floor(laborForce / 2) - perBucket * bucketsCount;
    const femaleTotal = laborForce - Math.floor(laborForce / 2);
    const fPerBucket = Math.floor(femaleTotal / bucketsCount);
    const femaleRemainder = femaleTotal - fPerBucket * bucketsCount;
    for (let i = 3; i <= 12; i++) {
      maleBuckets[i] = perBucket;
      femaleBuckets[i] = fPerBucket;
    }
    // Distribute remainders into first working-age bucket
    maleBuckets[3]! += maleRemainder;
    femaleBuckets[3]! += femaleRemainder;
  }

  return {
    totalPopulation: 250,
    totalHouseholds: 50,
    maleAgeBuckets: maleBuckets,
    femaleAgeBuckets: femaleBuckets,
    classCounts: { worker: 200, farmer: 30, engineer: 20 },
    birthsThisYear: 0,
    deathsThisYear: 0,
    totalBirths: 0,
    totalDeaths: 0,
    pregnancyWaves: [0, 0, 0],
    laborForce,
    assignedWorkers: 150,
    idleWorkers: 50,
    avgMorale: 50,
    avgLoyalty: 50,
    avgSkill: 30,
    ...overrides,
  };
}

/** Helper: make a full resource store for aggregate mode. */
function makeResources(raion: RaionPool): Resources {
  return {
    money: 1000,
    food: 500,
    vodka: 100,
    power: 50,
    powerUsed: 20,
    population: raion.totalPopulation,
    trudodni: 0,
    blat: 0,
    timber: 100,
    steel: 100,
    cement: 100,
    prefab: 0,
    seedFund: 0,
    emergencyReserve: 0,
    storageCapacity: 1000,
    raion,
  };
}

/** Helper: create a standard tick context. */
function makeTickCtx(overrides?: Partial<WorkerTickContext>): WorkerTickContext {
  return {
    vodkaAvailable: 100,
    foodAvailable: 500,
    heatingFailing: false,
    month: 6,
    eraId: 'revolution',
    totalTicks: 1,
    ...overrides,
  };
}

describe('WorkerSystem — aggregate mode', () => {
  let system: WorkerSystem;

  beforeEach(() => {
    world.clear();
    system = new WorkerSystem();
  });

  afterEach(() => {
    world.clear();
  });

  /** Set up a resource store with a raion. */
  function setupAggregateWorld(raion?: RaionPool) {
    const r = raion ?? makeRaion();
    world.add({ resources: makeResources(r), isResourceStore: true });
    return r;
  }

  // ── Mode detection ──────────────────────────────────────

  describe('isAggregateMode', () => {
    it('returns false when no raion on resource store', () => {
      world.add({
        resources: {
          money: 0,
          food: 0,
          vodka: 0,
          power: 0,
          powerUsed: 0,
          population: 10,
          trudodni: 0,
          blat: 0,
          timber: 0,
          steel: 0,
          cement: 0,
          prefab: 0,
          seedFund: 0,
          emergencyReserve: 0,
          storageCapacity: 0,
        },
        isResourceStore: true,
      });
      expect(system.isAggregateMode()).toBe(false);
    });

    it('returns true when raion is defined on resource store', () => {
      setupAggregateWorld();
      expect(system.isAggregateMode()).toBe(true);
    });
  });

  // ── getPopulation ───────────────────────────────────────

  describe('getPopulation', () => {
    it('returns raion.totalPopulation in aggregate mode', () => {
      setupAggregateWorld(makeRaion({ totalPopulation: 300 }));
      expect(system.getPopulation()).toBe(300);
    });
  });

  // ── getAverageMorale ────────────────────────────────────

  describe('getAverageMorale', () => {
    it('returns raion.avgMorale in aggregate mode', () => {
      setupAggregateWorld(makeRaion({ avgMorale: 75 }));
      expect(system.getAverageMorale()).toBe(75);
    });
  });

  // ── getAverageSkill ─────────────────────────────────────

  describe('getAverageSkill', () => {
    it('maps raion.avgSkill to [0.5..1.5] multiplier', () => {
      setupAggregateWorld(makeRaion({ avgSkill: 50 }));
      expect(system.getAverageSkill()).toBe(1.0);

      // Reset and test another value
      world.clear();
      setupAggregateWorld(makeRaion({ avgSkill: 0 }));
      expect(system.getAverageSkill()).toBe(0.5);

      world.clear();
      setupAggregateWorld(makeRaion({ avgSkill: 100 }));
      expect(system.getAverageSkill()).toBe(1.5);
    });
  });

  // ── spawnInflowDvor (aggregate) ─────────────────────────

  describe('spawnInflowDvor', () => {
    it('increments raion totals and idle workers', () => {
      const raion = setupAggregateWorld(makeRaion({ totalPopulation: 250, idleWorkers: 50, laborForce: 200 }));
      const result = system.spawnInflowDvor(10, 'moscow');

      expect(result).toEqual([]); // No entities in aggregate mode
      expect(raion.totalPopulation).toBe(260);
      expect(raion.idleWorkers).toBe(60);
      expect(raion.laborForce).toBe(210);
      expect(raion.totalHouseholds).toBe(51); // +1 household
    });

    it('blends incoming worker stats into raion averages', () => {
      const raion = setupAggregateWorld(
        makeRaion({
          totalPopulation: 100,
          avgMorale: 50,
          avgLoyalty: 50,
          avgSkill: 30,
        }),
      );

      system.spawnInflowDvor(100, 'resettlement', { morale: 10, loyalty: 10, skill: 10 });

      // 100 old at 50 + 100 new at 10 = (5000 + 1000) / 200 = 30
      expect(raion.avgMorale).toBe(30);
      expect(raion.avgLoyalty).toBe(30);
      expect(raion.avgSkill).toBe(20);
    });

    it('handles first inflow when raion is empty', () => {
      const raion = setupAggregateWorld(makeRaion({ totalPopulation: 0, avgMorale: 0, avgLoyalty: 0, avgSkill: 0 }));
      system.spawnInflowDvor(5, 'moscow', { morale: 80, loyalty: 70, skill: 60 });

      expect(raion.totalPopulation).toBe(5);
      expect(raion.avgMorale).toBe(80);
      expect(raion.avgLoyalty).toBe(70);
      expect(raion.avgSkill).toBe(60);
    });
  });

  // ── removeWorkersByCount (aggregate) ────────────────────

  describe('removeWorkersByCount', () => {
    it('removes from idle pool first', () => {
      const raion = setupAggregateWorld(
        makeRaion({
          totalPopulation: 100,
          idleWorkers: 10,
          laborForce: 100,
        }),
      );

      system.removeWorkersByCount(5, 'migration');

      expect(raion.totalPopulation).toBe(95);
      expect(raion.idleWorkers).toBe(5);
      expect(raion.laborForce).toBe(95);
    });

    it('removes from buildings when idle pool exhausted', () => {
      const raion = setupAggregateWorld(
        makeRaion({
          totalPopulation: 100,
          idleWorkers: 2,
          assignedWorkers: 98,
          laborForce: 100,
        }),
      );

      // Add a building with workers
      world.add({
        building: makeBuilding('factory-a', { workerCount: 30, avgMorale: 40 }),
        position: { gridX: 0, gridY: 0 },
      });

      system.removeWorkersByCount(5, 'migration');

      expect(raion.totalPopulation).toBe(95);
      expect(raion.idleWorkers).toBe(0); // 2 removed from idle
      // 3 more removed from building
    });

    it('does nothing when count is 0', () => {
      const raion = setupAggregateWorld(makeRaion({ totalPopulation: 100 }));
      system.removeWorkersByCount(0, 'test');
      expect(raion.totalPopulation).toBe(100);
    });
  });

  // ── removeWorkersByCountMaleFirst (aggregate) ───────────

  describe('removeWorkersByCountMaleFirst', () => {
    it('removes from male age buckets 3-10 first', () => {
      const maleBuckets = new Array(20).fill(0);
      const femaleBuckets = new Array(20).fill(0);
      maleBuckets[6] = 20; // 30-34 year old males
      maleBuckets[7] = 15; // 35-39 year old males
      femaleBuckets[6] = 10; // 30-34 year old females
      const raion = makeRaion({
        totalPopulation: 100,
        laborForce: 45,
        maleAgeBuckets: maleBuckets,
        femaleAgeBuckets: femaleBuckets,
      });
      setupAggregateWorld(raion);

      // Add building so removeWorkersFromBuildings has something
      world.add({
        building: makeBuilding('factory-a', { workerCount: 50 }),
        position: { gridX: 0, gridY: 0 },
      });

      const removed = system.removeWorkersByCountMaleFirst(25, 'conscription');

      expect(removed).toBe(25);
      expect(raion.maleAgeBuckets[6]).toBe(0); // Took all 20
      expect(raion.maleAgeBuckets[7]).toBe(10); // Took 5 more
      expect(raion.femaleAgeBuckets[6]).toBe(10); // Untouched — males sufficed
      expect(raion.totalPopulation).toBe(75);
    });

    it('falls back to female buckets when males exhausted', () => {
      const maleBuckets = new Array(20).fill(0);
      const femaleBuckets = new Array(20).fill(0);
      maleBuckets[6] = 3;
      femaleBuckets[6] = 10;
      const raion = makeRaion({
        totalPopulation: 50,
        laborForce: 13,
        idleWorkers: 50,
        maleAgeBuckets: maleBuckets,
        femaleAgeBuckets: femaleBuckets,
      });
      setupAggregateWorld(raion);

      const removed = system.removeWorkersByCountMaleFirst(8, 'conscription');

      expect(removed).toBe(8);
      expect(raion.maleAgeBuckets[6]).toBe(0); // All 3 males taken
      expect(raion.femaleAgeBuckets[6]).toBe(5); // 5 females taken
    });
  });

  // ── arrestWorker (aggregate) ────────────────────────────

  describe('arrestWorker', () => {
    it('decrements population in aggregate mode', () => {
      const raion = setupAggregateWorld(makeRaion({ totalPopulation: 100, idleWorkers: 10, laborForce: 100 }));

      const event = system.arrestWorker();

      expect(event).not.toBeNull();
      expect(event!.reason).toBe('kgb_arrest');
      expect(raion.totalPopulation).toBe(99);
    });

    it('returns null when population is 0', () => {
      setupAggregateWorld(makeRaion({ totalPopulation: 0 }));
      expect(system.arrestWorker()).toBeNull();
    });
  });

  // ── tick (aggregate) ────────────────────────────────────

  describe('tick', () => {
    it('processes buildings and returns valid WorkerTickResult', () => {
      const _raion = setupAggregateWorld(makeRaion({ totalPopulation: 100, avgMorale: 60 }));

      // Add staffed buildings
      world.add({
        building: makeBuilding('factory-a', {
          workerCount: 20,
          avgMorale: 60,
          avgSkill: 40,
          avgLoyalty: 60,
          avgVodkaDep: 15,
        }),
        position: { gridX: 0, gridY: 0 },
      });
      world.add({
        building: makeBuilding('collective-farm', {
          workerCount: 30,
          avgMorale: 55,
          avgSkill: 25,
          avgLoyalty: 70,
          avgVodkaDep: 10,
        }),
        position: { gridX: 5, gridY: 5 },
      });

      const result = system.tick(makeTickCtx());

      expect(result.population).toBe(100);
      expect(result.vodkaConsumed).toBeGreaterThan(0);
      expect(result.foodConsumed).toBeGreaterThan(0);
      expect(result.averageMorale).toBeGreaterThan(0);
    });

    it('applies food shortage penalty in aggregate mode', () => {
      setupAggregateWorld(makeRaion({ totalPopulation: 100 }));

      const building = world.add({
        building: makeBuilding('factory-a', {
          workerCount: 50,
          avgMorale: 70,
          avgSkill: 30,
          avgLoyalty: 50,
          avgVodkaDep: 10,
        }),
        position: { gridX: 0, gridY: 0 },
      });

      // Very low food
      system.tick(makeTickCtx({ foodAvailable: 0 }));

      expect(building.building!.avgMorale).toBeLessThan(70);
    });

    it('accrues trudodni on buildings per tick', () => {
      setupAggregateWorld(makeRaion({ totalPopulation: 100 }));

      const building = world.add({
        building: makeBuilding('factory-a', {
          workerCount: 10,
          avgMorale: 60,
          avgSkill: 30,
          avgLoyalty: 50,
          avgVodkaDep: 10,
        }),
        position: { gridX: 0, gridY: 0 },
      });

      system.tick(makeTickCtx());

      // TRUDODNI_PER_TICK = 0.5, 10 workers = 5 per tick
      expect(building.building!.trudodniAccrued).toBe(5);
    });

    it('handles empty buildings gracefully', () => {
      const _raion = setupAggregateWorld(makeRaion({ totalPopulation: 50, idleWorkers: 50, assignedWorkers: 0 }));

      // Building with 0 workers
      world.add({
        building: makeBuilding('factory-a', { workerCount: 0 }),
        position: { gridX: 0, gridY: 0 },
      });

      const result = system.tick(makeTickCtx());

      expect(result.population).toBe(50);
      expect(result.vodkaConsumed).toBe(0);
      expect(result.foodConsumed).toBe(0);
    });
  });

  // ── clearAllWorkers (aggregate) ─────────────────────────

  describe('clearAllWorkers', () => {
    it('resets building workforce fields and removes raion', () => {
      setupAggregateWorld();

      world.add({
        building: makeBuilding('factory-a', { workerCount: 20, avgMorale: 70 }),
        position: { gridX: 0, gridY: 0 },
      });

      system.clearAllWorkers();

      // Raion should be cleared
      expect(system.isAggregateMode()).toBe(false);

      // Building workforce should be zeroed
      const buildings = [...world.with('building')];
      expect(buildings[0]!.building!.workerCount).toBe(0);
      expect(buildings[0]!.building!.avgMorale).toBe(0);
    });
  });

  // ── syncPopulationFromDvory (aggregate) ─────────────────

  describe('syncPopulationFromDvory', () => {
    it('returns raion.totalPopulation in aggregate mode', () => {
      setupAggregateWorld(makeRaion({ totalPopulation: 350 }));
      expect(system.syncPopulationFromDvory()).toBe(350);
    });
  });

  // ── NaN population guards ─────────────────────────────────

  describe('NaN population guards', () => {
    it('removeWorkersAggregate clamps totalPopulation to >= 0', () => {
      // Set up a raion where totalPopulation is less than the removal count
      // (simulating an already-corrupted pool)
      const raion = makeRaion({
        totalPopulation: 5,
        laborForce: 5,
        idleWorkers: 5,
        assignedWorkers: 0,
      });
      // Put all 5 workers in male bucket 5
      const maleBuckets = new Array(20).fill(0);
      maleBuckets[5] = 5;
      raion.maleAgeBuckets = maleBuckets;
      raion.femaleAgeBuckets = new Array(20).fill(0);

      setupAggregateWorld(raion);

      // Remove more than available (10 > 5)
      system.removeWorkersByCount(10, 'test');

      expect(raion.totalPopulation).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(raion.totalPopulation)).toBe(true);
    });

    it('removeWorkersMaleFirstAggregate clamps totalPopulation to >= 0', () => {
      const maleBuckets = new Array(20).fill(0);
      maleBuckets[5] = 3;
      const raion = makeRaion({
        totalPopulation: 3,
        laborForce: 3,
        idleWorkers: 0,
        assignedWorkers: 3,
        maleAgeBuckets: maleBuckets,
        femaleAgeBuckets: new Array(20).fill(0),
      });

      setupAggregateWorld(raion);

      // Add a building with workers for the removal to consume
      world.add({
        building: makeBuilding('factory_basic', { workerCount: 3, avgMorale: 50, avgSkill: 30, avgLoyalty: 50 }),
      });

      // Remove more than available
      const removed = system.removeWorkersByCountMaleFirst(10, 'conscription');

      expect(raion.totalPopulation).toBeGreaterThanOrEqual(0);
      expect(removed).toBeLessThanOrEqual(3);
    });

    it('defection clamps totalPopulation and syncs age buckets', () => {
      // Create a building with very low loyalty to trigger defection
      const maleBuckets = new Array(20).fill(0);
      maleBuckets[5] = 100;
      const raion = makeRaion({
        totalPopulation: 100,
        laborForce: 100,
        idleWorkers: 0,
        assignedWorkers: 100,
        maleAgeBuckets: maleBuckets,
        femaleAgeBuckets: new Array(20).fill(0),
      });

      setupAggregateWorld(raion);

      // Building with 100 workers and loyalty=0 → defection chance = 0.02
      world.add({
        building: makeBuilding('factory_basic', {
          workerCount: 100,
          avgMorale: 50,
          avgSkill: 30,
          avgLoyalty: 0, // triggers defection
          avgVodkaDep: 10,
        }),
        position: { gridX: 0, gridY: 0 },
      });

      const _result = system.tick(makeTickCtx());

      expect(raion.totalPopulation).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(raion.totalPopulation)).toBe(true);

      // Verify age buckets are non-negative after defection
      for (let i = 0; i < 20; i++) {
        expect(raion.maleAgeBuckets[i]).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
