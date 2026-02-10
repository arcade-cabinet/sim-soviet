/**
 * @module game/economy/heating
 *
 * Heating progression constants and tier determination logic.
 */

import type { HeatingTier } from './types';

/**
 * Heating tier configurations.
 *
 * Pechka: reliable but timber-hungry.
 * District: efficient but needs power + maintenance.
 * Crumbling: the inevitable end state. High power cost, frequent failures.
 */
export const HEATING_CONFIGS: Record<
  HeatingTier,
  {
    consumption: { resource: 'timber' | 'power'; amount: number };
    baseEfficiency: number;
    capacityPer100Pop: number;
    breakdownChancePerTick: number;
    repairThreshold: number;
  }
> = {
  pechka: {
    consumption: { resource: 'timber', amount: 2 },
    baseEfficiency: 0.8,
    capacityPer100Pop: 100,
    breakdownChancePerTick: 0.0,
    repairThreshold: Infinity,
  },
  district: {
    consumption: { resource: 'power', amount: 5 },
    baseEfficiency: 0.95,
    capacityPer100Pop: 200,
    breakdownChancePerTick: 0.01,
    repairThreshold: 120,
  },
  crumbling: {
    consumption: { resource: 'power', amount: 8 },
    baseEfficiency: 0.5,
    capacityPer100Pop: 150,
    breakdownChancePerTick: 0.05,
    repairThreshold: 60,
  },
};

/** Population threshold to unlock district heating. */
export const DISTRICT_HEATING_POPULATION = 100;

/** Ticks of district heating before it becomes crumbling (without repair). */
export const DISTRICT_TO_CRUMBLING_TICKS = 480;

/**
 * Determine the appropriate heating tier based on population and infrastructure age.
 *
 * - Below DISTRICT_HEATING_POPULATION: pechka only
 * - Above threshold: district heating available
 * - After DISTRICT_TO_CRUMBLING_TICKS without repair: crumbling
 */
export function determineHeatingTier(
  population: number,
  ticksSinceRepair: number,
  currentTier: HeatingTier
): HeatingTier {
  if (population < DISTRICT_HEATING_POPULATION) {
    return 'pechka';
  }

  if (currentTier === 'pechka') {
    return 'district';
  }

  if (currentTier === 'district' && ticksSinceRepair >= DISTRICT_TO_CRUMBLING_TICKS) {
    return 'crumbling';
  }

  return currentTier;
}
