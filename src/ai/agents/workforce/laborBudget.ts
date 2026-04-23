/**
 * @fileoverview Labor Time Budget System — splits workforce time between
 * state demands and personal needs each tick.
 *
 * Historical context: The Soviet state demanded 60-90% of labor depending
 * on era. Workers had to fulfill collective farm quotas, construction
 * mandates, ideology sessions, and military service. The remainder was
 * split between private plots (when doctrine allowed), foraging during
 * food crises, rest, and idle time. Too much idle time bred trouble;
 * too little rest tanked morale.
 *
 * Wartime (great_patriotic) is brutal: 90% state demand leaves only
 * 10% for everything else.
 */

import type { EraId } from '../../../game/era';

// ─────────────────────────────────────────────────────────────────────────────
//  CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

/** Labor budget configuration parameters. */
export interface LaborBudgetConfig {
  /** Minimum fraction of labor the state demands (floor). */
  stateMinDemandFraction: number;
  /** Idle fraction above which trouble risk activates. */
  idleTroubleThreshold: number;
  /** Maximum fraction of personal time that can go to foraging. */
  personalTimeForagingCap: number;
  /** Fraction of total time allocated to private plots (before squeeze). */
  privatePlotTimeFraction: number;
  /** Minimum fraction of total time that must be reserved for rest. */
  restMinimum: number;
  /** Per-era state demand fractions. */
  eraStateDemand: Partial<Record<EraId, number>>;
}

/** Default labor budget configuration. */
export const LABOR_BUDGET_CONFIG: LaborBudgetConfig = {
  stateMinDemandFraction: 0.6,
  idleTroubleThreshold: 0.3,
  personalTimeForagingCap: 0.2,
  privatePlotTimeFraction: 0.1,
  restMinimum: 0.05,
  eraStateDemand: {
    revolution: 0.5,
    collectivization: 0.65,
    industrialization: 0.75,
    great_patriotic: 0.9,
    reconstruction: 0.6,
    thaw_and_freeze: 0.55,
    stagnation: 0.65,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
//  RESULT INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

/** Result of labor budget computation for a single tick. */
export interface LaborBudgetResult {
  /** Fraction of total labor time allocated to state work (0-1). */
  stateLaborFraction: number;
  /** Fraction of total labor time for private garden plots (0-1). */
  privatePlotFraction: number;
  /** Fraction of total labor time available for foraging (0-1). */
  foragingFraction: number;
  /** Fraction of total labor time for rest/domestic (0-1). */
  restFraction: number;
  /** Remaining idle fraction after all allocations (0-1). */
  idleFraction: number;
  /** True if idle time exceeds the trouble threshold. */
  troubleRisk: boolean;
  /** How much of state production capacity is utilized (0-1). */
  productionEfficiency: number;
}

// ─────────────────────────────────────────────────────────────────────────────
//  COMPUTATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute how the workforce's time is split between state demands and
 * personal needs for a single tick.
 *
 * The algorithm:
 * 1. Look up era-specific state demand (or use the minimum floor).
 * 2. Remaining personal time = 1.0 - stateDemand.
 * 3. From personal time, allocate rest (minimum guaranteed), private plots,
 *    foraging (only during food crisis, capped), and idle (remainder).
 * 4. If idle exceeds the threshold, flag trouble risk.
 * 5. Production efficiency = state labor fraction (the more the state
 *    demands, the more production output the collective generates).
 *
 * @param eraId - Current historical era
 * @param population - Current working-age population count
 * @param foodCrisis - True if the settlement is in a food crisis
 * @param config - Labor budget config (defaults to LABOR_BUDGET_CONFIG)
 * @returns The computed labor budget split
 */
export function computeLaborBudget(
  eraId: string,
  population: number,
  foodCrisis: boolean,
  config: LaborBudgetConfig = LABOR_BUDGET_CONFIG,
): LaborBudgetResult {
  // No population — return zeroed budget with no trouble
  if (population <= 0) {
    return {
      stateLaborFraction: 0,
      privatePlotFraction: 0,
      foragingFraction: 0,
      restFraction: 0,
      idleFraction: 0,
      troubleRisk: false,
      productionEfficiency: 0,
    };
  }

  // 1. State demand: look up by era, floor at minimum
  const eraKey = eraId as EraId;
  const eraDemand = config.eraStateDemand[eraKey] ?? config.stateMinDemandFraction;
  const stateLaborFraction = Math.max(eraDemand, config.stateMinDemandFraction);

  // 2. Personal time is whatever the state doesn't take
  const personalTime = 1.0 - stateLaborFraction;

  // 3. Allocate personal time sub-fractions
  //    Rest is guaranteed first (minimum)
  const restFraction = Math.min(config.restMinimum, personalTime);
  let remainingPersonal = personalTime - restFraction;

  // Private plots get their share (if there's room)
  const privatePlotFraction = Math.min(config.privatePlotTimeFraction, remainingPersonal);
  remainingPersonal -= privatePlotFraction;

  // Foraging only happens during food crisis, capped
  let foragingFraction = 0;
  if (foodCrisis) {
    foragingFraction = Math.min(config.personalTimeForagingCap, remainingPersonal);
    remainingPersonal -= foragingFraction;
  }

  // Whatever is left is idle time
  const idleFraction = Math.max(0, remainingPersonal);

  // 4. Trouble risk: idle above threshold means the populace gets restless
  const troubleRisk = idleFraction > config.idleTroubleThreshold;

  // 5. Production efficiency = state labor fraction
  //    The more time the state extracts, the more production output
  const productionEfficiency = stateLaborFraction;

  return {
    stateLaborFraction,
    privatePlotFraction,
    foragingFraction,
    restFraction,
    idleFraction,
    troubleRisk,
    productionEfficiency,
  };
}
