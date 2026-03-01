/**
 * Grid constants, terrain types, and cell/point interfaces.
 * Faithful port of poc.html lines 309-312, 480-502.
 */

/** Isometric tile width in pixels (legacy 2D canvas). */
export const TILE_WIDTH = 64;

/** Isometric tile height in pixels (legacy 2D canvas). */
export const TILE_HEIGHT = 32;

/** Grid dimension (30x30 square grid). Default value — use currentGridSize for runtime. */
export const GRID_SIZE = 30;

/**
 * Mutable runtime grid size — set during game init based on map size selection.
 * Scene components should read this instead of the constant GRID_SIZE.
 */
let _currentGridSize = GRID_SIZE;

/** Get the current runtime grid size (set during game init). */
export function getCurrentGridSize(): number {
  return _currentGridSize;
}

/** Set the runtime grid size. Called by GameInit before creating the grid. */
export function setCurrentGridSize(size: number): void {
  _currentGridSize = size;
}

/** Number of simulation ticks per in-game month. */
export const TICKS_PER_MONTH = 15;

/** All possible terrain types a grid cell can have. */
export type TerrainType = 'grass' | 'water' | 'rail' | 'tree' | 'crater' | 'irradiated' | 'mountain' | 'marsh' | 'path';

/** State of a single cell in the 30x30 legacy grid. */
export interface GridCell {
  /** Building type placed here, or null if empty */
  type: string | null;
  /** Zoning designation ('res', 'ind', 'farm'), or null */
  zone: string | null;
  /** Elevation level (0 = flat, 1 = hill, 2 = mountain) */
  z: number;
  /** Terrain type */
  terrain: TerrainType;
  /** Whether this cell is on the railway row */
  isRail: boolean;
  /** Whether this cell has a bridge over water */
  bridge: boolean;
  /** Pollution/smog level (0 = clean) */
  smog: number;
  /** Fire intensity (0 = not burning, increases each month while active) */
  onFire: number;
  /** Whether an underground water pipe passes through this cell */
  hasPipe: boolean;
  /** Whether this cell receives water from the pipe network */
  watered: boolean;
}

/** A 2D grid coordinate. */
export interface GridPoint {
  /** Column index */
  x: number;
  /** Row index */
  y: number;
}
