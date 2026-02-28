import { getResourceEntity } from '../../src/ecs/archetypes';
import { createBuilding, createResourceStore } from '../../src/ecs/factories';
import { populationSystem } from '../../src/ecs/systems/populationSystem';
import { powerSystem } from '../../src/ecs/systems/powerSystem';
import { world } from '../../src/ecs/world';
import type { GameRng } from '../../src/game/SeedSystem';

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
    createResourceStore({ food: 1000, population: 10 });
  });

  afterEach(() => {
    world.clear();
  });

  // ── Growth with sufficient housing + food ─────────────────

  describe('population growth', () => {
    it('returns growth count when housing and food are available (with rng)', () => {
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'apartment-tower-a'); // housingCap=50
      powerSystem();

      const store = getResourceEntity()!;
      store.resources.population = 5;
      store.resources.food = 100;

      const rng = createMockRng(2); // Always grow by 2
      const result = populationSystem(rng);

      expect(result.growthCount).toBe(2);
    });

    it('returns growth count when housing and food are available (without rng)', () => {
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'apartment-tower-a');
      powerSystem();

      const store = getResourceEntity()!;
      store.resources.population = 5;
      store.resources.food = 100;

      jest.spyOn(Math, 'random').mockReturnValue(0.67); // floor(0.67 * 3) = 2
      const result = populationSystem();

      expect(result.growthCount).toBe(2);
    });

    it('can return 0 growth (rng returns 0)', () => {
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'apartment-tower-a');
      powerSystem();

      const store = getResourceEntity()!;
      store.resources.population = 5;
      store.resources.food = 100;

      const rng = createMockRng(0);
      const result = populationSystem(rng);

      expect(result.growthCount).toBe(0);
    });

    it('can return 1 growth', () => {
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'apartment-tower-a');
      powerSystem();

      const store = getResourceEntity()!;
      store.resources.population = 5;
      store.resources.food = 100;

      const rng = createMockRng(1);
      const result = populationSystem(rng);

      expect(result.growthCount).toBe(1);
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
      store.resources.population = 5;
      store.resources.food = 11;

      const rng = createMockRng(2);
      const result = populationSystem(rng);

      expect(result.growthCount).toBe(2);
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

  // ── Edge: no resource store ───────────────────────────────

  describe('edge: no resource store', () => {
    it('does not throw when resource store is missing', () => {
      world.clear();
      expect(() => populationSystem()).not.toThrow();
    });

    it('returns zero growth result when resource store is missing', () => {
      world.clear();
      const result = populationSystem();
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

      const rng = createMockRng(2);
      const result = populationSystem(rng);

      // System returns growth of 2 even though pop + growth > cap.
      // Caller (SimulationEngine) decides how many to actually spawn.
      expect(result.growthCount).toBe(2);
    });
  });
});
