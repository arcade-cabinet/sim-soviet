/**
 * GameGrid — spatial index for the 30×30 isometric grid.
 *
 * Tracks cell occupancy (which building type occupies each cell).
 * Building entities live in ECS; this grid is purely for spatial queries
 * (footprint checks, placement validation, renderer grid fill).
 */
import { GRID_SIZE } from '../config';

export interface GridCell {
  type: string | null;
  z: number;
}

export class GameGrid {
  private grid: GridCell[][] = [];
  private size: number;

  constructor(size: number = GRID_SIZE) {
    this.size = size;
    for (let y = 0; y < size; y++) {
      const row: GridCell[] = [];
      for (let x = 0; x < size; x++) {
        row.push({ type: null, z: 0 });
      }
      this.grid.push(row);
    }
  }

  public getCell(x: number, y: number): GridCell | null {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return null;
    return this.grid[y]?.[x] ?? null;
  }

  public setCell(x: number, y: number, type: string | null): void {
    const cell = this.getCell(x, y);
    if (cell) {
      cell.type = type;
    }
  }

  /** Reset all grid cells to empty (used before loading a save). */
  public resetGrid(): void {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const cell = this.grid[y]?.[x];
        if (cell) {
          cell.type = null;
          cell.z = 0;
        }
      }
    }
  }
}
