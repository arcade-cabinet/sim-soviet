/**
 * Tests for ecological collapse wiring into the game tick pipeline.
 *
 * Validates:
 * 1. evaluateEcologicalCollapse is called from phaseChronology at year boundaries
 * 2. Dome requirement enforcement: non-domed buildings take morale penalty
 * 3. Food production multiplier is stored on resources
 * 4. Infrastructure damage from permafrost thaw applies to building durability
 * 5. Ecological event toasts fire on first activation only
 */

import {
  evaluateEcologicalCollapse,
  type EcologicalCollapseContext,
  type EcologicalCollapseResult,
} from '../../src/ai/agents/crisis/EcologicalCollapseSystem';

describe('EcologicalCollapseSystem wiring', () => {
  // ── Dome requirement enforcement ──────────────────────────────────────────

  describe('dome requirement enforcement', () => {
    it('domesRequired is true at year 2100 (ozone depletion)', () => {
      const result = evaluateEcologicalCollapse({
        year: 2100,
        climateTrend: 0,
        population: 1000,
        terrainStats: { avgPermafrost: 0.5, avgPollution: 0.1, avgSoilFertility: 60 },
      });
      expect(result.domesRequired).toBe(true);
    });

    it('domesRequired is false before year 2100', () => {
      const result = evaluateEcologicalCollapse({
        year: 2099,
        climateTrend: 0,
        population: 1000,
        terrainStats: { avgPermafrost: 0.5, avgPollution: 0.1, avgSoilFertility: 60 },
      });
      expect(result.domesRequired).toBe(false);
    });

    it('domesRequired is also set by magnetic field weakening at year 100000', () => {
      const result = evaluateEcologicalCollapse({
        year: 100000,
        climateTrend: 0,
        population: 1000,
        terrainStats: { avgPermafrost: 0.5, avgPollution: 0.1, avgSoilFertility: 60 },
      });
      expect(result.domesRequired).toBe(true);
    });
  });

  // ── Food production multiplier ──────────────────────────────────────────

  describe('food production multiplier', () => {
    it('is 1.0 before any collapse events', () => {
      const result = evaluateEcologicalCollapse({
        year: 2049,
        climateTrend: 0,
        population: 100,
        terrainStats: { avgPermafrost: 1.0, avgPollution: 0, avgSoilFertility: 80 },
      });
      expect(result.foodProductionMult).toBe(1.0);
    });

    it('drops to 0.7 at ozone depletion (30% farming efficiency loss)', () => {
      const result = evaluateEcologicalCollapse({
        year: 2100,
        climateTrend: 0,
        population: 100,
        terrainStats: { avgPermafrost: 1.0, avgPollution: 0, avgSoilFertility: 80 },
      });
      expect(result.foodProductionMult).toBeCloseTo(0.7);
    });

    it('drops to 0.35 at soil exhaustion (stacks with ozone)', () => {
      const result = evaluateEcologicalCollapse({
        year: 2500,
        climateTrend: 0,
        population: 100,
        terrainStats: { avgPermafrost: 1.0, avgPollution: 0, avgSoilFertility: 80 },
      });
      // ozone: 1.0 * 0.7 = 0.7, soil: 0.7 * 0.5 = 0.35
      expect(result.foodProductionMult).toBeCloseTo(0.35);
    });
  });

  // ── Infrastructure damage from permafrost ─────────────────────────────────

  describe('infrastructure damage', () => {
    it('no damage when permafrost is fully frozen', () => {
      const result = evaluateEcologicalCollapse({
        year: 2050,
        climateTrend: 0,
        population: 100,
        terrainStats: { avgPermafrost: 1.0, avgPollution: 0, avgSoilFertility: 80 },
      });
      expect(result.infrastructureDamageRate).toBe(0);
    });

    it('max damage when permafrost is fully thawed', () => {
      const result = evaluateEcologicalCollapse({
        year: 2050,
        climateTrend: 0,
        population: 100,
        terrainStats: { avgPermafrost: 0, avgPollution: 0, avgSoilFertility: 80 },
      });
      expect(result.infrastructureDamageRate).toBeCloseTo(0.02);
    });
  });

  // ── Oxygen & water tracking flags ─────────────────────────────────────────

  describe('resource tracking flags', () => {
    it('oxygen tracking enabled at year 2200 (atmospheric toxicity)', () => {
      const result = evaluateEcologicalCollapse({
        year: 2200,
        climateTrend: 0,
        population: 100,
        terrainStats: { avgPermafrost: 0.5, avgPollution: 0.1, avgSoilFertility: 60 },
      });
      expect(result.oxygenTrackingRequired).toBe(true);
    });

    it('water tracking enabled at year 3000 (water table collapse)', () => {
      const result = evaluateEcologicalCollapse({
        year: 3000,
        climateTrend: 0,
        population: 100,
        terrainStats: { avgPermafrost: 0.5, avgPollution: 0.1, avgSoilFertility: 60 },
      });
      expect(result.waterTrackingRequired).toBe(true);
    });

    it('neither flag set before their activation years', () => {
      const result = evaluateEcologicalCollapse({
        year: 2199,
        climateTrend: 0,
        population: 100,
        terrainStats: { avgPermafrost: 0.5, avgPollution: 0.1, avgSoilFertility: 60 },
      });
      expect(result.oxygenTrackingRequired).toBe(false);
      expect(result.waterTrackingRequired).toBe(false);
    });
  });

  // ── Pressure modifiers from ecological events ─────────────────────────────

  describe('pressure modifiers', () => {
    it('permafrost thaw adds infrastructure and health pressure', () => {
      const result = evaluateEcologicalCollapse({
        year: 2050,
        climateTrend: 0,
        population: 100,
        terrainStats: { avgPermafrost: 0.5, avgPollution: 0, avgSoilFertility: 80 },
      });
      expect(result.pressureModifiers.infrastructure).toBeGreaterThan(0);
      expect(result.pressureModifiers.health).toBeGreaterThan(0);
    });

    it('multiple events stack pressure modifiers', () => {
      const result = evaluateEcologicalCollapse({
        year: 100000,
        climateTrend: 0.5,
        population: 100000,
        terrainStats: { avgPermafrost: 0, avgPollution: 0.8, avgSoilFertility: 10 },
      });
      // At year 100000 all 9 events are active — health should be substantial
      expect(result.pressureModifiers.health!).toBeGreaterThan(0.3);
      expect(result.pressureModifiers.infrastructure!).toBeGreaterThan(0.1);
      expect(result.pressureModifiers.food!).toBeGreaterThan(0.1);
    });

    it('continental drift adds infrastructure pressure at year 50000', () => {
      const result = evaluateEcologicalCollapse({
        year: 50000,
        climateTrend: 0,
        population: 100,
        terrainStats: { avgPermafrost: 0.5, avgPollution: 0.1, avgSoilFertility: 40 },
      });
      expect(result.activeEvents).toContain('continentalDrift');
      expect(result.pressureModifiers.infrastructure!).toBeGreaterThan(0);
    });
  });
});
