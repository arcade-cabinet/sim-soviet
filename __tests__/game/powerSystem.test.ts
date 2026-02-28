import { buildingsLogic, getResourceEntity } from '../../src/ecs/archetypes';
import { createBuilding, createResourceStore } from '../../src/ecs/factories';
import { powerSystem } from '../../src/ecs/systems/powerSystem';
import { world } from '../../src/ecs/world';

describe('powerSystem', () => {
  beforeEach(() => {
    world.clear();
    createResourceStore();
  });

  afterEach(() => {
    world.clear();
  });

  // ── Initial state ─────────────────────────────────────────

  describe('initial state', () => {
    it('all buildings start unpowered', () => {
      createBuilding(0, 0, 'apartment-tower-a');
      createBuilding(1, 1, 'collective-farm-hq');
      createBuilding(2, 2, 'vodka-distillery');
      createBuilding(3, 3, 'power-station');

      for (const entity of buildingsLogic) {
        expect(entity.building.powered).toBe(false);
      }
    });

    it('resource store starts with 0 power', () => {
      const store = getResourceEntity()!;
      expect(store.resources.power).toBe(0);
      expect(store.resources.powerUsed).toBe(0);
    });
  });

  // ── Power generation ──────────────────────────────────────

  describe('power generation', () => {
    it('a single power plant produces 100 power', () => {
      createBuilding(0, 0, 'power-station');
      powerSystem();
      const store = getResourceEntity()!;
      expect(store.resources.power).toBe(100);
    });

    it('two power plants produce 200 power', () => {
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'power-station');
      powerSystem();
      const store = getResourceEntity()!;
      expect(store.resources.power).toBe(200);
    });

    it('reports 0 power with no power plants', () => {
      createBuilding(0, 0, 'apartment-tower-a');
      powerSystem();
      const store = getResourceEntity()!;
      expect(store.resources.power).toBe(0);
    });

    it('reports 0 power with no buildings at all', () => {
      powerSystem();
      const store = getResourceEntity()!;
      expect(store.resources.power).toBe(0);
    });
  });

  // ── Power distribution ────────────────────────────────────

  describe('power distribution', () => {
    it('distributes power to buildings within total capacity', () => {
      createBuilding(0, 0, 'power-station'); // 100 output
      createBuilding(1, 1, 'apartment-tower-a'); // 5 req
      createBuilding(2, 2, 'collective-farm-hq'); // 2 req
      powerSystem();
      const store = getResourceEntity()!;
      expect(store.resources.powerUsed).toBe(7);
    });

    it('marks powered buildings as powered=true', () => {
      createBuilding(0, 0, 'power-station');
      const housing = createBuilding(1, 1, 'apartment-tower-a');
      powerSystem();
      expect(housing.building!.powered).toBe(true);
    });

    it('marks unpowered buildings as powered=false when no power supply', () => {
      const housing = createBuilding(0, 0, 'apartment-tower-a');
      powerSystem();
      expect(housing.building!.powered).toBe(false);
    });

    it('power plants are always marked as powered', () => {
      const plant = createBuilding(0, 0, 'power-station');
      powerSystem();
      expect(plant.building!.powered).toBe(true);
    });

    it('buildings with no power requirement and no output are always powered (roads)', () => {
      // Manually create a zero-req zero-output building
      const entity = world.add({
        position: { gridX: 5, gridY: 5 },
        building: {
          defId: 'road',
          powered: false,
          powerReq: 0,
          powerOutput: 0,
          housingCap: 0,
          pollution: 0,
          fear: 0,
        },
      });
      powerSystem();
      expect(entity.building!.powered).toBe(true);
    });
  });

  // ── Power usage tracking ──────────────────────────────────

  describe('power usage tracking', () => {
    it('tracks total power used correctly with one consumer', () => {
      createBuilding(0, 0, 'power-station'); // 100 output
      createBuilding(1, 1, 'apartment-tower-a'); // 5 req
      powerSystem();
      const store = getResourceEntity()!;
      expect(store.resources.powerUsed).toBe(5);
    });

    it('tracks total power used correctly with multiple consumers', () => {
      createBuilding(0, 0, 'power-station'); // 100 output
      createBuilding(1, 1, 'apartment-tower-a'); // 5 req
      createBuilding(2, 2, 'apartment-tower-a'); // 5 req
      createBuilding(3, 3, 'collective-farm-hq'); // 2 req
      createBuilding(4, 4, 'vodka-distillery'); // 5 req
      powerSystem();
      const store = getResourceEntity()!;
      expect(store.resources.powerUsed).toBe(17); // 5 + 5 + 2 + 5
    });

    it('powerUsed is 0 when no consumers exist', () => {
      createBuilding(0, 0, 'power-station');
      powerSystem();
      const store = getResourceEntity()!;
      expect(store.resources.powerUsed).toBe(0);
    });

    it('powerUsed is 0 when no power is available (no consumers powered)', () => {
      createBuilding(0, 0, 'apartment-tower-a');
      createBuilding(1, 1, 'collective-farm-hq');
      powerSystem();
      const store = getResourceEntity()!;
      expect(store.resources.powerUsed).toBe(0);
    });
  });

  // ── Power plant removal / over-capacity ───────────────────

  describe('when power plant is removed', () => {
    it('connected buildings lose power after plant removal', () => {
      const plant = createBuilding(0, 0, 'power-station');
      const housing = createBuilding(1, 1, 'apartment-tower-a');
      powerSystem();
      expect(housing.building!.powered).toBe(true);

      // Remove the power plant
      world.remove(plant);
      powerSystem();
      expect(housing.building!.powered).toBe(false);
    });

    it('powerUsed drops to 0 after plant removal', () => {
      const plant = createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'apartment-tower-a');
      powerSystem();
      const store = getResourceEntity()!;
      expect(store.resources.powerUsed).toBe(5);

      world.remove(plant);
      powerSystem();
      expect(store.resources.powerUsed).toBe(0);
      expect(store.resources.power).toBe(0);
    });
  });

  // ── Edge: more buildings than power capacity ──────────────

  describe('edge: more buildings than power capacity', () => {
    it('leaves excess buildings unpowered (first-come first-served)', () => {
      createBuilding(0, 0, 'power-station'); // 100 output
      // Each gulag requires 10 power, create 11 = 110 > 100
      const gulags = [];
      for (let i = 0; i < 11; i++) {
        gulags.push(createBuilding(i + 1, i + 1, 'gulag-admin'));
      }
      powerSystem();

      const store = getResourceEntity()!;
      expect(store.resources.power).toBe(100);
      // First 10 gulags get power (10 * 10 = 100), 11th does not
      expect(store.resources.powerUsed).toBe(100);

      // Count powered vs unpowered
      let powered = 0;
      let unpowered = 0;
      for (const g of gulags) {
        if (g.building!.powered) powered++;
        else unpowered++;
      }
      expect(powered).toBe(10);
      expect(unpowered).toBe(1);
    });

    it('does not count unpowered buildings in powerUsed', () => {
      // 1 power plant (100), 3 housing (5 each = 15), 10 gulags (10 each = 100)
      // Total need: 115, supply: 100
      createBuilding(0, 0, 'power-station');
      for (let i = 0; i < 3; i++) {
        createBuilding(i + 1, 0, 'apartment-tower-a');
      }
      for (let i = 0; i < 10; i++) {
        createBuilding(i + 4, 0, 'gulag-admin');
      }
      powerSystem();

      const store = getResourceEntity()!;
      // powerUsed should not exceed totalPower
      expect(store.resources.powerUsed).toBeLessThanOrEqual(store.resources.power);
    });

    it('exactly at capacity: all buildings are powered', () => {
      createBuilding(0, 0, 'power-station'); // 100 output
      // 20 housing * 5 req = 100 exactly
      for (let i = 0; i < 20; i++) {
        createBuilding(i + 1, 0, 'apartment-tower-a');
      }
      powerSystem();

      const store = getResourceEntity()!;
      expect(store.resources.power).toBe(100);
      expect(store.resources.powerUsed).toBe(100);
    });
  });

  // ── No resource store edge case ───────────────────────────

  describe('edge: no resource store', () => {
    it('does not throw when resource store is missing', () => {
      world.clear(); // Remove everything including the resource store
      createBuilding(0, 0, 'power-station');
      expect(() => powerSystem()).not.toThrow();
    });
  });

  // ── Idempotency ───────────────────────────────────────────

  describe('idempotency', () => {
    it('running powerSystem twice yields the same result', () => {
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'apartment-tower-a');
      createBuilding(2, 2, 'collective-farm-hq');

      powerSystem();
      const store = getResourceEntity()!;
      const power1 = store.resources.power;
      const used1 = store.resources.powerUsed;

      powerSystem();
      expect(store.resources.power).toBe(power1);
      expect(store.resources.powerUsed).toBe(used1);
    });
  });
});
