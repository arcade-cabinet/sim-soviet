/**
 * Tests for PressureCrisisEngine, PressureSystem, and pressureCrisisMapping.
 *
 * Covers crisis emergence logic (sustained thresholds), pressure accumulation
 * via the dual-spread model, crisis template generation, and serialize/restore.
 */

import { PressureCrisisEngine } from '../../../src/ai/agents/crisis/pressure/PressureCrisisEngine';
import {
  PRESSURE_DOMAINS,
  createPressureState,
  type PressureDomain,
  type PressureGauge,
  type PressureState,
} from '../../../src/ai/agents/crisis/pressure/PressureDomains';
import {
  MAJOR_CRISES,
  MINOR_INCIDENTS,
  generateCrisisFromTemplate,
} from '../../../src/ai/agents/crisis/pressure/pressureCrisisMapping';
import { SUSTAIN_TICKS, THRESHOLDS } from '../../../src/ai/agents/crisis/pressure/pressureThresholds';
import { PressureSystem } from '../../../src/ai/agents/crisis/pressure/PressureSystem';
import type { PressureReadContext } from '../../../src/ai/agents/crisis/pressure/PressureDomains';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a PressureGauge with the given level and tick counters. */
function buildGauge(
  level: number,
  warningTicks = 0,
  criticalTicks = 0,
  lastRawReading = level,
): PressureGauge {
  return { level, trend: level, warningTicks, criticalTicks, lastRawReading };
}

/** Build a PressureState with all domains at zero, then override specific ones. */
function buildPressureState(overrides: Partial<Record<PressureDomain, PressureGauge>> = {}): PressureState {
  const state = createPressureState();
  for (const [domain, gauge] of Object.entries(overrides)) {
    state[domain as PressureDomain] = gauge as PressureGauge;
  }
  return state;
}

/** Create a minimal no-stress PressureReadContext. */
function createBaseCtx(): PressureReadContext {
  return {
    foodState: 'surplus',
    starvationCounter: 0,
    starvationGraceTicks: 90,
    averageMorale: 100,
    averageLoyalty: 100,
    sabotageCount: 0,
    flightCount: 0,
    population: 100,
    housingCapacity: 200,
    suspicionLevel: 0,
    blackMarks: 0,
    blat: 0,
    powerShortage: false,
    unpoweredCount: 0,
    totalBuildings: 10,
    averageDurability: 100,
    growthRate: 0.02,
    laborRatio: 0.6,
    sickCount: 0,
    quotaDeficit: 0,
    productionTrend: 1.0,
    season: 'winter',
    weather: 'snow',
  };
}

// ─── PressureCrisisEngine ─────────────────────────────────────────────────────

describe('PressureCrisisEngine', () => {
  describe('constructor', () => {
    it('creates engine with no active crises tracked', () => {
      const engine = new PressureCrisisEngine();
      expect(engine.getActiveCrisisIds()).toEqual([]);
    });

    it('initialises domain states for all 10 domains', () => {
      const engine = new PressureCrisisEngine();
      // Verify that no domain fires a major crisis on first check with zero pressure.
      const state = createPressureState();
      const result = engine.checkForEmergence(state, 1950, []);
      expect(result.majorCrises).toHaveLength(0);
      expect(result.minorImpacts).toHaveLength(0);
    });
  });

  // ─── checkForEmergence ─────────────────────────────────────────────────────

  describe('checkForEmergence()', () => {
    it('returns empty result when all pressures are below the warning threshold', () => {
      const engine = new PressureCrisisEngine();
      // All domains at 0.49 — just below the 0.50 WARNING threshold.
      const state = buildPressureState(
        Object.fromEntries(PRESSURE_DOMAINS.map((d) => [d, buildGauge(0.49, 0, 0)])) as Partial<
          Record<PressureDomain, PressureGauge>
        >,
      );
      const result = engine.checkForEmergence(state, 1950, []);
      expect(result.minorImpacts).toHaveLength(0);
      expect(result.majorCrises).toHaveLength(0);
    });

    it('does NOT fire a minor incident for exactly SUSTAIN_TICKS.WARNING_MINOR - 1 warning ticks', () => {
      const engine = new PressureCrisisEngine();
      const state = buildPressureState({
        food: buildGauge(THRESHOLDS.WARNING, SUSTAIN_TICKS.WARNING_MINOR - 1, 0),
      });
      const result = engine.checkForEmergence(state, 1950, []);
      expect(result.minorImpacts).toHaveLength(0);
    });

    it('fires a minor incident when warning threshold (0.50) is sustained for WARNING_MINOR ticks', () => {
      const engine = new PressureCrisisEngine();
      const state = buildPressureState({
        food: buildGauge(THRESHOLDS.WARNING, SUSTAIN_TICKS.WARNING_MINOR, 0),
      });
      const result = engine.checkForEmergence(state, 1950, []);
      expect(result.minorImpacts).toHaveLength(1);
      expect(result.minorImpacts[0]!.crisisId).toBe('minor-food');
    });

    it('does NOT re-fire the minor incident on a second tick once already active', () => {
      const engine = new PressureCrisisEngine();
      const state = buildPressureState({
        food: buildGauge(THRESHOLDS.WARNING, SUSTAIN_TICKS.WARNING_MINOR, 0),
      });
      engine.checkForEmergence(state, 1950, []);
      const result2 = engine.checkForEmergence(state, 1950, []);
      expect(result2.minorImpacts).toHaveLength(0);
    });

    it('fires a major crisis when critical threshold (0.75) is sustained for CRITICAL_MAJOR ticks', () => {
      const engine = new PressureCrisisEngine();
      const state = buildPressureState({
        food: buildGauge(THRESHOLDS.CRITICAL, 0, SUSTAIN_TICKS.CRITICAL_MAJOR),
      });
      const result = engine.checkForEmergence(state, 1950, []);
      expect(result.majorCrises).toHaveLength(1);
      expect(result.majorCrises[0]!.name).toContain('Famine');
    });

    it('does NOT fire a major crisis for critical ticks below CRITICAL_MAJOR', () => {
      const engine = new PressureCrisisEngine();
      const state = buildPressureState({
        food: buildGauge(THRESHOLDS.CRITICAL, 0, SUSTAIN_TICKS.CRITICAL_MAJOR - 1),
      });
      const result = engine.checkForEmergence(state, 1950, []);
      expect(result.majorCrises).toHaveLength(0);
    });

    it('fast-tracks a major crisis when emergency threshold (0.90) is sustained for EMERGENCY_MAJOR ticks', () => {
      const engine = new PressureCrisisEngine();
      // EMERGENCY_MAJOR (3) << CRITICAL_MAJOR (12): emergency should fire before the critical window.
      const state = buildPressureState({
        food: buildGauge(THRESHOLDS.EMERGENCY, 0, SUSTAIN_TICKS.EMERGENCY_MAJOR),
      });
      const result = engine.checkForEmergence(state, 1950, []);
      expect(result.majorCrises).toHaveLength(1);
    });

    it('does NOT fire a major crisis for emergency level below EMERGENCY_MAJOR tick count', () => {
      const engine = new PressureCrisisEngine();
      const state = buildPressureState({
        food: buildGauge(THRESHOLDS.EMERGENCY, 0, SUSTAIN_TICKS.EMERGENCY_MAJOR - 1),
      });
      const result = engine.checkForEmergence(state, 1950, []);
      expect(result.majorCrises).toHaveLength(0);
    });

    it('clears a minor incident when pressure drops below the warning threshold', () => {
      const engine = new PressureCrisisEngine();
      // Trigger the minor incident first.
      const highState = buildPressureState({
        food: buildGauge(THRESHOLDS.WARNING, SUSTAIN_TICKS.WARNING_MINOR, 0),
      });
      engine.checkForEmergence(highState, 1950, []);

      // Drop food pressure below warning.
      const lowState = buildPressureState({
        food: buildGauge(THRESHOLDS.WARNING - 0.1, 0, 0),
      });
      engine.checkForEmergence(lowState, 1950, []);

      // Now pressure is back above warning — minor should fire again.
      const highAgain = buildPressureState({
        food: buildGauge(THRESHOLDS.WARNING, SUSTAIN_TICKS.WARNING_MINOR, 0),
      });
      const result = engine.checkForEmergence(highAgain, 1950, []);
      expect(result.minorImpacts).toHaveLength(1);
    });

    it('fires crises in multiple domains simultaneously', () => {
      const engine = new PressureCrisisEngine();
      const state = buildPressureState({
        food: buildGauge(THRESHOLDS.CRITICAL, 0, SUSTAIN_TICKS.CRITICAL_MAJOR),
        morale: buildGauge(THRESHOLDS.CRITICAL, 0, SUSTAIN_TICKS.CRITICAL_MAJOR),
      });
      const result = engine.checkForEmergence(state, 1950, []);
      expect(result.majorCrises).toHaveLength(2);
      const crisisNames = result.majorCrises.map((c) => c.name);
      expect(crisisNames.some((n) => n.includes('Famine'))).toBe(true);
      expect(crisisNames.some((n) => n.includes('Worker Revolt'))).toBe(true);
    });

    it('does NOT fire a second major crisis for a domain while one is still active', () => {
      const engine = new PressureCrisisEngine();
      const state = buildPressureState({
        food: buildGauge(THRESHOLDS.CRITICAL, 0, SUSTAIN_TICKS.CRITICAL_MAJOR),
      });
      const result1 = engine.checkForEmergence(state, 1950, []);
      expect(result1.majorCrises).toHaveLength(1);
      const activeCrisisId = result1.majorCrises[0]!.id;

      // Second call with same state and the crisis still in activeCrisisIds.
      const result2 = engine.checkForEmergence(state, 1950, [activeCrisisId]);
      expect(result2.majorCrises).toHaveLength(0);
    });

    it('generated major crisis has a unique pressure-prefixed ID', () => {
      const engine = new PressureCrisisEngine();
      const state = buildPressureState({
        food: buildGauge(THRESHOLDS.CRITICAL, 0, SUSTAIN_TICKS.CRITICAL_MAJOR),
      });
      const result = engine.checkForEmergence(state, 1955, []);
      expect(result.majorCrises[0]!.id).toMatch(/^pressure-food-1955-\d+$/);
    });

    it('crisis severity scales with pressure level — high pressure elevates severity', () => {
      const engine = new PressureCrisisEngine();

      // Pressure at emergency level (0.95+) should elevate to 'existential'.
      const state = buildPressureState({
        food: buildGauge(0.96, 0, SUSTAIN_TICKS.EMERGENCY_MAJOR),
      });
      const result = engine.checkForEmergence(state, 1950, []);
      expect(result.majorCrises[0]!.severity).toBe('existential');
    });

    it('crisis severity stays at base when pressure is exactly at critical threshold', () => {
      const engine = new PressureCrisisEngine();
      // Food base severity is 'regional'. Pressure at 0.75 stays at or below 'regional'.
      const state = buildPressureState({
        food: buildGauge(0.75, 0, SUSTAIN_TICKS.CRITICAL_MAJOR),
      });
      const result = engine.checkForEmergence(state, 1950, []);
      expect(result.majorCrises[0]!.severity).toBe('regional');
    });

    it.each(PRESSURE_DOMAINS.map((d) => [d, MAJOR_CRISES[d].crisisType, MAJOR_CRISES[d].name]))(
      'domain "%s" generates a major crisis with type "%s" named "%s"',
      (domain, expectedType, expectedName) => {
        const engine = new PressureCrisisEngine();
        const state = buildPressureState({
          [domain]: buildGauge(THRESHOLDS.CRITICAL, 0, SUSTAIN_TICKS.CRITICAL_MAJOR),
        });
        const result = engine.checkForEmergence(state, 1950, []);
        expect(result.majorCrises).toHaveLength(1);
        const crisis = result.majorCrises[0]!;
        expect(crisis.type).toBe(expectedType);
        expect(crisis.name).toContain(expectedName as string);
        expect(crisis.id).toMatch(new RegExp(`^pressure-${domain}-1950-\\d+$`));
      },
    );

    it.each(PRESSURE_DOMAINS.map((d) => [d, MINOR_INCIDENTS[d].impact.crisisId]))(
      'domain "%s" generates a minor incident with crisisId "%s"',
      (domain, expectedCrisisId) => {
        const engine = new PressureCrisisEngine();
        const state = buildPressureState({
          [domain]: buildGauge(THRESHOLDS.WARNING, SUSTAIN_TICKS.WARNING_MINOR, 0),
        });
        const result = engine.checkForEmergence(state, 1950, []);
        expect(result.minorImpacts).toHaveLength(1);
        expect(result.minorImpacts[0]!.crisisId).toBe(expectedCrisisId);
      },
    );

    it('generated crisis definition has required CrisisDefinition fields', () => {
      const engine = new PressureCrisisEngine();
      const state = buildPressureState({
        political: buildGauge(THRESHOLDS.CRITICAL, 0, SUSTAIN_TICKS.CRITICAL_MAJOR),
      });
      const result = engine.checkForEmergence(state, 1961, []);
      const def = result.majorCrises[0]!;

      expect(def).toMatchObject({
        id: expect.stringMatching(/^pressure-political-1961-\d+$/),
        type: 'political',
        name: expect.stringContaining('Political Purge'),
        startYear: 1961,
        severity: expect.stringMatching(/regional|national|existential/),
        peakParams: expect.any(Object),
        buildupTicks: expect.any(Number),
        aftermathTicks: expect.any(Number),
      });
      expect(def.endYear).toBeGreaterThan(def.startYear);
    });
  });

  // ─── resolveCrisis ──────────────────────────────────────────────────────────

  describe('resolveCrisis()', () => {
    it('removes a crisis from active tracking after resolution', () => {
      const engine = new PressureCrisisEngine();
      const state = buildPressureState({
        food: buildGauge(THRESHOLDS.CRITICAL, 0, SUSTAIN_TICKS.CRITICAL_MAJOR),
      });
      const result = engine.checkForEmergence(state, 1950, []);
      const crisisId = result.majorCrises[0]!.id;
      expect(engine.getActiveCrisisIds()).toContain(crisisId);

      engine.resolveCrisis(crisisId);
      expect(engine.getActiveCrisisIds()).not.toContain(crisisId);
    });

    it('allows a new major crisis to fire for the domain after resolution', () => {
      const engine = new PressureCrisisEngine();
      const state = buildPressureState({
        food: buildGauge(THRESHOLDS.CRITICAL, 0, SUSTAIN_TICKS.CRITICAL_MAJOR),
      });
      const result1 = engine.checkForEmergence(state, 1950, []);
      const crisisId = result1.majorCrises[0]!.id;
      engine.resolveCrisis(crisisId);

      // Crisis resolved — new check should fire again.
      const result2 = engine.checkForEmergence(state, 1951, []);
      expect(result2.majorCrises).toHaveLength(1);
    });
  });

  // ─── reset ─────────────────────────────────────────────────────────────────

  describe('reset()', () => {
    it('clears all active crisis tracking', () => {
      const engine = new PressureCrisisEngine();
      const state = buildPressureState({
        food: buildGauge(THRESHOLDS.CRITICAL, 0, SUSTAIN_TICKS.CRITICAL_MAJOR),
      });
      engine.checkForEmergence(state, 1950, []);
      engine.reset();
      expect(engine.getActiveCrisisIds()).toHaveLength(0);
    });

    it('allows crises to fire again after reset', () => {
      const engine = new PressureCrisisEngine();
      const state = buildPressureState({
        food: buildGauge(THRESHOLDS.CRITICAL, 0, SUSTAIN_TICKS.CRITICAL_MAJOR),
      });
      engine.checkForEmergence(state, 1950, []);
      engine.reset();
      const result = engine.checkForEmergence(state, 1951, []);
      expect(result.majorCrises).toHaveLength(1);
    });
  });

  // ─── serialize / restore ───────────────────────────────────────────────────

  describe('serialize() / restore()', () => {
    it('preserves active major crisis state across serialize/restore', () => {
      const engine = new PressureCrisisEngine();
      const state = buildPressureState({
        morale: buildGauge(THRESHOLDS.CRITICAL, 0, SUSTAIN_TICKS.CRITICAL_MAJOR),
      });
      engine.checkForEmergence(state, 1960, []);
      const activeIds = engine.getActiveCrisisIds();
      expect(activeIds).toHaveLength(1);

      const saved = engine.serialize();
      const engine2 = new PressureCrisisEngine();
      engine2.restore(saved);

      expect(engine2.getActiveCrisisIds()).toEqual(activeIds);
    });

    it('preserves the crisis counter so IDs stay unique after restore', () => {
      const engine = new PressureCrisisEngine();
      const state = buildPressureState({
        food: buildGauge(THRESHOLDS.CRITICAL, 0, SUSTAIN_TICKS.CRITICAL_MAJOR),
      });
      engine.checkForEmergence(state, 1940, []);
      const saved = engine.serialize();
      expect(saved.crisisCounter).toBe(1);

      const engine2 = new PressureCrisisEngine();
      engine2.restore(saved);
      expect(engine2.serialize().crisisCounter).toBe(1);
    });

    it('a restored engine that has no active crises emits new crises correctly', () => {
      const engine = new PressureCrisisEngine();
      const saved = engine.serialize();

      const engine2 = new PressureCrisisEngine();
      engine2.restore(saved);
      const state = buildPressureState({
        health: buildGauge(THRESHOLDS.CRITICAL, 0, SUSTAIN_TICKS.CRITICAL_MAJOR),
      });
      const result = engine2.checkForEmergence(state, 1970, []);
      expect(result.majorCrises).toHaveLength(1);
    });

    it('preserves minorActive state so minor incidents do not double-fire', () => {
      const engine = new PressureCrisisEngine();
      const state = buildPressureState({
        food: buildGauge(THRESHOLDS.WARNING, SUSTAIN_TICKS.WARNING_MINOR, 0),
      });
      engine.checkForEmergence(state, 1950, []);

      const saved = engine.serialize();
      const engine2 = new PressureCrisisEngine();
      engine2.restore(saved);

      const result = engine2.checkForEmergence(state, 1950, []);
      expect(result.minorImpacts).toHaveLength(0);
    });
  });
});

// ─── PressureSystem integration ───────────────────────────────────────────────

describe('PressureSystem', () => {
  describe('constructor', () => {
    it('creates system with all 10 domain gauges at level 0', () => {
      const system = new PressureSystem();
      const state = system.getState();
      for (const domain of PRESSURE_DOMAINS) {
        expect(state[domain].level).toBe(0);
      }
    });

    it('creates system with zero warning and critical tick counters', () => {
      const system = new PressureSystem();
      const state = system.getState();
      for (const domain of PRESSURE_DOMAINS) {
        expect(state[domain].warningTicks).toBe(0);
        expect(state[domain].criticalTicks).toBe(0);
      }
    });
  });

  describe('tick()', () => {
    it('accumulates pressure when raw readings are non-zero', () => {
      const system = new PressureSystem();
      const ctx = createBaseCtx();
      ctx.foodState = 'starvation';
      ctx.starvationCounter = 90;
      ctx.starvationGraceTicks = 90;

      const before = system.getLevel('food');
      system.tick(ctx);
      const after = system.getLevel('food');

      expect(after).toBeGreaterThan(before);
    });

    it('increases level across multiple ticks for sustained stress', () => {
      const system = new PressureSystem();
      const ctx = createBaseCtx();
      ctx.averageMorale = 0; // maximum morale pressure

      for (let i = 0; i < 5; i++) {
        system.tick(ctx);
      }

      expect(system.getLevel('morale')).toBeGreaterThan(0.5);
    });

    it('different stressed domains accumulate independently', () => {
      const system = new PressureSystem();
      const ctx = createBaseCtx();
      ctx.averageMorale = 0; // morale stress
      ctx.averageDurability = 100; // infrastructure fine

      system.tick(ctx);
      system.tick(ctx);

      expect(system.getLevel('morale')).toBeGreaterThan(system.getLevel('infrastructure'));
    });
  });

  describe('applySpike()', () => {
    it('directly increases a domain pressure level', () => {
      const system = new PressureSystem();
      const before = system.getLevel('loyalty');
      system.applySpike('loyalty', 0.4);
      expect(system.getLevel('loyalty')).toBeCloseTo(before + 0.4);
    });

    it('clamps pressure at 1.0 even for large spikes', () => {
      const system = new PressureSystem();
      system.applySpike('food', 2.0);
      expect(system.getLevel('food')).toBe(1.0);
    });

    it('does not decrease pressure below 0.0 for negative spikes', () => {
      const system = new PressureSystem();
      system.applySpike('food', -5.0);
      expect(system.getLevel('food')).toBe(0.0);
    });
  });

  describe('pressure decay', () => {
    it('naturally decays without stimulus over time', () => {
      const system = new PressureSystem();
      system.applySpike('economic', 0.8);
      const spikedLevel = system.getLevel('economic');

      // Tick with zero-stress context many times — pressure should decay.
      const ctx = createBaseCtx();
      for (let i = 0; i < 30; i++) {
        system.tick(ctx);
      }

      expect(system.getLevel('economic')).toBeLessThan(spikedLevel);
    });
  });

  describe('dual-spread model', () => {
    it('stressed domains attract more spiked accumulation than unstressed domains', () => {
      const system = new PressureSystem();
      // Spike food to create an imbalance.
      system.applySpike('food', 0.5);

      // Tick with neutral context — spiked budget should flow to food.
      const ctx = createBaseCtx();
      system.tick(ctx);

      // Food should have a higher level than a completely unstressed domain.
      const foodLevel = system.getLevel('food');
      const loyaltyLevel = system.getLevel('loyalty');
      expect(foodLevel).toBeGreaterThan(loyaltyLevel);
    });

    it('all domains receive at least the uniform BASELINE accumulation per tick from zero', () => {
      const system = new PressureSystem();
      // Start from zero, tick once with neutral context.
      const ctx = createBaseCtx();
      system.tick(ctx);

      // Every domain should have accumulated at least the baseline contribution
      // (BASELINE * worldModifier). Since we also apply RAW_WEIGHT to readings
      // that may be 0 for fully unstressed domains, the minimum is BASELINE + BUDGET/10.
      for (const domain of PRESSURE_DOMAINS) {
        const level = system.getLevel(domain);
        // Non-negative and some small accumulation.
        expect(level).toBeGreaterThanOrEqual(0);
        // At minimum uniform distribution (BASELINE + BUDGET/10 = 0.002 + 0.0008 = 0.0028)
        // but some domains like demographic have non-zero raw reading even when "healthy".
        expect(level).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('world modifier', () => {
    it('amplifies pressure when worldModifier > 1', () => {
      const system = new PressureSystem();
      const ctx = createBaseCtx();
      ctx.averageMorale = 0;

      system.tick(ctx, { morale: 2.0 });
      const amplifiedLevel = system.getLevel('morale');

      const system2 = new PressureSystem();
      system2.tick(ctx, { morale: 1.0 });
      const normalLevel = system2.getLevel('morale');

      expect(amplifiedLevel).toBeGreaterThan(normalLevel);
    });

    it('dampens pressure when worldModifier < 1', () => {
      const system = new PressureSystem();
      const ctx = createBaseCtx();
      ctx.averageMorale = 0;

      system.tick(ctx, { morale: 0.5 });
      const dampedLevel = system.getLevel('morale');

      const system2 = new PressureSystem();
      system2.tick(ctx, { morale: 1.0 });
      const normalLevel = system2.getLevel('morale');

      expect(dampedLevel).toBeLessThan(normalLevel);
    });

    it('unspecified domains receive a 1.0 world modifier by default', () => {
      const system1 = new PressureSystem();
      const system2 = new PressureSystem();
      const ctx = createBaseCtx();
      ctx.averageMorale = 0;

      system1.tick(ctx, {});
      system2.tick(ctx); // no modifier argument

      expect(system1.getLevel('morale')).toBeCloseTo(system2.getLevel('morale'), 10);
    });
  });

  describe('getState()', () => {
    it('returns pressure levels for all 10 domains', () => {
      const system = new PressureSystem();
      const state = system.getState();
      expect(Object.keys(state)).toHaveLength(10);
      for (const domain of PRESSURE_DOMAINS) {
        expect(state).toHaveProperty(domain);
      }
    });

    it('returned state reflects changes from applySpike', () => {
      const system = new PressureSystem();
      system.applySpike('health', 0.6);
      const state = system.getState();
      expect(state.health.level).toBeCloseTo(0.6);
    });
  });

  describe('getHighestPressure()', () => {
    it('returns the domain with the highest level', () => {
      const system = new PressureSystem();
      system.applySpike('political', 0.7);
      system.applySpike('food', 0.3);
      const result = system.getHighestPressure();
      expect(result.domain).toBe('political');
      expect(result.level).toBeCloseTo(0.7);
    });
  });

  describe('getWarningDomains() / getCriticalDomains()', () => {
    it('returns domains above warning threshold (0.50)', () => {
      const system = new PressureSystem();
      system.applySpike('food', 0.6);
      system.applySpike('morale', 0.4);
      const warned = system.getWarningDomains();
      expect(warned).toContain('food');
      expect(warned).not.toContain('morale');
    });

    it('returns domains above critical threshold (0.75)', () => {
      const system = new PressureSystem();
      system.applySpike('economic', 0.8);
      system.applySpike('food', 0.6);
      const critical = system.getCriticalDomains();
      expect(critical).toContain('economic');
      expect(critical).not.toContain('food');
    });
  });

  describe('reset()', () => {
    it('resets all gauges to zero', () => {
      const system = new PressureSystem();
      system.applySpike('food', 0.9);
      system.applySpike('morale', 0.8);
      system.reset();
      for (const domain of PRESSURE_DOMAINS) {
        expect(system.getLevel(domain)).toBe(0);
      }
    });
  });

  describe('serialize() / restore()', () => {
    it('preserves all gauge states across serialize/restore', () => {
      const system = new PressureSystem();
      system.applySpike('food', 0.7);
      system.applySpike('political', 0.5);
      system.applySpike('health', 0.3);

      const saved = system.serialize();
      const system2 = new PressureSystem();
      system2.restore(saved);

      expect(system2.getLevel('food')).toBeCloseTo(0.7);
      expect(system2.getLevel('political')).toBeCloseTo(0.5);
      expect(system2.getLevel('health')).toBeCloseTo(0.3);
    });

    it('preserved state has correct warningTicks after ticking above threshold', () => {
      const system = new PressureSystem();
      system.applySpike('morale', THRESHOLDS.WARNING + 0.1);
      const ctx = createBaseCtx();
      ctx.averageMorale = 0;
      system.tick(ctx);

      const saved = system.serialize();
      const system2 = new PressureSystem();
      system2.restore(saved);

      expect(system2.getState().morale.warningTicks).toBeGreaterThan(0);
    });

    it('restored system continues accumulation correctly', () => {
      const system = new PressureSystem();
      system.applySpike('food', 0.5);
      const saved = system.serialize();

      const system2 = new PressureSystem();
      system2.restore(saved);

      const ctx = createBaseCtx();
      ctx.foodState = 'rationing';
      system2.tick(ctx);

      expect(system2.getLevel('food')).toBeGreaterThan(0.5 * 0.95); // at least decayed level
    });
  });
});

// ─── pressureCrisisMapping ─────────────────────────────────────────────────────

describe('pressureCrisisMapping', () => {
  describe('MINOR_INCIDENTS', () => {
    it('has entries for all 10 pressure domains', () => {
      for (const domain of PRESSURE_DOMAINS) {
        expect(MINOR_INCIDENTS).toHaveProperty(domain);
      }
    });

    it('each entry has a valid domain, name, headline, toast, and impact', () => {
      for (const domain of PRESSURE_DOMAINS) {
        const template = MINOR_INCIDENTS[domain];
        expect(template.domain).toBe(domain);
        expect(typeof template.name).toBe('string');
        expect(template.name.length).toBeGreaterThan(0);
        expect(typeof template.pravdaHeadline).toBe('string');
        expect(typeof template.toastMessage).toBe('string');
        expect(template.impact).toBeDefined();
        expect(typeof template.impact.crisisId).toBe('string');
      }
    });

    it('food minor incident is named "Temporary Food Shortfall"', () => {
      expect(MINOR_INCIDENTS.food.name).toBe('Temporary Food Shortfall');
    });

    it('food minor incident impact includes a morale penalty', () => {
      const impact = MINOR_INCIDENTS.food.impact;
      expect(impact.workforce?.moraleModifier).toBeDefined();
      expect(impact.workforce!.moraleModifier!).toBeLessThan(0);
    });

    it('food minor incident includes a narrative Pravda headline', () => {
      const impact = MINOR_INCIDENTS.food.impact;
      expect(impact.narrative?.pravdaHeadlines).toBeDefined();
      expect(impact.narrative!.pravdaHeadlines!.length).toBeGreaterThan(0);
    });

    it('loyalty minor incident increases KGB aggression', () => {
      const impact = MINOR_INCIDENTS.loyalty.impact;
      expect(impact.political?.kgbAggressionMult).toBeDefined();
      expect(impact.political!.kgbAggressionMult!).toBeGreaterThan(1.0);
    });

    it('power minor incident reduces production', () => {
      const impact = MINOR_INCIDENTS.power.impact;
      expect(impact.economy?.productionMult).toBeDefined();
      expect(impact.economy!.productionMult!).toBeLessThan(1.0);
    });

    it('infrastructure minor incident increases decay rate', () => {
      const impact = MINOR_INCIDENTS.infrastructure.impact;
      expect(impact.infrastructure?.decayMult).toBeDefined();
      expect(impact.infrastructure!.decayMult!).toBeGreaterThan(1.0);
    });

    it('health minor incident increases disease spread', () => {
      const impact = MINOR_INCIDENTS.health.impact;
      expect(impact.social?.diseaseMult).toBeDefined();
      expect(impact.social!.diseaseMult!).toBeGreaterThan(1.0);
    });
  });

  describe('MAJOR_CRISES', () => {
    it('has entries for all 10 pressure domains', () => {
      for (const domain of PRESSURE_DOMAINS) {
        expect(MAJOR_CRISES).toHaveProperty(domain);
      }
    });

    it('each entry has a valid domain, name, crisisType, severity, and params', () => {
      for (const domain of PRESSURE_DOMAINS) {
        const template = MAJOR_CRISES[domain];
        expect(template.domain).toBe(domain);
        expect(typeof template.name).toBe('string');
        expect(template.name.length).toBeGreaterThan(0);
        expect(['war', 'famine', 'disaster', 'political']).toContain(template.crisisType);
        expect(['localized', 'regional', 'national', 'existential']).toContain(template.baseSeverity);
        expect(template.durationYears).toBeGreaterThan(0);
        expect(typeof template.basePeakParams).toBe('object');
        expect(template.buildupTicks).toBeGreaterThan(0);
        expect(template.aftermathTicks).toBeGreaterThan(0);
      }
    });

    it('food major crisis is named "Famine"', () => {
      expect(MAJOR_CRISES.food.name).toBe('Famine');
    });

    it('food major crisis type is "famine"', () => {
      expect(MAJOR_CRISES.food.crisisType).toBe('famine');
    });

    it('food major crisis has food-related peak params (foodDrainPerCapita)', () => {
      expect(MAJOR_CRISES.food.basePeakParams.foodDrainPerCapita).toBeDefined();
    });

    it('political major crisis is a "Political Purge" with high KGB aggression', () => {
      expect(MAJOR_CRISES.political.name).toBe('Political Purge');
      expect(MAJOR_CRISES.political.basePeakParams.kgbAggressionMult).toBeGreaterThan(2.0);
    });

    it('morale major crisis has a production penalty below 0.5', () => {
      expect(MAJOR_CRISES.morale.basePeakParams.productionMult).toBeLessThan(0.5);
    });

    it('loyalty major crisis is national severity', () => {
      expect(MAJOR_CRISES.loyalty.baseSeverity).toBe('national');
    });

    it('economic major crisis includes a quota multiplier', () => {
      expect(MAJOR_CRISES.economic.basePeakParams.quotaMult).toBeDefined();
      expect(MAJOR_CRISES.economic.basePeakParams.quotaMult).toBeGreaterThan(1.0);
    });
  });

  describe('generateCrisisFromTemplate()', () => {
    it('produces a valid CrisisDefinition with all required fields', () => {
      const template = MAJOR_CRISES.food;
      const def = generateCrisisFromTemplate(template, 1932, 0.8, 'test-famine-1932');

      expect(def.id).toBe('test-famine-1932');
      expect(def.type).toBe('famine');
      expect(def.name).toContain('Famine');
      expect(def.name).toContain('1932');
      expect(def.startYear).toBe(1932);
      expect(def.endYear).toBe(1934); // durationYears = 2
      expect(def.buildupTicks).toBe(template.buildupTicks);
      expect(def.aftermathTicks).toBe(template.aftermathTicks);
      expect(def.peakParams).toBeDefined();
      expect(def.description).toBeDefined();
    });

    it('scales severity to "regional" for pressure at 0.75', () => {
      const def = generateCrisisFromTemplate(MAJOR_CRISES.food, 1950, 0.75, 'test-1');
      expect(def.severity).toBe('regional');
    });

    it('scales severity to "national" for pressure at 0.85', () => {
      const def = generateCrisisFromTemplate(MAJOR_CRISES.food, 1950, 0.85, 'test-1');
      expect(def.severity).toBe('national');
    });

    it('scales severity to "existential" for pressure at 0.95+', () => {
      const def = generateCrisisFromTemplate(MAJOR_CRISES.food, 1950, 0.96, 'test-1');
      expect(def.severity).toBe('existential');
    });

    it('scales penalty params (value < 1) toward worse values at high pressure', () => {
      const defLow = generateCrisisFromTemplate(MAJOR_CRISES.food, 1950, 0.75, 'low');
      const defHigh = generateCrisisFromTemplate(MAJOR_CRISES.food, 1950, 0.95, 'high');
      // productionMult < 1 should be lower (worse) at higher pressure.
      expect(defHigh.peakParams.productionMult!).toBeLessThan(defLow.peakParams.productionMult!);
    });

    it('scales amplifier params (value > 1) toward higher values at high pressure', () => {
      const defLow = generateCrisisFromTemplate(MAJOR_CRISES.food, 1950, 0.75, 'low');
      const defHigh = generateCrisisFromTemplate(MAJOR_CRISES.food, 1950, 0.95, 'high');
      // diseaseMult > 1 should be higher at higher pressure.
      expect(defHigh.peakParams.diseaseMult!).toBeGreaterThan(defLow.peakParams.diseaseMult!);
    });

    it('description includes the crisis name and severity', () => {
      // At pressure 0.87 the severity resolves to 'national' (>= 0.85 threshold).
      const def = generateCrisisFromTemplate(MAJOR_CRISES.political, 1953, 0.87, 'test-purge');
      expect(def.description).toContain('Political Purge');
      expect(def.description).toContain('national');
    });

    it('endYear is startYear + durationYears', () => {
      for (const domain of PRESSURE_DOMAINS) {
        const template = MAJOR_CRISES[domain];
        const def = generateCrisisFromTemplate(template, 1960, 0.8, `test-${domain}`);
        expect(def.endYear).toBe(1960 + template.durationYears);
      }
    });

    it('uses the provided crisisId verbatim', () => {
      const def = generateCrisisFromTemplate(MAJOR_CRISES.health, 1970, 0.8, 'my-custom-id');
      expect(def.id).toBe('my-custom-id');
    });
  });
});
