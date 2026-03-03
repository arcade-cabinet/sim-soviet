/**
 * @fileoverview GrowthGoal — Pursues settlement expansion when conditions are stable.
 *
 * High desirability when resources are surplus and housing is available.
 * Sets CollectiveFocus to 'balanced'.
 */

export interface GrowthInputs {
  housingUtilization: number; // 0-1
  foodPerCapita: number;
  population: number;
}

/**
 * Evaluates growth potential.
 *
 * @param inputs - Current settlement state
 * @returns Desirability score 0-1
 */
export function evaluateGrowth(inputs: GrowthInputs): number {
  // No growth when in crisis
  if (inputs.foodPerCapita < 2) return 0;
  // High desirability when stable and room to grow
  const roomToGrow = 1 - inputs.housingUtilization;
  const stability = Math.min(1, inputs.foodPerCapita / 10);
  return roomToGrow * 0.4 + stability * 0.4 + 0.2;
}
