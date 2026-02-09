import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameState } from '../game/GameState';
import { type SaveData, SaveSystem } from '../game/SaveSystem';

describe('SaveSystem', () => {
  let gs: GameState;
  let saveSystem: SaveSystem;

  // happy-dom provides localStorage, but let's ensure clean state
  beforeEach(() => {
    localStorage.clear();
    gs = new GameState();
    saveSystem = new SaveSystem(gs);
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
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
      gs.money = 5000;
      gs.pop = 42;
      gs.food = 300;
      gs.vodka = 75;
      gs.power = 100;
      gs.powerUsed = 25;

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
      gs.date = { year: 1990, month: 6, tick: 3 };
      await saveSystem.save();
      const data: SaveData = JSON.parse(localStorage.getItem('simsoviet_save_v1')!);
      expect(data.date).toEqual({ year: 1990, month: 6, tick: 3 });
    });

    it('saves buildings correctly', async () => {
      gs.addBuilding(5, 10, 'housing');
      gs.buildings[0]!.powered = true;

      await saveSystem.save();
      const data: SaveData = JSON.parse(localStorage.getItem('simsoviet_save_v1')!);

      expect(data.buildings).toHaveLength(1);
      expect(data.buildings[0]).toEqual({
        x: 5,
        y: 10,
        type: 'housing',
        powered: true,
      });
    });

    it('saves quota information', async () => {
      gs.quota = { type: 'vodka', target: 300, current: 150, deadlineYear: 1990 };
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
      // Create a new GameState to load into
      gs = new GameState();
      saveSystem = new SaveSystem(gs);
      expect(await saveSystem.load()).toBe(true);
    });

    it('restores all resource values', async () => {
      gs.money = 9999;
      gs.pop = 100;
      gs.food = 500;
      gs.vodka = 200;
      gs.power = 300;
      gs.powerUsed = 50;
      await saveSystem.save();

      // Reset and reload
      const gs2 = new GameState();
      const save2 = new SaveSystem(gs2);
      await save2.load();

      expect(gs2.money).toBe(9999);
      expect(gs2.pop).toBe(100);
      expect(gs2.food).toBe(500);
      expect(gs2.vodka).toBe(200);
      expect(gs2.power).toBe(300);
      expect(gs2.powerUsed).toBe(50);
    });

    it('restores date', async () => {
      gs.date = { year: 1995, month: 11, tick: 4 };
      await saveSystem.save();

      const gs2 = new GameState();
      const save2 = new SaveSystem(gs2);
      await save2.load();

      expect(gs2.date).toEqual({ year: 1995, month: 11, tick: 4 });
    });

    it('restores buildings', async () => {
      gs.addBuilding(3, 7, 'farm');
      gs.addBuilding(8, 2, 'power');
      gs.buildings[1]!.powered = true;
      await saveSystem.save();

      const gs2 = new GameState();
      const save2 = new SaveSystem(gs2);
      await save2.load();

      expect(gs2.buildings).toHaveLength(2);
      expect(gs2.buildings[0]).toEqual({ x: 3, y: 7, type: 'farm', powered: false });
      expect(gs2.buildings[1]).toEqual({ x: 8, y: 2, type: 'power', powered: true });
    });

    it('restores grid cell types from buildings', async () => {
      gs.addBuilding(5, 5, 'housing');
      gs.setCell(5, 5, 'housing');
      await saveSystem.save();

      const gs2 = new GameState();
      const save2 = new SaveSystem(gs2);
      await save2.load();

      expect(gs2.getCell(5, 5)!.type).toBe('housing');
    });

    it('restores quota', async () => {
      gs.quota = { type: 'vodka', target: 800, current: 400, deadlineYear: 2000 };
      await saveSystem.save();

      const gs2 = new GameState();
      const save2 = new SaveSystem(gs2);
      await save2.load();

      expect(gs2.quota).toEqual({
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
      gs.money = 3456;
      gs.pop = 77;
      gs.food = 888;
      gs.vodka = 123;
      gs.power = 200;
      gs.powerUsed = 45;
      gs.date = { year: 1992, month: 8, tick: 2 };
      gs.quota = { type: 'food', target: 1000, current: 750, deadlineYear: 1997 };
      gs.addBuilding(1, 2, 'power');
      gs.addBuilding(3, 4, 'housing');
      gs.addBuilding(5, 6, 'farm');
      gs.setCell(1, 2, 'power');
      gs.setCell(3, 4, 'housing');
      gs.setCell(5, 6, 'farm');

      await saveSystem.save();

      const gs2 = new GameState();
      const save2 = new SaveSystem(gs2);
      await save2.load();

      // Verify all fields
      expect(gs2.money).toBe(3456);
      expect(gs2.pop).toBe(77);
      expect(gs2.food).toBe(888);
      expect(gs2.vodka).toBe(123);
      expect(gs2.power).toBe(200);
      expect(gs2.powerUsed).toBe(45);
      expect(gs2.date).toEqual({ year: 1992, month: 8, tick: 2 });
      expect(gs2.quota).toEqual({ type: 'food', target: 1000, current: 750, deadlineYear: 1997 });
      expect(gs2.buildings).toHaveLength(3);
      expect(gs2.getCell(1, 2)!.type).toBe('power');
      expect(gs2.getCell(3, 4)!.type).toBe('housing');
      expect(gs2.getCell(5, 6)!.type).toBe('farm');
    });

    it('loaded state does not share object references with save data', async () => {
      gs.date = { year: 1985, month: 6, tick: 3 };
      await saveSystem.save();

      const gs2 = new GameState();
      const save2 = new SaveSystem(gs2);
      await save2.load();

      // Modify the loaded state and verify the original is unaffected
      gs2.date.year = 2000;
      expect(gs.date.year).toBe(1985);
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
