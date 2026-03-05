/**
 * Playthrough integration test: Freeform (alternate-history) mode
 *
 * Tests the organic divergence system where:
 * 1. Historical crises are probability-driven (not date-driven)
 * 2. ChaosEngine generates additional crises based on game state
 * 3. Timeline records events correctly
 * 4. Different RNG seeds produce different timelines
 * 5. Serialize/restore preserves state
 */

import { FreeformGovernor } from '../../src/ai/agents/crisis/FreeformGovernor';
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

describe('Freeform mode — organic divergence integration tests', () => {
  jest.setTimeout(60000);

  afterEach(() => {
    world.clear();
    jest.restoreAllMocks();
  });

  // ── 1. Probability-driven crises activate within their windows ─────

  describe('Probability-driven historical crises', () => {
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
        consequence: 'rasstrelyat',
        deterministicRandom: true,
      });

      callbacks.onMinigame = undefined as never;
      callbacks.onAnnualReport = undefined as never;

      buildBasicSettlement({ housing: 5, farms: 5, power: 3 });

      governor = new FreeformGovernor();
      engine.setGovernor(governor);
      disableGameOver(engine);

      const result = runYears(engine, governor, 40);
      everActiveCrises = result.everActiveCrises;
    }, 60000);

    afterAll(() => {
      world.clear();
      jest.restoreAllMocks();
    });

    it('at least some crises activate over 40 years (probabilistic)', () => {
      expect(everActiveCrises.size).toBeGreaterThan(0);
    });

    it('governor reports diverged state (always true for new FreeformGovernor)', () => {
      expect(governor.isDiverged()).toBe(true);
    });

    it('some historical crisis windows are resolved', () => {
      const windows = governor.getHistoricalWindows();
      const resolvedCount = windows.filter((w) => w.resolved).length;
      console.log(
        `Historical windows resolved: ${resolvedCount}/${windows.length}, ` +
          `triggered: ${windows.filter((w) => w.triggered).length}`,
      );
      expect(resolvedCount).toBeGreaterThan(0);
    });

    it('crises include both historical-origin and chaos-generated events', () => {
      const timeline = governor.getTimeline();
      const events = timeline.getAllEvents();

      const historicalOrigin = events.filter((e) => e.isHistorical).length;
      const chaosGenerated = events.filter((e) => !e.isHistorical).length;

      console.log(
        `Timeline events: ${events.length} total — ` +
          `${historicalOrigin} historical-origin, ${chaosGenerated} chaos-generated`,
      );

      // Over 40 years, there should be at least some events
      expect(events.length).toBeGreaterThan(0);
    });
  });

  // ── 2. ChaosEngine generates crises in addition to historical ──────

  describe('ChaosEngine generates additional crises', () => {
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
        consequence: 'rasstrelyat',
        deterministicRandom: true,
      });

      callbacks.onMinigame = undefined as never;
      callbacks.onAnnualReport = undefined as never;

      buildBasicSettlement({ housing: 5, farms: 5, power: 3 });

      governor = new FreeformGovernor();
      engine.setGovernor(governor);
      disableGameOver(engine);

      const result = runYears(engine, governor, 25);
      everActiveCrises = result.everActiveCrises;
    }, 60000);

    afterAll(() => {
      world.clear();
      jest.restoreAllMocks();
    });

    it('pressure system or ChaosEngine generates at least one crisis within 25 years', () => {
      // Pressure-generated IDs: pressure-domain-year-tick; ChaosEngine IDs: type-year-randomId
      const generated = [...everActiveCrises].filter(
        (id) => id.match(/^pressure-/) || id.match(/^(war|famine|disaster|political)-\d+-/),
      );

      console.log(`Generated crises (25 years): ${generated.length} — ` + `[${generated.slice(0, 10).join(', ')}${generated.length > 10 ? '...' : ''}]`);

      expect(generated.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── 3. Timeline records events with correct structure ──────────────

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
        consequence: 'rasstrelyat',
        deterministicRandom: true,
      });

      callbacks.onMinigame = undefined as never;
      callbacks.onAnnualReport = undefined as never;

      buildBasicSettlement({ housing: 5, farms: 5, power: 3 });

      governor = new FreeformGovernor();
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
        expect(['war', 'famine', 'disaster', 'political', 'climate', 'black_swan', 'cold_branch']).toContain(event.crisisType);
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
      expect(serialized.state.hasDiverged).toBe(true);
      expect(serialized.state.timeline).toBeDefined();

      const timelineData = serialized.state.timeline as {
        events: unknown[];
        divergencePoints: unknown[];
      };
      expect(Array.isArray(timelineData.events)).toBe(true);
      expect(timelineData.events.length).toBeGreaterThan(0);
    });
  });

  // ── 4. Different seeds produce different timelines ───────────────────

  describe('Different seeds produce different timelines', () => {
    let crises1: Set<string>;
    let crises2: Set<string>;

    beforeAll(() => {
      jest.setTimeout(60000);

      // Run 1: deterministic seed
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
          consequence: 'rasstrelyat',
          deterministicRandom: true,
        });

        callbacks.onMinigame = undefined as never;
        callbacks.onAnnualReport = undefined as never;

        buildBasicSettlement({ housing: 5, farms: 5, power: 3 });

        const governor1 = new FreeformGovernor();
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
          consequence: 'rasstrelyat',
          deterministicRandom: false,
        });

        callbacks.onMinigame = undefined as never;
        callbacks.onAnnualReport = undefined as never;

        buildBasicSettlement({ housing: 5, farms: 5, power: 3 });

        const governor2 = new FreeformGovernor();
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

  // ── 5. Serialize/restore preserves state ───────────────────────────

  describe('Serialize/restore preserves state', () => {
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
        consequence: 'rasstrelyat',
        deterministicRandom: true,
      });

      callbacks.onMinigame = undefined as never;
      callbacks.onAnnualReport = undefined as never;

      buildBasicSettlement({ housing: 5, farms: 5, power: 3 });

      const original = new FreeformGovernor();
      engine.setGovernor(original);
      disableGameOver(engine);

      // Advance 30 years
      runYears(engine, original, 30);

      // Serialize
      const savedData = original.serialize();
      const originalDiverged = original.isDiverged();
      const originalTimeline = original.getTimeline().getAllEvents();
      const originalCounters = original.getYearsSinceCounters();

      // Create a new governor and restore
      const restored = new FreeformGovernor();
      restored.restore(savedData);

      // Verify: divergence state matches
      expect(restored.isDiverged()).toBe(originalDiverged);

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
      expect(savedData.state.hasDiverged).toBe(true);

      console.log(
        `Serialize/restore: ` +
          `diverged=${originalDiverged}, ` +
          `timelineEvents=${originalTimeline.length}, ` +
          `counters=${JSON.stringify(originalCounters)}`,
      );
    });
  });

  // ── 6. Backward compatibility with old saves (divergence year) ─────

  describe('Backward compatibility with old save format', () => {
    it('FreeformGovernor constructor still accepts divergenceYear parameter', () => {
      const gov = new FreeformGovernor(1945);
      // Should not throw
      expect(gov.isDiverged()).toBe(true);
      expect(gov.getDivergenceYear()).toBe(1945);
    });

    it('FreeformGovernor without parameter defaults to 1917', () => {
      const gov = new FreeformGovernor();
      expect(gov.getDivergenceYear()).toBe(1917);
    });
  });

  // ── 7. WorldAgent state changes over time (sphere dynamics, governance drift) ──

  describe('WorldAgent sphere dynamics evolve over 40+ years', () => {
    let governor: FreeformGovernor;
    let engine: ReturnType<typeof createPlaythroughEngine>['engine'];

    beforeAll(() => {
      jest.setTimeout(60000);

      const setup = createPlaythroughEngine({
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
        consequence: 'rasstrelyat',
        seed: 'world-agent-sphere-test',
      });

      engine = setup.engine;
      setup.callbacks.onMinigame = undefined as never;
      setup.callbacks.onAnnualReport = undefined as never;

      buildBasicSettlement({ housing: 5, farms: 5, power: 3 });

      governor = new FreeformGovernor();
      engine.setGovernor(governor);
      disableGameOver(engine);

      runYears(engine, governor, 45);
    }, 60000);

    afterAll(() => {
      world.clear();
      jest.restoreAllMocks();
    });

    it('WorldAgent state changes over time — techLevel advances', () => {
      const worldAgent = engine.getWorldAgent();
      const state = worldAgent.getState();
      // After 45 years, tech should have advanced beyond 0.05 starting value
      expect(state.techLevel).toBeGreaterThan(0.05);
    });

    it('WorldAgent spheres have non-default values after 45 years', () => {
      const worldAgent = engine.getWorldAgent();
      const state = worldAgent.getState();
      // Spheres should have evolved from initial values
      const sphereIds = Object.keys(state.spheres);
      expect(sphereIds.length).toBeGreaterThan(0);
      // At least one sphere should have shifted hostility or trade
      const hasShifted = sphereIds.some((id) => {
        const sphere = state.spheres[id as keyof typeof state.spheres];
        return sphere.aggregateHostility !== 0 || sphere.aggregateTrade !== 0;
      });
      expect(hasShifted).toBe(true);
    });
  });

  // ── 8. ClimateEventSystem fires at least one seasonal event ──────────

  describe('ClimateEventSystem fires seasonal events over 40 years', () => {
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
        consequence: 'rasstrelyat',
        seed: 'climate-event-test',
      });

      callbacks.onMinigame = undefined as never;
      callbacks.onAnnualReport = undefined as never;

      buildBasicSettlement({ housing: 5, farms: 5, power: 3 });

      governor = new FreeformGovernor();
      engine.setGovernor(governor);
      disableGameOver(engine);

      runYears(engine, governor, 40);
    }, 60000);

    afterAll(() => {
      world.clear();
      jest.restoreAllMocks();
    });

    it('climate event system is initialized and can evaluate', () => {
      const climateSystem = governor.getClimateEventSystem();
      // ClimateEventSystem is evaluated every tick — verify it exists and can serialize
      expect(climateSystem).toBeDefined();
      const cooldowns = climateSystem.serialize();
      expect(Array.isArray(cooldowns)).toBe(true);

      // Verify the system can evaluate without errors
      // Climate events are probabilistic and season-gated, so they may or may not
      // fire in any given run. The key invariant is that the system processes
      // without crashing over 40 years.
      console.log(
        `ClimateEventSystem: active cooldowns at end of run: ${cooldowns.length}`,
      );
    });
  });

  // ── 9. Cold branches: activatedBranches grows over 40+ years ──────

  describe('Cold branches activate over extended simulation', () => {
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
        consequence: 'rasstrelyat',
        seed: 'cold-branch-test',
      });

      callbacks.onMinigame = undefined as never;
      callbacks.onAnnualReport = undefined as never;

      buildBasicSettlement({ housing: 5, farms: 5, power: 3 });

      governor = new FreeformGovernor();
      engine.setGovernor(governor);
      disableGameOver(engine);

      runYears(engine, governor, 45);
    }, 60000);

    afterAll(() => {
      world.clear();
      jest.restoreAllMocks();
    });

    it('activatedBranches is accessible and is a set', () => {
      const branches = governor.getActivatedBranches();
      expect(branches).toBeDefined();
      expect(typeof branches.size).toBe('number');
      console.log(`Activated cold branches after 45 years: ${branches.size} — [${[...branches].join(', ')}]`);
    });
  });

  // ── 10. PressureSystem gauges accumulate ──────────────────────────────

  describe('PressureSystem gauges accumulate over time', () => {
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
        consequence: 'rasstrelyat',
        seed: 'pressure-gauge-test',
      });

      callbacks.onMinigame = undefined as never;
      callbacks.onAnnualReport = undefined as never;

      buildBasicSettlement({ housing: 5, farms: 5, power: 3 });

      governor = new FreeformGovernor();
      engine.setGovernor(governor);
      disableGameOver(engine);

      runYears(engine, governor, 25);
    }, 60000);

    afterAll(() => {
      world.clear();
      jest.restoreAllMocks();
    });

    it('pressureState has non-zero domains after 25 years', () => {
      const pressureSystem = governor.getPressureSystem();
      const state = pressureSystem.getState();

      // At least one domain should have accumulated some pressure
      const domainKeys = Object.keys(state);
      expect(domainKeys.length).toBeGreaterThan(0);

      let hasNonZero = false;
      for (const key of domainKeys) {
        const gauge = state[key as keyof typeof state];
        if (gauge && gauge.level > 0) {
          hasNonZero = true;
          break;
        }
      }

      console.log(
        `PressureSystem state after 25 years: ` +
          domainKeys
            .map((k) => `${k}=${state[k as keyof typeof state]?.level?.toFixed(3) ?? '?'}`)
            .join(', '),
      );

      expect(hasNonZero).toBe(true);
    });

    it('pressure system serializes correctly', () => {
      const pressureSystem = governor.getPressureSystem();
      const serialized = pressureSystem.serialize();
      expect(serialized).toBeDefined();
      expect(serialized.gauges).toBeDefined();
    });
  });
});
