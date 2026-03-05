/**
 * @fileoverview Tests for EcologicalCollapseSystem.
 *
 * Validates that ecological collapse events activate at correct years,
 * pressure modifiers scale appropriately, multiple events stack,
 * and gameplay flags (domes, oxygen, water tracking) trigger at the
 * correct thresholds.
 *
 * Also validates the 8 ecological cold branches fire when sustained
 * conditions are met via the evaluateBranches engine.
 */

import {
  evaluateEcologicalCollapse,
  type EcologicalCollapseContext,
  type EcologicalCollapseResult,
} from '../../src/ai/agents/crisis/EcologicalCollapseSystem';
import type { PressureDomain } from '../../src/ai/agents/crisis/pressure/PressureDomains';
import type { WorldState } from '../../src/ai/agents/core/WorldAgent';
import type { GovernanceType, SphereId } from '../../src/ai/agents/core/worldCountries';
import {
  COLD_BRANCHES,
  evaluateBranches,
  type ColdBranch,
  type BranchTracker,
} from '../../src/ai/agents/core/worldBranches';

// ─── Test Helpers ────────────────────────────────────────────────────────────

/** Create a default context with all neutral values at a given year. */
function makeContext(overrides: Partial<EcologicalCollapseContext> = {}): EcologicalCollapseContext {
  return {
    year: 1917,
    climateTrend: 0,
    population: 100,
    terrainStats: {
      avgPermafrost: 1.0,   // fully frozen (no thaw)
      avgPollution: 0,
      avgSoilFertility: 80,
    },
    ...overrides,
  };
}

/** Build a minimal WorldState with all-neutral values. */
function makeWorldState(overrides: Partial<WorldState> = {}): WorldState {
  return {
    spheres: {} as WorldState['spheres'],
    countries: [],
    globalTension: 0,
    borderThreat: 0,
    tradeAccess: 1.0,
    commodityIndex: 1.0,
    centralPlanningEfficiency: 1.0,
    climateTrend: 0,
    climateCycleRemaining: 120,
    moscowAttention: 0,
    ideologyRigidity: 0.5,
    techLevel: 0,
    ...overrides,
  };
}

/** Build a minimal pressure state with all gauges at a given level. */
function makePressureState(overrides: Partial<Record<PressureDomain, number>> = {}): Record<PressureDomain, { level: number }> {
  const domains: PressureDomain[] = ['food', 'morale', 'loyalty', 'housing', 'political', 'power', 'infrastructure', 'demographic', 'health', 'economic'];
  const state = {} as Record<PressureDomain, { level: number }>;
  for (const d of domains) {
    state[d] = { level: overrides[d] ?? 0 };
  }
  return state;
}

/** Build minimal spheres for branch evaluation. */
function makeSpheres(): Record<SphereId, { governance: GovernanceType; aggregateHostility: number }> {
  return {} as Record<SphereId, { governance: GovernanceType; aggregateHostility: number }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EcologicalCollapseSystem — Event Activation
// ═══════════════════════════════════════════════════════════════════════════════

describe('EcologicalCollapseSystem', () => {

  // ── No events before any start year ──────────────────────────────────────
  describe('before any collapse events', () => {
    it('returns no active events for year 1917', () => {
      const result = evaluateEcologicalCollapse(makeContext({ year: 1917 }));
      expect(result.activeEvents).toHaveLength(0);
      expect(result.domesRequired).toBe(false);
      expect(result.oxygenTrackingRequired).toBe(false);
      expect(result.waterTrackingRequired).toBe(false);
      expect(result.foodProductionMult).toBe(1.0);
      expect(result.infrastructureDamageRate).toBe(0);
    });

    it('returns no active events for year 2049', () => {
      const result = evaluateEcologicalCollapse(makeContext({ year: 2049 }));
      expect(result.activeEvents).toHaveLength(0);
    });
  });

  // ── Permafrost Thaw (2050+) ────────────────────────────────────────────────
  describe('permafrostThaw', () => {
    it('activates at year 2050', () => {
      const result = evaluateEcologicalCollapse(makeContext({ year: 2050 }));
      expect(result.activeEvents).toContain('permafrostThaw');
    });

    it('infrastructure damage rate scales with thaw factor', () => {
      // Fully frozen (avgPermafrost=1.0) → thaw factor = 0 → no damage
      const frozen = evaluateEcologicalCollapse(makeContext({
        year: 2050,
        terrainStats: { avgPermafrost: 1.0, avgPollution: 0, avgSoilFertility: 80 },
      }));
      expect(frozen.infrastructureDamageRate).toBe(0);

      // Fully thawed (avgPermafrost=0) → thaw factor = 1 → max damage
      const thawed = evaluateEcologicalCollapse(makeContext({
        year: 2050,
        terrainStats: { avgPermafrost: 0, avgPollution: 0, avgSoilFertility: 80 },
      }));
      expect(thawed.infrastructureDamageRate).toBeCloseTo(0.02);

      // Half thawed → half damage
      const half = evaluateEcologicalCollapse(makeContext({
        year: 2050,
        terrainStats: { avgPermafrost: 0.5, avgPollution: 0, avgSoilFertility: 80 },
      }));
      expect(half.infrastructureDamageRate).toBeCloseTo(0.01);
    });

    it('adds infrastructure pressure proportional to thaw', () => {
      const result = evaluateEcologicalCollapse(makeContext({
        year: 2050,
        terrainStats: { avgPermafrost: 0, avgPollution: 0, avgSoilFertility: 80 },
      }));
      expect(result.pressureModifiers.infrastructure).toBeGreaterThan(0);
    });

    it('adds health pressure from disease outbreak chance', () => {
      const result = evaluateEcologicalCollapse(makeContext({ year: 2050 }));
      expect(result.pressureModifiers.health).toBeGreaterThan(0);
    });
  });

  // ── Ozone Depletion (2100+) ────────────────────────────────────────────────
  describe('ozoneDepletion', () => {
    it('activates at year 2100', () => {
      const result = evaluateEcologicalCollapse(makeContext({ year: 2100 }));
      expect(result.activeEvents).toContain('ozoneDepletion');
    });

    it('does not activate before year 2100', () => {
      const result = evaluateEcologicalCollapse(makeContext({ year: 2099 }));
      expect(result.activeEvents).not.toContain('ozoneDepletion');
    });

    it('sets domesRequired to true', () => {
      const result = evaluateEcologicalCollapse(makeContext({ year: 2100 }));
      expect(result.domesRequired).toBe(true);
    });

    it('reduces food production multiplier', () => {
      const result = evaluateEcologicalCollapse(makeContext({ year: 2100 }));
      // 1.0 * (1 - 0.3) = 0.7
      expect(result.foodProductionMult).toBeCloseTo(0.7);
    });

    it('adds health pressure', () => {
      const result = evaluateEcologicalCollapse(makeContext({ year: 2100 }));
      expect(result.pressureModifiers.health).toBeGreaterThan(0);
    });
  });

  // ── Atmospheric Toxicity (2200+) ──────────────────────────────────────────
  describe('atmosphericToxicity', () => {
    it('activates at year 2200', () => {
      const result = evaluateEcologicalCollapse(makeContext({ year: 2200 }));
      expect(result.activeEvents).toContain('atmosphericToxicity');
    });

    it('enables oxygen tracking', () => {
      const result = evaluateEcologicalCollapse(makeContext({ year: 2200 }));
      expect(result.oxygenTrackingRequired).toBe(true);
    });

    it('health pressure scales with pollution', () => {
      const lowPollution = evaluateEcologicalCollapse(makeContext({
        year: 2200,
        terrainStats: { avgPermafrost: 1, avgPollution: 0.1, avgSoilFertility: 80 },
      }));
      const highPollution = evaluateEcologicalCollapse(makeContext({
        year: 2200,
        terrainStats: { avgPermafrost: 1, avgPollution: 0.9, avgSoilFertility: 80 },
      }));
      // High pollution should produce more health pressure
      expect(highPollution.pressureModifiers.health!).toBeGreaterThan(lowPollution.pressureModifiers.health!);
    });
  });

  // ── Soil Exhaustion (2500+) ───────────────────────────────────────────────
  describe('soilExhaustion', () => {
    it('activates at year 2500', () => {
      const result = evaluateEcologicalCollapse(makeContext({ year: 2500 }));
      expect(result.activeEvents).toContain('soilExhaustion');
    });

    it('halves food production when combined with ozone', () => {
      // ozone drops to 0.7, then soil exhaustion drops by 0.5 → 0.7 * 0.5 = 0.35
      const result = evaluateEcologicalCollapse(makeContext({ year: 2500 }));
      expect(result.foodProductionMult).toBeCloseTo(0.35);
    });

    it('food pressure inversely proportional to soil fertility', () => {
      const fertile = evaluateEcologicalCollapse(makeContext({
        year: 2500,
        terrainStats: { avgPermafrost: 1, avgPollution: 0, avgSoilFertility: 100 },
      }));
      const barren = evaluateEcologicalCollapse(makeContext({
        year: 2500,
        terrainStats: { avgPermafrost: 1, avgPollution: 0, avgSoilFertility: 10 },
      }));
      expect(barren.pressureModifiers.food!).toBeGreaterThan(fertile.pressureModifiers.food!);
    });
  });

  // ── Water Table Collapse (3000+) ──────────────────────────────────────────
  describe('waterTableCollapse', () => {
    it('activates at year 3000', () => {
      const result = evaluateEcologicalCollapse(makeContext({ year: 3000 }));
      expect(result.activeEvents).toContain('waterTableCollapse');
    });

    it('enables water tracking on Earth', () => {
      const result = evaluateEcologicalCollapse(makeContext({ year: 3000 }));
      expect(result.waterTrackingRequired).toBe(true);
    });

    it('does not enable water tracking before year 3000', () => {
      const result = evaluateEcologicalCollapse(makeContext({ year: 2999 }));
      expect(result.waterTrackingRequired).toBe(false);
    });
  });

  // ── Solar Luminosity (5000+) ──────────────────────────────────────────────
  describe('solarLuminosityIncrease', () => {
    it('activates at year 5000', () => {
      const result = evaluateEcologicalCollapse(makeContext({ year: 5000 }));
      expect(result.activeEvents).toContain('solarLuminosityIncrease');
    });

    it('pressure increases with centuries elapsed', () => {
      const early = evaluateEcologicalCollapse(makeContext({ year: 5100 }));
      const late = evaluateEcologicalCollapse(makeContext({ year: 6000 }));
      // Both should have food and infrastructure pressure, but late should be higher
      expect(late.pressureModifiers.food!).toBeGreaterThanOrEqual(early.pressureModifiers.food!);
      expect(late.pressureModifiers.infrastructure!).toBeGreaterThanOrEqual(early.pressureModifiers.infrastructure!);
    });
  });

  // ── Mini Ice Age (10000+) ─────────────────────────────────────────────────
  describe('miniIceAgeCycle', () => {
    it('activates at year 10000', () => {
      const result = evaluateEcologicalCollapse(makeContext({ year: 10000 }));
      expect(result.activeEvents).toContain('miniIceAgeCycle');
    });

    it('pressure is cyclical — peak differs from trough', () => {
      // cycle length 5000: at start (year 10000) → cyclePosition=0, sin(0)=0
      const trough = evaluateEcologicalCollapse(makeContext({ year: 10000 }));
      // At quarter cycle (year 12500) → cyclePosition=0.5, sin(pi/2)=1 (peak cold)
      const peak = evaluateEcologicalCollapse(makeContext({ year: 12500 }));
      // Peak should have higher food pressure from ice age
      expect(peak.pressureModifiers.food!).toBeGreaterThan(trough.pressureModifiers.food!);
    });
  });

  // ── Continental Drift (50000+) ────────────────────────────────────────────
  describe('continentalDrift', () => {
    it('activates at year 50000', () => {
      const result = evaluateEcologicalCollapse(makeContext({ year: 50000 }));
      expect(result.activeEvents).toContain('continentalDrift');
    });

    it('adds infrastructure pressure from earthquakes', () => {
      const result = evaluateEcologicalCollapse(makeContext({ year: 50000 }));
      expect(result.pressureModifiers.infrastructure).toBeGreaterThan(0);
    });
  });

  // ── Magnetic Field Weakening (100000+) ────────────────────────────────────
  describe('magneticFieldWeakening', () => {
    it('activates at year 100000', () => {
      const result = evaluateEcologicalCollapse(makeContext({ year: 100000 }));
      expect(result.activeEvents).toContain('magneticFieldWeakening');
    });

    it('does not activate before year 100000', () => {
      const result = evaluateEcologicalCollapse(makeContext({ year: 99999 }));
      expect(result.activeEvents).not.toContain('magneticFieldWeakening');
    });

    it('adds health and demographic pressure from radiation', () => {
      const result = evaluateEcologicalCollapse(makeContext({ year: 100000 }));
      expect(result.pressureModifiers.health).toBeGreaterThan(0);
      expect(result.pressureModifiers.demographic).toBeGreaterThan(0);
    });

    it('forces domesRequired even without ozone depletion check', () => {
      // At year 100000, both ozone and magnetic field set domesRequired
      const result = evaluateEcologicalCollapse(makeContext({ year: 100000 }));
      expect(result.domesRequired).toBe(true);
    });
  });

  // ── Multiple events stacking ──────────────────────────────────────────────
  describe('event stacking', () => {
    it('accumulates all events by year 100000', () => {
      const result = evaluateEcologicalCollapse(makeContext({ year: 100000 }));
      expect(result.activeEvents).toHaveLength(9); // all 9 events
      expect(result.activeEvents).toEqual(expect.arrayContaining([
        'permafrostThaw',
        'ozoneDepletion',
        'atmosphericToxicity',
        'soilExhaustion',
        'waterTableCollapse',
        'solarLuminosityIncrease',
        'miniIceAgeCycle',
        'continentalDrift',
        'magneticFieldWeakening',
      ]));
    });

    it('stacks pressure modifiers additively across events', () => {
      // At year 100000, multiple events add health pressure
      const result = evaluateEcologicalCollapse(makeContext({
        year: 100000,
        terrainStats: { avgPermafrost: 0.5, avgPollution: 0.5, avgSoilFertility: 50 },
      }));
      // Health should be contributed by: permafrost, ozone, atmospheric, water, magnetic
      expect(result.pressureModifiers.health!).toBeGreaterThan(0.3);
    });

    it('food production multiplier stacks multiplicatively', () => {
      // ozone: 1.0 * 0.7 = 0.7, soil: 0.7 * 0.5 = 0.35
      const result = evaluateEcologicalCollapse(makeContext({ year: 2500 }));
      expect(result.foodProductionMult).toBeCloseTo(0.35);
    });

    it('all tracking flags enabled at year 100000', () => {
      const result = evaluateEcologicalCollapse(makeContext({ year: 100000 }));
      expect(result.domesRequired).toBe(true);
      expect(result.oxygenTrackingRequired).toBe(true);
      expect(result.waterTrackingRequired).toBe(true);
    });

    it('progressive activation: more events at higher years', () => {
      const y2050 = evaluateEcologicalCollapse(makeContext({ year: 2050 }));
      const y2200 = evaluateEcologicalCollapse(makeContext({ year: 2200 }));
      const y5000 = evaluateEcologicalCollapse(makeContext({ year: 5000 }));
      const y100000 = evaluateEcologicalCollapse(makeContext({ year: 100000 }));

      expect(y2050.activeEvents.length).toBe(1);   // permafrost
      expect(y2200.activeEvents.length).toBe(3);   // + ozone, atmospheric
      expect(y5000.activeEvents.length).toBe(6);   // + soil, water, solar
      expect(y100000.activeEvents.length).toBe(9); // + iceAge, drift, magnetic
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Cold Branches — Ecological Branches
// ═══════════════════════════════════════════════════════════════════════════════

describe('Ecological Cold Branches', () => {
  const ecologicalBranchIds = [
    'ecological_permafrost_collapse',
    'ecological_ozone_crisis',
    'ecological_atmospheric_toxicity',
    'ecological_soil_exhaustion_crisis',
    'ecological_water_collapse',
    'ecological_solar_luminosity_crisis',
    'ecological_ice_age_return',
    'ecological_magnetic_field_weakening',
  ];

  it('all 8 ecological branches exist in COLD_BRANCHES', () => {
    const ids = COLD_BRANCHES.map((b) => b.id);
    for (const id of ecologicalBranchIds) {
      expect(ids).toContain(id);
    }
  });

  it('all ecological branches are oneShot', () => {
    for (const id of ecologicalBranchIds) {
      const branch = COLD_BRANCHES.find((b) => b.id === id);
      expect(branch?.oneShot).toBe(true);
    }
  });

  it('all ecological branches have narrative text', () => {
    for (const id of ecologicalBranchIds) {
      const branch = COLD_BRANCHES.find((b) => b.id === id);
      expect(branch?.effects.narrative.pravdaHeadline).toBeTruthy();
      expect(branch?.effects.narrative.toast).toBeTruthy();
    }
  });

  it('all ecological branches have pressure spikes', () => {
    for (const id of ecologicalBranchIds) {
      const branch = COLD_BRANCHES.find((b) => b.id === id);
      expect(Object.keys(branch?.effects.pressureSpikes ?? {})).not.toHaveLength(0);
    }
  });

  // ── Permafrost Collapse Branch ──────────────────────────────────────────────
  describe('ecological_permafrost_collapse', () => {
    it('fires when climateTrend >= 0.5 sustained for 50 ticks after year 2050', () => {
      const branch = COLD_BRANCHES.find((b) => b.id === 'ecological_permafrost_collapse')!;
      const activated = new Set<string>();
      const trackers = new Map<string, BranchTracker>();
      const pressure = makePressureState();
      const world = makeWorldState({ climateTrend: 0.6 });
      const spheres = makeSpheres();

      // Simulate sustained conditions
      for (let tick = 0; tick < 50; tick++) {
        const fired = evaluateBranches([branch], activated, trackers, pressure, world, 2060, spheres);
        if (tick < 49) {
          expect(fired).toHaveLength(0);
        } else {
          expect(fired).toHaveLength(1);
          expect(fired[0]!.id).toBe('ecological_permafrost_collapse');
        }
      }
    });

    it('does not fire before year 2050', () => {
      const branch = COLD_BRANCHES.find((b) => b.id === 'ecological_permafrost_collapse')!;
      const activated = new Set<string>();
      const trackers = new Map<string, BranchTracker>();
      const pressure = makePressureState();
      const world = makeWorldState({ climateTrend: 0.8 });
      const spheres = makeSpheres();

      for (let tick = 0; tick < 60; tick++) {
        const fired = evaluateBranches([branch], activated, trackers, pressure, world, 2040, spheres);
        expect(fired).toHaveLength(0);
      }
    });
  });

  // ── Ozone Crisis Branch ──────────────────────────────────────────────────────
  describe('ecological_ozone_crisis', () => {
    it('fires when health pressure >= 0.4 sustained for 30 ticks after year 2100', () => {
      const branch = COLD_BRANCHES.find((b) => b.id === 'ecological_ozone_crisis')!;
      const activated = new Set<string>();
      const trackers = new Map<string, BranchTracker>();
      const pressure = makePressureState({ health: 0.5 });
      const world = makeWorldState();
      const spheres = makeSpheres();

      let firedResult: ColdBranch[] = [];
      for (let tick = 0; tick < 30; tick++) {
        firedResult = evaluateBranches([branch], activated, trackers, pressure, world, 2150, spheres);
      }
      expect(firedResult).toHaveLength(1);
      expect(firedResult[0]!.id).toBe('ecological_ozone_crisis');
    });
  });

  // ── Atmospheric Toxicity Branch ────────────────────────────────────────────
  describe('ecological_atmospheric_toxicity', () => {
    it('fires when health pressure >= 0.5 sustained after year 2200', () => {
      const branch = COLD_BRANCHES.find((b) => b.id === 'ecological_atmospheric_toxicity')!;
      const activated = new Set<string>();
      const trackers = new Map<string, BranchTracker>();
      const pressure = makePressureState({ health: 0.6 });
      const world = makeWorldState();
      const spheres = makeSpheres();

      let firedResult: ColdBranch[] = [];
      for (let tick = 0; tick < 40; tick++) {
        firedResult = evaluateBranches([branch], activated, trackers, pressure, world, 2250, spheres);
      }
      expect(firedResult).toHaveLength(1);
      expect(firedResult[0]!.id).toBe('ecological_atmospheric_toxicity');
    });
  });

  // ── Soil Exhaustion Crisis Branch ─────────────────────────────────────────
  describe('ecological_soil_exhaustion_crisis', () => {
    it('fires when food pressure >= 0.5 sustained after year 2500', () => {
      const branch = COLD_BRANCHES.find((b) => b.id === 'ecological_soil_exhaustion_crisis')!;
      const activated = new Set<string>();
      const trackers = new Map<string, BranchTracker>();
      const pressure = makePressureState({ food: 0.6 });
      const world = makeWorldState();
      const spheres = makeSpheres();

      let firedResult: ColdBranch[] = [];
      for (let tick = 0; tick < 60; tick++) {
        firedResult = evaluateBranches([branch], activated, trackers, pressure, world, 2600, spheres);
      }
      expect(firedResult).toHaveLength(1);
      expect(firedResult[0]!.id).toBe('ecological_soil_exhaustion_crisis');
    });
  });

  // ── Water Collapse Branch ─────────────────────────────────────────────────
  describe('ecological_water_collapse', () => {
    it('fires when food >= 0.4 and health >= 0.3 sustained after year 3000', () => {
      const branch = COLD_BRANCHES.find((b) => b.id === 'ecological_water_collapse')!;
      const activated = new Set<string>();
      const trackers = new Map<string, BranchTracker>();
      const pressure = makePressureState({ food: 0.5, health: 0.4 });
      const world = makeWorldState();
      const spheres = makeSpheres();

      let firedResult: ColdBranch[] = [];
      for (let tick = 0; tick < 80; tick++) {
        firedResult = evaluateBranches([branch], activated, trackers, pressure, world, 3100, spheres);
      }
      expect(firedResult).toHaveLength(1);
      expect(firedResult[0]!.id).toBe('ecological_water_collapse');
    });
  });

  // ── Solar Luminosity Crisis Branch ────────────────────────────────────────
  describe('ecological_solar_luminosity_crisis', () => {
    it('fires when climateTrend >= 0.6 sustained 100 ticks after year 5000', () => {
      const branch = COLD_BRANCHES.find((b) => b.id === 'ecological_solar_luminosity_crisis')!;
      const activated = new Set<string>();
      const trackers = new Map<string, BranchTracker>();
      const pressure = makePressureState();
      const world = makeWorldState({ climateTrend: 0.7 });
      const spheres = makeSpheres();

      let firedResult: ColdBranch[] = [];
      for (let tick = 0; tick < 100; tick++) {
        firedResult = evaluateBranches([branch], activated, trackers, pressure, world, 5500, spheres);
      }
      expect(firedResult).toHaveLength(1);
      expect(firedResult[0]!.id).toBe('ecological_solar_luminosity_crisis');
    });

    it('includes relocation to new settlement', () => {
      const branch = COLD_BRANCHES.find((b) => b.id === 'ecological_solar_luminosity_crisis')!;
      expect(branch.effects.relocation).toBeDefined();
      expect(branch.effects.relocation!.type).toBe('climate_exodus');
      expect(branch.effects.newSettlement).toBe(true);
    });
  });

  // ── Ice Age Return Branch ─────────────────────────────────────────────────
  describe('ecological_ice_age_return', () => {
    it('fires when climateTrend <= -0.8 sustained 200 ticks after year 10000', () => {
      const branch = COLD_BRANCHES.find((b) => b.id === 'ecological_ice_age_return')!;
      const activated = new Set<string>();
      const trackers = new Map<string, BranchTracker>();
      const pressure = makePressureState();
      const world = makeWorldState({ climateTrend: -0.9 });
      const spheres = makeSpheres();

      let firedResult: ColdBranch[] = [];
      for (let tick = 0; tick < 200; tick++) {
        firedResult = evaluateBranches([branch], activated, trackers, pressure, world, 15000, spheres);
      }
      expect(firedResult).toHaveLength(1);
      expect(firedResult[0]!.id).toBe('ecological_ice_age_return');
    });

    it('does not fire when climate trend is above -0.8', () => {
      const branch = COLD_BRANCHES.find((b) => b.id === 'ecological_ice_age_return')!;
      const activated = new Set<string>();
      const trackers = new Map<string, BranchTracker>();
      const pressure = makePressureState();
      const world = makeWorldState({ climateTrend: -0.5 });
      const spheres = makeSpheres();

      for (let tick = 0; tick < 250; tick++) {
        const fired = evaluateBranches([branch], activated, trackers, pressure, world, 15000, spheres);
        expect(fired).toHaveLength(0);
      }
    });
  });

  // ── Magnetic Field Weakening Branch ───────────────────────────────────────
  describe('ecological_magnetic_field_weakening', () => {
    it('fires after sustained 120 ticks at year >= 100000', () => {
      const branch = COLD_BRANCHES.find((b) => b.id === 'ecological_magnetic_field_weakening')!;
      const activated = new Set<string>();
      const trackers = new Map<string, BranchTracker>();
      const pressure = makePressureState();
      const world = makeWorldState();
      const spheres = makeSpheres();

      let firedResult: ColdBranch[] = [];
      for (let tick = 0; tick < 120; tick++) {
        firedResult = evaluateBranches([branch], activated, trackers, pressure, world, 100000, spheres);
      }
      expect(firedResult).toHaveLength(1);
      expect(firedResult[0]!.id).toBe('ecological_magnetic_field_weakening');
    });

    it('does not fire before year 100000', () => {
      const branch = COLD_BRANCHES.find((b) => b.id === 'ecological_magnetic_field_weakening')!;
      const activated = new Set<string>();
      const trackers = new Map<string, BranchTracker>();
      const pressure = makePressureState();
      const world = makeWorldState();
      const spheres = makeSpheres();

      for (let tick = 0; tick < 150; tick++) {
        const fired = evaluateBranches([branch], activated, trackers, pressure, world, 99999, spheres);
        expect(fired).toHaveLength(0);
      }
    });
  });

  // ── One-shot behavior ─────────────────────────────────────────────────────
  describe('one-shot behavior', () => {
    it('ecological branches do not re-fire once activated', () => {
      const branch = COLD_BRANCHES.find((b) => b.id === 'ecological_magnetic_field_weakening')!;
      const activated = new Set<string>();
      const trackers = new Map<string, BranchTracker>();
      const pressure = makePressureState();
      const world = makeWorldState();
      const spheres = makeSpheres();

      // Fire it once
      for (let tick = 0; tick < 120; tick++) {
        evaluateBranches([branch], activated, trackers, pressure, world, 100000, spheres);
      }
      expect(activated.has('ecological_magnetic_field_weakening')).toBe(true);

      // Try again — should not re-fire
      for (let tick = 0; tick < 120; tick++) {
        const fired = evaluateBranches([branch], activated, trackers, pressure, world, 100000, spheres);
        expect(fired).toHaveLength(0);
      }
    });
  });
});
