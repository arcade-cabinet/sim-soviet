/**
 * BuildActions — building placement, bulldoze, validation.
 */

import { handleClick } from '../../src/engine/BuildActions';
import { GameState } from '../../src/engine/GameState';
import { GRID_SIZE } from '../../src/engine/GridTypes';

function freshState(): GameState {
  const s = new GameState();
  s.initGrid();
  return s;
}

/** Find a grass tile that's not rail, water, or tree. */
function findGrassTile(s: GameState): { x: number; y: number } {
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const cell = s.grid[y][x];
      if (cell.terrain === 'grass' && !cell.isRail && cell.z === 0) {
        return { x, y };
      }
    }
  }
  throw new Error('No grass tile found');
}

/** Find a water tile. */
function findWaterTile(s: GameState): { x: number; y: number } {
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (s.grid[y][x].terrain === 'water') return { x, y };
    }
  }
  throw new Error('No water tile found');
}

describe('handleClick', () => {
  describe('building placement', () => {
    it('places a power plant on grass', () => {
      const s = freshState();
      s.selectedTool = 'power';
      const { x, y } = findGrassTile(s);
      const startMoney = s.money;

      const result = handleClick(s, x, y);
      expect(result).toBe(true);
      expect(s.grid[y][x].type).toBe('power');
      expect(s.buildings).toHaveLength(1);
      expect(s.buildings[0].type).toBe('power');
      expect(s.money).toBeLessThan(startMoney);
    });

    it('places a road on grass', () => {
      const s = freshState();
      s.selectedTool = 'road';
      const { x, y } = findGrassTile(s);

      const result = handleClick(s, x, y);
      expect(result).toBe(true);
      expect(s.grid[y][x].type).toBe('road');
      // Roads don't create building instances
      expect(s.buildings).toHaveLength(0);
    });

    it('places a pipe on grass', () => {
      const s = freshState();
      s.selectedTool = 'pipe';
      const { x, y } = findGrassTile(s);

      const result = handleClick(s, x, y);
      expect(result).toBe(true);
      expect(s.grid[y][x].hasPipe).toBe(true);
    });

    it('places a zone', () => {
      const s = freshState();
      s.selectedTool = 'zone-res';
      const { x, y } = findGrassTile(s);

      const result = handleClick(s, x, y);
      expect(result).toBe(true);
      expect(s.grid[y][x].zone).toBe('res');
    });

    it('places a pump on water', () => {
      const s = freshState();
      s.selectedTool = 'pump';
      const { x, y } = findWaterTile(s);

      const result = handleClick(s, x, y);
      expect(result).toBe(true);
      expect(s.grid[y][x].type).toBe('pump');
    });
  });

  describe('validation', () => {
    it('rejects out-of-bounds coordinates', () => {
      const s = freshState();
      s.selectedTool = 'power';
      expect(handleClick(s, -1, 0)).toBe(false);
      expect(handleClick(s, 0, GRID_SIZE)).toBe(false);
    });

    it('rejects building on occupied tile', () => {
      const s = freshState();
      s.selectedTool = 'power';
      const { x, y } = findGrassTile(s);
      handleClick(s, x, y);

      s.selectedTool = 'housing';
      expect(handleClick(s, x, y)).toBe(false);
    });

    it('rejects building on water (except pump/road)', () => {
      const s = freshState();
      s.selectedTool = 'power';
      const { x, y } = findWaterTile(s);
      expect(handleClick(s, x, y)).toBe(false);
    });

    it('rejects pump on land', () => {
      const s = freshState();
      s.selectedTool = 'pump';
      const { x, y } = findGrassTile(s);
      expect(handleClick(s, x, y)).toBe(false);
    });

    it('rejects when insufficient funds', () => {
      const s = freshState();
      s.money = 0;
      s.selectedTool = 'power';
      const { x, y } = findGrassTile(s);
      expect(handleClick(s, x, y)).toBe(false);
    });

    it('rejects building on tree tile', () => {
      const s = freshState();
      s.selectedTool = 'housing';
      // Find a tree tile
      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          if (s.grid[y][x].terrain === 'tree') {
            expect(handleClick(s, x, y)).toBe(false);
            return;
          }
        }
      }
    });
  });

  describe('bulldoze', () => {
    it('bulldozes a building', () => {
      const s = freshState();
      const { x, y } = findGrassTile(s);

      // Place first
      s.selectedTool = 'power';
      handleClick(s, x, y);
      expect(s.buildings).toHaveLength(1);

      // Bulldoze
      s.selectedTool = 'bulldoze';
      const result = handleClick(s, x, y);
      expect(result).toBe(true);
      expect(s.grid[y][x].type).toBeNull();
      expect(s.buildings).toHaveLength(0);
    });

    it('bulldozes a tree for 5 rubles', () => {
      const s = freshState();
      s.selectedTool = 'bulldoze';

      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          if (s.grid[y][x].terrain === 'tree') {
            const before = s.money;
            const result = handleClick(s, x, y);
            expect(result).toBe(true);
            expect(s.grid[y][x].terrain).toBe('grass');
            expect(s.money).toBe(before - 5);
            return;
          }
        }
      }
    });

    it('cannot bulldoze water', () => {
      const s = freshState();
      s.selectedTool = 'bulldoze';
      const { x, y } = findWaterTile(s);
      expect(handleClick(s, x, y)).toBe(false);
    });
  });
});
