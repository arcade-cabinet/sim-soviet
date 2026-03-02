/**
 * @fileoverview PoliticalAgent — Era transitions, quota enforcement, 5-year plan management.
 *
 * Manages the progression through 8 Soviet historical eras, tracks quota
 * compliance across the 5-year plan, and advises on annual report strategy
 * including the risk/reward tradeoff of pripiski (falsification).
 *
 * Telegrams emitted:
 *   - ERA_TRANSITION   when a year boundary crosses into a new era
 *   - QUOTA_DEADLINE   when the plan deadline approaches
 *   - PLAN_UPDATED     when a new 5-year plan quota is set
 *   - ANNUAL_REPORT_DUE when the annual report must be filed
 *
 * Telegrams received:
 *   - NEW_YEAR         from ChronologyAgent (check era + deadline)
 *   - REPORT_SUBMITTED from ChairmanAgent (track failure streak)
 */

import { Vehicle } from 'yuka';
import { MSG } from '../telegrams';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum consecutive quota failures before game over. */
export const MAX_QUOTA_FAILURES = 3;

/** Fractional quota inflation applied when pripiski is used. */
export const PRIPISKI_QUOTA_INFLATION = 0.2;

/** Additional inspection probability per prior falsification incident. */
export const PRIPISKI_INSPECTION_BONUS = 0.15;

/** Quota overachievement ratio that triggers a raised quota next period. */
export const STAKHANOVITE_THRESHOLD = 1.15;

/** Difficulty multipliers applied to quota targets. */
export const DIFFICULTY_MULTIPLIERS: Record<string, number> = {
  worker: 0.75,
  comrade: 1.0,
  tovarish: 1.5,
} as const;

// ---------------------------------------------------------------------------
// Era definitions
// ---------------------------------------------------------------------------

/** A single Soviet historical era with its year range and display name. */
export interface EraDefinition {
  name: string;
  startYear: number;
  endYear: number;
}

/** The 8 canonical Soviet eras, indexed 0-7. */
export const SOVIET_ERAS: EraDefinition[] = [
  { name: 'Revolution', startYear: 1917, endYear: 1922 },
  { name: 'Collectivization', startYear: 1922, endYear: 1932 },
  { name: 'Industrialization', startYear: 1932, endYear: 1941 },
  { name: 'Great Patriotic War', startYear: 1941, endYear: 1945 },
  { name: 'Reconstruction', startYear: 1945, endYear: 1952 },
  { name: 'Thaw', startYear: 1952, endYear: 1964 },
  { name: 'Stagnation', startYear: 1964, endYear: 1985 },
  { name: 'Eternal', startYear: 1985, endYear: 9999 },
] as const;

// ---------------------------------------------------------------------------
// State interface
// ---------------------------------------------------------------------------

/** Serializable internal state of the PoliticalAgent. */
export interface PoliticalState {
  /** Current era index (0-7). */
  currentEraIndex: number;
  /** Quota completion ratio (0-1). */
  quotaProgress: number;
  /** Absolute quota target for the current period. */
  quotaTarget: number;
  /** Number of consecutive quota failures (3 = game over). */
  consecutiveFailures: number;
  /** Year when the current plan deadline falls. */
  deadlineYear: number;
  /** Count of past pripiski (falsification) incidents. */
  pripiskiHistory: number;
}

// ---------------------------------------------------------------------------
// Report strategy result
// ---------------------------------------------------------------------------

/** Recommendation returned by evaluateReportStrategy. */
export type ReportStrategy = 'honest' | 'falsify';

// ---------------------------------------------------------------------------
// PoliticalAgent
// ---------------------------------------------------------------------------

/**
 * PoliticalAgent — governs Soviet bureaucratic time.
 *
 * Extends Yuka Vehicle so it can be registered in EntityManager and receive
 * telegrams via the MessageDispatcher.
 */
export class PoliticalAgent extends Vehicle {
  private state: PoliticalState = {
    currentEraIndex: 0,
    quotaProgress: 0,
    quotaTarget: 100,
    consecutiveFailures: 0,
    deadlineYear: 1922,
    pripiskiHistory: 0,
  };

  constructor() {
    super();
    this.name = 'PoliticalAgent';
  }

  // -------------------------------------------------------------------------
  // Era management
  // -------------------------------------------------------------------------

  /**
   * Check whether the given calendar year crosses into a new era.
   *
   * Returns the new era index if a boundary was crossed, or -1 if no
   * transition occurred.  Also updates internal state and emits the
   * ERA_TRANSITION telegram type identifier (callers may use this to
   * broadcast via EntityManager).
   *
   * @param year - Current in-game calendar year
   * @returns New era index, or -1 if no transition
   */
  checkEraTransition(year: number): number {
    const current = SOVIET_ERAS[this.state.currentEraIndex];
    if (!current) return -1;

    // Find the next era whose startYear <= year and whose index is greater
    for (let i = this.state.currentEraIndex + 1; i < SOVIET_ERAS.length; i++) {
      const candidate = SOVIET_ERAS[i];
      if (candidate && year >= candidate.startYear) {
        this.state.currentEraIndex = i;
        return i;
      }
    }

    return -1;
  }

  /** @returns The current era definition object. */
  getCurrentEra(): EraDefinition {
    return SOVIET_ERAS[this.state.currentEraIndex] ?? SOVIET_ERAS[0];
  }

  /** @returns Current era index (0-7). */
  getCurrentEraIndex(): number {
    return this.state.currentEraIndex;
  }

  // -------------------------------------------------------------------------
  // Quota management
  // -------------------------------------------------------------------------

  /**
   * Compute urgency score for the current quota situation.
   *
   * Urgency increases when quota progress is low and the deadline is near.
   * Score of 1.0 = critical; 0.0 = no pressure.
   *
   * @param progress - Quota completion ratio (0-1)
   * @param monthsRemaining - Months until the plan deadline
   * @returns Urgency score 0-1
   */
  assessQuotaUrgency(progress: number, monthsRemaining: number): number {
    const deficit = Math.max(0, 1 - progress);
    const timeRatio = Math.max(0, Math.min(1, 1 - monthsRemaining / 60)); // 60 months = 5 years

    // Weighted combination: deficit dominates, time pressure amplifies
    const urgency = deficit * 0.6 + timeRatio * deficit * 0.4;
    return Math.min(1, urgency);
  }

  /**
   * Update the stored quota progress and target.
   *
   * @param progress - New quota completion ratio (0-1)
   * @param target - Absolute quota target (optional)
   */
  updateQuota(progress: number, target?: number): void {
    this.state.quotaProgress = Math.max(0, Math.min(1, progress));
    if (target !== undefined) {
      this.state.quotaTarget = target;
    }
  }

  /** @returns Current quota progress ratio (0-1). */
  getQuotaProgress(): number {
    return this.state.quotaProgress;
  }

  /**
   * Record a quota failure and advance the consecutive failure counter.
   * Callers should check getConsecutiveFailures() >= MAX_QUOTA_FAILURES
   * after calling this to determine game-over.
   */
  recordQuotaFailure(): void {
    this.state.consecutiveFailures += 1;
  }

  /**
   * Reset the consecutive failure counter after a successful quota period.
   */
  resetConsecutiveFailures(): void {
    this.state.consecutiveFailures = 0;
  }

  /** @returns Number of consecutive quota failures in a row. */
  getConsecutiveFailures(): number {
    return this.state.consecutiveFailures;
  }

  // -------------------------------------------------------------------------
  // Report strategy
  // -------------------------------------------------------------------------

  /**
   * Recommend whether to submit an honest annual report or falsify (pripiski).
   *
   * Decision heuristic:
   *   - Quota met (>=100%)         → honest (no need to falsify)
   *   - Small shortfall (<20%)     → honest (risk not worth it)
   *   - Moderate shortfall (20-50%) with low marks → falsify
   *   - Large shortfall (>50%)     → honest (too obvious)
   *   - High prior pripiski        → honest (inspection risk too high)
   *
   * @param quotaPercent - Fraction of quota met (0-1)
   * @param marks - Current KGB black-mark count
   * @returns 'honest' or 'falsify'
   */
  evaluateReportStrategy(quotaPercent: number, marks: number): ReportStrategy {
    // Quota fully met — nothing to hide
    if (quotaPercent >= 1.0) return 'honest';

    const deficit = 1 - quotaPercent;

    // Small shortfall (<20%) — gap too small to justify the risk
    if (deficit < 0.2) return 'honest';

    // Large shortfall (>50%) — falsification too obvious to inspectors
    if (deficit > 0.5) return 'honest';

    // Moderate shortfall: falsify only when inspection risk is low
    const inspectionRisk = this.state.pripiskiHistory * PRIPISKI_INSPECTION_BONUS + marks * 0.1;
    if (inspectionRisk >= 0.4) return 'honest';

    return 'falsify';
  }

  /**
   * Record that a pripiski was used and inflate the next quota target.
   * Updates internal pripiski history and applies quota inflation.
   */
  recordPripiski(): void {
    this.state.pripiskiHistory += 1;
    this.state.quotaTarget = Math.round(this.state.quotaTarget * (1 + PRIPISKI_QUOTA_INFLATION));
  }

  /** @returns Number of historical pripiski incidents. */
  getPripiskiHistory(): number {
    return this.state.pripiskiHistory;
  }

  // -------------------------------------------------------------------------
  // Stakhanovite threshold
  // -------------------------------------------------------------------------

  /**
   * Determine whether Stakhanovite performance triggers a raised quota.
   *
   * If the quota was exceeded by >= STAKHANOVITE_THRESHOLD (115%), the
   * state apparatus raises the bar for the next period.
   *
   * @param quotaPercent - Fraction of quota achieved (e.g. 1.2 = 120%)
   * @returns true if next quota should be raised
   */
  shouldRaiseDifficulty(quotaPercent: number): boolean {
    return quotaPercent >= STAKHANOVITE_THRESHOLD;
  }

  // -------------------------------------------------------------------------
  // Deadline
  // -------------------------------------------------------------------------

  /**
   * Set the plan deadline year.
   *
   * @param year - Calendar year of next quota deadline
   */
  setDeadlineYear(year: number): void {
    this.state.deadlineYear = year;
  }

  /** @returns The calendar year of the current plan deadline. */
  getDeadlineYear(): number {
    return this.state.deadlineYear;
  }

  // -------------------------------------------------------------------------
  // Telegram message type constants (re-exported for convenience)
  // -------------------------------------------------------------------------

  /** Telegram type constants relevant to the PoliticalAgent. */
  static readonly MSG = {
    ERA_TRANSITION: MSG.ERA_TRANSITION,
    QUOTA_DEADLINE: MSG.QUOTA_DEADLINE,
    PLAN_UPDATED: MSG.PLAN_UPDATED,
    ANNUAL_REPORT_DUE: MSG.ANNUAL_REPORT_DUE,
    NEW_YEAR: MSG.NEW_YEAR,
    REPORT_SUBMITTED: MSG.REPORT_SUBMITTED,
  } as const;

  // -------------------------------------------------------------------------
  // Serialization
  // -------------------------------------------------------------------------

  /**
   * Serialize agent state to a plain JSON-safe object.
   *
   * @returns Plain object suitable for JSON.stringify
   */
  toJSON(): PoliticalState {
    return { ...this.state };
  }

  /**
   * Restore agent state from a previously serialized object.
   *
   * @param data - Previously returned from toJSON()
   */
  fromJSON(data: PoliticalState): void {
    this.state = { ...data };
  }
}
