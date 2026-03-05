/**
 * Playthrough integration test: Multi-Seed Win Rate Calibration
 *
 * Runs multiple playthroughs per difficulty level with unique seeds to
 * measure win rates (survived 200 years) for calibration purposes.
 *
 * | Difficulty | Seeds | Pass = survived 200 years | Aspirational Target |
 * |---|---|---|---|
 * | Worker | 5 | >= 80% (4/5) | Almost always winnable |
 * | Comrade | 10 | >= 50% (5/10) | Challenging but fair |
 * | Tovarish | 10 | >= 20% (2/10) | Genuinely hard |
 *
 * IMPORTANT: Win rate targets are SOFT EXPECTATIONS — logged for calibration,
 * NOT hard assertion failures. The game balance is not yet tuned for autonomous
 * play. Hard assertions only verify infrastructure correctness (no NaN, no
 * crashes, at least 1 run per difficulty completes).
 *
 * Each run:
 * 1. Engine with seed "calibration-{difficulty}-{i}"
 * 2. Enable autopilot
 * 3. Build robust settlement
 * 4. Run 200 years (or until game over)
 * 5. Record: survived, final year, final population, game-over reason
 */

import { resetStarvationCounter } from '../../src/ai/agents/economy/consumptionSystem';
import {
  type ConsequenceLevel,
  DIFFICULTY_PRESETS,
  type DifficultyLevel,
} from '../../src/ai/agents/political/ScoringSystem';
import { getResourceEntity } from '../../src/ecs/archetypes';
import { createBuilding, createMetaStore, createResourceStore } from '../../src/ecs/factories';
import { createDvor } from '../../src/ecs/factories/settlementFactories';
import { world } from '../../src/ecs/world';
import { GameGrid } from '../../src/game/GameGrid';
import { GameRng } from '../../src/game/SeedSystem';
import { SimulationEngine } from '../../src/game/SimulationEngine';
import {
  buildFullEconomy,
  createMockCallbacks,
  getDate,
  getGameOverReason,
  getResources,
  isGameOver,
  TICKS_PER_YEAR,
} from './helpers';

// ── Types ─────────────────────────────────────────────────────────────────

interface RunResult {
  seed: string;
  survived: boolean;
  finalYear: number;
  finalPopulation: number;
  gameOverReason: string | null;
  peakPopulation: number;
  hadNaN: boolean;
  crashed: boolean;
  crashError?: string;
}

interface DifficultyConfig {
  difficulty: DifficultyLevel;
  consequence: ConsequenceLevel;
  seedCount: number;
  aspirationalWinRate: number; // For logging only
  label: string;
}

// ── Constants ─────────────────────────────────────────────────────────────

const DIFFICULTY_CONFIGS: DifficultyConfig[] = [
  { difficulty: 'worker', consequence: 'rehabilitated', seedCount: 5, aspirationalWinRate: 0.8, label: 'Worker' },
  { difficulty: 'comrade', consequence: 'rehabilitated', seedCount: 10, aspirationalWinRate: 0.5, label: 'Comrade' },
  { difficulty: 'tovarish', consequence: 'rehabilitated', seedCount: 10, aspirationalWinRate: 0.2, label: 'Tovarish' },
];

const TARGET_YEARS = 200;
const START_YEAR = 1917;
const END_YEAR = START_YEAR + TARGET_YEARS;
const MAX_TICKS = TARGET_YEARS * TICKS_PER_YEAR;

// Base starting resources — scaled by difficulty's resourceMultiplier (same as GameInit.ts).
// These are generous base amounts; resourceMultiplier brings them in line:
// Worker (2.5x): food=125k  Comrade (1.2x): food=60k  Tovarish (0.2x): food=10k
const BASE_RESOURCES = {
  population: 50,
  food: 50000,
  vodka: 10000,
  money: 50000,
  timber: 20000,
  steel: 10000,
  cement: 10000,
};

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Create test dvory (households) with working-age adults for a given population.
 */
function createCalibrationDvory(count: number, seed: string): void {
  for (let i = 0; i < count; i++) {
    // Mixed-gender households for demographic reproduction over 200 years.
    // Alternating: even dvory = married couple (male+female), odd = single male.
    // This gives ~67% married pairs, enabling natural population growth.
    const members =
      i % 3 !== 2
        ? [
            { name: `Husband ${i}`, gender: 'male' as const, age: 25 + (i % 10) },
            { name: `Wife ${i}`, gender: 'female' as const, age: 23 + (i % 8) },
          ]
        : [{ name: `Worker ${i}`, gender: 'male' as const, age: 30 }];
    createDvor(`${seed}-dvor-${i}`, `Family${i}`, members);
  }
}

/**
 * Build a robust starting settlement with diversified economy.
 * Matches the settlement from test 13 (4 farms, 3 housing, 2 power,
 * 2 distilleries, 2 warehouses).
 */
function buildRobustSettlement(): void {
  // Core economy
  buildFullEconomy();
  // Additional farms
  createBuilding(10, 0, 'collective-farm-hq');
  createBuilding(12, 0, 'collective-farm-hq');
  createBuilding(14, 0, 'collective-farm-hq');
  // Extra housing
  createBuilding(10, 2, 'apartment-tower-a');
  createBuilding(12, 2, 'apartment-tower-b');
  // Second power station
  createBuilding(14, 2, 'power-station');
  // Second distillery + warehouse
  createBuilding(10, 4, 'vodka-distillery');
  createBuilding(12, 4, 'warehouse');
}

/**
 * Run a single calibration playthrough with the given seed and difficulty.
 * Returns the result without asserting — assertions happen at the aggregate level.
 */
function runCalibrationRun(
  seed: string,
  difficulty: DifficultyLevel,
  consequence: ConsequenceLevel = 'rehabilitated',
): RunResult {
  const result: RunResult = {
    seed,
    survived: false,
    finalYear: START_YEAR,
    finalPopulation: 0,
    gameOverReason: null,
    peakPopulation: 0,
    hadNaN: false,
    crashed: false,
  };

  try {
    // Fresh world for each run
    world.clear();
    resetStarvationCounter();

    const grid = new GameGrid();
    const callbacks = createMockCallbacks();

    // Scale starting resources by difficulty's resourceMultiplier (matches GameInit.ts)
    const resMult = DIFFICULTY_PRESETS[difficulty].resourceMultiplier;
    createResourceStore({
      food: Math.round(BASE_RESOURCES.food * resMult),
      vodka: Math.round(BASE_RESOURCES.vodka * resMult),
      money: Math.round(BASE_RESOURCES.money * resMult),
      timber: Math.round(BASE_RESOURCES.timber * resMult),
      steel: Math.round(BASE_RESOURCES.steel * resMult),
      cement: Math.round(BASE_RESOURCES.cement * resMult),
      population: 0,
    });
    createMetaStore({ date: { year: START_YEAR, month: 10, tick: 0 } });

    // Create dvory for the requested population
    createCalibrationDvory(BASE_RESOURCES.population, seed);

    // Create engine with a deterministic seed-specific RNG
    const rng = new GameRng(seed);
    const engine = new SimulationEngine(grid, callbacks, rng, difficulty, consequence);

    // Build settlement AFTER engine, BEFORE autopilot
    buildRobustSettlement();

    // Enable autopilot
    engine.enableAutopilot();

    let peakPop = 0;
    let totalTicks = 0;
    let _lastYear = START_YEAR;

    while (totalTicks < MAX_TICKS) {
      engine.tick();
      totalTicks++;

      // Check for NaN in resources periodically (every 360 ticks = 1 year)
      if (totalTicks % TICKS_PER_YEAR === 0) {
        try {
          const r = getResources();
          if (Number.isNaN(r.food) || Number.isNaN(r.population) || Number.isNaN(r.vodka) || Number.isNaN(r.money)) {
            result.hadNaN = true;
          }

          const raion = getResourceEntity()?.resources.raion;
          const pop = raion?.totalPopulation ?? r.population;
          if (pop > peakPop) peakPop = pop;
        } catch {
          // Resource entity may be missing in edge cases
        }
      }

      // Check game over
      if (isGameOver()) {
        break;
      }

      // Track year for early exit
      try {
        const currentYear = getDate().year;
        if (currentYear >= END_YEAR) break;
        _lastYear = currentYear;
      } catch {
        break;
      }
    }

    // Capture final state
    try {
      const date = getDate();
      const r = getResources();
      const raion = getResourceEntity()?.resources.raion;
      const finalPop = raion?.totalPopulation ?? r.population;

      result.finalYear = date.year;
      result.finalPopulation = finalPop;
      result.peakPopulation = peakPop;
      // Survived = reached 200 years without triggering a game-over condition.
      // Note: pop may be 0 at snapshot time if the settlement oscillates between
      // extinction and immigration — the key test is that the engine didn't force
      // a loss (arrest, Politburo dissolution, or explicit starvation game-over).
      result.survived = !isGameOver() && date.year >= END_YEAR;
      result.gameOverReason = getGameOverReason();
    } catch {
      // If we can't read final state, mark as not survived
      result.survived = false;
    }
  } catch (err: unknown) {
    result.crashed = true;
    result.crashError = err instanceof Error ? err.message : String(err);
  }

  return result;
}

/**
 * Format a number with comma separators for readability.
 */
function formatNum(n: number): string {
  return n.toLocaleString('en-US');
}

/**
 * Print the full calibration results table.
 */
function printCalibrationResults(allResults: Map<string, RunResult[]>): void {
  console.log('\n=== Win Rate Calibration ===');

  for (const config of DIFFICULTY_CONFIGS) {
    const results = allResults.get(config.difficulty) ?? [];
    const survivedCount = results.filter((r) => r.survived).length;
    const winRate = results.length > 0 ? survivedCount / results.length : 0;
    const avgFinalPop =
      results.length > 0 ? Math.round(results.reduce((sum, r) => sum + r.finalPopulation, 0) / results.length) : 0;
    const avgFinalYear =
      results.length > 0 ? Math.round(results.reduce((sum, r) => sum + r.finalYear, 0) / results.length) : 0;
    const crashCount = results.filter((r) => r.crashed).length;
    const nanCount = results.filter((r) => r.hadNaN).length;

    const pct = Math.round(winRate * 100);
    const targetPct = Math.round(config.aspirationalWinRate * 100);

    console.log(
      `${config.label}:   ${survivedCount}/${results.length} survived (${pct}%)  ` +
        `target: ${targetPct}%  avg final pop: ${formatNum(avgFinalPop)}  ` +
        `avg final year: ${avgFinalYear}` +
        (crashCount > 0 ? `  CRASHES: ${crashCount}` : '') +
        (nanCount > 0 ? `  NaN: ${nanCount}` : ''),
    );

    for (let i = 0; i < results.length; i++) {
      const r = results[i]!;
      const status = r.crashed ? 'CRASH' : r.survived ? '\u2713' : '\u2717';
      const detail = r.crashed
        ? (r.crashError ?? 'unknown error')
        : r.survived
          ? `year=${r.finalYear} pop=${formatNum(r.finalPopulation)}`
          : `year=${r.finalYear} pop=${formatNum(r.finalPopulation)} reason=${r.gameOverReason ?? 'unknown'}`;

      console.log(`  seed-${i}: ${status} ${detail}`);
    }
  }

  console.log('');
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Playthrough: Win Rate Calibration', () => {
  afterEach(() => {
    world.clear();
    jest.restoreAllMocks();
    resetStarvationCounter();
  });

  it('per-difficulty win rate calibration', () => {
    const allResults = new Map<string, RunResult[]>();

    for (const config of DIFFICULTY_CONFIGS) {
      const results: RunResult[] = [];

      for (let i = 0; i < config.seedCount; i++) {
        const seed = `calibration-${config.difficulty}-${i}`;

        // Restore mocks between runs so each gets a clean Math.random
        jest.restoreAllMocks();

        const result = runCalibrationRun(seed, config.difficulty, config.consequence);
        results.push(result);
      }

      allResults.set(config.difficulty, results);
    }

    // Print the full calibration table
    printCalibrationResults(allResults);

    // ── Soft assertions: infrastructure correctness only ───────────

    for (const config of DIFFICULTY_CONFIGS) {
      const results = allResults.get(config.difficulty) ?? [];

      // At least 1 run per difficulty must not crash
      const nonCrashed = results.filter((r) => !r.crashed);
      expect(nonCrashed.length).toBeGreaterThanOrEqual(1);

      // No NaN values in any run
      for (const r of results) {
        if (!r.crashed) {
          expect(r.hadNaN).toBe(false);
        }
      }

      // Every non-crashed run must have progressed past the start year
      for (const r of nonCrashed) {
        expect(r.finalYear).toBeGreaterThan(START_YEAR);
      }

      // Peak population should have been positive in at least one run
      const anyPositivePop = nonCrashed.some((r) => r.peakPopulation > 0);
      expect(anyPositivePop).toBe(true);
    }

    // ── Calibration notes (logged, not asserted) ──────────────────

    for (const config of DIFFICULTY_CONFIGS) {
      const results = allResults.get(config.difficulty) ?? [];
      const survivedCount = results.filter((r) => r.survived).length;
      const winRate = results.length > 0 ? survivedCount / results.length : 0;
      const targetMet = winRate >= config.aspirationalWinRate;

      console.log(
        `[CALIBRATION] ${config.label}: ${Math.round(winRate * 100)}% win rate ` +
          `(target: ${Math.round(config.aspirationalWinRate * 100)}%) — ` +
          (targetMet ? 'TARGET MET' : 'BELOW TARGET'),
      );
    }
  }, 600000);
});
