/**
 * RaionPool invariant validator.
 *
 * Pure function that checks all demographic invariants on a RaionPool
 * and returns a result object listing every violation found. Designed
 * for use in test assertions to catch population drift/corruption.
 *
 * @module raionValidation
 */

import { demographics } from '@/config';
import type { RaionPool } from '@/ecs/world';

const cfg = demographics.aggregate;
const LABOR_BUCKET_MIN = cfg.laborForce.bucketMin;
const LABOR_BUCKET_MAX = cfg.laborForce.bucketMax;

/** Result of a RaionPool invariant check. */
export interface ValidationResult {
  /** Whether all invariants hold. */
  valid: boolean;
  /** Human-readable description of each violation (empty when valid). */
  errors: string[];
}

/**
 * Validate all RaionPool invariants and return a result listing every violation.
 *
 * Does NOT throw — callers decide how to handle failures. Checks are exhaustive:
 * all invariants are tested regardless of earlier failures.
 *
 * @param pool - The RaionPool to validate.
 * @returns ValidationResult with `valid` flag and list of error messages.
 */
export function validateRaionPool(pool: RaionPool): ValidationResult {
  const errors: string[] = [];

  // ── Bucket array lengths ────────────────────────────────────────────────
  if (pool.maleAgeBuckets.length !== 20) {
    errors.push(`maleAgeBuckets length is ${pool.maleAgeBuckets.length}, expected 20`);
  }
  if (pool.femaleAgeBuckets.length !== 20) {
    errors.push(`femaleAgeBuckets length is ${pool.femaleAgeBuckets.length}, expected 20`);
  }

  // ── Per-bucket checks: non-negative, finite, integer, no NaN ──────────
  for (let i = 0; i < pool.maleAgeBuckets.length; i++) {
    const v = pool.maleAgeBuckets[i]!;
    if (Number.isNaN(v)) {
      errors.push(`maleAgeBuckets[${i}] is NaN`);
    } else if (!Number.isFinite(v)) {
      errors.push(`maleAgeBuckets[${i}] is not finite (${v})`);
    } else {
      if (v < 0) {
        errors.push(`maleAgeBuckets[${i}] is negative (${v})`);
      }
      if (!Number.isInteger(v)) {
        errors.push(`maleAgeBuckets[${i}] is not an integer (${v})`);
      }
    }
  }
  for (let i = 0; i < pool.femaleAgeBuckets.length; i++) {
    const v = pool.femaleAgeBuckets[i]!;
    if (Number.isNaN(v)) {
      errors.push(`femaleAgeBuckets[${i}] is NaN`);
    } else if (!Number.isFinite(v)) {
      errors.push(`femaleAgeBuckets[${i}] is not finite (${v})`);
    } else {
      if (v < 0) {
        errors.push(`femaleAgeBuckets[${i}] is negative (${v})`);
      }
      if (!Number.isInteger(v)) {
        errors.push(`femaleAgeBuckets[${i}] is not an integer (${v})`);
      }
    }
  }

  // ── totalPopulation == sum of all buckets ──────────────────────────────
  const maleSum = pool.maleAgeBuckets.reduce((a, b) => a + b, 0);
  const femaleSum = pool.femaleAgeBuckets.reduce((a, b) => a + b, 0);
  const bucketSum = maleSum + femaleSum;

  if (Number.isNaN(pool.totalPopulation)) {
    errors.push('totalPopulation is NaN');
  } else if (!Number.isFinite(pool.totalPopulation)) {
    errors.push(`totalPopulation is not finite (${pool.totalPopulation})`);
  } else if (pool.totalPopulation < 0) {
    errors.push(`totalPopulation is negative (${pool.totalPopulation})`);
  }

  // Only check sum equality when both sides are finite and non-NaN
  if (Number.isFinite(pool.totalPopulation) && Number.isFinite(bucketSum) && pool.totalPopulation !== bucketSum) {
    errors.push(`totalPopulation (${pool.totalPopulation}) != sum of age buckets (${bucketSum})`);
  }

  // ── laborForce == sum of buckets 3-12 (both genders) ──────────────────
  let expectedLabor = 0;
  for (let i = LABOR_BUCKET_MIN; i <= LABOR_BUCKET_MAX; i++) {
    expectedLabor += (pool.maleAgeBuckets[i] ?? 0) + (pool.femaleAgeBuckets[i] ?? 0);
  }

  if (Number.isNaN(pool.laborForce)) {
    errors.push('laborForce is NaN');
  } else if (!Number.isFinite(pool.laborForce)) {
    errors.push(`laborForce is not finite (${pool.laborForce})`);
  } else if (Number.isFinite(expectedLabor) && pool.laborForce !== expectedLabor) {
    errors.push(`laborForce (${pool.laborForce}) != sum of labor buckets 3-12 (${expectedLabor})`);
  }

  // ── pregnancyWaves: all >= 0 ──────────────────────────────────────────
  for (let i = 0; i < pool.pregnancyWaves.length; i++) {
    const v = pool.pregnancyWaves[i]!;
    if (Number.isNaN(v)) {
      errors.push(`pregnancyWaves[${i}] is NaN`);
    } else if (v < 0) {
      errors.push(`pregnancyWaves[${i}] is negative (${v})`);
    }
  }

  // ── totalBirths, totalDeaths: >= 0 and finite ─────────────────────────
  if (Number.isNaN(pool.totalBirths)) {
    errors.push('totalBirths is NaN');
  } else if (!Number.isFinite(pool.totalBirths)) {
    errors.push(`totalBirths is not finite (${pool.totalBirths})`);
  } else if (pool.totalBirths < 0) {
    errors.push(`totalBirths is negative (${pool.totalBirths})`);
  }

  if (Number.isNaN(pool.totalDeaths)) {
    errors.push('totalDeaths is NaN');
  } else if (!Number.isFinite(pool.totalDeaths)) {
    errors.push(`totalDeaths is not finite (${pool.totalDeaths})`);
  } else if (pool.totalDeaths < 0) {
    errors.push(`totalDeaths is negative (${pool.totalDeaths})`);
  }

  // ── assignedWorkers, idleWorkers: >= 0 ────────────────────────────────
  if (Number.isNaN(pool.assignedWorkers)) {
    errors.push('assignedWorkers is NaN');
  } else if (pool.assignedWorkers < 0) {
    errors.push(`assignedWorkers is negative (${pool.assignedWorkers})`);
  }

  if (Number.isNaN(pool.idleWorkers)) {
    errors.push('idleWorkers is NaN');
  } else if (pool.idleWorkers < 0) {
    errors.push(`idleWorkers is negative (${pool.idleWorkers})`);
  }

  return { valid: errors.length === 0, errors };
}
