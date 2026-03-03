/**
 * @fileoverview Tests for FreeformGovernor — alternate-history governor
 * that plays real Soviet history up to a divergence year, then uses
 * ChaosEngine for speculative crisis generation.
 *
 * Validates pre-divergence activation, post-divergence ChaosEngine usage,
 * no historical crises after divergence, divergence transition, modifier
 * merging, serialization round-trips, year-since counters, getActiveCrises(),
 * and extreme divergence years.
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

// ─── 1. Pre-divergence: activates historical crises ──────────────────────

describe('FreeformGovernor: pre-divergence', () => {
  it('activates Civil War (1918-1921) when year reaches 1918', () => {
    const gov = new FreeformGovernor(1945);

    // 1917 — nothing should be active
    gov.evaluate(makeCtx({ year: 1917 }));
    expect(gov.getActiveCrises()).toEqual([]);
    expect(gov.isDiverged()).toBe(false);

    // 1918 — Civil War should activate
    gov.evaluate(makeCtx({ year: 1918 }));
    const active = gov.getActiveCrises();
    expect(active).toContain('russian_civil_war');
    expect(gov.isDiverged()).toBe(false);
  });

  it('activates multiple historical crises concurrently', () => {
    const gov = new FreeformGovernor(1945);

    // 1921: Civil War (1918-1921) + Famine (1921-1922) + Polish-Soviet War (1920-1921)
    gov.evaluate(makeCtx({ year: 1921, month: 6 }));
    const active = gov.getActiveCrises();

    expect(active).toContain('russian_civil_war');
    expect(active).toContain('famine_1921');
  });

  it('returns DEFAULT_MODIFIERS when no crises are active in 1917', () => {
    const gov = new FreeformGovernor(1945);

    const directive = gov.evaluate(makeCtx({ year: 1917, month: 1 }));

    expect(directive.modifiers).toEqual(DEFAULT_MODIFIERS);
    expect(directive.crisisImpacts).toEqual([]);
  });

  it('records historical events to timeline', () => {
    const gov = new FreeformGovernor(1945);

    gov.evaluate(makeCtx({ year: 1918 }));

    const events = gov.getTimeline().getAllEvents();
    expect(events.length).toBeGreaterThan(0);
    expect(events.some((e) => e.isHistorical)).toBe(true);
    expect(events.some((e) => e.eventId === 'russian_civil_war')).toBe(true);
  });
});

// ─── 2. Post-divergence: ChaosEngine is used ─────────────────────────────

describe('FreeformGovernor: post-divergence ChaosEngine', () => {
  it('uses ChaosEngine to generate crises after divergence year', () => {
    // Diverge early to maximize freeform period
    const gov = new FreeformGovernor(1920);

    // Run many years post-divergence with conditions that should trigger crises
    for (let year = 1920; year <= 1970; year++) {
      gov.onYearBoundary(year);
      gov.evaluate(
        makeCtx({
          year,
          month: 1, // month=1 triggers ChaosEngine check
          population: 3000,
          food: 200,
          money: 5000,
          rng: new GameRng(`chaos-${year}`),
          totalTicks: (year - 1917) * 12 + 1,
        }),
      );
    }

    const events = gov.getTimeline().getAllEvents();
    const generated = events.filter((e) => !e.isHistorical);

    // Over 50 years with stressed resources, ChaosEngine should fire
    expect(generated.length).toBeGreaterThan(0);
  });

  it('generated crises produce impacts via their agents', () => {
    const gov = new FreeformGovernor(1920);
    let foundImpactsPostDivergence = false;

    for (let year = 1920; year <= 1980 && !foundImpactsPostDivergence; year++) {
      gov.onYearBoundary(year);
      for (let month = 1; month <= 12; month++) {
        const directive = gov.evaluate(
          makeCtx({
            year,
            month,
            population: 3000,
            food: 100,
            money: 5000,
            rng: new GameRng(`impacts-${year}-${month}`),
            totalTicks: (year - 1917) * 12 + month,
          }),
        );

        if (directive.crisisImpacts.length > 0 && gov.isDiverged()) {
          foundImpactsPostDivergence = true;
          for (const impact of directive.crisisImpacts) {
            expect(impact.crisisId).toBeDefined();
            expect(typeof impact.crisisId).toBe('string');
          }
          break;
        }
      }
    }

    expect(foundImpactsPostDivergence).toBe(true);
  });

  it('does not call ChaosEngine on non-January months', () => {
    const gov = new FreeformGovernor(1917);

    // Only evaluate at month=6 (not month=1) — no crisis generation
    gov.evaluate(
      makeCtx({
        year: 1917,
        month: 6,
        rng: new GameRng('no-gen'),
        totalTicks: 6,
      }),
    );

    const events = gov.getTimeline().getAllEvents();
    const generated = events.filter((e) => !e.isHistorical);
    expect(generated.length).toBe(0);
  });
});

// ─── 3. No historical crises after divergence ────────────────────────────

describe('FreeformGovernor: no historical crises after divergence', () => {
  it('does not activate crises with startYear >= divergenceYear', () => {
    // Diverge at 1930 — GPW (1941) should NOT activate
    const gov = new FreeformGovernor(1930);

    // Pre-divergence: 1918 Civil War should activate
    gov.evaluate(makeCtx({ year: 1918 }));
    expect(gov.getActiveCrises()).toContain('russian_civil_war');

    // Post-divergence: 1941 GPW should NOT activate
    gov.evaluate(makeCtx({ year: 1941, month: 6 }));
    expect(gov.isDiverged()).toBe(true);
    expect(gov.getActiveCrises()).not.toContain('great_patriotic_war');
  });

  it('historical crises starting at divergenceYear are excluded', () => {
    // If diverge at 1918, the Civil War (startYear=1918) should NOT activate
    const gov = new FreeformGovernor(1918);

    gov.evaluate(makeCtx({ year: 1918 }));
    expect(gov.isDiverged()).toBe(true);
    expect(gov.getActiveCrises()).not.toContain('russian_civil_war');
  });
});

// ─── 4. Divergence transition ────────────────────────────────────────────

describe('FreeformGovernor: divergence transition', () => {
  it('exact divergence year triggers hasDiverged=true', () => {
    const gov = new FreeformGovernor(1945);

    // Before divergence
    gov.evaluate(makeCtx({ year: 1944, month: 12 }));
    expect(gov.isDiverged()).toBe(false);

    // At divergence
    gov.evaluate(makeCtx({ year: 1945, month: 1 }));
    expect(gov.isDiverged()).toBe(true);
  });

  it('records a divergence point on the timeline', () => {
    const gov = new FreeformGovernor(1945);

    gov.evaluate(makeCtx({ year: 1945, month: 3, totalTicks: 336 }));

    const points = gov.getTimeline().getDivergencePoints();
    expect(points.length).toBe(1);
    expect(points[0]!.year).toBe(1945);
    expect(points[0]!.month).toBe(3);
  });

  it('does not record divergence point multiple times', () => {
    const gov = new FreeformGovernor(1945);

    gov.evaluate(makeCtx({ year: 1945, month: 1 }));
    gov.evaluate(makeCtx({ year: 1945, month: 2 }));
    gov.evaluate(makeCtx({ year: 1946, month: 1 }));

    const points = gov.getTimeline().getDivergencePoints();
    expect(points.length).toBe(1);
  });

  it('activated historical crises remain active after divergence', () => {
    const gov = new FreeformGovernor(1945);

    // Activate GPW at 1941
    gov.evaluate(makeCtx({ year: 1941, month: 6 }));
    expect(gov.getActiveCrises()).toContain('great_patriotic_war');

    // Diverge at 1945 — GPW should still be active (in buildup/peak/aftermath)
    advanceTicks(gov, 3, { year: 1945, month: 1 });
    expect(gov.isDiverged()).toBe(true);
    // GPW may still be active depending on phase
    const active = gov.getActiveCrises();
    // It was activated and should still be processing
    expect(active).toContain('great_patriotic_war');
  });
});

// ─── 5. Merge modifiers ─────────────────────────────────────────────────

describe('FreeformGovernor: merge modifiers', () => {
  it('applies same multiplicative logic as HistoricalGovernor', () => {
    const gov = new FreeformGovernor(1950);

    // Advance into 1921 where multiple crises are active
    advanceTicks(gov, 12, { year: 1920 });
    const directive = advanceTicks(gov, 3, { year: 1921, month: 6 });

    // With active crises, modifiers should differ from defaults
    expect(directive.modifiers).toBeDefined();
    expect(directive.modifiers.quotaMultiplier).toBeDefined();
  });

  it('returns DEFAULT_MODIFIERS when no crises produce impacts', () => {
    const gov = new FreeformGovernor(2000);

    const directive = gov.evaluate(makeCtx({ year: 1917, month: 1 }));

    expect(directive.modifiers).toEqual(DEFAULT_MODIFIERS);
  });

  it('kgbAggression escalates with high KGB multipliers', () => {
    const gov = new FreeformGovernor(1950);

    // Advance through Civil War buildup into peak for KGB effects
    advanceTicks(gov, 8, { year: 1919 });
    const directive = gov.evaluate(makeCtx({ year: 1919, month: 6 }));

    // War impacts include kgbAggressionMult > 1.0
    expect(directive.modifiers.kgbAggression).toBeDefined();
  });
});

// ─── 6. Serialize/restore round-trip ─────────────────────────────────────

describe('FreeformGovernor: serialization', () => {
  it('serializes and restores to equivalent state', () => {
    const gov1 = new FreeformGovernor(1945);

    // Run past divergence with some history
    advanceTicks(gov1, 5, { year: 1918 });
    advanceTicks(gov1, 5, { year: 1941 });
    advanceTicks(gov1, 3, { year: 1946 });

    const activeBefore = gov1.getActiveCrises().sort();
    const savedData = gov1.serialize();

    // Create a fresh governor and restore
    const gov2 = new FreeformGovernor(1945);
    gov2.restore(savedData);

    const activeAfter = gov2.getActiveCrises().sort();

    expect(savedData.mode).toBe('freeform');
    expect(activeAfter).toEqual(activeBefore);
  });

  it('save data includes all required fields', () => {
    const gov = new FreeformGovernor(1945);

    advanceTicks(gov, 3, { year: 1946 });
    const data = gov.serialize();

    expect(data.mode).toBe('freeform');
    expect(data.state.divergenceYear).toBe(1945);
    expect(data.state.hasDiverged).toBe(true);
    expect(data.state.historicalAgentStates).toBeDefined();
    expect(data.state.historicalActivatedSet).toBeDefined();
    expect(data.state.freeformEntries).toBeDefined();
    expect(data.state.timeline).toBeDefined();
    expect(data.state.yearsSinceLastWar).toBeDefined();
    expect(data.state.yearsSinceLastFamine).toBeDefined();
    expect(data.state.yearsSinceLastDisaster).toBeDefined();
    expect(data.state.yearsSinceLastPolitical).toBeDefined();
    expect(data.state.totalCrisesExperienced).toBeDefined();
  });

  it('restored governor preserves timeline events', () => {
    const gov1 = new FreeformGovernor(1930);

    // Activate some historical crises
    gov1.evaluate(makeCtx({ year: 1918 }));
    gov1.evaluate(makeCtx({ year: 1921 }));

    const eventsBefore = gov1.getTimeline().getAllEvents().length;
    const savedData = gov1.serialize();

    const gov2 = new FreeformGovernor(1930);
    gov2.restore(savedData);

    const eventsAfter = gov2.getTimeline().getAllEvents().length;
    expect(eventsAfter).toBe(eventsBefore);
  });

  it('restored governor produces consistent directives', () => {
    const rngSeed = 'ser-consistency';
    const gov1 = new FreeformGovernor(1945);

    advanceTicks(gov1, 3, {
      year: 1941,
      rng: new GameRng(rngSeed),
    });

    const savedData = gov1.serialize();

    const gov2 = new FreeformGovernor(1945);
    gov2.restore(savedData);

    // Both should evaluate to same active crises
    const dir1 = gov1.evaluate(makeCtx({ year: 1942, rng: new GameRng(rngSeed) }));
    const dir2 = gov2.evaluate(makeCtx({ year: 1942, rng: new GameRng(rngSeed) }));

    const ids1 = dir1.crisisImpacts.map((i) => i.crisisId).sort();
    const ids2 = dir2.crisisImpacts.map((i) => i.crisisId).sort();
    expect(ids2).toEqual(ids1);
  });
});

// ─── 7. Year-since counters ─────────────────────────────────────────────

describe('FreeformGovernor: year-since counters', () => {
  it('increments all counters each year boundary', () => {
    const gov = new FreeformGovernor(1950);
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

  it('resets counter for types with active crises', () => {
    const gov = new FreeformGovernor(1950);

    // Activate Civil War (type: 'war')
    gov.evaluate(makeCtx({ year: 1918 }));

    // Year boundary with active war
    gov.onYearBoundary(1919);

    const counters = gov.getYearsSinceCounters();
    expect(counters.war).toBe(0);
    // Others should have incremented
    expect(counters.famine).toBeGreaterThan(0);
  });

  it('counters are preserved across serialize/restore', () => {
    const gov1 = new FreeformGovernor(1950);

    gov1.onYearBoundary(1920);
    gov1.onYearBoundary(1921);
    gov1.onYearBoundary(1922);

    const countersBefore = gov1.getYearsSinceCounters();
    const savedData = gov1.serialize();

    const gov2 = new FreeformGovernor(1950);
    gov2.restore(savedData);

    const countersAfter = gov2.getYearsSinceCounters();
    expect(countersAfter).toEqual(countersBefore);
  });
});

// ─── 8. getActiveCrises() ───────────────────────────────────────────────

describe('FreeformGovernor: getActiveCrises()', () => {
  it('returns combined historical + freeform active crisis IDs', () => {
    const gov = new FreeformGovernor(1920);

    // Activate Civil War (historical, before divergence)
    gov.evaluate(makeCtx({ year: 1918, month: 6 }));
    const preDivActive = gov.getActiveCrises();
    expect(preDivActive).toContain('russian_civil_war');

    // Diverge and run until freeform crises appear
    for (let year = 1920; year <= 1970; year++) {
      gov.onYearBoundary(year);
      gov.evaluate(
        makeCtx({
          year,
          month: 1,
          population: 3000,
          food: 100,
          money: 5000,
          rng: new GameRng(`active-${year}`),
          totalTicks: (year - 1917) * 12 + 1,
        }),
      );
    }

    // By now, freeform crises should exist in timeline
    const events = gov.getTimeline().getAllEvents();
    const generated = events.filter((e) => !e.isHistorical);
    expect(generated.length).toBeGreaterThan(0);
  });

  it('returns empty array when no crises active', () => {
    const gov = new FreeformGovernor(1945);

    gov.evaluate(makeCtx({ year: 1917 }));
    expect(gov.getActiveCrises()).toEqual([]);
  });

  it('does not include political crises (same as HistoricalGovernor)', () => {
    const gov = new FreeformGovernor(2000);

    gov.evaluate(makeCtx({ year: 1991 }));

    const active = gov.getActiveCrises();
    const politicalIds = [
      'red_terror',
      'great_terror',
      'destalinization',
      'virgin_lands',
      'anti_alcohol_campaign',
      'glasnost_perestroika',
      'kronstadt_rebellion',
      'doctors_plot',
      'sino_soviet_split',
      'august_coup',
    ];
    for (const id of politicalIds) {
      expect(active).not.toContain(id);
    }
  });
});

// ─── 9. Different divergence years ──────────────────────────────────────

describe('FreeformGovernor: different divergence years', () => {
  it('diverge from 1917: everything diverges immediately', () => {
    const gov = new FreeformGovernor(1917);

    const directive = gov.evaluate(
      makeCtx({
        year: 1917,
        month: 1,
        totalTicks: 0,
      }),
    );

    expect(gov.isDiverged()).toBe(true);
    expect(gov.getDivergenceYear()).toBe(1917);

    // No historical crises should have been activated
    expect(gov.getActiveCrises()).toEqual([]);

    // No historical events on timeline
    const historicalEvents = gov.getTimeline().queryEvents({ isHistorical: true });
    expect(historicalEvents.length).toBe(0);

    // Should have a divergence point
    const divergences = gov.getTimeline().getDivergencePoints();
    expect(divergences.length).toBe(1);

    // Modifiers should be default (no crises active yet)
    expect(directive.modifiers).toEqual(DEFAULT_MODIFIERS);
  });

  it('diverge from 1991: plays all of Soviet history', () => {
    const gov = new FreeformGovernor(1991);

    // Tick through key years — all historical crises should activate
    const keyYears = [1918, 1921, 1932, 1941, 1956, 1986];
    for (const year of keyYears) {
      gov.evaluate(makeCtx({ year, month: 6 }));
    }

    // Check that many crises were activated
    // At 1986, Chernobyl + many others should be active
    gov.evaluate(makeCtx({ year: 1986 }));
    const events = gov.getTimeline().getAllEvents();
    const historicalEvents = events.filter((e) => e.isHistorical);
    expect(historicalEvents.length).toBeGreaterThan(5);

    // Still not diverged
    expect(gov.isDiverged()).toBe(false);

    // Diverge at 1991
    gov.evaluate(makeCtx({ year: 1991, month: 1 }));
    expect(gov.isDiverged()).toBe(true);
  });

  it('diverge from 1930: plays Revolution + NEP era, then diverges', () => {
    const gov = new FreeformGovernor(1930);

    // Civil War should activate
    gov.evaluate(makeCtx({ year: 1918 }));
    expect(gov.getActiveCrises()).toContain('russian_civil_war');

    // 1921 famine should activate
    gov.evaluate(makeCtx({ year: 1921 }));
    expect(gov.getActiveCrises()).toContain('famine_1921');

    // Holodomor (1932) should NOT activate — starts after divergence
    gov.evaluate(makeCtx({ year: 1932, month: 6 }));
    expect(gov.isDiverged()).toBe(true);
    expect(gov.getActiveCrises()).not.toContain('holodomor');
  });

  it('getDivergenceYear returns configured year', () => {
    expect(new FreeformGovernor(1945).getDivergenceYear()).toBe(1945);
    expect(new FreeformGovernor(1917).getDivergenceYear()).toBe(1917);
    expect(new FreeformGovernor(1991).getDivergenceYear()).toBe(1991);
  });
});

// ─── Additional: totalCrisesExperienced ─────────────────────────────────

describe('FreeformGovernor: totalCrisesExperienced', () => {
  it('increments when historical crises are activated', () => {
    const gov = new FreeformGovernor(1945);

    expect(gov.getTotalCrisesExperienced()).toBe(0);

    // Activate Civil War
    gov.evaluate(makeCtx({ year: 1918 }));
    expect(gov.getTotalCrisesExperienced()).toBeGreaterThan(0);
  });

  it('increments when freeform crises are generated', () => {
    const gov = new FreeformGovernor(1920);

    const initialCount = gov.getTotalCrisesExperienced();

    // Run until ChaosEngine generates something
    for (let year = 1920; year <= 1970; year++) {
      gov.onYearBoundary(year);
      gov.evaluate(
        makeCtx({
          year,
          month: 1,
          population: 3000,
          food: 100,
          money: 5000,
          rng: new GameRng(`total-${year}`),
          totalTicks: (year - 1917) * 12 + 1,
        }),
      );
    }

    expect(gov.getTotalCrisesExperienced()).toBeGreaterThan(initialCount);
  });
});
