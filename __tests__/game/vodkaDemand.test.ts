/**
 * Tests for vodka demand detection in the Construction Demand System.
 *
 * When vodka supply is below a threshold relative to population,
 * the system generates vodka_production demands so the autonomous
 * collective can auto-build distilleries.
 */

import { createMetaStore, createResourceStore } from '@/ecs/factories';
import { world } from '@/ecs/world';
import {
  detectConstructionDemands,
  VODKA_CRITICAL_THRESHOLD,
  VODKA_DEMAND_THRESHOLD,
} from '@/game/workers/demandSystem';

describe('VodkaDemand', () => {
  beforeEach(() => {
    world.clear();
    createResourceStore({ food: 500, population: 0 });
    createMetaStore();
  });

  afterEach(() => {
    world.clear();
  });

  describe('vodka demand detection', () => {
    it('generates critical demand when vodka per capita is below critical threshold', () => {
      // pop=100, vodka=10 → per capita = 0.1 < 0.3 (critical)
      const demands = detectConstructionDemands(100, 200, { food: 500, vodka: 10, power: 100 });
      const vodkaDemand = demands.find((d) => d.category === 'vodka_production');
      expect(vodkaDemand).toBeDefined();
      expect(vodkaDemand!.priority).toBe('critical');
    });

    it('generates urgent demand when vodka per capita is below demand threshold', () => {
      // pop=100, vodka=50 → per capita = 0.5 < 1.0 but > 0.3
      const demands = detectConstructionDemands(100, 200, { food: 500, vodka: 50, power: 100 });
      const vodkaDemand = demands.find((d) => d.category === 'vodka_production');
      expect(vodkaDemand).toBeDefined();
      expect(vodkaDemand!.priority).toBe('urgent');
    });

    it('no vodka demand when vodka per capita is adequate', () => {
      // pop=100, vodka=200 → per capita = 2.0 > 1.0
      const demands = detectConstructionDemands(100, 200, { food: 500, vodka: 200, power: 100 });
      const vodkaDemand = demands.find((d) => d.category === 'vodka_production');
      expect(vodkaDemand).toBeUndefined();
    });

    it('suggests vodka-distillery for vodka demand', () => {
      const demands = detectConstructionDemands(100, 200, { food: 500, vodka: 0, power: 100 });
      const vodkaDemand = demands.find((d) => d.category === 'vodka_production');
      expect(vodkaDemand).toBeDefined();
      expect(vodkaDemand!.suggestedDefIds).toContain('vodka-distillery');
    });

    it('includes a reason string for vodka demand', () => {
      const demands = detectConstructionDemands(100, 200, { food: 500, vodka: 5, power: 100 });
      const vodkaDemand = demands.find((d) => d.category === 'vodka_production');
      expect(vodkaDemand).toBeDefined();
      expect(vodkaDemand!.reason).toBeTruthy();
    });

    it('no vodka demand with zero population', () => {
      const demands = detectConstructionDemands(0, 0, { food: 0, vodka: 0, power: 0 });
      const vodkaDemand = demands.find((d) => d.category === 'vodka_production');
      expect(vodkaDemand).toBeUndefined();
    });

    it('vodka at exactly the demand threshold does not trigger', () => {
      // pop=100, vodka=100 → per capita = 1.0 (exactly at threshold, not below)
      const demands = detectConstructionDemands(100, 200, { food: 500, vodka: 100, power: 100 });
      const vodkaDemand = demands.find((d) => d.category === 'vodka_production');
      expect(vodkaDemand).toBeUndefined();
    });

    it('vodka just below the demand threshold triggers urgent', () => {
      // pop=100, vodka=99 → per capita = 0.99 < 1.0
      const demands = detectConstructionDemands(100, 200, { food: 500, vodka: 99, power: 100 });
      const vodkaDemand = demands.find((d) => d.category === 'vodka_production');
      expect(vodkaDemand).toBeDefined();
      expect(vodkaDemand!.priority).toBe('urgent');
    });
  });

  describe('thresholds', () => {
    it('VODKA_CRITICAL_THRESHOLD is reasonable', () => {
      expect(VODKA_CRITICAL_THRESHOLD).toBeGreaterThan(0);
      expect(VODKA_CRITICAL_THRESHOLD).toBeLessThan(VODKA_DEMAND_THRESHOLD);
    });

    it('VODKA_DEMAND_THRESHOLD is reasonable', () => {
      expect(VODKA_DEMAND_THRESHOLD).toBeGreaterThan(0);
      expect(VODKA_DEMAND_THRESHOLD).toBeLessThanOrEqual(5);
    });
  });

  describe('integration with other demands', () => {
    it('vodka demand coexists with food and housing demands', () => {
      // All shortages at once: no housing, low food, no vodka
      const demands = detectConstructionDemands(100, 0, { food: 50, vodka: 0, power: 100 });
      const categories = demands.map((d) => d.category);
      expect(categories).toContain('housing');
      expect(categories).toContain('food_production');
      expect(categories).toContain('vodka_production');
    });
  });
});
