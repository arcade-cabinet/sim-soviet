import { GRID_SIZE } from '@/config';
import { getBuildingDef } from '@/data/buildingDefs';
import {
  createBuilding,
  createCitizen,
  createGrid,
  createMetaStore,
  createResourceStore,
  createTile,
} from '@/ecs/factories';
import { world } from '@/ecs/world';

describe('factories', () => {
  beforeEach(() => {
    world.clear();
  });

  afterEach(() => {
    world.clear();
  });

  // ── createBuilding ─────────────────────────────────────────

  describe('createBuilding', () => {
    it('creates entity with position component', () => {
      const entity = createBuilding(5, 10, 'power-station');
      expect(entity.position).toBeDefined();
      expect(entity.position!.gridX).toBe(5);
      expect(entity.position!.gridY).toBe(10);
    });

    it('creates entity with building component', () => {
      const entity = createBuilding(0, 0, 'power-station');
      expect(entity.building).toBeDefined();
      expect(entity.building!.defId).toBe('power-station');
      expect(entity.building!.powered).toBe(false);
    });

    it('creates entity with renderable component', () => {
      const entity = createBuilding(0, 0, 'power-station');
      expect(entity.renderable).toBeDefined();
      expect(entity.renderable!.spriteId).toBe('power-station');
      expect(entity.renderable!.visible).toBe(true);
    });

    it('creates entity with durability component', () => {
      const entity = createBuilding(0, 0, 'power-station');
      expect(entity.durability).toBeDefined();
      expect(entity.durability!.current).toBe(100);
    });

    it('creates entity with isBuilding tag', () => {
      const entity = createBuilding(0, 0, 'power-station');
      expect(entity.isBuilding).toBe(true);
    });

    it('adds entity to the world', () => {
      expect(world.entities.length).toBe(0);
      createBuilding(0, 0, 'power-station');
      expect(world.entities.length).toBe(1);
    });

    it('returns the created entity', () => {
      const entity = createBuilding(3, 7, 'apartment-tower-a');
      expect(entity).toBeDefined();
      expect(entity.position!.gridX).toBe(3);
    });

    // ── Building stats from defs ───────────────────────────

    describe('building stats from defs', () => {
      it('power plant has correct powerOutput from defs', () => {
        const entity = createBuilding(0, 0, 'power-station');
        const def = getBuildingDef('power-station');
        expect(entity.building!.powerOutput).toBe(def!.stats.powerOutput);
      });

      it('housing has correct housingCap from defs', () => {
        const entity = createBuilding(0, 0, 'apartment-tower-a');
        const def = getBuildingDef('apartment-tower-a');
        expect(entity.building!.housingCap).toBe(def!.stats.housingCap);
      });

      it('farm has produces field from defs', () => {
        const entity = createBuilding(0, 0, 'collective-farm-hq');
        const def = getBuildingDef('collective-farm-hq');
        expect(entity.building!.produces).toEqual(def!.stats.produces);
      });

      it('distillery produces vodka', () => {
        const entity = createBuilding(0, 0, 'vodka-distillery');
        expect(entity.building!.produces).toBeDefined();
        expect(entity.building!.produces!.resource).toBe('vodka');
      });

      it('gulag has fear stat from defs', () => {
        const entity = createBuilding(0, 0, 'gulag-admin');
        const def = getBuildingDef('gulag-admin');
        expect(entity.building!.fear).toBe(def!.stats.fear);
      });

      it('decayRate is sourced from defs', () => {
        const entity = createBuilding(0, 0, 'power-station');
        const def = getBuildingDef('power-station');
        expect(entity.durability!.decayRate).toBe(def!.stats.decayRate);
      });

      it('pollution is sourced from defs', () => {
        const entity = createBuilding(0, 0, 'power-station');
        const def = getBuildingDef('power-station');
        expect(entity.building!.pollution).toBe(def!.stats.pollution);
      });
    });

    // ── Footprint from defs ────────────────────────────────

    describe('footprint calculation from defs', () => {
      it('renderable footprint matches building def footprint', () => {
        const entity = createBuilding(0, 0, 'power-station');
        const def = getBuildingDef('power-station');
        expect(entity.renderable!.footprintX).toBe(def!.footprint.tilesX);
        expect(entity.renderable!.footprintY).toBe(def!.footprint.tilesY);
      });

      it('housing footprint matches defs', () => {
        const entity = createBuilding(0, 0, 'apartment-tower-a');
        const def = getBuildingDef('apartment-tower-a');
        expect(entity.renderable!.footprintX).toBe(def!.footprint.tilesX);
        expect(entity.renderable!.footprintY).toBe(def!.footprint.tilesY);
      });

      it('unknown building type throws', () => {
        expect(() => createBuilding(0, 0, 'unknown-building-xyz')).toThrow(
          '[buildingFactories] Unknown building defId: "unknown-building-xyz"',
        );
      });
    });

    // ── Sprite path from defs ──────────────────────────────

    describe('sprite path from defs', () => {
      it('renderable spritePath matches building def sprite path', () => {
        const entity = createBuilding(0, 0, 'power-station');
        const def = getBuildingDef('power-station');
        expect(entity.renderable!.spritePath).toBe(def!.sprite.path);
      });

      it('unknown building type throws', () => {
        expect(() => createBuilding(0, 0, 'unknown-nope')).toThrow(
          '[buildingFactories] Unknown building defId: "unknown-nope"',
        );
      });
    });

    // ── Unknown building types now throw ─────────────────────

    describe('unknown building type throws', () => {
      it('unknown type throws for powerReq check', () => {
        expect(() => createBuilding(0, 0, 'fake-building')).toThrow(
          '[buildingFactories] Unknown building defId: "fake-building"',
        );
      });

      it('unknown type throws for powerOutput check', () => {
        expect(() => createBuilding(0, 0, 'fake-building')).toThrow(
          '[buildingFactories] Unknown building defId: "fake-building"',
        );
      });

      it('unknown type throws for housingCap check', () => {
        expect(() => createBuilding(0, 0, 'fake-building')).toThrow(
          '[buildingFactories] Unknown building defId: "fake-building"',
        );
      });

      it('unknown type throws for decayRate check', () => {
        expect(() => createBuilding(0, 0, 'fake-building')).toThrow(
          '[buildingFactories] Unknown building defId: "fake-building"',
        );
      });

      it('stores defId as passed to createBuilding', () => {
        const entity = createBuilding(0, 0, 'power-station');
        expect(entity.building!.defId).toBe('power-station');
      });
    });

    // ── Multiple buildings ──────────────────────────────────

    describe('multiple buildings', () => {
      it('creates multiple buildings at different positions', () => {
        createBuilding(0, 0, 'power-station');
        createBuilding(5, 5, 'apartment-tower-a');
        createBuilding(10, 10, 'collective-farm-hq');
        expect(world.entities.length).toBe(3);
      });

      it('each building is independent', () => {
        const b1 = createBuilding(0, 0, 'power-station');
        const b2 = createBuilding(1, 1, 'apartment-tower-a');
        expect(b1.building!.defId).toBe('power-station');
        expect(b2.building!.defId).toBe('apartment-tower-a');
        expect(b1).not.toBe(b2);
      });
    });
  });

  // ── createCitizen ──────────────────────────────────────────

  describe('createCitizen', () => {
    it('creates citizen with correct class', () => {
      const entity = createCitizen('worker');
      expect(entity.citizen).toBeDefined();
      expect(entity.citizen!.class).toBe('worker');
    });

    it('starts with default happiness and hunger', () => {
      const entity = createCitizen('worker');
      expect(entity.citizen!.happiness).toBe(50);
      expect(entity.citizen!.hunger).toBe(0);
    });

    it('positions at grid center when no home specified', () => {
      const entity = createCitizen('worker');
      const center = Math.floor(GRID_SIZE / 2);
      expect(entity.position!.gridX).toBe(center);
      expect(entity.position!.gridY).toBe(center);
    });

    it('positions at home when specified', () => {
      const entity = createCitizen('farmer', 3, 7);
      expect(entity.position!.gridX).toBe(3);
      expect(entity.position!.gridY).toBe(7);
    });

    it('sets home when both homeX and homeY provided', () => {
      const entity = createCitizen('engineer', 5, 10);
      expect(entity.citizen!.home).toEqual({ gridX: 5, gridY: 10 });
    });

    it('does not set home when only homeX provided', () => {
      const entity = createCitizen('worker', 5);
      expect(entity.citizen!.home).toBeUndefined();
    });

    it('has isCitizen tag', () => {
      const entity = createCitizen('worker');
      expect(entity.isCitizen).toBe(true);
    });

    it('adds to world', () => {
      createCitizen('worker');
      expect(world.entities.length).toBe(1);
    });

    it('supports all citizen classes', () => {
      const classes: Array<'worker' | 'party_official' | 'engineer' | 'farmer' | 'soldier' | 'prisoner'> = [
        'worker',
        'party_official',
        'engineer',
        'farmer',
        'soldier',
        'prisoner',
      ];
      for (const cls of classes) {
        const entity = createCitizen(cls);
        expect(entity.citizen!.class).toBe(cls);
      }
    });
  });

  // ── createTile ─────────────────────────────────────────────

  describe('createTile', () => {
    it('creates tile at correct position', () => {
      const entity = createTile(3, 7);
      expect(entity.position!.gridX).toBe(3);
      expect(entity.position!.gridY).toBe(7);
    });

    it('defaults to grass terrain', () => {
      const entity = createTile(0, 0);
      expect(entity.tile!.terrain).toBe('grass');
    });

    it('accepts custom terrain type', () => {
      const entity = createTile(0, 0, 'road');
      expect(entity.tile!.terrain).toBe('road');
    });

    it('starts with elevation 0', () => {
      const entity = createTile(0, 0);
      expect(entity.tile!.elevation).toBe(0);
    });

    it('has isTile tag', () => {
      const entity = createTile(0, 0);
      expect(entity.isTile).toBe(true);
    });

    it('adds to world', () => {
      createTile(0, 0);
      expect(world.entities.length).toBe(1);
    });

    it('supports water terrain', () => {
      const entity = createTile(0, 0, 'water');
      expect(entity.tile!.terrain).toBe('water');
    });

    it('supports foundation terrain', () => {
      const entity = createTile(0, 0, 'foundation');
      expect(entity.tile!.terrain).toBe('foundation');
    });
  });

  // ── createResourceStore ────────────────────────────────────

  describe('createResourceStore', () => {
    it('creates resource store with default values', () => {
      const entity = createResourceStore();
      expect(entity.resources).toBeDefined();
      expect(entity.resources!.money).toBe(2000);
      expect(entity.resources!.food).toBe(600);
      expect(entity.resources!.vodka).toBe(50);
      expect(entity.resources!.power).toBe(0);
      expect(entity.resources!.powerUsed).toBe(0);
      expect(entity.resources!.population).toBe(0);
    });

    it('has isResourceStore tag', () => {
      const entity = createResourceStore();
      expect(entity.isResourceStore).toBe(true);
    });

    it('accepts partial initial overrides', () => {
      const entity = createResourceStore({ money: 5000, food: 999 });
      expect(entity.resources!.money).toBe(5000);
      expect(entity.resources!.food).toBe(999);
      // Other values still default
      expect(entity.resources!.vodka).toBe(50);
    });

    it('accepts full initial overrides', () => {
      const entity = createResourceStore({
        money: 100,
        food: 100,
        vodka: 100,
        power: 100,
        powerUsed: 50,
        population: 200,
      });
      expect(entity.resources!.money).toBe(100);
      expect(entity.resources!.food).toBe(100);
      expect(entity.resources!.vodka).toBe(100);
      expect(entity.resources!.power).toBe(100);
      expect(entity.resources!.powerUsed).toBe(50);
      expect(entity.resources!.population).toBe(200);
    });

    it('is a singleton - second call returns existing entity', () => {
      const first = createResourceStore({ money: 1000 });
      const second = createResourceStore({ money: 9999 });
      expect(first).toBe(second);
      // Money should be from the FIRST call since second is a no-op
      expect(second.resources!.money).toBe(1000);
    });

    it('singleton resets after world.clear', () => {
      createResourceStore({ money: 1000 });
      world.clear();
      const second = createResourceStore({ money: 9999 });
      // After clearing, a new entity should be created
      expect(second.resources!.money).toBe(9999);
    });

    it('adds to world', () => {
      createResourceStore();
      expect(world.entities.length).toBe(1);
    });
  });

  // ── createGrid ─────────────────────────────────────────────

  describe('createGrid', () => {
    it('creates GRID_SIZE * GRID_SIZE tiles by default', () => {
      createGrid();
      expect(world.entities.length).toBe(GRID_SIZE * GRID_SIZE);
    });

    it('creates custom size grid', () => {
      createGrid(5);
      expect(world.entities.length).toBe(25);
    });

    it('all tiles are grass', () => {
      createGrid(3);
      for (const entity of world.entities) {
        expect(entity.tile!.terrain).toBe('grass');
      }
    });

    it('tiles cover the full grid', () => {
      const size = 4;
      createGrid(size);

      const positions = new Set<string>();
      for (const entity of world.entities) {
        positions.add(`${entity.position!.gridX},${entity.position!.gridY}`);
      }

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          expect(positions.has(`${x},${y}`)).toBe(true);
        }
      }
    });
  });

  // ── createMetaStore ───────────────────────────────────────────

  describe('createMetaStore', () => {
    it('creates meta store with default values', () => {
      const entity = createMetaStore();
      expect(entity.gameMeta).toBeDefined();
      expect(entity.gameMeta!.date).toEqual({ year: 1922, month: 10, tick: 0 });
      expect(entity.gameMeta!.quota).toEqual({
        type: 'food',
        target: 500,
        current: 0,
        deadlineYear: 1927,
      });
      expect(entity.gameMeta!.selectedTool).toBe('none');
      expect(entity.gameMeta!.gameOver).toBeNull();
      expect(entity.gameMeta!.seed).toBe('');
      expect(entity.gameMeta!.settlementTier).toBe('selo');
      expect(entity.gameMeta!.blackMarks).toBe(0);
      expect(entity.gameMeta!.commendations).toBe(0);
      expect(entity.gameMeta!.threatLevel).toBe('safe');
    });

    it('has isMetaStore tag', () => {
      const entity = createMetaStore();
      expect(entity.isMetaStore).toBe(true);
    });

    it('accepts partial overrides', () => {
      const entity = createMetaStore({
        seed: 'test-seed',
        date: { year: 1985, month: 6, tick: 0 },
        settlementTier: 'gorod',
      });
      expect(entity.gameMeta!.seed).toBe('test-seed');
      expect(entity.gameMeta!.date.year).toBe(1985);
      expect(entity.gameMeta!.settlementTier).toBe('gorod');
      // Defaults still apply for non-overridden fields
      expect(entity.gameMeta!.selectedTool).toBe('none');
      expect(entity.gameMeta!.gameOver).toBeNull();
    });

    it('accepts full overrides', () => {
      const entity = createMetaStore({
        seed: 'full-seed',
        date: { year: 2000, month: 1, tick: 5 },
        quota: { type: 'vodka', target: 1000, current: 500, deadlineYear: 2005 },
        selectedTool: 'power-station',
        gameOver: { victory: true, reason: 'Test' },
        leaderName: 'Comrade Test',
        leaderPersonality: 'ruthless',
        settlementTier: 'pgt',
        blackMarks: 3,
        commendations: 2,
        threatLevel: 'watched',
      });
      expect(entity.gameMeta!.seed).toBe('full-seed');
      expect(entity.gameMeta!.quota.type).toBe('vodka');
      expect(entity.gameMeta!.leaderName).toBe('Comrade Test');
      expect(entity.gameMeta!.blackMarks).toBe(3);
    });

    it('is a singleton — second call returns existing entity', () => {
      const first = createMetaStore({ seed: 'first' });
      const second = createMetaStore({ seed: 'second' });
      expect(first).toBe(second);
      expect(second.gameMeta!.seed).toBe('first');
    });

    it('singleton resets after world.clear', () => {
      createMetaStore({ seed: 'first' });
      world.clear();
      const second = createMetaStore({ seed: 'second' });
      expect(second.gameMeta!.seed).toBe('second');
    });

    it('adds to world', () => {
      createMetaStore();
      expect(world.entities.length).toBe(1);
    });
  });

  // ── Entity properties match input ──────────────────────────

  describe('entity properties match inputs', () => {
    it('building position exactly matches input coordinates', () => {
      const coords = [
        [0, 0],
        [29, 29],
        [15, 7],
        [0, 29],
      ];
      for (const [x, y] of coords) {
        world.clear();
        const entity = createBuilding(x!, y!, 'apartment-tower-a');
        expect(entity.position!.gridX).toBe(x);
        expect(entity.position!.gridY).toBe(y);
      }
    });

    it('building defId matches the input parameter', () => {
      const entity = createBuilding(0, 0, 'collective-farm-hq');
      expect(entity.building!.defId).toBe('collective-farm-hq');
    });

    it('all buildings start unpowered', () => {
      const types = ['power-station', 'apartment-tower-a', 'collective-farm-hq', 'vodka-distillery', 'gulag-admin'];
      for (const type of types) {
        world.clear();
        const entity = createBuilding(0, 0, type);
        expect(entity.building!.powered).toBe(false);
      }
    });

    it('all buildings start at full durability (100)', () => {
      const types = ['power-station', 'apartment-tower-a', 'collective-farm-hq', 'vodka-distillery', 'gulag-admin'];
      for (const type of types) {
        world.clear();
        const entity = createBuilding(0, 0, type);
        expect(entity.durability!.current).toBe(100);
      }
    });

    it('all buildings are visible by default', () => {
      const entity = createBuilding(0, 0, 'power-station');
      expect(entity.renderable!.visible).toBe(true);
    });
  });
});
