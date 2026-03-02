import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as dbSchema from '../../src/db/schema';

// Variables prefixed with 'mock' are allowed inside jest.mock() factories
let mockRawDb: InstanceType<typeof Database>;
let mockTestDb: ReturnType<typeof drizzle>;

// Mock expo-sqlite (never loaded in tests)
jest.mock('expo-sqlite', () => ({}));

// Mock @/db/provider so getDatabase() returns our better-sqlite3 backed drizzle instance.
// The `mock`-prefixed variables are allowed by Jest's hoisting rules.
jest.mock('../../src/db/provider', () => ({
  getDatabase: () => mockTestDb,
  initDatabase: async () => mockTestDb,
  closeDatabase: () => {},
  exportDatabaseFile: () => null,
  importDatabaseFile: async () => mockTestDb,
}));

import { buildingsLogic, getMetaEntity, getResourceEntity } from '../../src/ecs/archetypes';
import { createBuilding, createMetaStore, createResourceStore } from '../../src/ecs/factories';
import { world } from '../../src/ecs/world';
import { GameGrid } from '../../src/game/GameGrid';
import { type ExtendedSaveData, SaveSystem } from '../../src/game/SaveSystem';

/** Create tables in the in-memory database. */
function createTables(db: InstanceType<typeof Database>): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS saves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT 'autosave',
      timestamp INTEGER NOT NULL,
      version TEXT NOT NULL DEFAULT '1.0.0',
      game_state TEXT
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      save_id INTEGER NOT NULL REFERENCES saves(id),
      money INTEGER NOT NULL DEFAULT 2000,
      food INTEGER NOT NULL DEFAULT 200,
      vodka INTEGER NOT NULL DEFAULT 50,
      power INTEGER NOT NULL DEFAULT 0,
      power_used INTEGER NOT NULL DEFAULT 0,
      population INTEGER NOT NULL DEFAULT 0
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS chronology (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      save_id INTEGER NOT NULL REFERENCES saves(id),
      year INTEGER NOT NULL DEFAULT 1980,
      month INTEGER NOT NULL DEFAULT 1,
      tick INTEGER NOT NULL DEFAULT 0
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS quotas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      save_id INTEGER NOT NULL REFERENCES saves(id),
      type TEXT NOT NULL DEFAULT 'food',
      target INTEGER NOT NULL DEFAULT 500,
      current INTEGER NOT NULL DEFAULT 0,
      deadline_year INTEGER NOT NULL DEFAULT 1985
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS buildings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      save_id INTEGER NOT NULL REFERENCES saves(id),
      grid_x INTEGER NOT NULL,
      grid_y INTEGER NOT NULL,
      type TEXT NOT NULL,
      powered INTEGER NOT NULL DEFAULT 0
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
}

describe('SaveSystem', () => {
  let grid: GameGrid;
  let saveSystem: SaveSystem;

  beforeEach(() => {
    world.clear();

    // Create a fresh in-memory SQLite database for each test
    mockRawDb = new Database(':memory:');
    createTables(mockRawDb);
    mockTestDb = drizzle(mockRawDb, { schema: dbSchema }) as any;

    grid = new GameGrid();
    createResourceStore();
    createMetaStore();
    saveSystem = new SaveSystem(grid);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    world.clear();
    if (mockRawDb) mockRawDb.close();
  });

  // ── Save ────────────────────────────────────────────────

  describe('save', () => {
    it('returns true on successful save', async () => {
      expect(await saveSystem.save()).toBe(true);
    });

    it('stores data in the database', async () => {
      await saveSystem.save();
      const rows = mockRawDb.prepare('SELECT * FROM saves').all();
      expect(rows.length).toBeGreaterThan(0);
    });

    it('stores valid game_state JSON', async () => {
      await saveSystem.save();
      const row = mockRawDb.prepare('SELECT game_state FROM saves WHERE name = ?').get('autosave') as {
        game_state: string;
      };
      expect(row).toBeTruthy();
      expect(() => JSON.parse(row.game_state)).not.toThrow();
    });

    it('saves all resource fields', async () => {
      getResourceEntity()!.resources.money = 5000;
      getResourceEntity()!.resources.population = 42;
      getResourceEntity()!.resources.food = 300;
      getResourceEntity()!.resources.vodka = 75;
      getResourceEntity()!.resources.power = 100;
      getResourceEntity()!.resources.powerUsed = 25;

      await saveSystem.save();
      const row = mockRawDb.prepare('SELECT game_state FROM saves WHERE name = ?').get('autosave') as {
        game_state: string;
      };
      const data: ExtendedSaveData = JSON.parse(row.game_state);

      expect(data.resources.money).toBe(5000);
      expect(data.resources.population).toBe(42);
      expect(data.resources.food).toBe(300);
      expect(data.resources.vodka).toBe(75);
      expect(data.resources.power).toBe(100);
      expect(data.resources.powerUsed).toBe(25);
    });

    it('saves date information', async () => {
      getMetaEntity()!.gameMeta.date = { year: 1990, month: 6, tick: 3 };
      await saveSystem.save();
      const row = mockRawDb.prepare('SELECT game_state FROM saves WHERE name = ?').get('autosave') as {
        game_state: string;
      };
      const data: ExtendedSaveData = JSON.parse(row.game_state);
      expect(data.gameMeta.date).toEqual({ year: 1990, month: 6, tick: 3 });
    });

    it('saves buildings correctly', async () => {
      createBuilding(5, 10, 'apartment-tower-a');
      buildingsLogic.entities[0]!.building.powered = true;

      await saveSystem.save();
      const row = mockRawDb.prepare('SELECT game_state FROM saves WHERE name = ?').get('autosave') as {
        game_state: string;
      };
      const data: ExtendedSaveData = JSON.parse(row.game_state);

      expect(data.buildings).toHaveLength(1);
      expect(data.buildings[0]!.x).toBe(5);
      expect(data.buildings[0]!.y).toBe(10);
      expect(data.buildings[0]!.defId).toBe('apartment-tower-a');
      expect(data.buildings[0]!.powered).toBe(true);
    });

    it('saves quota information', async () => {
      getMetaEntity()!.gameMeta.quota = {
        type: 'vodka',
        target: 300,
        current: 150,
        deadlineYear: 1990,
      };
      await saveSystem.save();
      const row = mockRawDb.prepare('SELECT game_state FROM saves WHERE name = ?').get('autosave') as {
        game_state: string;
      };
      const data: ExtendedSaveData = JSON.parse(row.game_state);
      expect(data.gameMeta.quota).toEqual({
        type: 'vodka',
        target: 300,
        current: 150,
        deadlineYear: 1990,
      });
    });

    it('includes version and timestamp', async () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);
      await saveSystem.save();
      const row = mockRawDb.prepare('SELECT game_state FROM saves WHERE name = ?').get('autosave') as {
        game_state: string;
      };
      const data: ExtendedSaveData = JSON.parse(row.game_state);
      expect(data.version).toBe('2.0.0');
      expect(data.timestamp).toBe(now);
    });
  });

  describe('save error handling', () => {
    it('returns false when JSON.stringify throws', async () => {
      // Mock JSON.stringify to simulate a serialization failure
      jest.spyOn(JSON, 'stringify').mockImplementation(() => {
        throw new Error('Serialization failed');
      });
      expect(await saveSystem.save()).toBe(false);
    });
  });

  // ── Load ────────────────────────────────────────────────

  describe('load', () => {
    it('returns false when no save data exists', async () => {
      expect(await saveSystem.load()).toBe(false);
    });

    it('returns true when save data is loaded successfully', async () => {
      await saveSystem.save();
      // Create a new GameGrid to load into
      world.clear();
      createResourceStore();
      createMetaStore();
      const grid2 = new GameGrid();
      saveSystem = new SaveSystem(grid2);
      expect(await saveSystem.load()).toBe(true);
    });

    it('restores all resource values', async () => {
      getResourceEntity()!.resources.money = 9999;
      getResourceEntity()!.resources.population = 100;
      getResourceEntity()!.resources.food = 500;
      getResourceEntity()!.resources.vodka = 200;
      getResourceEntity()!.resources.power = 300;
      getResourceEntity()!.resources.powerUsed = 50;
      await saveSystem.save();

      // Reset and reload
      world.clear();
      createResourceStore();
      createMetaStore();
      const grid2 = new GameGrid();
      const save2 = new SaveSystem(grid2);
      await save2.load();

      expect(getResourceEntity()!.resources.money).toBe(9999);
      expect(getResourceEntity()!.resources.population).toBe(100);
      expect(getResourceEntity()!.resources.food).toBe(500);
      expect(getResourceEntity()!.resources.vodka).toBe(200);
      expect(getResourceEntity()!.resources.power).toBe(300);
      expect(getResourceEntity()!.resources.powerUsed).toBe(50);
    });

    it('restores date', async () => {
      getMetaEntity()!.gameMeta.date = { year: 1995, month: 11, tick: 4 };
      await saveSystem.save();

      world.clear();
      createResourceStore();
      createMetaStore();
      const grid2 = new GameGrid();
      const save2 = new SaveSystem(grid2);
      await save2.load();

      expect(getMetaEntity()!.gameMeta.date).toEqual({ year: 1995, month: 11, tick: 4 });
    });

    it('restores buildings', async () => {
      createBuilding(3, 7, 'collective-farm-hq');
      createBuilding(8, 2, 'power-station');
      buildingsLogic.entities[1]!.building.powered = true;
      await saveSystem.save();

      world.clear();
      createResourceStore();
      createMetaStore();
      const grid2 = new GameGrid();
      const save2 = new SaveSystem(grid2);
      await save2.load();

      expect(buildingsLogic.entities).toHaveLength(2);
      const farm = buildingsLogic.entities.find((e) => e.building.defId === 'collective-farm-hq');
      const plant = buildingsLogic.entities.find((e) => e.building.defId === 'power-station');
      expect(farm).toBeDefined();
      expect(farm!.position.gridX).toBe(3);
      expect(farm!.position.gridY).toBe(7);
      expect(plant).toBeDefined();
      expect(plant!.position.gridX).toBe(8);
      expect(plant!.position.gridY).toBe(2);
      // powered is not restored from save — it's computed by power system
    });

    it('restores grid cell types from buildings', async () => {
      createBuilding(5, 5, 'apartment-tower-a');
      grid.setCell(5, 5, 'apartment-tower-a');
      await saveSystem.save();

      world.clear();
      createResourceStore();
      createMetaStore();
      const grid2 = new GameGrid();
      const save2 = new SaveSystem(grid2);
      await save2.load();

      expect(grid2.getCell(5, 5)!.type).toBe('apartment-tower-a');
    });

    it('restores quota', async () => {
      getMetaEntity()!.gameMeta.quota = {
        type: 'vodka',
        target: 800,
        current: 400,
        deadlineYear: 2000,
      };
      await saveSystem.save();

      world.clear();
      createResourceStore();
      createMetaStore();
      const grid2 = new GameGrid();
      const save2 = new SaveSystem(grid2);
      await save2.load();

      expect(getMetaEntity()!.gameMeta.quota).toEqual({
        type: 'vodka',
        target: 800,
        current: 400,
        deadlineYear: 2000,
      });
    });
  });

  // ── Save/Load cycle integrity ───────────────────────────

  describe('save/load cycle integrity', () => {
    it('round-trips all game state correctly', async () => {
      getResourceEntity()!.resources.money = 3456;
      getResourceEntity()!.resources.population = 77;
      getResourceEntity()!.resources.food = 888;
      getResourceEntity()!.resources.vodka = 123;
      getResourceEntity()!.resources.power = 200;
      getResourceEntity()!.resources.powerUsed = 45;
      getMetaEntity()!.gameMeta.date = { year: 1992, month: 8, tick: 2 };
      getMetaEntity()!.gameMeta.quota = {
        type: 'food',
        target: 1000,
        current: 750,
        deadlineYear: 1997,
      };
      createBuilding(1, 2, 'power-station');
      createBuilding(3, 4, 'apartment-tower-a');
      createBuilding(5, 6, 'collective-farm-hq');
      grid.setCell(1, 2, 'power-station');
      grid.setCell(3, 4, 'apartment-tower-a');
      grid.setCell(5, 6, 'collective-farm-hq');

      await saveSystem.save();

      world.clear();
      createResourceStore();
      createMetaStore();
      const grid2 = new GameGrid();
      const save2 = new SaveSystem(grid2);
      await save2.load();

      // Verify all fields
      expect(getResourceEntity()!.resources.money).toBe(3456);
      expect(getResourceEntity()!.resources.population).toBe(77);
      expect(getResourceEntity()!.resources.food).toBe(888);
      expect(getResourceEntity()!.resources.vodka).toBe(123);
      expect(getResourceEntity()!.resources.power).toBe(200);
      expect(getResourceEntity()!.resources.powerUsed).toBe(45);
      expect(getMetaEntity()!.gameMeta.date).toEqual({ year: 1992, month: 8, tick: 2 });
      expect(getMetaEntity()!.gameMeta.quota).toEqual({
        type: 'food',
        target: 1000,
        current: 750,
        deadlineYear: 1997,
      });
      expect(buildingsLogic.entities).toHaveLength(3);
      expect(grid2.getCell(1, 2)!.type).toBe('power-station');
      expect(grid2.getCell(3, 4)!.type).toBe('apartment-tower-a');
      expect(grid2.getCell(5, 6)!.type).toBe('collective-farm-hq');
    });

    it('loaded state does not share object references with save data', async () => {
      getMetaEntity()!.gameMeta.date = { year: 1985, month: 6, tick: 3 };
      await saveSystem.save();

      world.clear();
      createResourceStore();
      createMetaStore();
      const grid2 = new GameGrid();
      const save2 = new SaveSystem(grid2);
      await save2.load();

      // Modify the loaded state and verify the original is unaffected
      getMetaEntity()!.gameMeta.date.year = 2000;
      // Re-read from DB to confirm the save data is independent
      const row = mockRawDb.prepare('SELECT game_state FROM saves WHERE name = ?').get('autosave') as {
        game_state: string;
      };
      const raw: ExtendedSaveData = JSON.parse(row.game_state);
      expect(raw.gameMeta.date.year).toBe(1985);
    });
  });

  // ── hasSave ─────────────────────────────────────────────

  describe('hasSave', () => {
    it('returns false when no save exists', async () => {
      expect(await saveSystem.hasSave()).toBe(false);
    });

    it('returns true after saving', async () => {
      await saveSystem.save();
      expect(await saveSystem.hasSave()).toBe(true);
    });
  });

  // ── deleteSave ──────────────────────────────────────────

  describe('deleteSave', () => {
    it('removes save data from database', async () => {
      await saveSystem.save();
      expect(await saveSystem.hasSave()).toBe(true);
      await saveSystem.deleteSave();
      expect(await saveSystem.hasSave()).toBe(false);
    });

    it('does not throw if no save exists', async () => {
      await expect(saveSystem.deleteSave()).resolves.not.toThrow();
    });
  });

  // ── autoSave ────────────────────────────────────────────

  describe('autoSave', () => {
    it('sets up a periodic save interval and returns cleanup', () => {
      jest.useFakeTimers();
      const saveSpy = jest.spyOn(saveSystem, 'save');

      const cleanup = saveSystem.startAutoSave();

      expect(saveSpy).not.toHaveBeenCalled();

      jest.advanceTimersByTime(60000);
      expect(saveSpy).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(60000);
      expect(saveSpy).toHaveBeenCalledTimes(2);

      cleanup();
      jest.advanceTimersByTime(60000);
      expect(saveSpy).toHaveBeenCalledTimes(2); // no more calls after cleanup

      jest.useRealTimers();
    });
  });
});
