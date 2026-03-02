/**
 * @module math/poissonSampling
 *
 * Shared Poisson distribution sampler used by building production and
 * statistical demographics systems.
 *
 * Replaces N individual random rolls with a single distribution sample,
 * giving O(1) stochastic events per bucket instead of O(N) per-citizen rolls.
 */

import type { GameRng } from '@/game/SeedSystem';

/**
 * Sample from a Poisson distribution.
 * Replaces N individual random rolls with a single sample.
 *
 * For lambda < 30: Knuth inverse CDF algorithm (exact).
 * For lambda >= 30: Normal approximation via Box-Muller transform.
 *
 * @param lambda - Expected number of events (rate parameter)
 * @param rng - Seeded random number generator
 * @returns Non-negative integer sample from Poisson(lambda)
 */
export function poissonSample(lambda: number, rng: GameRng): number {
  if (!Number.isFinite(lambda)) return 0;
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
