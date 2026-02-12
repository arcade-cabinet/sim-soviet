import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getResourceEntity } from '../ecs/archetypes';
import { createBuilding, createResourceStore } from '../ecs/factories';
import { calculateStorageCapacity, storageSystem } from '../ecs/systems/storageSystem';
import { world } from '../ecs/world';

describe('storageSystem', () => {
  beforeEach(() => {
    world.clear();
  });

  afterEach(() => {
    world.clear();
  });

  describe('calculateStorageCapacity', () => {
    it('returns base capacity with no buildings', () => {
      expect(calculateStorageCapacity()).toBe(200);
    });

    it('agriculture buildings add 50 capacity', () => {
      createBuilding(0, 0, 'collective-farm-hq');
      expect(calculateStorageCapacity()).toBe(250);
    });

    it('multiple buildings stack capacity', () => {
      createBuilding(0, 0, 'collective-farm-hq');
      createBuilding(1, 1, 'collective-farm-hq');
      expect(calculateStorageCapacity()).toBe(300);
    });
  });

  describe('food spoilage', () => {
    it('food within capacity decays slowly', () => {
      createResourceStore({ food: 100 });
      // Month 5 = spring, seasonal mult = 1.0
      storageSystem(5);
      const store = getResourceEntity()!;
      // 100 * 0.005 * 1.0 = 0.5 decay
      expect(store.resources.food).toBeCloseTo(99.5);
    });

    it('food exceeding capacity decays faster', () => {
      createResourceStore({ food: 300 });
      // No buildings → base capacity 200, overflow = 100
      // Month 5 = spring, seasonal mult = 1.0
      storageSystem(5);
      const store = getResourceEntity()!;
      // overflow = 100, spoiled = 100 * 0.05 * 1.0 = 5
      expect(store.resources.food).toBeCloseTo(295);
    });

    it('summer doubles spoilage rate', () => {
      createResourceStore({ food: 300 });
      // Month 7 = summer, seasonal mult = 2.0
      storageSystem(7);
      const store = getResourceEntity()!;
      // overflow = 100, spoiled = 100 * 0.05 * 2.0 = 10
      expect(store.resources.food).toBeCloseTo(290);
    });

    it('winter reduces spoilage to 30%', () => {
      createResourceStore({ food: 300 });
      // Month 1 = winter, seasonal mult = 0.3
      storageSystem(1);
      const store = getResourceEntity()!;
      // overflow = 100, spoiled = 100 * 0.05 * 0.3 = 1.5
      expect(store.resources.food).toBeCloseTo(298.5);
    });

    it('zero food has no effect', () => {
      createResourceStore({ food: 0 });
      storageSystem(7);
      const store = getResourceEntity()!;
      expect(store.resources.food).toBe(0);
    });

    it('food never goes below zero', () => {
      createResourceStore({ food: 0.001 });
      storageSystem(7); // summer x2.0
      const store = getResourceEntity()!;
      expect(store.resources.food).toBeGreaterThanOrEqual(0);
    });
  });

  describe('storageCapacity sync', () => {
    it('updates storageCapacity on resource store', () => {
      createResourceStore({ food: 0 });
      createBuilding(0, 0, 'collective-farm-hq'); // +50
      storageSystem(5);
      const store = getResourceEntity()!;
      expect(store.resources.storageCapacity).toBe(250);
    });
  });

  describe('vodka does not spoil', () => {
    it('vodka remains unchanged', () => {
      createResourceStore({ food: 0, vodka: 999 });
      storageSystem(7); // summer
      const store = getResourceEntity()!;
      expect(store.resources.vodka).toBe(999);
    });
  });
});
