/**
 * Playthrough 07 — Autonomous Collective
 *
 * Integration tests for the collective autonomy system: demand detection,
 * auto-build placement, material requirements, construction cap, and
 * chairman meddling feedback.
 */

import { underConstruction } from '../../src/ecs/archetypes';
import { createBuilding, placeNewBuilding } from '../../src/ecs/factories';
import { world } from '../../src/ecs/world';
import { advanceTicks, createPlaythroughEngine, getBuildingCount } from './helpers';

describe('Playthrough: Autonomous Collective', () => {
  afterEach(() => {
    world.clear();
    jest.restoreAllMocks();
  });

  // ── Scenario 1: Low food triggers demand → auto-build farm ──────────────

  it('low food triggers collective to auto-build a farm', () => {
    // population=30, food=80 → food per capita = 2.67 (below FOOD_DEMAND_THRESHOLD of 3.0)
    // Generous timber/steel/vodka/money to survive 120+ ticks of consumption/heating
    const { engine } = createPlaythroughEngine({
      resources: {
        population: 30,
        food: 80,
        timber: 999,
        steel: 999,
        money: 9999,
        vodka: 9999,
        power: 9999,
        cement: 999,
      },
    });

    // Place a power-station so the auto-builder has a reference building
    // and so power demand doesn't interfere.
    // createBuilding makes it instantly operational.
    createBuilding(15, 15, 'power-station');
    // Also place housing so population doesn't trigger housing demand instead
    createBuilding(17, 15, 'apartment-tower-a');

    const initialCount = getBuildingCount();

    // Advance well past the collective check interval (fires at totalTicks=60, 90, 120...)
    // tickCollective requires totalTicks >= 60 and totalTicks % 30 === 0
    advanceTicks(engine, 150);

    const finalCount = getBuildingCount();
    expect(finalCount).toBeGreaterThan(initialCount);
  });

  // ── Scenario 2: Housing demand when near capacity ───────────────────────

  it('housing shortage triggers collective to auto-build housing', () => {
    // apartment-tower-a has housingCap=50
    // population=48 → occupancy = 48/50 = 96% (above HOUSING_OCCUPANCY_THRESHOLD of 0.8)
    // Generous resources to survive 150+ ticks of consumption/heating
    const { engine } = createPlaythroughEngine({
      resources: {
        population: 48,
        food: 9999,
        timber: 999,
        steel: 999,
        money: 9999,
        vodka: 9999,
        power: 9999,
        cement: 999,
      },
    });

    // Operational power-station + apartment-tower-a
    createBuilding(15, 15, 'power-station');
    createBuilding(17, 15, 'apartment-tower-a');

    const initialCount = getBuildingCount();

    // Advance well past collective check interval
    advanceTicks(engine, 150);

    const finalCount = getBuildingCount();
    expect(finalCount).toBeGreaterThan(initialCount);
  });

  // ── Scenario 3: Auto-build respects material requirements ───────────────

  it('collective does not auto-build without sufficient materials', () => {
    // population=30, food=50 → food demand triggered
    // timber=0, steel=0 → NOT enough materials (need timber>=10, steel>=5)
    const { engine } = createPlaythroughEngine({
      resources: { population: 30, food: 50, timber: 0, steel: 0, money: 500, vodka: 100, power: 100 },
    });

    // Place reference building
    createBuilding(15, 15, 'power-station');

    const initialCount = getBuildingCount();

    // Advance well past collective check interval
    advanceTicks(engine, 120);

    const finalCount = getBuildingCount();
    expect(finalCount).toBe(initialCount);
  });

  // ── Scenario 4: Auto-build pauses at 3+ under construction ─────────────

  it('collective pauses auto-build when 3+ buildings are under construction', () => {
    // Give enough materials and create food demand so collective WOULD build
    const { engine } = createPlaythroughEngine({
      resources: { population: 30, food: 50, timber: 99, steel: 99, money: 500, vodka: 100, power: 100 },
    });

    // Operational reference building
    createBuilding(15, 15, 'power-station');

    // Place 3 buildings via placeNewBuilding (foundation phase = under construction)
    placeNewBuilding(10, 10, 'collective-farm-hq');
    placeNewBuilding(12, 10, 'collective-farm-hq');
    placeNewBuilding(14, 10, 'collective-farm-hq');

    expect(underConstruction.entities.length).toBe(3);

    const _initialCount = getBuildingCount();

    // Advance past collective check interval
    advanceTicks(engine, 90);

    // The collective should NOT have placed any additional buildings
    // because there are already 3 under construction.
    // Note: construction may have progressed some of the 3 to completion,
    // but the collective should not have placed additional ones beyond what
    // naturally completes. We check that no more than the original 3
    // foundations were placed by checking the total never exceeds initial + possible completions.
    // Simplest check: underConstruction should not have grown beyond 3
    // at any point. Since the collective check skips when >= 3, and
    // construction may complete some, the count should be <= 3.
    expect(underConstruction.entities.length).toBeLessThanOrEqual(3);
  });

  // ── Scenario 5: Chairman meddling feedback ─────────────────────────────

  it('warns chairman about meddling when override count is high', () => {
    const { engine, callbacks } = createPlaythroughEngine({
      resources: { population: 10, food: 9999, timber: 99, steel: 99, money: 500, vodka: 100, power: 100 },
      deterministicRandom: true,
    });

    // Place a building so we can assign workers to it
    createBuilding(5, 5, 'collective-farm-hq');

    const workerSystem = engine.getWorkerSystem();

    // Sync population to create citizen entities
    workerSystem.syncPopulation(10);

    // Record 6+ player overrides by assigning workers with source='player'
    // assignWorker(worker, gridX, gridY, source) increments overrideCount when source='player'
    const citizenEntities = [...world.with('citizen').entities];
    for (let i = 0; i < Math.min(6, citizenEntities.length); i++) {
      workerSystem.assignWorker(citizenEntities[i]!, 5, 5, 'player');
    }

    expect(workerSystem.isChairmanMeddling()).toBe(true);

    // Advance to tick 60 — meddling check fires at totalTicks % 60 === 0
    advanceTicks(engine, 60);

    // The advisor should have been called with a meddling warning
    const advisorCalls = callbacks.onAdvisor.mock.calls.map((c: unknown[]) => String(c[0]));
    const hasMeddlingWarning = advisorCalls.some(
      (msg: string) => msg.toLowerCase().includes('meddling') || msg.toLowerCase().includes('trust the collective'),
    );
    expect(hasMeddlingWarning).toBe(true);
  });
});
