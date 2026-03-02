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

import { demographics } from '@/config';
import type { RaionPool } from '@/ecs/world';
import type { GameRng } from '@/game/SeedSystem';
import { poissonSample } from '@/math/poissonSampling';

// Re-export for external consumers
export { poissonSample } from '@/math/poissonSampling';

// ── Constants (loaded from config) ───────────────────────────────────────────

const cfg = demographics.aggregate;

/** Number of 5-year age buckets (0-4, 5-9, ..., 95-99). */
const NUM_BUCKETS = cfg.numBuckets;

/** Base monthly conception rate per eligible woman. */
const BASE_MONTHLY_CONCEPTION_RATE = cfg.birthRates.baseMonthlyConceptionRate;

/** Female fertile age bucket range: buckets 3-9 = ages 15-49. */
const FERTILE_BUCKET_MIN = cfg.birthRates.fertileBucketMin;
const FERTILE_BUCKET_MAX = cfg.birthRates.fertileBucketMax;

/** Labor force age bucket range: buckets 3-12 = ages 15-64. */
const LABOR_BUCKET_MIN = cfg.laborForce.bucketMin;
const LABOR_BUCKET_MAX = cfg.laborForce.bucketMax;

/**
 * Era birth-rate multipliers (statistical mode).
 * Keys match era IDs from the EraSystem / Chronology.
 */
const ERA_BIRTH_MULTIPLIER: Record<string, number> = cfg.eraBirthMultiplier;

/**
 * Era death-rate multipliers (statistical mode).
 * Keys match era IDs from the EraSystem / Chronology.
 */
const ERA_DEATH_MULTIPLIER: Record<string, number> = cfg.eraDeathMultiplier;

/**
 * Annual mortality rates by 5-year age bucket (Soviet historical approximation).
 * Index = bucket number (0 = ages 0-4, 19 = ages 95-99).
 */
const ANNUAL_MORTALITY_BY_BUCKET: readonly number[] = cfg.annualMortalityByBucket;

// ── Food Modifier ────────────────────────────────────────────────────────────

/**
 * Compute food modifier for birth rate.
 * Maps food level to a configurable multiplier range.
 */
function foodModifier(foodLevel: number): number {
  const { lowThreshold, highThreshold, minMultiplier, maxMultiplier } = cfg.foodModifier;
  if (foodLevel < lowThreshold) return minMultiplier;
  if (foodLevel > highThreshold) return maxMultiplier;
  // Linear interpolation between thresholds → minMultiplier to 1.0
  const range = highThreshold - lowThreshold;
  return minMultiplier + ((foodLevel - lowThreshold) / range) * (1.0 - minMultiplier);
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
 * @param eraId     - Current era identifier for death rate multiplier
 * @param rng       - Seeded RNG instance
 * @returns Total number of deaths this tick
 */
export function statisticalDeathTick(
  pool: RaionPool,
  foodLevel: number,
  eraId: string,
  rng: GameRng,
): number {
  // Starvation modifier: up to maxMultiplier at zero food
  const { threshold: starvThreshold, scale: starvScale } = cfg.starvation;
  const starvationMod = foodLevel < starvThreshold
    ? 1 + (starvThreshold - foodLevel) * starvScale
    : 1.0;

  // Era death modifier (wartime, famine eras amplify mortality)
  const eraMod = ERA_DEATH_MULTIPLIER[eraId] ?? 1.0;

  let totalDeaths = 0;

  for (let i = 0; i < NUM_BUCKETS; i++) {
    const monthlyRate = (ANNUAL_MORTALITY_BY_BUCKET[i]! / 12) * starvationMod * eraMod;

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

  // Update pool totals (clamp to 0 — can't have negative population)
  pool.totalPopulation = Math.max(0, pool.totalPopulation - totalDeaths);
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
 * Called on year boundaries. Each bucket spans 5 years, so each year only
 * 1/5 (agingFraction = 0.2) of each bucket's population advances to the
 * next bucket, sampled via Poisson for stochastic variation.
 *
 * Uses a two-phase approach to prevent cascading advancement:
 *   Phase 1: Calculate all advancements without modifying buckets
 *   Phase 2: Apply all advancements atomically
 *
 * Population advancing out of bucket 19 (ages 95-99) counts as overflow deaths.
 *
 * @param pool - Mutable RaionPool to update
 * @param rng  - Seeded RNG instance for Poisson sampling
 * @returns Number of overflow deaths (population aged out of bucket 19)
 */
export function statisticalAgingTick(pool: RaionPool, rng: GameRng): number {
  const agingFraction = cfg.agingFraction;

  // Phase 1: Calculate all advancements (do NOT modify buckets yet)
  const maleAdvancers = new Array<number>(NUM_BUCKETS).fill(0);
  const femaleAdvancers = new Array<number>(NUM_BUCKETS).fill(0);

  for (let i = 0; i < NUM_BUCKETS; i++) {
    maleAdvancers[i] = Math.min(
      poissonSample(pool.maleAgeBuckets[i]! * agingFraction, rng),
      pool.maleAgeBuckets[i]!,
    );
    femaleAdvancers[i] = Math.min(
      poissonSample(pool.femaleAgeBuckets[i]! * agingFraction, rng),
      pool.femaleAgeBuckets[i]!,
    );
  }

  // Phase 2: Apply all advancements atomically
  let overflowDeaths = 0;

  for (let i = 0; i < NUM_BUCKETS; i++) {
    pool.maleAgeBuckets[i]! -= maleAdvancers[i]!;
    pool.femaleAgeBuckets[i]! -= femaleAdvancers[i]!;

    if (i < NUM_BUCKETS - 1) {
      pool.maleAgeBuckets[i + 1]! += maleAdvancers[i]!;
      pool.femaleAgeBuckets[i + 1]! += femaleAdvancers[i]!;
    } else {
      overflowDeaths += maleAdvancers[i]! + femaleAdvancers[i]!;
    }
  }

  // Update pool totals
  pool.totalPopulation = Math.max(0, pool.totalPopulation - overflowDeaths);
  pool.deathsThisYear += overflowDeaths;
  pool.totalDeaths += overflowDeaths;

  // Recalculate labor force
  let laborForce = 0;
  for (let i = LABOR_BUCKET_MIN; i <= LABOR_BUCKET_MAX; i++) {
    laborForce += pool.maleAgeBuckets[i]! + pool.femaleAgeBuckets[i]!;
  }
  pool.laborForce = laborForce;

  return overflowDeaths;
}
