import { getResourceEntity } from '../../src/ecs/archetypes';
import { createBuilding, createResourceStore } from '../../src/ecs/factories';
import { populationSystem } from '../../src/ecs/systems/populationSystem';
import { powerSystem } from '../../src/ecs/systems/powerSystem';
import { world } from '../../src/ecs/world';
import type { GameRng } from '../../src/game/SeedSystem';
import { createTestDvory } from '../playthrough/helpers';

/**
 * Creates a deterministic mock RNG for testing.
 */
function createMockRng(intReturn: number): GameRng {
  return {
    random: () => 0.5,
    int: (_a: number, _b: number) => intReturn,
    pick: <T>(arr: T[]) => arr[0]!,
  } as GameRng;
}

describe('populationSystem', () => {
  beforeEach(() => {
    world.clear();
    createResourceStore({ food: 1000, population: 0 });
    createTestDvory(10);
  });

  afterEach(() => {
    world.clear();
  });

  // ── Growth with sufficient housing + food ─────────────────

  describe('population growth (yearly immigration)', () => {
    it('returns growth count when housing and food are available', () => {
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'apartment-tower-a'); // housingCap=50
      powerSystem();

      const store = getResourceEntity()!;
      store.resources.population = 25;
      store.resources.food = 100;

      // immigrationCap = max(3, floor(50 * 0.08)) = max(3, 4) = 4
      // rng.int(1, 4) returns 1 → growthCount = 1 (pop >= 20 and < 40 → min 3)
      // Actually pop=25 < 40 so emergency boost min 3 applies
      const rng = createMockRng(1);
      const result = populationSystem(rng);

      expect(result.growthCount).toBe(3);
    });

    it('returns growth from rng when population is above emergency threshold', () => {
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'apartment-tower-a'); // housingCap=50
      powerSystem();

      const store = getResourceEntity()!;
      store.resources.population = 45;
      store.resources.food = 100;

      // immigrationCap = max(3, floor(50 * 0.08)) = max(3, 4) = 4
      // rng.int(1, 4) returns 1 → growthCount = 1 (pop >= 40, no emergency boost)
      const rng = createMockRng(1);
      const result = populationSystem(rng);

      expect(result.growthCount).toBe(1);
    });

    it('immigration cap scales with housing capacity', () => {
      createBuilding(0, 0, 'power-station');
      // Create multiple apartment buildings for higher housing cap
      createBuilding(1, 1, 'apartment-tower-a'); // 50
      createBuilding(2, 2, 'apartment-tower-a'); // 50
      createBuilding(3, 3, 'apartment-tower-a'); // 50
      createBuilding(4, 4, 'apartment-tower-a'); // 50 — total 200
      powerSystem();

      const store = getResourceEntity()!;
      store.resources.population = 50;
      store.resources.food = 1000;

      // immigrationCap = max(3, floor(200 * 0.08)) = max(3, 16) = 16
      // rng.int(1, 16) returns 6 → growthCount = 6 (pop >= 40, no emergency boost)
      const rng = createMockRng(6);
      const result = populationSystem(rng);

      expect(result.growthCount).toBe(6);
    });

    it('immigration cap has a minimum of 3', () => {
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'apartment-tower-a'); // housingCap=50
      powerSystem();

      const store = getResourceEntity()!;
      store.resources.population = 45;
      store.resources.food = 100;

      // immigrationCap = max(3, floor(50 * 0.08)) = max(3, 4) = 4
      // rng.int(1, 4) returns 3 → growthCount = 3
      const rng = createMockRng(3);
      const result = populationSystem(rng);

      expect(result.growthCount).toBe(3);
    });
  });

  // ── Population with insufficient food ───────────────────────

  describe('population with insufficient food', () => {
    it('returns 0 growth when food is 10 or below', () => {
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'apartment-tower-a');
      powerSystem();

      const store = getResourceEntity()!;
      store.resources.population = 5;
      store.resources.food = 10; // Must be > 10 to grow

      const rng = createMockRng(2);
      const result = populationSystem(rng);

      expect(result.growthCount).toBe(0);
    });

    it('returns 0 growth when food is 0', () => {
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'apartment-tower-a');
      powerSystem();

      const store = getResourceEntity()!;
      store.resources.population = 5;
      store.resources.food = 0;

      const rng = createMockRng(2);
      const result = populationSystem(rng);

      expect(result.growthCount).toBe(0);
    });

    it('grows when food is 11 (just above threshold)', () => {
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'apartment-tower-a');
      powerSystem();

      const store = getResourceEntity()!;
      store.resources.population = 45;
      store.resources.food = 11;

      // immigrationCap = max(3, floor(50 * 0.08)) = 4
      // rng.int(1, 4) returns 1 → growthCount = 1 (pop >= 40, no emergency boost)
      const rng = createMockRng(1);
      const result = populationSystem(rng);

      expect(result.growthCount).toBe(1);
    });
  });

  // ── Housing capacity limits growth ────────────────────────

  describe('housing capacity limits', () => {
    it('returns 0 growth when population equals housing cap', () => {
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'apartment-tower-a'); // housingCap=50
      powerSystem();

      const store = getResourceEntity()!;
      store.resources.population = 50;
      store.resources.food = 1000;

      const rng = createMockRng(2);
      const result = populationSystem(rng);

      expect(result.growthCount).toBe(0);
    });

    it('returns 0 growth when population exceeds housing cap', () => {
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'apartment-tower-a'); // housingCap=50
      powerSystem();

      const store = getResourceEntity()!;
      store.resources.population = 55; // Over cap
      store.resources.food = 1000;

      const rng = createMockRng(2);
      const result = populationSystem(rng);

      expect(result.growthCount).toBe(0);
      expect(result.overcrowded).toBe(true);
    });

    it('reports correct housing capacity with multiple buildings', () => {
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'apartment-tower-a'); // 50
      createBuilding(2, 2, 'apartment-tower-a'); // 50 — total 100
      powerSystem();

      const store = getResourceEntity()!;
      store.resources.population = 75; // Under 100 cap
      store.resources.food = 1000;

      // immigrationCap = max(3, floor(100 * 0.08)) = max(3, 8) = 8
      // rng.int(1, 8) returns 2 → growthCount = 2 (pop >= 40, no emergency boost)
      const rng = createMockRng(2);
      const result = populationSystem(rng);

      expect(result.growthCount).toBe(2);
      expect(result.housingCapacity).toBe(100);
    });
  });

  // ── Edge: 0 housing ───────────────────────────────────────

  describe('edge: 0 housing', () => {
    it('returns 0 growth when no housing buildings exist', () => {
      const store = getResourceEntity()!;
      store.resources.population = 0;
      store.resources.food = 1000;

      const rng = createMockRng(2);
      const result = populationSystem(rng);

      expect(result.growthCount).toBe(0);
      expect(result.housingCapacity).toBe(0);
    });

    it('returns 0 growth when only power plants exist (no housing)', () => {
      createBuilding(0, 0, 'power-station');
      powerSystem();

      const store = getResourceEntity()!;
      store.resources.population = 10;
      store.resources.food = 1000;

      const rng = createMockRng(2);
      const result = populationSystem(rng);

      expect(result.growthCount).toBe(0);
    });
  });

  // ── Edge: unpowered housing ───────────────────────────────

  describe('edge: unpowered housing', () => {
    it('unpowered housing does not count toward capacity', () => {
      createBuilding(1, 1, 'apartment-tower-a'); // No power plant, so unpowered
      powerSystem();

      const store = getResourceEntity()!;
      store.resources.population = 5;
      store.resources.food = 1000;

      const rng = createMockRng(2);
      const result = populationSystem(rng);

      // Housing is unpowered, so housingCap stays 0, no growth
      expect(result.growthCount).toBe(0);
      expect(result.housingCapacity).toBe(0);
    });
  });

  // ── Edge: population near housing cap ──────────────────────

  describe('edge: population near housing cap', () => {
    it('returns growth even when it would exceed cap (caller manages)', () => {
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'apartment-tower-a'); // housingCap=50
      powerSystem();

      const store = getResourceEntity()!;
      store.resources.population = 49; // 1 below cap
      store.resources.food = 1000;

      // immigrationCap = max(3, floor(50 * 0.08)) = 4
      // rng.int(1, 4) returns 1 → growthCount = 1 (pop >= 40, no emergency boost)
      const rng = createMockRng(1);
      const result = populationSystem(rng);

      // System returns growth even though pop + growth > cap.
      // Caller (SimulationEngine) decides how many to actually spawn.
      expect(result.growthCount).toBe(1);
    });
  });

  // ── Growth multiplier ──────────────────────────────────────

  describe('growth multiplier', () => {
    it('applies growth multiplier to base immigration', () => {
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'apartment-tower-a'); // 50
      createBuilding(2, 2, 'apartment-tower-a'); // 50
      createBuilding(3, 3, 'apartment-tower-a'); // 50
      createBuilding(4, 4, 'apartment-tower-a'); // 50 — total 200
      powerSystem();

      const store = getResourceEntity()!;
      store.resources.population = 50;
      store.resources.food = 1000;

      // immigrationCap = max(3, floor(200 * 0.08)) = 16
      // rng.int(1, 16) = 3, * growthMult 2.0 = 6
      const rng = createMockRng(3);
      const result = populationSystem(rng, 2.0);

      expect(result.growthCount).toBe(6);
    });

    it('zero growth multiplier prevents immigration', () => {
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'apartment-tower-a');
      powerSystem();

      const store = getResourceEntity()!;
      store.resources.population = 45;
      store.resources.food = 1000;

      // Even though rng returns 1 and immigrationCap=4, growthMult=0 → 0 growth
      // pop=45 >= 40, no emergency boost
      const rng = createMockRng(1);
      const result = populationSystem(rng, 0);

      expect(result.growthCount).toBe(0);
    });
  });
});
