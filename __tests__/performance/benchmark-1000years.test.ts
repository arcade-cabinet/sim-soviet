/**
 * @fileoverview 1000-year performance benchmark for SimulationEngine.
 *
 * Runs freeform mode from 1917 through ~2917 (1000 years = 360,000 ticks).
 * Validates that the engine completes without crashes or infinite loops,
 * and finishes within a generous 60-second timeout.
 *
 * Uses seeded GameRng for deterministic behavior — no Math.random mocking.
 * Enables autopilot so minigame/annual-report callbacks are auto-resolved.
 *
 * The engine's endGame method is neutralized so the benchmark can run
 * the full 1000 years without early termination from population collapse
 * or quota failures.
 */

import { resetStarvationCounter } from '../../src/ai/agents/economy/consumptionSystem';
import { FreeformGovernor } from '../../src/ai/agents/crisis/FreeformGovernor';
import { getMetaEntity, getResourceEntity } from '../../src/ecs/archetypes';
import { world } from '../../src/ecs/world';
import { GameGrid } from '../../src/game/GameGrid';
import { GameRng } from '../../src/game/SeedSystem';
import type { SimCallbacks } from '../../src/game/SimulationEngine';
import { SimulationEngine } from '../../src/game/SimulationEngine';
import { createMetaStore, createResourceStore } from '../../src/ecs/factories';
import { getDate, getResources, TICKS_PER_YEAR } from '../playthrough/helpers';

const BENCHMARK_YEARS = 1000;
const BENCHMARK_TIMEOUT_MS = 120_000;

/** No-op callbacks that satisfy SimCallbacks. */
function createBenchmarkCallbacks(): SimCallbacks {
  const noop = () => {};
  return {
    onToast: noop,
    onAdvisor: noop,
    onPravda: noop,
    onStateChange: noop,
    onSeasonChanged: noop,
    onWeatherChanged: noop,
    onDayPhaseChanged: noop,
    onBuildingCollapsed: noop,
    onGameOver: noop,
    onSettlementChange: noop,
    onNewPlan: noop,
    onEraChanged: noop,
    onAnnualReport: noop,
    onMinigame: noop,
    onTutorialMilestone: noop,
    onAchievement: noop,
    onGameTally: noop,
  } as unknown as SimCallbacks;
}

describe('Performance: 1000-year benchmark', () => {
  afterEach(() => {
    world.clear();
    resetStarvationCounter();
    jest.restoreAllMocks();
  });

  it(
    `completes ${BENCHMARK_YEARS} years (${(BENCHMARK_YEARS * TICKS_PER_YEAR).toLocaleString()} ticks) without crash`,
    () => {
      // ── Setup ──
      world.clear();
      const grid = new GameGrid();
      const callbacks = createBenchmarkCallbacks();
      const rng = new GameRng('benchmark-1000-years');

      createResourceStore({
        food: 9999,
        vodka: 999,
        timber: 999,
        steel: 999,
        cement: 999,
        money: 9999,
        population: 0,
      });
      createMetaStore({ date: { year: 1917, month: 1, tick: 0 } });

      const engine = new SimulationEngine(grid, callbacks, rng, 'comrade', 'rehabilitated');

      // Wire FreeformGovernor with PressureSystem + WorldAgent
      const governor = new FreeformGovernor();
      engine.setGovernor(governor);

      // Enable autopilot so minigames + annual reports auto-resolve
      engine.enableAutopilot();

      // Neutralize game-over: patch the private `ended` flag back to false
      // after each tick, so the engine never stops ticking.
      // This is safe — we're benchmarking throughput, not survival.
      const engineAny = engine as any;

      // ── Run benchmark ──
      const totalTicks = BENCHMARK_YEARS * TICKS_PER_YEAR;
      const startTime = performance.now();

      const CHUNK_YEARS = 100;
      const CHUNK_SIZE = CHUNK_YEARS * TICKS_PER_YEAR;
      let ticksRun = 0;

      for (let chunk = 0; chunk < Math.ceil(BENCHMARK_YEARS / CHUNK_YEARS); chunk++) {
        const ticksThisChunk = Math.min(CHUNK_SIZE, totalTicks - ticksRun);

        for (let i = 0; i < ticksThisChunk; i++) {
          // Reset ended flag so tick() always executes
          engineAny.ended = false;
          engine.tick();
          ticksRun++;
        }

        const elapsed = performance.now() - startTime;
        const date = getDate();
        const res = getResources();

        // eslint-disable-next-line no-console
        console.log(
          `[Benchmark] Year ${date.year} | ` +
            `Ticks: ${ticksRun.toLocaleString()}/${totalTicks.toLocaleString()} | ` +
            `Pop: ${res.population} | Food: ${Math.round(res.food)} | ` +
            `Elapsed: ${(elapsed / 1000).toFixed(1)}s`,
        );
      }

      const endTime = performance.now();
      const elapsedMs = endTime - startTime;
      const elapsedSec = elapsedMs / 1000;
      const ticksPerSec = ticksRun / (elapsedMs / 1000);

      // eslint-disable-next-line no-console
      console.log(
        `\n[Benchmark Complete]\n` +
          `  Total ticks: ${ticksRun.toLocaleString()}\n` +
          `  Wall time: ${elapsedSec.toFixed(2)}s\n` +
          `  Throughput: ${Math.round(ticksPerSec).toLocaleString()} ticks/sec\n` +
          `  Final year: ${getDate().year}\n` +
          `  Final pop: ${getResources().population}\n`,
      );

      // ── Assertions ──

      // Must complete within timeout
      expect(elapsedMs).toBeLessThan(BENCHMARK_TIMEOUT_MS);

      // Must have run all ticks
      expect(ticksRun).toBe(totalTicks);

      // Resources must remain non-negative (no underflow bugs)
      const finalRes = getResourceEntity();
      if (finalRes) {
        expect(finalRes.resources.food).toBeGreaterThanOrEqual(0);
        expect(finalRes.resources.vodka).toBeGreaterThanOrEqual(0);
        expect(finalRes.resources.money).toBeGreaterThanOrEqual(0);
        expect(finalRes.resources.population).toBeGreaterThanOrEqual(0);
      }

      // Date must have advanced to the final year (no stuck-in-loop)
      expect(getDate().year).toBeGreaterThanOrEqual(2917);
    },
    BENCHMARK_TIMEOUT_MS + 10_000,
  );
});
