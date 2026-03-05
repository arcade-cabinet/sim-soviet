/**
 * @fileoverview 200-year memory ceiling test for SimulationEngine.
 *
 * Measures heap growth across 200 simulated years (72,000 ticks) to detect
 * unbounded memory leaks. Samples heap usage every 25 years and asserts:
 *   - Absolute cap: heap stays under 500 MB
 *   - Growth ratio: final heap < 5x initial heap
 *
 * Uses seeded GameRng for deterministic behavior. Enables autopilot
 * so minigame/annual-report callbacks are auto-resolved.
 */

import { resetStarvationCounter } from '../../src/ai/agents/economy/consumptionSystem';
import { FreeformGovernor } from '../../src/ai/agents/crisis/FreeformGovernor';
import { world } from '../../src/ecs/world';
import {
  advanceTicks,
  buildBasicSettlement,
  createPlaythroughEngine,
  getResources,
  TICKS_PER_YEAR,
} from '../playthrough/helpers';

// 5 minutes — long-running benchmark
jest.setTimeout(300_000);

afterEach(() => {
  world.clear();
  resetStarvationCounter();
  jest.restoreAllMocks();
});

describe('200-year memory ceiling', () => {
  it('heap stays under 500MB after 200 years of simulation', () => {
    const { engine } = createPlaythroughEngine({
      meta: { date: { year: 1917, month: 10, tick: 0 } },
      resources: { food: 999999, vodka: 999999, money: 999999 },
      seed: 'memory-ceiling-200yr',
    });

    // Wire freeform governor + autopilot for hands-off simulation
    const governor = new FreeformGovernor();
    engine.setGovernor(governor);
    engine.enableAutopilot();

    buildBasicSettlement({ housing: 3, farms: 2, power: 1 });

    const measurements: Array<{ year: number; heapMB: number }> = [];

    // Neutralize game-over so benchmark runs full 200 years
    const engineAny = engine as any;

    for (let y = 0; y < 200; y++) {
      // Prevent starvation deaths — keep resources topped up
      const res = getResources();
      res.food = 999999;
      res.vodka = 999999;
      res.money = 999999;

      // Reset ended flag so tick() always executes
      engineAny.ended = false;

      advanceTicks(engine, TICKS_PER_YEAR);

      // Sample every 25 years
      if (y % 25 === 0) {
        if (global.gc) global.gc();
        const mem = process.memoryUsage();
        const heapMB = mem.heapUsed / 1024 / 1024;
        measurements.push({ year: 1917 + y, heapMB });
        // eslint-disable-next-line no-console
        console.log(`Year ${1917 + y}: heap ${heapMB.toFixed(1)} MB`);
      }
    }

    // Log all measurements
    const final = measurements[measurements.length - 1]!;
    // eslint-disable-next-line no-console
    console.log(
      'All measurements:',
      measurements.map((m) => `${m.year}: ${m.heapMB.toFixed(1)}MB`).join(', '),
    );

    // Check for unbounded growth — heap at year 200 should not be more than 5x heap at year 25
    if (measurements.length >= 2) {
      const earlyHeap = measurements[0]!.heapMB;
      const lateHeap = final.heapMB;
      const growthRatio = lateHeap / earlyHeap;
      // eslint-disable-next-line no-console
      console.log(
        `Growth ratio: ${growthRatio.toFixed(2)}x (${earlyHeap.toFixed(1)}MB → ${lateHeap.toFixed(1)}MB)`,
      );
      expect(growthRatio).toBeLessThan(5);
    }

    // Absolute cap
    expect(final.heapMB).toBeLessThan(500);
  });
});
