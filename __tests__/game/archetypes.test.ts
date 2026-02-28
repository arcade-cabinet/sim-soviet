/**
 * Tests for src/ecs/archetypes.ts — helper functions and archetype queries.
 */
import {
  assignedCitizens,
  buildings,
  decayableBuildings,
  getMetaEntity,
  getResourceEntity,
  housedCitizens,
  housing,
  metaStore,
  poweredBuildings,
  producers,
  resourceStore,
  unpoweredBuildings,
} from '@/ecs/archetypes';
import {
  createBuilding,
  createCitizen,
  createMetaStore,
  createResourceStore,
} from '@/ecs/factories';
import { world } from '@/ecs/world';

describe('archetypes', () => {
  beforeEach(() => {
    world.clear();
  });

  afterEach(() => {
    world.clear();
  });

  // ── Singleton helpers ─────────────────────────────────────

  describe('getResourceEntity', () => {
    it('returns undefined when no resource store exists', () => {
      expect(getResourceEntity()).toBeUndefined();
    });

    it('returns the resource entity after creation', () => {
      createResourceStore();
      const entity = getResourceEntity();
      expect(entity).toBeDefined();
      expect(entity!.resources.money).toBe(2000);
    });

    it('returns undefined after world.clear()', () => {
      createResourceStore();
      expect(getResourceEntity()).toBeDefined();
      world.clear();
      expect(getResourceEntity()).toBeUndefined();
    });
  });

  describe('getMetaEntity', () => {
    it('returns undefined when no meta store exists', () => {
      expect(getMetaEntity()).toBeUndefined();
    });

    it('returns the meta entity after creation', () => {
      createMetaStore();
      const entity = getMetaEntity();
      expect(entity).toBeDefined();
      expect(entity!.gameMeta.date.year).toBe(1922);
    });

    it('returns undefined after world.clear()', () => {
      createMetaStore();
      expect(getMetaEntity()).toBeDefined();
      world.clear();
      expect(getMetaEntity()).toBeUndefined();
    });
  });

  // ── Singleton archetype queries ───────────────────────────

  describe('resourceStore archetype', () => {
    it('has no entities initially', () => {
      expect(resourceStore.entities).toHaveLength(0);
    });

    it('has one entity after createResourceStore', () => {
      createResourceStore();
      expect(resourceStore.entities).toHaveLength(1);
    });
  });

  describe('metaStore archetype', () => {
    it('has no entities initially', () => {
      expect(metaStore.entities).toHaveLength(0);
    });

    it('has one entity after createMetaStore', () => {
      createMetaStore();
      expect(metaStore.entities).toHaveLength(1);
    });
  });

  // ── Building archetypes ───────────────────────────────────

  describe('buildings archetype', () => {
    it('empty when no buildings', () => {
      expect(buildings.entities).toHaveLength(0);
    });

    it('includes created buildings', () => {
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'apartment-tower-a');
      expect(buildings.entities).toHaveLength(2);
    });
  });

  describe('poweredBuildings / unpoweredBuildings', () => {
    it('new buildings start unpowered', () => {
      createBuilding(0, 0, 'power-station');
      world.reindex(world.entities[0]!);
      expect(unpoweredBuildings.entities).toHaveLength(1);
      expect(poweredBuildings.entities).toHaveLength(0);
    });

    it('moves to powered after mutation + reindex', () => {
      const entity = createBuilding(0, 0, 'power-station');
      entity.building!.powered = true;
      world.reindex(entity);
      expect(poweredBuildings.entities).toHaveLength(1);
      expect(unpoweredBuildings.entities).toHaveLength(0);
    });
  });

  describe('producers archetype', () => {
    it('includes farms (they produce food)', () => {
      createBuilding(0, 0, 'collective-farm-hq');
      expect(producers.entities.length).toBeGreaterThanOrEqual(1);
    });

    it('excludes non-producing buildings', () => {
      createBuilding(0, 0, 'apartment-tower-a');
      expect(producers.entities).toHaveLength(0);
    });
  });

  describe('housing archetype', () => {
    it('includes apartment buildings', () => {
      createBuilding(0, 0, 'apartment-tower-a');
      expect(housing.entities.length).toBeGreaterThanOrEqual(1);
    });

    it('excludes power stations (housingCap = 0)', () => {
      createBuilding(0, 0, 'power-station');
      expect(housing.entities).toHaveLength(0);
    });
  });

  describe('decayableBuildings archetype', () => {
    it('includes buildings with durability', () => {
      createBuilding(0, 0, 'power-station');
      expect(decayableBuildings.entities).toHaveLength(1);
    });
  });

  // ── Citizen archetypes ────────────────────────────────────

  describe('assignedCitizens archetype', () => {
    it('citizen without assignment is not in assignedCitizens', () => {
      createCitizen('worker');
      expect(assignedCitizens.entities).toHaveLength(0);
    });

    it('citizen with assignment appears in assignedCitizens', () => {
      const citizen = createCitizen('worker');
      citizen.citizen!.assignment = 'power-station';
      world.reindex(citizen);
      expect(assignedCitizens.entities).toHaveLength(1);
    });
  });

  describe('housedCitizens archetype', () => {
    it('citizen without home is not in housedCitizens', () => {
      createCitizen('worker');
      expect(housedCitizens.entities).toHaveLength(0);
    });

    it('citizen with home appears in housedCitizens', () => {
      const citizen = createCitizen('worker', 5, 5);
      world.reindex(citizen);
      expect(housedCitizens.entities).toHaveLength(1);
    });
  });
});
