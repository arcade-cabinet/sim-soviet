/**
 * Tests for the RaionPool invariant validator.
 *
 * Ensures the validator correctly identifies valid pools,
 * single violations, and multiple simultaneous violations.
 */

import { validateRaionPool } from '@/ai/agents/social/raionValidation';
import type { RaionPool } from '@/ecs/world';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Create a fresh, valid RaionPool with zeroed buckets. */
function makePool(overrides?: Partial<RaionPool>): RaionPool {
  return {
    totalPopulation: 0,
    totalHouseholds: 0,
    maleAgeBuckets: new Array(20).fill(0),
    femaleAgeBuckets: new Array(20).fill(0),
    classCounts: {},
    birthsThisYear: 0,
    deathsThisYear: 0,
    totalBirths: 0,
    totalDeaths: 0,
    pregnancyWaves: [0, 0, 0],
    laborForce: 0,
    assignedWorkers: 0,
    idleWorkers: 0,
    avgMorale: 50,
    avgLoyalty: 50,
    avgSkill: 50,
    ...overrides,
  };
}

/** Create a valid pool with population distributed across labor buckets. */
function makePopulatedPool(population: number): RaionPool {
  const pool = makePool();
  const perBucket = Math.floor(population / 20); // 10 labor buckets x 2 genders
  for (let i = 3; i <= 12; i++) {
    pool.maleAgeBuckets[i] = perBucket;
    pool.femaleAgeBuckets[i] = perBucket;
  }
  const actualPop = perBucket * 20;
  pool.totalPopulation = actualPop;
  pool.laborForce = actualPop; // all population is in labor buckets
  return pool;
}

// ── Valid pools ──────────────────────────────────────────────────────────────

describe('validateRaionPool', () => {
  test('empty pool (all zeros) is valid', () => {
    const result = validateRaionPool(makePool());
    expect(result).toEqual({ valid: true, errors: [] });
  });

  test('populated pool with consistent invariants is valid', () => {
    const result = validateRaionPool(makePopulatedPool(500));
    expect(result).toEqual({ valid: true, errors: [] });
  });

  test('pool with non-zero births/deaths/pregnancy is valid when consistent', () => {
    const pool = makePopulatedPool(400);
    pool.totalBirths = 50;
    pool.totalDeaths = 30;
    pool.birthsThisYear = 5;
    pool.deathsThisYear = 3;
    pool.pregnancyWaves = [2, 3, 4];
    pool.assignedWorkers = 100;
    pool.idleWorkers = 50;
    const result = validateRaionPool(pool);
    expect(result).toEqual({ valid: true, errors: [] });
  });

  // ── totalPopulation mismatch ────────────────────────────────────────────

  test('detects totalPopulation mismatch with bucket sum', () => {
    const pool = makePopulatedPool(500);
    pool.totalPopulation = 999; // wrong
    const result = validateRaionPool(pool);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/totalPopulation.*999.*sum of age buckets/);
  });

  test('detects negative totalPopulation', () => {
    const pool = makePool();
    pool.totalPopulation = -10;
    const result = validateRaionPool(pool);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('totalPopulation is negative'))).toBe(true);
  });

  test('detects NaN totalPopulation', () => {
    const pool = makePool();
    pool.totalPopulation = NaN;
    const result = validateRaionPool(pool);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('totalPopulation is NaN'))).toBe(true);
  });

  test('detects Infinity totalPopulation', () => {
    const pool = makePool();
    pool.totalPopulation = Infinity;
    const result = validateRaionPool(pool);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('totalPopulation is not finite'))).toBe(true);
  });

  // ── NaN in buckets ──────────────────────────────────────────────────────

  test('detects NaN in male age bucket', () => {
    const pool = makePool();
    pool.maleAgeBuckets[5] = NaN;
    const result = validateRaionPool(pool);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('maleAgeBuckets[5] is NaN'))).toBe(true);
  });

  test('detects NaN in female age bucket', () => {
    const pool = makePool();
    pool.femaleAgeBuckets[10] = NaN;
    const result = validateRaionPool(pool);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('femaleAgeBuckets[10] is NaN'))).toBe(true);
  });

  // ── Negative buckets ──────────────────────────────────────────────────

  test('detects negative male age bucket', () => {
    const pool = makePool();
    pool.maleAgeBuckets[0] = -3;
    const result = validateRaionPool(pool);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('maleAgeBuckets[0] is negative'))).toBe(true);
  });

  test('detects negative female age bucket', () => {
    const pool = makePool();
    pool.femaleAgeBuckets[19] = -1;
    const result = validateRaionPool(pool);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('femaleAgeBuckets[19] is negative'))).toBe(true);
  });

  // ── Non-integer buckets ─────────────────────────────────────────────────

  test('detects non-integer male age bucket', () => {
    const pool = makePool();
    pool.maleAgeBuckets[7] = 3.5;
    pool.totalPopulation = 3.5;
    const result = validateRaionPool(pool);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('maleAgeBuckets[7] is not an integer'))).toBe(true);
  });

  test('detects non-integer female age bucket', () => {
    const pool = makePool();
    pool.femaleAgeBuckets[2] = 1.1;
    pool.totalPopulation = 1.1;
    const result = validateRaionPool(pool);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('femaleAgeBuckets[2] is not an integer'))).toBe(true);
  });

  // ── laborForce mismatch ─────────────────────────────────────────────────

  test('detects laborForce mismatch with labor buckets', () => {
    const pool = makePopulatedPool(500);
    pool.laborForce = 999; // wrong
    const result = validateRaionPool(pool);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/laborForce.*999.*sum of labor buckets/);
  });

  test('detects NaN laborForce', () => {
    const pool = makePool();
    pool.laborForce = NaN;
    const result = validateRaionPool(pool);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('laborForce is NaN'))).toBe(true);
  });

  // ── pregnancyWaves ─────────────────────────────────────────────────────

  test('detects negative pregnancyWave entry', () => {
    const pool = makePool();
    pool.pregnancyWaves = [0, -1, 0];
    const result = validateRaionPool(pool);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('pregnancyWaves[1] is negative'))).toBe(true);
  });

  test('detects NaN pregnancyWave entry', () => {
    const pool = makePool();
    pool.pregnancyWaves = [NaN, 0, 0];
    const result = validateRaionPool(pool);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('pregnancyWaves[0] is NaN'))).toBe(true);
  });

  // ── totalBirths / totalDeaths ──────────────────────────────────────────

  test('detects negative totalBirths', () => {
    const pool = makePool();
    pool.totalBirths = -5;
    const result = validateRaionPool(pool);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('totalBirths is negative'))).toBe(true);
  });

  test('detects negative totalDeaths', () => {
    const pool = makePool();
    pool.totalDeaths = -1;
    const result = validateRaionPool(pool);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('totalDeaths is negative'))).toBe(true);
  });

  test('detects NaN totalBirths', () => {
    const pool = makePool();
    pool.totalBirths = NaN;
    const result = validateRaionPool(pool);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('totalBirths is NaN'))).toBe(true);
  });

  test('detects Infinity totalDeaths', () => {
    const pool = makePool();
    pool.totalDeaths = Infinity;
    const result = validateRaionPool(pool);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('totalDeaths is not finite'))).toBe(true);
  });

  // ── assignedWorkers / idleWorkers ──────────────────────────────────────

  test('detects negative assignedWorkers', () => {
    const pool = makePool();
    pool.assignedWorkers = -2;
    const result = validateRaionPool(pool);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('assignedWorkers is negative'))).toBe(true);
  });

  test('detects negative idleWorkers', () => {
    const pool = makePool();
    pool.idleWorkers = -1;
    const result = validateRaionPool(pool);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('idleWorkers is negative'))).toBe(true);
  });

  test('detects NaN assignedWorkers', () => {
    const pool = makePool();
    pool.assignedWorkers = NaN;
    const result = validateRaionPool(pool);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('assignedWorkers is NaN'))).toBe(true);
  });

  // ── Multiple violations ────────────────────────────────────────────────

  test('reports all violations, not just the first', () => {
    const pool = makePool();
    pool.maleAgeBuckets[0] = NaN;
    pool.femaleAgeBuckets[19] = -5;
    pool.totalPopulation = -100;
    pool.totalBirths = -1;
    pool.laborForce = 999;
    pool.pregnancyWaves = [0, -3, NaN];

    const result = validateRaionPool(pool);
    expect(result.valid).toBe(false);
    // Should have at least 6 distinct violations
    expect(result.errors.length).toBeGreaterThanOrEqual(6);
    // Spot-check that specific violations appear
    expect(result.errors.some((e) => e.includes('maleAgeBuckets[0] is NaN'))).toBe(true);
    expect(result.errors.some((e) => e.includes('femaleAgeBuckets[19] is negative'))).toBe(true);
    expect(result.errors.some((e) => e.includes('totalPopulation is negative'))).toBe(true);
    expect(result.errors.some((e) => e.includes('totalBirths is negative'))).toBe(true);
    expect(result.errors.some((e) => e.includes('laborForce'))).toBe(true);
    expect(result.errors.some((e) => e.includes('pregnancyWaves'))).toBe(true);
  });

  // ── Bucket array length ────────────────────────────────────────────────

  test('detects wrong maleAgeBuckets length', () => {
    const pool = makePool();
    pool.maleAgeBuckets = new Array(15).fill(0);
    const result = validateRaionPool(pool);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('maleAgeBuckets length is 15'))).toBe(true);
  });

  test('detects wrong femaleAgeBuckets length', () => {
    const pool = makePool();
    pool.femaleAgeBuckets = new Array(25).fill(0);
    const result = validateRaionPool(pool);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('femaleAgeBuckets length is 25'))).toBe(true);
  });

  // ── Population in non-labor buckets ─────────────────────────────────────

  test('population in non-labor buckets does not inflate laborForce', () => {
    const pool = makePool();
    // Put population only in child buckets (0-2) and elderly (13-19)
    pool.maleAgeBuckets[0] = 10;
    pool.maleAgeBuckets[1] = 10;
    pool.femaleAgeBuckets[15] = 10;
    pool.femaleAgeBuckets[18] = 10;
    pool.totalPopulation = 40;
    pool.laborForce = 0; // correct: no one in buckets 3-12
    const result = validateRaionPool(pool);
    expect(result).toEqual({ valid: true, errors: [] });
  });

  // ── Infinity in bucket ──────────────────────────────────────────────────

  test('detects Infinity in age bucket', () => {
    const pool = makePool();
    pool.maleAgeBuckets[4] = Infinity;
    const result = validateRaionPool(pool);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('maleAgeBuckets[4] is not finite'))).toBe(true);
  });
});
