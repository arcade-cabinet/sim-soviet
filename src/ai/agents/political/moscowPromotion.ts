/**
 * @module ai/agents/political/moscowPromotion
 *
 * Moscow "rewards" sustained success with MORE responsibility.
 * This is a GAME FEATURE, not a cold branch.
 *
 * The Soviet paradox: competence attracts attention. If your settlement
 * runs well for too long, Moscow notices and "promotes" you — meaning
 * they hand you a second settlement to manage. The player can accept,
 * bribe their way out, or delay (which makes Moscow insist harder).
 *
 * Pure function module. No Yuka dependency. State is tracked by PoliticalAgent.
 */

import type { SettlementSummary } from '../../../game/engine/SettlementSummary';

// ─── Types ──────────────────────────────────────────────────────────────────

/** Political state subset needed for promotion evaluation. */
export interface PromotionPoliticalContext {
  /** KGB suspicion level (0-1). Higher suspicion = lower promotion risk. */
  suspicionLevel: number;
  /** KGB threat level — 'investigated' or worse blocks promotion. */
  threatLevel: 'safe' | 'watched' | 'warned' | 'investigated' | 'reviewed' | 'arrested';
  /** Quota progress ratio (0-1). */
  quotaProgress: number;
  /** Consecutive years with quota met (>= 0.8 fulfillment). */
  consecutiveGoodYears: number;
  /** Current blat balance. */
  blat: number;
  /** Moscow attention level (0-1) from WorldAgent. */
  moscowAttention: number;
}

/** Serializable promotion tracking state. */
export interface MoscowPromotionState {
  /** Promotion risk (0-1) from last evaluation. */
  currentRisk: number;
  /** Consecutive years risk has been > 0.3. */
  consecutiveHighRiskYears: number;
  /** Whether a promotion notification is currently active. */
  notificationActive: boolean;
  /** Year the notification was first issued (for escalation tracking). */
  notificationIssuedYear: number;
  /** How many times the player has delayed. Each delay increases pressure. */
  delayCount: number;
  /** Whether promotion was already accepted (prevents re-triggering). */
  accepted: boolean;
}

/** Player response to a promotion notification. */
export type PromotionResponse = 'accept' | 'bribe' | 'delay';

/** Result of attempting to bribe out of a promotion. */
export interface BribeResult {
  success: boolean;
  /** Whether the bribe was detected by KGB. */
  detected: boolean;
  /** Blat cost spent. */
  blatCost: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** Minimum quota fulfillment ratio to count as a "good year". */
const GOOD_YEAR_THRESHOLD = 0.8;

/** Years of sustained high risk before notification fires. */
const SUSTAINED_RISK_YEARS = 3;

/** Risk threshold above which years count toward sustained risk. */
const RISK_THRESHOLD = 0.3;

/** Blat cost to attempt a bribe. */
const BRIBE_BLAT_COST = 5;

/** Probability that a bribe is detected by KGB (adds a black mark). */
const BRIBE_DETECTION_CHANCE = 0.2;

/** Delay escalation: each delay adds this much to next year's risk. */
const DELAY_ESCALATION = 0.1;

// ─── Pure Functions ─────────────────────────────────────────────────────────

/** Create initial promotion state. */
export function createPromotionState(): MoscowPromotionState {
  return {
    currentRisk: 0,
    consecutiveHighRiskYears: 0,
    notificationActive: false,
    notificationIssuedYear: 0,
    delayCount: 0,
    accepted: false,
  };
}

/**
 * Evaluate promotion risk based on settlement performance.
 *
 * The Soviet paradox: higher success = HIGHER risk.
 * Factors:
 *   - Population growth trending up
 *   - Quota fulfillment > 80% for multiple years
 *   - No active crises
 *   - KGB reports favorable (low suspicion)
 *   - Moscow attention amplifies everything
 *
 * @returns Risk value 0-1
 */
export function evaluatePromotionRisk(
  summary: SettlementSummary,
  political: PromotionPoliticalContext,
): number {
  // Promotion never happens if under serious investigation
  if (
    political.threatLevel === 'investigated' ||
    political.threatLevel === 'reviewed' ||
    political.threatLevel === 'arrested'
  ) {
    return 0;
  }

  // No promotion if there are active crises
  if (summary.activeCrisisCount > 0) {
    return 0;
  }

  // Base: consecutive good years drive promotion (max 0.4 from this alone)
  const yearsContribution = Math.min(political.consecutiveGoodYears * 0.1, 0.4);

  // Population growth adds attention (max 0.15)
  const popGrowthContribution = summary.trendDeltas.population > 0 ? 0.15 : 0;

  // Current quota overperformance (max 0.15)
  const quotaContribution = political.quotaProgress > GOOD_YEAR_THRESHOLD
    ? Math.min((political.quotaProgress - GOOD_YEAR_THRESHOLD) * 0.75, 0.15)
    : 0;

  // Low suspicion = Moscow thinks you're reliable (max 0.15)
  const reliabilityContribution = Math.max(0, (1.0 - political.suspicionLevel) * 0.15);

  // Moscow attention amplifies total risk
  const moscowMultiplier = 0.5 + political.moscowAttention * 0.5;

  const raw =
    (yearsContribution + popGrowthContribution + quotaContribution + reliabilityContribution) *
    moscowMultiplier;

  return Math.max(0, Math.min(raw, 1.0));
}

/**
 * Tick promotion state once per year.
 *
 * @param state - Current promotion state (mutated in place)
 * @param risk - This year's evaluated risk
 * @param currentYear - Game year
 * @returns Whether a new notification should be emitted
 */
export function tickPromotionYearly(
  state: MoscowPromotionState,
  risk: number,
  currentYear: number,
): boolean {
  if (state.accepted) return false;

  // Apply delay escalation to risk
  const adjustedRisk = Math.min(risk + state.delayCount * DELAY_ESCALATION, 1.0);
  state.currentRisk = adjustedRisk;

  if (adjustedRisk > RISK_THRESHOLD) {
    state.consecutiveHighRiskYears++;
  } else {
    state.consecutiveHighRiskYears = 0;
    // If risk drops, also clear any pending notification
    if (state.notificationActive) {
      state.notificationActive = false;
      state.delayCount = 0;
    }
  }

  // Fire notification after 3 consecutive high-risk years
  if (state.consecutiveHighRiskYears >= SUSTAINED_RISK_YEARS && !state.notificationActive) {
    state.notificationActive = true;
    state.notificationIssuedYear = currentYear;
    return true;
  }

  return false;
}

/**
 * Handle player's response to a promotion notification.
 *
 * @param state - Current promotion state (mutated in place)
 * @param response - Player's chosen response
 * @param rng - Random number 0-1 for bribe detection roll
 * @param currentBlat - Player's current blat balance
 * @returns Result object (for bribe: success/detection; for others: null)
 */
export function handlePromotionResponse(
  state: MoscowPromotionState,
  response: PromotionResponse,
  rng: number,
  currentBlat: number,
): BribeResult | null {
  switch (response) {
    case 'accept':
      state.accepted = true;
      state.notificationActive = false;
      return null;

    case 'bribe': {
      const canAfford = currentBlat >= BRIBE_BLAT_COST;
      const detected = rng < BRIBE_DETECTION_CHANCE;

      if (canAfford) {
        state.notificationActive = false;
        state.consecutiveHighRiskYears = 0;
        state.delayCount = 0;
        return { success: true, detected, blatCost: BRIBE_BLAT_COST };
      }
      // Can't afford — bribe fails, still costs 0
      return { success: false, detected: false, blatCost: 0 };
    }

    case 'delay':
      state.notificationActive = false;
      state.delayCount++;
      return null;

    default:
      return null;
  }
}

/** Exported constants for testing. */
export const PROMOTION_CONSTANTS = {
  GOOD_YEAR_THRESHOLD,
  SUSTAINED_RISK_YEARS,
  RISK_THRESHOLD,
  BRIBE_BLAT_COST,
  BRIBE_DETECTION_CHANCE,
  DELAY_ESCALATION,
} as const;
