/**
 * @module ai/agents/social/statisticalDemographics
 *
 * Statistical demographics for aggregate population mode.
 *
 * When population exceeds the entity threshold (~200), individual citizen
 * entities are replaced by a RaionPool with 20 age buckets per gender.
 * These functions compute births, deaths, and aging as O(20) statistical
 * operations instead of iterating hundreds of individual entities.
 *
 * All randomness uses Poisson sampling: one RNG draw per bucket instead
 * of one per citizen.
 */

import type { RaionPool } from '@/ecs/world';
import type { GameRng } from '@/game/SeedSystem';

// ── Constants ────────────────────────────────────────────────────────────────

/** Number of 5-year age buckets (0-4, 5-9, ..., 95-99). */
const NUM_BUCKETS = 20;

/** Base monthly conception rate per eligible woman (1.25%). */
const BASE_MONTHLY_CONCEPTION_RATE = 0.0125;

/** Female fertile age bucket range: buckets 3-9 = ages 15-49. */
const FERTILE_BUCKET_MIN = 3;
const FERTILE_BUCKET_MAX = 9;

/** Labor force age bucket range: buckets 3-12 = ages 15-64. */
const LABOR_BUCKET_MIN = 3;
const LABOR_BUCKET_MAX = 12;

/**
 * Era birth-rate multipliers (statistical mode).
 * Keys match era IDs from the EraSystem / Chronology.
 */
const ERA_BIRTH_MULTIPLIER: Record<string, number> = {
  revolution: 1.0,
  civil_war: 0.6,
  nep: 0.9,
  collectivization: 0.5,
  industrialization: 0.7,
  great_patriotic_war: 0.3,
  great_patriotic: 0.3,
  reconstruction: 0.8,
  thaw: 0.9,
  thaw_and_freeze: 0.9,
  stagnation: 0.7,
  perestroika: 0.5,
  collapse: 0.3,
  the_eternal: 0.3,
  eternal: 0.3,
};

/**
 * Annual mortality rates by 5-year age bucket (Soviet historical approximation).
 * Index = bucket number (0 = ages 0-4, 19 = ages 95-99).
 */
const ANNUAL_MORTALITY_BY_BUCKET: readonly number[] = [
  0.08,  // 0: ages 0-4
  0.005, // 1: ages 5-9
  0.003, // 2: ages 10-14
  0.003, // 3: ages 15-19
  0.005, // 4: ages 20-24
  0.005, // 5: ages 25-29
  0.005, // 6: ages 30-34
  0.005, // 7: ages 35-39
  0.008, // 8: ages 40-44
  0.008, // 9: ages 45-49
  0.015, // 10: ages 50-54
  0.015, // 11: ages 55-59
  0.03,  // 12: ages 60-64
  0.03,  // 13: ages 65-69
  0.06,  // 14: ages 70-74
  0.06,  // 15: ages 75-79
  0.12,  // 16: ages 80-84
  0.12,  // 17: ages 85-89
  0.20,  // 18: ages 90-94
  0.35,  // 19: ages 95-99
];

// ── Poisson Sampling ─────────────────────────────────────────────────────────

/**
 * Sample from a Poisson distribution.
 *
 * Replaces N individual Bernoulli trials with a single Poisson draw.
 * For lambda < 30: Knuth inverse-CDF algorithm (exact).
 * For lambda >= 30: Normal approximation via Box-Muller (fast, accurate).
 *
 * @param lambda - Expected number of events (must be >= 0)
 * @param rng    - Seeded RNG instance
 * @returns Non-negative integer sample
 */
export function poissonSample(lambda: number, rng: GameRng): number {
  if (lambda <= 0) return 0;

  if (lambda < 30) {
    // Knuth algorithm
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= rng.random();
    } while (p > L);
    return k - 1;
  }

  // Normal approximation (Box-Muller)
  const u1 = rng.random();
  const u2 = rng.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const result = Math.round(lambda + Math.sqrt(lambda) * z);
  return Math.max(0, result);
}

// ── Food Modifier ────────────────────────────────────────────────────────────

/**
 * Compute food modifier for birth rate.
 * Maps food level to a 0.5-1.2 multiplier.
 */
function foodModifier(foodLevel: number): number {
  if (foodLevel < 0.5) return 0.5;
  if (foodLevel > 0.8) return 1.2;
  // Linear interpolation between 0.5 and 0.8 → modifier 0.5 to 1.0
  return 0.5 + ((foodLevel - 0.5) / 0.3) * 0.5;
}

// ── Statistical Birth Tick ───────────────────────────────────────────────────

/**
 * Monthly statistical birth tick for aggregate mode.
 *
 * 1. Count eligible women (fertile age buckets minus currently pregnant)
 * 2. Compute conception rate with food + era modifiers
 * 3. Sample conceptions from Poisson distribution
 * 4. Shift pregnancy register: births = wave[0], wave[0] = wave[1], wave[1] = wave[2], wave[2] = new
 * 5. Distribute births 50/50 male/female into bucket 0
 * 6. Update pool totals
 *
 * @param pool      - Mutable RaionPool to update
 * @param foodLevel - Normalized food level (0.0-1.0+)
 * @param eraId     - Current era identifier for birth rate multiplier
 * @param rng       - Seeded RNG instance
 * @returns Number of births delivered this tick
 */
export function statisticalBirthTick(
  pool: RaionPool,
  foodLevel: number,
  eraId: string,
  rng: GameRng,
): number {
  // Count eligible women: female buckets 3-9 (ages 15-49)
  let eligibleWomen = 0;
  for (let i = FERTILE_BUCKET_MIN; i <= FERTILE_BUCKET_MAX; i++) {
    eligibleWomen += pool.femaleAgeBuckets[i]!;
  }

  // Subtract currently pregnant (sum of all pregnancy waves)
  const currentlyPregnant = pool.pregnancyWaves.reduce((s, v) => s + v, 0);
  eligibleWomen = Math.max(0, eligibleWomen - currentlyPregnant);

  // Compute conception rate
  const foodMod = foodModifier(foodLevel);
  const eraMod = ERA_BIRTH_MULTIPLIER[eraId] ?? 1.0;
  const conceptionRate = BASE_MONTHLY_CONCEPTION_RATE * foodMod * eraMod;

  // Sample conceptions
  const conceptions = poissonSample(eligibleWomen * conceptionRate, rng);

  // Pregnancy shift register: deliver → mid → newly conceived
  const births = pool.pregnancyWaves[0]!;
  pool.pregnancyWaves[0] = pool.pregnancyWaves[1]!;
  pool.pregnancyWaves[1] = pool.pregnancyWaves[2]!;
  pool.pregnancyWaves[2] = conceptions;

  // Distribute births 50/50 male/female
  if (births > 0) {
    const males = Math.floor(births / 2);
    const females = births - males;
    // Use rng to decide which gets the odd one
    if (births % 2 !== 0 && rng.coinFlip()) {
      pool.maleAgeBuckets[0]! += females;
      pool.femaleAgeBuckets[0]! += males;
    } else {
      pool.maleAgeBuckets[0]! += males;
      pool.femaleAgeBuckets[0]! += females;
    }

    pool.totalPopulation += births;
    pool.birthsThisYear += births;
    pool.totalBirths += births;
  }

  return births;
}

// ── Statistical Death Tick ───────────────────────────────────────────────────

/**
 * Monthly statistical death tick for aggregate mode.
 *
 * Per-bucket Poisson sampling of deaths based on historical mortality rates.
 * Starvation modifier amplifies death rate when food is scarce.
 *
 * @param pool      - Mutable RaionPool to update
 * @param foodLevel - Normalized food level (0.0-1.0+)
 * @param rng       - Seeded RNG instance
 * @returns Total number of deaths this tick
 */
export function statisticalDeathTick(
  pool: RaionPool,
  foodLevel: number,
  rng: GameRng,
): number {
  // Starvation modifier: up to 3x at zero food
  const starvationMod = foodLevel < 0.5
    ? 1 + (0.5 - foodLevel) * 4
    : 1.0;

  let totalDeaths = 0;

  for (let i = 0; i < NUM_BUCKETS; i++) {
    const monthlyRate = (ANNUAL_MORTALITY_BY_BUCKET[i]! / 12) * starvationMod;

    // Male deaths
    const maleCount = pool.maleAgeBuckets[i]!;
    if (maleCount > 0) {
      const maleDeaths = Math.min(
        poissonSample(maleCount * monthlyRate, rng),
        maleCount,
      );
      pool.maleAgeBuckets[i]! -= maleDeaths;
      totalDeaths += maleDeaths;
    }

    // Female deaths
    const femaleCount = pool.femaleAgeBuckets[i]!;
    if (femaleCount > 0) {
      const femaleDeaths = Math.min(
        poissonSample(femaleCount * monthlyRate, rng),
        femaleCount,
      );
      pool.femaleAgeBuckets[i]! -= femaleDeaths;
      totalDeaths += femaleDeaths;
    }
  }

  // Update pool totals
  pool.totalPopulation -= totalDeaths;
  pool.deathsThisYear += totalDeaths;
  pool.totalDeaths += totalDeaths;

  // Recalculate labor force (buckets 3-12 = ages 15-64)
  let laborForce = 0;
  for (let i = LABOR_BUCKET_MIN; i <= LABOR_BUCKET_MAX; i++) {
    laborForce += pool.maleAgeBuckets[i]! + pool.femaleAgeBuckets[i]!;
  }
  pool.laborForce = laborForce;

  return totalDeaths;
}

// ── Statistical Aging Tick ───────────────────────────────────────────────────

/**
 * Annual statistical aging tick for aggregate mode.
 *
 * Called on year boundaries. Shifts all age buckets up by one position.
 * Population in bucket 19 (ages 95-99) overflows into death.
 *
 * Note: this is a simplified model. In reality, only 1/5 of each bucket
 * would advance per year (since buckets span 5 years). However, for game
 * pacing, we treat each bucket as a single cohort that advances annually.
 * The mortality rates in statisticalDeathTick compensate for this
 * simplification by being tuned to produce realistic net population curves.
 *
 * @param pool - Mutable RaionPool to update
 * @returns Number of overflow deaths (population aged out of bucket 19)
 */
export function statisticalAgingTick(pool: RaionPool): number {
  // Overflow deaths: bucket 19 ages out
  const maleOverflow = pool.maleAgeBuckets[NUM_BUCKETS - 1]!;
  const femaleOverflow = pool.femaleAgeBuckets[NUM_BUCKETS - 1]!;
  const overflowDeaths = maleOverflow + femaleOverflow;

  // Shift buckets up by 1 (oldest → death, youngest ← 0)
  for (let i = NUM_BUCKETS - 1; i > 0; i--) {
    pool.maleAgeBuckets[i] = pool.maleAgeBuckets[i - 1]!;
    pool.femaleAgeBuckets[i] = pool.femaleAgeBuckets[i - 1]!;
  }
  pool.maleAgeBuckets[0] = 0;
  pool.femaleAgeBuckets[0] = 0;

  // Update pool totals
  pool.totalPopulation -= overflowDeaths;
  pool.deathsThisYear += overflowDeaths;
  pool.totalDeaths += overflowDeaths;

  return overflowDeaths;
}
