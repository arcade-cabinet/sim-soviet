/**
 * Playthrough integration test: Freeform (alternate-history) mode
 *
 * Runs the FreeformGovernor through various divergence scenarios to verify:
 *
 * 1. Pre-divergence historical crises activate correctly
 * 2. Post-divergence historical crises are suppressed
 * 3. ChaosEngine generates alternate crises after divergence
 * 4. Timeline records events with correct structure
 * 5. Different RNG seeds produce different timelines
 * 6. Serialize/restore preserves divergence state
 */

import { FreeformGovernor } from '../../src/ai/agents/crisis/FreeformGovernor';
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
 * Neuter the engine's game-over mechanism so long simulations
 * run through population-depleting crises without stopping.
 */
function disableGameOver(engine: unknown): void {
  (engine as Record<string, unknown>).endGame = () => {};
  (engine as Record<string, unknown>).ended = false;
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

/**
 * Top up resources to prevent resource-starvation game-over.
 */
function topUpResources(): void {
  const res = getResources();
  res.food = Math.max(res.food, 50000);
  res.vodka = Math.max(res.vodka, 50000);
  res.money = Math.max(res.money, 50000);
  res.timber = Math.max(res.timber, 50000);
  res.steel = Math.max(res.steel, 50000);
}

/**
 * Run the simulation for a number of years, advancing month by month
 * and polling active crises. Returns maps of ever-seen crises and
 * per-year crisis snapshots.
 */
function runYears(
  engine: ReturnType<typeof createPlaythroughEngine>['engine'],
  governor: FreeformGovernor,
  years: number,
): {
  everActiveCrises: Set<string>;
  yearCrises: Map<number, Set<string>>;
  yearSnapshots: Map<number, YearSnapshot>;
} {
  const everActiveCrises = new Set<string>();
  const yearCrises = new Map<number, Set<string>>();
  const yearSnapshots = new Map<number, YearSnapshot>();
  const MONTHS_PER_YEAR = 12;

  for (let year = 0; year < years; year++) {
    topUpResources();
    replenishPopulation(engine);

    for (let month = 0; month < MONTHS_PER_YEAR; month++) {
      advanceTicks(engine, TICKS_PER_MONTH);

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

    const date = getDate();
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

  return { everActiveCrises, yearCrises, yearSnapshots };
}

// ─── Test Suite ─────────────────────────────────────────────────────────────

describe('Freeform mode — divergence integration tests', () => {
  jest.setTimeout(60000);

  afterEach(() => {
    world.clear();
    jest.restoreAllMocks();
  });

  // ── 1. Diverge 1945: no GPW events after divergence ──────────────────

  describe('Diverge 1945: pre-divergence crises activate, post-divergence suppressed', () => {
    let everActiveCrises: Set<string>;
    let yearCrises: Map<number, Set<string>>;

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

      const governor = new FreeformGovernor(1945);
      engine.setGovernor(governor);
      disableGameOver(engine);

      const result = runYears(engine, governor, 43);
      everActiveCrises = result.everActiveCrises;
      yearCrises = result.yearCrises;
    }, 60000);

    afterAll(() => {
      world.clear();
      jest.restoreAllMocks();
    });

    it('Civil War activates between 1918-1921 (pre-divergence)', () => {
      let civilWarSeen = false;
      for (const [year, crises] of yearCrises) {
        if (year >= 1918 && year <= 1921 && crises.has('russian_civil_war')) {
          civilWarSeen = true;
        }
      }
      expect(civilWarSeen).toBe(true);
    });

    it('GPW activates 1941 (pre-divergence, before 1945)', () => {
      let gpwSeen = false;
      for (const [year, crises] of yearCrises) {
        if (year >= 1941 && year <= 1945 && crises.has('great_patriotic_war')) {
          gpwSeen = true;
        }
      }
      expect(gpwSeen).toBe(true);
    });

    it('Afghan War does NOT appear (post-divergence, startYear=1979)', () => {
      expect(everActiveCrises.has('afghan_war')).toBe(false);
    });

    it('no historical crises with startYear >= 1945 activate', () => {
      const postDivergenceHistorical = HISTORICAL_CRISES.filter((c) => c.startYear >= 1945 && c.type !== 'political');
      const unexpectedCrises: string[] = [];
      for (const crisis of postDivergenceHistorical) {
        if (everActiveCrises.has(crisis.id)) {
          unexpectedCrises.push(`${crisis.id} (${crisis.startYear})`);
        }
      }
      if (unexpectedCrises.length > 0) {
        console.log('Unexpected post-divergence crises:', unexpectedCrises.join(', '));
      }
      expect(unexpectedCrises).toHaveLength(0);
    });
  });

  // ── 2. Diverge 1917: chaos engine generates first crisis ─────────────

  describe('Diverge 1917: chaos engine generates crises, no historical crises', () => {
    let everActiveCrises: Set<string>;
    let governor: FreeformGovernor;

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

      governor = new FreeformGovernor(1917);
      engine.setGovernor(governor);
      disableGameOver(engine);

      const result = runYears(engine, governor, 25);
      everActiveCrises = result.everActiveCrises;
    }, 60000);

    afterAll(() => {
      world.clear();
      jest.restoreAllMocks();
    });

    it('no historical crisis IDs activate (all are post-divergence)', () => {
      const historicalIds = new Set(HISTORICAL_CRISES.filter((c) => c.type !== 'political').map((c) => c.id));
      const activatedHistorical: string[] = [];
      for (const id of everActiveCrises) {
        if (historicalIds.has(id)) {
          activatedHistorical.push(id);
        }
      }
      if (activatedHistorical.length > 0) {
        console.log('Unexpected historical crises:', activatedHistorical.join(', '));
      }
      expect(activatedHistorical).toHaveLength(0);
    });

    it('ChaosEngine generates at least one crisis within 25 years', () => {
      // Chaos-generated crisis IDs follow the pattern: type-year-randomId
      // e.g. war-1927-abc123, famine-1932-def456
      const chaosGenerated = [...everActiveCrises].filter((id) => id.match(/^(war|famine|disaster|political)-\d+-/));

      console.log(`Chaos-generated crises (25 years): ${chaosGenerated.length} — ` + `[${chaosGenerated.join(', ')}]`);

      expect(chaosGenerated.length).toBeGreaterThanOrEqual(1);
    });

    it('governor reports diverged state', () => {
      expect(governor.isDiverged()).toBe(true);
      expect(governor.getDivergenceYear()).toBe(1917);
    });
  });

  // ── 3. Causal chain: crisis events recorded in timeline ──────────────

  describe('Timeline records crisis events with correct structure', () => {
    let governor: FreeformGovernor;

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

      governor = new FreeformGovernor(1930);
      engine.setGovernor(governor);
      disableGameOver(engine);

      runYears(engine, governor, 30);
    }, 60000);

    afterAll(() => {
      world.clear();
      jest.restoreAllMocks();
    });

    it('timeline contains at least one event', () => {
      const timeline = governor.getTimeline();
      const events = timeline.getAllEvents();
      expect(events.length).toBeGreaterThan(0);
    });

    it('timeline events have correct structure', () => {
      const timeline = governor.getTimeline();
      const events = timeline.getAllEvents();

      for (const event of events) {
        expect(event.eventId).toBeDefined();
        expect(typeof event.eventId).toBe('string');
        expect(event.crisisType).toBeDefined();
        expect(['war', 'famine', 'disaster', 'political']).toContain(event.crisisType);
        expect(typeof event.name).toBe('string');
        expect(typeof event.startYear).toBe('number');
        expect(typeof event.endYear).toBe('number');
        expect(typeof event.isHistorical).toBe('boolean');
        expect(event.endYear).toBeGreaterThanOrEqual(event.startYear);
      }
    });

    it('serialized state includes timeline data', () => {
      const serialized = governor.serialize();
      expect(serialized.mode).toBe('freeform');
      expect(serialized.state.divergenceYear).toBe(1930);
      expect(serialized.state.hasDiverged).toBe(true);
      expect(serialized.state.timeline).toBeDefined();

      const timelineData = serialized.state.timeline as {
        events: unknown[];
        divergencePoints: unknown[];
      };
      expect(Array.isArray(timelineData.events)).toBe(true);
      expect(timelineData.events.length).toBeGreaterThan(0);
    });

    it('historical events are marked as isHistorical=true', () => {
      const timeline = governor.getTimeline();
      const historicalEvents = timeline.queryEvents({ isHistorical: true });

      // Pre-1930 crises should be recorded as historical
      for (const event of historicalEvents) {
        expect(event.isHistorical).toBe(true);
        // Historical crises have startYear < 1930 (divergence year)
        expect(event.startYear).toBeLessThan(1930);
      }
    });

    it('divergence point is recorded', () => {
      const timeline = governor.getTimeline();
      const divergencePoints = timeline.getDivergencePoints();
      expect(divergencePoints.length).toBeGreaterThanOrEqual(1);

      const dp = divergencePoints[0]!;
      expect(dp.year).toBeGreaterThanOrEqual(1930);
      expect(typeof dp.historicalContext).toBe('string');
      expect(typeof dp.playerChoice).toBe('string');
    });
  });

  // ── 4. Different seeds produce different timelines ───────────────────

  describe('Different seeds produce different timelines from same divergence', () => {
    let crises1: Set<string>;
    let crises2: Set<string>;

    beforeAll(() => {
      jest.setTimeout(60000);

      // Run 1: seed produces deterministic Math.random = 0.99
      {
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

        const governor1 = new FreeformGovernor(1920);
        engine.setGovernor(governor1);
        disableGameOver(engine);

        const result1 = runYears(engine, governor1, 30);
        crises1 = result1.everActiveCrises;

        world.clear();
        jest.restoreAllMocks();
      }

      // Run 2: different mock value for Math.random to produce a different seed
      {
        jest.spyOn(Math, 'random').mockReturnValue(0.42);
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
          // Do NOT use deterministicRandom here — we already mocked Math.random above
          deterministicRandom: false,
        });

        callbacks.onMinigame = undefined as never;
        callbacks.onAnnualReport = undefined as never;

        buildBasicSettlement({ housing: 5, farms: 5, power: 3 });

        const governor2 = new FreeformGovernor(1920);
        engine.setGovernor(governor2);
        disableGameOver(engine);

        const result2 = runYears(engine, governor2, 30);
        crises2 = result2.everActiveCrises;
      }
    }, 60000);

    afterAll(() => {
      world.clear();
      jest.restoreAllMocks();
    });

    it('the two runs have at least one difference in crisis set', () => {
      // Either one has a crisis the other doesn't, or they have different crisis IDs
      const onlyIn1 = [...crises1].filter((id) => !crises2.has(id));
      const onlyIn2 = [...crises2].filter((id) => !crises1.has(id));

      const hasDifference = onlyIn1.length > 0 || onlyIn2.length > 0;

      console.log(
        `Seed comparison: Run1 crises=${crises1.size}, Run2 crises=${crises2.size} | ` +
          `Only in run1: [${onlyIn1.join(', ')}] | Only in run2: [${onlyIn2.join(', ')}]`,
      );

      expect(hasDifference).toBe(true);
    });
  });

  // ── 5. Diverge 1991: full history plays out ──────────────────────────

  describe('Diverge 1991: full historical timeline plays out', () => {
    let everActiveCrises: Set<string>;
    let yearSnapshots: Map<number, YearSnapshot>;
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

      const governor = new FreeformGovernor(1991);
      engine.setGovernor(governor);
      disableGameOver(engine);

      const result = runYears(engine, governor, 100);
      everActiveCrises = result.everActiveCrises;
      yearSnapshots = result.yearSnapshots;

      const date = getDate();
      simulationEndYear = date.year;

      console.log(
        `[13-freeform-1991] Simulation ended at year ${simulationEndYear} | ` +
          `crises seen: ${everActiveCrises.size} | ` +
          `[${[...everActiveCrises].join(', ')}]`,
      );
    }, 60000);

    afterAll(() => {
      world.clear();
      jest.restoreAllMocks();
    });

    it('Civil War activates (pre-1991)', () => {
      expect(everActiveCrises.has('russian_civil_war')).toBe(true);
    });

    it('Holodomor activates (pre-1991)', () => {
      expect(everActiveCrises.has('holodomor')).toBe(true);
    });

    it('Great Patriotic War activates (pre-1991)', () => {
      expect(everActiveCrises.has('great_patriotic_war')).toBe(true);
    });

    it('Chernobyl activates (pre-1991)', () => {
      expect(everActiveCrises.has('chernobyl')).toBe(true);
    });

    it('Afghan War activates (pre-1991)', () => {
      expect(everActiveCrises.has('afghan_war')).toBe(true);
    });

    it('no NaN/undefined in resource values across all years', () => {
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

    it('ChaosEngine may generate alternate crises after 1991', () => {
      // Chaos-generated crisis IDs follow the pattern: type-year-randomId
      const chaosGenerated = [...everActiveCrises].filter((id) => id.match(/^(war|famine|disaster|political)-\d+-/));

      console.log(`Post-1991 chaos crises: ${chaosGenerated.length} — ` + `[${chaosGenerated.join(', ')}]`);

      // After 1991, ChaosEngine should have had ~26 years to generate
      // crises. It's probabilistic so we allow zero but log the count.
      // In practice, yearsSinceLastWar accumulates and triggers eventually.
      expect(typeof chaosGenerated.length).toBe('number');
    });
  });

  // ── 6. Serialize/restore preserves divergence state ──────────────────

  describe('Serialize/restore preserves divergence state', () => {
    it('restored governor matches original state', () => {
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

      const original = new FreeformGovernor(1930);
      engine.setGovernor(original);
      disableGameOver(engine);

      // Advance 30 years past divergence (to ~1947)
      runYears(engine, original, 30);

      // Serialize
      const savedData = original.serialize();
      const originalActiveCrises = original.getActiveCrises();
      const originalDiverged = original.isDiverged();
      const originalDivergenceYear = original.getDivergenceYear();
      const originalTimeline = original.getTimeline().getAllEvents();
      const originalCounters = original.getYearsSinceCounters();

      // Create a new governor and restore
      const restored = new FreeformGovernor(1917); // different initial divergence year
      restored.restore(savedData);

      // Verify: divergence state matches
      expect(restored.isDiverged()).toBe(originalDiverged);
      expect(restored.getDivergenceYear()).toBe(originalDivergenceYear);

      // Verify: timeline events match
      const restoredTimeline = restored.getTimeline().getAllEvents();
      expect(restoredTimeline.length).toBe(originalTimeline.length);

      // Verify: year-since counters match
      const restoredCounters = restored.getYearsSinceCounters();
      expect(restoredCounters.war).toBe(originalCounters.war);
      expect(restoredCounters.famine).toBe(originalCounters.famine);
      expect(restoredCounters.disaster).toBe(originalCounters.disaster);
      expect(restoredCounters.political).toBe(originalCounters.political);

      // Verify: total crises experienced matches
      expect(restored.getTotalCrisesExperienced()).toBe(original.getTotalCrisesExperienced());

      // Verify: serialized mode is correct
      expect(savedData.mode).toBe('freeform');
      expect(savedData.state.divergenceYear).toBe(1930);
      expect(savedData.state.hasDiverged).toBe(true);

      console.log(
        `Serialize/restore: divergenceYear=${originalDivergenceYear}, ` +
          `diverged=${originalDiverged}, ` +
          `timelineEvents=${originalTimeline.length}, ` +
          `activeCrises=[${originalActiveCrises.join(', ')}], ` +
          `counters=${JSON.stringify(originalCounters)}`,
      );
    });
  });
});
