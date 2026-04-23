/**
 * Terrain processes: deforestation, erosion, and recovery.
 * All pure functions — take a tile state, return updated tile state.
 */

import type { TerrainTileState } from './terrainTick';

/** Tile types immune to deforestation (not forest). */
const _NON_DEFORESTABLE = new Set(['grassland', 'cleared', 'water', 'marsh', 'mountain', 'tundra']);

/** Tile types immune to erosion. */
const EROSION_IMMUNE = new Set(['forest', 'water', 'marsh', 'mountain']);

/** Tile types that can regrow forest. */
const REGROWABLE = new Set(['cleared']);

/**
 * Deforestation: buildings near forests reduce forestAge by 1-3 per year.
 * When forestAge reaches 0, tile type changes to 'cleared'.
 *
 * @param tile - Current tile state
 * @param nearbyBuildingCount - Number of buildings adjacent to this tile
 * @returns Updated tile state
 */
export function deforest(tile: TerrainTileState, nearbyBuildingCount: number): TerrainTileState {
  if (tile.type !== 'forest' || nearbyBuildingCount <= 0) {
    return { ...tile };
  }

  const reduction = Math.min(nearbyBuildingCount, 3);
  const newForestAge = Math.max(0, tile.forestAge - reduction);
  const newType = newForestAge <= 0 ? 'cleared' : 'forest';

  return {
    ...tile,
    forestAge: newForestAge,
    type: newType,
  };
}

/**
 * Erosion: continuous farming reduces fertility by 0.5-1% per year.
 * Rate scales with years farmed: base 0.5% + 0.05% per year, capped at 1%.
 *
 * @param tile - Current tile state
 * @param yearsFarmed - Consecutive years this tile has been farmed
 * @returns Updated tile state
 */
export function erode(tile: TerrainTileState, yearsFarmed: number): TerrainTileState {
  if (EROSION_IMMUNE.has(tile.type) || yearsFarmed <= 0) {
    return { ...tile };
  }

  // Rate: 0.5% base + 0.05% per year farmed, capped at 1%
  const rate = Math.min(0.5 + yearsFarmed * 0.05, 1.0) / 100;
  const fertilityLoss = tile.fertility * rate;
  const newFertility = Math.max(0, tile.fertility - fertilityLoss);

  // Erosion level increases proportionally
  const erosionIncrease = rate * 10;
  const newErosion = Math.min(100, tile.erosionLevel + erosionIncrease);

  return {
    ...tile,
    fertility: newFertility,
    erosionLevel: newErosion,
  };
}

/**
 * Recovery: abandoned tiles regain fertility (+0.3%/year) and forest regrowth (+1 forestAge/year).
 * Cleared tiles convert back to forest when forestAge > 0.
 *
 * @param tile - Current tile state
 * @param yearsAbandoned - Years since this tile was last farmed or used
 * @returns Updated tile state
 */
export function recover(tile: TerrainTileState, yearsAbandoned: number): TerrainTileState {
  if (yearsAbandoned <= 0) {
    return { ...tile };
  }

  // Fertility recovery: +0.3 per year abandoned (absolute, not percentage of current)
  const fertilityGain = 0.3 * yearsAbandoned;
  const newFertility = Math.min(100, tile.fertility + fertilityGain);

  // Erosion recovery: reduce erosion over time
  const erosionReduction = 0.5 * yearsAbandoned;
  const newErosion = Math.max(0, tile.erosionLevel - erosionReduction);

  // Forest regrowth only on cleared tiles
  let newForestAge = tile.forestAge;
  let newType = tile.type;

  if (REGROWABLE.has(tile.type)) {
    newForestAge = tile.forestAge + yearsAbandoned;
    newType = 'forest';
  }

  return {
    ...tile,
    fertility: newFertility,
    erosionLevel: newErosion,
    forestAge: newForestAge,
    type: newType,
  };
}
