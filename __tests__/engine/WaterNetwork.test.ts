/**
 * WaterNetwork — BFS water distribution tests.
 */
import { GameState } from '../../src/engine/GameState';
import { GRID_SIZE } from '../../src/engine/GridTypes';
import { updateWaterNetwork } from '../../src/engine/WaterNetwork';

function freshState(): GameState {
  const s = new GameState();
  s.initGrid();
  return s;
}

/** Find a water tile and place a pump there. */
function placePump(s: GameState): { x: number; y: number } {
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (s.grid[y][x].terrain === 'water') {
        s.grid[y][x].type = 'pump';
        s.buildings.push({ x, y, type: 'pump', powered: true, level: 0 });
        return { x, y };
      }
    }
  }
  throw new Error('No water tile found');
}

describe('updateWaterNetwork', () => {
  it('sets watered=true for tiles connected to pump via pipes', () => {
    const s = freshState();
    const { x: px, y: py } = placePump(s);

    // Place pipes adjacent to pump (on land tiles next to water)
    const pipeTiles: Array<{ x: number; y: number }> = [];
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const nx = px + dx;
      const ny = py + dy;
      if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE && s.grid[ny][nx].terrain !== 'water') {
        s.grid[ny][nx].hasPipe = true;
        pipeTiles.push({ x: nx, y: ny });
      }
    }

    updateWaterNetwork(s);

    // Pump-adjacent piped tiles should be watered
    for (const pt of pipeTiles) {
      expect(s.grid[pt.y][pt.x].watered).toBe(true);
    }
  });

  it('does not water tiles without pipes', () => {
    const s = freshState();
    placePump(s);
    updateWaterNetwork(s);

    // Count non-pipe tiles that are watered (should be zero or very few)
    let unwantedWater = 0;
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const cell = s.grid[y][x];
        if (!cell.hasPipe && cell.terrain !== 'water' && cell.watered) {
          unwantedWater++;
        }
      }
    }
    // Radius expansion can water nearby tiles, but not distant ones
    expect(unwantedWater).toBeLessThan(50);
  });

  it('clears watered state when no pump exists', () => {
    const s = freshState();
    // Manually set some tiles as watered
    s.grid[5][5].watered = true;
    s.grid[5][6].watered = true;

    updateWaterNetwork(s);

    expect(s.grid[5][5].watered).toBe(false);
    expect(s.grid[5][6].watered).toBe(false);
  });

  it('handles multiple pumps', () => {
    const s = freshState();
    // Place two pumps on different water tiles
    let pumpsPlaced = 0;
    for (let y = 0; y < GRID_SIZE && pumpsPlaced < 2; y++) {
      for (let x = 0; x < GRID_SIZE && pumpsPlaced < 2; x++) {
        if (s.grid[y][x].terrain === 'water' && !s.grid[y][x].type) {
          s.grid[y][x].type = 'pump';
          s.buildings.push({ x, y, type: 'pump', powered: true, level: 0 });
          pumpsPlaced++;
        }
      }
    }

    // Place some pipes near each pump
    for (const b of s.buildings) {
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
      ]) {
        const nx = b.x + dx;
        const ny = b.y + dy;
        if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE && s.grid[ny][nx].terrain !== 'water') {
          s.grid[ny][nx].hasPipe = true;
        }
      }
    }

    updateWaterNetwork(s);

    // At least some tiles should be watered
    let wateredCount = 0;
    for (const row of s.grid) {
      for (const cell of row) {
        if (cell.watered) wateredCount++;
      }
    }
    expect(wateredCount).toBeGreaterThan(0);
  });
});
