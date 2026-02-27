/**
 * Water network BFS algorithm.
 * Faithful port of poc.html lines 581-615.
 */

import { GRID_SIZE } from './GridTypes';
import type { GameState } from './GameState';

export function updateWaterNetwork(state: GameState): void {
  // Reset all watered flags
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      state.grid[y][x].watered = false;
    }
  }

  // Find all working pumps
  const pumps = state.buildings.filter(
    (b) => b.type === 'pump' && state.grid[b.y][b.x].onFire === 0
  );

  // BFS from pump locations along pipes
  const queue: { x: number; y: number; dist: number }[] = [];
  pumps.forEach((p) => {
    queue.push({ x: p.x, y: p.y, dist: 0 });
    state.grid[p.y][p.x].watered = true;
  });

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const dirs = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];
    dirs.forEach((d) => {
      const nx = curr.x + d.x;
      const ny = curr.y + d.y;
      if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
        const cell = state.grid[ny][nx];
        if (cell.hasPipe && !cell.watered) {
          cell.watered = true;
          queue.push({ x: nx, y: ny, dist: curr.dist + 1 });
        }
      }
    });
  }

  // Expand watered area: any cell within radius 3 of a pipe-watered cell becomes watered
  const waterGridCopy: boolean[][] = Array(GRID_SIZE)
    .fill(0)
    .map(() => Array(GRID_SIZE).fill(false));

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (state.grid[y][x].watered) {
        for (let dy = -3; dy <= 3; dy++) {
          for (let dx = -3; dx <= 3; dx++) {
            if (Math.hypot(dx, dy) <= 3) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
                waterGridCopy[ny][nx] = true;
              }
            }
          }
        }
      }
    }
  }

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      state.grid[y][x].watered = waterGridCopy[y][x];
    }
  }
}
