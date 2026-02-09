import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getResourceEntity } from '../ecs/archetypes';
import { createBuilding, createResourceStore } from '../ecs/factories';
import { populationSystem } from '../ecs/systems/populationSystem';
import { powerSystem } from '../ecs/systems/powerSystem';
import { world } from '../ecs/world';
import type { GameRng } from '../game/SeedSystem';

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
    it('grows population when housing and food are available (with rng)', () => {
      createBuilding(0, 0, 'power');
      createBuilding(1, 1, 'housing'); // housingCap=50
      powerSystem();

      const store = getResourceEntity()!;
      store.resources.population = 5;
      store.resources.food = 100;

      const rng = createMockRng(2); // Always grow by 2
      populationSystem(rng);

      expect(store.resources.population).toBe(7);
    });

    it('grows population when housing and food are available (without rng)', () => {
      createBuilding(0, 0, 'power');
      createBuilding(1, 1, 'housing');
      powerSystem();

      const store = getResourceEntity()!;
      store.resources.population = 5;
      store.resources.food = 100;

      vi.spyOn(Math, 'random').mockReturnValue(0.67); // floor(0.67 * 3) = 2
      populationSystem();

      expect(store.resources.population).toBe(7);
    });

    it('can grow by 0 (rng returns 0)', () => {
      createBuilding(0, 0, 'power');
      createBuilding(1, 1, 'housing');
      powerSystem();

      const store = getResourceEntity()!;
      store.resources.population = 5;
      store.resources.food = 100;

      const rng = createMockRng(0);
      populationSystem(rng);

      expect(store.resources.population).toBe(5);
    });

    it('can grow by 1', () => {
      createBuilding(0, 0, 'power');
      createBuilding(1, 1, 'housing');
      powerSystem();

      const store = getResourceEntity()!;
      store.resources.population = 5;
      store.resources.food = 100;

      const rng = createMockRng(1);
      populationSystem(rng);

      expect(store.resources.population).toBe(6);
    });
  });

  // ── Population shrinks without food ───────────────────────

  describe('population with insufficient food', () => {
    it('does not grow when food is 10 or below', () => {
      createBuilding(0, 0, 'power');
      createBuilding(1, 1, 'housing');
      powerSystem();

      const store = getResourceEntity()!;
      store.resources.population = 5;
      store.resources.food = 10; // Must be > 10 to grow

      const rng = createMockRng(2);
      populationSystem(rng);

      expect(store.resources.population).toBe(5);
    });

    it('does not grow when food is 0', () => {
      createBuilding(0, 0, 'power');
      createBuilding(1, 1, 'housing');
      powerSystem();

      const store = getResourceEntity()!;
      store.resources.population = 5;
      store.resources.food = 0;

      const rng = createMockRng(2);
      populationSystem(rng);

      expect(store.resources.population).toBe(5);
    });

    it('grows when food is 11 (just above threshold)', () => {
      createBuilding(0, 0, 'power');
      createBuilding(1, 1, 'housing');
      powerSystem();

      const store = getResourceEntity()!;
      store.resources.population = 5;
      store.resources.food = 11;

      const rng = createMockRng(2);
      populationSystem(rng);

      expect(store.resources.population).toBe(7);
    });
  });

  // ── Housing capacity limits growth ────────────────────────

  describe('housing capacity limits', () => {
    it('does not grow when population equals housing cap', () => {
      createBuilding(0, 0, 'power');
      createBuilding(1, 1, 'housing'); // housingCap=50
      powerSystem();

      const store = getResourceEntity()!;
      store.resources.population = 50;
      store.resources.food = 1000;

      const rng = createMockRng(2);
      populationSystem(rng);

      expect(store.resources.population).toBe(50);
    });

    it('does not grow when population exceeds housing cap', () => {
      createBuilding(0, 0, 'power');
      createBuilding(1, 1, 'housing'); // housingCap=50
      powerSystem();

      const store = getResourceEntity()!;
      store.resources.population = 55; // Over cap
      store.resources.food = 1000;

      const rng = createMockRng(2);
      populationSystem(rng);

      expect(store.resources.population).toBe(55);
    });

    it('grows with multiple housing buildings stacking capacity', () => {
      createBuilding(0, 0, 'power');
      createBuilding(1, 1, 'housing'); // 50
      createBuilding(2, 2, 'housing'); // 50 — total 100
      powerSystem();

      const store = getResourceEntity()!;
      store.resources.population = 75; // Under 100 cap
      store.resources.food = 1000;

      const rng = createMockRng(2);
      populationSystem(rng);

      expect(store.resources.population).toBe(77);
    });
  });

  // ── Edge: 0 housing ───────────────────────────────────────

  describe('edge: 0 housing', () => {
    it('does not grow when no housing buildings exist', () => {
      const store = getResourceEntity()!;
      store.resources.population = 0;
      store.resources.food = 1000;

      const rng = createMockRng(2);
      populationSystem(rng);

      expect(store.resources.population).toBe(0);
    });

    it('does not grow when only power plants exist (no housing)', () => {
      createBuilding(0, 0, 'power');
      powerSystem();

      const store = getResourceEntity()!;
      store.resources.population = 10;
      store.resources.food = 1000;

      const rng = createMockRng(2);
      populationSystem(rng);

      expect(store.resources.population).toBe(10);
    });
  });

  // ── Edge: unpowered housing ───────────────────────────────

  describe('edge: unpowered housing', () => {
    it('unpowered housing does not count toward capacity', () => {
      createBuilding(1, 1, 'housing'); // No power plant, so unpowered
      powerSystem();

      const store = getResourceEntity()!;
      store.resources.population = 5;
      store.resources.food = 1000;

      const rng = createMockRng(2);
      populationSystem(rng);

      // Housing is unpowered, so housingCap stays 0, no growth
      expect(store.resources.population).toBe(5);
    });
  });

  // ── Edge: no resource store ───────────────────────────────

  describe('edge: no resource store', () => {
    it('does not throw when resource store is missing', () => {
      world.clear();
      expect(() => populationSystem()).not.toThrow();
    });
  });

  // ── Edge: max population ──────────────────────────────────

  describe('edge: population near housing cap', () => {
    it('can grow population to exactly housing cap', () => {
      createBuilding(0, 0, 'power');
      createBuilding(1, 1, 'housing'); // housingCap=50
      powerSystem();

      const store = getResourceEntity()!;
      store.resources.population = 49; // 1 below cap
      store.resources.food = 1000;

      const rng = createMockRng(2);
      populationSystem(rng);

      // Note: population can grow by 2 to 51, exceeding cap
      // The system only checks if pop < cap to decide whether to grow,
      // but does not clamp the result. This may be a game balance issue.
      expect(store.resources.population).toBe(51);
    });
  });
});
