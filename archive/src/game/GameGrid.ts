/**
 * GameGrid — spatial index for the 30x30 isometric grid.
 *
 * Tracks cell occupancy (which building type occupies each cell).
 * Building entities live in ECS; this grid is purely for spatial queries
 * (footprint checks, placement validation, renderer grid fill).
 *
 * Optionally backed by a MapSystem for terrain passability checks.
 * When a MapSystem is set, `isPassable()` delegates to its `isBuildable()`.
 */
import { GRID_SIZE } from '../config';
import type { MapSystem } from './map';

export interface GridCell {
  type: string | null;
  z: number;
}

export class GameGrid {
  private grid: GridCell[][] = [];
  private size: number;
  private mapSystem: MapSystem | null = null;

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

  /**
   * Attach a MapSystem for terrain-aware passability checks.
   * When set, `isPassable()` will reject cells that the MapSystem
   * marks as non-buildable (mountains, rivers, forests, water).
   */
  public setMapSystem(map: MapSystem): void {
    this.mapSystem = map;
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

  /**
   * Check whether a cell is passable for building placement.
   *
   * Returns false if:
   * - The position is out of bounds
   * - A MapSystem is attached and the terrain is non-buildable
   *   (mountains, rivers, forests, water)
   *
   * Without a MapSystem, all in-bounds cells are considered passable
   * (backwards compatible with existing code).
   */
  public isPassable(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return false;
    if (this.mapSystem) {
      return this.mapSystem.isBuildable(x, y);
    }
    return true;
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
