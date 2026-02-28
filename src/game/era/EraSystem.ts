/**
 * @module game/era/EraSystem
 *
 * Manages era progression and provides era-based gameplay parameters.
 *
 * The EraSystem is a pure query system — it does not mutate ECS state.
 * SimulationEngine reads modifiers, building gates, and doctrine from
 * this system and applies them to the relevant sub-systems.
 *
 * On era transitions, modifiers blend linearly from old → new over
 * TRANSITION_TICKS ticks to avoid jarring gameplay discontinuities.
 */

import type { Doctrine } from '../CompulsoryDeliveries';
import type { SettlementTier } from '../SettlementSystem';
import { ALL_BUILDING_IDS, ERA_DEFINITIONS, ERA_ORDER, eraIndexForYear } from './definitions';
import { getBuildingTierRequirement, tierMeetsRequirement } from './tiers';
import type { ConstructionMethod, EraCheckpoint, EraDefinition, EraId, EraModifiers, EraSystemSaveData } from './types';

/** Number of ticks over which modifiers blend from old era to new era. */
const TRANSITION_TICKS = 10;

export class EraSystem {
  private currentYear: number;
  private previousEraId: EraId | null;

  /**
   * Remaining ticks for the gradual modifier transition.
   * 0 means no transition is in progress.
   */
  private transitionTicksRemaining = 0;
  private transitionFromModifiers: EraModifiers | null = null;

  /** Era checkpoints keyed by EraId for restart-from-checkpoint. */
  private checkpoints: Map<EraId, EraCheckpoint> = new Map();

  constructor(startYear = 1922) {
    this.currentYear = startYear;
    this.previousEraId = null;
  }

  /** Get the full definition of the current era based on the tracked year. */
  getCurrentEra(): EraDefinition {
    const idx = eraIndexForYear(this.currentYear);
    const eraId = ERA_ORDER[idx]!;
    return ERA_DEFINITIONS[eraId];
  }

  /** Get the current era ID. */
  getCurrentEraId(): EraId {
    return this.getCurrentEra().id;
  }

  /**
   * Check if advancing to the given year triggers an era transition.
   * Returns the NEW era definition if a transition occurs, null otherwise.
   * Also updates the internal year tracker and starts the modifier blend.
   */
  checkTransition(year: number): EraDefinition | null {
    const oldEra = this.getCurrentEra();
    this.currentYear = year;
    const newEra = this.getCurrentEra();

    if (newEra.id !== oldEra.id) {
      this.previousEraId = oldEra.id;
      // Start gradual modifier transition
      this.transitionFromModifiers = { ...oldEra.modifiers };
      this.transitionTicksRemaining = TRANSITION_TICKS;
      return newEra;
    }

    return null;
  }

  /**
   * Called each tick to advance the modifier blend.
   * Returns true if a transition is still in progress.
   */
  tickTransition(): boolean {
    if (this.transitionTicksRemaining > 0) {
      this.transitionTicksRemaining--;
      if (this.transitionTicksRemaining <= 0) {
        this.transitionFromModifiers = null;
      }
      return true;
    }
    return false;
  }

  /** Whether a gradual modifier transition is in progress. */
  isTransitioning(): boolean {
    return this.transitionTicksRemaining > 0;
  }

  /**
   * Get all buildings available in the current era (cumulative).
   * Buildings unlocked in earlier eras remain available.
   *
   * When `tier` is provided, only buildings whose settlement tier
   * requirement is met by the given tier are included.
   * When `tier` is omitted, all era-unlocked buildings are returned
   * (backward compatible).
   */
  getAvailableBuildings(tier?: SettlementTier): string[] {
    const currentIdx = eraIndexForYear(this.currentYear);
    const available: string[] = [];

    for (let i = 0; i <= currentIdx; i++) {
      const eraId = ERA_ORDER[i]!;
      const def = ERA_DEFINITIONS[eraId];
      available.push(...def.unlockedBuildings);
    }

    if (tier == null) return available;

    return available.filter((defId) => tierMeetsRequirement(tier, getBuildingTierRequirement(defId)));
  }

  /**
   * Get buildings that are NOT yet available (locked in future eras).
   */
  getLockedBuildings(): string[] {
    const available = new Set(this.getAvailableBuildings());
    return ALL_BUILDING_IDS.filter((id) => !available.has(id));
  }

  /**
   * Get era modifiers for SimulationEngine to apply.
   * During a transition, returns a linear blend from old to new modifiers.
   */
  getModifiers(): EraModifiers {
    const target = this.getCurrentEra().modifiers;

    if (this.transitionTicksRemaining > 0 && this.transitionFromModifiers) {
      const t = 1 - this.transitionTicksRemaining / TRANSITION_TICKS;
      return this.lerpModifiers(this.transitionFromModifiers, target, t);
    }

    return { ...target };
  }

  /** Get the doctrine for CompulsoryDeliveries. */
  getDoctrine(): Doctrine {
    return this.getCurrentEra().doctrine;
  }

  /** Get the delivery rates for the current era. */
  getDeliveryRates(): { food: number; vodka: number; money: number } {
    return { ...this.getCurrentEra().deliveryRates };
  }

  /** Get quota escalation multiplier for the current era. */
  getQuotaEscalation(): number {
    return this.getCurrentEra().quotaEscalation;
  }

  /** Get the construction method for the current era. */
  getConstructionMethod(): ConstructionMethod {
    return this.getCurrentEra().constructionMethod;
  }

  /** Get the construction time multiplier for the current era. */
  getConstructionTimeMult(): number {
    return this.getCurrentEra().constructionTimeMult;
  }

  /** Get the era that was active before the most recent transition. */
  getPreviousEraId(): EraId | null {
    return this.previousEraId;
  }

  /** Get the tracked year. */
  getYear(): number {
    return this.currentYear;
  }

  /**
   * Check if a specific building defId is available in the current era.
   */
  isBuildingAvailable(defId: string): boolean {
    const available = this.getAvailableBuildings();
    return available.includes(defId);
  }

  /**
   * Get the era that unlocks a specific building defId.
   * Returns null if the building is not found in any era.
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

  // ── Checkpoint System ──────────────────────────────────

  /** Save a checkpoint for the current era. */
  saveCheckpoint(snapshot: string): void {
    const era = this.getCurrentEra();
    this.checkpoints.set(era.id, {
      eraId: era.id,
      year: this.currentYear,
      snapshot,
    });
  }

  /** Get a checkpoint for a specific era. */
  getCheckpoint(eraId: EraId): EraCheckpoint | null {
    return this.checkpoints.get(eraId) ?? null;
  }

  /** Get all saved checkpoints. */
  getAllCheckpoints(): ReadonlyMap<EraId, EraCheckpoint> {
    return this.checkpoints;
  }

  /** Check if a checkpoint exists for a given era. */
  hasCheckpoint(eraId: EraId): boolean {
    return this.checkpoints.has(eraId);
  }

  // ── Serialization ────────────────────────────────────

  serialize(): EraSystemSaveData {
    return {
      currentYear: this.currentYear,
      previousEraId: this.previousEraId,
      transitionTicksRemaining: this.transitionTicksRemaining,
    };
  }

  static deserialize(data: EraSystemSaveData): EraSystem {
    const system = new EraSystem(data.currentYear);
    system.previousEraId = data.previousEraId;
    system.transitionTicksRemaining = data.transitionTicksRemaining ?? 0;
    return system;
  }

  // ── Private ────────────────────────────────────────────

  /** Linearly interpolate between two modifier sets. t in [0, 1]. */
  private lerpModifiers(from: EraModifiers, to: EraModifiers, t: number): EraModifiers {
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
