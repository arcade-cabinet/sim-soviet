/**
 * @module game/economy/quota
 *
 * Quota escalation constants and calculations.
 */

import type { DifficultyLevel, EraId } from './types';

/** How much quotas increase after being met. Success is its own punishment. */
export const QUOTA_MET_ESCALATION = 1.15;

/** How much quotas decrease after being missed. The state is... lenient. Slightly. */
export const QUOTA_MISSED_REDUCTION = 0.95;

/** Era-specific escalation multipliers — later eras demand more. */
export const ERA_ESCALATION: Record<EraId, number> = {
  revolution: 1.0,
  industrialization: 1.2,
  wartime: 1.5,
  reconstruction: 1.1,
  thaw: 1.0,
  stagnation: 1.3,
  perestroika: 1.1,
  eternal: 1.15,
};

/** Difficulty multipliers for quota targets. */
export const DIFFICULTY_QUOTA_MULT: Record<DifficultyLevel, number> = {
  worker: 0.8,
  comrade: 1.0,
  tovarish: 1.3,
};

/**
 * Calculate the next quota target based on whether the current one was met.
 *
 * Success = harder targets (multiplied by era escalation).
 * Failure = slightly easier, but only slightly. The state does not
 * forget, it merely recalibrates its disappointment.
 *
 * @param currentTarget       The quota target that was just evaluated
 * @param wasMetLastTime      Whether the player met the quota
 * @param eraEscalation       Era-specific escalation multiplier
 * @param difficultyMultiplier Difficulty-based scaling
 * @returns The new quota target, rounded to nearest integer
 */
export function calculateNextQuota(
  currentTarget: number,
  wasMetLastTime: boolean,
  eraEscalation: number,
  difficultyMultiplier: number
): number {
  const base = wasMetLastTime
    ? currentTarget * QUOTA_MET_ESCALATION
    : currentTarget * QUOTA_MISSED_REDUCTION;

  return Math.round(base * eraEscalation * difficultyMultiplier);
}
