/**
 * @fileoverview PoliticalGoal — Manages political risk (marks, KGB, reports).
 *
 * High desirability when black marks are accumulating.
 * Drives minigame resolution and annual report strategy.
 */

export interface PoliticalInputs {
  blackMarks: number;
  commendations: number;
  blat: number;
  kgbAggression?: 'low' | 'medium' | 'high';
}

/** Mark thresholds by KGB aggression level. */
const MARK_THRESHOLDS = { low: 8, medium: 5, high: 3 } as const;

/**
 * Evaluates political risk urgency.
 *
 * @param inputs - Current political state
 * @returns Desirability score 0-1
 */
export function evaluatePolitical(inputs: PoliticalInputs): number {
  const threshold = MARK_THRESHOLDS[inputs.kgbAggression ?? 'medium'];
  const markRatio = inputs.blackMarks / threshold;
  if (markRatio >= 1) return 1.0; // At or above arrest threshold
  if (markRatio >= 0.7) return 0.7;
  return markRatio * 0.5;
}
