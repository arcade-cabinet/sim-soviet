/**
 * @fileoverview DefenseGoal — Emergency response to fires, meteors, disease.
 *
 * Maximum desirability during active emergencies.
 */

export interface DefenseInputs {
  activeFires: number;
  activeMeteors: number;
  activeOutbreaks: number;
}

/**
 * Evaluates emergency defense urgency.
 *
 * @param inputs - Current emergency state
 * @returns Desirability score 0-1
 */
export function evaluateDefense(inputs: DefenseInputs): number {
  const emergencyCount = inputs.activeFires + inputs.activeMeteors + inputs.activeOutbreaks;
  if (emergencyCount === 0) return 0;
  return Math.min(1, 0.7 + emergencyCount * 0.1);
}
