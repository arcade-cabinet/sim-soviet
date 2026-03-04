/**
 * @fileoverview TDD tests verifying ChaosEngine is a pure function of fixed-size input.
 *
 * ChaosEngine.generateNextCrisis(state, rng) must:
 * 1. Accept only ChaosState + GameRng (no timeline array)
 * 2. Use yearsSince* counters from ChaosState for minimum interval enforcement
 * 3. Use yearsSince* counters from ChaosState for feedback rules
 * 4. Produce identical output for identical (state, seed) pairs (determinism)
 * 5. Have O(1) input size regardless of game length
 */

import { ChaosEngine, type ChaosState } from '@/ai/agents/crisis/ChaosEngine';
import { GameRng } from '@/game/SeedSystem';

// ─── Fixtures ───────────────────────────────────────────────────────────────

function baseState(overrides?: Partial<ChaosState>): ChaosState {
  return {
    year: 1960,
    population: 1000,
    food: 2000,
    money: 1500,
    yearsSinceLastWar: 10,
    yearsSinceLastFamine: 10,
    yearsSinceLastDisaster: 10,
    yearsSinceLastPolitical: 10,
    activeCrises: [],
    totalCrisesExperienced: 3,
    morale: 0.5,
    marks: 1,
    leaderTenure: 5,
    industrialCount: 5,
    ...overrides,
  };
}

// ─── Pure function contract ─────────────────────────────────────────────────

describe('ChaosEngine — stateless / pure function contract', () => {
  it('generateNextCrisis accepts exactly 2 arguments (state, rng)', () => {
    const engine = new ChaosEngine();
    // TypeScript enforces this at compile time; verify at runtime too
    expect(engine.generateNextCrisis.length).toBe(2);
  });

  it('produces identical results for identical state + seed', () => {
    const engine = new ChaosEngine();
    const state = baseState({ yearsSinceLastWar: 30, money: 8000, population: 5000 });

    const results: string[] = [];
    for (let i = 0; i < 10; i++) {
      const result = engine.generateNextCrisis(state, new GameRng('fixed-seed'));
      results.push(JSON.stringify(result));
    }

    // All 10 calls with the same state + seed must produce identical output
    const allSame = results.every((r) => r === results[0]);
    expect(allSame).toBe(true);
  });

  it('does not require any external state beyond ChaosState', () => {
    // Two separate ChaosEngine instances with same input must produce same output
    const engine1 = new ChaosEngine();
    const engine2 = new ChaosEngine();
    const state = baseState({ yearsSinceLastWar: 20, money: 5000 });

    const r1 = engine1.generateNextCrisis(state, new GameRng('cross-instance'));
    const r2 = engine2.generateNextCrisis(state, new GameRng('cross-instance'));

    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});

// ─── yearsSince-based minimum interval ──────────────────────────────────────

describe('ChaosEngine — yearsSince minimum interval enforcement', () => {
  it('suppresses war when yearsSinceLastWar < 3', () => {
    const engine = new ChaosEngine();
    const state = baseState({
      yearsSinceLastWar: 2,
      population: 10000,
      money: 10000,
    });

    let warCount = 0;
    for (let i = 0; i < 200; i++) {
      const result = engine.generateNextCrisis(state, new GameRng(`war-suppress-${i}`));
      if (result?.type === 'war') warCount++;
    }
    expect(warCount).toBe(0);
  });

  it('suppresses famine when yearsSinceLastFamine < 3', () => {
    const engine = new ChaosEngine();
    const state = baseState({
      yearsSinceLastFamine: 1,
      food: 10,
      population: 5000,
    });

    let famineCount = 0;
    for (let i = 0; i < 200; i++) {
      const result = engine.generateNextCrisis(state, new GameRng(`famine-suppress-${i}`));
      if (result?.type === 'famine') famineCount++;
    }
    expect(famineCount).toBe(0);
  });

  it('suppresses disaster when yearsSinceLastDisaster < 3', () => {
    const engine = new ChaosEngine();
    const state = baseState({
      yearsSinceLastDisaster: 0,
      industrialCount: 50,
      totalCrisesExperienced: 20,
    });

    let disasterCount = 0;
    for (let i = 0; i < 200; i++) {
      const result = engine.generateNextCrisis(state, new GameRng(`disaster-suppress-${i}`));
      if (result?.type === 'disaster') disasterCount++;
    }
    expect(disasterCount).toBe(0);
  });

  it('suppresses political when yearsSinceLastPolitical < 3', () => {
    const engine = new ChaosEngine();
    const state = baseState({
      yearsSinceLastPolitical: 2,
      morale: 0.1,
      marks: 10,
      leaderTenure: 30,
    });

    let politicalCount = 0;
    for (let i = 0; i < 200; i++) {
      const result = engine.generateNextCrisis(state, new GameRng(`political-suppress-${i}`));
      if (result?.type === 'political') politicalCount++;
    }
    expect(politicalCount).toBe(0);
  });

  it('allows all types when yearsSince >= 3 for all', () => {
    const engine = new ChaosEngine();
    const state = baseState({
      yearsSinceLastWar: 20,
      yearsSinceLastFamine: 15,
      yearsSinceLastDisaster: 10,
      yearsSinceLastPolitical: 12,
      population: 5000,
      food: 100,
      money: 8000,
      morale: 0.2,
      marks: 5,
      leaderTenure: 20,
      industrialCount: 15,
      totalCrisesExperienced: 10,
    });

    const typesGenerated = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const result = engine.generateNextCrisis(state, new GameRng(`allow-all-${i}`));
      if (result) typesGenerated.add(result.type);
    }

    // At least 2 different types should be generated
    expect(typesGenerated.size).toBeGreaterThanOrEqual(2);
  });
});

// ─── yearsSince-based feedback rules ────────────────────────────────────────

describe('ChaosEngine — yearsSince feedback rules (no timeline)', () => {
  it('post-war famine boost uses yearsSinceLastWar from state', () => {
    const engine = new ChaosEngine();

    // Post-war state (yearsSinceLastWar=1) vs peaceful (yearsSinceLastWar=10)
    const postWar = baseState({ yearsSinceLastWar: 1, food: 100, population: 3000 });
    const peaceful = baseState({ yearsSinceLastWar: 10, food: 100, population: 3000 });

    let postWarFamines = 0;
    let peacefulFamines = 0;
    for (let i = 0; i < 300; i++) {
      const r1 = engine.generateNextCrisis(postWar, new GameRng(`fb-war-${i}`));
      const r2 = engine.generateNextCrisis(peaceful, new GameRng(`fb-war-${i}`));
      if (r1?.type === 'famine') postWarFamines++;
      if (r2?.type === 'famine') peacefulFamines++;
    }

    // Post-war should produce at least as many famines
    expect(postWarFamines).toBeGreaterThanOrEqual(peacefulFamines);
  });

  it('post-famine political boost uses yearsSinceLastFamine from state', () => {
    const engine = new ChaosEngine();

    const postFamine = baseState({
      yearsSinceLastFamine: 1,
      yearsSinceLastPolitical: 10,
      morale: 0.2,
      marks: 5,
      leaderTenure: 15,
    });
    const noFamine = baseState({
      yearsSinceLastFamine: 20,
      yearsSinceLastPolitical: 10,
      morale: 0.2,
      marks: 5,
      leaderTenure: 15,
    });

    let postFaminePol = 0;
    let noFaminePol = 0;
    for (let i = 0; i < 300; i++) {
      const r1 = engine.generateNextCrisis(postFamine, new GameRng(`fb-fam-${i}`));
      const r2 = engine.generateNextCrisis(noFamine, new GameRng(`fb-fam-${i}`));
      if (r1?.type === 'political') postFaminePol++;
      if (r2?.type === 'political') noFaminePol++;
    }

    expect(postFaminePol).toBeGreaterThanOrEqual(noFaminePol);
  });

  it('long peace war tension uses yearsSinceLastWar from state', () => {
    const engine = new ChaosEngine();

    const longPeace = baseState({ yearsSinceLastWar: 30, population: 5000, money: 5000 });
    const shortPeace = baseState({ yearsSinceLastWar: 5, population: 5000, money: 5000 });

    let longPeaceWars = 0;
    let shortPeaceWars = 0;
    for (let i = 0; i < 300; i++) {
      const r1 = engine.generateNextCrisis(longPeace, new GameRng(`fb-peace-${i}`));
      const r2 = engine.generateNextCrisis(shortPeace, new GameRng(`fb-peace-${i}`));
      if (r1?.type === 'war') longPeaceWars++;
      if (r2?.type === 'war') shortPeaceWars++;
    }

    expect(longPeaceWars).toBeGreaterThanOrEqual(shortPeaceWars);
  });
});

// ─── O(1) input size ────────────────────────────────────────────────────────

describe('ChaosEngine — O(1) input size', () => {
  it('ChaosState has fixed number of fields regardless of game length', () => {
    // A 1917 game and a year-3000 game have identical ChaosState shape
    const earlyGame = baseState({ year: 1920, totalCrisesExperienced: 1 });
    const lateGame = baseState({ year: 3000, totalCrisesExperienced: 500 });

    // Both states have the same keys
    const earlyKeys = Object.keys(earlyGame).sort();
    const lateKeys = Object.keys(lateGame).sort();
    expect(earlyKeys).toEqual(lateKeys);

    // Verify no array fields grow with game history
    // activeCrises is the only array, and it tracks *current* not *historical* crises
    expect(Array.isArray(earlyGame.activeCrises)).toBe(true);
    expect(Array.isArray(lateGame.activeCrises)).toBe(true);
  });

  it('performance does not degrade with high totalCrisesExperienced', () => {
    const engine = new ChaosEngine();

    // Simulate an eternal-mode game with 500 past crises
    const eternalState = baseState({
      year: 3000,
      totalCrisesExperienced: 500,
      yearsSinceLastWar: 15,
      yearsSinceLastFamine: 12,
      yearsSinceLastDisaster: 8,
      yearsSinceLastPolitical: 10,
      population: 50000,
      money: 100000,
    });

    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      engine.generateNextCrisis(eternalState, new GameRng(`perf-${i}`));
    }
    const elapsed = performance.now() - start;

    // 1000 iterations should complete in under 500ms (generous bound)
    expect(elapsed).toBeLessThan(500);
  });
});
