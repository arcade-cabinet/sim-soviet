import { getResourceEntity } from '../../src/ecs/archetypes';
import { world } from '../../src/ecs/world';
import { advanceTicks, advanceYears, createPlaythroughEngine, isGameOver } from './helpers';

/**
 * Disables callbacks that interfere with pure quota testing:
 * - onAnnualReport: when set, engine defers quota evaluation to player.
 *   Unsetting it makes the engine auto-evaluate quota at year boundaries.
 * - onMinigame: when set, periodic minigames (e.g. inspection every 180
 *   ticks) fire and auto-resolve with black marks that cause arrest before
 *   the 3rd quota failure. Unsetting prevents minigame-induced marks.
 */
function disableNonQuotaCallbacks(callbacks: Record<string, unknown>): void {
  callbacks.onAnnualReport = undefined;
  callbacks.onMinigame = undefined;
}

describe('Playthrough: Quota Cycle Economy', () => {
  afterEach(() => {
    world.clear();
    jest.restoreAllMocks();
  });

  // ── Scenario 1: Successful first quota ──────────────────────────────

  it('meets first food quota and switches to vodka', () => {
    // Start at year 1926 (chronology begins at month 10).
    // Provide enough food to exceed the 500 target.
    const { engine, callbacks } = createPlaythroughEngine({
      meta: { date: { year: 1926, month: 10, tick: 0 } },
      resources: { food: 5000, population: 0 },
    });
    disableNonQuotaCallbacks(callbacks as Record<string, unknown>);

    // 90 ticks = 3 months → month 10→11→12→1 of 1927 (newYear fires)
    advanceTicks(engine, 90);

    // Advisor should announce quota met
    expect(callbacks.onAdvisor).toHaveBeenCalledWith(expect.stringContaining('Quota met'));

    // Quota type should switch to vodka
    expect(engine.getQuota().type).toBe('vodka');
  });

  // ── Scenario 2: Five consecutive failures → game over ─────────────

  it('triggers game over after 8 consecutive quota failures', () => {
    // Start with food=0. Zero food+vodka each tick to prevent fondy
    // from accumulating enough to meet the 300 quota target.
    const { engine, callbacks } = createPlaythroughEngine({
      meta: { date: { year: 1926, month: 10, tick: 0 } },
      resources: { food: 0, population: 0 },
      consequence: 'forgiving',
    });
    disableNonQuotaCallbacks(callbacks as Record<string, unknown>);

    const store = getResourceEntity()!;

    // Failure 1: tick to 1927 with food zeroed each tick
    for (let i = 0; i < 90; i++) {
      store.resources.food = 0;
      store.resources.vodka = 0;
      engine.tick();
    }
    expect(callbacks.onAdvisor).toHaveBeenCalledWith(expect.stringContaining('failed'));
    expect(isGameOver()).toBe(false);

    // Failures 2-7: advance 5 years each with food zeroed
    for (let f = 2; f <= 7; f++) {
      for (let i = 0; i < 5 * 360; i++) {
        store.resources.food = 0;
        store.resources.vodka = 0;
        engine.tick();
        if (isGameOver()) break;
      }
      if (f <= 7) expect(isGameOver()).toBe(false);
    }

    // Failure 8: advance 5 years — game over
    for (let i = 0; i < 5 * 360; i++) {
      store.resources.food = 0;
      store.resources.vodka = 0;
      engine.tick();
      if (isGameOver()) break;
    }
    expect(callbacks.onGameOver).toHaveBeenCalledWith(false, expect.stringContaining('Politburo'));
    expect(isGameOver()).toBe(true);
  });

  // ── Scenario 3: Failure counter resets on success ──────────────────

  it('resets failure counter when a quota is met', () => {
    // Start at year 1926, month 10 with enough food to meet the first quota.
    const { engine, callbacks } = createPlaythroughEngine({
      meta: { date: { year: 1926, month: 10, tick: 0 } },
      resources: { food: 5000, population: 0 },
      consequence: 'forgiving',
    });
    disableNonQuotaCallbacks(callbacks as Record<string, unknown>);

    // Meet first quota → cross into 1927
    advanceTicks(engine, 90);
    expect(callbacks.onAdvisor).toHaveBeenCalledWith(expect.stringContaining('Quota met'));

    const store = getResourceEntity()!;

    // Failures 1-7: advance 5 years each, zeroing food+vodka to prevent accumulation
    for (let f = 1; f <= 7; f++) {
      for (let i = 0; i < 5 * 360; i++) {
        store.resources.food = 0;
        store.resources.vodka = 0;
        engine.tick();
        if (isGameOver()) break;
      }
      expect(isGameOver()).toBe(false);
    }

    // Failure 8: advance 5 years — game over
    for (let i = 0; i < 5 * 360; i++) {
      store.resources.food = 0;
      store.resources.vodka = 0;
      engine.tick();
      if (isGameOver()) break;
    }
    expect(callbacks.onGameOver).toHaveBeenCalledWith(false, expect.stringContaining('Politburo'));
    expect(isGameOver()).toBe(true);
  });

  // ── Scenario 4: Quota escalation after success ─────────────────────

  it('escalates quota to vodka with a target after first success', () => {
    const { engine, callbacks } = createPlaythroughEngine({
      meta: { date: { year: 1926, month: 10, tick: 0 } },
      resources: { food: 5000, population: 0 },
    });
    disableNonQuotaCallbacks(callbacks as Record<string, unknown>);

    advanceTicks(engine, 90);

    const quota = engine.getQuota();
    expect(quota.type).toBe('vodka');
    expect(quota.target).toBeGreaterThan(0);
    // At comrade difficulty (quotaMultiplier = 0.8), target is 400
    expect(quota.target).toBe(400);
    // Deadline should be 5 years from current year
    expect(quota.deadlineYear).toBe(1927 + 5);
  });

  // ── Scenario 5: Annual report callback fires at deadline year ──────

  it('fires onAnnualReport callback at quota deadline year', () => {
    const { engine, callbacks } = createPlaythroughEngine({
      meta: { date: { year: 1926, month: 10, tick: 0 } },
      resources: { food: 5000, population: 0 },
    });
    // Disable minigames but keep onAnnualReport as jest.fn()
    (callbacks as Record<string, unknown>).onMinigame = undefined;

    // Keep onAnnualReport as jest.fn() — engine will call it instead of auto-evaluating
    advanceTicks(engine, 90);

    expect(callbacks.onAnnualReport).toHaveBeenCalledTimes(1);
    expect(callbacks.onAnnualReport).toHaveBeenCalledWith(
      expect.objectContaining({
        year: 1927,
        quotaType: 'food',
        quotaTarget: 400,
      }),
      expect.any(Function), // submitReport callback
    );
  });
});
