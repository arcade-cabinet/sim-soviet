/**
 * Tests for the Dual-Layer Distribution Model (Uniform + Weighted).
 *
 * Validates that:
 * - Weighted consumption >= uniform consumption when officials are present
 * - KGB gets 2x, military 1.5x, politruks 1.5x, party 1.2x
 * - Dependents and prisoners get less than equal share
 * - Settlement with no officials has uniform === weighted
 * - Resentment triggers when privileged consumption exceeds threshold
 * - Integration with consumptionSystem properly drains resources
 */

import { getResourceEntity } from '../../src/ecs/archetypes';
import { createResourceStore } from '../../src/ecs/factories';
import {
  consumptionSystem,
  resetStarvationCounter,
  setResentmentCallback,
  setStarvationCallback,
} from '../../src/ai/agents/economy/consumptionSystem';
import {
  computeDistribution,
  computeRoleBuckets,
  DISTRIBUTION_WEIGHTS,
  RESENTMENT_MORALE_PENALTY,
  RESENTMENT_THRESHOLD,
} from '../../src/ecs/systems/distributionWeights';
import type { RoleBucket } from '../../src/ecs/systems/distributionWeights';
import { world } from '../../src/ecs/world';
import { createTestDvory } from '../playthrough/helpers';
import { economy } from '../../src/config';

/** The actual food divisor from config — tests must match runtime values. */
const FOOD_DIV = economy.consumption.foodPerPopDivisor; // 25
/** The vodka divisor hardcoded in distributionWeights.ts. */
const VODKA_DIV = 20;

describe('Dual-Layer Distribution Model', () => {
  beforeEach(() => {
    world.clear();
    resetStarvationCounter();
    setStarvationCallback(undefined);
    setResentmentCallback(undefined);
  });

  afterEach(() => {
    resetStarvationCounter();
    setStarvationCallback(undefined);
    setResentmentCallback(undefined);
    world.clear();
  });

  // ── computeDistribution (pure math layer) ─────────────────────────────────

  describe('computeDistribution', () => {
    it('returns zero for zero population', () => {
      const result = computeDistribution(0, 1, []);
      expect(result.uniformFoodNeed).toBe(0);
      expect(result.weightedFoodNeed).toBe(0);
      expect(result.uniformVodkaNeed).toBe(0);
      expect(result.weightedVodkaNeed).toBe(0);
      expect(result.resentmentActive).toBe(false);
    });

    it('uniform equals weighted when all workers (weight 1.0)', () => {
      const buckets: RoleBucket[] = [{ role: 'worker', count: 100, weight: 1.0 }];
      const result = computeDistribution(100, 1, buckets);
      expect(result.uniformFoodNeed).toBe(result.weightedFoodNeed);
      expect(result.uniformVodkaNeed).toBe(result.weightedVodkaNeed);
    });

    it('weighted > uniform when officials are present (KGB 2x)', () => {
      const buckets: RoleBucket[] = [
        { role: 'worker', count: 90, weight: DISTRIBUTION_WEIGHTS.worker },
        { role: 'kgb', count: 10, weight: DISTRIBUTION_WEIGHTS.kgb },
      ];
      const result = computeDistribution(100, 1, buckets);
      // Uniform: ceil(100/FOOD_DIV)
      expect(result.uniformFoodNeed).toBe(Math.ceil(100 / FOOD_DIV));
      // Weighted: 90*1.0 + 10*2.0 = 110 effective pop → ceil(110/FOOD_DIV)
      expect(result.weightedFoodNeed).toBe(Math.ceil(110 / FOOD_DIV));
      expect(result.weightedFoodNeed).toBeGreaterThan(result.uniformFoodNeed);
    });

    it('weighted > uniform when military is present (1.5x)', () => {
      const buckets: RoleBucket[] = [
        { role: 'worker', count: 80, weight: DISTRIBUTION_WEIGHTS.worker },
        { role: 'military', count: 20, weight: DISTRIBUTION_WEIGHTS.military },
      ];
      const result = computeDistribution(100, 1, buckets);
      // Uniform: ceil(100/FOOD_DIV)
      expect(result.uniformFoodNeed).toBe(Math.ceil(100 / FOOD_DIV));
      // Weighted: 80*1.0 + 20*1.5 = 110 → ceil(110/FOOD_DIV)
      expect(result.weightedFoodNeed).toBe(Math.ceil(110 / FOOD_DIV));
    });

    it('weighted > uniform when politruks are present (1.5x)', () => {
      const buckets: RoleBucket[] = [
        { role: 'worker', count: 90, weight: DISTRIBUTION_WEIGHTS.worker },
        { role: 'politruk', count: 10, weight: DISTRIBUTION_WEIGHTS.politruk },
      ];
      const result = computeDistribution(100, 1, buckets);
      // Weighted: 90*1.0 + 10*1.5 = 105 → ceil(105/FOOD_DIV)
      expect(result.weightedFoodNeed).toBe(Math.ceil(105 / FOOD_DIV));
      expect(result.weightedFoodNeed).toBeGreaterThan(result.uniformFoodNeed);
    });

    it('weighted < uniform when population is mostly dependents (0.7x)', () => {
      // Use population large enough that ceiling rounding doesn't obscure the difference
      const buckets: RoleBucket[] = [
        { role: 'worker', count: 50, weight: DISTRIBUTION_WEIGHTS.worker },
        { role: 'dependent', count: 200, weight: DISTRIBUTION_WEIGHTS.dependent },
      ];
      const result = computeDistribution(250, 1, buckets);
      // Uniform: ceil(250/FOOD_DIV)
      expect(result.uniformFoodNeed).toBe(Math.ceil(250 / FOOD_DIV));
      // Weighted: 50*1.0 + 200*0.7 = 190 → ceil(190/FOOD_DIV)
      expect(result.weightedFoodNeed).toBe(Math.ceil(190 / FOOD_DIV));
      expect(result.weightedFoodNeed).toBeLessThan(result.uniformFoodNeed);
    });

    it('prisoners consume far less than equal share (0.3x)', () => {
      const buckets: RoleBucket[] = [{ role: 'prisoner', count: 100, weight: DISTRIBUTION_WEIGHTS.prisoner }];
      const result = computeDistribution(100, 1, buckets);
      // Uniform: ceil(100/FOOD_DIV)
      expect(result.uniformFoodNeed).toBe(Math.ceil(100 / FOOD_DIV));
      // Weighted: 100*0.3 = 30 → ceil(30/FOOD_DIV)
      expect(result.weightedFoodNeed).toBe(Math.ceil(30 / FOOD_DIV));
    });

    it('respects consumptionMult for both layers', () => {
      const buckets: RoleBucket[] = [
        { role: 'worker', count: 90, weight: 1.0 },
        { role: 'kgb', count: 10, weight: 2.0 },
      ];
      const result = computeDistribution(100, 1.5, buckets);
      // Uniform: ceil(100/FOOD_DIV * 1.5)
      expect(result.uniformFoodNeed).toBe(Math.ceil((100 / FOOD_DIV) * 1.5));
      // Weighted: (90*1.0 + 10*2.0) = 110 → ceil(110/FOOD_DIV * 1.5)
      expect(result.weightedFoodNeed).toBe(Math.ceil((110 / FOOD_DIV) * 1.5));
    });

    it('vodka follows same pattern as food', () => {
      const buckets: RoleBucket[] = [
        { role: 'worker', count: 80, weight: 1.0 },
        { role: 'kgb', count: 20, weight: 2.0 },
      ];
      const result = computeDistribution(100, 1, buckets);
      // Uniform vodka: ceil(100/VODKA_DIV)
      expect(result.uniformVodkaNeed).toBe(Math.ceil(100 / VODKA_DIV));
      // Weighted: 80*1 + 20*2 = 120 → ceil(120/VODKA_DIV)
      expect(result.weightedVodkaNeed).toBe(Math.ceil(120 / VODKA_DIV));
      expect(result.weightedVodkaNeed).toBeGreaterThan(result.uniformVodkaNeed);
    });
  });

  // ── Resentment mechanic ───────────────────────────────────────────────────

  describe('resentment mechanic', () => {
    it('resentment is NOT active when privileged fraction < threshold', () => {
      // 5 KGB out of 100 → privileged = 5*2.0/(95*1.0 + 5*2.0) = 10/105 ≈ 0.095
      const buckets: RoleBucket[] = [
        { role: 'worker', count: 95, weight: 1.0 },
        { role: 'kgb', count: 5, weight: 2.0 },
      ];
      const result = computeDistribution(100, 1, buckets);
      expect(result.privilegedFraction).toBeLessThan(RESENTMENT_THRESHOLD);
      expect(result.resentmentActive).toBe(false);
    });

    it('resentment IS active when privileged fraction > threshold', () => {
      // 15 officials (mix of KGB + military) out of 100
      // KGB: 10*2.0=20, military: 5*1.5=7.5, workers: 85*1.0=85
      // total weighted = 112.5, privileged = 27.5 → 27.5/112.5 = 0.244 > 0.15
      const buckets: RoleBucket[] = [
        { role: 'worker', count: 85, weight: 1.0 },
        { role: 'kgb', count: 10, weight: 2.0 },
        { role: 'military', count: 5, weight: 1.5 },
      ];
      const result = computeDistribution(100, 1, buckets);
      expect(result.privilegedFraction).toBeGreaterThan(RESENTMENT_THRESHOLD);
      expect(result.resentmentActive).toBe(true);
    });

    it('resentment threshold is exactly 0.15', () => {
      expect(RESENTMENT_THRESHOLD).toBe(0.15);
    });

    it('resentment morale penalty is 2', () => {
      expect(RESENTMENT_MORALE_PENALTY).toBe(2);
    });

    it('party officials (1.2x) contribute to privileged fraction', () => {
      // All party officials: privilegedFraction = 1.0 (100%)
      const buckets: RoleBucket[] = [{ role: 'party', count: 100, weight: 1.2 }];
      const result = computeDistribution(100, 1, buckets);
      expect(result.privilegedFraction).toBe(1.0);
      expect(result.resentmentActive).toBe(true);
    });

    it('settlement of all workers has zero privileged fraction', () => {
      const buckets: RoleBucket[] = [{ role: 'worker', count: 100, weight: 1.0 }];
      const result = computeDistribution(100, 1, buckets);
      expect(result.privilegedFraction).toBe(0);
      expect(result.resentmentActive).toBe(false);
    });

    it('dependents and prisoners do NOT contribute to privileged fraction', () => {
      const buckets: RoleBucket[] = [
        { role: 'worker', count: 50, weight: 1.0 },
        { role: 'dependent', count: 30, weight: 0.7 },
        { role: 'prisoner', count: 20, weight: 0.3 },
      ];
      const result = computeDistribution(100, 1, buckets);
      expect(result.privilegedFraction).toBe(0);
      expect(result.resentmentActive).toBe(false);
    });
  });

  // ── computeRoleBuckets (ECS integration) ─────────────────────────────────

  describe('computeRoleBuckets', () => {
    it('returns empty buckets for zero population', () => {
      const buckets = computeRoleBuckets(0);
      expect(buckets).toHaveLength(0);
    });

    it('assigns all population to workers when no ECS entities exist', () => {
      const buckets = computeRoleBuckets(100);
      expect(buckets).toHaveLength(1);
      expect(buckets[0]!.role).toBe('worker');
      expect(buckets[0]!.count).toBe(100);
      expect(buckets[0]!.weight).toBe(DISTRIBUTION_WEIGHTS.worker);
    });

    it('adds political counts on top of citizen population', () => {
      const buckets = computeRoleBuckets(100, {
        politruk: 2,
        kgb_agent: 1,
        military_officer: 1,
        conscription_officer: 0,
      });
      // Should have worker bucket (100) + politruk (2) + kgb (1) + military (1)
      const workerBucket = buckets.find((b) => b.role === 'worker');
      const politrukBucket = buckets.find((b) => b.role === 'politruk');
      const kgbBucket = buckets.find((b) => b.role === 'kgb');
      const militaryBucket = buckets.find((b) => b.role === 'military');

      expect(workerBucket?.count).toBe(100);
      expect(politrukBucket?.count).toBe(2);
      expect(kgbBucket?.count).toBe(1);
      expect(militaryBucket?.count).toBe(1);
    });

    it('combines military_officer and conscription_officer into military bucket', () => {
      const buckets = computeRoleBuckets(50, {
        military_officer: 2,
        conscription_officer: 1,
      });
      const militaryBucket = buckets.find((b) => b.role === 'military');
      expect(militaryBucket?.count).toBe(3);
      expect(militaryBucket?.weight).toBe(DISTRIBUTION_WEIGHTS.military);
    });

    it('filters out zero-count buckets', () => {
      const buckets = computeRoleBuckets(50, {
        politruk: 0,
        kgb_agent: 0,
        military_officer: 0,
        conscription_officer: 0,
      });
      // Only worker bucket should exist
      expect(buckets.every((b) => b.count > 0)).toBe(true);
      expect(buckets.find((b) => b.role === 'politruk')).toBeUndefined();
    });
  });

  // ── DISTRIBUTION_WEIGHTS config ────────────────────────────────────────────

  describe('DISTRIBUTION_WEIGHTS config', () => {
    it('KGB weight is 2.0', () => {
      expect(DISTRIBUTION_WEIGHTS.kgb).toBe(2.0);
    });

    it('military weight is 1.5', () => {
      expect(DISTRIBUTION_WEIGHTS.military).toBe(1.5);
    });

    it('politruk weight is 1.5', () => {
      expect(DISTRIBUTION_WEIGHTS.politruk).toBe(1.5);
    });

    it('party weight is 1.2', () => {
      expect(DISTRIBUTION_WEIGHTS.party).toBe(1.2);
    });

    it('worker weight is 1.0 (baseline)', () => {
      expect(DISTRIBUTION_WEIGHTS.worker).toBe(1.0);
    });

    it('dependent weight is 0.7', () => {
      expect(DISTRIBUTION_WEIGHTS.dependent).toBe(0.7);
    });

    it('prisoner weight is 0.3', () => {
      expect(DISTRIBUTION_WEIGHTS.prisoner).toBe(0.3);
    });

    it('all privileged roles have weight > 1.0', () => {
      expect(DISTRIBUTION_WEIGHTS.kgb).toBeGreaterThan(1.0);
      expect(DISTRIBUTION_WEIGHTS.military).toBeGreaterThan(1.0);
      expect(DISTRIBUTION_WEIGHTS.politruk).toBeGreaterThan(1.0);
      expect(DISTRIBUTION_WEIGHTS.party).toBeGreaterThan(1.0);
    });

    it('all underprivileged roles have weight < 1.0', () => {
      expect(DISTRIBUTION_WEIGHTS.dependent).toBeLessThan(1.0);
      expect(DISTRIBUTION_WEIGHTS.prisoner).toBeLessThan(1.0);
    });
  });

  // ── consumptionSystem integration ─────────────────────────────────────────

  describe('consumptionSystem integration', () => {
    beforeEach(() => {
      createResourceStore({ food: 1000, vodka: 500, population: 0 });
      createTestDvory(100);
    });

    it('consumes weighted amount of food (higher when officials present)', () => {
      const store = getResourceEntity()!;
      store.resources.population = 100;
      store.resources.food = 500;

      // With KGB + military officials
      const result = consumptionSystem(1, {
        kgb_agent: 5,
        military_officer: 5,
        politruk: 0,
        conscription_officer: 0,
      });

      // Weighted pop = 100*1.0 + 5*2.0 + 5*1.5 = 117.5 → ceil(117.5/FOOD_DIV)
      const expectedWeightedFood = Math.ceil(117.5 / FOOD_DIV);
      expect(store.resources.food).toBe(500 - expectedWeightedFood);
      expect(result.distribution).toBeDefined();
      expect(result.distribution!.weightedFoodNeed).toBeGreaterThan(result.distribution!.uniformFoodNeed);
    });

    it('consumes uniform amount when no officials present', () => {
      const store = getResourceEntity()!;
      store.resources.population = 100;
      store.resources.food = 500;

      const result = consumptionSystem(1);

      // No citizen entities (only dvory with no citizen class), so all 100 → workers
      // Weighted = uniform when all workers: ceil(100/FOOD_DIV)
      const expectedFood = Math.ceil(100 / FOOD_DIV);
      expect(store.resources.food).toBe(500 - expectedFood);
      expect(result.distribution).toBeDefined();
      expect(result.distribution!.uniformFoodNeed).toBe(result.distribution!.weightedFoodNeed);
    });

    it('triggers starvation when food insufficient for weighted need', () => {
      const store = getResourceEntity()!;
      store.resources.population = 100;
      store.resources.food = 1; // Insufficient for even uniform need

      const cb = jest.fn();
      setStarvationCallback(cb);

      const result = consumptionSystem(1);

      // First tick: food depleted to 0, starvation callback fires,
      // but no deaths yet (90-tick grace period)
      expect(store.resources.food).toBe(0);
      expect(cb).toHaveBeenCalled();
      expect(result.starvationDeaths).toBe(0); // Grace period — no deaths yet
    });

    it('fires resentment callback when threshold exceeded', () => {
      const cb = jest.fn();
      setResentmentCallback(cb);

      const store = getResourceEntity()!;
      store.resources.population = 100;
      store.resources.food = 1000;

      // Heavy KGB presence: 20 agents = 20*2.0=40 weighted
      // Workers: 100*1.0=100 weighted → total=140, privileged=40/140=0.286 > 0.15
      consumptionSystem(1, {
        kgb_agent: 20,
        military_officer: 0,
        politruk: 0,
        conscription_officer: 0,
      });

      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb).toHaveBeenCalledWith(
        RESENTMENT_MORALE_PENALTY,
        expect.any(Number),
      );
      // Verify the fraction is above threshold
      const actualFraction = cb.mock.calls[0]![1] as number;
      expect(actualFraction).toBeGreaterThan(RESENTMENT_THRESHOLD);
    });

    it('does NOT fire resentment callback when threshold not exceeded', () => {
      const cb = jest.fn();
      setResentmentCallback(cb);

      const store = getResourceEntity()!;
      store.resources.population = 100;
      store.resources.food = 1000;

      // Small presence: 1 politruk → 1*1.5=1.5, workers 100*1=100
      // privileged = 1.5/101.5 = 0.015 < 0.15
      consumptionSystem(1, {
        kgb_agent: 0,
        military_officer: 0,
        politruk: 1,
        conscription_officer: 0,
      });

      expect(cb).not.toHaveBeenCalled();
    });

    it('returns distribution analysis in result', () => {
      const store = getResourceEntity()!;
      store.resources.population = 100;
      store.resources.food = 1000;
      store.resources.vodka = 500;

      const result = consumptionSystem(1, {
        kgb_agent: 3,
        military_officer: 2,
        politruk: 0,
        conscription_officer: 0,
      });

      expect(result.distribution).toBeDefined();
      expect(result.distribution!.uniformFoodNeed).toBeGreaterThan(0);
      expect(result.distribution!.weightedFoodNeed).toBeGreaterThan(0);
      expect(result.distribution!.buckets.length).toBeGreaterThan(0);
      expect(result.distribution!.privilegedFraction).toBeGreaterThan(0);
    });

    it('weighted vodka consumption is higher with officials', () => {
      const store = getResourceEntity()!;
      store.resources.population = 100;
      store.resources.food = 1000;
      store.resources.vodka = 500;

      const result = consumptionSystem(1, {
        kgb_agent: 10,
        military_officer: 10,
        politruk: 0,
        conscription_officer: 0,
      });

      // Weighted pop = 100 + 10*2.0 + 10*1.5 = 135 → ceil(135/VODKA_DIV)
      // Uniform: ceil(100/VODKA_DIV)
      expect(result.distribution!.weightedVodkaNeed).toBeGreaterThan(result.distribution!.uniformVodkaNeed);
      // Actual vodka consumed should be the weighted amount
      expect(store.resources.vodka).toBe(500 - result.distribution!.weightedVodkaNeed);
    });

    it('zero population consumes nothing', () => {
      const store = getResourceEntity()!;
      store.resources.population = 0;
      store.resources.food = 100;
      store.resources.vodka = 50;

      const result = consumptionSystem(1);

      expect(store.resources.food).toBe(100);
      expect(store.resources.vodka).toBe(50);
      expect(result.starvationDeaths).toBe(0);
      expect(result.resentmentTriggered).toBe(false);
    });

    it('backward compatible: no political counts behaves like original', () => {
      const store = getResourceEntity()!;
      store.resources.population = 40;
      store.resources.food = 100;
      store.resources.vodka = 50;

      // No political counts, no citizen entities → all workers
      consumptionSystem();

      // food: 100 - ceil(40/FOOD_DIV), vodka: 50 - ceil(40/VODKA_DIV)
      const expectedFoodConsumed = Math.ceil(40 / FOOD_DIV);
      const expectedVodkaConsumed = Math.ceil(40 / VODKA_DIV);
      expect(store.resources.food).toBe(100 - expectedFoodConsumed);
      expect(store.resources.vodka).toBe(50 - expectedVodkaConsumed);
    });
  });

  // ── Edge cases ───────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('settlement with only prisoners has very low consumption', () => {
      const buckets: RoleBucket[] = [{ role: 'prisoner', count: 100, weight: 0.3 }];
      const result = computeDistribution(100, 1, buckets);
      // Weighted: 100*0.3 = 30 → ceil(30/FOOD_DIV)
      expect(result.weightedFoodNeed).toBe(Math.ceil(30 / FOOD_DIV));
      // Uniform: ceil(100/FOOD_DIV)
      expect(result.uniformFoodNeed).toBe(Math.ceil(100 / FOOD_DIV));
    });

    it('settlement with only KGB has very high consumption', () => {
      const buckets: RoleBucket[] = [{ role: 'kgb', count: 100, weight: 2.0 }];
      const result = computeDistribution(100, 1, buckets);
      // Weighted: 100*2.0 = 200 → ceil(200/FOOD_DIV)
      expect(result.weightedFoodNeed).toBe(Math.ceil(200 / FOOD_DIV));
      // Uniform: ceil(100/FOOD_DIV)
      expect(result.uniformFoodNeed).toBe(Math.ceil(100 / FOOD_DIV));
    });

    it('mixed population: workers + dependents + officials', () => {
      const buckets: RoleBucket[] = [
        { role: 'worker', count: 60, weight: 1.0 },
        { role: 'dependent', count: 30, weight: 0.7 },
        { role: 'kgb', count: 5, weight: 2.0 },
        { role: 'politruk', count: 3, weight: 1.5 },
        { role: 'prisoner', count: 2, weight: 0.3 },
      ];
      const result = computeDistribution(100, 1, buckets);

      // Weighted: 60*1.0 + 30*0.7 + 5*2.0 + 3*1.5 + 2*0.3
      //         = 60 + 21 + 10 + 4.5 + 0.6 = 96.1
      // ceil(96.1/FOOD_DIV)
      expect(result.weightedFoodNeed).toBe(Math.ceil(96.1 / FOOD_DIV));

      // Privileged: (10 + 4.5) / 96.1 = 14.5/96.1 ≈ 0.151 > 0.15
      expect(result.privilegedFraction).toBeCloseTo(14.5 / 96.1, 4);
      expect(result.resentmentActive).toBe(true);
    });

    it('consumption multiplier of 0 results in 0 consumption', () => {
      const buckets: RoleBucket[] = [{ role: 'worker', count: 100, weight: 1.0 }];
      const result = computeDistribution(100, 0, buckets);
      expect(result.uniformFoodNeed).toBe(0);
      expect(result.weightedFoodNeed).toBe(0);
    });

    it('very large population scales correctly', () => {
      const buckets: RoleBucket[] = [
        { role: 'worker', count: 10000, weight: 1.0 },
        { role: 'kgb', count: 50, weight: 2.0 },
      ];
      const result = computeDistribution(10050, 1, buckets);
      // Uniform: ceil(10050/FOOD_DIV)
      expect(result.uniformFoodNeed).toBe(Math.ceil(10050 / FOOD_DIV));
      // Weighted: 10000 + 100 = 10100 → ceil(10100/FOOD_DIV)
      expect(result.weightedFoodNeed).toBe(Math.ceil(10100 / FOOD_DIV));
    });

    it('single citizen settlement', () => {
      const buckets: RoleBucket[] = [{ role: 'worker', count: 1, weight: 1.0 }];
      const result = computeDistribution(1, 1, buckets);
      // ceil(1/FOOD_DIV) = 1 for both
      expect(result.uniformFoodNeed).toBe(1);
      expect(result.weightedFoodNeed).toBe(1);
    });
  });
});
