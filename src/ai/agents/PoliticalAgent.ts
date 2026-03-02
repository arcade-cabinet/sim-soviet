/**
 * @fileoverview PoliticalAgent — Era transitions, quota enforcement, 5-year plan management.
 *
 * This agent ABSORBS the logic previously split across:
 *   - src/game/era/EraSystem.ts (era progression + modifier blending)
 *   - src/ecs/systems/quotaSystem.ts (quota tracking)
 *   - src/game/PlanMandates.ts (mandate generation + fulfillment)
 *   - src/game/engine/annualReportTick.ts (annual report deadline + pripiski)
 *
 * The agent IS the system now. Old files are marked DEPRECATED.
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

// Re-export canonical types and definitions so callers can import from one place
export type { EraId, EraModifiers, EraDefinition, EraSystemSaveData, EraCheckpoint, ConstructionMethod } from '../../game/era/types';
export { ERA_ORDER, ERA_DEFINITIONS, ALL_BUILDING_IDS, eraIndexForYear } from '../../game/era/definitions';
export type { QuotaResourceType, ResourceQuota, QuotaState } from '../../ecs/systems/quotaSystem';
export type {
  BuildingMandate,
  MandateWithFulfillment,
  PlanMandateState,
} from '../../game/PlanMandates';

import { ERA_ORDER, ERA_DEFINITIONS, eraIndexForYear } from '../../game/era/definitions';
import type { EraId, EraModifiers, EraDefinition } from '../../game/era/types';
import type { QuotaState } from '../../ecs/systems/quotaSystem';
import { createDefaultQuota, areAllQuotasMet } from '../../ecs/systems/quotaSystem';
import type { BuildingMandate, MandateWithFulfillment, PlanMandateState } from '../../game/PlanMandates';
import {
  createMandatesForEra,
  createPlanMandateState,
  getMandateFulfillment,
  allMandatesComplete,
  recordBuildingPlaced,
} from '../../game/PlanMandates';
import type { DifficultyLevel } from '../../game/ScoringSystem';

// ---------------------------------------------------------------------------
// Constants (absorbed from annualReportTick.ts)
// ---------------------------------------------------------------------------

/** Maximum consecutive quota failures before game over. */
export const MAX_QUOTA_FAILURES = 3;

/** Fractional quota inflation applied when pripiski is used. */
export const PRIPISKI_QUOTA_INFLATION = 0.2;

/** Additional inspection probability per prior falsification incident. */
export const PRIPISKI_INSPECTION_BONUS = 0.15;

/** Quota overachievement ratio that triggers a raised quota next period. */
export const STAKHANOVITE_THRESHOLD = 1.15;

/** Number of ticks over which era modifiers blend from old era to new. */
const TRANSITION_TICKS = 10;

/** Difficulty multipliers applied to quota targets. */
export const DIFFICULTY_MULTIPLIERS: Record<DifficultyLevel, number> = {
  worker: 0.75,
  comrade: 1.0,
  tovarish: 1.5,
};

// ---------------------------------------------------------------------------
// State interface
// ---------------------------------------------------------------------------

/** Serializable internal state of the PoliticalAgent. */
export interface PoliticalState {
  // Era state (absorbed from EraSystem)
  /** Current game year for era tracking. */
  currentYear: number;
  /** Era ID before the most recent transition, or null. */
  previousEraId: EraId | null;
  /** Remaining ticks for modifier blending transition. */
  transitionTicksRemaining: number;

  // Quota state (absorbed from quotaSystem)
  /** Quota progress as a ratio (0-1) relative to target. */
  quotaProgress: number;
  /** Absolute quota target for the current 5-year plan period. */
  quotaTarget: number;
  /** Primary quota type being tracked. */
  quotaType: 'food' | 'vodka';
  /** Year when the current plan deadline falls. */
  deadlineYear: number;
  /** Multi-resource quota targets (food, vodka, steel, timber, power). */
  resourceQuotas: QuotaState['resourceQuotas'];

  // Annual report state (absorbed from annualReportTick.ts)
  /** Number of consecutive quota failures (3 = game over). */
  consecutiveFailures: number;
  /** Count of past successful pripiski (falsification) incidents. */
  pripiskiHistory: number;

  // Mandate state (absorbed from PlanMandates)
  /** Current plan's building mandates with fulfillment tracking. */
  mandates: MandateWithFulfillment[];
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
 *
 * Absorbs:
 *   - EraSystem: era detection, modifier blending, building gates
 *   - quotaSystem: multi-resource quota tracking
 *   - PlanMandates: mandate generation + fulfillment tracking
 *   - annualReportTick: pripiski risk, consecutive failures, report strategy
 */
export class PoliticalAgent extends Vehicle {
  private state: PoliticalState;

  /** Snapshot of old modifiers during a blend transition. */
  private transitionFromModifiers: EraModifiers | null = null;

  constructor(startYear = 1917) {
    super();
    this.name = 'PoliticalAgent';
    this.state = {
      currentYear: startYear,
      previousEraId: null,
      transitionTicksRemaining: 0,
      quotaProgress: 0,
      quotaTarget: 500,
      quotaType: 'food',
      deadlineYear: 1922,
      resourceQuotas: createDefaultQuota().resourceQuotas,
      consecutiveFailures: 0,
      pripiskiHistory: 0,
      mandates: [],
    };
  }

  // =========================================================================
  // Era management (absorbed from EraSystem)
  // =========================================================================

  /**
   * Get the full definition of the current era based on the tracked year.
   *
   * @returns Current era definition
   */
  getCurrentEraDefinition(): EraDefinition {
    const idx = eraIndexForYear(this.state.currentYear);
    const eraId = ERA_ORDER[idx]!;
    return ERA_DEFINITIONS[eraId];
  }

  /**
   * Get the current era ID.
   *
   * @returns Current EraId string
   */
  getCurrentEraId(): EraId {
    return this.getCurrentEraDefinition().id;
  }

  /**
   * Get the current era index (0-7).
   *
   * @returns Index into ERA_ORDER
   */
  getCurrentEraIndex(): number {
    return eraIndexForYear(this.state.currentYear);
  }

  /**
   * Get current era as a simplified EraDefinition-compatible object.
   * Provided for backward compatibility with tests.
   *
   * @returns Current era definition
   */
  getCurrentEra(): EraDefinition {
    return this.getCurrentEraDefinition();
  }

  /**
   * Check whether advancing to the given year crosses into a new era.
   * Updates internal year, starts modifier blend, returns new era or null.
   *
   * Absorbed from EraSystem.checkTransition().
   *
   * @param year - Calendar year to advance to
   * @returns New EraDefinition if transition occurred, null otherwise.
   *          Also returns the new era index (0-7) for backward compat via overload.
   */
  checkEraTransition(year: number): EraDefinition | null {
    const oldEra = this.getCurrentEraDefinition();
    this.state.currentYear = year;
    const newEra = this.getCurrentEraDefinition();

    if (newEra.id !== oldEra.id) {
      this.state.previousEraId = oldEra.id;
      this.transitionFromModifiers = { ...oldEra.modifiers };
      this.state.transitionTicksRemaining = TRANSITION_TICKS;
      return newEra;
    }

    return null;
  }

  /**
   * Advance the modifier blend by one tick.
   * Call once per simulation tick while transitioning.
   *
   * Absorbed from EraSystem.tickTransition().
   *
   * @returns true if a transition is still in progress
   */
  tickTransition(): boolean {
    if (this.state.transitionTicksRemaining > 0) {
      this.state.transitionTicksRemaining--;
      if (this.state.transitionTicksRemaining <= 0) {
        this.transitionFromModifiers = null;
      }
      return true;
    }
    return false;
  }

  /**
   * Check if a modifier blend transition is currently in progress.
   *
   * @returns true if transitioning
   */
  isTransitioning(): boolean {
    return this.state.transitionTicksRemaining > 0;
  }

  /**
   * Get blended era modifiers. During a transition, linearly interpolates
   * from old era modifiers toward new era modifiers.
   *
   * Absorbed from EraSystem.getModifiers().
   *
   * @returns Blended EraModifiers
   */
  getModifiers(): EraModifiers {
    const target = this.getCurrentEraDefinition().modifiers;

    if (this.state.transitionTicksRemaining > 0 && this.transitionFromModifiers) {
      const t = 1 - this.state.transitionTicksRemaining / TRANSITION_TICKS;
      return this._lerpModifiers(this.transitionFromModifiers, target, t);
    }

    return { ...target };
  }

  /**
   * Get buildings available in the current era (cumulative — includes prior eras).
   *
   * Absorbed from EraSystem.getAvailableBuildings().
   *
   * @returns Array of building defIds
   */
  getAvailableBuildings(): string[] {
    const currentIdx = eraIndexForYear(this.state.currentYear);
    const available: string[] = [];
    for (let i = 0; i <= currentIdx; i++) {
      const eraId = ERA_ORDER[i]!;
      available.push(...ERA_DEFINITIONS[eraId].unlockedBuildings);
    }
    return available;
  }

  /**
   * Check if a specific building defId is available in the current era.
   *
   * @param defId - Building definition ID
   * @returns true if the building is unlocked
   */
  isBuildingAvailable(defId: string): boolean {
    return this.getAvailableBuildings().includes(defId);
  }

  /**
   * Get the era ID before the most recent transition.
   *
   * @returns Previous EraId or null
   */
  getPreviousEraId(): EraId | null {
    return this.state.previousEraId;
  }

  /**
   * Get the tracked game year.
   *
   * @returns Current year
   */
  getYear(): number {
    return this.state.currentYear;
  }

  // =========================================================================
  // Quota management (absorbed from quotaSystem.ts)
  // =========================================================================

  /**
   * Update the quota progress ratio and optionally the absolute target.
   *
   * Absorbed from existing PoliticalAgent.updateQuota() + quotaSystem tracking.
   *
   * @param progress - Quota completion ratio (0-1), clamped
   * @param target - New absolute quota target (optional)
   */
  updateQuota(progress: number, target?: number): void {
    this.state.quotaProgress = Math.max(0, Math.min(1, progress));
    if (target !== undefined) {
      this.state.quotaTarget = target;
    }
  }

  /**
   * Update multi-resource quota progress from current resource values.
   *
   * Absorbed from quotaSystem() function.
   *
   * @param resources - Current resource levels keyed by resource type
   */
  syncResourceQuotas(resources: {
    food?: number;
    vodka?: number;
    steel?: number;
    timber?: number;
    power?: number;
  }): void {
    if (!this.state.resourceQuotas) return;
    const rq = this.state.resourceQuotas;
    if (rq.food && resources.food !== undefined) rq.food.current = resources.food;
    if (rq.vodka && resources.vodka !== undefined) rq.vodka.current = resources.vodka;
    if (rq.steel && resources.steel !== undefined) rq.steel.current = resources.steel;
    if (rq.timber && resources.timber !== undefined) rq.timber.current = resources.timber;
    if (rq.power && resources.power !== undefined) rq.power.current = resources.power;

    // Sync primary quota progress from the tracked resource type
    const primaryValue = this.state.quotaType === 'food'
      ? (resources.food ?? 0)
      : (resources.vodka ?? 0);
    this.state.quotaProgress = this.state.quotaTarget > 0
      ? Math.min(1, primaryValue / this.state.quotaTarget)
      : 0;
  }

  /**
   * Check if all multi-resource quotas are met.
   *
   * Absorbed from areAllQuotasMet() in quotaSystem.ts.
   *
   * @returns true if all quota targets are met or exceeded
   */
  areAllQuotasMet(): boolean {
    const quota: QuotaState = {
      type: this.state.quotaType,
      target: this.state.quotaTarget,
      current: this.state.quotaProgress * this.state.quotaTarget,
      deadlineYear: this.state.deadlineYear,
      resourceQuotas: this.state.resourceQuotas,
    };
    return areAllQuotasMet(quota);
  }

  /** @returns Current quota progress ratio (0-1). */
  getQuotaProgress(): number {
    return this.state.quotaProgress;
  }

  /** @returns Current quota target (absolute). */
  getQuotaTarget(): number {
    return this.state.quotaTarget;
  }

  /** @returns Current primary quota type. */
  getQuotaType(): 'food' | 'vodka' {
    return this.state.quotaType;
  }

  /**
   * Advance the plan to a new 5-year period with a new quota type + target.
   *
   * Absorbed from handleQuotaMet() in annualReportTick.ts.
   *
   * @param type - Primary resource type for new plan
   * @param target - Absolute target for new plan period
   * @param deadlineYear - Year the new plan is due
   */
  advancePlan(type: 'food' | 'vodka', target: number, deadlineYear: number): void {
    this.state.quotaType = type;
    this.state.quotaTarget = target;
    this.state.deadlineYear = deadlineYear;
    this.state.quotaProgress = 0;
    // Reset multi-resource quota currents
    if (this.state.resourceQuotas) {
      for (const rq of Object.values(this.state.resourceQuotas)) {
        if (rq) rq.current = 0;
      }
    }
  }

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

  // =========================================================================
  // Quota urgency (from existing PoliticalAgent)
  // =========================================================================

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

  // =========================================================================
  // Annual report + pripiski (absorbed from annualReportTick.ts)
  // =========================================================================

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

  /**
   * Recommend whether to submit an honest annual report or falsify (pripiski).
   *
   * Absorbed from existing PoliticalAgent.evaluateReportStrategy().
   *
   * Decision heuristic:
   *   - Quota met (>=100%)          → honest (no need to falsify)
   *   - Small shortfall (<20%)      → honest (risk not worth it)
   *   - Moderate shortfall (20-50%) with low inspection risk → falsify
   *   - Large shortfall (>50%)      → honest (too obvious)
   *   - High prior pripiski         → honest (inspection risk too high)
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
   * Compute the falsification risk percentage for a single field.
   *
   * Absorbed from falsificationRisk() in annualReportTick.ts.
   *
   * @param actual - Actual value
   * @param reported - Reported value
   * @returns Risk as a percentage (0-100)
   */
  computeFalsificationRisk(actual: number, reported: number): number {
    if (actual === 0 && reported === 0) return 0;
    if (actual === 0) return 100;
    return Math.round((Math.abs(reported - actual) / actual) * 100);
  }

  /**
   * Compute the aggregate investigation probability for a falsified report.
   *
   * Absorbed from processReport() in annualReportTick.ts.
   *
   * @param quotaRisk - Risk percent for quota field (0-100)
   * @param secRisk - Risk percent for secondary resource field (0-100)
   * @param popRisk - Risk percent for population field (0-100)
   * @param blatLevel - Current blat resource for insurance reduction
   * @returns Investigation probability (0-1)
   */
  computeInvestigationProbability(
    quotaRisk: number,
    secRisk: number,
    popRisk: number,
    blatLevel = 0,
  ): number {
    const maxRisk = Math.max(quotaRisk, secRisk, popRisk);
    const historyBonus = this.state.pripiskiHistory * PRIPISKI_INSPECTION_BONUS;
    const blatInsurance = Math.min(0.25, blatLevel * 0.005);
    return Math.min(0.8, Math.max(0, maxRisk / 100 + historyBonus - blatInsurance));
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

  // =========================================================================
  // Stakhanovite threshold
  // =========================================================================

  /**
   * Determine whether Stakhanovite performance triggers a raised quota.
   *
   * @param quotaPercent - Fraction of quota achieved (e.g. 1.2 = 120%)
   * @returns true if next quota should be raised
   */
  shouldRaiseDifficulty(quotaPercent: number): boolean {
    return quotaPercent >= STAKHANOVITE_THRESHOLD;
  }

  // =========================================================================
  // Building mandates (absorbed from PlanMandates.ts)
  // =========================================================================

  /**
   * Generate building mandates for the current era and given difficulty.
   * Replaces the old plan's mandates with new ones (all fulfillment starts at 0).
   *
   * Absorbed from createMandatesForEra() + createPlanMandateState() in PlanMandates.ts.
   *
   * @param difficulty - Game difficulty level
   */
  generateMandatesForCurrentEra(difficulty: DifficultyLevel): void {
    const eraId = this.getCurrentEraId();
    const mandates = createMandatesForEra(eraId, difficulty);
    const state: PlanMandateState = createPlanMandateState(mandates);
    this.state.mandates = state.mandates;
  }

  /**
   * Record that a building was placed. Increments fulfillment for matching mandates.
   *
   * Absorbed from recordBuildingPlaced() in PlanMandates.ts.
   *
   * @param buildingDefId - The building definition ID that was placed
   */
  recordBuildingPlaced(buildingDefId: string): void {
    const planState: PlanMandateState = { mandates: this.state.mandates };
    const updated = recordBuildingPlaced(planState, buildingDefId);
    this.state.mandates = updated.mandates;
  }

  /**
   * Get the overall mandate fulfillment ratio (0.0 - 1.0).
   *
   * Absorbed from getMandateFulfillment() in PlanMandates.ts.
   *
   * @returns Fulfillment ratio capped at 1.0
   */
  getMandateFulfillment(): number {
    return getMandateFulfillment({ mandates: this.state.mandates });
  }

  /**
   * Check if all building mandates are complete.
   *
   * Absorbed from allMandatesComplete() in PlanMandates.ts.
   *
   * @returns true if all mandates fulfilled
   */
  allMandatesComplete(): boolean {
    return allMandatesComplete({ mandates: this.state.mandates });
  }

  /**
   * Get current building mandates (read-only copy).
   *
   * @returns Array of mandates with fulfillment state
   */
  getMandates(): ReadonlyArray<MandateWithFulfillment> {
    return [...this.state.mandates];
  }

  // =========================================================================
  // Telegram message type constants
  // =========================================================================

  /** Telegram type constants relevant to the PoliticalAgent. */
  static readonly MSG = {
    ERA_TRANSITION: MSG.ERA_TRANSITION,
    QUOTA_DEADLINE: MSG.QUOTA_DEADLINE,
    PLAN_UPDATED: MSG.PLAN_UPDATED,
    ANNUAL_REPORT_DUE: MSG.ANNUAL_REPORT_DUE,
    NEW_YEAR: MSG.NEW_YEAR,
    REPORT_SUBMITTED: MSG.REPORT_SUBMITTED,
  } as const;

  // =========================================================================
  // Yuka Vehicle update
  // =========================================================================

  /**
   * Per-frame update called by Yuka's EntityManager.
   * Advances the modifier blend transition.
   *
   * @param delta - Delta time in seconds
   */
  update(delta: number): this {
    super.update(delta);
    this.tickTransition();
    return this;
  }

  // =========================================================================
  // Serialization
  // =========================================================================

  /**
   * Serialize agent state to a plain JSON-safe object.
   *
   * @returns Plain object suitable for JSON.stringify
   */
  toJSON(): PoliticalState {
    return {
      ...this.state,
      mandates: [...this.state.mandates],
      resourceQuotas: this.state.resourceQuotas
        ? { ...this.state.resourceQuotas }
        : undefined,
    };
  }

  /**
   * Restore agent state from a previously serialized object.
   *
   * @param data - Previously returned from toJSON()
   */
  fromJSON(data: PoliticalState): void {
    this.state = {
      ...data,
      mandates: data.mandates ? [...data.mandates] : [],
      resourceQuotas: data.resourceQuotas ? { ...data.resourceQuotas } : undefined,
    };
    // Restore transition modifiers if a transition was in progress
    if (this.state.transitionTicksRemaining > 0 && this.state.previousEraId) {
      const prevDef = ERA_DEFINITIONS[this.state.previousEraId];
      if (prevDef) {
        this.transitionFromModifiers = { ...prevDef.modifiers };
      }
    }
  }

  // =========================================================================
  // Private helpers
  // =========================================================================

  /** Linearly interpolate between two modifier sets. t in [0, 1]. */
  private _lerpModifiers(from: EraModifiers, to: EraModifiers, t: number): EraModifiers {
    return {
      productionMult: from.productionMult + (to.productionMult - from.productionMult) * t,
      consumptionMult: from.consumptionMult + (to.consumptionMult - from.consumptionMult) * t,
      decayMult: from.decayMult + (to.decayMult - from.decayMult) * t,
      populationGrowthMult: from.populationGrowthMult + (to.populationGrowthMult - from.populationGrowthMult) * t,
      eventFrequencyMult: from.eventFrequencyMult + (to.eventFrequencyMult - from.eventFrequencyMult) * t,
      corruptionMult: from.corruptionMult + (to.corruptionMult - from.corruptionMult) * t,
    };
  }
}
