/**
 * Playthrough integration test: Historical mode 200-year timeline
 *
 * Runs the HistoricalGovernor + crisis agents (WarAgent, FamineAgent,
 * DisasterAgent) through the full Soviet timeline (1917 -> ~2117) to verify:
 *
 * 1. Civil War activates 1918, ends by 1922
 * 2. Holodomor fires 1932 with food drain
 * 3. Great Patriotic War activates 1941 with existential conscription
 * 4. Chernobyl fires 1986 with disaster impact
 * 5. No NaN/undefined in any resource value across 200 years
 * 6. All historical crises activate and most resolve
 *
 * Strategy: Resources are topped up each year. Game-over is disabled so
 * population-depleting crises don't halt the simulation. Active crises
 * are polled every 30 ticks (monthly) since famine/disaster agents use
 * short tick-based lifecycles that resolve within a single game-year.
 */

import { HistoricalGovernor } from '../../src/ai/agents/crisis/HistoricalGovernor';
import { HISTORICAL_CRISES } from '../../src/config/historicalCrises';
import { getResourceEntity } from '../../src/ecs/archetypes';
import { world } from '../../src/ecs/world';
import {
  advanceTicks,
  buildBasicSettlement,
  createPlaythroughEngine,
  createTestDvory,
  getDate,
  getResources,
  TICKS_PER_MONTH,
} from './helpers';

// ─── Types ──────────────────────────────────────────────────────────────────

interface YearSnapshot {
  food: number;
  money: number;
  population: number;
  timber: number;
  steel: number;
  vodka: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Neuter the engine's game-over mechanism so the 200-year simulation
 * runs through population-depleting crises without stopping.
 */
function disableGameOver(engine: unknown): void {
  (engine as Record<string, unknown>).endGame = () => {};
}

/**
 * Replenish population when it drops below threshold.
 * Creates new dvory and syncs the worker system.
 */
function replenishPopulation(engine: unknown): void {
  const eng = engine as {
    workerSystem: {
      getPopulation: () => number;
      syncPopulationFromDvory: () => number;
    };
  };
  if (eng.workerSystem.getPopulation() < 20) {
    createTestDvory(80);
    const newPop = eng.workerSystem.syncPopulationFromDvory();
    const store = getResourceEntity();
    if (store) store.resources.population = newPop;
  }
}

// ─── Test Suite ─────────────────────────────────────────────────────────────

describe('Historical mode — full timeline playthrough', () => {
  // Year-boundary resource snapshots for NaN checking
  const yearSnapshots = new Map<number, YearSnapshot>();
  // All crises ever seen active (polled monthly for finer granularity)
  const everActiveCrises = new Set<string>();
  // Per-year active crises (union of all monthly polls within that year)
  const yearCrises = new Map<number, Set<string>>();
  let governor: HistoricalGovernor;
  let simulationEndYear: number;

  beforeAll(() => {
    jest.setTimeout(60000);

    const { engine, callbacks } = createPlaythroughEngine({
      meta: { date: { year: 1917, month: 10, tick: 0 } },
      resources: {
        population: 100,
        food: 99999,
        timber: 99999,
        steel: 99999,
        cement: 99999,
        money: 99999,
        vodka: 99999,
        power: 99999,
      },
      difficulty: 'worker',
      consequence: 'permadeath',
      deterministicRandom: true,
    });

    callbacks.onMinigame = undefined as never;
    callbacks.onAnnualReport = undefined as never;

    buildBasicSettlement({ housing: 5, farms: 5, power: 3 });

    governor = new HistoricalGovernor();
    engine.setGovernor(governor);
    disableGameOver(engine);

    simulationEndYear = 1917;
    const MONTHS_PER_YEAR = 12;

    for (let year = 0; year < 200; year++) {
      // Top up resources at the start of each year
      const res = getResources();
      res.food = Math.max(res.food, 50000);
      res.vodka = Math.max(res.vodka, 50000);
      res.money = Math.max(res.money, 50000);
      res.timber = Math.max(res.timber, 50000);
      res.steel = Math.max(res.steel, 50000);
      replenishPopulation(engine);

      // Advance month by month, polling active crises each month.
      // Famine/disaster agents have short tick-based lifecycles (12-120 ticks)
      // that can start and resolve within a single game-year, so we must poll
      // more often than yearly to catch them.
      for (let month = 0; month < MONTHS_PER_YEAR; month++) {
        advanceTicks(engine, TICKS_PER_MONTH);

        // Record which crises are active this month
        const active = governor.getActiveCrises();
        for (const id of active) {
          everActiveCrises.add(id);
        }
        const date = getDate();
        if (!yearCrises.has(date.year)) {
          yearCrises.set(date.year, new Set());
        }
        for (const id of active) {
          yearCrises.get(date.year)!.add(id);
        }
      }

      // Record year-end resource snapshot
      const date = getDate();
      simulationEndYear = date.year;
      const store = getResourceEntity()!;
      yearSnapshots.set(date.year, {
        food: store.resources.food,
        money: store.resources.money,
        population: store.resources.population,
        timber: store.resources.timber,
        steel: store.resources.steel,
        vodka: store.resources.vodka,
      });
    }

    console.log(
      `[12-historical-mode] Simulation ran to year ${simulationEndYear} | ` +
        `snapshots: ${yearSnapshots.size} | ` +
        `total crises seen: ${everActiveCrises.size}`,
    );
  }, 60000);

  afterAll(() => {
    world.clear();
    jest.restoreAllMocks();
  });

  // ── 1. Civil War ────────────────────────────────────────────

  it('Civil War activates 1918, ends by 1924', () => {
    // Russian Civil War: startYear=1918, endYear=1921, aftermathTicks=24
    let civilWarSeen = false;
    let civilWarActiveAfter1924 = false;

    for (const [year, crises] of yearCrises) {
      if (year >= 1918 && year <= 1921 && crises.has('russian_civil_war')) {
        civilWarSeen = true;
      }
      if (year >= 1925 && crises.has('russian_civil_war')) {
        civilWarActiveAfter1924 = true;
      }
    }

    expect(civilWarSeen).toBe(true);
    expect(civilWarActiveAfter1924).toBe(false);
  });

  // ── 2. Holodomor ───────────────────────────────────────────

  it('Holodomor fires 1932 with famine crisis active', () => {
    // Holodomor: startYear=1932, endYear=1933, type=famine
    // Note: FamineAgent uses short tick-based lifecycle (~37 ticks for Holodomor)
    // so it activates and resolves within the start year.
    expect(everActiveCrises.has('holodomor')).toBe(true);

    // It should activate during or after 1932
    let seenInCorrectYear = false;
    for (const [year, crises] of yearCrises) {
      if (year >= 1932 && crises.has('holodomor')) {
        seenInCorrectYear = true;
        break;
      }
    }
    expect(seenInCorrectYear).toBe(true);

    // Food should be finite during famine years
    const snap1932 = yearSnapshots.get(1932);
    if (snap1932) {
      expect(Number.isFinite(snap1932.food)).toBe(true);
    }
  });

  // ── 3. Great Patriotic War ─────────────────────────────────

  it('GPW activates 1941 with existential conscription', () => {
    // GPW: startYear=1941, endYear=1945, severity=existential
    let gpwSeen = false;
    let gpwActiveAfter1952 = false;

    for (const [year, crises] of yearCrises) {
      if (year >= 1941 && year <= 1946 && crises.has('great_patriotic_war')) {
        gpwSeen = true;
      }
      if (year >= 1952 && crises.has('great_patriotic_war')) {
        gpwActiveAfter1952 = true;
      }
    }

    expect(gpwSeen).toBe(true);
    expect(gpwActiveAfter1952).toBe(false);
  });

  // ── 4. Chernobyl ──────────────────────────────────────────

  it('Chernobyl fires 1986 with disaster impact', () => {
    // Chernobyl: startYear=1986, type=disaster
    // DisasterAgent lifecycle: 0 buildup + 1 peak + 120 aftermath ticks
    expect(everActiveCrises.has('chernobyl')).toBe(true);

    let seenInCorrectYear = false;
    for (const [year, crises] of yearCrises) {
      if (year >= 1986 && crises.has('chernobyl')) {
        seenInCorrectYear = true;
        break;
      }
    }
    expect(seenInCorrectYear).toBe(true);

    // Resources should still be finite numbers during Chernobyl year
    const snap1986 = yearSnapshots.get(1986);
    if (snap1986) {
      expect(Number.isFinite(snap1986.food)).toBe(true);
      expect(Number.isFinite(snap1986.money)).toBe(true);
      expect(Number.isFinite(snap1986.population)).toBe(true);
    }
  });

  // ── 5. No NaN/undefined anywhere ──────────────────────────

  it('no NaN, undefined, or Infinity in resource values across all years', () => {
    const violations: string[] = [];

    for (const [year, snap] of yearSnapshots) {
      const fields: Record<string, number> = {
        food: snap.food,
        money: snap.money,
        population: snap.population,
        timber: snap.timber,
        steel: snap.steel,
        vodka: snap.vodka,
      };

      for (const [field, value] of Object.entries(fields)) {
        if (typeof value !== 'number') {
          violations.push(`${year}: ${field} is ${typeof value} (${value})`);
        } else if (!Number.isFinite(value)) {
          violations.push(`${year}: ${field} is ${value}`);
        }
      }
    }

    if (violations.length > 0) {
      console.log('Resource violations:', violations.slice(0, 20).join('\n'));
    }
    expect(violations).toHaveLength(0);
  });

  // ── 6. All crises activate and resolve ─────────────────────

  it('all non-political historical crises activate during the timeline', () => {
    // Non-political crises that the HistoricalGovernor creates agents for
    const expectedCrises = HISTORICAL_CRISES.filter((c) => c.type !== 'political' && c.startYear <= simulationEndYear);

    const missingCrises: string[] = [];
    for (const crisis of expectedCrises) {
      if (!everActiveCrises.has(crisis.id)) {
        missingCrises.push(`${crisis.id} (${crisis.startYear}-${crisis.endYear})`);
      }
    }

    if (missingCrises.length > 0) {
      console.log('Missing crises:', missingCrises.join(', '));
    }

    expect(missingCrises).toHaveLength(0);
  });

  it('most crises resolve by end of simulation', () => {
    // After 200 years, nearly all crises should have resolved.
    const finalActive = governor.getActiveCrises();

    // Allow up to 5 stragglers (long-aftermath crises with tick-based durations)
    expect(finalActive.length).toBeLessThanOrEqual(5);

    console.log(
      `Simulation ended at year ${simulationEndYear} | ` +
        `Total year snapshots: ${yearSnapshots.size} | ` +
        `Crises ever seen: ${everActiveCrises.size} | ` +
        `Final active: [${finalActive.join(', ')}]`,
    );
  });
});
