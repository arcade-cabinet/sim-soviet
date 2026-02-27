/**
 * Grid constants, terrain types, and cell/point interfaces.
 * Faithful port of poc.html lines 309-312, 480-502.
 */

export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;
export const GRID_SIZE = 30;
export const TICKS_PER_MONTH = 15;

export type TerrainType =
  | 'grass'
  | 'water'
  | 'rail'
  | 'tree'
  | 'crater'
  | 'irradiated';

export interface GridCell {
  type: string | null;
  zone: string | null;
  z: number;
  terrain: TerrainType;
  isRail: boolean;
  bridge: boolean;
  smog: number;
  onFire: number;
  hasPipe: boolean;
  watered: boolean;
}

export interface GridPoint {
  x: number;
  y: number;
}
