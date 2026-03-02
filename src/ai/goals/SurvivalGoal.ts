/**
 * @fileoverview SurvivalGoal — Activates when food per capita is critically low.
 *
 * Returns high desirability (0.8-1.0) when food/capita < 3.0.
 * Sets CollectiveFocus to 'food' (All Hands to Harvest).
 */

/** Threshold below which survival takes priority (food per capita). */
const FOOD_CRISIS_PER_CAPITA = 3.0;

/** Threshold for extreme crisis. */
const FOOD_EXTREME_PER_CAPITA = 1.0;

export interface SurvivalInputs {
  foodPerCapita: number;
  population: number;
}

/**
 * Evaluates survival urgency based on food per capita.
 *
 * @param inputs - Current food/population state
 * @returns Desirability score 0-1
 */
export function evaluateSurvival(inputs: SurvivalInputs): number {
  if (inputs.population <= 0) return 0;
  if (inputs.foodPerCapita <= FOOD_EXTREME_PER_CAPITA) return 1.0;
  if (inputs.foodPerCapita <= FOOD_CRISIS_PER_CAPITA) {
    // Linear interpolation: 1.0 at extreme, 0.6 at crisis threshold
    return 0.6 + 0.4 * (1 - inputs.foodPerCapita / FOOD_CRISIS_PER_CAPITA);
  }
  // Above crisis — low survival urgency
  return Math.max(0, 0.2 - inputs.foodPerCapita * 0.01);
}
