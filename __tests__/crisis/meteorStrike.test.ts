/**
 * @fileoverview Tests for meteor strike crisis — rollMeteorStrike, applyMeteorImpact,
 * convertCraterToMine. Pure functions using GameRng for determinism.
 */

import type { ImpactResult, MeteorEvent } from '@/ai/agents/crisis/meteorStrike';
import { applyMeteorImpact, convertCraterToMine, rollMeteorStrike } from '@/ai/agents/crisis/meteorStrike';
import { GameRng } from '@/game/SeedSystem';

// ─── rollMeteorStrike ────────────────────────────────────────────────────────

describe('rollMeteorStrike', () => {
  it('returns null most of the time (very rare event)', () => {
    const rng = new GameRng('meteor-rarity-test');
    let hits = 0;
    const trials = 10_000;
    for (let i = 0; i < trials; i++) {
      if (rollMeteorStrike(rng, 1950) !== null) hits++;
    }
    // ~0.1% base rate → expect roughly 10 hits in 10k trials
    // Allow generous range to avoid flaky tests with seeded RNG
    expect(hits).toBeLessThan(50);
  });

  it('returns a MeteorEvent with valid fields when it does hit', () => {
    // Use a seed that produces a hit by brute-forcing
    let event: MeteorEvent | null = null;
    const rng = new GameRng('meteor-hit-seed');
    for (let i = 0; i < 100_000; i++) {
      event = rollMeteorStrike(rng, 2000);
      if (event !== null) break;
    }
    // With 100k attempts at ~0.1%+ chance, we should get at least one
    expect(event).not.toBeNull();
    expect(event!.year).toBe(2000);
    expect(event!.magnitude).toBeGreaterThanOrEqual(1);
    expect(event!.magnitude).toBeLessThanOrEqual(5);
    expect(typeof event!.targetX).toBe('number');
    expect(typeof event!.targetY).toBe('number');
  });

  it('has slightly higher chance in freeform eternal mode (year > 1991)', () => {
    const rng1 = new GameRng('eternal-compare');
    const rng2 = new GameRng('eternal-compare');
    const trials = 50_000;

    let hitsNormal = 0;
    let hitsEternal = 0;
    for (let i = 0; i < trials; i++) {
      if (rollMeteorStrike(rng1, 1950) !== null) hitsNormal++;
      if (rollMeteorStrike(rng2, 2050) !== null) hitsEternal++;
    }
    // Eternal mode should have more hits (higher probability)
    // Both use same seed so RNG sequence is identical — different thresholds
    expect(hitsEternal).toBeGreaterThanOrEqual(hitsNormal);
  });

  it('is deterministic with the same seed', () => {
    const results1: Array<MeteorEvent | null> = [];
    const results2: Array<MeteorEvent | null> = [];
    const rng1 = new GameRng('determinism-test');
    const rng2 = new GameRng('determinism-test');

    for (let i = 0; i < 1000; i++) {
      results1.push(rollMeteorStrike(rng1, 1970));
      results2.push(rollMeteorStrike(rng2, 1970));
    }

    expect(results1).toEqual(results2);
  });

  it('magnitude is distributed 1-5', () => {
    const rng = new GameRng('magnitude-dist');
    const magnitudes = new Set<number>();
    // Roll enough times to see all magnitudes
    for (let i = 0; i < 500_000 && magnitudes.size < 5; i++) {
      const event = rollMeteorStrike(rng, 2050); // eternal mode for higher rate
      if (event) magnitudes.add(event.magnitude);
    }
    // Should have seen multiple magnitude values (at least 2)
    expect(magnitudes.size).toBeGreaterThanOrEqual(2);
    for (const m of magnitudes) {
      expect(m).toBeGreaterThanOrEqual(1);
      expect(m).toBeLessThanOrEqual(5);
    }
  });
});

// ─── applyMeteorImpact ──────────────────────────────────────────────────────

describe('applyMeteorImpact', () => {
  it('returns an ImpactResult with crater at target position', () => {
    const result = applyMeteorImpact(5, 5, 30);
    expect(result.crater).toEqual({ x: 5, y: 5 });
  });

  it('has a damage radius proportional to... something reasonable', () => {
    const result = applyMeteorImpact(10, 10, 30);
    expect(result.damageRadius).toBeGreaterThanOrEqual(1);
    expect(result.damageRadius).toBeLessThanOrEqual(5);
  });

  it('destroyedTiles are within damageRadius of crater', () => {
    const result = applyMeteorImpact(15, 15, 30);
    for (const tile of result.destroyedTiles) {
      const dx = tile.x - result.crater.x;
      const dy = tile.y - result.crater.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      expect(dist).toBeLessThanOrEqual(result.damageRadius + 0.5); // float tolerance
    }
  });

  it('destroyedTiles stay within grid bounds', () => {
    // Test near corner
    const result = applyMeteorImpact(0, 0, 30);
    for (const tile of result.destroyedTiles) {
      expect(tile.x).toBeGreaterThanOrEqual(0);
      expect(tile.x).toBeLessThan(30);
      expect(tile.y).toBeGreaterThanOrEqual(0);
      expect(tile.y).toBeLessThan(30);
    }
  });

  it('destroyedTiles stay within grid bounds at far corner', () => {
    const result = applyMeteorImpact(29, 29, 30);
    for (const tile of result.destroyedTiles) {
      expect(tile.x).toBeGreaterThanOrEqual(0);
      expect(tile.x).toBeLessThan(30);
      expect(tile.y).toBeGreaterThanOrEqual(0);
      expect(tile.y).toBeLessThan(30);
    }
  });

  it('resourceDeposit is one of iron, coal, or uranium', () => {
    const result = applyMeteorImpact(10, 10, 30);
    expect(['iron', 'coal', 'uranium']).toContain(result.resourceDeposit);
  });

  it('always includes at least the crater tile in destroyedTiles', () => {
    const result = applyMeteorImpact(10, 10, 30);
    const hasCrater = result.destroyedTiles.some((t) => t.x === result.crater.x && t.y === result.crater.y);
    expect(hasCrater).toBe(true);
  });
});

// ─── convertCraterToMine ─────────────────────────────────────────────────────

describe('convertCraterToMine', () => {
  it('returns open_pit_mine building type', () => {
    const impact: ImpactResult = {
      crater: { x: 5, y: 5 },
      damageRadius: 2,
      destroyedTiles: [{ x: 5, y: 5 }],
      resourceDeposit: 'iron',
    };
    const mine = convertCraterToMine(impact);
    expect(mine.buildingType).toBe('open_pit_mine');
  });

  it('preserves the resource type from the impact', () => {
    for (const resource of ['iron', 'coal', 'uranium'] as const) {
      const impact: ImpactResult = {
        crater: { x: 10, y: 10 },
        damageRadius: 2,
        destroyedTiles: [{ x: 10, y: 10 }],
        resourceDeposit: resource,
      };
      const mine = convertCraterToMine(impact);
      expect(mine.resource).toBe(resource);
    }
  });

  it('has positive capacity', () => {
    const impact: ImpactResult = {
      crater: { x: 5, y: 5 },
      damageRadius: 3,
      destroyedTiles: [
        { x: 5, y: 5 },
        { x: 5, y: 6 },
        { x: 6, y: 5 },
      ],
      resourceDeposit: 'coal',
    };
    const mine = convertCraterToMine(impact);
    expect(mine.capacity).toBeGreaterThan(0);
  });

  it('capacity scales with damage radius', () => {
    const smallImpact: ImpactResult = {
      crater: { x: 5, y: 5 },
      damageRadius: 1,
      destroyedTiles: [{ x: 5, y: 5 }],
      resourceDeposit: 'iron',
    };
    const largeImpact: ImpactResult = {
      crater: { x: 5, y: 5 },
      damageRadius: 4,
      destroyedTiles: [
        { x: 5, y: 5 },
        { x: 5, y: 6 },
        { x: 6, y: 5 },
        { x: 6, y: 6 },
      ],
      resourceDeposit: 'iron',
    };
    const smallMine = convertCraterToMine(smallImpact);
    const largeMine = convertCraterToMine(largeImpact);
    expect(largeMine.capacity).toBeGreaterThan(smallMine.capacity);
  });

  it('uranium deposits yield lower capacity than iron/coal', () => {
    const ironImpact: ImpactResult = {
      crater: { x: 5, y: 5 },
      damageRadius: 3,
      destroyedTiles: [{ x: 5, y: 5 }],
      resourceDeposit: 'iron',
    };
    const uraniumImpact: ImpactResult = {
      crater: { x: 5, y: 5 },
      damageRadius: 3,
      destroyedTiles: [{ x: 5, y: 5 }],
      resourceDeposit: 'uranium',
    };
    const ironMine = convertCraterToMine(ironImpact);
    const uraniumMine = convertCraterToMine(uraniumImpact);
    // Uranium is rarer/more valuable so lower raw capacity makes sense
    expect(uraniumMine.capacity).toBeLessThan(ironMine.capacity);
  });
});
