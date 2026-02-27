import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getResourceEntity } from '../ecs/archetypes';
import { createBuilding, createResourceStore } from '../ecs/factories';
import {
  calculateStorageCapacity,
  countOperationalColdStorage,
  isColdStoragePresent,
  storageSystem,
} from '../ecs/systems/storageSystem';
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

  describe('cold storage spoilage reduction', () => {
    /**
     * Helper: creates a cold-storage building and optionally powers it.
     * Returns the entity so tests can manipulate power state.
     */
    function createColdStorage(gridX: number, gridY: number, powered = false) {
      const entity = createBuilding(gridX, gridY, 'cold-storage');
      if (powered) {
        entity.building!.powered = true;
        world.reindex(entity);
      }
      return entity;
    }

    describe('isColdStoragePresent', () => {
      it('returns false when no cold-storage buildings exist', () => {
        expect(isColdStoragePresent()).toBe(false);
      });

      it('returns true when an operational, powered cold-storage building exists', () => {
        createColdStorage(0, 0, true);
        expect(isColdStoragePresent()).toBe(true);
      });

      it('returns false when cold-storage building is unpowered', () => {
        createColdStorage(0, 0, false);
        expect(isColdStoragePresent()).toBe(false);
      });
    });

    describe('countOperationalColdStorage', () => {
      it('returns 0 when no cold-storage buildings exist', () => {
        expect(countOperationalColdStorage()).toBe(0);
      });

      it('counts only powered cold-storage buildings', () => {
        createColdStorage(0, 0, true);
        createColdStorage(1, 1, false); // unpowered — not counted
        createColdStorage(2, 2, true);
        expect(countOperationalColdStorage()).toBe(2);
      });
    });

    it('reduces baseline spoilage when one cold-storage building is powered', () => {
      createResourceStore({ food: 100 });
      createColdStorage(0, 0, true);
      // Month 5 = spring, seasonal mult = 1.0
      // With cold storage: rate = 0.001 (0.1%)
      // decay = 100 * 0.001 * 1.0 = 0.1
      storageSystem(5);
      const store = getResourceEntity()!;
      expect(store.resources.food).toBeCloseTo(99.9);
    });

    it('applies diminishing returns with multiple cold-storage buildings', () => {
      createResourceStore({ food: 1000 });
      createColdStorage(0, 0, true);
      createColdStorage(1, 1, true);
      // Month 5 = spring, seasonal mult = 1.0
      // With 2 cold storage buildings:
      //   floor = 0.0005, gap = 0.001 - 0.0005 = 0.0005
      //   rate = 0.0005 + 0.0005 * 0.5^1 = 0.0005 + 0.00025 = 0.00075
      // decay = 1000 * 0.00075 * 1.0 = 0.75
      storageSystem(5);
      const store = getResourceEntity()!;
      expect(store.resources.food).toBeCloseTo(999.25);
    });

    it('third cold-storage building provides even less improvement', () => {
      createResourceStore({ food: 1000 });
      createColdStorage(0, 0, true);
      createColdStorage(1, 1, true);
      createColdStorage(2, 2, true);
      // With 3 cold storage buildings:
      //   rate = 0.0005 + 0.0005 * 0.5^2 = 0.0005 + 0.000125 = 0.000625
      // decay = 1000 * 0.000625 * 1.0 = 0.625
      storageSystem(5);
      const store = getResourceEntity()!;
      expect(store.resources.food).toBeCloseTo(999.375);
    });

    it('unpowered cold-storage does NOT reduce baseline spoilage', () => {
      createResourceStore({ food: 100 });
      createColdStorage(0, 0, false); // unpowered
      // Month 5 = spring, seasonal mult = 1.0
      // No cold storage effect → standard rate 0.005
      // But cold-storage building adds 400 to capacity (total = 600)
      // 100 < 600, so baseline spoilage applies: 100 * 0.005 * 1.0 = 0.5
      storageSystem(5);
      const store = getResourceEntity()!;
      expect(store.resources.food).toBeCloseTo(99.5);
    });

    it('overflow spoilage is NOT affected by cold storage', () => {
      createResourceStore({ food: 1000 });
      createColdStorage(0, 0, true);
      // Capacity = 200 (base) + 400 (cold-storage) = 600
      // Overflow = 1000 - 600 = 400
      // Overflow spoilage = 400 * 0.05 * 1.0 = 20 (same rate regardless of cold storage)
      storageSystem(5);
      const store = getResourceEntity()!;
      expect(store.resources.food).toBeCloseTo(980);
    });

    it('cold storage reduction stacks with seasonal multiplier', () => {
      createResourceStore({ food: 100 });
      createColdStorage(0, 0, true);
      // Month 7 = summer, seasonal mult = 2.0
      // rate = 0.001, decay = 100 * 0.001 * 2.0 = 0.2
      storageSystem(7);
      const store = getResourceEntity()!;
      expect(store.resources.food).toBeCloseTo(99.8);
    });
  });
});
