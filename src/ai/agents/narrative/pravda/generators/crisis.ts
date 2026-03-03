/**
 * @module pravda/generators/crisis
 *
 * Crisis-aware headline generators. When active crises are present,
 * these generators produce phase-appropriate propaganda headlines
 * weighted higher than ambient generators.
 */

import { pick } from '../helpers';
import type { ActiveCrisisInfo, GeneratedHeadline } from '../types';
import {
  DISASTER_HEADLINES,
  DISASTER_REALITIES,
  DISASTER_SUBTEXTS,
  FAMINE_HEADLINES,
  FAMINE_REALITIES,
  FAMINE_SUBTEXTS,
  POLITICAL_HEADLINES,
  POLITICAL_REALITIES,
  POLITICAL_SUBTEXTS,
  WAR_HEADLINES,
  WAR_REALITIES,
  WAR_SUBTEXTS,
} from '../wordPools';

// ─────────────────────────────────────────────────────────
//  CRISIS HEADLINE POOLS
//
//  Each crisis type has its own headline + subtext + reality
//  pool. Generators pick randomly from these, producing
//  darkly humorous Soviet propaganda about ongoing crises.
// ─────────────────────────────────────────────────────────

interface CrisisPool {
  headlines: readonly string[];
  subtexts: readonly string[];
  realities: readonly string[];
}

const CRISIS_POOLS: Record<ActiveCrisisInfo['type'], CrisisPool> = {
  war: { headlines: WAR_HEADLINES, subtexts: WAR_SUBTEXTS, realities: WAR_REALITIES },
  famine: { headlines: FAMINE_HEADLINES, subtexts: FAMINE_SUBTEXTS, realities: FAMINE_REALITIES },
  disaster: { headlines: DISASTER_HEADLINES, subtexts: DISASTER_SUBTEXTS, realities: DISASTER_REALITIES },
  political: { headlines: POLITICAL_HEADLINES, subtexts: POLITICAL_SUBTEXTS, realities: POLITICAL_REALITIES },
};

/**
 * Generate a crisis headline for a specific active crisis.
 * Picks from the pool matching the crisis type.
 */
export function generateCrisisHeadline(crisis: ActiveCrisisInfo): GeneratedHeadline {
  const pool = CRISIS_POOLS[crisis.type];
  return {
    headline: pick(pool.headlines),
    subtext: pick(pool.subtexts),
    reality: pick(pool.realities),
    category: 'crisis',
  };
}

// ─────────────────────────────────────────────────────────
//  PHASE-BASED WEIGHTING
//
//  Crisis headlines are weighted higher during active crises.
//  Peak phase gets 3x weight, buildup 2x, aftermath 2x.
//  This ensures the news ticker reflects ongoing crises
//  without completely drowning out ambient propaganda.
// ─────────────────────────────────────────────────────────

/** Weight multiplier for crisis headlines based on lifecycle phase. */
export function crisisPhaseWeight(phase: ActiveCrisisInfo['phase']): number {
  switch (phase) {
    case 'peak':
      return 3;
    case 'buildup':
    case 'aftermath':
      return 2;
    default:
      return 1;
  }
}
