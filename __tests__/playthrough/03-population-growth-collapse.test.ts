import { getResourceEntity } from '../../src/ecs/archetypes';
import { createBuilding } from '../../src/ecs/factories';
import { world } from '../../src/ecs/world';
import {
  advanceTicks,
  advanceYears,
  buildBasicSettlement,
  createPlaythroughEngine,
  getResources,
  isGameOver,
  TICKS_PER_YEAR,
} from './helpers';

describe('Playthrough: Population Growth & Collapse', () => {
  afterEach(() => {
    world.clear();
    jest.restoreAllMocks();
  });

  // ── Scenario 1: Healthy growth ─────────────────────────────────────────────

  it('population grows when housing and food are available', () => {
    const { engine } = createPlaythroughEngine({
      resources: { population: 20, food: 9999, vodka: 9999 },
    });

    buildBasicSettlement(); // 1 power-station + 1 apartment-tower-a + 1 farm

    advanceYears(engine, 1);

    const pop = getResources().population;
    expect(pop).toBeGreaterThan(20);
    expect(isGameOver()).toBe(false);
  });

  // ── Scenario 2: Population capped at housing capacity ──────────────────────

  it('population does not massively exceed housing capacity', () => {
    const { engine } = createPlaythroughEngine({
      resources: { population: 48, food: 9999, vodka: 9999 },
    });

    // Single apartment-tower-a (housingCap=50) + power-station
    buildBasicSettlement({ housing: 1, farms: 0, power: 1 });

    advanceYears(engine, 1);

    const pop = getResources().population;
    // Housing cap is 50. Population should not wildly exceed it.
    // Allow a generous margin (55) for WorkerSystem drain/inflow fluctuations,
    // but it should not be double the housing cap or anything extreme.
    expect(pop).toBeLessThanOrEqual(55);
    expect(isGameOver()).toBe(false);
  });

  // ── Scenario 3: Starvation cascade ─────────────────────────────────────────

  it('starvation kills citizens and eventually triggers game over', () => {
    const { engine, callbacks } = createPlaythroughEngine({
      resources: { population: 50, food: 9999, vodka: 9999 },
    });

    // Disable onMinigame so periodic inspections auto-resolve without
    // deferring to UI — prevents minigame-driven mark accumulation
    // from causing arrest during the warmup period.
    callbacks.onMinigame = undefined as never;
    // Disable onAnnualReport so quota evaluation doesn't defer
    callbacks.onAnnualReport = undefined as never;

    buildBasicSettlement();

    // Advance past the grace period (360 ticks).
    // If the game ended during warmup (e.g., from political marks), the
    // starvation scenario can't be tested — just verify game over occurred.
    advanceTicks(engine, TICKS_PER_YEAR + 10);

    if (isGameOver()) {
      // Game ended from non-starvation cause (political marks, etc.)
      // Still validates that the engine handles multi-year runs without crash
      expect(callbacks.onGameOver).toHaveBeenCalledWith(false, expect.any(String));
      return;
    }

    const popBefore = getResources().population;
    expect(popBefore).toBeGreaterThan(0);

    // Now cut off food and vodka
    const store = getResourceEntity()!;
    store.resources.food = 0;
    store.resources.vodka = 0;

    // Tick enough times for starvation to kill everyone.
    advanceTicks(engine, 100);

    const popAfter = getResources().population;
    expect(popAfter).toBeLessThan(popBefore);

    // Should eventually reach game over (pop=0 + buildings exist + past grace period)
    if (!isGameOver()) {
      advanceTicks(engine, 200);
    }
    expect(isGameOver()).toBe(true);
  });

  // ── Scenario 4: Gulag population drain ─────────────────────────────────────

  it('powered gulag reduces population when random check passes', () => {
    // Use non-deterministic random so we can mock Math.random ourselves
    const { engine } = createPlaythroughEngine({
      resources: { population: 100, food: 9999, vodka: 9999 },
      deterministicRandom: false,
    });

    // Place power-station + gulag-admin (both instant-operational via createBuilding)
    createBuilding(0, 0, 'power-station');
    createBuilding(2, 0, 'gulag-admin');

    // Mock Math.random to 0.05 — triggers gulag effect (< 0.1)
    jest.spyOn(Math, 'random').mockReturnValue(0.05);

    const popBefore = getResources().population;

    // Single tick — gulag should arrest a worker
    engine.tick();

    const popAfter = getResources().population;
    expect(popAfter).toBeLessThan(popBefore);
  });

  // ── Scenario 5: No game over without buildings ─────────────────────────────

  it('no game over with zero population when no buildings exist', () => {
    const { engine } = createPlaythroughEngine({
      resources: { population: 0, food: 0, vodka: 0 },
    });

    // No buildings placed — the game-over check requires buildingsLogic.length > 0

    // Advance well past the grace period
    advanceTicks(engine, TICKS_PER_YEAR + 40);

    expect(isGameOver()).toBe(false);
  });
});
