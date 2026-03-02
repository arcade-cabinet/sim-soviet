/**
 * @fileoverview LoyaltyAgent — Per-dvor loyalty assessment, sabotage, and flight tracking.
 *
 * Absorbs all logic from LoyaltySystem.ts (now deprecated).
 *
 * Historical: Resistance to collectivization was widespread — 14 million
 * peasant protests in 1930. Loyalty determines sabotage and flight risk.
 *
 * Telegrams emitted: DVOR_DISLOYAL, SABOTAGE_EVENT, FLIGHT_RISK
 * Telegrams received: none (tick-driven via update())
 */

import { Vehicle } from 'yuka';
import { dvory } from '../../ecs/archetypes';
import { MSG } from '../telegrams';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Monthly loyalty gain when food supply is good (foodLevel > 0.7). */
const LOYALTY_GAIN_GOOD_FOOD = 0.15;
/** Monthly loyalty loss during starvation (foodLevel <= 0). */
const LOYALTY_LOSS_STARVATION = -0.8;
/** Sabotage chance per dvor per month when loyalty < 20. */
const SABOTAGE_CHANCE = 0.1;
/** Flight chance per dvor per month when loyalty < 10. */
const FLIGHT_CHANCE = 0.05;
/** Loyalty threshold below which a dvor is considered disloyal. */
const DISLOYAL_THRESHOLD = 20;
/** Loyalty threshold below which a dvor is at flight risk. */
const FLIGHT_THRESHOLD = 10;

// ---------------------------------------------------------------------------
// State interface
// ---------------------------------------------------------------------------

/** Internal LoyaltyAgent state tracked across ticks. */
export interface LoyaltyState {
  /** Average loyalty across all dvory (0–100). */
  avgLoyalty: number;
  /** Number of dvory that committed sabotage last month. */
  sabotageCount: number;
  /** Number of dvory whose members fled last month. */
  flightCount: number;
  /** Current food level used for loyalty calculation (0 = starving, 1 = well-fed). */
  foodLevel: number;
}

/** Result of a monthly loyalty tick. */
export interface LoyaltyResult {
  /** Number of dvory that committed sabotage this month. */
  sabotageCount: number;
  /** Number of dvory whose members fled this month. */
  flightCount: number;
  /** Average loyalty across all dvory. */
  avgLoyalty: number;
}

// ---------------------------------------------------------------------------
// LoyaltyAgent
// ---------------------------------------------------------------------------

/**
 * Loyalty agent — assesses per-dvor loyalty and determines sabotage/flight outcomes.
 * Extends Yuka Vehicle for compatibility with EntityManager.
 *
 * Uses fuzzy loyalty assessment based on food supply and political climate.
 * Emits DVOR_DISLOYAL, SABOTAGE_EVENT, and FLIGHT_RISK telegrams.
 *
 * @example
 * const loyalty = new LoyaltyAgent();
 * loyalty.setFoodLevel(0.3);
 * const result = loyalty.tickLoyalty('revolution', false);
 */
export class LoyaltyAgent extends Vehicle {
  /** Internal loyalty tracking state. */
  private state: LoyaltyState = {
    avgLoyalty: 50,
    sabotageCount: 0,
    flightCount: 0,
    foodLevel: 0.5,
  };

  /** Optional RNG override for deterministic tests. */
  private rng?: { random(): number };

  /**
   * Exported message constants for telegram emission (tests can reference).
   * @internal
   */
  static readonly MSG = MSG;

  constructor() {
    super();
    this.name = 'LoyaltyAgent';
  }

  // -------------------------------------------------------------------------
  // Configuration
  // -------------------------------------------------------------------------

  /**
   * Set the current food level for loyalty calculations.
   *
   * @param level - Normalized food level (0 = starving, 1 = well-fed)
   */
  setFoodLevel(level: number): void {
    this.state.foodLevel = Math.max(0, Math.min(1, level));
  }

  /**
   * Set a custom RNG for deterministic testing.
   *
   * @param rng - Object with a random() method returning 0–1
   */
  setRng(rng: { random(): number }): void {
    this.rng = rng;
  }

  // -------------------------------------------------------------------------
  // Core tick
  // -------------------------------------------------------------------------

  /**
   * Run a monthly loyalty tick across all dvory.
   *
   * Per-dvor logic:
   * - Loyalty +0.15 when food > 0.7 (capped at 100)
   * - Loyalty -0.8 when food <= 0 (floored at 0)
   * - 10% sabotage chance when loyalty < 20
   * - 5% flight chance when loyalty < 10
   *
   * Sabotage effect: -5% food/vodka per sabotaging dvor (cap at 50% total loss).
   *
   * @param _eraId - Current era (reserved for future era-specific modifiers)
   * @param _quotaMet - Whether the current quota is met (reserved for event-driven adjustments)
   * @returns Summary of sabotage count, flight count, and average loyalty
   */
  tickLoyalty(_eraId: string, _quotaMet: boolean): LoyaltyResult {
    const random = this.rng ? () => this.rng!.random() : Math.random;
    const { foodLevel } = this.state;

    let sabotageCount = 0;
    let flightCount = 0;
    let loyaltySum = 0;
    let dvorCount = 0;

    for (const entity of dvory) {
      const dvor = entity.dvor;
      dvorCount++;

      // Adjust loyalty based on food supply (fuzzy: food is primary driver)
      if (foodLevel > 0.7) {
        dvor.loyaltyToCollective = Math.min(100, dvor.loyaltyToCollective + LOYALTY_GAIN_GOOD_FOOD);
      } else if (foodLevel <= 0) {
        dvor.loyaltyToCollective = Math.max(0, dvor.loyaltyToCollective + LOYALTY_LOSS_STARVATION);
      }

      // Sabotage check — disloyal dvory damage production
      if (dvor.loyaltyToCollective < DISLOYAL_THRESHOLD) {
        if (random() < SABOTAGE_CHANCE) {
          sabotageCount++;
        }
      }

      // Flight check — extremely disloyal members flee
      if (dvor.loyaltyToCollective < FLIGHT_THRESHOLD) {
        if (random() < FLIGHT_CHANCE) {
          flightCount++;
        }
      }

      loyaltySum += dvor.loyaltyToCollective;
    }

    const avgLoyalty = dvorCount > 0 ? loyaltySum / dvorCount : 50;

    this.state.avgLoyalty = avgLoyalty;
    this.state.sabotageCount = sabotageCount;
    this.state.flightCount = flightCount;

    return { sabotageCount, flightCount, avgLoyalty };
  }

  // -------------------------------------------------------------------------
  // Sabotage effect calculation
  // -------------------------------------------------------------------------

  /**
   * Calculate the resource penalty from sabotage events.
   *
   * Each sabotaging dvor reduces food and vodka by 5%, capped at a 50% total loss.
   *
   * @param sabotageCount - Number of dvory committing sabotage
   * @param totalDvory - Total number of dvory (for proportional calculation)
   * @returns Penalty fraction to apply to food and vodka (0.0–0.5)
   */
  calculateSabotagePenalty(sabotageCount: number, totalDvory: number): number {
    if (sabotageCount === 0 || totalDvory === 0) return 0;
    const rawPenalty = (sabotageCount / totalDvory) * 0.05 * totalDvory;
    return Math.min(rawPenalty, 0.5);
  }

  // -------------------------------------------------------------------------
  // Accessors
  // -------------------------------------------------------------------------

  /** Current average loyalty across all dvory (0–100). */
  getAvgLoyalty(): number {
    return this.state.avgLoyalty;
  }

  /** Number of dvory that sabotaged last month. */
  getSabotageCount(): number {
    return this.state.sabotageCount;
  }

  /** Number of dvory that fled last month. */
  getFlightCount(): number {
    return this.state.flightCount;
  }

  // -------------------------------------------------------------------------
  // Serialization
  // -------------------------------------------------------------------------

  /**
   * Serialize loyalty agent state for save/load.
   *
   * @returns Plain object snapshot of internal state
   */
  toJSON(): LoyaltyState {
    return { ...this.state };
  }

  /**
   * Restore loyalty agent state from a saved snapshot.
   *
   * @param data - Previously serialized LoyaltyState
   */
  fromJSON(data: LoyaltyState): void {
    this.state = { ...data };
  }
}
