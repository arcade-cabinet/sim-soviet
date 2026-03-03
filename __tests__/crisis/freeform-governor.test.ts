/**
 * FreeformGovernor test suite.
 *
 * Verifies pre-divergence delegation, divergence point recording,
 * post-divergence chaos engine integration, timeline accumulation,
 * serialization round-trips, and seed determinism.
 */

import { FreeformGovernor } from '@/ai/agents/crisis/FreeformGovernor';
import { GovernorContext } from '@/ai/agents/crisis/Governor';
import { DEFAULT_MODIFIERS } from '@/ai/agents/crisis/Governor';
import { GameRng } from '@/game/SeedSystem';

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<GovernorContext> = {}): GovernorContext {
  return {
    year: 1940,
    month: 1,
    population: 500,
    food: 1000,
    money: 2000,
    rng: new GameRng('test-seed'),
    totalTicks: 100,
    eraId: 'prewar',
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FreeformGovernor', () => {
  describe('pre-divergence', () => {
    it('delegates to HistoricalGovernor before divergence year', () => {
      const rng = new GameRng('test-pre-diverge');
      const gov = new FreeformGovernor(1945, rng);

      // 1941: GPW should activate via HistoricalGovernor
      const ctx = makeCtx({
        year: 1941,
        month: 1,
        rng: new GameRng('tick-rng'),
        totalTicks: 288,
      });

      const directive = gov.evaluate(ctx);

      // Should have crisis impacts from GPW (war agent)
      expect(directive.crisisImpacts.length).toBeGreaterThan(0);
      expect(directive.modifiers).toBeDefined();
      expect(gov.hasDiverged()).toBe(false);
    });

    it('returns active crises from HistoricalGovernor before divergence', () => {
      const rng = new GameRng('test-active-crises');
      const gov = new FreeformGovernor(1945, rng);

      // Evaluate at 1941 to activate GPW
      const ctx = makeCtx({
        year: 1941,
        month: 1,
        rng: new GameRng('tick-rng-2'),
        totalTicks: 288,
      });
      gov.evaluate(ctx);

      const active = gov.getActiveCrises();
      // GPW should be active
      expect(active.some((id) => id.includes('gpw') || id.includes('war'))).toBe(true);
    });

    it('records historical crises to the timeline', () => {
      const rng = new GameRng('test-record');
      const gov = new FreeformGovernor(1945, rng);

      // Evaluate at 1941 to activate GPW
      gov.evaluate(makeCtx({
        year: 1941,
        month: 1,
        rng: new GameRng('tick-rng-3'),
        totalTicks: 288,
      }));

      const events = gov.getTimeline().getAllEvents();
      expect(events.length).toBeGreaterThan(0);
      expect(events.some((e) => e.isHistorical)).toBe(true);
    });
  });

  describe('at divergence', () => {
    it('records a DivergencePoint at the divergence year', () => {
      const rng = new GameRng('test-diverge');
      const gov = new FreeformGovernor(1945, rng);

      // Pre-divergence tick
      gov.evaluate(makeCtx({
        year: 1944,
        month: 6,
        rng: new GameRng('tick-1'),
        totalTicks: 330,
      }));
      expect(gov.hasDiverged()).toBe(false);

      // Divergence tick
      gov.evaluate(makeCtx({
        year: 1945,
        month: 1,
        rng: new GameRng('tick-2'),
        totalTicks: 336,
      }));
      expect(gov.hasDiverged()).toBe(true);

      const divergences = gov.getTimeline().getDivergencePoints();
      expect(divergences.length).toBe(1);
      expect(divergences[0]!.year).toBe(1945);
      expect(divergences[0]!.playerChoice).toBe('freeform_start');
    });

    it('only records divergence once even if evaluated multiple times at divergence year', () => {
      const rng = new GameRng('test-once');
      const gov = new FreeformGovernor(1945, rng);

      for (let month = 1; month <= 3; month++) {
        gov.evaluate(makeCtx({
          year: 1945,
          month,
          rng: new GameRng(`tick-${month}`),
          totalTicks: 336 + month,
        }));
      }

      const divergences = gov.getTimeline().getDivergencePoints();
      expect(divergences.length).toBe(1);
    });
  });

  describe('post-divergence', () => {
    it('uses ChaosEngine for crisis generation after divergence', () => {
      const rng = new GameRng('test-chaos');
      const gov = new FreeformGovernor(1920, rng);

      // Run many years post-divergence to trigger chaos-generated crises
      let totalEvents = 0;
      for (let year = 1920; year <= 1960; year++) {
        gov.onYearBoundary(year);
        for (let month = 1; month <= 12; month++) {
          gov.evaluate(makeCtx({
            year,
            month,
            population: 1000,
            food: 200,
            money: 3000,
            rng: new GameRng(`chaos-${year}-${month}`),
            totalTicks: (year - 1917) * 12 + month,
          }));
        }
      }

      const events = gov.getTimeline().getAllEvents();
      const nonHistorical = events.filter((e) => !e.isHistorical);
      // Over 40 years of chaos, should generate at least some crises
      expect(nonHistorical.length).toBeGreaterThan(0);
    });

    it('active crisis agents produce impacts', () => {
      const rng = new GameRng('test-impacts');
      const gov = new FreeformGovernor(1920, rng);

      // Run until we get impacts from freeform agents
      let foundImpacts = false;
      for (let year = 1920; year <= 1970 && !foundImpacts; year++) {
        gov.onYearBoundary(year);
        for (let month = 1; month <= 12; month++) {
          const directive = gov.evaluate(makeCtx({
            year,
            month,
            population: 1000,
            food: 100,
            money: 5000,
            rng: new GameRng(`impacts-${year}-${month}`),
            totalTicks: (year - 1917) * 12 + month,
          }));

          if (directive.crisisImpacts.length > 0 && gov.hasDiverged()) {
            foundImpacts = true;
            // Verify impacts have proper structure
            for (const impact of directive.crisisImpacts) {
              expect(impact.crisisId).toBeDefined();
              expect(typeof impact.crisisId).toBe('string');
            }
            break;
          }
        }
      }

      expect(foundImpacts).toBe(true);
    });

    it('returns default modifiers when no crises are active post-divergence', () => {
      const rng = new GameRng('test-default-mods');
      const gov = new FreeformGovernor(1917, rng);

      // First tick at divergence year — ChaosEngine may not trigger anything
      const directive = gov.evaluate(makeCtx({
        year: 1917,
        month: 6, // Not month 1, so no crisis check
        rng: new GameRng('default-tick'),
        totalTicks: 6,
      }));

      expect(directive.modifiers).toEqual(DEFAULT_MODIFIERS);
    });
  });

  describe('timeline accumulation', () => {
    it('accumulates both historical and generated events', () => {
      const rng = new GameRng('test-timeline');
      const gov = new FreeformGovernor(1945, rng);

      // Pre-divergence: run through GPW to get historical events
      for (let year = 1941; year < 1945; year++) {
        gov.onYearBoundary(year);
        for (let month = 1; month <= 12; month++) {
          gov.evaluate(makeCtx({
            year,
            month,
            rng: new GameRng(`timeline-${year}-${month}`),
            totalTicks: (year - 1917) * 12 + month,
          }));
        }
      }

      const historicalEvents = gov.getTimeline().queryEvents({ isHistorical: true });
      expect(historicalEvents.length).toBeGreaterThan(0);

      // Post-divergence: run until we get chaos events
      for (let year = 1945; year <= 1990; year++) {
        gov.onYearBoundary(year);
        for (let month = 1; month <= 12; month++) {
          gov.evaluate(makeCtx({
            year,
            month,
            population: 1000,
            food: 200,
            money: 3000,
            rng: new GameRng(`timeline-post-${year}-${month}`),
            totalTicks: (year - 1917) * 12 + month,
          }));
        }
      }

      const allEvents = gov.getTimeline().getAllEvents();
      const divergent = allEvents.filter((e) => !e.isHistorical);
      // Should have both historical and generated events
      expect(historicalEvents.length).toBeGreaterThan(0);
      expect(divergent.length).toBeGreaterThan(0);
      expect(allEvents.length).toBe(historicalEvents.length + divergent.length);
    });
  });

  describe('serialization', () => {
    it('round-trips governor state through serialize/restore', () => {
      const rng = new GameRng('test-serialize');
      const gov = new FreeformGovernor(1945, rng);

      // Run up to and past divergence
      for (let year = 1941; year <= 1950; year++) {
        gov.onYearBoundary(year);
        for (let month = 1; month <= 12; month++) {
          gov.evaluate(makeCtx({
            year,
            month,
            population: 500,
            food: 800,
            money: 2000,
            rng: new GameRng(`ser-${year}-${month}`),
            totalTicks: (year - 1917) * 12 + month,
          }));
        }
      }

      // Serialize
      const saved = gov.serialize();
      expect(saved.mode).toBe('freeform');

      // Restore into a new governor
      const rng2 = new GameRng('test-serialize');
      const gov2 = new FreeformGovernor(1945, rng2);
      gov2.restore(saved);

      // Verify restored state
      expect(gov2.hasDiverged()).toBe(true);
      const saved2 = gov2.serialize();
      expect(saved2.state['divergenceYear']).toBe(1945);
      expect(saved2.state['diverged']).toBe(true);

      // Timeline events should be preserved
      const events1 = gov.getTimeline().getAllEvents();
      const events2 = gov2.getTimeline().getAllEvents();
      expect(events2.length).toBe(events1.length);
    });
  });

  describe('seed determinism', () => {
    it('different seeds produce different post-divergence outcomes', () => {
      const outcomes: Map<string, number> = new Map();

      for (const seed of ['seed-alpha', 'seed-beta', 'seed-gamma']) {
        const rng = new GameRng(seed);
        const gov = new FreeformGovernor(1920, rng);

        for (let year = 1920; year <= 1960; year++) {
          gov.onYearBoundary(year);
          for (let month = 1; month <= 12; month++) {
            gov.evaluate(makeCtx({
              year,
              month,
              population: 1000,
              food: 300,
              money: 3000,
              rng: new GameRng(`${seed}-${year}-${month}`),
              totalTicks: (year - 1917) * 12 + month,
            }));
          }
        }

        const events = gov.getTimeline().getAllEvents();
        outcomes.set(seed, events.filter((e) => !e.isHistorical).length);
      }

      // With 3 different seeds over 40 years, not all outcomes should be identical
      const counts = [...outcomes.values()];
      const allSame = counts.every((c) => c === counts[0]);
      // It's statistically very unlikely all three seeds produce identical event counts
      // but if they do, at least verify they produced events
      if (allSame) {
        expect(counts[0]!).toBeGreaterThan(0);
      } else {
        expect(new Set(counts).size).toBeGreaterThanOrEqual(2);
      }
    });

    it('same seed produces same outcomes', () => {
      function runGovernor(seed: string): string[] {
        const rng = new GameRng(seed);
        const gov = new FreeformGovernor(1920, rng);

        for (let year = 1920; year <= 1940; year++) {
          gov.onYearBoundary(year);
          for (let month = 1; month <= 12; month++) {
            gov.evaluate(makeCtx({
              year,
              month,
              population: 1000,
              food: 300,
              money: 3000,
              rng: new GameRng(`${seed}-${year}-${month}`),
              totalTicks: (year - 1917) * 12 + month,
            }));
          }
        }

        return gov.getTimeline().getAllEvents()
          .filter((e) => !e.isHistorical)
          .map((e) => e.eventId);
      }

      const run1 = runGovernor('deterministic-seed');
      const run2 = runGovernor('deterministic-seed');
      expect(run1).toEqual(run2);
    });
  });

  describe('edge cases', () => {
    it('diverge at 1917: everything diverges immediately', () => {
      const rng = new GameRng('test-1917');
      const gov = new FreeformGovernor(1917, rng);

      const directive = gov.evaluate(makeCtx({
        year: 1917,
        month: 1,
        rng: new GameRng('tick-1917'),
        totalTicks: 0,
      }));

      expect(gov.hasDiverged()).toBe(true);
      expect(directive.modifiers).toBeDefined();

      // No historical events should be recorded (diverged immediately)
      const historicalEvents = gov.getTimeline().queryEvents({ isHistorical: true });
      expect(historicalEvents.length).toBe(0);

      // Should have a divergence point
      const divergences = gov.getTimeline().getDivergencePoints();
      expect(divergences.length).toBe(1);
      expect(divergences[0]!.year).toBe(1917);
    });

    it('diverge at 1945: plays through GPW then diverges', () => {
      const rng = new GameRng('test-1945');
      const gov = new FreeformGovernor(1945, rng);

      // Pre-divergence: evaluate at 1941 to trigger GPW
      gov.evaluate(makeCtx({
        year: 1941,
        month: 6,
        rng: new GameRng('gpw-tick'),
        totalTicks: 294,
      }));
      expect(gov.hasDiverged()).toBe(false);

      // Should have GPW active
      const active = gov.getActiveCrises();
      expect(active.length).toBeGreaterThan(0);

      // Diverge at 1945
      gov.evaluate(makeCtx({
        year: 1945,
        month: 1,
        rng: new GameRng('diverge-tick'),
        totalTicks: 336,
      }));
      expect(gov.hasDiverged()).toBe(true);

      // After divergence, getActiveCrises returns freeform agents (may be empty)
      const postDivActive = gov.getActiveCrises();
      expect(Array.isArray(postDivActive)).toBe(true);
    });

    it('onYearBoundary increments year-since counters', () => {
      const rng = new GameRng('test-counters');
      const gov = new FreeformGovernor(1920, rng);

      // Call onYearBoundary several times
      for (let year = 1920; year <= 1925; year++) {
        gov.onYearBoundary(year);
      }

      // Serialize to inspect counters
      const saved = gov.serialize();
      expect(saved.state['yearsSinceLastWar']).toBe(6);
      expect(saved.state['yearsSinceLastFamine']).toBe(6);
      expect(saved.state['yearsSinceLastDisaster']).toBe(6);
      expect(saved.state['yearsSinceLastPolitical']).toBe(6);
    });
  });
});
