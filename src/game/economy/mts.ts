/**
 * @module game/economy/mts
 *
 * Machine-Tractor Station (MTS) constants and logic.
 */

import type { MTSState } from './types';

/** MTS active period: 1922 to 1958 (Khrushchev dissolved them). */
export const MTS_START_YEAR = 1922;
export const MTS_END_YEAR = 1958;

/** Default MTS configuration. */
export const MTS_DEFAULTS: Omit<MTSState, 'active'> = {
  tractorUnits: 5,
  rentalCostPerUnit: 10,
  grainBoostMultiplier: 1.4,
  totalRentalSpent: 0,
};

/**
 * Determine whether MTS stations should be active for a given year.
 */
export function shouldMTSBeActive(year: number): boolean {
  return year >= MTS_START_YEAR && year <= MTS_END_YEAR;
}
