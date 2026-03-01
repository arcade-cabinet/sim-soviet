/**
 * @module __tests__/game/DemandSystem.test
 *
 * TDD tests for the Construction Demand System.
 *
 * The demand system detects when worker needs exceed building capacity
 * and generates ConstructionDemand entries telling the collective planner
 * which building categories are needed and at what priority.
 *
 * Demand categories: housing, food_production, power, vodka_production
 * Priority levels: critical, urgent, normal
 */

import { world } from '@/ecs/world';
import { createBuilding, createResourceStore, createMetaStore } from '@/ecs/factories';
import { detectConstructionDemands } from '@/game/workers/demandSystem';

describe('DemandSystem', () => {
  beforeEach(() => {
    world.clear();
    createResourceStore({ food: 500, population: 50 });
    createMetaStore();
  });

  afterEach(() => {
    world.clear();
  });

  // ── Housing Demand ──────────────────────────────────────────────────────

  describe('housing demand', () => {
    it('generates housing demand when population exceeds housing capacity', () => {
      const demands = detectConstructionDemands(50, 0, { food: 500, vodka: 0, power: 0 });
      const housingDemand = demands.find((d) => d.category === 'housing');
      expect(housingDemand).toBeDefined();
      expect(housingDemand!.priority).toBe('critical');
    });

    it('no housing demand when capacity exceeds population', () => {
      const demands = detectConstructionDemands(50, 80, { food: 500, vodka: 0, power: 0 });
      const housingDemand = demands.find((d) => d.category === 'housing');
      expect(housingDemand).toBeUndefined();
    });

    it('generates housing demand at 80% occupancy (urgent)', () => {
      const demands = detectConstructionDemands(45, 50, { food: 500, vodka: 0, power: 0 });
      const housingDemand = demands.find((d) => d.category === 'housing');
      expect(housingDemand).toBeDefined();
      expect(housingDemand!.priority).toBe('urgent');
    });

    it('suggests workers-house-a and workers-house-b for housing', () => {
      const demands = detectConstructionDemands(50, 0, { food: 500, vodka: 0, power: 0 });
      const housingDemand = demands.find((d) => d.category === 'housing');
      expect(housingDemand).toBeDefined();
      expect(housingDemand!.suggestedDefIds).toContain('workers-house-a');
      expect(housingDemand!.suggestedDefIds).toContain('workers-house-b');
    });

    it('includes a reason string for housing demand', () => {
      const demands = detectConstructionDemands(50, 0, { food: 500, vodka: 0, power: 0 });
      const housingDemand = demands.find((d) => d.category === 'housing');
      expect(housingDemand).toBeDefined();
      expect(housingDemand!.reason).toBeTruthy();
    });
  });

  // ── Food Production Demand ──────────────────────────────────────────────

  describe('food production demand', () => {
    it('generates farm demand when food per capita is critically low (< 1.5)', () => {
      // food=50, pop=50 → per capita = 1.0 < 1.5
      const demands = detectConstructionDemands(50, 100, { food: 50, vodka: 0, power: 0 });
      const foodDemand = demands.find((d) => d.category === 'food_production');
      expect(foodDemand).toBeDefined();
      expect(foodDemand!.priority).toBe('critical');
    });

    it('generates farm demand when food per capita is low (< 3.0)', () => {
      // food=100, pop=50 → per capita = 2.0 < 3.0
      const demands = detectConstructionDemands(50, 100, { food: 100, vodka: 0, power: 0 });
      const foodDemand = demands.find((d) => d.category === 'food_production');
      expect(foodDemand).toBeDefined();
      expect(foodDemand!.priority).toBe('urgent');
    });

    it('no food demand when food per capita is adequate', () => {
      // food=500, pop=50 → per capita = 10.0 > 3.0
      const demands = detectConstructionDemands(50, 100, { food: 500, vodka: 0, power: 0 });
      const foodDemand = demands.find((d) => d.category === 'food_production');
      expect(foodDemand).toBeUndefined();
    });

    it('suggests collective-farm-hq for food production', () => {
      const demands = detectConstructionDemands(50, 100, { food: 50, vodka: 0, power: 0 });
      const foodDemand = demands.find((d) => d.category === 'food_production');
      expect(foodDemand).toBeDefined();
      expect(foodDemand!.suggestedDefIds).toContain('collective-farm-hq');
    });
  });

  // ── Power Demand ────────────────────────────────────────────────────────

  describe('power demand', () => {
    it('generates power demand when unpowered buildings exist', () => {
      // factory-office has powerReq=4, starts powered=false
      createBuilding(5, 5, 'factory-office');
      const demands = detectConstructionDemands(50, 100, { food: 500, vodka: 0, power: 0 });
      const powerDemand = demands.find((d) => d.category === 'power');
      expect(powerDemand).toBeDefined();
    });

    it('no power demand when all buildings are powered', () => {
      const b = createBuilding(5, 5, 'factory-office');
      b.building!.powered = true;
      const demands = detectConstructionDemands(50, 100, { food: 500, vodka: 0, power: 0 });
      const powerDemand = demands.find((d) => d.category === 'power');
      expect(powerDemand).toBeUndefined();
    });

    it('critical priority when more than 3 unpowered buildings', () => {
      createBuilding(1, 1, 'factory-office');
      createBuilding(2, 2, 'factory-office');
      createBuilding(3, 3, 'factory-office');
      createBuilding(4, 4, 'factory-office');
      const demands = detectConstructionDemands(50, 100, { food: 500, vodka: 0, power: 0 });
      const powerDemand = demands.find((d) => d.category === 'power');
      expect(powerDemand).toBeDefined();
      expect(powerDemand!.priority).toBe('critical');
    });

    it('urgent priority when 1-3 unpowered buildings', () => {
      createBuilding(1, 1, 'factory-office');
      createBuilding(2, 2, 'factory-office');
      const demands = detectConstructionDemands(50, 100, { food: 500, vodka: 0, power: 0 });
      const powerDemand = demands.find((d) => d.category === 'power');
      expect(powerDemand).toBeDefined();
      expect(powerDemand!.priority).toBe('urgent');
    });

    it('suggests power-station for power demand', () => {
      createBuilding(5, 5, 'factory-office');
      const demands = detectConstructionDemands(50, 100, { food: 500, vodka: 0, power: 0 });
      const powerDemand = demands.find((d) => d.category === 'power');
      expect(powerDemand).toBeDefined();
      expect(powerDemand!.suggestedDefIds).toContain('power-station');
    });
  });

  // ── Multiple Demands ────────────────────────────────────────────────────

  describe('multiple demands', () => {
    it('returns multiple demands when multiple shortages exist', () => {
      createBuilding(5, 5, 'factory-office'); // unpowered
      // pop=50, housing=0 (critical), food=50 (critical per capita 1.0)
      const demands = detectConstructionDemands(50, 0, { food: 50, vodka: 0, power: 0 });
      const categories = demands.map((d) => d.category);
      expect(categories).toContain('housing');
      expect(categories).toContain('food_production');
      expect(categories).toContain('power');
    });

    it('returns empty array when no shortages exist', () => {
      const demands = detectConstructionDemands(10, 50, { food: 500, vodka: 100, power: 100 });
      expect(demands).toEqual([]);
    });
  });

  // ── Edge Cases ──────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles zero population gracefully', () => {
      const demands = detectConstructionDemands(0, 0, { food: 0, vodka: 0, power: 0 });
      // Should not throw
      expect(Array.isArray(demands)).toBe(true);
    });

    it('housing at exactly 80% is urgent', () => {
      // 40/50 = 0.8 exactly
      const demands = detectConstructionDemands(40, 50, { food: 500, vodka: 0, power: 0 });
      const housingDemand = demands.find((d) => d.category === 'housing');
      expect(housingDemand).toBeDefined();
      expect(housingDemand!.priority).toBe('urgent');
    });

    it('buildings with zero powerReq are not counted as unpowered', () => {
      // concrete-block has powerReq=0, so should not trigger power demand
      createBuilding(5, 5, 'concrete-block');
      const demands = detectConstructionDemands(50, 100, { food: 500, vodka: 0, power: 0 });
      const powerDemand = demands.find((d) => d.category === 'power');
      expect(powerDemand).toBeUndefined();
    });
  });
});
