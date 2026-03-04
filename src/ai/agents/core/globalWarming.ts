/**
 * Global warming terrain effects for freeform centuries.
 * Only active in freeform mode after year 2050.
 * All pure functions — no side effects.
 */

import type { TerrainTileState } from './terrainTick';

/**
 * Compute warming level for a given year.
 * Returns 0.0 at 1917, increases logarithmically, capped at 2.0.
 *
 * @param year - Current game year
 */
export function computeWarmingLevel(year: number): number {
  const elapsed = year - 1917;
  if (elapsed <= 0) return 0;
  return Math.min(2.0, Math.max(0, Math.log10(elapsed / 100 + 1)));
}

/**
 * Check whether global warming effects are active.
 * Only active in freeform mode after year 2050.
 *
 * @param gameMode - 'historical' or 'freeform'
 * @param year - Current game year
 */
export function isWarmingActive(gameMode: string, year: number): boolean {
  return gameMode === 'freeform' && year >= 2050;
}

/**
 * Apply warming effects to a terrain tile. Pure function.
 *
 * Thresholds:
 * - warming > 0.3: tundra fertility +5%
 * - warming > 0.5: tundra → grassland conversion
 * - warming > 0.7: southern forest die-off (forestAge -= 2/year)
 * - warming > 1.0: permafrost → farmable grassland
 *
 * @param tile - Current terrain tile state
 * @param warmingLevel - Output of computeWarmingLevel()
 */
export function applyWarmingToTerrain(
  tile: TerrainTileState,
  warmingLevel: number,
): TerrainTileState {
  if (warmingLevel <= 0.3) return tile;

  let { type, fertility, forestAge } = tile;

  // warming > 0.3: tundra fertility boost
  if (type === 'tundra') {
    fertility = fertility * 1.05;
  }

  // warming > 0.5: tundra → grassland
  if (warmingLevel > 0.5 && type === 'tundra') {
    type = 'grassland';
  }

  // warming > 0.7: southern forest die-off
  if (warmingLevel > 0.7 && tile.type === 'forest') {
    forestAge = Math.max(0, forestAge - 2);
    if (forestAge === 0) {
      type = 'cleared';
    }
  }

  // warming > 1.0: permafrost becomes farmable
  if (warmingLevel > 1.0 && tile.type === 'permafrost') {
    type = 'grassland';
    fertility = Math.max(fertility, 10);
  }

  return {
    ...tile,
    type,
    fertility,
    forestAge,
  };
}

/**
 * Compute flood risk for a tile based on elevation and warming level.
 * Returns 0-1 probability. Only relevant when warming > 0.7.
 *
 * @param elevation - Tile elevation (higher = safer)
 * @param warmingLevel - Output of computeWarmingLevel()
 */
export function getFloodRisk(elevation: number, warmingLevel: number): number {
  if (warmingLevel <= 0.7) return 0;

  // Risk inversely proportional to elevation, scaled by warming excess
  const warmingExcess = warmingLevel - 0.7;
  const elevationFactor = Math.max(0, 1 - elevation / 200);
  const risk = warmingExcess * elevationFactor * 0.5;

  return Math.min(1, Math.max(0, risk));
}
