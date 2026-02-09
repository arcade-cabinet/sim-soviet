import { beforeEach, describe, expect, it } from 'vitest';
import { GRID_SIZE } from '../config';
import { GameState } from '../game/GameState';

describe('GameState', () => {
  let gs: GameState;

  beforeEach(() => {
    gs = new GameState();
  });

  // ── Initialization ──────────────────────────────────────

  describe('initialization', () => {
    it('starts with default resource values', () => {
      expect(gs.money).toBe(2000);
      expect(gs.pop).toBe(0);
      expect(gs.food).toBe(200);
      expect(gs.vodka).toBe(50);
      expect(gs.power).toBe(0);
      expect(gs.powerUsed).toBe(0);
    });

    it('starts in October 1922 at tick 0', () => {
      expect(gs.date).toEqual({ year: 1922, month: 10, tick: 0 });
    });

    it('starts with no buildings', () => {
      expect(gs.buildings).toHaveLength(0);
    });

    it('starts with "none" as the selected tool', () => {
      expect(gs.selectedTool).toBe('none');
    });

    it('starts with default quota targeting food', () => {
      expect(gs.quota).toEqual({
        type: 'food',
        target: 500,
        current: 0,
        deadlineYear: 1927,
      });
    });

    it('initializes an empty snow particle array', () => {
      expect(gs.snow).toEqual([]);
    });
  });

  // ── Grid ────────────────────────────────────────────────

  describe('grid initialization', () => {
    it(`creates a ${GRID_SIZE}x${GRID_SIZE} grid`, () => {
      expect(gs.grid).toHaveLength(GRID_SIZE);
      for (const row of gs.grid) {
        expect(row).toHaveLength(GRID_SIZE);
      }
    });

    it('all cells start as null type with z = 0', () => {
      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          const cell = gs.grid[y]![x]!;
          expect(cell.type).toBeNull();
          expect(cell.z).toBe(0);
        }
      }
    });
  });

  // ── getCell ─────────────────────────────────────────────

  describe('getCell', () => {
    it('returns the cell at valid coordinates', () => {
      const cell = gs.getCell(0, 0);
      expect(cell).not.toBeNull();
      expect(cell!.type).toBeNull();
    });

    it('returns the cell at max boundary', () => {
      const cell = gs.getCell(GRID_SIZE - 1, GRID_SIZE - 1);
      expect(cell).not.toBeNull();
    });

    it('returns null for negative x', () => {
      expect(gs.getCell(-1, 0)).toBeNull();
    });

    it('returns null for negative y', () => {
      expect(gs.getCell(0, -1)).toBeNull();
    });

    it('returns null for x >= GRID_SIZE', () => {
      expect(gs.getCell(GRID_SIZE, 0)).toBeNull();
    });

    it('returns null for y >= GRID_SIZE', () => {
      expect(gs.getCell(0, GRID_SIZE)).toBeNull();
    });

    it('returns null for both coordinates out of bounds', () => {
      expect(gs.getCell(-5, -5)).toBeNull();
      expect(gs.getCell(GRID_SIZE + 10, GRID_SIZE + 10)).toBeNull();
    });

    it('returns a reference to the actual grid cell (not a copy)', () => {
      const cell = gs.getCell(5, 5);
      cell!.type = 'road';
      expect(gs.grid[5]![5]!.type).toBe('road');
    });
  });

  // ── setCell ─────────────────────────────────────────────

  describe('setCell', () => {
    it('sets cell type at valid coordinates', () => {
      gs.setCell(3, 4, 'apartment-tower-a');
      expect(gs.getCell(3, 4)!.type).toBe('apartment-tower-a');
    });

    it('can set cell type to null (clearing)', () => {
      gs.setCell(3, 4, 'apartment-tower-a');
      gs.setCell(3, 4, null);
      expect(gs.getCell(3, 4)!.type).toBeNull();
    });

    it('does not throw for out-of-bounds coordinates', () => {
      expect(() => gs.setCell(-1, -1, 'road')).not.toThrow();
      expect(() => gs.setCell(GRID_SIZE, GRID_SIZE, 'road')).not.toThrow();
    });

    it('does not modify anything for out-of-bounds coordinates', () => {
      const snapshot = JSON.stringify(gs.grid);
      gs.setCell(-1, 0, 'road');
      gs.setCell(0, GRID_SIZE, 'road');
      expect(JSON.stringify(gs.grid)).toBe(snapshot);
    });

    it('overwrites existing cell type', () => {
      gs.setCell(10, 10, 'road');
      gs.setCell(10, 10, 'power-station');
      expect(gs.getCell(10, 10)!.type).toBe('power-station');
    });
  });

  // ── addBuilding ─────────────────────────────────────────

  describe('addBuilding', () => {
    it('adds a building and returns it', () => {
      const building = gs.addBuilding(5, 5, 'apartment-tower-a');
      expect(building).toEqual({ x: 5, y: 5, defId: 'apartment-tower-a', powered: false });
    });

    it('adds the building to the buildings array', () => {
      gs.addBuilding(5, 5, 'apartment-tower-a');
      expect(gs.buildings).toHaveLength(1);
      expect(gs.buildings[0]!.defId).toBe('apartment-tower-a');
    });

    it('new buildings start unpowered', () => {
      const building = gs.addBuilding(5, 5, 'power-station');
      expect(building.powered).toBe(false);
    });

    it('allows multiple buildings at different positions', () => {
      gs.addBuilding(0, 0, 'apartment-tower-a');
      gs.addBuilding(1, 1, 'collective-farm-hq');
      gs.addBuilding(2, 2, 'power-station');
      expect(gs.buildings).toHaveLength(3);
    });

    it('prevents duplicate placement at the same coordinates', () => {
      gs.addBuilding(5, 5, 'apartment-tower-a');
      const dup = gs.addBuilding(5, 5, 'collective-farm-hq');
      expect(gs.buildings).toHaveLength(1);
      // Returns the existing building instead of creating a new one
      expect(dup.defId).toBe('apartment-tower-a');
    });
  });

  // ── removeBuilding ──────────────────────────────────────

  describe('removeBuilding', () => {
    it('removes the building at the specified position', () => {
      gs.addBuilding(5, 5, 'apartment-tower-a');
      gs.removeBuilding(5, 5);
      expect(gs.buildings).toHaveLength(0);
    });

    it('does not remove buildings at other positions', () => {
      gs.addBuilding(5, 5, 'apartment-tower-a');
      gs.addBuilding(6, 6, 'collective-farm-hq');
      gs.removeBuilding(5, 5);
      expect(gs.buildings).toHaveLength(1);
      expect(gs.buildings[0]!.defId).toBe('collective-farm-hq');
    });

    it('does nothing when no building exists at the position', () => {
      gs.addBuilding(5, 5, 'apartment-tower-a');
      gs.removeBuilding(10, 10);
      expect(gs.buildings).toHaveLength(1);
    });

    it('removes the building even when addBuilding was called twice at same position', () => {
      gs.addBuilding(5, 5, 'apartment-tower-a');
      gs.addBuilding(5, 5, 'collective-farm-hq'); // duplicate is ignored
      gs.removeBuilding(5, 5);
      expect(gs.buildings).toHaveLength(0);
    });
  });

  // ── getBuildingAt ───────────────────────────────────────

  describe('getBuildingAt', () => {
    it('returns the building at the given position', () => {
      gs.addBuilding(7, 8, 'vodka-distillery');
      const found = gs.getBuildingAt(7, 8);
      expect(found).not.toBeNull();
      expect(found!.defId).toBe('vodka-distillery');
    });

    it('returns null when no building exists at position', () => {
      expect(gs.getBuildingAt(0, 0)).toBeNull();
    });

    it('returns the existing building when duplicate placement is attempted', () => {
      gs.addBuilding(3, 3, 'apartment-tower-a');
      gs.addBuilding(3, 3, 'collective-farm-hq'); // duplicate is ignored, returns existing
      const found = gs.getBuildingAt(3, 3);
      expect(found).not.toBeNull();
      expect(found!.defId).toBe('apartment-tower-a');
    });

    it('returns null after building is removed', () => {
      gs.addBuilding(2, 2, 'power-station');
      gs.removeBuilding(2, 2);
      expect(gs.getBuildingAt(2, 2)).toBeNull();
    });
  });
});
