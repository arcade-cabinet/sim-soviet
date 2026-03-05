/**
 * Dynamic map expansion via settlement tier land grants.
 *
 * The grid starts small (selo radius) and expands when the settlement
 * population crosses tier thresholds. New tiles are added in a ring
 * around the existing grid.
 */

import type { SettlementTier } from '../../ai/agents/infrastructure/SettlementSystem';
import { TIER_DEFINITIONS, TIER_ORDER } from '../../ai/agents/infrastructure/SettlementSystem';
import { LAND_GRANT_TIERS } from '../../config/landGrants';
import type { TerrainTileState } from '../../ai/agents/core/terrainTick';

/**
 * Determine settlement tier from population using TIER_DEFINITIONS thresholds.
 * Walks tiers in descending order and returns the highest tier whose
 * populationReq is met.
 *
 * @param population - Current settlement population
 * @returns The settlement tier for this population level
 */
export function getCurrentTier(population: number): SettlementTier {
  for (let i = TIER_ORDER.length - 1; i >= 0; i--) {
    const tier = TIER_ORDER[i];
    if (population >= TIER_DEFINITIONS[tier].populationReq) {
      return tier;
    }
  }
  return 'selo';
}

/**
 * Check whether the grid should expand based on population and current radius.
 * Returns true if the tier's land grant radius exceeds the current grid radius.
 *
 * @param population - Current settlement population
 * @param currentRadius - Current grid radius (half-width from center)
 * @returns True if expansion is needed
 */
export function checkExpansionTrigger(population: number, currentRadius: number): boolean {
  const tier = getCurrentTier(population);
  const tierRadius = LAND_GRANT_TIERS[tier]?.radius ?? LAND_GRANT_TIERS.selo.radius;
  return tierRadius > currentRadius;
}

/**
 * Compute the ring of new tile coordinates when expanding from currentRadius
 * to newRadius. The grid is a square centered at origin, so tiles range
 * from -radius to +radius on each axis.
 *
 * @param currentRadius - Current grid half-width
 * @param newRadius - Target grid half-width
 * @returns Object with the new tile coordinates and the final radius
 */
export function expandGrid(
  currentRadius: number,
  newRadius: number,
): { newTiles: Array<{ x: number; y: number }>; newRadius: number } {
  if (newRadius <= currentRadius) {
    return { newTiles: [], newRadius: currentRadius };
  }

  const newTiles: Array<{ x: number; y: number }> = [];

  for (let x = -newRadius; x <= newRadius; x++) {
    for (let y = -newRadius; y <= newRadius; y++) {
      // Skip tiles that were already in the old grid
      if (Math.abs(x) <= currentRadius && Math.abs(y) <= currentRadius) {
        continue;
      }
      newTiles.push({ x, y });
    }
  }

  return { newTiles, newRadius };
}

/**
 * Create default TerrainTileState entries for newly expanded tiles.
 *
 * @param tiles - Tile coordinates from expandGrid
 * @param defaultTerrain - Terrain type string (e.g. 'grass', 'snow', 'tundra')
 * @returns Array of initialized terrain tile states
 */
export function initializeNewTiles(
  tiles: Array<{ x: number; y: number }>,
  defaultTerrain: string,
): TerrainTileState[] {
  return tiles.map(() => ({
    type: defaultTerrain,
    fertility: 0.5,
    contamination: 0,
    moisture: 0.5,
    forestAge: 0,
    erosionLevel: 0,
    elevation: 0,
  }));
}
