import type { StorageState } from '../../src/ai/agents/economy/StorageAgent';
import { StorageAgent } from '../../src/ai/agents/economy/StorageAgent';
import { getResourceEntity } from '../../src/ecs/archetypes';
import { createBuilding, createResourceStore } from '../../src/ecs/factories';
import { world } from '../../src/ecs/world';

/** Creates a cold-storage entity directly (bypasses createBuilding def lookup). */
function createColdStorage(gridX: number, gridY: number, powered = false) {
  return world.add({
    position: { gridX, gridY },
    building: {
      defId: 'cold-storage',
      level: 0,
      powered,
      powerReq: 2,
      powerOutput: 0,
      produces: {},
      housingCap: 0,
      pollution: 0,
      fear: 0,
    },
    durability: { current: 100, decayRate: 0.02 },
    isBuilding: true,
  } as any);
}

describe('StorageAgent', () => {
  let agent: StorageAgent;

  beforeEach(() => {
    world.clear();
    agent = new StorageAgent();
  });

  afterEach(() => {
    world.clear();
  });

  // ---------------------------------------------------------------------------
  // Instantiation
  // ---------------------------------------------------------------------------

  it('can be instantiated with name StorageAgent', () => {
    expect(agent.name).toBe('StorageAgent');
  });

  it('exposes MSG telegram constants', () => {
    expect(StorageAgent.MSG.STORAGE_FULL).toBe('STORAGE_FULL');
    expect(StorageAgent.MSG.FOOD_SPOILED).toBe('FOOD_SPOILED');
  });

  // ---------------------------------------------------------------------------
  // Capacity from buildings
  // ---------------------------------------------------------------------------

  describe('getCapacity / _calculateStorageCapacity', () => {
    it('returns base 10000 capacity with no buildings', () => {
      createResourceStore({ food: 0 });
      agent.tickStorage(5);
      expect(agent.getCapacity()).toBe(10000);
    });

    it('agriculture buildings add 500 capacity each', () => {
      createResourceStore({ food: 0 });
      createBuilding(0, 0, 'collective-farm-hq');
      agent.tickStorage(5);
      expect(agent.getCapacity()).toBe(10500);
    });

    it('stacks capacity from multiple buildings', () => {
      createResourceStore({ food: 0 });
      createBuilding(0, 0, 'collective-farm-hq');
      createBuilding(1, 1, 'collective-farm-hq');
      agent.tickStorage(5);
      expect(agent.getCapacity()).toBe(11000);
    });

    it('specific storage buildings (warehouse) add their defined capacity', () => {
      createResourceStore({ food: 0 });
      // warehouse = 5000 capacity per STORAGE_BY_DEF
      const warehouseContrib = agent.getBuildingStorageContribution('warehouse');
      expect(warehouseContrib).toBe(5000);
    });

    it('grain-elevator contributes 5000 capacity', () => {
      expect(agent.getBuildingStorageContribution('grain-elevator')).toBe(5000);
    });

    it('cold-storage contributes 1000 capacity', () => {
      expect(agent.getBuildingStorageContribution('cold-storage')).toBe(1000);
    });

    it('fuel-depot contributes 1000 capacity', () => {
      expect(agent.getBuildingStorageContribution('fuel-depot')).toBe(1000);
    });

    it('granary contributes 2000 capacity', () => {
      expect(agent.getBuildingStorageContribution('granary')).toBe(2000);
    });

    it('root-cellar contributes 500 capacity', () => {
      expect(agent.getBuildingStorageContribution('root-cellar')).toBe(500);
    });

    it('unknown building defId returns 0 contribution', () => {
      expect(agent.getBuildingStorageContribution('some-unknown-def')).toBe(0);
    });

    it('updates storageCapacity on resource store after update()', () => {
      createResourceStore({ food: 0 });
      createBuilding(0, 0, 'collective-farm-hq'); // +500
      agent.tickStorage(5);
      const store = getResourceEntity()!;
      expect(store.resources.storageCapacity).toBe(10500);
    });
  });

  // ---------------------------------------------------------------------------
  // Overflow spoilage rate (0.5%/tick)
  // ---------------------------------------------------------------------------

  describe('overflow spoilage', () => {
    it('food exceeding capacity decays at 0.5% per tick (spring)', () => {
      createResourceStore({ food: 12000 });
      // base capacity = 10000, overflow = 2000
      // Month 5 = spring, seasonal mult = 1.0
      // spoiled = 2000 * 0.005 * 1.0 = 10
      agent.tickStorage(5);
      const store = getResourceEntity()!;
      expect(store.resources.food).toBeCloseTo(11990);
    });

    it('tracks spoilage amount for last tick', () => {
      createResourceStore({ food: 12000 });
      agent.tickStorage(5);
      expect(agent.getLastSpoilageAmount()).toBeCloseTo(10);
    });

    it('food within capacity does not trigger overflow spoilage', () => {
      createResourceStore({ food: 100 });
      // 100 < 10000 (base capacity) → standard decay rate applies (0.1% per tick)
      agent.tickStorage(5);
      const store = getResourceEntity()!;
      // 100 * 0.001 * 1.0 = 0.1 decay
      expect(store.resources.food).toBeCloseTo(99.9);
    });
  });

  // ---------------------------------------------------------------------------
  // Seasonal multiplier effects
  // ---------------------------------------------------------------------------

  describe('seasonal multipliers', () => {
    it('summer (month 7) doubles overflow spoilage rate', () => {
      createResourceStore({ food: 12000 });
      // overflow = 2000, spoiled = 2000 * 0.005 * 2.0 = 20
      agent.tickStorage(7);
      const store = getResourceEntity()!;
      expect(store.resources.food).toBeCloseTo(11980);
    });

    it('winter (month 1) reduces spoilage to 30%', () => {
      createResourceStore({ food: 12000 });
      // overflow = 2000, spoiled = 2000 * 0.005 * 0.3 = 3
      agent.tickStorage(1);
      const store = getResourceEntity()!;
      expect(store.resources.food).toBeCloseTo(11997);
    });

    it('month 6 (early summer) still uses 2.0 multiplier', () => {
      createResourceStore({ food: 12000 });
      agent.tickStorage(6);
      const store = getResourceEntity()!;
      expect(store.resources.food).toBeCloseTo(11980);
    });

    it('month 8 (late summer) still uses 2.0 multiplier', () => {
      createResourceStore({ food: 12000 });
      agent.tickStorage(8);
      const store = getResourceEntity()!;
      expect(store.resources.food).toBeCloseTo(11980);
    });

    it('month 11 (early winter) uses 0.3 multiplier', () => {
      createResourceStore({ food: 12000 });
      agent.tickStorage(11);
      const store = getResourceEntity()!;
      expect(store.resources.food).toBeCloseTo(11997);
    });

    it('month 3 (late winter) uses 0.3 multiplier', () => {
      createResourceStore({ food: 12000 });
      agent.tickStorage(3);
      const store = getResourceEntity()!;
      expect(store.resources.food).toBeCloseTo(11997);
    });

    it('month 5 (spring) uses 1.0 multiplier', () => {
      createResourceStore({ food: 100 });
      agent.tickStorage(5);
      const store = getResourceEntity()!;
      // 100 * 0.001 * 1.0 = 0.1 (stored spoilage)
      expect(store.resources.food).toBeCloseTo(99.9);
    });

    it('month 10 (autumn) uses 1.0 multiplier', () => {
      createResourceStore({ food: 100 });
      agent.tickStorage(10);
      const store = getResourceEntity()!;
      // 100 * 0.001 * 1.0 = 0.1 (stored spoilage)
      expect(store.resources.food).toBeCloseTo(99.9);
    });
  });

  // ---------------------------------------------------------------------------
  // Cold storage diminishing returns
  // ---------------------------------------------------------------------------

  describe('cold storage diminishing returns', () => {
    it('isColdStoragePresent returns false with no cold-storage buildings', () => {
      expect(agent.isColdStoragePresent()).toBe(false);
    });

    it('isColdStoragePresent returns true with a powered cold-storage building', () => {
      createColdStorage(0, 0, true);
      expect(agent.isColdStoragePresent()).toBe(true);
    });

    it('isColdStoragePresent returns false when cold-storage is unpowered', () => {
      createColdStorage(0, 0, false);
      expect(agent.isColdStoragePresent()).toBe(false);
    });

    it('getColdStorageCount returns correct count of powered buildings', () => {
      // food must be > 0 so the spoilage path runs and cold storage count is computed
      createResourceStore({ food: 100 });
      createColdStorage(0, 0, true);
      createColdStorage(1, 1, false); // unpowered — not counted
      createColdStorage(2, 2, true);
      agent.tickStorage(5);
      expect(agent.getColdStorageCount()).toBe(2);
    });

    it('one powered cold-storage preserves food at single cold storage rate', () => {
      createResourceStore({ food: 100 });
      createColdStorage(0, 0, true);
      // single cold storage rate = 0.001 (same as stored rate now)
      // decay = 100 * 0.001 * 1.0 = 0.1
      agent.tickStorage(5);
      const store = getResourceEntity()!;
      expect(store.resources.food).toBeCloseTo(99.9);
    });

    it('two cold-storage buildings apply diminishing returns', () => {
      createResourceStore({ food: 1000 });
      createColdStorage(0, 0, true);
      createColdStorage(1, 1, true);
      // floor = 0.0005, gap = 0.001 - 0.0005 = 0.0005
      // rate = 0.0005 + 0.0005 * 0.5^1 = 0.00075
      // decay = 1000 * 0.00075 * 1.0 = 0.75
      agent.tickStorage(5);
      const store = getResourceEntity()!;
      expect(store.resources.food).toBeCloseTo(999.25);
    });

    it('three cold-storage buildings have further diminishing returns', () => {
      createResourceStore({ food: 1000 });
      createColdStorage(0, 0, true);
      createColdStorage(1, 1, true);
      createColdStorage(2, 2, true);
      // rate = 0.0005 + 0.0005 * 0.5^2 = 0.000625
      // decay = 1000 * 0.000625 * 1.0 = 0.625
      agent.tickStorage(5);
      const store = getResourceEntity()!;
      expect(store.resources.food).toBeCloseTo(999.375);
    });

    it('unpowered cold-storage does NOT reduce baseline spoilage', () => {
      createResourceStore({ food: 100 });
      createColdStorage(0, 0, false);
      // No cold storage effect → standard rate 0.001
      // cold-storage adds 1000 capacity → total = 11000, food within capacity
      // decay = 100 * 0.001 * 1.0 = 0.1
      agent.tickStorage(5);
      const store = getResourceEntity()!;
      expect(store.resources.food).toBeCloseTo(99.9);
    });

    it('cold storage reduction stacks with seasonal multiplier', () => {
      createResourceStore({ food: 100 });
      createColdStorage(0, 0, true);
      // Month 7 = summer, seasonal mult = 2.0
      // rate = 0.001, decay = 100 * 0.001 * 2.0 = 0.2
      agent.tickStorage(7);
      const store = getResourceEntity()!;
      expect(store.resources.food).toBeCloseTo(99.8);
    });

    it('overflow spoilage is NOT affected by cold storage (uses fixed 0.5%)', () => {
      createResourceStore({ food: 15000 });
      createColdStorage(0, 0, true);
      // Capacity = 10000 (base) + 1000 (cold-storage) = 11000
      // Overflow = 15000 - 11000 = 4000
      // Overflow spoilage = 4000 * 0.005 * 1.0 = 20
      agent.tickStorage(5);
      const store = getResourceEntity()!;
      expect(store.resources.food).toBeCloseTo(14980);
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    it('zero food has no effect', () => {
      createResourceStore({ food: 0 });
      agent.tickStorage(7);
      const store = getResourceEntity()!;
      expect(store.resources.food).toBe(0);
      expect(agent.getLastSpoilageAmount()).toBe(0);
    });

    it('food never goes below zero', () => {
      createResourceStore({ food: 0.001 });
      agent.tickStorage(7); // summer x2.0
      const store = getResourceEntity()!;
      expect(store.resources.food).toBeGreaterThanOrEqual(0);
    });

    it('vodka does not spoil', () => {
      createResourceStore({ food: 0, vodka: 999 });
      agent.tickStorage(7); // summer
      const store = getResourceEntity()!;
      expect(store.resources.vodka).toBe(999);
    });

    it('does nothing when no resource store exists', () => {
      // No createResourceStore() call — update() should be a no-op
      expect(() => agent.tickStorage(5)).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // Serialization round-trip
  // ---------------------------------------------------------------------------

  describe('serialization round-trip', () => {
    it('toJSON returns a snapshot of internal state', () => {
      createResourceStore({ food: 12000 });
      agent.tickStorage(5);

      const snapshot: StorageState = agent.toJSON();
      expect(snapshot.capacity).toBe(10000);
      // overflow = 2000, spoilage = 2000 * 0.005 * 1.0 = 10
      expect(snapshot.lastSpoilageAmount).toBeCloseTo(10);
      expect(snapshot.coldStorageCount).toBe(0);
    });

    it('fromJSON restores state correctly', () => {
      createResourceStore({ food: 12000 });
      agent.tickStorage(5);

      const saved = agent.toJSON();

      const agent2 = new StorageAgent();
      agent2.fromJSON(saved);

      expect(agent2.getCapacity()).toBe(saved.capacity);
      expect(agent2.getLastSpoilageAmount()).toBe(saved.lastSpoilageAmount);
      expect(agent2.getColdStorageCount()).toBe(saved.coldStorageCount);
    });

    it('fromJSON does not mutate original snapshot', () => {
      const snapshot: StorageState = { capacity: 500, lastSpoilageAmount: 3.5, coldStorageCount: 2 };
      const agent2 = new StorageAgent();
      agent2.fromJSON(snapshot);

      // Mutate internal state via update
      createResourceStore({ food: 0 });
      agent2.update(5);

      // Original snapshot unchanged
      expect(snapshot.capacity).toBe(500);
      expect(snapshot.lastSpoilageAmount).toBe(3.5);
    });
  });
});
