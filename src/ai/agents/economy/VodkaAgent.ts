/**
 * @fileoverview VodkaAgent — Yuka agent absorbing vodka production, consumption, and morale logic.
 *
 * Absorbs from:
 *   - productionSystem.ts: vodka-specific grain diversion (2 food → 1 vodka)
 *   - consumptionSystem.ts: vodka consumption (1 per 20 citizens per tick)
 *
 * The agent decides how much grain to divert for fermentation vs. feeding
 * citizens. During food crises, diversion is suspended entirely.
 *
 * Telegrams emitted: VODKA_SHORTAGE (when supply < demand), MORALE_BOOST (when distributed)
 */

import { Vehicle } from 'yuka';
import { economy } from '@/config';
import { MSG } from '../../telegrams';

// ─────────────────────────────────────────────────────────
//  Constants (sourced from config/economy.json → production)
// ─────────────────────────────────────────────────────────

/** Grain units consumed per vodka unit produced. */
export const GRAIN_TO_VODKA_RATIO = economy.production.grainToVodkaRatio;

/** Vodka units consumed per N citizens per tick. */
const CITIZENS_PER_VODKA = economy.consumption.vodkaPerPopDivisor;

/** Morale bonus applied when vodka demand is fully met. */
export const VODKA_MORALE_BONUS = economy.production.vodkaMoraleBonus;

/**
 * Food-per-citizen threshold below which grain diversion stops.
 * Protects population from starvation during scarcity.
 */
const FOOD_CRISIS_THRESHOLD = economy.production.foodCrisisThreshold;

// ─────────────────────────────────────────────────────────
//  Public types
// ─────────────────────────────────────────────────────────

/** Resource store view required by VodkaAgent. */
export interface VodkaResourceView {
  food: number;
  vodka: number;
  population: number;
}

/** Result returned from a single VodkaAgent update tick. */
export interface VodkaUpdateResult {
  /** Vodka units produced this tick. */
  vodkaProduced: number;
  /** Grain units consumed for fermentation this tick. */
  grainConsumed: number;
  /** Vodka units consumed by citizens this tick. */
  vodkaConsumed: number;
  /** Whether demand was fully met (triggers morale bonus). */
  demandMet: boolean;
  /** Whether supply fell short of demand. */
  shortage: boolean;
  /** Morale delta this tick (+VODKA_MORALE_BONUS or 0). */
  moraleDelta: number;
}

/** Serializable snapshot of VodkaAgent state. */
export interface VodkaAgentSnapshot {
  /** Current grain diversion rate (0.0–1.0 of raw vodka output to ferment). */
  diversionRate: number;
  /** Morale value tracked by this agent. */
  morale: number;
  /** Running vodka shortage counter (consecutive shortage ticks). */
  shortageCounter: number;
}

// ─────────────────────────────────────────────────────────
//  VodkaAgent
// ─────────────────────────────────────────────────────────

/**
 * Yuka Vehicle agent that owns vodka production, consumption, and morale.
 *
 * Call `update(rawVodkaOutput, resources, consumptionMult)` once per tick
 * with the base vodka output from producer buildings and the current resource view.
 * The agent mutates the resource view in-place and returns a result describing
 * what happened.
 *
 * @example
 * const agent = new VodkaAgent();
 * const result = agent.update(5, { food: 100, vodka: 10, population: 200 }, 1.0);
 * if (result.shortage) console.log('VODKA_SHORTAGE emitted');
 */
export class VodkaAgent extends Vehicle {
  /** Exported message constants for telegram emission. */
  static readonly MSG = MSG;

  /** Fraction of raw vodka output to attempt fermenting (0.0–1.0). */
  private diversionRate: number = 1.0;

  /** Current morale tracked by this agent. */
  private morale: number = 50;

  /** Consecutive ticks with vodka shortage. */
  private shortageCounter: number = 0;

  constructor() {
    super();
    this.name = 'VodkaAgent';
  }

  // ─────────────────────────────────────────────────────
  //  CORE TICK
  // ─────────────────────────────────────────────────────

  /**
   * Run vodka production and consumption for one simulation tick.
   *
   * Production: `rawVodkaOutput * diversionRate` vodka units attempted.
   * Each vodka unit costs `GRAIN_TO_VODKA_RATIO` food from resources.
   * Diversion is suspended entirely when food-per-capita < FOOD_CRISIS_THRESHOLD.
   *
   * Consumption: `ceil(population / 20 * consumptionMult)` vodka units.
   * Shortage when supply < demand; morale bonus when demand fully met.
   *
   * @param rawVodkaOutput - Base vodka output from powered producer buildings this tick
   * @param resources - Mutable resource view (food/vodka/population); mutated in-place
   * @param consumptionMult - Era/difficulty multiplier on consumption rates (default 1)
   * @returns Summary of what happened this tick
   */
  update(
    rawVodkaOutput: number,
    resources: VodkaResourceView,
    consumptionMult = 1,
  ): VodkaUpdateResult {
    const result: VodkaUpdateResult = {
      vodkaProduced: 0,
      grainConsumed: 0,
      vodkaConsumed: 0,
      demandMet: false,
      shortage: false,
      moraleDelta: 0,
    };

    // ── Production ──────────────────────────────────────────────────────────

    const foodPerCapita = resources.population > 0
      ? resources.food / resources.population
      : Infinity;

    const inFoodCrisis = foodPerCapita < FOOD_CRISIS_THRESHOLD;

    if (!inFoodCrisis && rawVodkaOutput > 0) {
      const targetVodka = rawVodkaOutput * this.diversionRate;
      const grainRequired = targetVodka * GRAIN_TO_VODKA_RATIO;

      if (resources.food >= grainRequired) {
        resources.food -= grainRequired;
        resources.vodka += targetVodka;
        result.vodkaProduced = targetVodka;
        result.grainConsumed = grainRequired;
      } else {
        // Produce proportionally to available grain
        const affordable = resources.food / GRAIN_TO_VODKA_RATIO;
        if (affordable > 0) {
          resources.food -= affordable * GRAIN_TO_VODKA_RATIO;
          resources.vodka += affordable;
          result.vodkaProduced = affordable;
          result.grainConsumed = affordable * GRAIN_TO_VODKA_RATIO;
        }
      }
    }

    // ── Consumption ─────────────────────────────────────────────────────────

    const pop = resources.population;
    if (pop > 0) {
      const vodkaDemand = Math.ceil((pop / CITIZENS_PER_VODKA) * consumptionMult);

      if (resources.vodka >= vodkaDemand) {
        resources.vodka -= vodkaDemand;
        result.vodkaConsumed = vodkaDemand;
        result.demandMet = true;
        this.shortageCounter = 0;

        this.morale = Math.min(100, this.morale + VODKA_MORALE_BONUS);
        result.moraleDelta = VODKA_MORALE_BONUS;
      } else {
        result.vodkaConsumed = resources.vodka;
        resources.vodka = 0;
        result.shortage = true;
        this.shortageCounter++;
      }
    }

    return result;
  }

  // ─────────────────────────────────────────────────────
  //  DIVERSION DECISION
  // ─────────────────────────────────────────────────────

  /**
   * Set the grain diversion rate — how much of raw vodka output to ferment.
   * 1.0 = ferment everything possible; 0.0 = no fermentation.
   *
   * @param rate - Diversion fraction (clamped to [0, 1])
   */
  setDiversionRate(rate: number): void {
    this.diversionRate = Math.max(0, Math.min(1, rate));
  }

  /** Current grain diversion rate. */
  getDiversionRate(): number {
    return this.diversionRate;
  }

  // ─────────────────────────────────────────────────────
  //  ACCESSORS
  // ─────────────────────────────────────────────────────

  /** Current morale level (0–100). */
  getMorale(): number {
    return this.morale;
  }

  /** Consecutive ticks where vodka demand was not met. */
  getShortageCounter(): number {
    return this.shortageCounter;
  }

  // ─────────────────────────────────────────────────────
  //  SERIALIZATION
  // ─────────────────────────────────────────────────────

  /** Serialize agent state for save/load. */
  serialize(): VodkaAgentSnapshot {
    return {
      diversionRate: this.diversionRate,
      morale: this.morale,
      shortageCounter: this.shortageCounter,
    };
  }

  /**
   * Restore agent state from a snapshot.
   *
   * @param snapshot - Previously serialized VodkaAgentSnapshot
   */
  restore(snapshot: VodkaAgentSnapshot): void {
    this.diversionRate = snapshot.diversionRate;
    this.morale = snapshot.morale;
    this.shortageCounter = snapshot.shortageCounter;
  }
}
