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
import { MSG } from '../../telegrams';

// Re-export canonical types and definitions so callers can import from one place
export type { EraId, EraModifiers, EraDefinition, EraSystemSaveData, EraCheckpoint, ConstructionMethod } from '../../../game/era/types';
export { ERA_ORDER, ERA_DEFINITIONS, ALL_BUILDING_IDS, eraIndexForYear } from '../../../game/era/definitions';

import { ERA_ORDER, ERA_DEFINITIONS, ALL_BUILDING_IDS, eraIndexForYear } from '../../../game/era/definitions';
import type { EraId, EraModifiers, EraDefinition, ConstructionMethod, EraCheckpoint, EraSystemSaveData } from '../../../game/era/types';
import type { Doctrine } from './CompulsoryDeliveries';
import type { CompulsoryDeliveries } from './CompulsoryDeliveries';
import type { SettlementTier } from '../infrastructure/SettlementSystem';
import type { SettlementSystem } from '../infrastructure/SettlementSystem';
import { tierMeetsRequirement, getBuildingTierRequirement } from '../../../game/era/tiers';
import { buildingsLogic, getMetaEntity, getResourceEntity } from '../../../ecs/archetypes';
import type { DifficultyLevel } from './ScoringSystem';
import { eraIdToIndex } from './ScoringSystem';
import type { ScoringSystem } from './ScoringSystem';
import type { SimCallbacks } from '../../../game/engine/types';
import type { PoliticalEntitySystem } from './PoliticalEntitySystem';
import { addPaperwork, getPaperwork } from './doctrine';
import type { WorkerSystem } from '../workforce/WorkerSystem';
import type { KGBAgent } from './KGBAgent';
import type { PolitburoSystem } from '../narrative/politburo';
import type { GameRng } from '../../../game/SeedSystem';
import { TICKS_PER_YEAR } from '../../../game/Chronology';
import type { EraId as EconomyEraId } from '../economy/EconomyAgent';
import type { EconomyAgent } from '../economy/EconomyAgent';
import type { TransportSystem } from '../infrastructure/TransportSystem';
import type { ChronologyAgent } from '../core/ChronologyAgent';

/** Maps game EraSystem IDs → EconomySystem EraIds. */
const GAME_ERA_TO_ECONOMY_ERA: Record<string, EconomyEraId> = {
  revolution: 'revolution',
  collectivization: 'industrialization',
  industrialization: 'industrialization',
  great_patriotic: 'wartime',
  reconstruction: 'reconstruction',
  thaw_and_freeze: 'thaw',
  stagnation: 'stagnation',
  the_eternal: 'eternal',
};

// ─────────────────────────────────────────────────────────────────────────────
// Quota types + logic (absorbed from ecs/systems/quotaSystem.ts)
// ─────────────────────────────────────────────────────────────────────────────

/** Trackable resource types for the multi-resource quota system. */
export type QuotaResourceType = 'food' | 'vodka' | 'steel' | 'timber' | 'power';

/** Per-resource quota target and current progress. */
export interface ResourceQuota {
  target: number;
  current: number;
}

/**
 * Quota state — tracks the current 5-year plan goals.
 */
export interface QuotaState {
  /** Primary resource type being tracked (legacy single-resource quota) */
  type: 'food' | 'vodka';
  /** Primary target amount to reach */
  target: number;
  /** Primary current progress */
  current: number;
  /** Year the quota must be met by */
  deadlineYear: number;
  /** Multi-resource quota targets. If present, all must be met. */
  resourceQuotas?: Partial<Record<QuotaResourceType, ResourceQuota>>;
}

/**
 * Creates the default initial quota state for the first 5-year plan.
 */
export function createDefaultQuota(): QuotaState {
  return {
    type: 'food',
    target: 500,
    current: 0,
    deadlineYear: 1927,
    resourceQuotas: {
      food: { target: 500, current: 0 },
      vodka: { target: 100, current: 0 },
      steel: { target: 50, current: 0 },
      timber: { target: 100, current: 0 },
      power: { target: 20, current: 0 },
    },
  };
}

/**
 * Runs the quota tracking system for one simulation tick.
 */
export function quotaSystem(quota: QuotaState): void {
  const store = getResourceEntity();
  if (!store) return;

  switch (quota.type) {
    case 'food':
      quota.current = store.resources.food;
      break;
    case 'vodka':
      quota.current = store.resources.vodka;
      break;
  }

  if (quota.resourceQuotas) {
    const r = store.resources;
    const rq = quota.resourceQuotas;
    if (rq.food) rq.food.current = r.food;
    if (rq.vodka) rq.vodka.current = r.vodka;
    if (rq.steel) rq.steel.current = r.steel;
    if (rq.timber) rq.timber.current = r.timber;
    if (rq.power) rq.power.current = r.power;
  }
}

/**
 * Checks if all multi-resource quotas are met.
 */
export function areAllQuotasMet(quota: QuotaState): boolean {
  if (!quota.resourceQuotas) return quota.current >= quota.target;
  for (const rq of Object.values(quota.resourceQuotas)) {
    if (rq && rq.current < rq.target) return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// PlanMandates types + logic (absorbed from game/PlanMandates.ts)
// ─────────────────────────────────────────────────────────────────────────────

/** A single building construction mandate from the 5-Year Plan. */
export interface BuildingMandate {
  /** Building definition ID */
  defId: string;
  /** Number of this building required */
  required: number;
  /** Display label */
  label: string;
}

/** A mandate with fulfillment tracking. */
export interface MandateWithFulfillment extends BuildingMandate {
  /** Number of this building placed so far */
  fulfilled: number;
}

/** State for the current plan's mandates. */
export interface PlanMandateState {
  mandates: MandateWithFulfillment[];
}

interface MandateTemplate {
  defId: string;
  label: string;
  baseRequired: number;
}

const ERA_MANDATE_TEMPLATES: Record<string, MandateTemplate[]> = {
  revolution: [
    { defId: 'workers-house-a', label: 'Workers Housing', baseRequired: 2 },
    { defId: 'collective-farm-hq', label: 'Collective Farm HQ', baseRequired: 1 },
    { defId: 'guard-post', label: 'Guard Post', baseRequired: 1 },
  ],
  collectivization: [
    { defId: 'workers-house-b', label: 'Workers Housing B', baseRequired: 2 },
    { defId: 'warehouse', label: 'Warehouse', baseRequired: 1 },
    { defId: 'school', label: 'School', baseRequired: 1 },
  ],
  industrialization: [
    { defId: 'power-station', label: 'Power Station', baseRequired: 1 },
    { defId: 'factory-office', label: 'Factory Office', baseRequired: 1 },
    { defId: 'vodka-distillery', label: 'Vodka Distillery', baseRequired: 1 },
  ],
  great_patriotic: [
    { defId: 'barracks', label: 'Military Barracks', baseRequired: 2 },
    { defId: 'hospital', label: 'Field Hospital', baseRequired: 1 },
    { defId: 'guard-post', label: 'Guard Post', baseRequired: 2 },
  ],
  reconstruction: [
    { defId: 'workers-house-a', label: 'Workers Housing', baseRequired: 3 },
    { defId: 'power-station', label: 'Power Station', baseRequired: 1 },
    { defId: 'bread-factory', label: 'Bread Factory', baseRequired: 1 },
  ],
  thaw_and_freeze: [
    { defId: 'apartment-tower-a', label: 'Apartment Tower', baseRequired: 2 },
    { defId: 'cultural-palace', label: 'Cultural Palace', baseRequired: 1 },
    { defId: 'polyclinic', label: 'Polyclinic', baseRequired: 1 },
  ],
  stagnation: [
    { defId: 'apartment-tower-b', label: 'Apartment Tower B', baseRequired: 3 },
    { defId: 'ministry-office', label: 'Ministry Office', baseRequired: 1 },
    { defId: 'workers-club', label: 'Workers Club', baseRequired: 1 },
  ],
  the_eternal: [
    { defId: 'apartment-tower-d', label: 'Apartment Tower D', baseRequired: 3 },
    { defId: 'government-hq', label: 'Government HQ', baseRequired: 1 },
    { defId: 'kgb-office', label: 'KGB Office', baseRequired: 1 },
    { defId: 'train-station', label: 'Train Station', baseRequired: 1 },
  ],
};

/** Mandate difficulty scaling. */
const MANDATE_DIFFICULTY_MULTIPLIERS: Record<DifficultyLevel, number> = {
  worker: 0.75,
  comrade: 1.0,
  tovarish: 1.5,
};

/**
 * Generate building mandates for a given era and difficulty.
 * Returns an array of mandates with required counts scaled by difficulty.
 */
export function createMandatesForEra(eraId: string, difficulty: DifficultyLevel): BuildingMandate[] {
  const templates = ERA_MANDATE_TEMPLATES[eraId];
  if (!templates) {
    console.warn(`[PlanMandates] Unknown era ID "${eraId}", falling back to revolution`);
  }
  const resolved = templates ?? ERA_MANDATE_TEMPLATES.revolution!;
  const mult = MANDATE_DIFFICULTY_MULTIPLIERS[difficulty];

  return resolved.map((t) => ({
    defId: t.defId,
    label: t.label,
    required: Math.max(1, Math.round(t.baseRequired * mult)),
  }));
}

/**
 * Create a fresh mandate tracking state from a list of mandates.
 * All fulfillment counts start at 0.
 */
export function createPlanMandateState(mandates: BuildingMandate[]): PlanMandateState {
  return {
    mandates: mandates.map((m) => ({ ...m, fulfilled: 0 })),
  };
}

/**
 * Record that a building was placed. Increments fulfillment for matching mandates.
 * Returns a new state (immutable).
 */
export function recordBuildingPlaced(state: PlanMandateState, buildingDefId: string): PlanMandateState {
  return {
    mandates: state.mandates.map((m) => (m.defId === buildingDefId ? { ...m, fulfilled: m.fulfilled + 1 } : m)),
  };
}

/**
 * Get the overall mandate fulfillment ratio (0.0 - 1.0).
 * Calculated as total fulfilled / total required (capped at 1.0 per mandate).
 */
export function getMandateFulfillment(state: PlanMandateState): number {
  if (state.mandates.length === 0) return 1;

  const totalRequired = state.mandates.reduce((sum, m) => sum + m.required, 0);
  if (totalRequired === 0) return 1;

  const totalFulfilled = state.mandates.reduce((sum, m) => sum + Math.min(m.fulfilled, m.required), 0);
  return totalFulfilled / totalRequired;
}

/** Check if a single mandate is complete (fulfilled >= required). */
export function isMandateComplete(mandate: MandateWithFulfillment): boolean {
  return mandate.fulfilled >= mandate.required;
}

/** Check if all mandates in the state are complete. */
export function allMandatesComplete(state: PlanMandateState): boolean {
  return state.mandates.every(isMandateComplete);
}

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

  // Checkpoint state (absorbed from EraSystem)
  /** Era-keyed checkpoints for save/restore. */
  checkpoints: Map<EraId, EraCheckpoint>;
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
      checkpoints: new Map(),
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
   * Alias for checkEraTransition (backward compat with old EraSystem API).
   */
  checkTransition(year: number): EraDefinition | null {
    return this.checkEraTransition(year);
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
   * Optionally filters by settlement tier.
   *
   * Absorbed from EraSystem.getAvailableBuildings().
   *
   * @param tier - Optional settlement tier to filter by
   * @returns Array of building defIds
   */
  getAvailableBuildings(tier?: SettlementTier): string[] {
    const currentIdx = eraIndexForYear(this.state.currentYear);
    const available: string[] = [];
    for (let i = 0; i <= currentIdx; i++) {
      const eraId = ERA_ORDER[i]!;
      available.push(...ERA_DEFINITIONS[eraId].unlockedBuildings);
    }
    if (!tier) return available;
    return available.filter((defId) => tierMeetsRequirement(tier, getBuildingTierRequirement(defId)));
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

  /**
   * Get the doctrine for the current era.
   * Absorbed from EraSystem.getDoctrine().
   */
  getDoctrine(): Doctrine {
    return this.getCurrentEra().doctrine;
  }

  /**
   * Get the delivery rates for the current era.
   * Absorbed from EraSystem.getDeliveryRates().
   */
  getDeliveryRates(): { food: number; vodka: number; money: number } {
    return { ...this.getCurrentEra().deliveryRates };
  }

  /**
   * Get quota escalation multiplier for the current era.
   * Absorbed from EraSystem.getQuotaEscalation().
   */
  getQuotaEscalation(): number {
    return this.getCurrentEra().quotaEscalation;
  }

  /**
   * Get the construction method for the current era.
   * Absorbed from EraSystem.getConstructionMethod().
   */
  getConstructionMethod(): ConstructionMethod {
    return this.getCurrentEra().constructionMethod;
  }

  /**
   * Get the construction time multiplier for the current era.
   * Absorbed from EraSystem.getConstructionTimeMult().
   */
  getConstructionTimeMult(): number {
    return this.getCurrentEra().constructionTimeMult;
  }

  /**
   * Get buildings that are NOT yet available (locked by era).
   * Absorbed from EraSystem.getLockedBuildings().
   */
  getLockedBuildings(): string[] {
    const available = new Set(this.getAvailableBuildings());
    return ALL_BUILDING_IDS.filter((id) => !available.has(id));
  }

  /**
   * Save a checkpoint for the current era.
   * Absorbed from EraSystem.saveCheckpoint().
   */
  saveCheckpoint(snapshot: string): void {
    const era = this.getCurrentEra();
    this.state.checkpoints.set(era.id, {
      eraId: era.id,
      year: this.state.currentYear,
      snapshot,
    });
  }

  /**
   * Find which era unlocks a given building.
   * Absorbed from EraSystem.getBuildingUnlockEra().
   */
  getBuildingUnlockEra(defId: string): EraDefinition | null {
    for (const eraId of ERA_ORDER) {
      const def = ERA_DEFINITIONS[eraId];
      if (def.unlockedBuildings.includes(defId)) {
        return def;
      }
    }
    return null;
  }

  /**
   * Get the saved checkpoint for a given era.
   * Absorbed from EraSystem.getCheckpoint().
   */
  getCheckpoint(eraId: EraId): EraCheckpoint | null {
    return this.state.checkpoints.get(eraId) ?? null;
  }

  /**
   * Get all saved checkpoints.
   * Absorbed from EraSystem.getAllCheckpoints().
   */
  getAllCheckpoints(): ReadonlyMap<EraId, EraCheckpoint> {
    return this.state.checkpoints;
  }

  /**
   * Check if a checkpoint exists for a given era.
   * Absorbed from EraSystem.hasCheckpoint().
   */
  hasCheckpoint(eraId: EraId): boolean {
    return this.state.checkpoints.has(eraId);
  }

  /**
   * Serialize era system state for save/load.
   * Absorbed from EraSystem.serialize().
   */
  serialize(): EraSystemSaveData {
    return {
      currentYear: this.state.currentYear,
      previousEraId: this.state.previousEraId,
      transitionTicksRemaining: this.state.transitionTicksRemaining,
    };
  }

  /**
   * Restore a PoliticalAgent from serialized era state.
   * Absorbed from EraSystem.deserialize().
   */
  static deserialize(data: EraSystemSaveData): PoliticalAgent {
    const agent = new PoliticalAgent(data.currentYear);
    agent.state.previousEraId = data.previousEraId;
    agent.state.transitionTicksRemaining = data.transitionTicksRemaining ?? 0;
    return agent;
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
  // Absorbed SimulationEngine methods
  // =========================================================================

  /**
   * Tick political entities — sync counts, conscription, orgnabor, doctrine effects.
   * Absorbs SimulationEngine.tickPoliticalEntities().
   *
   * @param deps - All dependencies previously accessed via `this` in SimulationEngine
   */
  public tickEntitiesFull(deps: {
    politicalEntities: PoliticalEntitySystem;
    workers: WorkerSystem;
    kgb: KGBAgent;
    scoring: ScoringSystem;
    callbacks: SimCallbacks;
    settlement: SettlementSystem;
    politburo: PolitburoSystem;
    quota: { target: number; current: number };
    rng: GameRng | undefined;
    chronologyTotalTicks: number;
  }): void {
    const totalTicks = deps.chronologyTotalTicks;
    const store = getResourceEntity();
    const meta = getMetaEntity();
    const tier = deps.settlement.getCurrentTier();
    const eraId = this.getCurrentEraId();

    // Sync entity counts every 30 ticks (roughly every 10 days)
    if (totalTicks % 30 === 0) {
      const avgCorruption = this._getAveragePolitburoCorruption(deps.politburo);
      deps.politicalEntities.syncEntities(tier, eraId, avgCorruption);

      // Threshold effects → entity spawning: higher threat = more KGB/politruks
      const threatLevel = deps.kgb.getThreatLevel();
      if (threatLevel === 'investigated' || threatLevel === 'reviewed') {
        // Extra KGB and politruk presence when under investigation
        deps.politicalEntities.syncEntities(tier, eraId, avgCorruption + 30);
      }
    }

    // Orgnabor — periodic organized labor recruitment during industrialization eras
    // Fires every ~180 ticks (half a year) during collectivization/industrialization and reconstruction
    if (
      totalTicks % 180 === 0 &&
      (eraId === 'collectivization' || eraId === 'industrialization' || eraId === 'reconstruction') &&
      store
    ) {
      const pop = store.resources.population;
      if (pop >= 15) {
        const count = Math.min(Math.max(2, Math.floor(pop * 0.05)), 5);
        const duration = 60 + Math.floor(Math.random() * 60); // 60-120 ticks
        const purpose =
          eraId === 'reconstruction'
            ? 'post-war reconstruction of the Motherland'
            : 'the Great Construction of Socialism';
        deps.politicalEntities.triggerOrgnabor(count, duration, purpose);
      }
    }

    // Build doctrine context for era-specific mechanics
    const currentEraDef = this.getCurrentEra();
    const gameStartYear = 1917; // Game always starts at 1917
    const eraStartTick = (currentEraDef.startYear - gameStartYear) * TICKS_PER_YEAR;
    const doctrineCtx =
      deps.rng && store
        ? {
            currentEraId: eraId,
            totalTicks,
            currentFood: store.resources.food,
            currentPop: store.resources.population,
            currentMoney: store.resources.money,
            quotaProgress: deps.quota.target > 0 ? deps.quota.current / deps.quota.target : 0,
            rng: deps.rng,
            eraStartTick,
            currentPaperwork: getPaperwork(),
          }
        : undefined;

    const result = deps.politicalEntities.tick(totalTicks, doctrineCtx);

    // Apply population drain from conscription — males 18-51 first (historical accuracy)
    if (result.workersConscripted > 0) {
      deps.workers.removeWorkersByCountMaleFirst(result.workersConscripted, 'conscription');
      deps.scoring.onConscription(result.workersConscripted);
    }

    // Apply population return from orgnabor/conscription — creates dvor-linked citizens
    if (result.workersReturned > 0) {
      deps.workers.spawnInflowDvor(result.workersReturned, 'returned');
    }

    // Apply KGB worker arrests — route through WorkerSystem
    if (result.workersArrested > 0) {
      for (let i = 0; i < result.workersArrested; i++) {
        deps.workers.arrestWorker();
      }
      deps.scoring.onKGBLoss(result.workersArrested);
    }

    // Apply KGB black marks to personnel file
    if (result.blackMarksAdded > 0) {
      deps.scoring.onKGBLoss(result.blackMarksAdded);
    }
    for (let i = 0; i < result.blackMarksAdded; i++) {
      deps.kgb.addMark('lying_to_kgb', totalTicks, 'KGB investigation uncovered irregularities');
    }

    // Apply doctrine mechanic effects to resources
    for (const effect of result.doctrineMechanicEffects) {
      if (store) {
        store.resources.food = Math.max(0, store.resources.food + effect.foodDelta);
        store.resources.money = Math.max(0, store.resources.money + effect.moneyDelta);
        store.resources.vodka = Math.max(0, store.resources.vodka + effect.vodkaDelta);
        if (effect.popDelta !== 0) {
          if (effect.popDelta > 0) {
            deps.workers.spawnInflowDvor(effect.popDelta, 'doctrine');
          } else {
            deps.workers.removeWorkersByCount(-effect.popDelta, 'doctrine');
          }
        }
      }
      // Track paperwork accumulation from doctrine effects
      if (effect.paperworkDelta && effect.paperworkDelta > 0) {
        addPaperwork(effect.paperworkDelta);
      }
      if (effect.description) {
        deps.callbacks.onToast(effect.description, 'warning');
      }
    }

    // Emit announcements
    for (const announcement of result.announcements) {
      deps.callbacks.onToast(announcement, 'warning');
    }

    // Sync to meta for React
    if (meta) {
      meta.gameMeta.blackMarks = deps.kgb.getBlackMarks();
      meta.gameMeta.commendations = deps.kgb.getCommendations();
      meta.gameMeta.threatLevel = deps.kgb.getThreatLevel();
    }
  }

  /**
   * Handle era transition with ALL downstream effects.
   * Absorbs SimulationEngine.checkEraTransition().
   *
   * @param deps - All dependencies previously accessed via `this` in SimulationEngine
   */
  public handleEraTransitionFull(deps: {
    year: number;
    deliveries: CompulsoryDeliveries;
    economy: EconomyAgent;
    transport: TransportSystem;
    workers: WorkerSystem;
    kgb: KGBAgent;
    scoring: ScoringSystem;
    callbacks: SimCallbacks;
    difficulty: DifficultyLevel;
    chronology: ChronologyAgent;
  }): void {
    const newEra = this.checkEraTransition(deps.year);

    if (newEra) {
      // Score the completed era before transitioning
      const prevEraId = this.getPreviousEraId();
      if (prevEraId) {
        const prevEraIdx = eraIdToIndex(prevEraId);
        const store = getResourceEntity();
        const prevEraDef = ERA_DEFINITIONS[prevEraId];
        deps.scoring.onEraEnd(
          prevEraIdx,
          prevEraDef?.name ?? prevEraId,
          store?.resources.population ?? 0,
          buildingsLogic.entities.length,
          deps.kgb.getCommendations(),
          deps.kgb.getBlackMarks(),
        );
      }

      // Save checkpoint for the new era (snapshot before changes)
      // PoliticalAgent IS the EraSystem now, so call this.saveCheckpoint()
      this.saveCheckpoint(
        JSON.stringify({
          year: deps.year,
          eraId: newEra.id,
        }),
      );

      // Update CompulsoryDeliveries doctrine to match the new era
      deps.deliveries.setDoctrine(newEra.doctrine);

      // EconomyAgent era setting
      const economyEra = GAME_ERA_TO_ECONOMY_ERA[newEra.id] ?? 'revolution';
      deps.economy.setEra(economyEra);

      // Update TransportSystem era (score bonuses vary by era)
      deps.transport.setEra(newEra.id);

      // Generate mandates for the new era
      this.generateMandatesForCurrentEra(deps.difficulty);

      // KGBAgent mark reset for new era
      deps.kgb.resetForNewEra();
      deps.workers.resetOverrideCount();

      // Fire callback for UI (era assignment briefing modal)
      deps.callbacks.onEraChanged?.(newEra);

      // Advisor notification
      deps.callbacks.onAdvisor(`${newEra.introTitle}\n\n${newEra.introText}`);

      // Toast for era transition
      deps.callbacks.onToast(`NEW ERA: ${newEra.name.toUpperCase()}`, 'warning');
    }
  }

  /**
   * Check per-era victory/failure conditions.
   * Absorbs SimulationEngine.checkEraConditions().
   *
   * @param deps - Dependencies for condition checking
   */
  public checkConditions(deps: {
    totalTicks: number;
    callbacks: SimCallbacks;
    endGame: (victory: boolean, reason: string) => void;
  }): void {
    const meta = getMetaEntity();
    const res = getResourceEntity();
    if (!meta || !res) return;

    // Grace period: skip era conditions during the first year so the player
    // isn't immediately eliminated before they have a chance to act.
    // Also skip if there are no buildings (game hasn't really started).
    if (deps.totalTicks <= TICKS_PER_YEAR || buildingsLogic.entities.length === 0) {
      return;
    }

    const era = this.getCurrentEra();

    // Check failure condition
    if (era.failureCondition) {
      const failed = era.failureCondition.check(meta.gameMeta, res.resources);
      if (failed) {
        deps.endGame(false, `ERA FAILURE: ${era.name} — ${era.failureCondition.description}`);
        return;
      }
    }

    // Check victory condition
    if (era.victoryCondition) {
      const won = era.victoryCondition.check(meta.gameMeta, res.resources);
      if (won) {
        deps.callbacks.onToast(`ERA VICTORY: ${era.name.toUpperCase()}`, 'warning');
        deps.callbacks.onAdvisor(
          `Congratulations, Comrade Director. You have completed the objectives for ${era.name}. ` +
            `The Politburo acknowledges your adequate performance. Do not let it go to your head.`,
        );
      }
    }
  }

  // =========================================================================
  // Private helpers
  // =========================================================================

  /**
   * Compute average corruption across all Politburo ministers.
   * Used to scale KGB agent presence in PoliticalEntitySystem.
   *
   * @param politburo - The PolitburoSystem instance
   * @returns Average corruption value across all ministers
   */
  private _getAveragePolitburoCorruption(politburo: PolitburoSystem): number {
    const state = politburo.getState();
    const ministers = [...state.ministers.values()];
    if (ministers.length === 0) return 0;
    const total = ministers.reduce((sum, m) => sum + m.corruption, 0);
    return total / ministers.length;
  }

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


