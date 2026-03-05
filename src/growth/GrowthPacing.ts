/**
 * @module growth/GrowthPacing
 *
 * Era-specific build intervals for the CollectiveAgent.
 *
 * Controls how often autonomous construction is attempted,
 * reflecting the pace of each historical era.
 */

import type { EraId } from '../game/era/types';

/**
 * Number of ticks between autonomous build attempts, by era.
 *
 * Lower values = faster construction pace:
 * - Revolution: slow, organic village growth
 * - Collectivization: state pressure begins
 * - Industrialization: five-year plan urgency
 * - Great Patriotic: wartime rapid construction
 * - Reconstruction: post-war rebuilding
 * - Thaw/Freeze: Khrushchev building boom
 * - Stagnation: mass khrushchyovka production
 * - The Eternal: bureaucratic inertia but continued building
 */
export const ERA_BUILD_INTERVALS: Partial<Record<EraId, number>> & Record<string, number> = {
  revolution: 120,
  collectivization: 90,
  industrialization: 60,
  great_patriotic: 45,
  reconstruction: 60,
  thaw_and_freeze: 40,
  stagnation: 30,
  the_eternal: 30,
  // Kardashev sub-eras — progressively faster autonomous construction
  post_soviet: 25,
  planetary: 20,
  solar_engineering: 15,
  type_one: 10,
  deconstruction: 8,
  dyson_swarm: 5,
  megaearth: 3,
  type_two_peak: 2,
};

/** Default interval when era is unknown. */
export const DEFAULT_BUILD_INTERVAL = 60;

/**
 * Get the build interval for a given era.
 *
 * @param eraId - Current era identifier
 * @returns Number of ticks between build attempts
 */
export function getBuildInterval(eraId: string): number {
  return ERA_BUILD_INTERVALS[eraId as EraId] ?? DEFAULT_BUILD_INTERVAL;
}
