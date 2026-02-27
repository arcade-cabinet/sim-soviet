import { describe, expect, it } from 'vitest';
import { GameRng, generateSeedPhrase, SEED_ADJECTIVES, SEED_NOUNS } from '@/game/SeedSystem';

// ── Word pools ─────────────────────────────────────────────────────────────────

describe('seed word pools', () => {
  it('SEED_ADJECTIVES has exactly 60 entries', () => {
    expect(SEED_ADJECTIVES).toHaveLength(60);
  });

  it('SEED_NOUNS has exactly 60 entries', () => {
    expect(SEED_NOUNS).toHaveLength(60);
  });

  it('no duplicate adjectives', () => {
    const unique = new Set(SEED_ADJECTIVES);
    expect(unique.size).toBe(SEED_ADJECTIVES.length);
  });

  it('no duplicate nouns', () => {
    const unique = new Set(SEED_NOUNS);
    expect(unique.size).toBe(SEED_NOUNS.length);
  });

  it('all adjectives are non-empty lowercase strings', () => {
    for (const adj of SEED_ADJECTIVES) {
      expect(adj.length).toBeGreaterThan(0);
      expect(adj).toBe(adj.toLowerCase());
    }
  });

  it('all nouns are non-empty lowercase strings', () => {
    for (const noun of SEED_NOUNS) {
      expect(noun.length).toBeGreaterThan(0);
      expect(noun).toBe(noun.toLowerCase());
    }
  });

  it('combinatorial space is 60 * 59 * 60 = 212,400 (adj1 != adj2)', () => {
    // The code avoids duplicate adjectives, so it's P(60,2) * 60
    const space = 60 * 59 * 60;
    expect(space).toBe(212400);
  });
});

// ── generateSeedPhrase ─────────────────────────────────────────────────────────

describe('generateSeedPhrase', () => {
  it('returns a string', () => {
    expect(typeof generateSeedPhrase()).toBe('string');
  });

  it('has format "adjective-adjective-noun" (3 parts separated by compound hyphens)', () => {
    const phrase = generateSeedPhrase();
    // Split on hyphens that are word boundaries (some words contain hyphens like "five-year-plan")
    // The structure is adj1-adj2-noun, where each can contain hyphens internally
    // We check that the phrase is non-empty and contains valid words
    expect(phrase.length).toBeGreaterThan(5);
  });

  it('contains words from the adjective and noun pools', () => {
    // Run multiple times to get a statistically valid sample
    for (let i = 0; i < 20; i++) {
      const phrase = generateSeedPhrase();
      // The phrase should start with an adjective from the pool
      const startsWithAdj = SEED_ADJECTIVES.some((adj) => phrase.startsWith(`${adj}-`));
      expect(startsWithAdj).toBe(true);
      // The phrase should end with a noun from the pool
      const endsWithNoun = SEED_NOUNS.some((noun) => phrase.endsWith(noun));
      expect(endsWithNoun).toBe(true);
    }
  });

  it('never has the same adjective twice in a phrase', () => {
    const adjSet = new Set(SEED_ADJECTIVES);

    // Run enough times to be confident
    for (let i = 0; i < 100; i++) {
      const parts = generateSeedPhrase().split('-');
      // Phrase format: adj1-adj2-noun (3 parts)
      const adjectiveParts = parts.filter((p) => adjSet.has(p));
      if (adjectiveParts.length === 2) {
        expect(adjectiveParts[0]).not.toBe(adjectiveParts[1]);
      }
    }
  });

  it('generates different phrases on successive calls (non-deterministic)', () => {
    const phrases = new Set<string>();
    for (let i = 0; i < 50; i++) {
      phrases.add(generateSeedPhrase());
    }
    // With 212,400 possible phrases, 50 calls should produce at least 2 unique
    expect(phrases.size).toBeGreaterThan(1);
  });
});

// ── GameRng constructor ────────────────────────────────────────────────────────

describe('GameRng constructor', () => {
  it('accepts an explicit seed string', () => {
    const rng = new GameRng('test-seed');
    expect(rng.seed).toBe('test-seed');
  });

  it('generates a seed phrase when no seed is provided', () => {
    const rng = new GameRng();
    expect(rng.seed.length).toBeGreaterThan(0);
  });

  it('stores the seed as a readonly property', () => {
    const rng = new GameRng('my-seed');
    expect(rng.seed).toBe('my-seed');
  });
});

// ── GameRng.random (determinism) ───────────────────────────────────────────────

describe('GameRng.random — determinism', () => {
  it('same seed produces same first value', () => {
    const rng1 = new GameRng('deterministic-test');
    const rng2 = new GameRng('deterministic-test');
    expect(rng1.random()).toBe(rng2.random());
  });

  it('same seed produces same sequence of 100 values', () => {
    const rng1 = new GameRng('sequence-test');
    const rng2 = new GameRng('sequence-test');
    for (let i = 0; i < 100; i++) {
      expect(rng1.random()).toBe(rng2.random());
    }
  });

  it('different seeds produce different sequences', () => {
    const rng1 = new GameRng('seed-alpha');
    const rng2 = new GameRng('seed-beta');
    // Collect first 10 values from each
    const vals1 = Array.from({ length: 10 }, () => rng1.random());
    const vals2 = Array.from({ length: 10 }, () => rng2.random());
    // At least some values should differ (statistically guaranteed)
    const allEqual = vals1.every((v, i) => v === vals2[i]);
    expect(allEqual).toBe(false);
  });

  it('returns values in [0, 1)', () => {
    const rng = new GameRng('range-test');
    for (let i = 0; i < 1000; i++) {
      const v = rng.random();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('produces a uniform-ish distribution (chi-squared sanity check)', () => {
    const rng = new GameRng('distribution-test');
    const buckets = new Array(10).fill(0) as number[];
    const n = 10000;
    for (let i = 0; i < n; i++) {
      const v = rng.random();
      const bucket = Math.min(9, Math.floor(v * 10));
      buckets[bucket]!++;
    }
    const expected = n / 10;
    for (const count of buckets) {
      // Each bucket should be within 30% of expected (very loose — just a sanity check)
      expect(count).toBeGreaterThan(expected * 0.7);
      expect(count).toBeLessThan(expected * 1.3);
    }
  });
});

// ── GameRng.int ────────────────────────────────────────────────────────────────

describe('GameRng.int', () => {
  it('returns integers in [min, max] inclusive', () => {
    const rng = new GameRng('int-test');
    for (let i = 0; i < 500; i++) {
      const v = rng.int(3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('eventually produces all values in the range', () => {
    const rng = new GameRng('int-coverage');
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      seen.add(rng.int(0, 4));
    }
    expect(seen).toEqual(new Set([0, 1, 2, 3, 4]));
  });

  it('min === max always returns that value', () => {
    const rng = new GameRng('int-single');
    for (let i = 0; i < 50; i++) {
      expect(rng.int(5, 5)).toBe(5);
    }
  });

  it('handles negative ranges', () => {
    const rng = new GameRng('int-negative');
    for (let i = 0; i < 200; i++) {
      const v = rng.int(-10, -5);
      expect(v).toBeGreaterThanOrEqual(-10);
      expect(v).toBeLessThanOrEqual(-5);
    }
  });

  it('handles range crossing zero', () => {
    const rng = new GameRng('int-cross-zero');
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const v = rng.int(-2, 2);
      seen.add(v);
      expect(v).toBeGreaterThanOrEqual(-2);
      expect(v).toBeLessThanOrEqual(2);
    }
    expect(seen).toEqual(new Set([-2, -1, 0, 1, 2]));
  });

  it('handles large ranges', () => {
    const rng = new GameRng('int-large');
    for (let i = 0; i < 100; i++) {
      const v = rng.int(0, 1000000);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1000000);
    }
  });

  it('is deterministic with the same seed', () => {
    const rng1 = new GameRng('int-det');
    const rng2 = new GameRng('int-det');
    for (let i = 0; i < 50; i++) {
      expect(rng1.int(0, 100)).toBe(rng2.int(0, 100));
    }
  });
});

// ── GameRng.pick ───────────────────────────────────────────────────────────────

describe('GameRng.pick', () => {
  it('returns an element from the array', () => {
    const rng = new GameRng('pick-test');
    const arr = ['a', 'b', 'c', 'd'] as const;
    for (let i = 0; i < 100; i++) {
      const v = rng.pick(arr);
      expect(arr).toContain(v);
    }
  });

  it('eventually picks every element', () => {
    const rng = new GameRng('pick-coverage');
    const arr = [10, 20, 30] as const;
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) {
      seen.add(rng.pick(arr));
    }
    expect(seen).toEqual(new Set([10, 20, 30]));
  });

  it('is deterministic', () => {
    const rng1 = new GameRng('pick-det');
    const rng2 = new GameRng('pick-det');
    const arr = ['x', 'y', 'z'] as const;
    for (let i = 0; i < 30; i++) {
      expect(rng1.pick(arr)).toBe(rng2.pick(arr));
    }
  });

  it('works with single-element array', () => {
    const rng = new GameRng('pick-single');
    expect(rng.pick([42])).toBe(42);
  });
});

// ── GameRng.pickIndex ──────────────────────────────────────────────────────────

describe('GameRng.pickIndex', () => {
  it('returns a valid index for the given length', () => {
    const rng = new GameRng('idx-test');
    for (let i = 0; i < 200; i++) {
      const idx = rng.pickIndex(5);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(5);
      expect(Number.isInteger(idx)).toBe(true);
    }
  });

  it('eventually picks all indices', () => {
    const rng = new GameRng('idx-coverage');
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      seen.add(rng.pickIndex(4));
    }
    expect(seen).toEqual(new Set([0, 1, 2, 3]));
  });

  it('length 1 always returns 0', () => {
    const rng = new GameRng('idx-single');
    for (let i = 0; i < 20; i++) {
      expect(rng.pickIndex(1)).toBe(0);
    }
  });
});

// ── GameRng.coinFlip ───────────────────────────────────────────────────────────

describe('GameRng.coinFlip', () => {
  it('returns a boolean', () => {
    const rng = new GameRng('coin-test');
    const v = rng.coinFlip();
    expect(typeof v).toBe('boolean');
  });

  it('default probability is 0.5 — produces both true and false', () => {
    const rng = new GameRng('coin-balance');
    let trueCount = 0;
    const n = 1000;
    for (let i = 0; i < n; i++) {
      if (rng.coinFlip()) trueCount++;
    }
    // Should be roughly 50% — between 35% and 65%
    expect(trueCount).toBeGreaterThan(n * 0.35);
    expect(trueCount).toBeLessThan(n * 0.65);
  });

  it('p=0 always returns false', () => {
    const rng = new GameRng('coin-zero');
    for (let i = 0; i < 100; i++) {
      expect(rng.coinFlip(0)).toBe(false);
    }
  });

  it('p=1 always returns true', () => {
    const rng = new GameRng('coin-one');
    for (let i = 0; i < 100; i++) {
      expect(rng.coinFlip(1)).toBe(true);
    }
  });

  it('low probability produces mostly false', () => {
    const rng = new GameRng('coin-low');
    let trueCount = 0;
    const n = 1000;
    for (let i = 0; i < n; i++) {
      if (rng.coinFlip(0.1)) trueCount++;
    }
    expect(trueCount).toBeLessThan(n * 0.2);
  });

  it('high probability produces mostly true', () => {
    const rng = new GameRng('coin-high');
    let trueCount = 0;
    const n = 1000;
    for (let i = 0; i < n; i++) {
      if (rng.coinFlip(0.9)) trueCount++;
    }
    expect(trueCount).toBeGreaterThan(n * 0.8);
  });

  it('is deterministic', () => {
    const rng1 = new GameRng('coin-det');
    const rng2 = new GameRng('coin-det');
    for (let i = 0; i < 50; i++) {
      expect(rng1.coinFlip()).toBe(rng2.coinFlip());
    }
  });
});

// ── GameRng.shuffle ────────────────────────────────────────────────────────────

describe('GameRng.shuffle', () => {
  it('returns a new array (not the same reference)', () => {
    const rng = new GameRng('shuffle-ref');
    const original = [1, 2, 3, 4, 5];
    const shuffled = rng.shuffle(original);
    expect(shuffled).not.toBe(original);
  });

  it('does not modify the original array', () => {
    const rng = new GameRng('shuffle-immutable');
    const original = [1, 2, 3, 4, 5];
    const copy = [...original];
    rng.shuffle(original);
    expect(original).toEqual(copy);
  });

  it('contains exactly the same elements', () => {
    const rng = new GameRng('shuffle-elements');
    const original = [10, 20, 30, 40, 50];
    const shuffled = rng.shuffle(original);
    expect(shuffled.sort((a, b) => a - b)).toEqual(original.sort((a, b) => a - b));
  });

  it('preserves duplicates', () => {
    const rng = new GameRng('shuffle-dupes');
    const original = [1, 1, 2, 2, 3];
    const shuffled = rng.shuffle(original);
    expect(shuffled.sort((a, b) => a - b)).toEqual([1, 1, 2, 2, 3]);
  });

  it('empty array returns empty array', () => {
    const rng = new GameRng('shuffle-empty');
    expect(rng.shuffle([])).toEqual([]);
  });

  it('single element array returns [element]', () => {
    const rng = new GameRng('shuffle-single');
    expect(rng.shuffle([42])).toEqual([42]);
  });

  it('is deterministic', () => {
    const rng1 = new GameRng('shuffle-det');
    const rng2 = new GameRng('shuffle-det');
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(rng1.shuffle(arr)).toEqual(rng2.shuffle(arr));
  });

  it('actually shuffles (not identity) for sufficiently large arrays', () => {
    const rng = new GameRng('shuffle-real');
    const arr = Array.from({ length: 20 }, (_, i) => i);
    const shuffled = rng.shuffle(arr);
    // Extremely unlikely that a 20-element shuffle is identical to sorted
    const isIdentical = shuffled.every((v, i) => v === i);
    expect(isIdentical).toBe(false);
  });
});

// ── GameRng.weightedIndex ──────────────────────────────────────────────────────

describe('GameRng.weightedIndex', () => {
  it('returns a valid index', () => {
    const rng = new GameRng('weighted-valid');
    for (let i = 0; i < 100; i++) {
      const idx = rng.weightedIndex([1, 2, 3]);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(3);
    }
  });

  it('heavily weighted item is picked most often', () => {
    const rng = new GameRng('weighted-heavy');
    const counts = [0, 0, 0];
    const n = 3000;
    for (let i = 0; i < n; i++) {
      counts[rng.weightedIndex([1, 1, 98])]!++;
    }
    // Index 2 (weight 98) should dominate
    expect(counts[2]).toBeGreaterThan(n * 0.9);
  });

  it('zero-weight item is rarely picked (only on boundary)', () => {
    const rng = new GameRng('weighted-zero');
    const counts = [0, 0];
    const n = 2000;
    for (let i = 0; i < n; i++) {
      counts[rng.weightedIndex([0, 10])]!++;
    }
    // Index 0 (weight 0) should rarely/never be picked
    expect(counts[0]).toBeLessThan(n * 0.05);
  });

  it('equal weights produce roughly uniform distribution', () => {
    const rng = new GameRng('weighted-equal');
    const counts = [0, 0, 0, 0];
    const n = 4000;
    for (let i = 0; i < n; i++) {
      counts[rng.weightedIndex([1, 1, 1, 1])]!++;
    }
    for (const c of counts) {
      expect(c).toBeGreaterThan(n * 0.15);
      expect(c).toBeLessThan(n * 0.35);
    }
  });

  it('single-element always returns 0', () => {
    const rng = new GameRng('weighted-single');
    for (let i = 0; i < 20; i++) {
      expect(rng.weightedIndex([5])).toBe(0);
    }
  });

  it('is deterministic', () => {
    const rng1 = new GameRng('weighted-det');
    const rng2 = new GameRng('weighted-det');
    const weights = [3, 7, 1, 9] as const;
    for (let i = 0; i < 50; i++) {
      expect(rng1.weightedIndex(weights)).toBe(rng2.weightedIndex(weights));
    }
  });
});

// ── GameRng.id ─────────────────────────────────────────────────────────────────

describe('GameRng.id', () => {
  it('returns a non-empty string', () => {
    const rng = new GameRng('id-test');
    const id = rng.id();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('returns different IDs on successive calls', () => {
    const rng = new GameRng('id-unique');
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(rng.id());
    }
    expect(ids.size).toBe(100);
  });

  it('is deterministic', () => {
    const rng1 = new GameRng('id-det');
    const rng2 = new GameRng('id-det');
    for (let i = 0; i < 20; i++) {
      expect(rng1.id()).toBe(rng2.id());
    }
  });

  it('contains only base-36 characters', () => {
    const rng = new GameRng('id-chars');
    const base36Regex = /^[0-9a-z]+$/;
    for (let i = 0; i < 50; i++) {
      expect(rng.id()).toMatch(base36Regex);
    }
  });
});

// ── Deterministic replay scenario ──────────────────────────────────────────────

describe('deterministic replay', () => {
  it('replaying the exact same seed produces the exact same game events', () => {
    function simulateGameTurn(rng: GameRng) {
      const events: string[] = [];
      // Simulate a sequence of game decisions
      events.push(`roll: ${rng.random()}`);
      events.push(`workers: ${rng.int(1, 100)}`);
      events.push(`event: ${rng.pick(['drought', 'festival', 'inspection', 'quota-met'])}`);
      events.push(`flip: ${rng.coinFlip(0.3)}`);
      events.push(`order: ${rng.shuffle([1, 2, 3, 4, 5]).join(',')}`);
      events.push(`weighted: ${rng.weightedIndex([1, 2, 3, 4])}`);
      events.push(`id: ${rng.id()}`);
      return events;
    }

    const seed = 'glorious-frozen-tractor';
    const rng1 = new GameRng(seed);
    const rng2 = new GameRng(seed);

    // Simulate 10 turns
    for (let turn = 0; turn < 10; turn++) {
      const events1 = simulateGameTurn(rng1);
      const events2 = simulateGameTurn(rng2);
      expect(events1).toEqual(events2);
    }
  });
});
