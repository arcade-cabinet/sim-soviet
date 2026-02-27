/**
 * @module game/CompulsoryDeliveries
 *
 * COMPULSORY DELIVERY SYSTEM
 * ==========================
 * SimSoviet 2000 — State Extraction of Production
 *
 * In the Soviet planned economy, the state extracted compulsory deliveries
 * of grain, food, and industrial output at fixed low prices. What remained
 * AFTER deliveries was the "remainder" that fed workers and filled stockpiles.
 *
 * Each tick, a percentage of NEW production (not stockpiles) is automatically
 * deducted as state deliveries. The delivery rates vary by political doctrine.
 *
 * During the stagnation era, an additional "administrative loss" (corruption)
 * siphons goods into the bureaucracy on top of the official delivery rates.
 */

import type { GameRng } from './SeedSystem';

// ─────────────────────────────────────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Political doctrine determines extraction rates. Each doctrine represents
 * a distinct phase of Soviet governance with different economic priorities.
 */
export type Doctrine =
  | 'revolutionary'
  | 'industrialization'
  | 'wartime'
  | 'reconstruction'
  | 'thaw'
  | 'freeze'
  | 'stagnation'
  | 'eternal';

/** Fraction of each resource type taken as compulsory delivery (0.0-1.0). */
export interface DeliveryRates {
  food: number;
  vodka: number;
  money: number;
}

/** Result of applying compulsory deliveries to a tick's production. */
export interface DeliveryResult {
  foodTaken: number;
  vodkaTaken: number;
  moneyTaken: number;
  corruptionLoss: number;
  totalFoodRemaining: number;
}

/** Shape of serialized CompulsoryDeliveries state for save/load. */
export interface CompulsoryDeliverySaveData {
  doctrine: Doctrine;
  totalDelivered: { food: number; vodka: number; money: number };
  corruptionRate: number;
}

// ─────────────────────────────────────────────────────────────────────────────
//  DELIVERY RATE TABLES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Base delivery rates by doctrine.
 *
 * | Doctrine         | Food | Vodka | Money | Notes                          |
 * |------------------|------|-------|-------|--------------------------------|
 * | revolutionary    | 0.40 | 0.30  | 0.20  | Post-revolution requisitioning |
 * | industrialization| 0.50 | 0.40  | 0.60  | Heavy industrial extraction    |
 * | wartime          | 0.70 | 0.60  | 0.70  | Total war economy              |
 * | reconstruction   | 0.35 | 0.25  | 0.30  | Recovery — lighter touch       |
 * | thaw             | 0.30 | 0.20  | 0.25  | Best period for workers        |
 * | freeze           | 0.45 | 0.35  | 0.50  | Crackdown                      |
 * | stagnation       | 0.45 | 0.40  | 0.50  | Plus "administrative losses"   |
 * | eternal          | 0.40 | 0.35  | 0.40  | Bureaucratic                   |
 */
const DELIVERY_RATES: Record<Doctrine, DeliveryRates> = {
  revolutionary: { food: 0.4, vodka: 0.3, money: 0.2 },
  industrialization: { food: 0.5, vodka: 0.4, money: 0.6 },
  wartime: { food: 0.7, vodka: 0.6, money: 0.7 },
  reconstruction: { food: 0.35, vodka: 0.25, money: 0.3 },
  thaw: { food: 0.3, vodka: 0.2, money: 0.25 },
  freeze: { food: 0.45, vodka: 0.35, money: 0.5 },
  stagnation: { food: 0.45, vodka: 0.4, money: 0.5 },
  eternal: { food: 0.4, vodka: 0.35, money: 0.4 },
};

/** Corruption bounds during stagnation — "administrative losses". */
const CORRUPTION_MIN = 0.05;
const CORRUPTION_MAX = 0.15;

// ─────────────────────────────────────────────────────────────────────────────
//  COMPULSORY DELIVERIES CLASS
// ─────────────────────────────────────────────────────────────────────────────

export class CompulsoryDeliveries {
  private doctrine: Doctrine;
  private totalDelivered = { food: 0, vodka: 0, money: 0 };
  private corruptionRate = 0;
  private rng: GameRng | null = null;

  constructor(initialDoctrine?: Doctrine) {
    this.doctrine = initialDoctrine ?? 'revolutionary';
    if (this.doctrine === 'stagnation') {
      this.rollCorruption();
    }
  }

  /** Provide a seeded RNG for deterministic corruption rolls. */
  setRng(rng: GameRng): void {
    this.rng = rng;
  }

  /** Update the current doctrine (called when PolitburoSystem changes doctrine). */
  setDoctrine(doctrine: Doctrine): void {
    this.doctrine = doctrine;
    if (doctrine === 'stagnation') {
      this.rollCorruption();
    } else {
      this.corruptionRate = 0;
    }
  }

  /** Get the current doctrine. */
  getDoctrine(): Doctrine {
    return this.doctrine;
  }

  /** Get current delivery rates for the active doctrine. */
  getRates(): DeliveryRates {
    const base = DELIVERY_RATES[this.doctrine];
    return { food: base.food, vodka: base.vodka, money: base.money };
  }

  /**
   * Apply compulsory deliveries to new production.
   * Returns what was taken and what remains.
   *
   * This function does NOT modify any external state — it calculates
   * and returns the result. The caller (SimulationEngine) applies
   * the result to the resource store.
   *
   * @param newFood  - Food produced THIS tick
   * @param newVodka - Vodka produced THIS tick
   * @param newMoney - Money/industrial output produced THIS tick
   */
  applyDeliveries(newFood: number, newVodka: number, newMoney: number): DeliveryResult {
    const rates = DELIVERY_RATES[this.doctrine];

    // Base deliveries
    let foodTaken = newFood * rates.food;
    let vodkaTaken = newVodka * rates.vodka;
    let moneyTaken = newMoney * rates.money;

    // Corruption: additional loss during stagnation
    let corruptionLoss = 0;
    if (this.doctrine === 'stagnation') {
      // Re-roll corruption each tick for variation
      this.rollCorruption();
      const corruptionFood = newFood * rates.food * this.corruptionRate;
      const corruptionVodka = newVodka * rates.vodka * this.corruptionRate;
      const corruptionMoney = newMoney * rates.money * this.corruptionRate;
      corruptionLoss = corruptionFood + corruptionVodka + corruptionMoney;
      foodTaken += corruptionFood;
      vodkaTaken += corruptionVodka;
      moneyTaken += corruptionMoney;
    }

    // Accumulate totals for annual report
    this.totalDelivered.food += foodTaken;
    this.totalDelivered.vodka += vodkaTaken;
    this.totalDelivered.money += moneyTaken;

    return {
      foodTaken,
      vodkaTaken,
      moneyTaken,
      corruptionLoss,
      totalFoodRemaining: newFood - foodTaken,
    };
  }

  /** Get cumulative deliveries (for annual report display). */
  getTotalDelivered(): { food: number; vodka: number; money: number } {
    return { ...this.totalDelivered };
  }

  /** Reset cumulative totals (called at year boundary or plan end). */
  resetTotals(): void {
    this.totalDelivered = { food: 0, vodka: 0, money: 0 };
  }

  /** Get the current corruption rate (0 outside stagnation). */
  getCorruptionRate(): number {
    return this.corruptionRate;
  }

  // ── Serialization ────────────────────────────────────────────

  serialize(): CompulsoryDeliverySaveData {
    return {
      doctrine: this.doctrine,
      totalDelivered: { ...this.totalDelivered },
      corruptionRate: this.corruptionRate,
    };
  }

  static deserialize(data: CompulsoryDeliverySaveData): CompulsoryDeliveries {
    const instance = new CompulsoryDeliveries(data.doctrine);
    instance.totalDelivered = { ...data.totalDelivered };
    instance.corruptionRate = data.corruptionRate;
    return instance;
  }

  // ── Private ──────────────────────────────────────────────────

  /** Roll a new corruption rate in [0.05, 0.15]. */
  private rollCorruption(): void {
    const rand = this.rng ? this.rng.random() : Math.random();
    this.corruptionRate = CORRUPTION_MIN + rand * (CORRUPTION_MAX - CORRUPTION_MIN);
  }
}
