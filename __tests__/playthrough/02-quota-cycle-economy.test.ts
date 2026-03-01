import { world } from '../../src/ecs/world';
import { getResourceEntity } from '../../src/ecs/archetypes';
import {
  createPlaythroughEngine,
  advanceTicks,
  advanceYears,
  isGameOver,
} from './helpers';

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
    expect(callbacks.onAdvisor).toHaveBeenCalledWith(
      expect.stringContaining('Quota met'),
    );

    // Quota type should switch to vodka
    expect(engine.getQuota().type).toBe('vodka');
  });

  // ── Scenario 2: Three consecutive failures → game over ─────────────

  it('triggers game over after 3 consecutive quota failures', () => {
    // Use food=460 so miss is only 8% — no quota black marks (threshold
    // is >10%). Only mandate marks (1/failure) accumulate, staying well
    // below the arrest threshold of 7.
    const { engine, callbacks } = createPlaythroughEngine({
      meta: { date: { year: 1926, month: 10, tick: 0 } },
      resources: { food: 460, population: 0 },
    });
    disableNonQuotaCallbacks(callbacks as Record<string, unknown>);

    // Failure 1: tick to 1927
    advanceTicks(engine, 90);
    expect(callbacks.onAdvisor).toHaveBeenCalledWith(
      expect.stringContaining('failed'),
    );
    expect(isGameOver()).toBe(false);

    // Failure 2: advance 5 years to 1932
    advanceYears(engine, 5);
    expect(isGameOver()).toBe(false);

    // Failure 3: advance 5 years to 1937
    advanceYears(engine, 5);
    expect(callbacks.onGameOver).toHaveBeenCalledWith(
      false,
      expect.stringContaining('Politburo'),
    );
    expect(isGameOver()).toBe(true);
  });

  // ── Scenario 3: Failure counter resets on success ──────────────────

  it('resets failure counter when a quota is met', () => {
    // Start at year 1926, month 10 with enough food to meet the first quota.
    const { engine, callbacks } = createPlaythroughEngine({
      meta: { date: { year: 1926, month: 10, tick: 0 } },
      resources: { food: 5000, population: 0 },
    });
    disableNonQuotaCallbacks(callbacks as Record<string, unknown>);

    // Meet first quota → cross into 1927
    advanceTicks(engine, 90);
    expect(callbacks.onAdvisor).toHaveBeenCalledWith(
      expect.stringContaining('Quota met'),
    );

    // Set vodka to 460 (8% miss) so quotas fail without heavy marks.
    const store = getResourceEntity()!;
    store.resources.food = 0;
    store.resources.vodka = 460;

    // Failure 1: advance to 1932
    advanceYears(engine, 5);
    expect(isGameOver()).toBe(false);

    // Failure 2: advance to 1937
    advanceYears(engine, 5);
    expect(isGameOver()).toBe(false); // Only 2 consecutive — not game over yet

    // Failure 3: advance to 1942
    advanceYears(engine, 5);
    expect(callbacks.onGameOver).toHaveBeenCalledWith(
      false,
      expect.stringContaining('Politburo'),
    );
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
    // At comrade difficulty (quotaMultiplier = 1.0), target is 500
    expect(quota.target).toBe(500);
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
        quotaTarget: 500,
      }),
      expect.any(Function), // submitReport callback
    );
  });
});
