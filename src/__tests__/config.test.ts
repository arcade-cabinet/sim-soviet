import { describe, expect, it } from 'vitest';
import { BUILDING_TYPES, COLORS, GRID_SIZE, TILE_HEIGHT, TILE_WIDTH } from '../config';

describe('config', () => {
  // ── Constants ───────────────────────────────────────────

  describe('constants', () => {
    it('GRID_SIZE is a positive integer', () => {
      expect(GRID_SIZE).toBeGreaterThan(0);
      expect(Number.isInteger(GRID_SIZE)).toBe(true);
    });

    it('TILE_WIDTH and TILE_HEIGHT are positive', () => {
      expect(TILE_WIDTH).toBeGreaterThan(0);
      expect(TILE_HEIGHT).toBeGreaterThan(0);
    });

    it('COLORS has all required keys', () => {
      expect(COLORS).toHaveProperty('grass');
      expect(COLORS).toHaveProperty('road');
      expect(COLORS).toHaveProperty('foundation');
      expect(COLORS).toHaveProperty('highlight');
    });

    it('COLORS values are non-empty strings', () => {
      for (const [, value] of Object.entries(COLORS)) {
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      }
    });
  });

  // ── BUILDING_TYPES structure ────────────────────────────

  describe('BUILDING_TYPES structure', () => {
    it('has all expected building keys', () => {
      const expectedKeys = [
        'none',
        'road',
        'power',
        'housing',
        'farm',
        'distillery',
        'gulag',
        'bulldoze',
      ];
      for (const key of expectedKeys) {
        expect(BUILDING_TYPES).toHaveProperty(key);
      }
    });

    it('every building has a name', () => {
      for (const [, building] of Object.entries(BUILDING_TYPES)) {
        expect(building.name).toBeDefined();
        expect(building.name.length).toBeGreaterThan(0);
      }
    });

    it('every building has an icon', () => {
      for (const [, building] of Object.entries(BUILDING_TYPES)) {
        expect(building.icon).toBeDefined();
        expect(building.icon.length).toBeGreaterThan(0);
      }
    });

    it('every building has a non-negative cost', () => {
      for (const [, building] of Object.entries(BUILDING_TYPES)) {
        expect(building.cost).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // ── Individual building validation ──────────────────────

  describe('individual buildings', () => {
    it('"none" (Inspect) has cost 0', () => {
      expect(BUILDING_TYPES.none!.cost).toBe(0);
    });

    it('"road" has a low cost', () => {
      expect(BUILDING_TYPES.road!.cost).toBe(10);
    });

    it('"power" (Coal Plant) produces power', () => {
      const power = BUILDING_TYPES.power!;
      expect(power.power).toBeDefined();
      expect(power.power).toBeGreaterThan(0);
    });

    it('"power" (Coal Plant) has no powerReq (it generates, not consumes)', () => {
      expect(BUILDING_TYPES.power!.powerReq).toBeUndefined();
    });

    it('"housing" has housing capacity', () => {
      const housing = BUILDING_TYPES.housing!;
      expect(housing.cap).toBeDefined();
      expect(housing.cap!).toBeGreaterThan(0);
    });

    it('"housing" requires power', () => {
      const housing = BUILDING_TYPES.housing!;
      expect(housing.powerReq).toBeDefined();
      expect(housing.powerReq!).toBeGreaterThan(0);
    });

    it('"farm" produces food', () => {
      const farm = BUILDING_TYPES.farm!;
      expect(farm.prod).toBe('food');
      expect(farm.amt).toBeGreaterThan(0);
    });

    it('"farm" requires power', () => {
      expect(BUILDING_TYPES.farm!.powerReq).toBeGreaterThan(0);
    });

    it('"distillery" produces vodka', () => {
      const distillery = BUILDING_TYPES.distillery!;
      expect(distillery.prod).toBe('vodka');
      expect(distillery.amt).toBeGreaterThan(0);
    });

    it('"distillery" requires power', () => {
      expect(BUILDING_TYPES.distillery!.powerReq).toBeGreaterThan(0);
    });

    it('"distillery" creates pollution', () => {
      expect(BUILDING_TYPES.distillery!.pollution).toBeGreaterThan(0);
    });

    it('"gulag" has negative housing capacity', () => {
      expect(BUILDING_TYPES.gulag!.cap).toBeLessThan(0);
    });

    it('"gulag" has a fear factor', () => {
      expect(BUILDING_TYPES.gulag!.fear).toBeGreaterThan(0);
    });

    it('"gulag" requires power', () => {
      expect(BUILDING_TYPES.gulag!.powerReq).toBeGreaterThan(0);
    });

    it('"bulldoze" is a tool type', () => {
      expect(BUILDING_TYPES.bulldoze!.type).toBe('tool');
    });
  });

  // ── Power requirement validity ──────────────────────────

  describe('power requirements', () => {
    it('all buildings with powerReq have positive integer values', () => {
      for (const [, building] of Object.entries(BUILDING_TYPES)) {
        if (building.powerReq !== undefined) {
          expect(building.powerReq).toBeGreaterThan(0);
          expect(Number.isInteger(building.powerReq)).toBe(true);
        }
      }
    });

    it('the total power requirement of one of each consumer does not exceed one power plant', () => {
      const powerOutput = BUILDING_TYPES.power!.power!;
      let totalReq = 0;
      for (const [, building] of Object.entries(BUILDING_TYPES)) {
        if (building.powerReq) {
          totalReq += building.powerReq;
        }
      }
      // One power plant should be able to power at least one of each consumer type
      expect(powerOutput).toBeGreaterThanOrEqual(totalReq);
    });
  });

  // ── Production validation ───────────────────────────────

  describe('production values', () => {
    it('all buildings with prod have a corresponding positive amt', () => {
      for (const [, building] of Object.entries(BUILDING_TYPES)) {
        if (building.prod) {
          expect(building.amt).toBeDefined();
          expect(building.amt!).toBeGreaterThan(0);
        }
      }
    });

    it('prod values are only "food" or "vodka"', () => {
      const validProds = ['food', 'vodka'];
      for (const [, building] of Object.entries(BUILDING_TYPES)) {
        if (building.prod) {
          expect(validProds).toContain(building.prod);
        }
      }
    });
  });

  // ── Cost sanity checks ──────────────────────────────────

  describe('cost sanity', () => {
    it('power plant is more expensive than housing', () => {
      expect(BUILDING_TYPES.power!.cost).toBeGreaterThan(BUILDING_TYPES.housing!.cost);
    });

    it('gulag is the most expensive building', () => {
      const gulagCost = BUILDING_TYPES.gulag!.cost;
      for (const [k, building] of Object.entries(BUILDING_TYPES)) {
        if (k !== 'gulag') {
          expect(gulagCost).toBeGreaterThanOrEqual(building.cost);
        }
      }
    });

    it('starting money can afford at least one of the cheapest non-free building', () => {
      const costs = Object.values(BUILDING_TYPES)
        .map((b) => b.cost)
        .filter((c) => c > 0);
      const cheapest = Math.min(...costs);
      // Starting money from GameState is 2000
      expect(2000).toBeGreaterThanOrEqual(cheapest);
    });
  });
});
