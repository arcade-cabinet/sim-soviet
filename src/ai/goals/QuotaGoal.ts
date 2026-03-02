/**
 * @fileoverview QuotaGoal — Prioritizes when quota deadline approaches with shortfall.
 *
 * High desirability when quotaProgress is low and deadline is near.
 * Sets CollectiveFocus to 'construction' or 'production'.
 */

export interface QuotaInputs {
  quotaProgress: number; // 0-1, where 1 = 100% met
  quotaDeadlineMonths: number; // months until deadline
}

/**
 * Evaluates quota urgency.
 *
 * @param inputs - Current quota state
 * @returns Desirability score 0-1
 */
export function evaluateQuota(inputs: QuotaInputs): number {
  const gap = 1 - inputs.quotaProgress;
  if (gap <= 0) return 0.1; // Quota met — minimal urgency

  const timeUrgency = Math.max(0, 1 - inputs.quotaDeadlineMonths / 24);
  // Combine gap size with time pressure
  return Math.min(1, gap * 0.5 + timeUrgency * 0.5);
}
