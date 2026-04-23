/**
 * Historical map expansion guard.
 *
 * The grid is capped at the highest tier's land grant radius (gorod = 120).
 */

import { TIER_ORDER } from '../../ai/agents/infrastructure/SettlementSystem';
import { LAND_GRANT_TIERS } from '../../config/landGrants';
import { checkExpansionTrigger } from './mapExpansion';

/**
 * Whether the current game should ignore the historical map cap.
 */
export function isEndlessMode(_gameMode: string): boolean {
  return false;
}

/**
 * Maximum grid radius for the historical campaign and post-campaign continuation.
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
 * Whether the grid should expand given population and current radius.
 * Expansion is blocked once the grid reaches the max tier radius.
 *
 * @param gameMode - Kept for compatibility; historical cap always applies.
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
