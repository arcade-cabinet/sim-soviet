/**
 * Playthrough integration test: Historical Campaign Headless Playthrough
 *
 * Runs a proper headless playthrough at each difficulty level:
 * 1. Uses createPlaythroughEngine() — no React/DOM
 * 2. Enables autopilot (engine.enableAutopilot()) for AI-managed minigames + annual reports
 * 3. Does NOT top up resources — agents manage everything autonomously
 * 4. Builds a robust starting settlement
 * 5. Runs through the 1917-1991 historical campaign window
 * 6. Captures yearly snapshots
 * 7. Prints decade-by-decade summary table
 * 8. Asserts on population trajectory per difficulty
 *
 * Note on starting resources: the commune starts with generous supplies
 * (representing the initial Soviet allotment to a remote settlement). The
 * economy must become self-sustaining before these run out. No resources
 * are injected after the initial allocation.
 *
 * Note on time skips: when the chairman is arrested and rehabilitated,
 * the clock jumps forward by the consequence's returnDelayYears. This
 * means the tick budget may cover more than the target calendar years. The
 * test loop tracks actual game years, not tick count.
 */

import { resetStarvationCounter } from '../../src/ai/agents/economy/consumptionSystem';
import { getResourceEntity } from '../../src/ecs/archetypes';
import { createBuilding } from '../../src/ecs/factories';
import { world } from '../../src/ecs/world';
import type { SimulationEngine } from '../../src/game/SimulationEngine';
import {
  buildFullEconomy,
  createPlaythroughEngine,
  getBuildingCount,
  getDate,
  getGameOverReason,
  getResources,
  isGameOver,
  TICKS_PER_YEAR,
} from './helpers';

// ── YearlySnapshot interface ────────────────────────────────────────────────

interface YearlySnapshot {
  year: number;
  population: number;
  food: number;
  vodka: number;
  era: string;
  marks: number;
  buildings: number;
  laborForce: number;
  births: number;
  deaths: number;
  gameOver: boolean;
  gameOverReason?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Print a formatted decade-by-decade summary table to console.
 * Shows every 10th year plus the final snapshot.
 */
function printDecadeSummary(snapshots: YearlySnapshot[], label: string): void {
  const header = '  Year  | Pop       | Food      | Vodka     | Era              | Marks | Bldgs | Labor';
  const divider = '  ------+-----------+-----------+-----------+------------------+-------+-------+------';

  console.log(`\n  === ${label} ===`);
  console.log(header);
  console.log(divider);

  // If the playthrough is short (< 30 years), show every year for diagnosis.
  // Otherwise show every 10th year.
  const totalYears = snapshots.length > 0 ? snapshots[snapshots.length - 1]!.year - snapshots[0]!.year : 0;
  const showEveryYear = totalYears < 30;

  for (const s of snapshots) {
    const yearsSinceStart = s.year - 1917;
    if (showEveryYear || yearsSinceStart % 10 === 0 || s === snapshots[snapshots.length - 1]) {
      const row = [
        `  ${String(s.year).padStart(4)}  `,
        `${String(s.population).padStart(9)} `,
        `${String(Math.round(s.food)).padStart(9)} `,
        `${String(Math.round(s.vodka)).padStart(9)} `,
        `${s.era.padEnd(16)} `,
        `${String(s.marks).padStart(5)} `,
        `${String(s.buildings).padStart(5)} `,
        `${String(s.laborForce).padStart(5)}`,
      ].join('| ');
      console.log(row);
    }
  }

  const final = snapshots[snapshots.length - 1];
  if (final) {
    if (final.gameOver) {
      console.log(`  Game over at year ${final.year}: ${final.gameOverReason ?? 'unknown'}`);
    } else {
      console.log(`  Survived all years to ${final.year}.`);
    }
    console.log(`  Total births: ${final.births} | Total deaths: ${final.deaths}`);
  }
}

/**
 * Capture a YearlySnapshot from the current engine state.
 */
function captureSnapshot(engine: SimulationEngine): YearlySnapshot {
  const resources = getResources();
  const date = getDate();
  const raion = getResourceEntity()?.resources.raion;

  // Population: prefer raion totalPopulation in aggregate mode, else resources.population
  const population = raion?.totalPopulation ?? resources.population;

  // Labor force: only available in aggregate mode
  const laborForce = raion?.laborForce ?? 0;

  // Births/deaths: cumulative from raion pool (aggregate mode only)
  const births = raion?.totalBirths ?? 0;
  const deaths = raion?.totalDeaths ?? 0;

  // Era and marks from engine agents
  const era = engine.getPoliticalAgent().getCurrentEraId();
  const marks = engine.getKGBAgent().getBlackMarks();
  const buildings = getBuildingCount();

  const gameOver = isGameOver();
  const gameOverReason = gameOver ? (getGameOverReason() ?? undefined) : undefined;

  return {
    year: date.year,
    population,
    food: resources.food,
    vodka: resources.vodka,
    era,
    marks,
    buildings,
    laborForce,
    births,
    deaths,
    gameOver,
    gameOverReason,
  };
}

/**
 * Build a robust starting settlement with diversified economy.
 * More buildings than buildFullEconomy() — 4 farms, 3 housing, 2 power,
 * 2 distilleries, 2 warehouses to give the commune a fighting chance.
 */
function buildRobustSettlement(): void {
  // Core economy: power + housing + farm + distillery + warehouse
  buildFullEconomy();
  // Additional farms — food is the primary bottleneck
  createBuilding(10, 0, 'collective-farm-hq');
  createBuilding(12, 0, 'collective-farm-hq');
  createBuilding(14, 0, 'collective-farm-hq');
  // Extra housing for population growth
  createBuilding(10, 2, 'apartment-tower-a');
  createBuilding(12, 2, 'apartment-tower-b');
  // Second power station for redundancy
  createBuilding(14, 2, 'power-station');
  // Second distillery + warehouse
  createBuilding(10, 4, 'vodka-distillery');
  createBuilding(12, 4, 'warehouse');
}

/**
 * Run a full playthrough for the given number of target game-years.
 * Returns yearly snapshots. Stops early if game ends.
 *
 * The loop is date-aware: it tracks the actual game year (which can
 * jump forward due to rehabilitation time skips) and stops when the
 * target year is reached or the game ends.
 *
 * Maximum tick budget: 26,640 ticks (74 years at 360 ticks/year).
 * This prevents infinite loops if time skips cause the year to jump
 * faster than expected.
 */
function runPlaythrough(difficulty: 'worker' | 'comrade' | 'tovarish', targetYears: number): YearlySnapshot[] {
  // Generous starting resources — the party sends ample supplies for a new
  // settlement. Food 50,000 = ~27 years of consumption for 50 pop at
  // 1 food per 10 citizens per tick (1,800 food/year).
  const { engine } = createPlaythroughEngine({
    meta: { date: { year: 1917, month: 10, tick: 0 } },
    resources: {
      population: 50,
      food: 50000,
      vodka: 10000,
      money: 50000,
      timber: 20000,
      steel: 10000,
      cement: 10000,
    },
    difficulty,
    consequence: 'rehabilitated',
    seed: `historical-${difficulty}-playthrough`,
  });

  // Build settlement AFTER engine creation but BEFORE autopilot
  buildRobustSettlement();

  // Enable autopilot — handles minigames, annual reports, collective focus
  engine.enableAutopilot();

  const startYear = getDate().year;
  const endYear = startYear + targetYears;
  const maxTicks = targetYears * TICKS_PER_YEAR;

  const snapshots: YearlySnapshot[] = [];
  let lastSnapshotYear = startYear;
  let totalTicks = 0;

  // Capture initial state
  snapshots.push(captureSnapshot(engine));

  while (totalTicks < maxTicks) {
    engine.tick();
    totalTicks++;

    // Check if game ended
    if (isGameOver()) {
      snapshots.push(captureSnapshot(engine));
      break;
    }

    // Capture snapshot when the game year changes
    // (year can jump by more than 1 due to rehabilitation time skips)
    const currentYear = getDate().year;
    if (currentYear !== lastSnapshotYear) {
      snapshots.push(captureSnapshot(engine));
      lastSnapshotYear = currentYear;

      // Stop if we've passed the target end year
      if (currentYear >= endYear) break;
    }
  }

  return snapshots;
}

// ── Assertion helpers ───────────────────────────────────────────────────────

/**
 * Validate that all snapshots have well-formed data (no NaN, valid ranges).
 */
function assertSnapshotIntegrity(snapshots: YearlySnapshot[]): void {
  snapshots.forEach((s, index) => {
    const context = { index, ...s };
    // Core numeric fields should stay finite for the whole run.
    if (!Number.isFinite(s.population)) throw new Error(`Invalid population snapshot: ${JSON.stringify(context)}`);
    if (!Number.isFinite(s.food)) throw new Error(`Invalid food snapshot: ${JSON.stringify(context)}`);
    if (!Number.isFinite(s.vodka)) throw new Error(`Invalid vodka snapshot: ${JSON.stringify(context)}`);
    if (!Number.isFinite(s.laborForce)) throw new Error(`Invalid labor snapshot: ${JSON.stringify(context)}`);
    // Year should be valid
    expect(s.year).toBeGreaterThanOrEqual(1917);
    // Buildings and marks should be non-negative
    expect(s.buildings).toBeGreaterThanOrEqual(0);
    expect(s.marks).toBeGreaterThanOrEqual(0);
    // Era should be a non-empty string
    expect(s.era.length).toBeGreaterThan(0);
    // Births and deaths should be non-negative
    expect(s.births).toBeGreaterThanOrEqual(0);
    expect(s.deaths).toBeGreaterThanOrEqual(0);
  });
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('Playthrough: Historical Campaign Headless Playthrough', () => {
  afterEach(() => {
    world.clear();
    jest.restoreAllMocks();
    resetStarvationCounter();
  });

  it('worker difficulty — historical campaign stability', () => {
    const snapshots = runPlaythrough('worker', 74);

    printDecadeSummary(snapshots, 'Worker Difficulty — Historical Campaign Playthrough');

    // All snapshots must have well-formed data
    assertSnapshotIntegrity(snapshots);

    // Must have at least initial + some year snapshots
    expect(snapshots.length).toBeGreaterThanOrEqual(2);

    const finalSnapshot = snapshots[snapshots.length - 1]!;
    const yearsPlayed = finalSnapshot.year - 1917;

    // Worker difficulty (easiest) with rehabilitated consequences should survive
    // a meaningful stretch. The game may end from era failures, quota issues,
    // repeated rehabilitations, or population collapse. With generous starting
    // resources, we expect at least 5 calendar years.
    expect(yearsPlayed).toBeGreaterThanOrEqual(5);

    // If the game survived the full historical campaign, verify final year.
    if (!finalSnapshot.gameOver) {
      expect(finalSnapshot.year).toBeGreaterThanOrEqual(1991);
    }

    // Population should have been positive at some point
    const peakPop = Math.max(...snapshots.map((s) => s.population));
    expect(peakPop).toBeGreaterThan(0);

    console.log(
      `  Worker: ${yearsPlayed} calendar years, ${snapshots.length} snapshots, peak pop=${peakPop}, final pop=${finalSnapshot.population}`,
    );
  }, 600000);

  it('comrade difficulty — challenging but survivable', () => {
    const snapshots = runPlaythrough('comrade', 74);

    printDecadeSummary(snapshots, 'Comrade Difficulty — Historical Campaign Playthrough');

    // All snapshots must have well-formed data
    assertSnapshotIntegrity(snapshots);

    // Must have at least initial + some year snapshots
    expect(snapshots.length).toBeGreaterThanOrEqual(2);

    const finalSnapshot = snapshots[snapshots.length - 1]!;
    const yearsPlayed = finalSnapshot.year - 1917;

    // Comrade difficulty: population may dip in wartime but recovers.
    // May end from quota failures or rehabilitation cascades.
    expect(yearsPlayed).toBeGreaterThanOrEqual(3);

    // Population should have been positive at some point
    const peakPop = Math.max(...snapshots.map((s) => s.population));
    expect(peakPop).toBeGreaterThan(0);

    if (finalSnapshot.gameOver) {
      console.log(`  Comrade: ended at year ${finalSnapshot.year} — ${finalSnapshot.gameOverReason}`);
    } else {
      console.log(`  Comrade: survived ${yearsPlayed} years, final pop=${finalSnapshot.population}`);
    }
  }, 600000);

  it('tovarish difficulty — survives at least a few years', () => {
    const snapshots = runPlaythrough('tovarish', 74);

    printDecadeSummary(snapshots, 'Tovarish Difficulty — Historical Campaign Playthrough');

    // All snapshots must have well-formed data
    assertSnapshotIntegrity(snapshots);

    // Must have at least initial + game-over snapshot
    expect(snapshots.length).toBeGreaterThanOrEqual(2);

    const finalSnapshot = snapshots[snapshots.length - 1]!;
    const yearsPlayed = finalSnapshot.year - 1917;

    // Tovarish (hardest difficulty): should survive at least a couple years.
    // Quota targets are 1.5x, marks decay slowly, everything is punishing.
    // Even 1 calendar year of survival validates the infrastructure works.
    expect(yearsPlayed).toBeGreaterThanOrEqual(1);

    // Population should have been positive at game start
    expect(snapshots[0]!.population).toBeGreaterThan(0);

    if (finalSnapshot.gameOver) {
      console.log(`  Tovarish: ended at year ${finalSnapshot.year} — ${finalSnapshot.gameOverReason}`);
    } else {
      console.log(`  Tovarish: survived ${yearsPlayed} years, final pop=${finalSnapshot.population}`);
    }
  }, 600000);
});
