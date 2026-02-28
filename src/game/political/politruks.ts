/**
 * @module game/political/politruks
 *
 * Politruk-specific constants and tick logic.
 *
 * Politruks are political officers assigned to buildings. Instead of a flat
 * 15% production penalty, they now hold ideology sessions that pull workers
 * off production. They have 4 personality types that affect behavior.
 *
 * Target ratio: 1 politruk per 20 workers (modified by doctrine/difficulty).
 */

import type { GameRng } from '@/game/SeedSystem';
import type {
  IdeologySessionResult,
  PoliticalEntityStats,
  PoliticalTickResult,
  PolitrukEffect,
  PolitrukPersonality,
} from './types';

// ─── Constants ──────────────────────────────────────────────────────────────

/** How often politruks rotate to a new building (ticks). */
export const POLITRUK_ROTATION_INTERVAL = 120;

/** Politruk morale boost (through fear). */
export const POLITRUK_MORALE_BOOST = 10;

/** Base workers per politruk ratio. */
export const WORKERS_PER_POLITRUK = 20;

/** How often ideology sessions occur (ticks between sessions). */
export const SESSION_INTERVAL = 30;

/** Base loyalty threshold — workers below this fail the check. */
export const LOYALTY_THRESHOLD = 40;

/** Chance a failed worker gets flagged for KGB investigation. */
export const KGB_FLAG_CHANCE_FROM_SESSION = 0.25;

// ─── Personality Weights ────────────────────────────────────────────────────

const PERSONALITY_WEIGHTS: Record<PolitrukPersonality, number> = {
  zealous: 25,
  lazy: 25,
  paranoid: 25,
  corrupt: 25,
};

/** Roll a random politruk personality. */
export function rollPolitrukPersonality(rng: GameRng): PolitrukPersonality {
  const types: PolitrukPersonality[] = ['zealous', 'lazy', 'paranoid', 'corrupt'];
  const weights = types.map((t) => PERSONALITY_WEIGHTS[t]);
  const idx = rng.weightedIndex(weights);
  return types[idx]!;
}

/**
 * Calculate target politruk count based on population and modifiers.
 * Base: 1 per 20 workers. Doctrine and difficulty can adjust.
 */
export function calcPolitrukCount(population: number, doctrineMult: number, difficultyMult: number): number {
  if (population <= 0) return 0;
  const base = Math.floor(population / WORKERS_PER_POLITRUK);
  return Math.max(0, Math.round(base * doctrineMult * difficultyMult));
}

// ─── Personality Behavior ───────────────────────────────────────────────────

interface PersonalityBehavior {
  /** Multiplier on loyalty threshold (higher = stricter checks). */
  loyaltyThresholdMult: number;
  /** Chance to skip the session entirely (0-1). */
  skipChance: number;
  /** Multiplier on KGB flag chance (higher = more flags). */
  kgbFlagMult: number;
  /** Whether this personality accepts bribes (blat). */
  acceptsBribes: boolean;
  /** Extra workers pulled into session (beyond normal). */
  extraWorkers: number;
  /** Production penalty when session is active (fraction). */
  sessionProductionPenalty: number;
}

const PERSONALITY_BEHAVIORS: Record<PolitrukPersonality, PersonalityBehavior> = {
  zealous: {
    loyaltyThresholdMult: 1.3, // Harsh checks — higher threshold to pass
    skipChance: 0,
    kgbFlagMult: 1.5,
    acceptsBribes: false,
    extraWorkers: 2,
    sessionProductionPenalty: 0.2,
  },
  lazy: {
    loyaltyThresholdMult: 0.7, // Lenient — lower threshold
    skipChance: 0.4, // 40% chance to skip session entirely
    kgbFlagMult: 0.5,
    acceptsBribes: false,
    extraWorkers: 0,
    sessionProductionPenalty: 0.05, // Barely disrupts production
  },
  paranoid: {
    loyaltyThresholdMult: 1.0,
    skipChance: 0,
    kgbFlagMult: 2.0, // Flags innocents — double KGB referrals
    acceptsBribes: false,
    extraWorkers: 1,
    sessionProductionPenalty: 0.15,
  },
  corrupt: {
    loyaltyThresholdMult: 0.9,
    skipChance: 0.2,
    kgbFlagMult: 0.3, // Easily bribed — fewer flags
    acceptsBribes: true,
    extraWorkers: 0,
    sessionProductionPenalty: 0.1,
  },
};

// ─── Logic ──────────────────────────────────────────────────────────────────

/**
 * Run an ideology session at the politruk's stationed building.
 * Workers are pulled off production and checked for loyalty.
 */
export function runIdeologySession(
  entity: PoliticalEntityStats,
  rng: GameRng,
  buildingWorkerCount: number,
): IdeologySessionResult | null {
  const personality = entity.personality ?? 'zealous';
  const behavior = PERSONALITY_BEHAVIORS[personality];

  // Lazy politruks might skip the session
  if (behavior.skipChance > 0 && rng.coinFlip(behavior.skipChance)) {
    return null;
  }

  // Calculate workers attending the session
  const baseAttendees = Math.max(1, Math.ceil(buildingWorkerCount * 0.3));
  const attended = Math.min(buildingWorkerCount, baseAttendees + behavior.extraWorkers);

  if (attended <= 0) return null;

  // Per-worker loyalty check
  const threshold = Math.round(LOYALTY_THRESHOLD * behavior.loyaltyThresholdMult);
  let failed = 0;
  let kgbTargets = 0;

  for (let i = 0; i < attended; i++) {
    // Each worker has a random loyalty score 0-100
    const workerLoyalty = rng.int(0, 100);
    if (workerLoyalty < threshold) {
      failed++;
      // Failed workers may be flagged for KGB
      if (rng.coinFlip(KGB_FLAG_CHANCE_FROM_SESSION * behavior.kgbFlagMult)) {
        kgbTargets++;
      }
    }
  }

  return {
    buildingPos: { ...entity.stationedAt },
    workersAttended: attended,
    workersFailed: failed,
    kgbTargetsFlagged: kgbTargets,
  };
}

/** Create the effect a politruk has on its stationed building. */
export function createPolitrukEffect(
  entity: PoliticalEntityStats,
  sessionResult: IdeologySessionResult | null,
): PolitrukEffect | null {
  if (!entity.targetBuilding) return null;

  const personality = entity.personality ?? 'zealous';
  const behavior = PERSONALITY_BEHAVIORS[personality];

  // Production penalty comes from session disruption, not a flat 15%
  const penalty = sessionResult ? behavior.sessionProductionPenalty : behavior.sessionProductionPenalty * 0.3;

  return {
    buildingGridX: entity.stationedAt.gridX,
    buildingGridY: entity.stationedAt.gridY,
    moraleBoost: POLITRUK_MORALE_BOOST,
    productionPenalty: penalty,
    workerSlotConsumed: 1,
    sessionResult: sessionResult ?? undefined,
  };
}

/**
 * Apply a politruk's effect to the tick result.
 * If the politruk's session timer has elapsed, run an ideology session.
 */
export function applyPolitrukTick(
  entity: PoliticalEntityStats,
  result: PoliticalTickResult,
  rng: GameRng | null,
  buildingWorkerCount: number,
): void {
  // Check if it's time for an ideology session (every SESSION_INTERVAL ticks)
  const shouldRunSession = rng && entity.ticksRemaining % SESSION_INTERVAL === 0 && buildingWorkerCount > 0;

  const sessionResult = shouldRunSession ? runIdeologySession(entity, rng!, buildingWorkerCount) : null;

  if (sessionResult) {
    result.ideologySessions.push(sessionResult);
  }

  const effect = createPolitrukEffect(entity, sessionResult);
  if (effect) {
    result.politrukEffects.push(effect);
  }
}
