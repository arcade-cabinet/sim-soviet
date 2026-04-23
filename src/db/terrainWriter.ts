/**
 * Pure function that maps terrain tick output to a terrain_tiles DB row.
 * No DB calls — the caller handles the actual insert/upsert.
 */
import type { TerrainTileState } from '../ai/agents/core/terrainTick';

/** Extra context not present in TerrainTileState (coordinates, infrastructure, year). */
export interface TerrainTileContext {
  x: number;
  y: number;
  hasRoad: boolean;
  hasPipe: boolean;
  modifiedYear: number;
}

/** Shape of a terrain_tiles row for insert/upsert (excludes auto-increment id). */
export interface TerrainTileRow {
  x: number;
  y: number;
  terrainType: string;
  fertility: number;
  contamination: number;
  moisture: number;
  forestAge: number;
  erosionLevel: number;
  elevation: number;
  hasRoad: boolean;
  hasPipe: boolean;
  modifiedYear: number;
}

/**
 * Build a terrain_tiles row object from tick output.
 * @param tile - Terrain tile state from tickTerrain()
 * @param ctx - Tile coordinates, infrastructure flags, and current year
 * @returns Row object ready for DB insert/upsert
 */
export function buildTerrainRow(tile: TerrainTileState, ctx: TerrainTileContext): TerrainTileRow {
  return {
    x: ctx.x,
    y: ctx.y,
    terrainType: tile.type,
    fertility: Math.max(0, Math.round(tile.fertility)),
    contamination: Math.max(0, Math.round(tile.contamination)),
    moisture: Math.round(tile.moisture),
    forestAge: Math.round(tile.forestAge),
    erosionLevel: Math.max(0, Math.round(tile.erosionLevel)),
    elevation: Math.round(tile.elevation),
    hasRoad: ctx.hasRoad,
    hasPipe: ctx.hasPipe,
    modifiedYear: ctx.modifiedYear,
  };
}
