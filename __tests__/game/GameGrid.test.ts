import { GRID_SIZE } from '../../src/config';
import { GameGrid } from '../../src/game/GameGrid';

describe('GameGrid', () => {
  let grid: GameGrid;

  beforeEach(() => {
    grid = new GameGrid();
  });

  // ── Grid initialization ──────────────────────────────────

  describe('grid initialization', () => {
    it('all cells start as null type with z = 0', () => {
      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          const cell = grid.getCell(x, y)!;
          expect(cell.type).toBeNull();
          expect(cell.z).toBe(0);
        }
      }
    });
  });

  // ── getCell ─────────────────────────────────────────────

  describe('getCell', () => {
    it('returns the cell at valid coordinates', () => {
      const cell = grid.getCell(0, 0);
      expect(cell).not.toBeNull();
      expect(cell!.type).toBeNull();
    });

    it('returns the cell at max boundary', () => {
      const cell = grid.getCell(GRID_SIZE - 1, GRID_SIZE - 1);
      expect(cell).not.toBeNull();
    });

    it('returns null for negative x', () => {
      expect(grid.getCell(-1, 0)).toBeNull();
    });

    it('returns null for negative y', () => {
      expect(grid.getCell(0, -1)).toBeNull();
    });

    it('returns null for x >= GRID_SIZE', () => {
      expect(grid.getCell(GRID_SIZE, 0)).toBeNull();
    });

    it('returns null for y >= GRID_SIZE', () => {
      expect(grid.getCell(0, GRID_SIZE)).toBeNull();
    });

    it('returns null for both coordinates out of bounds', () => {
      expect(grid.getCell(-5, -5)).toBeNull();
      expect(grid.getCell(GRID_SIZE + 10, GRID_SIZE + 10)).toBeNull();
    });

    it('returns a reference to the actual grid cell (not a copy)', () => {
      const cell = grid.getCell(5, 5);
      cell!.type = 'road';
      expect(grid.getCell(5, 5)!.type).toBe('road');
    });
  });

  // ── setCell ─────────────────────────────────────────────

  describe('setCell', () => {
    it('sets cell type at valid coordinates', () => {
      grid.setCell(3, 4, 'apartment-tower-a');
      expect(grid.getCell(3, 4)!.type).toBe('apartment-tower-a');
    });

    it('can set cell type to null (clearing)', () => {
      grid.setCell(3, 4, 'apartment-tower-a');
      grid.setCell(3, 4, null);
      expect(grid.getCell(3, 4)!.type).toBeNull();
    });

    it('does not throw for out-of-bounds coordinates', () => {
      expect(() => grid.setCell(-1, -1, 'road')).not.toThrow();
      expect(() => grid.setCell(GRID_SIZE, GRID_SIZE, 'road')).not.toThrow();
    });

    it('does not modify anything for out-of-bounds coordinates', () => {
      // Verify a known cell is still null
      grid.setCell(-1, 0, 'road');
      grid.setCell(0, GRID_SIZE, 'road');
      expect(grid.getCell(0, 0)!.type).toBeNull();
    });

    it('overwrites existing cell type', () => {
      grid.setCell(10, 10, 'road');
      grid.setCell(10, 10, 'power-station');
      expect(grid.getCell(10, 10)!.type).toBe('power-station');
    });
  });

  // ── resetGrid ─────────────────────────────────────────

  describe('resetGrid', () => {
    it('clears all cells back to null', () => {
      grid.setCell(5, 5, 'power-station');
      grid.setCell(10, 10, 'apartment-tower-a');
      grid.resetGrid();
      expect(grid.getCell(5, 5)!.type).toBeNull();
      expect(grid.getCell(10, 10)!.type).toBeNull();
    });
  });
});
