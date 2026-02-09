import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getResourceEntity } from '../ecs/archetypes';
import { createBuilding, createResourceStore } from '../ecs/factories';
import { powerSystem } from '../ecs/systems/powerSystem';
import { productionSystem } from '../ecs/systems/productionSystem';
import { world } from '../ecs/world';

describe('productionSystem', () => {
  beforeEach(() => {
    world.clear();
    createResourceStore({ food: 0, vodka: 0 });
  });

  afterEach(() => {
    world.clear();
  });

  // ── Farm production ───────────────────────────────────────

  describe('farm food production', () => {
    it('a powered farm produces 20 food per tick', () => {
      createBuilding(0, 0, 'power');
      createBuilding(1, 1, 'farm');
      powerSystem();
      productionSystem();
      const store = getResourceEntity()!;
      expect(store.resources.food).toBe(20);
    });

    it('an unpowered farm produces 0 food', () => {
      createBuilding(1, 1, 'farm'); // no power plant
      powerSystem();
      productionSystem();
      const store = getResourceEntity()!;
      expect(store.resources.food).toBe(0);
    });

    it('two powered farms produce 40 food per tick', () => {
      createBuilding(0, 0, 'power');
      createBuilding(1, 1, 'farm');
      createBuilding(2, 2, 'farm');
      powerSystem();
      productionSystem();
      const store = getResourceEntity()!;
      expect(store.resources.food).toBe(40);
    });

    it('three powered farms produce 60 food per tick', () => {
      createBuilding(0, 0, 'power');
      createBuilding(1, 1, 'farm');
      createBuilding(2, 2, 'farm');
      createBuilding(3, 3, 'farm');
      powerSystem();
      productionSystem();
      const store = getResourceEntity()!;
      expect(store.resources.food).toBe(60);
    });

    it('food accumulates over multiple ticks', () => {
      createBuilding(0, 0, 'power');
      createBuilding(1, 1, 'farm');
      powerSystem();
      productionSystem();
      productionSystem();
      productionSystem();
      const store = getResourceEntity()!;
      expect(store.resources.food).toBe(60);
    });
  });

  // ── Distillery production ─────────────────────────────────

  describe('distillery vodka production', () => {
    it('a powered distillery produces 10 vodka per tick', () => {
      createBuilding(0, 0, 'power');
      createBuilding(1, 1, 'distillery');
      powerSystem();
      productionSystem();
      const store = getResourceEntity()!;
      expect(store.resources.vodka).toBe(10);
    });

    it('an unpowered distillery produces 0 vodka', () => {
      createBuilding(1, 1, 'distillery');
      powerSystem();
      productionSystem();
      const store = getResourceEntity()!;
      expect(store.resources.vodka).toBe(0);
    });

    it('two powered distilleries produce 20 vodka per tick', () => {
      createBuilding(0, 0, 'power');
      createBuilding(1, 1, 'distillery');
      createBuilding(2, 2, 'distillery');
      powerSystem();
      productionSystem();
      const store = getResourceEntity()!;
      expect(store.resources.vodka).toBe(20);
    });

    it('vodka accumulates over multiple ticks', () => {
      createBuilding(0, 0, 'power');
      createBuilding(1, 1, 'distillery');
      powerSystem();
      productionSystem();
      productionSystem();
      const store = getResourceEntity()!;
      expect(store.resources.vodka).toBe(20);
    });
  });

  // ── Production requires power ─────────────────────────────

  describe('production requires power', () => {
    it('farm that loses power stops producing', () => {
      const plant = createBuilding(0, 0, 'power');
      createBuilding(1, 1, 'farm');
      powerSystem();
      productionSystem();
      const store = getResourceEntity()!;
      expect(store.resources.food).toBe(20);

      // Remove power
      world.remove(plant);
      powerSystem();
      productionSystem();
      // Food should stay at 20 — no new production
      expect(store.resources.food).toBe(20);
    });

    it('distillery that loses power stops producing', () => {
      const plant = createBuilding(0, 0, 'power');
      createBuilding(1, 1, 'distillery');
      powerSystem();
      productionSystem();
      const store = getResourceEntity()!;
      expect(store.resources.vodka).toBe(10);

      world.remove(plant);
      powerSystem();
      productionSystem();
      expect(store.resources.vodka).toBe(10);
    });

    it('partially powered: some producers work, some do not', () => {
      createBuilding(0, 0, 'power'); // 100 output
      // 20 distilleries * 5 powerReq = 100, plus 1 extra = 105 > 100
      for (let i = 0; i < 21; i++) {
        createBuilding(i + 1, 0, 'distillery');
      }
      powerSystem();
      productionSystem();

      const store = getResourceEntity()!;
      // 20 powered * 10 vodka = 200 (the 21st is unpowered)
      expect(store.resources.vodka).toBe(200);
    });
  });

  // ── Multiple producers stack correctly ────────────────────

  describe('multiple producers stack correctly', () => {
    it('farms and distilleries both produce in the same tick', () => {
      createBuilding(0, 0, 'power');
      createBuilding(1, 1, 'farm');
      createBuilding(2, 2, 'distillery');
      powerSystem();
      productionSystem();
      const store = getResourceEntity()!;
      expect(store.resources.food).toBe(20);
      expect(store.resources.vodka).toBe(10);
    });

    it('production adds to existing resources', () => {
      const store = getResourceEntity()!;
      store.resources.food = 100;
      store.resources.vodka = 50;

      createBuilding(0, 0, 'power');
      createBuilding(1, 1, 'farm');
      createBuilding(2, 2, 'distillery');
      powerSystem();
      productionSystem();

      expect(store.resources.food).toBe(120);
      expect(store.resources.vodka).toBe(60);
    });
  });

  // ── Edge: no resource store ───────────────────────────────

  describe('edge: no resource store', () => {
    it('does not throw when resource store is missing', () => {
      world.clear();
      createBuilding(0, 0, 'power');
      createBuilding(1, 1, 'farm');
      expect(() => productionSystem()).not.toThrow();
    });
  });

  // ── Non-producer buildings ────────────────────────────────

  describe('non-producer buildings', () => {
    it('housing does not produce any resources', () => {
      createBuilding(0, 0, 'power');
      createBuilding(1, 1, 'housing');
      powerSystem();
      productionSystem();
      const store = getResourceEntity()!;
      expect(store.resources.food).toBe(0);
      expect(store.resources.vodka).toBe(0);
    });
  });
});
