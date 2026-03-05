/**
 * Tests for aggregate population mode serialization.
 *
 * Validates that the save/load system correctly handles:
 * - Entity mode (existing behavior, backward compat)
 * - Aggregate mode (RaionPool + per-building workforce)
 * - Old saves without populationMode field
 * - Round-trip fidelity
 *
 * Uses direct serialize/restore functions (not SimulationEngine) to
 * minimize the module graph footprint.
 */

import { buildingsLogic, getResourceEntity } from '../../src/ecs/archetypes';
import { createBuilding } from '../../src/ecs/factories';
import { createMetaStore, createResourceStore } from '../../src/ecs/factories/storeFactories';
import type { RaionPool } from '../../src/ecs/world';
import { world } from '../../src/ecs/world';
import type { SerializableEngine } from '../../src/game/engine/serializeEngine';

// ─── Mock all subsystem deserialize statics ──────────────────────────────────
// restoreSubsystems calls Class.deserialize(data) for each subsystem. We mock
// them to return stubs so the test focuses solely on population path logic.

const stubObj = () => new Proxy({}, { get: () => () => {} }) as never;

jest.mock('../../src/ai/agents/political/KGBAgent', () => ({
  PersonnelFile: { deserialize: () => stubObj() },
}));
jest.mock('../../src/ai/agents/political/ScoringSystem', () => ({
  ScoringSystem: { deserialize: () => stubObj() },
}));
jest.mock('../../src/ai/agents/political/CompulsoryDeliveries', () => ({
  CompulsoryDeliveries: { deserialize: () => stubObj() },
}));
jest.mock('../../src/ai/agents/political/PoliticalEntitySystem', () => ({
  PoliticalEntitySystem: { deserialize: () => stubObj() },
}));
jest.mock('../../src/ai/agents/infrastructure/SettlementSystem', () => ({
  SettlementSystem: { deserialize: () => stubObj() },
}));
jest.mock('../../src/ai/agents/infrastructure/TransportSystem', () => ({
  TransportSystem: { deserialize: () => stubObj() },
}));
jest.mock('../../src/ai/agents/core/ChronologyAgent', () => ({
  ChronologySystem: { deserialize: () => stubObj() },
}));
jest.mock('../../src/ai/agents/economy/EconomyAgent', () => ({
  EconomySystem: { deserialize: () => stubObj() },
}));
jest.mock('../../src/ai/agents/narrative/events', () => ({
  EventSystem: { deserialize: () => stubObj() },
}));
jest.mock('../../src/ai/agents/narrative/pravda', () => ({
  PravdaSystem: { deserialize: () => stubObj() },
}));
jest.mock('../../src/ai/agents/narrative/politburo', () => ({
  PolitburoSystem: { deserialize: () => stubObj() },
}));
jest.mock('../../src/ai/agents/meta/minigames/MinigameRouter', () => ({
  MinigameRouter: { deserialize: () => stubObj() },
}));
jest.mock('../../src/ai/agents/meta/TutorialSystem', () => ({
  TutorialSystem: { deserialize: () => stubObj() },
}));
jest.mock('../../src/ai/agents/meta/AchievementTracker', () => ({
  AchievementTracker: { deserialize: () => stubObj() },
}));
jest.mock('../../src/ai/agents/social/DefenseAgent', () => ({
  FireSystem: { deserialize: () => stubObj() },
}));
jest.mock('../../src/game/era', () => ({
  EraSystem: { deserialize: () => stubObj() },
}));

// Import AFTER mocks are set up
import { restoreSubsystems, serializeSubsystems } from '../../src/game/engine/serializeEngine';

// ─── Minimal mock engine for serialization tests ─────────────────────────────

/**
 * Build a minimal mock that satisfies SerializableEngine.
 * All subsystem deserializers are jest.mock'd above, so serialize()
 * just returns empty stubs.
 */
function createMockSerializableEngine(): SerializableEngine {
  const stub = () => ({}) as never;
  return {
    chronology: { serialize: stub } as never,
    eraSystem: { serialize: stub, getCurrentEraId: () => 'revolution' } as never,
    economySystem: { serialize: stub, setRng: () => {}, setEra: () => {} } as never,
    eventSystem: { serialize: stub } as never,
    pravdaSystem: { serialize: stub } as never,
    politburo: { serialize: stub } as never,
    personnelFile: { serialize: stub, serializeLawEnforcement: stub } as never,
    deliveries: { serialize: stub, setRng: () => {} } as never,
    settlement: { serialize: stub } as never,
    politicalEntities: { serialize: stub } as never,
    minigameRouter: { serialize: stub } as never,
    scoring: { serialize: stub } as never,
    tutorial: { serialize: stub } as never,
    achievements: { serialize: stub } as never,
    mandateState: null,
    transport: { serialize: stub, setRng: () => {} } as never,
    fireSystem: { serialize: stub } as never,
    workerSystem: {
      getStatsMap: () => new Map(),
      clearAllWorkers: () => {},
      syncPopulationFromDvory: () => {},
      restoreWorkerStats: () => {},
      getPopulation: () => 0,
    } as never,
    quota: { type: 'food', target: 100, current: 0, deadlineYear: 1922 },
    consecutiveQuotaFailures: 0,
    pripiskiCount: 0,
    lastSeason: 'winter',
    lastWeather: 'clear',
    lastDayPhase: 'day',
    lastThreatLevel: 'low',
    pendingReport: false,
    pendingReportSinceTick: 0,
    ended: false,
    rng: { next: () => 0.5 } as never,
    eventHandler: () => {},
    politburoEventHandler: () => {},
    syncSystemsToMeta: () => {},
    arcologies: [],
    foragingState: {},
    lastInflowYear: {},
    evacueeInfluxFired: false,
  };
}

/** Create a sample RaionPool for testing. */
function createTestRaionPool(): RaionPool {
  return {
    totalPopulation: 150,
    totalHouseholds: 30,
    maleAgeBuckets: [5, 8, 12, 15, 10, 8, 6, 4, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    femaleAgeBuckets: [5, 7, 11, 14, 12, 9, 7, 5, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    classCounts: { worker: 80, farmer: 40, engineer: 20, party_official: 10 },
    birthsThisYear: 5,
    deathsThisYear: 2,
    totalBirths: 25,
    totalDeaths: 10,
    pregnancyWaves: [3, 2, 1],
    laborForce: 100,
    assignedWorkers: 75,
    idleWorkers: 25,
    avgMorale: 55,
    avgLoyalty: 60,
    avgSkill: 45,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Aggregate Serialization', () => {
  beforeEach(() => {
    world.clear();
  });

  afterEach(() => {
    world.clear();
  });

  // ── Scenario 1: Entity mode serialization ─────────────────────────────────

  it('serializes in entity mode with populationMode: entity and no raionPool', () => {
    createResourceStore({ food: 5000, money: 10000, population: 0 });
    createMetaStore();

    const engine = createMockSerializableEngine();
    const saved = serializeSubsystems(engine);

    expect(saved.populationMode).toBe('entity');
    expect(saved.raionPool).toBeUndefined();
    expect(saved.buildingWorkforce).toBeUndefined();
  });

  // ── Scenario 2: Aggregate mode serialization ──────────────────────────────

  it('serializes in aggregate mode with raionPool and buildingWorkforce', () => {
    createResourceStore({ food: 5000, money: 10000, population: 0 });
    createMetaStore();

    // Set up aggregate mode by assigning raion to resource store
    const store = getResourceEntity()!;
    store.resources.raion = createTestRaionPool();

    // Place some buildings with workforce data
    const farm = createBuilding(0, 0, 'collective-farm-hq');
    farm.building!.workerCount = 15;
    farm.building!.avgMorale = 60;
    farm.building!.avgSkill = 50;
    farm.building!.avgLoyalty = 55;
    farm.building!.avgVodkaDep = 20;
    farm.building!.trudodniAccrued = 120;

    const housing = createBuilding(2, 0, 'apartment-tower-a');
    housing.building!.residentCount = 30;
    housing.building!.householdCount = 8;
    housing.building!.avgMorale = 65;

    const engine = createMockSerializableEngine();
    const saved = serializeSubsystems(engine);

    // Verify population mode
    expect(saved.populationMode).toBe('aggregate');

    // Verify RaionPool saved
    expect(saved.raionPool).toBeDefined();
    expect(saved.raionPool!.totalPopulation).toBe(150);
    expect(saved.raionPool!.totalHouseholds).toBe(30);
    expect(saved.raionPool!.maleAgeBuckets).toHaveLength(20);
    expect(saved.raionPool!.femaleAgeBuckets).toHaveLength(20);
    expect(saved.raionPool!.classCounts.worker).toBe(80);
    expect(saved.raionPool!.laborForce).toBe(100);
    expect(saved.raionPool!.avgMorale).toBe(55);
    expect(saved.raionPool!.pregnancyWaves).toEqual([3, 2, 1]);

    // Verify building workforce saved
    expect(saved.buildingWorkforce).toBeDefined();
    expect(saved.buildingWorkforce!.length).toBe(2);

    const farmEntry = saved.buildingWorkforce!.find((b) => b.defId === 'collective-farm-hq');
    expect(farmEntry).toBeDefined();
    expect(farmEntry!.workerCount).toBe(15);
    expect(farmEntry!.avgMorale).toBe(60);
    expect(farmEntry!.trudodniAccrued).toBe(120);

    const housingEntry = saved.buildingWorkforce!.find((b) => b.defId === 'apartment-tower-a');
    expect(housingEntry).toBeDefined();
    expect(housingEntry!.residentCount).toBe(30);
    expect(housingEntry!.householdCount).toBe(8);

    // Entity-mode fields should NOT be present
    expect(saved.dvory).toBeUndefined();
    expect(saved.workers).toBeUndefined();
  });

  // ── Scenario 3: Backward compat (old saves without populationMode) ────────

  it('restores old saves without populationMode field as entity mode', () => {
    createResourceStore({ food: 5000, money: 10000, population: 0 });
    createMetaStore();

    const engine = createMockSerializableEngine();
    const saved = serializeSubsystems(engine);

    // Simulate an old save by deleting populationMode
    delete (saved as Record<string, unknown>).populationMode;

    // Create fresh world
    world.clear();
    createResourceStore({ food: 5000, money: 10000, population: 0 });
    createMetaStore();

    const engine2 = createMockSerializableEngine();

    // Should not throw — defaults to entity mode
    expect(() => restoreSubsystems(engine2, saved)).not.toThrow();

    // Verify no raion was created
    const store = getResourceEntity()!;
    expect(store.resources.raion).toBeUndefined();
  });

  // ── Scenario 4: Aggregate round-trip ──────────────────────────────────────

  it('round-trips aggregate mode: serialize → restore → serialize = same data', () => {
    createResourceStore({ food: 5000, money: 10000, population: 0 });
    createMetaStore();

    // Set up aggregate mode
    const store = getResourceEntity()!;
    store.resources.raion = createTestRaionPool();

    // Place buildings with workforce
    const farm = createBuilding(0, 0, 'collective-farm-hq');
    farm.building!.workerCount = 15;
    farm.building!.avgMorale = 60;
    farm.building!.avgSkill = 50;
    farm.building!.avgLoyalty = 55;
    farm.building!.avgVodkaDep = 20;
    farm.building!.trudodniAccrued = 120;
    farm.building!.householdCount = 0;

    const housing = createBuilding(2, 0, 'apartment-tower-a');
    housing.building!.residentCount = 30;
    housing.building!.householdCount = 8;
    housing.building!.avgMorale = 65;

    const engine1 = createMockSerializableEngine();
    const saved1 = serializeSubsystems(engine1);

    // Create fresh world and restore
    world.clear();
    createResourceStore({ food: 5000, money: 10000, population: 0 });
    createMetaStore();

    // Re-create the same buildings (restore will set their workforce fields)
    createBuilding(0, 0, 'collective-farm-hq');
    createBuilding(2, 0, 'apartment-tower-a');

    const engine2 = createMockSerializableEngine();
    restoreSubsystems(engine2, saved1);

    // Verify raion was restored
    const restoredStore = getResourceEntity()!;
    expect(restoredStore.resources.raion).toBeDefined();
    expect(restoredStore.resources.raion!.totalPopulation).toBe(150);
    expect(restoredStore.resources.population).toBe(150);

    // Verify building workforce was restored
    const allBuildings = [...buildingsLogic];
    const restoredFarm = allBuildings.find((b) => b.building.defId === 'collective-farm-hq');
    expect(restoredFarm).toBeDefined();
    expect(restoredFarm!.building.workerCount).toBe(15);
    expect(restoredFarm!.building.avgMorale).toBe(60);
    expect(restoredFarm!.building.trudodniAccrued).toBe(120);

    const restoredHousing = allBuildings.find((b) => b.building.defId === 'apartment-tower-a');
    expect(restoredHousing).toBeDefined();
    expect(restoredHousing!.building.residentCount).toBe(30);
    expect(restoredHousing!.building.householdCount).toBe(8);

    // Serialize again and compare key fields
    const saved2 = serializeSubsystems(engine2);
    expect(saved2.populationMode).toBe('aggregate');
    expect(saved2.raionPool!.totalPopulation).toBe(saved1.raionPool!.totalPopulation);
    expect(saved2.raionPool!.totalHouseholds).toBe(saved1.raionPool!.totalHouseholds);
    expect(saved2.raionPool!.maleAgeBuckets).toEqual(saved1.raionPool!.maleAgeBuckets);
    expect(saved2.raionPool!.femaleAgeBuckets).toEqual(saved1.raionPool!.femaleAgeBuckets);
    expect(saved2.raionPool!.classCounts).toEqual(saved1.raionPool!.classCounts);
    expect(saved2.raionPool!.pregnancyWaves).toEqual(saved1.raionPool!.pregnancyWaves);
    expect(saved2.raionPool!.laborForce).toBe(saved1.raionPool!.laborForce);
    expect(saved2.raionPool!.avgMorale).toBe(saved1.raionPool!.avgMorale);
    expect(saved2.raionPool!.avgLoyalty).toBe(saved1.raionPool!.avgLoyalty);
    expect(saved2.raionPool!.avgSkill).toBe(saved1.raionPool!.avgSkill);

    // Building workforce should match
    expect(saved2.buildingWorkforce!.length).toBe(saved1.buildingWorkforce!.length);
    for (const entry1 of saved1.buildingWorkforce!) {
      const entry2 = saved2.buildingWorkforce!.find((b) => b.gridX === entry1.gridX && b.gridY === entry1.gridY);
      expect(entry2).toBeDefined();
      expect(entry2!.workerCount).toBe(entry1.workerCount);
      expect(entry2!.residentCount).toBe(entry1.residentCount);
      expect(entry2!.avgMorale).toBe(entry1.avgMorale);
      expect(entry2!.avgSkill).toBe(entry1.avgSkill);
      expect(entry2!.avgLoyalty).toBe(entry1.avgLoyalty);
      expect(entry2!.avgVodkaDep).toBe(entry1.avgVodkaDep);
      expect(entry2!.trudodniAccrued).toBe(entry1.trudodniAccrued);
      expect(entry2!.householdCount).toBe(entry1.householdCount);
    }
  });

  // ── Scenario 5: Aggregate restore sets population count ───────────────────

  it('restores population count from raionPool.totalPopulation', () => {
    createResourceStore({ food: 5000, money: 10000, population: 0 });
    createMetaStore();

    const store = getResourceEntity()!;
    store.resources.raion = createTestRaionPool();

    const engine = createMockSerializableEngine();
    const saved = serializeSubsystems(engine);

    // Restore into fresh world
    world.clear();
    createResourceStore({ food: 5000, money: 10000, population: 0 });
    createMetaStore();

    const engine2 = createMockSerializableEngine();
    restoreSubsystems(engine2, saved);

    const restoredStore = getResourceEntity()!;
    expect(restoredStore.resources.population).toBe(150);
    expect(restoredStore.resources.raion!.totalPopulation).toBe(150);
  });

  // ── Scenario 6: Arrays are deep-copied (not shared references) ────────────

  it('deep-copies arrays so mutations do not affect saved data', () => {
    createResourceStore({ food: 5000, money: 10000, population: 0 });
    createMetaStore();

    const store = getResourceEntity()!;
    store.resources.raion = createTestRaionPool();

    const engine = createMockSerializableEngine();
    const saved = serializeSubsystems(engine);

    // Mutate the original raion pool
    store.resources.raion!.maleAgeBuckets[0] = 999;
    store.resources.raion!.pregnancyWaves[0] = 999;

    // Saved data should be unaffected
    expect(saved.raionPool!.maleAgeBuckets[0]).toBe(5);
    expect(saved.raionPool!.pregnancyWaves[0]).toBe(3);
  });

  // ── Scenario 7: Restore deep-copies too ────────────────────────────────────

  it('deep-copies on restore so saved data is independent of restored state', () => {
    createResourceStore({ food: 5000, money: 10000, population: 0 });
    createMetaStore();

    const store = getResourceEntity()!;
    store.resources.raion = createTestRaionPool();

    const engine = createMockSerializableEngine();
    const saved = serializeSubsystems(engine);

    // Restore into fresh world
    world.clear();
    createResourceStore({ food: 5000, money: 10000, population: 0 });
    createMetaStore();

    const engine2 = createMockSerializableEngine();
    restoreSubsystems(engine2, saved);

    // Mutate the restored raion
    const restoredStore = getResourceEntity()!;
    restoredStore.resources.raion!.maleAgeBuckets[0] = 999;

    // Original saved data should be unaffected
    expect(saved.raionPool!.maleAgeBuckets[0]).toBe(5);
  });
});
