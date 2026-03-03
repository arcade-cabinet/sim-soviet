/**
 * @fileoverview Tests for the Labor Time Budget System.
 *
 * Verifies:
 *   - Each era has the correct state demand fraction
 *   - Personal time splits correctly (private plots, rest, idle)
 *   - Wartime (great_patriotic) leaves only 10% personal time
 *   - Idle threshold triggers trouble risk
 *   - Rest minimum is enforced (5%)
 *   - Food crisis increases foraging allocation
 *   - Zero population returns zeroed budget
 *   - Integration with WorkerSystem tick
 */

import { createMetaStore, createResourceStore } from '@/ecs/factories';
import { world } from '@/ecs/world';
import { GameRng } from '@/game/SeedSystem';
import {
  computeLaborBudget,
  type LaborBudgetConfig,
  type LaborBudgetResult,
  LABOR_BUDGET_CONFIG,
} from '@/ai/agents/workforce/laborBudget';
import { WorkerSystem } from '@/ai/agents/workforce/WorkerSystem';

// ─────────────────────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** All 8 era IDs with their expected state demand fractions. */
const ERA_DEMANDS: Array<{ era: string; expected: number }> = [
  { era: 'revolution', expected: 0.6 },       // 0.5 < 0.6 floor → 0.6
  { era: 'collectivization', expected: 0.65 },
  { era: 'industrialization', expected: 0.75 },
  { era: 'great_patriotic', expected: 0.9 },
  { era: 'reconstruction', expected: 0.6 },
  { era: 'thaw_and_freeze', expected: 0.6 },  // 0.55 < 0.6 floor → 0.6
  { era: 'stagnation', expected: 0.65 },
  { era: 'the_eternal', expected: 0.7 },
];

/** Sum all fractions in a budget result to verify they total 1.0. */
function sumFractions(result: LaborBudgetResult): number {
  return (
    result.stateLaborFraction +
    result.privatePlotFraction +
    result.foragingFraction +
    result.restFraction +
    result.idleFraction
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  UNIT TESTS: computeLaborBudget
// ─────────────────────────────────────────────────────────────────────────────

describe('computeLaborBudget', () => {
  const config = LABOR_BUDGET_CONFIG;

  // ── Era state demand fractions ──────────────────────────────────────────

  describe('era state demand fractions', () => {
    it.each(ERA_DEMANDS)(
      '$era has state demand of $expected',
      ({ era, expected }) => {
        const result = computeLaborBudget(era, 100, false, config);
        expect(result.stateLaborFraction).toBeCloseTo(expected, 10);
      },
    );

    it('unknown era falls back to stateMinDemandFraction', () => {
      const result = computeLaborBudget('unknown_era', 100, false, config);
      expect(result.stateLaborFraction).toBe(config.stateMinDemandFraction);
    });
  });

  // ── Wartime (great_patriotic) ──────────────────────────────────────────

  describe('wartime (great_patriotic)', () => {
    it('leaves only 10% personal time', () => {
      const result = computeLaborBudget('great_patriotic', 100, false, config);
      expect(result.stateLaborFraction).toBe(0.9);
      const personalTime =
        result.privatePlotFraction +
        result.foragingFraction +
        result.restFraction +
        result.idleFraction;
      expect(personalTime).toBeCloseTo(0.1, 10);
    });

    it('still enforces rest minimum', () => {
      const result = computeLaborBudget('great_patriotic', 100, false, config);
      expect(result.restFraction).toBeCloseTo(config.restMinimum, 10);
    });

    it('squeezes private plot time from the remaining 5%', () => {
      const result = computeLaborBudget('great_patriotic', 100, false, config);
      // After rest (5%), only 5% left for private plots
      expect(result.privatePlotFraction).toBeCloseTo(0.05, 10);
    });

    it('has no idle time (everything allocated)', () => {
      const result = computeLaborBudget('great_patriotic', 100, false, config);
      expect(result.idleFraction).toBeCloseTo(0, 10);
    });

    it('does not trigger trouble risk (idle is 0)', () => {
      const result = computeLaborBudget('great_patriotic', 100, false, config);
      expect(result.troubleRisk).toBe(false);
    });
  });

  // ── Personal time splits ──────────────────────────────────────────────

  describe('personal time splits', () => {
    it('all fractions sum to 1.0', () => {
      for (const { era } of ERA_DEMANDS) {
        const result = computeLaborBudget(era, 100, false, config);
        expect(sumFractions(result)).toBeCloseTo(1.0, 10);
      }
    });

    it('all fractions sum to 1.0 during food crisis', () => {
      for (const { era } of ERA_DEMANDS) {
        const result = computeLaborBudget(era, 100, true, config);
        expect(sumFractions(result)).toBeCloseTo(1.0, 10);
      }
    });

    it('rest is always at least the configured minimum', () => {
      for (const { era } of ERA_DEMANDS) {
        const result = computeLaborBudget(era, 100, false, config);
        expect(result.restFraction).toBeGreaterThanOrEqual(config.restMinimum - 1e-10);
      }
    });

    it('private plot fraction is at most privatePlotTimeFraction', () => {
      for (const { era } of ERA_DEMANDS) {
        const result = computeLaborBudget(era, 100, false, config);
        expect(result.privatePlotFraction).toBeLessThanOrEqual(config.privatePlotTimeFraction + 1e-10);
      }
    });

    it('idle fraction is never negative', () => {
      for (const { era } of ERA_DEMANDS) {
        const result = computeLaborBudget(era, 100, false, config);
        expect(result.idleFraction).toBeGreaterThanOrEqual(-1e-10);
      }
    });
  });

  // ── Rest minimum enforcement ──────────────────────────────────────────

  describe('rest minimum enforcement', () => {
    it('rest is 5% with default config', () => {
      const result = computeLaborBudget('reconstruction', 100, false, config);
      expect(result.restFraction).toBeCloseTo(0.05, 10);
    });

    it('rest is capped at available personal time when state takes nearly everything', () => {
      // Custom config: state demands 99%, leaving only 1% personal time
      const extremeConfig: LaborBudgetConfig = {
        ...config,
        stateMinDemandFraction: 0.99,
        eraStateDemand: {
          ...config.eraStateDemand,
          revolution: 0.99,
        },
      };
      const result = computeLaborBudget('revolution', 100, false, extremeConfig);
      expect(result.restFraction).toBeCloseTo(0.01, 10);
      // No room for anything else
      expect(result.privatePlotFraction).toBeCloseTo(0, 10);
      expect(result.idleFraction).toBeCloseTo(0, 10);
    });
  });

  // ── Idle threshold & trouble risk ────────────────────────────────────

  describe('idle threshold & trouble risk', () => {
    it('triggers trouble when idle > threshold', () => {
      // Revolution era: state demand = 0.6, personal = 0.4
      // After rest (0.05) and private plots (0.1): idle = 0.25
      // With threshold at 0.2 → we need even less state demand
      const lowDemandConfig: LaborBudgetConfig = {
        ...config,
        stateMinDemandFraction: 0.3,
        idleTroubleThreshold: 0.15,
        eraStateDemand: {
          ...config.eraStateDemand,
          revolution: 0.3,
        },
      };
      const result = computeLaborBudget('revolution', 100, false, lowDemandConfig);
      // personal = 0.7, rest = 0.05, plots = 0.1, idle = 0.55
      expect(result.idleFraction).toBeGreaterThan(lowDemandConfig.idleTroubleThreshold);
      expect(result.troubleRisk).toBe(true);
    });

    it('does not trigger trouble when idle < threshold', () => {
      const result = computeLaborBudget('great_patriotic', 100, false, config);
      expect(result.idleFraction).toBeLessThanOrEqual(config.idleTroubleThreshold);
      expect(result.troubleRisk).toBe(false);
    });

    it('revolution with default config: idle = 0.25 < 0.3 threshold → no trouble', () => {
      const result = computeLaborBudget('revolution', 100, false, config);
      // state=0.6, rest=0.05, plots=0.1, idle=0.25
      expect(result.idleFraction).toBeCloseTo(0.25, 10);
      expect(result.troubleRisk).toBe(false);
    });
  });

  // ── Food crisis & foraging ──────────────────────────────────────────

  describe('food crisis & foraging', () => {
    it('foraging is 0 when there is no food crisis', () => {
      const result = computeLaborBudget('reconstruction', 100, false, config);
      expect(result.foragingFraction).toBe(0);
    });

    it('foraging is allocated during food crisis', () => {
      const result = computeLaborBudget('reconstruction', 100, true, config);
      expect(result.foragingFraction).toBeGreaterThan(0);
    });

    it('foraging is capped at personalTimeForagingCap', () => {
      const result = computeLaborBudget('reconstruction', 100, true, config);
      expect(result.foragingFraction).toBeLessThanOrEqual(config.personalTimeForagingCap + 1e-10);
    });

    it('foraging reduces idle time', () => {
      const noFoodCrisis = computeLaborBudget('reconstruction', 100, false, config);
      const foodCrisis = computeLaborBudget('reconstruction', 100, true, config);
      expect(foodCrisis.idleFraction).toBeLessThan(noFoodCrisis.idleFraction);
    });

    it('wartime food crisis: foraging gets only what is left after rest + plots', () => {
      const result = computeLaborBudget('great_patriotic', 100, true, config);
      // personal = 0.1, rest = 0.05, plots = 0.05, foraging = 0 (nothing left)
      expect(result.foragingFraction).toBeCloseTo(0, 10);
    });

    it('all fractions still sum to 1.0 during food crisis', () => {
      const result = computeLaborBudget('reconstruction', 100, true, config);
      expect(sumFractions(result)).toBeCloseTo(1.0, 10);
    });
  });

  // ── Zero population ─────────────────────────────────────────────────

  describe('zero population', () => {
    it('returns zeroed budget', () => {
      const result = computeLaborBudget('revolution', 0, false, config);
      expect(result.stateLaborFraction).toBe(0);
      expect(result.privatePlotFraction).toBe(0);
      expect(result.foragingFraction).toBe(0);
      expect(result.restFraction).toBe(0);
      expect(result.idleFraction).toBe(0);
      expect(result.troubleRisk).toBe(false);
      expect(result.productionEfficiency).toBe(0);
    });

    it('negative population also returns zeroed budget', () => {
      const result = computeLaborBudget('revolution', -5, false, config);
      expect(result.stateLaborFraction).toBe(0);
      expect(result.productionEfficiency).toBe(0);
    });
  });

  // ── Production efficiency ───────────────────────────────────────────

  describe('production efficiency', () => {
    it('equals state labor fraction', () => {
      for (const { era, expected } of ERA_DEMANDS) {
        const result = computeLaborBudget(era, 100, false, config);
        expect(result.productionEfficiency).toBeCloseTo(expected, 10);
      }
    });

    it('wartime has highest production efficiency (0.9)', () => {
      const result = computeLaborBudget('great_patriotic', 100, false, config);
      expect(result.productionEfficiency).toBe(0.9);
    });
  });

  // ── State demand floor ──────────────────────────────────────────────

  describe('state demand floor', () => {
    it('revolution era (0.5) is floored to stateMinDemandFraction (0.6)', () => {
      const result = computeLaborBudget('revolution', 100, false, config);
      expect(result.stateLaborFraction).toBe(0.6);
    });

    it('thaw_and_freeze era (0.55) is floored to stateMinDemandFraction (0.6)', () => {
      const result = computeLaborBudget('thaw_and_freeze', 100, false, config);
      expect(result.stateLaborFraction).toBe(0.6);
    });

    it('industrialization era (0.75) exceeds floor, used as-is', () => {
      const result = computeLaborBudget('industrialization', 100, false, config);
      expect(result.stateLaborFraction).toBe(0.75);
    });
  });

  // ── Custom config ───────────────────────────────────────────────────

  describe('custom config', () => {
    it('respects custom rest minimum', () => {
      const custom: LaborBudgetConfig = { ...config, restMinimum: 0.15 };
      const result = computeLaborBudget('reconstruction', 100, false, custom);
      expect(result.restFraction).toBeCloseTo(0.15, 10);
    });

    it('respects custom idle threshold', () => {
      const custom: LaborBudgetConfig = {
        ...config,
        idleTroubleThreshold: 0.01,
      };
      const result = computeLaborBudget('reconstruction', 100, false, custom);
      // idle = 0.4 - 0.05 - 0.1 = 0.25 > 0.01
      expect(result.troubleRisk).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  INTEGRATION TESTS: WorkerSystem + labor budget
// ─────────────────────────────────────────────────────────────────────────────

describe('WorkerSystem labor budget integration', () => {
  let system: WorkerSystem;
  let rng: GameRng;

  beforeEach(() => {
    world.clear();
    createResourceStore();
    createMetaStore();
    rng = new GameRng('labor-budget-test');
    system = new WorkerSystem(rng);
  });

  afterEach(() => {
    world.clear();
  });

  it('lastLaborBudget is null before any tick', () => {
    expect(system.getLastLaborBudget()).toBeNull();
  });

  it('lastLaborBudget is populated after tick', () => {
    system.spawnWorker();
    system.tick({
      vodkaAvailable: 100,
      foodAvailable: 100,
      heatingFailing: false,
      month: 6,
      eraId: 'reconstruction',
      totalTicks: 1,
    });
    const budget = system.getLastLaborBudget();
    expect(budget).not.toBeNull();
    expect(budget!.stateLaborFraction).toBe(0.6);
  });

  it('uses the era from tick context', () => {
    system.spawnWorker();
    system.tick({
      vodkaAvailable: 100,
      foodAvailable: 100,
      heatingFailing: false,
      month: 6,
      eraId: 'great_patriotic',
      totalTicks: 1,
    });
    const budget = system.getLastLaborBudget();
    expect(budget!.stateLaborFraction).toBe(0.9);
  });

  it('detects food crisis when foodAvailable is 0', () => {
    system.spawnWorker();
    system.tick({
      vodkaAvailable: 100,
      foodAvailable: 0,
      heatingFailing: false,
      month: 6,
      eraId: 'reconstruction',
      totalTicks: 1,
    });
    const budget = system.getLastLaborBudget();
    expect(budget!.foragingFraction).toBeGreaterThan(0);
  });

  it('no foraging when food is available', () => {
    system.spawnWorker();
    system.tick({
      vodkaAvailable: 100,
      foodAvailable: 100,
      heatingFailing: false,
      month: 6,
      eraId: 'reconstruction',
      totalTicks: 1,
    });
    const budget = system.getLastLaborBudget();
    expect(budget!.foragingFraction).toBe(0);
  });

  it('setLaborBudgetConfig overrides the config', () => {
    system.setLaborBudgetConfig({
      restMinimum: 0.2,
    });
    system.spawnWorker();
    system.tick({
      vodkaAvailable: 100,
      foodAvailable: 100,
      heatingFailing: false,
      month: 6,
      eraId: 'reconstruction',
      totalTicks: 1,
    });
    const budget = system.getLastLaborBudget();
    expect(budget!.restFraction).toBeCloseTo(0.2, 10);
  });

  it('zero population produces zeroed budget', () => {
    // No workers spawned
    system.tick({
      vodkaAvailable: 100,
      foodAvailable: 100,
      heatingFailing: false,
      month: 6,
      eraId: 'reconstruction',
      totalTicks: 1,
    });
    const budget = system.getLastLaborBudget();
    expect(budget).not.toBeNull();
    expect(budget!.stateLaborFraction).toBe(0);
    expect(budget!.productionEfficiency).toBe(0);
  });

  it('labor budget updates each tick', () => {
    system.spawnWorker();

    // First tick: reconstruction
    system.tick({
      vodkaAvailable: 100,
      foodAvailable: 100,
      heatingFailing: false,
      month: 6,
      eraId: 'reconstruction',
      totalTicks: 1,
    });
    expect(system.getLastLaborBudget()!.stateLaborFraction).toBe(0.6);

    // Second tick: wartime
    system.tick({
      vodkaAvailable: 100,
      foodAvailable: 100,
      heatingFailing: false,
      month: 6,
      eraId: 'great_patriotic',
      totalTicks: 2,
    });
    expect(system.getLastLaborBudget()!.stateLaborFraction).toBe(0.9);
  });
});
