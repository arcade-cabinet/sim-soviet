/**
 * @module game/economy/rations
 *
 * Ration card system constants and calculations.
 */

import type { RationDemand, RationTier } from './types';

/** Default ration amounts per tier per tick. Workers eat most, children least. */
export const DEFAULT_RATIONS: Record<RationTier, { food: number; vodka: number }> = {
  worker: { food: 1.0, vodka: 0.3 },
  employee: { food: 0.7, vodka: 0.2 },
  dependent: { food: 0.5, vodka: 0.0 },
  child: { food: 0.4, vodka: 0.0 },
};

/**
 * Ration card activation periods (year ranges).
 * Cards are active if the current year falls within ANY of these ranges.
 */
export const RATION_PERIODS: Array<{ start: number; end: number }> = [
  { start: 1929, end: 1935 },
  { start: 1941, end: 1947 },
  { start: 1983, end: 9999 }, // From 1983 onward — the system never recovers
];

/**
 * Determine whether ration cards should be active for a given year.
 *
 * @param year The current in-game year
 * @returns true if ration cards are active
 */
export function shouldRationsBeActive(year: number): boolean {
  return RATION_PERIODS.some((p) => year >= p.start && year <= p.end);
}

/**
 * Calculate total ration demand for a given population.
 *
 * Assumes a simplified distribution: 50% workers, 20% employees,
 * 20% dependents, 10% children. In reality, the distribution was
 * more complex, but we are already simplifying a bureaucracy that
 * employed millions to manage exactly this.
 *
 * @param population Total citizen count
 * @param rations    Ration configuration
 * @returns Total food and vodka demand
 */
export function calculateRationDemand(
  population: number,
  rations: Record<RationTier, { food: number; vodka: number }>
): RationDemand {
  const workers = Math.floor(population * 0.5);
  const employees = Math.floor(population * 0.2);
  const dependents = Math.floor(population * 0.2);
  const children = population - workers - employees - dependents;

  return {
    food:
      workers * rations.worker.food +
      employees * rations.employee.food +
      dependents * rations.dependent.food +
      children * rations.child.food,
    vodka:
      workers * rations.worker.vodka +
      employees * rations.employee.vodka +
      dependents * rations.dependent.vodka +
      children * rations.child.vodka,
  };
}
