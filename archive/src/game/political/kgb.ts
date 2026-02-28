/**
 * @module game/political/kgb
 *
 * KGB-specific constants, investigation lifecycle, and tick logic.
 */

import type { GameRng } from '@/game/SeedSystem';
import type { KGBInvestigation, PoliticalEntityStats, PoliticalTickResult } from './types';

// ─── Constants ──────────────────────────────────────────────────────────────

/** Default investigation duration range (ticks). */
export const INVESTIGATION_MIN_TICKS = 10;
export const INVESTIGATION_MAX_TICKS = 30;

/** How often KGB agents pick a new building to investigate (ticks). */
export const KGB_REASSIGNMENT_INTERVAL = 40;

/** KGB investigation: morale drop per tick. */
export const KGB_MORALE_DROP = 3;

/** KGB investigation: loyalty boost per tick (through fear). */
export const KGB_LOYALTY_BOOST = 2;

/** Chance per investigation tick that a worker gets flagged. */
export const KGB_FLAG_CHANCE = 0.1;

/** Chance that a thorough investigation finds a black mark. */
export const KGB_BLACK_MARK_CHANCE_THOROUGH = 0.3;

/** Chance that a purge investigation finds a black mark. */
export const KGB_BLACK_MARK_CHANCE_PURGE = 0.6;

// ─── Logic ──────────────────────────────────────────────────────────────────

/** Get the chance of a black mark based on investigation intensity. */
export function getBlackMarkChance(intensity: KGBInvestigation['intensity']): number {
  if (intensity === 'purge') return KGB_BLACK_MARK_CHANCE_PURGE;
  if (intensity === 'thorough') return KGB_BLACK_MARK_CHANCE_THOROUGH;
  return 0;
}

/** Roll investigation intensity based on agent effectiveness. */
export function rollInvestigationIntensity(
  effectiveness: number,
  rng: GameRng
): KGBInvestigation['intensity'] {
  const roll = rng.random() * 100;
  if (roll < effectiveness * 0.1) return 'purge';
  if (roll < effectiveness * 0.4) return 'thorough';
  return 'routine';
}

/** Create a new KGB investigation at the agent's current position. */
export function createInvestigation(entity: PoliticalEntityStats, rng: GameRng): KGBInvestigation {
  const intensity = rollInvestigationIntensity(entity.effectiveness, rng);
  const duration = rng.int(INVESTIGATION_MIN_TICKS, INVESTIGATION_MAX_TICKS);

  return {
    targetBuilding: { ...entity.stationedAt },
    ticksRemaining: duration,
    intensity,
    flaggedWorkers: 0,
  };
}

/** Resolve a completed investigation, possibly generating a black mark. */
export function resolveInvestigation(
  inv: KGBInvestigation,
  rng: GameRng | null,
  result: PoliticalTickResult
): void {
  const blackMarkChance = getBlackMarkChance(inv.intensity);

  if (rng && blackMarkChance > 0 && rng.coinFlip(blackMarkChance)) {
    result.blackMarksAdded++;
    result.announcements.push(
      `KGB investigation at (${inv.targetBuilding.gridX},${inv.targetBuilding.gridY}) has uncovered irregularities.`
    );
  }
}

/**
 * Process all active investigations for one tick.
 * Returns the updated investigations array (completed ones removed).
 */
export function tickInvestigations(
  investigations: KGBInvestigation[],
  rng: GameRng | null,
  result: PoliticalTickResult
): KGBInvestigation[] {
  const completed: number[] = [];

  for (let i = 0; i < investigations.length; i++) {
    const inv = investigations[i]!;
    inv.ticksRemaining--;

    // Per-tick: chance to flag a worker
    if (rng?.coinFlip(KGB_FLAG_CHANCE)) {
      inv.flaggedWorkers++;
    }

    if (inv.ticksRemaining <= 0) {
      completed.push(i);
      resolveInvestigation(inv, rng, result);
    }
  }

  // Remove completed investigations (reverse order to preserve indices)
  for (let i = completed.length - 1; i >= 0; i--) {
    investigations.splice(completed[i]!, 1);
  }
  result.completedInvestigations = completed.length;

  return investigations;
}
