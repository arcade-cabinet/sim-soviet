/**
 * Tests for statistical demographics system (aggregate population mode).
 *
 * Validates Poisson sampling, birth/death/aging ticks operating on
 * RaionPool age buckets instead of individual citizen entities.
 */

import type { RaionPool } from '@/ecs/world';
import { GameRng } from '@/game/SeedSystem';
import {
  poissonSample,
  statisticalAgingTick,
  statisticalBirthTick,
  statisticalDeathTick,
} from '@/ai/agents/social/statisticalDemographics';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Create a fresh RaionPool with zeroed buckets. */
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

/** Create a pool with a realistic population distribution for testing. */
function makePopulatedPool(population: number): RaionPool {
  const pool = makePool();
  // Distribute roughly evenly across working-age buckets (3-12)
  const perBucket = Math.floor(population / 20); // 10 buckets × 2 genders
  for (let i = 3; i <= 12; i++) {
    pool.maleAgeBuckets[i] = perBucket;
    pool.femaleAgeBuckets[i] = perBucket;
  }
  pool.totalPopulation = population;
  pool.laborForce = population;
  return pool;
}

// ── Poisson Sampling ─────────────────────────────────────────────────────────

describe('poissonSample', () => {
  it('returns 0 for lambda=0', () => {
    const rng = new GameRng('test-poisson-zero');
    expect(poissonSample(0, rng)).toBe(0);
  });

  it('returns 0 for negative lambda', () => {
    const rng = new GameRng('test-poisson-neg');
    expect(poissonSample(-5, rng)).toBe(0);
  });

  it('produces non-negative results for small lambda (Knuth path)', () => {
    const rng = new GameRng('test-poisson-small');
    for (let i = 0; i < 100; i++) {
      const result = poissonSample(5, rng);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(result)).toBe(true);
    }
  });

  it('produces non-negative results for large lambda (normal approximation path)', () => {
    const rng = new GameRng('test-poisson-large');
    for (let i = 0; i < 100; i++) {
      const result = poissonSample(50, rng);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(result)).toBe(true);
    }
  });

  it('mean of many samples approximates lambda', () => {
    const rng = new GameRng('test-poisson-mean');
    const lambda = 10;
    const N = 5000;
    let sum = 0;
    for (let i = 0; i < N; i++) {
      sum += poissonSample(lambda, rng);
    }
    const mean = sum / N;
    // Within 15% of expected value
    expect(mean).toBeGreaterThan(lambda * 0.85);
    expect(mean).toBeLessThan(lambda * 1.15);
  });

  it('mean of large lambda samples approximates lambda', () => {
    const rng = new GameRng('test-poisson-mean-large');
    const lambda = 100;
    const N = 3000;
    let sum = 0;
    for (let i = 0; i < N; i++) {
      sum += poissonSample(lambda, rng);
    }
    const mean = sum / N;
    expect(mean).toBeGreaterThan(lambda * 0.9);
    expect(mean).toBeLessThan(lambda * 1.1);
  });
});

// ── Statistical Birth Tick ───────────────────────────────────────────────────

describe('statisticalBirthTick', () => {
  it('produces births proportional to eligible women', () => {
    const rng = new GameRng('test-births-proportional');

    // Small population
    const smallPool = makePool();
    smallPool.femaleAgeBuckets[5] = 10; // 10 women age 25-29
    smallPool.totalPopulation = 10;
    smallPool.pregnancyWaves = [0, 0, 0];

    // Large population
    const largePool = makePool();
    largePool.femaleAgeBuckets[5] = 100; // 100 women age 25-29
    largePool.totalPopulation = 100;
    largePool.pregnancyWaves = [0, 0, 0];

    // Run many ticks to accumulate conceptions
    const rng1 = new GameRng('test-births-prop-small');
    const rng2 = new GameRng('test-births-prop-large');
    let smallConceptions = 0;
    let largeConceptions = 0;

    for (let i = 0; i < 200; i++) {
      statisticalBirthTick(smallPool, 1.0, 'revolution', rng1);
      statisticalBirthTick(largePool, 1.0, 'revolution', rng2);
      smallConceptions += smallPool.pregnancyWaves[2]!;
      largeConceptions += largePool.pregnancyWaves[2]!;
    }

    // Large pool should have roughly 10x the conceptions
    expect(largeConceptions).toBeGreaterThan(smallConceptions * 3);
  });

  it('pregnancy shift register progresses conceptions to births', () => {
    const rng = new GameRng('test-pregnancy-shift');
    const pool = makePool();
    pool.femaleAgeBuckets[5] = 50; // 50 women age 25-29
    pool.totalPopulation = 50;
    pool.pregnancyWaves = [0, 0, 0];

    // Tick 1: conceptions go into wave[2]
    statisticalBirthTick(pool, 1.0, 'revolution', rng);
    const wave2After1 = pool.pregnancyWaves[2]!;
    expect(pool.pregnancyWaves[0]).toBe(0); // nothing delivering yet
    expect(pool.pregnancyWaves[1]).toBe(0);

    // Tick 2: wave[2] shifts to wave[1]
    statisticalBirthTick(pool, 1.0, 'revolution', rng);
    expect(pool.pregnancyWaves[0]).toBe(0);
    expect(pool.pregnancyWaves[1]).toBe(wave2After1);

    // Tick 3: wave[1] shifts to wave[0] — these will deliver next tick
    statisticalBirthTick(pool, 1.0, 'revolution', rng);
    expect(pool.pregnancyWaves[0]).toBe(wave2After1);

    // Tick 4: wave[0] delivers
    const birthsBefore = pool.totalBirths;
    const births = statisticalBirthTick(pool, 1.0, 'revolution', rng);
    // The births returned should come from the original wave2After1 value
    // that has now shifted all the way to delivery position
    // (wave[0] before this tick was wave2After1 from tick 1)
    // However, tick 3 shifted tick 2's wave[2] into wave[1], and tick 2's
    // wave[1] (which was wave2After1) into wave[0]
    expect(pool.totalBirths).toBe(birthsBefore + births);
  });

  it('births add to age bucket 0 for both genders', () => {
    const rng = new GameRng('test-birth-bucket-0');
    const pool = makePool();
    pool.femaleAgeBuckets[5] = 100;
    pool.totalPopulation = 100;
    // Pre-load pregnancy wave about to deliver
    pool.pregnancyWaves = [20, 0, 0];

    const births = statisticalBirthTick(pool, 1.0, 'revolution', rng);
    expect(births).toBe(20);
    expect(pool.maleAgeBuckets[0]! + pool.femaleAgeBuckets[0]!).toBe(20);
    expect(pool.totalPopulation).toBe(120);
    expect(pool.birthsThisYear).toBe(20);
    expect(pool.totalBirths).toBe(20);
  });

  it('era modifier reduces conceptions in wartime', () => {
    // Compare revolution (1.0) vs great_patriotic_war (0.3)
    let peaceConceptions = 0;
    let warConceptions = 0;

    for (let trial = 0; trial < 50; trial++) {
      const peaceRng = new GameRng(`peace-${trial}`);
      const warRng = new GameRng(`war-${trial}`);

      const peacePool = makePool();
      peacePool.femaleAgeBuckets[5] = 200;
      peacePool.totalPopulation = 200;
      peacePool.pregnancyWaves = [0, 0, 0];

      const warPool = makePool();
      warPool.femaleAgeBuckets[5] = 200;
      warPool.totalPopulation = 200;
      warPool.pregnancyWaves = [0, 0, 0];

      statisticalBirthTick(peacePool, 1.0, 'revolution', peaceRng);
      statisticalBirthTick(warPool, 1.0, 'great_patriotic_war', warRng);

      peaceConceptions += peacePool.pregnancyWaves[2]!;
      warConceptions += warPool.pregnancyWaves[2]!;
    }

    // War conceptions should be significantly lower
    expect(warConceptions).toBeLessThan(peaceConceptions * 0.6);
  });

  it('no births when no eligible women', () => {
    const rng = new GameRng('test-no-women');
    const pool = makePool();
    pool.maleAgeBuckets[5] = 100; // only men
    pool.totalPopulation = 100;
    pool.pregnancyWaves = [0, 0, 0];

    statisticalBirthTick(pool, 1.0, 'revolution', rng);
    expect(pool.pregnancyWaves[2]).toBe(0);
    expect(pool.totalBirths).toBe(0);
  });
});

// ── Statistical Death Tick ───────────────────────────────────────────────────

describe('statisticalDeathTick', () => {
  it('deaths scale with starvation modifier', () => {
    let fedDeaths = 0;
    let starvingDeaths = 0;

    for (let trial = 0; trial < 100; trial++) {
      const fedRng = new GameRng(`fed-${trial}`);
      const starveRng = new GameRng(`starve-${trial}`);

      const fedPool = makePopulatedPool(500);
      const starvePool = makePopulatedPool(500);

      fedDeaths += statisticalDeathTick(fedPool, 1.0, fedRng);
      starvingDeaths += statisticalDeathTick(starvePool, 0.0, starveRng);
    }

    // Starvation should cause significantly more deaths (up to 3x modifier)
    expect(starvingDeaths).toBeGreaterThan(fedDeaths * 1.5);
  });

  it('never kills more than bucket count', () => {
    const rng = new GameRng('test-death-cap');
    const pool = makePool();
    // Put just 1 person in the highest-mortality bucket
    pool.maleAgeBuckets[19] = 1;
    pool.totalPopulation = 1;

    // Run many times — should never go negative
    for (let i = 0; i < 50; i++) {
      const freshPool = makePool();
      freshPool.maleAgeBuckets[19] = 1;
      freshPool.totalPopulation = 1;
      statisticalDeathTick(freshPool, 0.0, new GameRng(`cap-${i}`));
      expect(freshPool.maleAgeBuckets[19]).toBeGreaterThanOrEqual(0);
      expect(freshPool.totalPopulation).toBeGreaterThanOrEqual(0);
    }
  });

  it('recalculates labor force after deaths', () => {
    const rng = new GameRng('test-labor-recalc');
    const pool = makePopulatedPool(400);
    const laborBefore = pool.laborForce;

    // Extreme starvation to guarantee some deaths
    statisticalDeathTick(pool, 0.0, rng);

    // Labor force should be recalculated (may or may not have changed,
    // but it should equal the sum of working-age buckets)
    let expectedLabor = 0;
    for (let i = 3; i <= 12; i++) {
      expectedLabor += pool.maleAgeBuckets[i]! + pool.femaleAgeBuckets[i]!;
    }
    expect(pool.laborForce).toBe(expectedLabor);
    expect(pool.laborForce).toBeLessThanOrEqual(laborBefore);
  });

  it('updates death counters correctly', () => {
    const rng = new GameRng('test-death-counters');
    const pool = makePopulatedPool(500);
    pool.deathsThisYear = 10;
    pool.totalDeaths = 100;
    const popBefore = pool.totalPopulation;

    const deaths = statisticalDeathTick(pool, 0.5, rng);

    expect(pool.deathsThisYear).toBe(10 + deaths);
    expect(pool.totalDeaths).toBe(100 + deaths);
    expect(pool.totalPopulation).toBe(popBefore - deaths);
  });

  it('infant bucket has highest mortality rate', () => {
    let infantDeaths = 0;
    let adultDeaths = 0;

    for (let trial = 0; trial < 200; trial++) {
      const infantRng = new GameRng(`infant-${trial}`);
      const adultRng = new GameRng(`adult-${trial}`);

      const infantPool = makePool();
      infantPool.maleAgeBuckets[0] = 100; // 100 infants
      infantPool.totalPopulation = 100;

      const adultPool = makePool();
      adultPool.maleAgeBuckets[5] = 100; // 100 adults age 25-29
      adultPool.totalPopulation = 100;

      infantDeaths += statisticalDeathTick(infantPool, 1.0, infantRng);
      adultDeaths += statisticalDeathTick(adultPool, 1.0, adultRng);
    }

    // Infant mortality (0.08/yr) >> adult mortality (0.005/yr)
    expect(infantDeaths).toBeGreaterThan(adultDeaths * 5);
  });
});

// ── Statistical Aging Tick ───────────────────────────────────────────────────

describe('statisticalAgingTick', () => {
  it('shifts buckets correctly', () => {
    const pool = makePool();
    pool.maleAgeBuckets[0] = 10;
    pool.maleAgeBuckets[5] = 20;
    pool.femaleAgeBuckets[3] = 15;
    pool.totalPopulation = 45;

    statisticalAgingTick(pool);

    // Bucket 0 should now be empty (shifted to bucket 1)
    expect(pool.maleAgeBuckets[0]).toBe(0);
    expect(pool.maleAgeBuckets[1]).toBe(10);
    expect(pool.maleAgeBuckets[6]).toBe(20);
    expect(pool.femaleAgeBuckets[4]).toBe(15);
    // No overflow — no one was in bucket 19
    expect(pool.totalPopulation).toBe(45);
  });

  it('overflow from bucket 19 causes death', () => {
    const pool = makePool();
    pool.maleAgeBuckets[19] = 5;
    pool.femaleAgeBuckets[19] = 3;
    pool.totalPopulation = 8;

    const overflowDeaths = statisticalAgingTick(pool);

    expect(overflowDeaths).toBe(8);
    expect(pool.totalPopulation).toBe(0);
    expect(pool.deathsThisYear).toBe(8);
    expect(pool.totalDeaths).toBe(8);
  });

  it('bucket 0 is zeroed after aging', () => {
    const pool = makePool();
    pool.maleAgeBuckets[0] = 10;
    pool.femaleAgeBuckets[0] = 5;
    pool.totalPopulation = 15;

    statisticalAgingTick(pool);

    expect(pool.maleAgeBuckets[0]).toBe(0);
    expect(pool.femaleAgeBuckets[0]).toBe(0);
    // Shifted to bucket 1
    expect(pool.maleAgeBuckets[1]).toBe(10);
    expect(pool.femaleAgeBuckets[1]).toBe(5);
  });

  it('preserves total population when no overflow', () => {
    const pool = makePopulatedPool(300);
    // Ensure bucket 19 is empty
    pool.maleAgeBuckets[19] = 0;
    pool.femaleAgeBuckets[19] = 0;

    const popBefore = pool.totalPopulation;
    const overflowDeaths = statisticalAgingTick(pool);

    expect(overflowDeaths).toBe(0);
    expect(pool.totalPopulation).toBe(popBefore);
  });
});

// ── O(20) Complexity ─────────────────────────────────────────────────────────

describe('performance', () => {
  it('all functions are O(20) — constant time regardless of population', () => {
    const rng = new GameRng('test-perf');

    // 1 million population
    const pool = makePool();
    for (let i = 0; i < 20; i++) {
      pool.maleAgeBuckets[i] = 25000;
      pool.femaleAgeBuckets[i] = 25000;
    }
    pool.totalPopulation = 1_000_000;
    pool.pregnancyWaves = [500, 400, 300];
    pool.laborForce = 500000;

    // These should complete near-instantly (well under 100ms)
    const start = performance.now();

    for (let i = 0; i < 1000; i++) {
      const p = makePool();
      for (let j = 0; j < 20; j++) {
        p.maleAgeBuckets[j] = 25000;
        p.femaleAgeBuckets[j] = 25000;
      }
      p.totalPopulation = 1_000_000;
      p.pregnancyWaves = [500, 400, 300];
      p.laborForce = 500000;

      statisticalBirthTick(p, 0.8, 'stagnation', rng);
      statisticalDeathTick(p, 0.8, rng);
      statisticalAgingTick(p);
    }

    const elapsed = performance.now() - start;
    // 1000 iterations of all 3 functions on 1M pop should take < 1 second
    expect(elapsed).toBeLessThan(1000);
  });
});
