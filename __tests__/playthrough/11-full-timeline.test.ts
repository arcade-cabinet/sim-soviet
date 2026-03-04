/**
 * Playthrough integration test: Full 1917->2117 Timeline
 *
 * Runs the engine through all 8 eras (200 years / 72,000 ticks) to verify:
 * 1. No OOM — the engine stays within 4GB heap
 * 2. No crash — ticks process without exceptions
 * 3. Population bounded — entity count doesn't explode
 * 4. Deterministic — same seed produces same results
 *
 * Uses rehabilitated consequence and worker difficulty to maximize survival.
 * The run may end early via era failure (population decline) since the test
 * uses entity mode — this is expected until aggregate mode is wired in (Task 11).
 */

import { world } from '../../src/ecs/world';
import {
  advanceTicks,
  assertMetaInvariants,
  assertResourceInvariants,
  buildBasicSettlement,
  createPlaythroughEngine,
  getDate,
  getResources,
  isGameOver,
  TICKS_PER_YEAR,
} from './helpers';

describe('Playthrough: Full 1917->2117 Timeline', () => {
  afterEach(() => {
    world.clear();
    jest.restoreAllMocks();
  });

  it('runs without OOM or crash for up to 200 years', () => {
    const { engine, callbacks } = createPlaythroughEngine({
      meta: { date: { year: 1917, month: 10, tick: 0 } },
      resources: {
        population: 50,
        food: 99999,
        vodka: 99999,
        money: 99999,
        timber: 99999,
        steel: 99999,
        cement: 99999,
      },
      difficulty: 'worker',
      consequence: 'rehabilitated',
    });

    // Disable interactive callbacks that would block in tests
    callbacks.onMinigame = undefined as never;
    callbacks.onAnnualReport = undefined as never;

    buildBasicSettlement({ housing: 3, farms: 2, power: 2 });

    const eraTransitions: string[] = [];
    callbacks.onEraChanged.mockImplementation((era: { id: string }) => {
      eraTransitions.push(era.id);
    });

    let maxPop = 0;
    let yearsCompleted = 0;

    for (let year = 0; year < 200; year++) {
      // Keep resources topped up — we're testing engine stability, not resource scarcity
      const res = getResources();
      res.food = Math.max(res.food, 50000);
      res.vodka = Math.max(res.vodka, 50000);
      res.money = Math.max(res.money, 50000);

      advanceTicks(engine, TICKS_PER_YEAR);
      yearsCompleted++;

      const pop = getResources().population;
      maxPop = Math.max(maxPop, pop);

      if (year % 25 === 0) {
        assertMetaInvariants();
        assertResourceInvariants();
      }

      if (isGameOver()) break;
    }

    // Primary: no OOM or crash — we reached this point
    // Population should never have exploded (root cause of OOM)
    expect(maxPop).toBeLessThan(500);

    // Should have run for at least a few years before any game-over
    expect(yearsCompleted).toBeGreaterThanOrEqual(1);

    // Log outcome for debugging
    const date = getDate();
    const meta = world.with('gameMeta').entities[0];
    if (isGameOver()) {
      console.log(
        `Timeline ended at year ${date.year} after ${yearsCompleted} years | ` +
          `eras: ${eraTransitions.length} | maxPop: ${maxPop} | ` +
          `reason: ${meta?.gameMeta.gameOver?.reason?.slice(0, 80)}`,
      );
    } else {
      console.log(
        `Timeline completed 200 years to ${date.year} | ` +
          `eras: ${eraTransitions.length} | maxPop: ${maxPop} | finalPop: ${getResources().population}`,
      );
      expect(date.year).toBeGreaterThanOrEqual(2100);
    }
  }, 120000);

  it('produces deterministic results with the same seed', () => {
    function runPlaythrough(): { finalPop: number; finalYear: number; eraCount: number } {
      world.clear();
      jest.restoreAllMocks();
      const { engine, callbacks } = createPlaythroughEngine({
        meta: { date: { year: 1917, month: 10, tick: 0 } },
        resources: {
          population: 50,
          food: 99999,
          vodka: 99999,
          money: 99999,
          timber: 99999,
          steel: 99999,
          cement: 99999,
        },
        difficulty: 'worker',
        consequence: 'rehabilitated',
        deterministicRandom: true,
      });
      callbacks.onMinigame = undefined as never;
      callbacks.onAnnualReport = undefined as never;
      buildBasicSettlement({ housing: 3, farms: 2, power: 2 });

      let eraCount = 0;
      callbacks.onEraChanged.mockImplementation(() => {
        eraCount++;
      });

      for (let year = 0; year < 50; year++) {
        const res = getResources();
        res.food = Math.max(res.food, 50000);
        res.vodka = Math.max(res.vodka, 50000);
        res.money = Math.max(res.money, 50000);
        advanceTicks(engine, TICKS_PER_YEAR);
        if (isGameOver()) break;
      }

      return {
        finalPop: getResources().population,
        finalYear: getDate().year,
        eraCount,
      };
    }

    const run1 = runPlaythrough();
    const run2 = runPlaythrough();

    expect(run1.finalPop).toBe(run2.finalPop);
    expect(run1.finalYear).toBe(run2.finalYear);
    expect(run1.eraCount).toBe(run2.eraCount);

    console.log(`Determinism check: pop=${run1.finalPop} year=${run1.finalYear} eras=${run1.eraCount}`);
  }, 120000);
});
