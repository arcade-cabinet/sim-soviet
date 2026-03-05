/**
 * Freeform endless mode — no map size limit.
 *
 * In historical mode, the grid is capped at the highest tier's land grant
 * radius (gorod = 120). In freeform mode, the grid can expand indefinitely
 * as the settlement grows.
 */

import { LAND_GRANT_TIERS } from '../../config/landGrants';
import { TIER_ORDER } from '../../ai/agents/infrastructure/SettlementSystem';
import { checkExpansionTrigger } from './mapExpansion';

/**
 * Whether the game mode is freeform (endless, no map cap).
 *
 * @param gameMode - 'historical' or 'freeform'
 * @returns True if freeform
 */
export function isEndlessMode(gameMode: string): boolean {
  return gameMode === 'freeform';
}

/**
 * Maximum grid radius for the given game mode.
 * Freeform returns Infinity (no cap). Historical returns the highest
 * tier's land grant radius (gorod).
 *
 * @param gameMode - 'historical' or 'freeform'
 * @returns Maximum grid radius
 */
export function getMaxGridSize(gameMode: string): number {
  if (isEndlessMode(gameMode)) {
    return Infinity;
  }
  // Historical cap: highest tier radius
  const highestTier = TIER_ORDER[TIER_ORDER.length - 1];
  return LAND_GRANT_TIERS[highestTier]?.radius ?? LAND_GRANT_TIERS.selo.radius;
}

/**
 * Whether the grid should expand given the game mode, population, and
 * current radius. In historical mode, expansion is blocked once the
 * grid reaches the max tier radius. In freeform mode, expansion is
 * only limited by tier-based triggers (no hard cap).
 *
 * @param gameMode - 'historical' or 'freeform'
 * @param population - Current settlement population
 * @param currentRadius - Current grid radius (half-width from center)
 * @returns True if expansion should occur
 */
export function shouldExpand(gameMode: string, population: number, currentRadius: number): boolean {
  const maxRadius = getMaxGridSize(gameMode);
  if (currentRadius >= maxRadius) {
    return false;
  }
  return checkExpansionTrigger(population, currentRadius);
}
