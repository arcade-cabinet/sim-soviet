/**
 * @module game/economy/trudodni
 *
 * Trudodni (labor-day) accounting constants and calculations.
 */

import type { DifficultyLevel } from './types';

/** Trudodni earned per worker per tick at various building types. */
export const TRUDODNI_PER_BUILDING: Record<string, number> = {
  'kolkhoz-hq': 1.0,
  'coal-plant': 1.5,
  factory: 1.2,
  'vodka-plant': 1.0,
  'lumber-camp': 1.3,
  ministry: 0.5, // Pushing papers earns less. Naturally.
  gulag: 2.0, // "Voluntary" labor is worth more on paper
};

/** Default trudodni earned per tick for unlisted buildings. */
export const DEFAULT_TRUDODNI = 0.8;

/** Minimum trudodni per plan period to receive full rations. */
export const MINIMUM_TRUDODNI_BY_DIFFICULTY: Record<DifficultyLevel, number> = {
  worker: 50,
  comrade: 80,
  tovarish: 120,
};

/**
 * Calculate trudodni earned for a single building this tick.
 *
 * @param defId     Building definition ID
 * @param workers   Number of workers assigned to this building
 * @returns Trudodni earned
 */
export function calculateBuildingTrudodni(defId: string, workers: number): number {
  const rate = TRUDODNI_PER_BUILDING[defId] ?? DEFAULT_TRUDODNI;
  return rate * workers;
}
