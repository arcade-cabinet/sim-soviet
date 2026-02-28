/**
 * GameState — subscribe/notify, initGrid, and initial values.
 */
import { GameState } from '../../src/engine/GameState';
import { GRID_SIZE } from '../../src/engine/GridTypes';

function freshState(): GameState {
  const s = new GameState();
  s.initGrid();
  return s;
}

describe('GameState', () => {
  describe('initial values', () => {
    it('starts with 2000 money', () => {
      expect(new GameState().money).toBe(2000);
    });

    it('starts with speed 1', () => {
      expect(new GameState().speed).toBe(1);
    });

    it('starts in year 1917, month 1', () => {
      const s = new GameState();
      expect(s.date.year).toBe(1917);
      expect(s.date.month).toBe(1);
    });

    it('starts with empty buildings', () => {
      expect(new GameState().buildings).toHaveLength(0);
    });

    it('starts with snow weather (winter month 1)', () => {
      expect(new GameState().currentWeather).toBe('snow');
    });
  });

  describe('initGrid', () => {
    it('creates a GRID_SIZE x GRID_SIZE grid', () => {
      const s = freshState();
      expect(s.grid).toHaveLength(GRID_SIZE);
      for (const row of s.grid) {
        expect(row).toHaveLength(GRID_SIZE);
      }
    });

    it('places water tiles forming a river', () => {
      const s = freshState();
      let waterCount = 0;
      for (const row of s.grid) {
        for (const cell of row) {
          if (cell.terrain === 'water') waterCount++;
        }
      }
      // River is ~3 tiles wide × 30 rows ≈ 60-90 water tiles
      expect(waterCount).toBeGreaterThan(30);
      expect(waterCount).toBeLessThan(150);
    });

    it('places a rail row at train y', () => {
      const s = freshState();
      const railY = s.train.y;
      for (let x = 0; x < GRID_SIZE; x++) {
        const cell = s.grid[railY][x];
        // Rail cells unless they're water (bridge points)
        if (cell.terrain !== 'water') {
          expect(cell.terrain).toBe('rail');
        }
        expect(cell.isRail).toBe(true);
      }
    });

    it('places trees randomly on non-water non-rail tiles', () => {
      const s = freshState();
      let treeCount = 0;
      for (const row of s.grid) {
        for (const cell of row) {
          if (cell.terrain === 'tree') treeCount++;
        }
      }
      // ~20% of eligible tiles should be trees
      expect(treeCount).toBeGreaterThan(20);
    });

    it('assigns elevation based on sine-cosine noise', () => {
      const s = freshState();
      let elevated = 0;
      for (const row of s.grid) {
        for (const cell of row) {
          if (cell.z > 0) elevated++;
        }
      }
      expect(elevated).toBeGreaterThan(0);
    });

    it('initializes all cells with zero smog and no fire', () => {
      const s = freshState();
      for (const row of s.grid) {
        for (const cell of row) {
          expect(cell.smog).toBe(0);
          expect(cell.onFire).toBe(0);
        }
      }
    });
  });

  describe('subscribe/notify', () => {
    it('notifies all subscribers', () => {
      const s = new GameState();
      const calls: number[] = [];
      s.subscribe(() => calls.push(1));
      s.subscribe(() => calls.push(2));
      s.notify();
      expect(calls).toEqual([1, 2]);
    });

    it('unsubscribes correctly', () => {
      const s = new GameState();
      const calls: number[] = [];
      const unsub = s.subscribe(() => calls.push(1));
      s.notify();
      expect(calls).toEqual([1]);
      unsub();
      s.notify();
      expect(calls).toEqual([1]); // no additional call
    });
  });
});
