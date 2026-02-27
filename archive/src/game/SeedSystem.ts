/**
 * @fileoverview Seeded Randomness System for SimSoviet 2000.
 *
 * Provides deterministic pseudo-random number generation tied to
 * human-readable "adjective-adjective-noun" seed phrases from
 * Soviet-themed word pools.
 *
 * Combinatorial space: 60 x 60 x 60 = 216,000 unique seed phrases.
 *
 * All game systems receive a `GameRng` instance instead of calling
 * `Math.random()` directly, ensuring reproducible playthroughs.
 */

import seedrandom from 'seedrandom';

// ─────────────────────────────────────────────────────────
//  SEED PHRASE WORD POOLS
// ─────────────────────────────────────────────────────────

const SEED_ADJECTIVES: readonly string[] = [
  // State & ideology
  'glorious',
  'eternal',
  'heroic',
  'collective',
  'dialectical',
  'proletarian',
  'magnificent',
  'revolutionary',
  'socialist',
  'triumphant',
  // Bureaucratic
  'approved',
  'classified',
  'voluntary',
  'theoretical',
  'bureaucratic',
  'unprecedented',
  'sufficient',
  'adequate',
  'mandatory',
  'regulated',
  // Environment
  'frozen',
  'iron',
  'concrete',
  'grey',
  'industrial',
  'atomic',
  'siberian',
  'muddy',
  'overcast',
  'dusty',
  // Character
  'reluctant',
  'suspicious',
  'stoic',
  'loyal',
  'dutiful',
  'obedient',
  'tireless',
  'vigilant',
  'patient',
  'modest',
  // Satirical
  'optimistic',
  'spontaneous',
  'democratic',
  'abundant',
  'comfortable',
  'efficient',
  'reliable',
  'functional',
  'celebrated',
  'harmonious',
  // Additional variety
  'correct',
  'solemn',
  'electrified',
  'mechanized',
  'fortified',
  'reformed',
  'mobilized',
  'liberated',
  'organized',
  'standardized',
];

const SEED_NOUNS: readonly string[] = [
  // Infrastructure
  'tractor',
  'factory',
  'kolkhoz',
  'sputnik',
  'samovar',
  'bunker',
  'barracks',
  'pipeline',
  'reactor',
  'turbine',
  // People & roles
  'comrade',
  'apparatchik',
  'commissar',
  'cosmonaut',
  'partisan',
  'stakhanovite',
  'politburo',
  'babushka',
  'pioneer',
  'proletariat',
  // Food & drink
  'turnip',
  'potato',
  'beet',
  'cabbage',
  'vodka',
  'borshch',
  'kvass',
  'herring',
  'sunflower',
  'rye',
  // Concepts
  'committee',
  'queue',
  'five-year-plan',
  'decree',
  'ruble',
  'quota',
  'purge',
  'gulag',
  'perestroika',
  'glasnost',
  // Objects
  'medal',
  'ushanka',
  'hammer',
  'sickle',
  'balalaika',
  'matryoshka',
  'accordion',
  'troika',
  'chess-piece',
  'filing-cabinet',
  // Nature
  'taiga',
  'steppe',
  'tundra',
  'permafrost',
  'blizzard',
  'birch',
  'bear',
  'wolf',
  'crow',
  'mushroom',
];

// ─────────────────────────────────────────────────────────
//  SEED PHRASE GENERATION
// ─────────────────────────────────────────────────────────

/**
 * Generate a Soviet-themed seed phrase: "adjective-adjective-noun".
 * Uses `Math.random()` intentionally — this is the ONE place where
 * non-deterministic randomness is appropriate (creating a new seed).
 */
export function generateSeedPhrase(): string {
  const adj1 = SEED_ADJECTIVES[Math.floor(Math.random() * SEED_ADJECTIVES.length)]!;
  let adj2 = SEED_ADJECTIVES[Math.floor(Math.random() * SEED_ADJECTIVES.length)]!;
  // Avoid duplicate adjectives
  while (adj2 === adj1) {
    adj2 = SEED_ADJECTIVES[Math.floor(Math.random() * SEED_ADJECTIVES.length)]!;
  }
  const noun = SEED_NOUNS[Math.floor(Math.random() * SEED_NOUNS.length)]!;
  return `${adj1}-${adj2}-${noun}`;
}

// ─────────────────────────────────────────────────────────
//  GAME RNG — Deterministic wrapper around seedrandom
// ─────────────────────────────────────────────────────────

/**
 * Deterministic RNG wrapper powered by seedrandom.
 *
 * All game systems use this instead of `Math.random()` to ensure
 * reproducible playthroughs given the same seed.
 */
export class GameRng {
  private rng: seedrandom.PRNG;
  readonly seed: string;

  constructor(seed?: string) {
    this.seed = seed ?? generateSeedPhrase();
    this.rng = seedrandom(this.seed);
  }

  /** Returns a float in [0, 1), like Math.random(). */
  random(): number {
    return this.rng();
  }

  /** Returns an integer in [min, max] (inclusive). */
  int(min: number, max: number): number {
    return Math.floor(this.rng() * (max - min + 1)) + min;
  }

  /** Pick a random element from a readonly array. */
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.rng() * arr.length)]!;
  }

  /** Pick a random index from an array of the given length. */
  pickIndex(length: number): number {
    return Math.floor(this.rng() * length);
  }

  /** Returns true with probability `p` (default 0.5). */
  coinFlip(p = 0.5): boolean {
    return this.rng() < p;
  }

  /** Fisher-Yates shuffle, returns a new array. */
  shuffle<T>(arr: readonly T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [result[i], result[j]] = [result[j]!, result[i]!];
    }
    return result;
  }

  /**
   * Weighted random selection. Returns the index of the chosen item.
   * `weights` is an array of non-negative numbers.
   */
  weightedIndex(weights: readonly number[]): number {
    const total = weights.reduce((sum, w) => sum + w, 0);
    let roll = this.rng() * total;
    for (let i = 0; i < weights.length; i++) {
      roll -= weights[i]!;
      if (roll <= 0) return i;
    }
    return weights.length - 1;
  }

  /**
   * Generate a unique ID string (not cryptographically secure,
   * but deterministic and collision-resistant for game use).
   */
  id(): string {
    return this.rng().toString(36).slice(2, 10);
  }
}

// ─────────────────────────────────────────────────────────
//  EXPORTS for convenience
// ─────────────────────────────────────────────────────────

export { SEED_ADJECTIVES, SEED_NOUNS };
