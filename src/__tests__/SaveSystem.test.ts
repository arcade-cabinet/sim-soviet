import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildingsLogic, getMetaEntity, getResourceEntity } from '../ecs/archetypes';
import { createBuilding, createMetaStore, createResourceStore } from '../ecs/factories';
import { world } from '../ecs/world';
import { GameGrid } from '../game/GameGrid';
import { type SaveData, SaveSystem } from '../game/SaveSystem';

describe('SaveSystem', () => {
  let grid: GameGrid;
  let saveSystem: SaveSystem;

  // happy-dom provides localStorage, but let's ensure clean state
  beforeEach(() => {
    world.clear();
    localStorage.clear();
    grid = new GameGrid();
    createResourceStore();
    createMetaStore();
    saveSystem = new SaveSystem(grid);
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    world.clear();
  });

  // ── Save ────────────────────────────────────────────────

  describe('save', () => {
    it('returns true on successful save', async () => {
      expect(await saveSystem.save()).toBe(true);
    });

    it('stores data in localStorage under the correct key', async () => {
      await saveSystem.save();
      const raw = localStorage.getItem('simsoviet_save_v1');
      expect(raw).not.toBeNull();
    });

    it('stores valid JSON', async () => {
      await saveSystem.save();
      const raw = localStorage.getItem('simsoviet_save_v1')!;
      expect(() => JSON.parse(raw)).not.toThrow();
    });

    it('saves all resource fields', async () => {
      getResourceEntity()!.resources.money = 5000;
      getResourceEntity()!.resources.population = 42;
      getResourceEntity()!.resources.food = 300;
      getResourceEntity()!.resources.vodka = 75;
      getResourceEntity()!.resources.power = 100;
      getResourceEntity()!.resources.powerUsed = 25;

      await saveSystem.save();
      const data: SaveData = JSON.parse(localStorage.getItem('simsoviet_save_v1')!);

      expect(data.money).toBe(5000);
      expect(data.pop).toBe(42);
      expect(data.food).toBe(300);
      expect(data.vodka).toBe(75);
      expect(data.power).toBe(100);
      expect(data.powerUsed).toBe(25);
    });

    it('saves date information', async () => {
      getMetaEntity()!.gameMeta.date = { year: 1990, month: 6, tick: 3 };
      await saveSystem.save();
      const data: SaveData = JSON.parse(localStorage.getItem('simsoviet_save_v1')!);
      expect(data.date).toEqual({ year: 1990, month: 6, tick: 3 });
    });

    it('saves buildings correctly', async () => {
      createBuilding(5, 10, 'apartment-tower-a');
      buildingsLogic.entities[0]!.building.powered = true;

      await saveSystem.save();
      const data: SaveData = JSON.parse(localStorage.getItem('simsoviet_save_v1')!);

      expect(data.buildings).toHaveLength(1);
      expect(data.buildings[0]).toEqual({
        x: 5,
        y: 10,
        defId: 'apartment-tower-a',
        powered: true,
      });
    });

    it('saves quota information', async () => {
      getMetaEntity()!.gameMeta.quota = {
        type: 'vodka',
        target: 300,
        current: 150,
        deadlineYear: 1990,
      };
      await saveSystem.save();
      const data: SaveData = JSON.parse(localStorage.getItem('simsoviet_save_v1')!);
      expect(data.quota).toEqual({
        type: 'vodka',
        target: 300,
        current: 150,
        deadlineYear: 1990,
      });
    });

    it('includes version and timestamp', async () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);
      await saveSystem.save();
      const data: SaveData = JSON.parse(localStorage.getItem('simsoviet_save_v1')!);
      expect(data.version).toBe('1.0.0');
      expect(data.timestamp).toBe(now);
    });
  });

  describe('save error handling', () => {
    it('returns false when JSON.stringify throws', async () => {
      // Mock JSON.stringify to simulate a serialization failure
      vi.spyOn(JSON, 'stringify').mockImplementation(() => {
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

    it('returns false on corrupt JSON', async () => {
      localStorage.setItem('simsoviet_save_v1', '{not valid json');
      expect(await saveSystem.load()).toBe(false);
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
      // The original date was saved as { year: 1985 } — it lives in localStorage,
      // so re-reading should still produce the original value
      const raw = JSON.parse(localStorage.getItem('simsoviet_save_v1')!);
      expect(raw.date.year).toBe(1985);
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
    it('removes save data from localStorage', async () => {
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
      vi.useFakeTimers();
      const saveSpy = vi.spyOn(saveSystem, 'save');

      const cleanup = saveSystem.startAutoSave();

      expect(saveSpy).not.toHaveBeenCalled();

      vi.advanceTimersByTime(60000);
      expect(saveSpy).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(60000);
      expect(saveSpy).toHaveBeenCalledTimes(2);

      cleanup();
      vi.advanceTimersByTime(60000);
      expect(saveSpy).toHaveBeenCalledTimes(2); // no more calls after cleanup

      vi.useRealTimers();
    });
  });
});
