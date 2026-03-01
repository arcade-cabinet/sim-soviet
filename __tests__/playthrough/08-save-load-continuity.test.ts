import { world } from '../../src/ecs/world';
import { placeNewBuilding } from '../../src/ecs/factories';
import {
  createPlaythroughEngine,
  advanceTicks,
  getResources,
  getDate,
  isGameOver,
  buildBasicSettlement,
  buildFullEconomy,
} from './helpers';

describe('Playthrough: Save/Load Continuity', () => {
  afterEach(() => {
    world.clear();
    jest.restoreAllMocks();
  });

  // ── Scenario 1: Mid-game serialize/restore ──────────────────────────────

  it('serializes and restores subsystem state after 500 ticks', () => {
    const { engine } = createPlaythroughEngine({
      resources: { food: 5000, money: 10000, population: 50, power: 100 },
    });
    buildBasicSettlement();

    // Run 500 ticks of gameplay
    advanceTicks(engine, 500);

    // Record key state before serialization
    const dateBeforeSave = { ...getDate() };
    const personnelBefore = engine.getPersonnelFile();
    const marksBefore = personnelBefore.getEffectiveMarks();
    const quotaBefore = { ...engine.getQuota() };
    const settlementTierBefore = engine.getSettlement().getCurrentTier();

    // Serialize all subsystem state
    const savedData = engine.serializeSubsystems();
    expect(savedData).toBeDefined();
    expect(savedData.era).toBeDefined();
    expect(savedData.personnel).toBeDefined();
    expect(savedData.settlement).toBeDefined();
    expect(savedData.quota).toBeDefined();
    expect(savedData.chronology).toBeDefined();

    // Create a FRESH engine
    const { engine: restoredEngine } = createPlaythroughEngine({
      resources: { food: 5000, money: 10000, population: 50, power: 100 },
    });
    buildBasicSettlement();

    // Restore subsystem state
    restoredEngine.restoreSubsystems(savedData);

    // Verify: date matches (use chronology system directly — meta entity
    // date is only synced during tick, not during restoreSubsystems)
    const chronoDate = restoredEngine.getChronology().getDate();
    expect(chronoDate.year).toBe(dateBeforeSave.year);
    expect(chronoDate.month).toBe(dateBeforeSave.month);

    // Verify: personnel marks match
    const personnelAfter = restoredEngine.getPersonnelFile();
    expect(personnelAfter.getEffectiveMarks()).toBe(marksBefore);

    // Verify: quota state matches
    const quotaAfter = restoredEngine.getQuota();
    expect(quotaAfter.type).toBe(quotaBefore.type);
    expect(quotaAfter.target).toBe(quotaBefore.target);
    expect(quotaAfter.deadlineYear).toBe(quotaBefore.deadlineYear);

    // Verify: settlement tier matches
    expect(restoredEngine.getSettlement().getCurrentTier()).toBe(settlementTierBefore);
  });

  // ── Scenario 2: Tick continuity after restore ───────────────────────────

  it('continues ticking identically after restore', () => {
    // Engine A: create and run 500 ticks
    const { engine: engineA } = createPlaythroughEngine({
      resources: { food: 5000, money: 10000, population: 50, power: 100 },
    });
    buildBasicSettlement();
    advanceTicks(engineA, 500);

    // Serialize engine A
    const savedData = engineA.serializeSubsystems();

    // Continue engine A for 100 more ticks
    advanceTicks(engineA, 100);
    const dateA = engineA.getChronology().getDate();
    const marksA = engineA.getPersonnelFile().getEffectiveMarks();
    const quotaA = { ...engineA.getQuota() };

    // Engine B: fresh engine, restore, then run 100 ticks
    const { engine: engineB } = createPlaythroughEngine({
      resources: { food: 5000, money: 10000, population: 50, power: 100 },
    });
    buildBasicSettlement();
    engineB.restoreSubsystems(savedData);
    advanceTicks(engineB, 100);

    const dateB = engineB.getChronology().getDate();
    const marksB = engineB.getPersonnelFile().getEffectiveMarks();
    const quotaB = engineB.getQuota();

    // Both engines should be in the same state (compare chronology dates
    // directly since meta entity date only syncs during ticks on the
    // engine that owns that world)
    expect(dateB.year).toBe(dateA.year);
    expect(dateB.month).toBe(dateA.month);
    expect(dateB.totalTicks).toBe(dateA.totalTicks);
    expect(marksB).toBe(marksA);
    expect(quotaB.type).toBe(quotaA.type);
    expect(quotaB.target).toBe(quotaA.target);
    expect(quotaB.deadlineYear).toBe(quotaA.deadlineYear);
  });

  // ── Scenario 3: Serialize with buildings under construction ─────────────

  it('subsystem state survives serialize/restore with active construction', () => {
    const { engine } = createPlaythroughEngine({
      resources: { food: 5000, money: 10000, population: 50, power: 100,
        timber: 500, steel: 500, cement: 500 },
    });

    // Place buildings that start in foundation phase
    const farm = placeNewBuilding(0, 0, 'collective-farm-hq');
    const powerStation = placeNewBuilding(4, 0, 'power-station');

    // Verify they start in construction phase
    expect(farm.building.constructionPhase).toBe('foundation');
    expect(powerStation.building.constructionPhase).toBe('foundation');

    // Tick 5 times — buildings should still be under construction
    advanceTicks(engine, 5);
    expect(farm.building.constructionPhase).not.toBe('complete');

    // Serialize subsystem state
    const savedData = engine.serializeSubsystems();
    expect(savedData).toBeDefined();

    // Record subsystem state
    const dateBefore = { ...getDate() };
    const quotaBefore = { ...engine.getQuota() };

    // Create fresh engine and restore
    const { engine: restoredEngine } = createPlaythroughEngine({
      resources: { food: 5000, money: 10000, population: 50, power: 100,
        timber: 500, steel: 500, cement: 500 },
    });
    restoredEngine.restoreSubsystems(savedData);

    // Verify subsystem state restored correctly
    const dateAfter = getDate();
    expect(dateAfter.year).toBe(dateBefore.year);
    expect(dateAfter.month).toBe(dateBefore.month);
    expect(restoredEngine.getQuota().target).toBe(quotaBefore.target);

    // Engine should continue ticking without errors after restore
    expect(() => advanceTicks(restoredEngine, 100)).not.toThrow();
    expect(isGameOver()).toBe(false);
  });

  // ── Scenario 4: Serialize at year boundary ──────────────────────────────

  it('correctly handles quota evaluation after restore near year boundary', () => {
    // Start at 1926 month 11 to get close to deadline year 1927
    const { engine } = createPlaythroughEngine({
      resources: { food: 5000, money: 10000, population: 50, power: 100 },
      meta: { date: { year: 1926, month: 11, tick: 0 } },
    });
    buildBasicSettlement({ farms: 3 });

    // Advance 60 ticks (2 months) to approach year boundary
    advanceTicks(engine, 60);

    // Serialize near the deadline
    const savedData = engine.serializeSubsystems();
    const dateBefore = { ...getDate() };

    // Create fresh engine with same initial meta
    const { engine: restoredEngine } = createPlaythroughEngine({
      resources: { food: 5000, money: 10000, population: 50, power: 100 },
      meta: { date: { year: 1926, month: 11, tick: 0 } },
    });
    buildBasicSettlement({ farms: 3 });
    restoredEngine.restoreSubsystems(savedData);

    // Verify restore got us to the right date
    expect(getDate().year).toBe(dateBefore.year);

    // Continue ticking past the deadline year — should not crash
    expect(() => advanceTicks(restoredEngine, 120)).not.toThrow();

    // The game should have progressed past the deadline
    const finalDate = getDate();
    expect(finalDate.year).toBeGreaterThanOrEqual(1927);
  });
});
