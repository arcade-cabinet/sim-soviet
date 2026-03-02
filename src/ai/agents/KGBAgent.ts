/**
 * @fileoverview KGBAgent — Investigation intensity and arrest risk evaluator.
 *
 * Wraps the KGB/inspection system. Decides investigation intensity, tracks
 * political suspicion, and determines arrest risk based on marks, commendations,
 * quota performance, and difficulty aggression level.
 *
 * Telegrams emitted: INSPECTION_IMMINENT, MARKS_INCREASED, ARREST_WARRANT
 * Telegrams received: OFFER_BRIBE (reduces suspicion), ERA_TRANSITION (adjusts aggression)
 */

import { Vehicle } from 'yuka';
import { MSG } from '../telegrams';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Number of marks at which arrest is certain (risk = 1.0). */
const ARREST_THRESHOLD = 7;

/** Number of marks that triggers escalation to more intense investigation. */
const ESCALATION_MARK_THRESHOLD = 3;

/**
 * Mark count thresholds for suspicion scoring by aggression level.
 * Threshold is the mark count at which suspicion reaches 1.0.
 */
const MARK_THRESHOLDS: Record<'low' | 'medium' | 'high', number> = {
  low: 8,
  medium: 5,
  high: 3,
};

/**
 * Default aggression level by difficulty name.
 */
const DIFFICULTY_AGGRESSION: Record<string, 'low' | 'medium' | 'high'> = {
  worker: 'low',
  comrade: 'medium',
  tovarish: 'high',
};

// ---------------------------------------------------------------------------
// State interface
// ---------------------------------------------------------------------------

/** Internal KGB state tracked across ticks. */
export interface KGBState {
  /** Fuzzy suspicion level, 0 (none) to 1 (maximum). */
  suspicionLevel: number;
  /** Current investigation mode. */
  investigationIntensity: 'routine' | 'thorough' | 'purge';
  /** Cached mark count from the last assessment. */
  markCount: number;
  /** Simulation tick of the last inspection. */
  lastInspectionTick: number;
  /** Aggression level derived from difficulty. */
  aggression: 'low' | 'medium' | 'high';
}

// ---------------------------------------------------------------------------
// KGBAgent
// ---------------------------------------------------------------------------

/**
 * The KGB — investigation intensity and arrest risk evaluator.
 * Extends Yuka Vehicle for compatibility with EntityManager.
 *
 * @example
 * const kgb = new KGBAgent('medium');
 * kgb.assessThreat(marks, commendations, quotaPerformance, 'comrade');
 * const intensity = kgb.getInvestigationIntensity();
 * const risk = kgb.getArrestRisk();
 */
export class KGBAgent extends Vehicle {
  /** Internal KGB state. */
  private state: KGBState = {
    suspicionLevel: 0,
    investigationIntensity: 'routine',
    markCount: 0,
    lastInspectionTick: 0,
    aggression: 'medium',
  };

  /**
   * Exported message constants for telegram emission (tests can reference).
   * @internal
   */
  static readonly MSG = MSG;

  constructor(difficulty: string = 'comrade') {
    super();
    this.name = 'KGBAgent';
    this.state.aggression = DIFFICULTY_AGGRESSION[difficulty] ?? 'medium';
  }

  // -------------------------------------------------------------------------
  // Core assessment
  // -------------------------------------------------------------------------

  /**
   * Evaluate political suspicion based on marks, commendations, quota
   * performance, and difficulty aggression.
   *
   * Suspicion is a fuzzy 0-1 value:
   *   - Marks contribute positively (scaled by aggression threshold)
   *   - Commendations subtract a small mitigation factor
   *   - Low quota performance adds suspicion
   *
   * @param marks - Current black mark count from PersonnelFile
   * @param commendations - Current commendation count
   * @param quotaPerformance - 0-1 fraction of quota achieved (1.0 = fully met)
   * @param difficulty - Game difficulty key ('worker' | 'comrade' | 'tovarish')
   */
  assessThreat(
    marks: number,
    commendations: number,
    quotaPerformance: number,
    difficulty: string,
  ): void {
    // Update aggression from difficulty
    this.state.aggression = DIFFICULTY_AGGRESSION[difficulty] ?? this.state.aggression;
    this.state.markCount = marks;

    const threshold = MARK_THRESHOLDS[this.state.aggression];

    // Base suspicion from marks (capped at 1.0)
    const markSuspicion = Math.min(marks / threshold, 1.0);

    // Commendations provide a small mitigation (max 0.2 reduction)
    const commendationMitigation = Math.min(commendations * 0.05, 0.2);

    // Low quota performance contributes suspicion (up to 0.3 additional)
    const quotaSuspicion = Math.max(0, (1.0 - quotaPerformance) * 0.3);

    const raw = markSuspicion + quotaSuspicion - commendationMitigation;
    this.state.suspicionLevel = Math.max(0, Math.min(raw, 1.0));

    // Update investigation intensity based on new suspicion level
    this.state.investigationIntensity = this._computeIntensity();
  }

  // -------------------------------------------------------------------------
  // Decision queries
  // -------------------------------------------------------------------------

  /**
   * Get current investigation intensity based on suspicion level.
   *
   * - suspicion < 0.33  → 'routine'
   * - suspicion < 0.67  → 'thorough'
   * - suspicion >= 0.67 → 'purge'
   *
   * @returns Current investigation intensity
   */
  getInvestigationIntensity(): 'routine' | 'thorough' | 'purge' {
    return this.state.investigationIntensity;
  }

  /**
   * Determine whether to escalate investigation intensity.
   *
   * Escalates when mark count is at or above ESCALATION_MARK_THRESHOLD (3).
   *
   * @returns True if investigation should escalate
   */
  shouldEscalate(): boolean {
    return this.state.markCount >= ESCALATION_MARK_THRESHOLD;
  }

  /**
   * Calculate probability of arrest this tick.
   *
   * - Returns 1.0 at or above ARREST_THRESHOLD marks
   * - Returns 0 at 0 marks
   * - Scales linearly in between
   *
   * @returns Arrest risk probability 0-1
   */
  getArrestRisk(): number {
    if (this.state.markCount >= ARREST_THRESHOLD) return 1.0;
    if (this.state.markCount <= 0) return 0;
    return this.state.markCount / ARREST_THRESHOLD;
  }

  // -------------------------------------------------------------------------
  // Telegram handling
  // -------------------------------------------------------------------------

  /**
   * Handle an incoming bribe offer from ChairmanAgent — reduces suspicion.
   *
   * @param bribeAmount - Magnitude of bribe (0-1 normalised value)
   */
  handleBribeOffer(bribeAmount: number): void {
    const reduction = Math.min(bribeAmount * 0.3, 0.3);
    this.state.suspicionLevel = Math.max(0, this.state.suspicionLevel - reduction);
    this.state.investigationIntensity = this._computeIntensity();
  }

  /**
   * Handle an ERA_TRANSITION telegram from PoliticalAgent.
   * Later eras ratchet aggression upward toward 'high'.
   *
   * @param toEra - Target era index (0-7)
   */
  handleEraTransition(toEra: number): void {
    if (toEra >= 4) {
      this.state.aggression = 'high';
    } else if (toEra >= 2) {
      // Only escalate, never de-escalate
      if (this.state.aggression === 'low') {
        this.state.aggression = 'medium';
      }
    }
  }

  // -------------------------------------------------------------------------
  // Serialization
  // -------------------------------------------------------------------------

  /**
   * Serialize KGB state for save/load.
   *
   * @returns Plain object snapshot of internal state
   */
  toJSON(): KGBState {
    return { ...this.state };
  }

  /**
   * Restore KGB state from a saved snapshot.
   *
   * @param data - Previously serialized KGBState
   */
  fromJSON(data: KGBState): void {
    this.state = { ...data };
  }

  // -------------------------------------------------------------------------
  // Accessors
  // -------------------------------------------------------------------------

  /** Current raw suspicion level (0-1). */
  getSuspicionLevel(): number {
    return this.state.suspicionLevel;
  }

  /** Current aggression setting. */
  getAggression(): 'low' | 'medium' | 'high' {
    return this.state.aggression;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /** Compute investigation intensity from current suspicion level. */
  private _computeIntensity(): 'routine' | 'thorough' | 'purge' {
    if (this.state.suspicionLevel >= 0.67) return 'purge';
    if (this.state.suspicionLevel >= 0.33) return 'thorough';
    return 'routine';
  }
}
