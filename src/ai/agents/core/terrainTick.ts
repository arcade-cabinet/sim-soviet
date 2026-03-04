/**
 * Per-tile terrain tick — runs yearly, not per-tick.
 * Only active tiles (erosion > 0, contamination > 0, forest growing) compute.
 * Dormant tiles skip entirely.
 */

export interface TerrainTileState {
  type: string;
  fertility: number;
  contamination: number;
  moisture: number;
  forestAge: number;
  erosionLevel: number;
  elevation: number;
}

export interface YearlyTerrainContext {
  rainfall: number;          // 0-1
  globalWarmingRate: number;  // 0+ (Freeform only)
}

/**
 * Compute one year of terrain evolution. Pure function.
 */
export function tickTerrain(tile: TerrainTileState, ctx: YearlyTerrainContext): TerrainTileState {
  const isDeforested = tile.type !== 'forest' && tile.type !== 'marsh' && tile.type !== 'water' && tile.type !== 'mountain';

  // Erosion increases on deforested land with rainfall
  const erosion = tile.erosionLevel + (isDeforested && tile.erosionLevel > 0 ? ctx.rainfall * 0.1 : 0);

  // Fertility degrades from erosion and contamination
  const fertility = Math.max(
    0,
    tile.fertility - erosion * 0.01 - tile.contamination * 0.05,
  );

  // Forest aging
  const forestAge = tile.type === 'forest' ? tile.forestAge + 1 : 0;

  // Contamination slow decay (half-life ~50 years)
  const contamination = Math.max(0, tile.contamination * 0.986);

  return {
    type: tile.type,
    fertility,
    contamination,
    moisture: tile.moisture,
    forestAge,
    erosionLevel: Math.min(100, erosion),
    elevation: tile.elevation,
  };
}

/**
 * Check if a tile needs yearly computation (active process running).
 * Dormant tiles can skip entirely.
 */
export function isTileActive(tile: TerrainTileState): boolean {
  return tile.erosionLevel > 0 || tile.contamination > 0 || tile.type === 'forest';
}
