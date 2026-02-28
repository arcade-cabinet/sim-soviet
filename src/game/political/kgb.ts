/**
 * @module game/political/kgb
 *
 * KGB-specific constants, investigation lifecycle, informant network,
 * worker arrest (removal), and skill targeting (brain drain).
 */

import type { GameRng } from '@/game/SeedSystem';
import type { KGBInformant, KGBInvestigation, PoliticalEntityStats, PoliticalTickResult } from './types';

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

/** Base number of workers arrested when an investigation completes with arrest result. */
export const BASE_ARREST_COUNT = 1;

/** Multiplier for arrest count during purge-intensity investigations. */
export const PURGE_ARREST_MULT = 3;

/** Ticks between informant reports. */
export const INFORMANT_REPORT_INTERVAL = 60;

/** Chance that an informant report flags a worker. */
export const INFORMANT_FLAG_CHANCE = 0.3;

/** How many existing marks before investigation priority is escalated. */
export const ESCALATION_MARK_THRESHOLD = 3;

// ─── Logic ──────────────────────────────────────────────────────────────────

/** Get the chance of a black mark based on investigation intensity. */
export function getBlackMarkChance(intensity: KGBInvestigation['intensity']): number {
  if (intensity === 'purge') return KGB_BLACK_MARK_CHANCE_PURGE;
  if (intensity === 'thorough') return KGB_BLACK_MARK_CHANCE_THOROUGH;
  return 0;
}

/** Roll investigation intensity based on agent effectiveness and escalation. */
export function rollInvestigationIntensity(
  effectiveness: number,
  rng: GameRng,
  priorMarks?: number,
): KGBInvestigation['intensity'] {
  // Multiple prior marks escalate investigation intensity
  const escalationBonus = priorMarks && priorMarks >= ESCALATION_MARK_THRESHOLD ? 20 : 0;
  const adjustedEffectiveness = Math.min(100, effectiveness + escalationBonus);

  const roll = rng.random() * 100;
  if (roll < adjustedEffectiveness * 0.1) return 'purge';
  if (roll < adjustedEffectiveness * 0.4) return 'thorough';
  return 'routine';
}

/** Create a new KGB investigation at the agent's current position. */
export function createInvestigation(
  entity: PoliticalEntityStats,
  rng: GameRng,
  priorMarks?: number,
): KGBInvestigation {
  const intensity = rollInvestigationIntensity(entity.effectiveness, rng, priorMarks);
  const duration = rng.int(INVESTIGATION_MIN_TICKS, INVESTIGATION_MAX_TICKS);

  // Determine if this investigation should arrest workers on completion
  const shouldArrest = intensity !== 'routine';

  // Brain drain: KGB targets high-skill workers. Skill level 0-100.
  // Higher effectiveness agents preferentially target skilled workers.
  const targetSkillLevel = Math.min(100, 30 + Math.floor(entity.effectiveness * 0.5) + rng.int(0, 20));

  return {
    targetBuilding: { ...entity.stationedAt },
    ticksRemaining: duration,
    intensity,
    flaggedWorkers: 0,
    shouldArrest,
    targetSkillLevel,
  };
}

/**
 * Resolve a completed investigation.
 * - Possibly generates a black mark.
 * - If shouldArrest is true, actually removes workers from population.
 */
export function resolveInvestigation(inv: KGBInvestigation, rng: GameRng | null, result: PoliticalTickResult): void {
  const blackMarkChance = getBlackMarkChance(inv.intensity);

  if (rng && blackMarkChance > 0 && rng.coinFlip(blackMarkChance)) {
    result.blackMarksAdded++;
    result.announcements.push(
      `KGB investigation at (${inv.targetBuilding.gridX},${inv.targetBuilding.gridY}) has uncovered irregularities.`,
    );
  }

  // Worker arrest — actually REMOVE workers from population
  if (inv.shouldArrest && inv.flaggedWorkers > 0) {
    const arrestCount =
      inv.intensity === 'purge'
        ? Math.min(inv.flaggedWorkers, BASE_ARREST_COUNT * PURGE_ARREST_MULT)
        : Math.min(inv.flaggedWorkers, BASE_ARREST_COUNT);

    if (arrestCount > 0) {
      result.workersArrested += arrestCount;
      result.announcements.push(
        `${arrestCount} worker${arrestCount > 1 ? 's' : ''} arrested during KGB investigation. ` +
          `They have been relocated to assist with forestry projects.`,
      );
    }
  }
}

/**
 * Process all active investigations for one tick.
 * Returns the updated investigations array (completed ones removed).
 */
export function tickInvestigations(
  investigations: KGBInvestigation[],
  rng: GameRng | null,
  result: PoliticalTickResult,
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

// ─── Informant Network ──────────────────────────────────────────────────────

/** Create a new informant at a building position. */
export function createInformant(buildingPos: { gridX: number; gridY: number }, rng: GameRng): KGBInformant {
  return {
    id: rng.id(),
    buildingPos: { ...buildingPos },
    nextReportTick: INFORMANT_REPORT_INTERVAL + rng.int(0, 30), // Stagger initial reports
    reliability: rng.int(20, 80),
  };
}

/**
 * Tick all informants. When their report timer expires, they produce intelligence
 * that may flag workers for investigation.
 */
export function tickInformants(
  informants: KGBInformant[],
  totalTicks: number,
  rng: GameRng | null,
  result: PoliticalTickResult,
): void {
  for (const informant of informants) {
    if (totalTicks < informant.nextReportTick) continue;

    // Reset timer
    informant.nextReportTick = totalTicks + INFORMANT_REPORT_INTERVAL;

    // Informant produces a report — chance to flag based on reliability
    if (rng && rng.coinFlip((informant.reliability / 100) * INFORMANT_FLAG_CHANCE)) {
      // This flag feeds into the investigation targeting system
      result.announcements.push(
        `Informant report received from building (${informant.buildingPos.gridX},${informant.buildingPos.gridY}).`,
      );
    }
  }
}
