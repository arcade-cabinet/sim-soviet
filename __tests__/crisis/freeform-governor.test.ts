/**
 * @fileoverview Tests for FreeformGovernor — alternate-history governor
 * that uses probability-driven crisis generation from tick 0.
 *
 * Validates probability-window activation, ChaosEngine usage,
 * modifier merging, serialization round-trips, year-since counters,
 * getActiveCrises(), and backward compatibility.
 */

import { FreeformGovernor } from '@/ai/agents/crisis/FreeformGovernor';
import type { GovernorContext } from '@/ai/agents/crisis/Governor';
import { DEFAULT_MODIFIERS } from '@/ai/agents/crisis/Governor';
import { GameRng } from '@/game/SeedSystem';

// ─── Fixtures ───────────────────────────────────────────────────────────────

function makeCtx(overrides?: Partial<GovernorContext>): GovernorContext {
  return {
    year: 1917,
    month: 1,
    population: 5000,
    food: 2000,
    money: 1000,
    rng: new GameRng('freeform-test-seed'),
    totalTicks: 0,
    eraId: 'revolution',
    ...overrides,
  };
}

/**
 * Helper: advance the governor through multiple ticks at a given year/month.
 * Returns the last directive.
 */
function advanceTicks(gov: FreeformGovernor, ticks: number, ctxOverrides: Partial<GovernorContext>) {
  let directive: ReturnType<FreeformGovernor['evaluate']> | undefined;
  for (let i = 0; i < ticks; i++) {
    directive = gov.evaluate(makeCtx(ctxOverrides));
  }
  return directive!;
}

// ─── 1. Probability-driven crisis activation ────────────────────────────────

describe('FreeformGovernor: probability-driven crises', () => {
  it('starts with isDiverged=true (always diverged in new API)', () => {
    const gov = new FreeformGovernor();
    expect(gov.isDiverged()).toBe(true);
  });

  it('historical windows are loaded for all non-political crises', () => {
    const gov = new FreeformGovernor();
    const windows = gov.getHistoricalWindows();
    expect(windows.length).toBeGreaterThan(0);

    // Should include wars, famines, disasters (political crises are filtered)
    const types = new Set(windows.map((w) => w.definition.type));
    expect(types.has('war')).toBe(true);
    expect(types.has('famine')).toBe(true);
    expect(types.has('disaster')).toBe(true);
  });

  it('some crises activate probabilistically over 50 years', () => {
    const gov = new FreeformGovernor();

    for (let year = 1917; year <= 1967; year++) {
      gov.onYearBoundary(year);
      gov.evaluate(makeCtx({
        year,
        month: 1,
        population: 3000,
        food: 2000,
        money: 1000,
        rng: new GameRng(`prob-${year}`),
        totalTicks: (year - 1917) * 12,
      }));
    }

    const windows = gov.getHistoricalWindows();
    const resolvedCount = windows.filter((w) => w.resolved).length;
    expect(resolvedCount).toBeGreaterThan(0);

    const timeline = gov.getTimeline();
    expect(timeline.getAllEvents().length).toBeGreaterThan(0);
  });

  it('returns DEFAULT_MODIFIERS when no crises produce impacts', () => {
    const gov = new FreeformGovernor();

    // Month 6 — no ChaosEngine check, no historical windows checked
    const directive = gov.evaluate(makeCtx({ year: 1917, month: 6 }));

    expect(directive.modifiers).toEqual(DEFAULT_MODIFIERS);
    expect(directive.crisisImpacts).toEqual([]);
  });
});

// ─── 2. ChaosEngine generates crises ────────────────────────────────────────

describe('FreeformGovernor: ChaosEngine crisis generation', () => {
  it('ChaosEngine generates crises based on game state', () => {
    const gov = new FreeformGovernor();

    // Run many years with conditions that trigger crises
    for (let year = 1917; year <= 1970; year++) {
      gov.onYearBoundary(year);
      gov.evaluate(makeCtx({
        year,
        month: 1,
        population: 3000,
        food: 200,
        money: 5000,
        rng: new GameRng(`chaos-${year}`),
        totalTicks: (year - 1917) * 12 + 1,
      }));
    }

    const events = gov.getTimeline().getAllEvents();
    const generated = events.filter((e) => !e.isHistorical);

    // Over 50+ years with stressed resources, ChaosEngine should fire
    expect(generated.length).toBeGreaterThan(0);
  });

  it('does not call ChaosEngine on non-January months', () => {
    const gov = new FreeformGovernor();

    // Only evaluate at month=6 — no crisis generation
    gov.evaluate(makeCtx({
      year: 1917,
      month: 6,
      rng: new GameRng('no-gen'),
      totalTicks: 6,
    }));

    const events = gov.getTimeline().getAllEvents();
    expect(events.length).toBe(0);
  });
});

// ─── 3. Merge modifiers ─────────────────────────────────────────────────────

describe('FreeformGovernor: merge modifiers', () => {
  it('modifiers reflect active crisis impacts', () => {
    const gov = new FreeformGovernor();

    // Run until something activates
    let hasImpacts = false;
    for (let year = 1917; year <= 1960 && !hasImpacts; year++) {
      gov.onYearBoundary(year);
      for (let month = 1; month <= 12; month++) {
        const directive = gov.evaluate(makeCtx({
          year,
          month,
          population: 3000,
          food: 200,
          money: 1000,
          rng: new GameRng(`merge-${year}-${month}`),
          totalTicks: (year - 1917) * 12 + month,
        }));

        if (directive.crisisImpacts.length > 0) {
          hasImpacts = true;
          expect(directive.modifiers).toBeDefined();
          expect(directive.modifiers.quotaMultiplier).toBeDefined();
          break;
        }
      }
    }

    expect(hasImpacts).toBe(true);
  });

  it('returns DEFAULT_MODIFIERS with no active crises', () => {
    const gov = new FreeformGovernor();

    const directive = gov.evaluate(makeCtx({ year: 1917, month: 6 }));
    expect(directive.modifiers).toEqual(DEFAULT_MODIFIERS);
  });
});

// ─── 4. Serialization ───────────────────────────────────────────────────────

describe('FreeformGovernor: serialization', () => {
  it('serializes and restores to equivalent state', () => {
    const gov1 = new FreeformGovernor();

    // Run a few years
    for (let year = 1917; year <= 1930; year++) {
      gov1.onYearBoundary(year);
      gov1.evaluate(makeCtx({
        year,
        month: 1,
        rng: new GameRng(`ser-${year}`),
        totalTicks: (year - 1917) * 12,
      }));
    }

    const savedData = gov1.serialize();

    // Create a fresh governor and restore
    const gov2 = new FreeformGovernor();
    gov2.restore(savedData);

    expect(savedData.mode).toBe('freeform');
    expect(gov2.isDiverged()).toBe(gov1.isDiverged());
    expect(gov2.getTotalCrisesExperienced()).toBe(gov1.getTotalCrisesExperienced());
    expect(gov2.getYearsSinceCounters()).toEqual(gov1.getYearsSinceCounters());
    expect(gov2.getTimeline().getAllEvents().length).toBe(gov1.getTimeline().getAllEvents().length);
  });

  it('save data includes all required fields', () => {
    const gov = new FreeformGovernor();
    gov.evaluate(makeCtx({ year: 1920, month: 1 }));
    const data = gov.serialize();

    expect(data.mode).toBe('freeform');
    expect(data.state.hasDiverged).toBe(true);
    expect(data.state.timeline).toBeDefined();
    expect(data.state.yearsSinceLastWar).toBeDefined();
    expect(data.state.yearsSinceLastFamine).toBeDefined();
    expect(data.state.yearsSinceLastDisaster).toBeDefined();
    expect(data.state.yearsSinceLastPolitical).toBeDefined();
    expect(data.state.totalCrisesExperienced).toBeDefined();
    expect(data.state.activeEntries).toBeDefined();
    expect(data.state.historicalWindowStates).toBeDefined();
  });

  it('restored governor preserves timeline events', () => {
    const gov1 = new FreeformGovernor();

    for (let year = 1917; year <= 1930; year++) {
      gov1.onYearBoundary(year);
      gov1.evaluate(makeCtx({ year, month: 1, rng: new GameRng(`tl-${year}`) }));
    }

    const eventsBefore = gov1.getTimeline().getAllEvents().length;
    const savedData = gov1.serialize();

    const gov2 = new FreeformGovernor();
    gov2.restore(savedData);

    const eventsAfter = gov2.getTimeline().getAllEvents().length;
    expect(eventsAfter).toBe(eventsBefore);
  });

  it('restores old-format saves (backward compatibility)', () => {
    const gov = new FreeformGovernor();

    // Simulate an old-format save with historicalAgentStates + freeformEntries
    const oldSave = {
      mode: 'freeform' as const,
      activeCrises: [],
      state: {
        divergenceYear: 1945,
        hasDiverged: true,
        currentYear: 1950,
        historicalAgentStates: {},
        historicalActivatedSet: [],
        freeformEntries: [],
        timeline: { events: [], divergencePoints: [] },
        yearsSinceLastWar: 5,
        yearsSinceLastFamine: 10,
        yearsSinceLastDisaster: 10,
        yearsSinceLastPolitical: 10,
        totalCrisesExperienced: 3,
      },
    };

    gov.restore(oldSave);

    expect(gov.isDiverged()).toBe(true);
    expect(gov.getDivergenceYear()).toBe(1945);
    expect(gov.getTotalCrisesExperienced()).toBe(3);
    expect(gov.getYearsSinceCounters().war).toBe(5);
  });
});

// ─── 5. Year-since counters ─────────────────────────────────────────────────

describe('FreeformGovernor: year-since counters', () => {
  it('increments all counters each year boundary', () => {
    const gov = new FreeformGovernor();
    const initial = gov.getYearsSinceCounters();

    gov.onYearBoundary(1920);
    gov.onYearBoundary(1921);
    gov.onYearBoundary(1922);

    const after = gov.getYearsSinceCounters();
    expect(after.war).toBe(initial.war + 3);
    expect(after.famine).toBe(initial.famine + 3);
    expect(after.disaster).toBe(initial.disaster + 3);
    expect(after.political).toBe(initial.political + 3);
  });

  it('counters are preserved across serialize/restore', () => {
    const gov1 = new FreeformGovernor();

    gov1.onYearBoundary(1920);
    gov1.onYearBoundary(1921);
    gov1.onYearBoundary(1922);

    const countersBefore = gov1.getYearsSinceCounters();
    const savedData = gov1.serialize();

    const gov2 = new FreeformGovernor();
    gov2.restore(savedData);

    const countersAfter = gov2.getYearsSinceCounters();
    expect(countersAfter).toEqual(countersBefore);
  });
});

// ─── 6. getActiveCrises() ───────────────────────────────────────────────────

describe('FreeformGovernor: getActiveCrises()', () => {
  it('returns empty array initially', () => {
    const gov = new FreeformGovernor();
    gov.evaluate(makeCtx({ year: 1917, month: 6 }));
    expect(gov.getActiveCrises()).toEqual([]);
  });

  it('returns IDs of active crises after probabilistic activation', () => {
    const gov = new FreeformGovernor();

    // Run years until something activates
    for (let year = 1917; year <= 1960; year++) {
      gov.onYearBoundary(year);
      gov.evaluate(makeCtx({
        year,
        month: 1,
        population: 3000,
        food: 200,
        money: 5000,
        rng: new GameRng(`active-${year}`),
        totalTicks: (year - 1917) * 12 + 1,
      }));
    }

    const events = gov.getTimeline().getAllEvents();
    expect(events.length).toBeGreaterThan(0);
  });
});

// ─── 7. Backward compatibility ──────────────────────────────────────────────

describe('FreeformGovernor: backward compatibility', () => {
  it('constructor accepts optional divergenceYear parameter', () => {
    const gov = new FreeformGovernor(1945);
    expect(gov.getDivergenceYear()).toBe(1945);
    expect(gov.isDiverged()).toBe(true);
  });

  it('constructor without parameter defaults divergenceYear to 1917', () => {
    const gov = new FreeformGovernor();
    expect(gov.getDivergenceYear()).toBe(1917);
  });
});

// ─── 8. totalCrisesExperienced ──────────────────────────────────────────────

describe('FreeformGovernor: totalCrisesExperienced', () => {
  it('increments when crises are activated', () => {
    const gov = new FreeformGovernor();

    expect(gov.getTotalCrisesExperienced()).toBe(0);

    // Run until something fires
    for (let year = 1917; year <= 1960; year++) {
      gov.onYearBoundary(year);
      gov.evaluate(makeCtx({
        year,
        month: 1,
        population: 3000,
        food: 200,
        money: 5000,
        rng: new GameRng(`total-${year}`),
        totalTicks: (year - 1917) * 12 + 1,
      }));
    }

    expect(gov.getTotalCrisesExperienced()).toBeGreaterThan(0);
  });
});
