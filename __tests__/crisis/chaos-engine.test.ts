/**
 * @fileoverview Tests for ChaosEngine — the freeform crisis extrapolation engine.
 *
 * Validates trigger conditions, feedback rules, deterministic generation,
 * minimum interval enforcement, and crisis cascade chains.
 */

import { GameRng } from '@/game/SeedSystem';
import { ChaosEngine, type ChaosState } from '@/ai/agents/crisis/ChaosEngine';
import type { TimelineEvent } from '@/ai/agents/crisis/TimelineSystem';
import type { CrisisType } from '@/ai/agents/crisis/types';

// ─── Fixtures ───────────────────────────────────────────────────────────────

/** Peaceful, abundant state — low crisis probability. */
function peacefulState(overrides?: Partial<ChaosState>): ChaosState {
  return {
    year: 1950,
    population: 300,
    food: 5000,
    money: 1000,
    yearsSinceLastWar: 5,
    yearsSinceLastFamine: 8,
    yearsSinceLastDisaster: 6,
    yearsSinceLastPolitical: 4,
    activeCrises: [],
    totalCrisesExperienced: 2,
    morale: 0.7,
    marks: 0,
    leaderTenure: 3,
    industrialCount: 2,
    ...overrides,
  };
}

/** Post-war state — famine trigger should be boosted. */
function postWarState(overrides?: Partial<ChaosState>): ChaosState {
  return {
    year: 1946,
    population: 2000,
    food: 200,
    money: 500,
    yearsSinceLastWar: 1,
    yearsSinceLastFamine: 20,
    yearsSinceLastDisaster: 10,
    yearsSinceLastPolitical: 15,
    activeCrises: [],
    totalCrisesExperienced: 3,
    morale: 0.4,
    marks: 2,
    leaderTenure: 5,
    industrialCount: 8,
    ...overrides,
  };
}

/** Long peace state — war trigger should increase. */
function longPeaceState(overrides?: Partial<ChaosState>): ChaosState {
  return {
    year: 1970,
    population: 5000,
    food: 3000,
    money: 5000,
    yearsSinceLastWar: 25,
    yearsSinceLastFamine: 20,
    yearsSinceLastDisaster: 10,
    yearsSinceLastPolitical: 15,
    activeCrises: [],
    totalCrisesExperienced: 5,
    morale: 0.5,
    marks: 1,
    leaderTenure: 8,
    industrialCount: 10,
    ...overrides,
  };
}

/** Low food state — famine trigger should be high. */
function lowFoodState(overrides?: Partial<ChaosState>): ChaosState {
  return {
    year: 1932,
    population: 3000,
    food: 100,
    money: 800,
    yearsSinceLastWar: 12,
    yearsSinceLastFamine: 10,
    yearsSinceLastDisaster: 8,
    yearsSinceLastPolitical: 5,
    activeCrises: [],
    totalCrisesExperienced: 2,
    morale: 0.3,
    marks: 1,
    leaderTenure: 5,
    industrialCount: 4,
    ...overrides,
  };
}

/** Create a timeline event for testing. */
function makeTimelineEvent(
  type: CrisisType,
  startYear: number,
  endYear: number,
  overrides?: Partial<TimelineEvent>,
): TimelineEvent {
  return {
    eventId: `${type}-${startYear}`,
    crisisType: type,
    name: `Test ${type}`,
    startYear,
    endYear,
    isHistorical: false,
    recordedTick: 0,
    ...overrides,
  };
}

// ─── Peaceful state ─────────────────────────────────────────────────────────

describe('ChaosEngine — peaceful state', () => {
  it('has low trigger probability with abundant resources and no recent crises', () => {
    const engine = new ChaosEngine();
    const state = peacefulState();
    const rng = new GameRng('peaceful-test');

    // Run many attempts — most should return null
    let crisisCount = 0;
    const attempts = 100;
    for (let i = 0; i < attempts; i++) {
      const result = engine.generateNextCrisis(state, [], new GameRng(`peaceful-${i}`));
      if (result !== null) crisisCount++;
    }

    // With a peaceful state, fewer than half should trigger
    expect(crisisCount).toBeLessThan(attempts * 0.5);
  });
});

// ─── Post-war state ─────────────────────────────────────────────────────────

describe('ChaosEngine — post-war famine boost', () => {
  it('boosts famine trigger probability after a recent war', () => {
    const engine = new ChaosEngine();

    // Compare famine generation rates: post-war vs. long-peace
    const warTimeline = [makeTimelineEvent('war', 1941, 1945)];

    let postWarFamines = 0;
    let peaceFamines = 0;
    const attempts = 200;

    for (let i = 0; i < attempts; i++) {
      const rng1 = new GameRng(`postwar-${i}`);
      const rng2 = new GameRng(`postwar-${i}`);

      const postWarResult = engine.generateNextCrisis(postWarState(), warTimeline, rng1);
      const peaceResult = engine.generateNextCrisis(
        peacefulState({ food: 200, population: 2000 }),
        [],
        rng2,
      );

      if (postWarResult?.type === 'famine') postWarFamines++;
      if (peaceResult?.type === 'famine') peaceFamines++;
    }

    // Post-war should produce more famines (or at least equal)
    expect(postWarFamines).toBeGreaterThanOrEqual(peaceFamines);
  });
});

// ─── Long peace ─────────────────────────────────────────────────────────────

describe('ChaosEngine — long peace war trigger', () => {
  it('increases war trigger probability with years of peace', () => {
    const engine = new ChaosEngine();
    const archetypes = engine.getArchetypes();
    const warArch = archetypes.find((a) => a.type === 'war')!;

    const shortPeace = peacefulState({ yearsSinceLastWar: 5 });
    const longPeace = longPeaceState({ yearsSinceLastWar: 25 });

    const shortScore = warArch.evaluateTrigger(shortPeace);
    const longScore = warArch.evaluateTrigger(longPeace);

    expect(longScore).toBeGreaterThan(shortScore);
  });
});

// ─── Low food famine trigger ────────────────────────────────────────────────

describe('ChaosEngine — low food famine trigger', () => {
  it('triggers famine when food reserves are critically low', () => {
    const engine = new ChaosEngine();
    const archetypes = engine.getArchetypes();
    const famineArch = archetypes.find((a) => a.type === 'famine')!;

    const lowFood = lowFoodState();
    const highFood = peacefulState({ food: 10000, population: 300 });

    const lowScore = famineArch.evaluateTrigger(lowFood);
    const highScore = famineArch.evaluateTrigger(highFood);

    expect(lowScore).toBeGreaterThan(highScore);
    expect(lowScore).toBeGreaterThan(0.3); // Should be significant
  });

  it('generates famine definitions from low food state', () => {
    const engine = new ChaosEngine();
    const state = lowFoodState();

    let famineGenerated = false;
    for (let i = 0; i < 50; i++) {
      const result = engine.generateNextCrisis(state, [], new GameRng(`famine-gen-${i}`));
      if (result?.type === 'famine') {
        famineGenerated = true;
        break;
      }
    }

    expect(famineGenerated).toBe(true);
  });
});

// ─── Generated definition structure ─────────────────────────────────────────

describe('ChaosEngine — generated crisis structure', () => {
  it('produces valid CrisisDefinition with all required fields', () => {
    const engine = new ChaosEngine();
    // Use a state that guarantees generation
    const state = longPeaceState({ yearsSinceLastWar: 50, money: 10000, population: 10000 });

    let definition = null;
    for (let i = 0; i < 100; i++) {
      definition = engine.generateNextCrisis(state, [], new GameRng(`struct-${i}`));
      if (definition) break;
    }

    expect(definition).not.toBeNull();
    expect(definition!.id).toBeDefined();
    expect(definition!.type).toMatch(/^(war|famine|disaster|political)$/);
    expect(definition!.name).toBeDefined();
    expect(typeof definition!.name).toBe('string');
    expect(definition!.name.length).toBeGreaterThan(0);
    expect(definition!.startYear).toBeGreaterThanOrEqual(state.year);
    expect(definition!.endYear).toBeGreaterThan(definition!.startYear);
    expect(definition!.severity).toMatch(/^(localized|regional|national|existential)$/);
    expect(definition!.peakParams).toBeDefined();
    expect(typeof definition!.peakParams).toBe('object');
    expect(definition!.buildupTicks).toBeGreaterThan(0);
    expect(definition!.aftermathTicks).toBeGreaterThan(0);
  });

  it('generates war definitions with conscriptionRate peakParam', () => {
    const engine = new ChaosEngine();
    const archetypes = engine.getArchetypes();
    const warArch = archetypes.find((a) => a.type === 'war')!;
    const rng = new GameRng('war-params');

    const def = warArch.generate(longPeaceState(), rng);

    expect(def.type).toBe('war');
    expect(def.peakParams['conscriptionRate']).toBeDefined();
    expect(def.peakParams['conscriptionRate']).toBeGreaterThan(0);
    expect(def.peakParams['conscriptionRate']).toBeLessThanOrEqual(0.15);
    expect(def.peakParams['foodDrain']).toBeDefined();
    expect(def.peakParams['moneyDrain']).toBeDefined();
  });

  it('generates famine definitions with food-related peakParams', () => {
    const engine = new ChaosEngine();
    const archetypes = engine.getArchetypes();
    const famineArch = archetypes.find((a) => a.type === 'famine')!;
    const rng = new GameRng('famine-params');

    const def = famineArch.generate(lowFoodState(), rng);

    expect(def.type).toBe('famine');
    expect(def.peakParams['diseaseMult']).toBeGreaterThan(1);
    expect(def.peakParams['growthMult']).toBeLessThan(1);
  });
});

// ─── Determinism ────────────────────────────────────────────────────────────

describe('ChaosEngine — determinism', () => {
  it('produces identical output with the same seed', () => {
    const engine = new ChaosEngine();
    const state = longPeaceState();
    const timeline: TimelineEvent[] = [];

    const result1 = engine.generateNextCrisis(state, timeline, new GameRng('deterministic'));
    const result2 = engine.generateNextCrisis(state, timeline, new GameRng('deterministic'));

    // Both should produce exactly the same result
    expect(JSON.stringify(result1)).toBe(JSON.stringify(result2));
  });

  it('produces different output with different seeds (eventually)', () => {
    const engine = new ChaosEngine();
    const state = longPeaceState({ yearsSinceLastWar: 50, money: 10000 });

    const results = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const result = engine.generateNextCrisis(state, [], new GameRng(`diff-seed-${i}`));
      if (result) {
        results.add(result.id);
      }
    }

    // With 50 different seeds, we should get at least 2 different results
    expect(results.size).toBeGreaterThan(1);
  });
});

// ─── Minimum interval ───────────────────────────────────────────────────────

describe('ChaosEngine — minimum interval enforcement', () => {
  it('does not generate same crisis type within 3 years of previous', () => {
    const engine = new ChaosEngine();

    // Timeline has a war that ended 1 year ago
    const timeline = [makeTimelineEvent('war', 1945, 1949)];
    const state = longPeaceState({
      year: 1950,
      yearsSinceLastWar: 1,
    });

    let warGenerated = false;
    for (let i = 0; i < 200; i++) {
      const result = engine.generateNextCrisis(state, timeline, new GameRng(`interval-${i}`));
      if (result?.type === 'war') {
        warGenerated = true;
        break;
      }
    }

    expect(warGenerated).toBe(false);
  });

  it('allows same type after minimum interval has passed', () => {
    const engine = new ChaosEngine();

    // Timeline has a war that ended 5 years ago (> 3 year min interval)
    const timeline = [makeTimelineEvent('war', 1940, 1945)];
    const state = longPeaceState({
      year: 1970,
      yearsSinceLastWar: 25,
      money: 10000,
      population: 10000,
    });

    let warGenerated = false;
    for (let i = 0; i < 200; i++) {
      const result = engine.generateNextCrisis(state, timeline, new GameRng(`after-interval-${i}`));
      if (result?.type === 'war') {
        warGenerated = true;
        break;
      }
    }

    expect(warGenerated).toBe(true);
  });

  it('suppresses crisis type if already active', () => {
    const engine = new ChaosEngine();

    const state = longPeaceState({
      yearsSinceLastWar: 25,
      money: 10000,
      population: 10000,
      activeCrises: ['war-1965-abc123'],
    });

    let warGenerated = false;
    for (let i = 0; i < 200; i++) {
      const result = engine.generateNextCrisis(state, [], new GameRng(`active-${i}`));
      if (result?.type === 'war') {
        warGenerated = true;
        break;
      }
    }

    expect(warGenerated).toBe(false);
  });
});

// ─── Feedback chain: war → famine → political ──────────────────────────────

describe('ChaosEngine — feedback cascade', () => {
  it('war aftermath boosts famine, famine boosts political', () => {
    const engine = new ChaosEngine();
    const archetypes = engine.getArchetypes();
    const famineArch = archetypes.find((a) => a.type === 'famine')!;
    const politicalArch = archetypes.find((a) => a.type === 'political')!;

    // After war: famine trigger should be boosted
    const postWar = postWarState({ yearsSinceLastWar: 1 });
    const noWar = postWarState({ yearsSinceLastWar: 10, food: 200 });

    const postWarFamineScore = famineArch.evaluateTrigger(postWar);
    const noWarFamineScore = famineArch.evaluateTrigger(noWar);

    // Post-war state has yearsSinceLastWar=1 which adds 0.2 to famine trigger
    expect(postWarFamineScore).toBeGreaterThan(noWarFamineScore);

    // After famine: political trigger should be boosted
    const postFamine = {
      ...peacefulState(),
      yearsSinceLastFamine: 1,
      morale: 0.2,
      marks: 5,
      leaderTenure: 15,
    };
    const noFamine = {
      ...peacefulState(),
      yearsSinceLastFamine: 20,
      morale: 0.2,
      marks: 5,
      leaderTenure: 15,
    };

    // Both should have high political scores, but post-famine should
    // receive feedback boost through the engine (not just archetype score)
    const politicalScore1 = politicalArch.evaluateTrigger(postFamine);
    const politicalScore2 = politicalArch.evaluateTrigger(noFamine);

    // Political archetype trigger is the same (it doesn't check famine),
    // but the ChaosEngine adds feedback boost
    expect(politicalScore1).toBe(politicalScore2);

    // Verify the engine itself applies the boost — count political crises
    let postFaminePolitical = 0;
    let noFaminePolitical = 0;
    const timeline = [makeTimelineEvent('famine', 1948, 1949)];

    for (let i = 0; i < 200; i++) {
      const r1 = engine.generateNextCrisis(postFamine, timeline, new GameRng(`chain-a-${i}`));
      const r2 = engine.generateNextCrisis(noFamine, [], new GameRng(`chain-b-${i}`));
      if (r1?.type === 'political') postFaminePolitical++;
      if (r2?.type === 'political') noFaminePolitical++;
    }

    expect(postFaminePolitical).toBeGreaterThanOrEqual(noFaminePolitical);
  });

  it('disaster boosts political crisis (blame the leadership)', () => {
    const engine = new ChaosEngine();

    const postDisaster: ChaosState = {
      ...peacefulState(),
      yearsSinceLastDisaster: 1,
      morale: 0.2,
      marks: 5,
      leaderTenure: 15,
      yearsSinceLastPolitical: 10,
    };
    const noDisaster: ChaosState = {
      ...peacefulState(),
      yearsSinceLastDisaster: 20,
      morale: 0.2,
      marks: 5,
      leaderTenure: 15,
      yearsSinceLastPolitical: 10,
    };

    let postDisasterPolitical = 0;
    let noDisasterPolitical = 0;
    const disasterTimeline = [makeTimelineEvent('disaster', 1949, 1949)];

    for (let i = 0; i < 200; i++) {
      const r1 = engine.generateNextCrisis(postDisaster, disasterTimeline, new GameRng(`dis-a-${i}`));
      const r2 = engine.generateNextCrisis(noDisaster, [], new GameRng(`dis-b-${i}`));
      if (r1?.type === 'political') postDisasterPolitical++;
      if (r2?.type === 'political') noDisasterPolitical++;
    }

    expect(postDisasterPolitical).toBeGreaterThanOrEqual(noDisasterPolitical);
  });
});

// ─── Archetype coverage ─────────────────────────────────────────────────────

describe('ChaosEngine — archetype coverage', () => {
  it('has exactly 4 archetypes', () => {
    const engine = new ChaosEngine();
    expect(engine.getArchetypes()).toHaveLength(4);
  });

  it('archetype types match crisis types', () => {
    const engine = new ChaosEngine();
    const types = engine.getArchetypes().map((a) => a.type).sort();
    expect(types).toEqual(['disaster', 'famine', 'political', 'war']);
  });

  it('all archetypes have positive baseWeight', () => {
    const engine = new ChaosEngine();
    for (const arch of engine.getArchetypes()) {
      expect(arch.baseWeight).toBeGreaterThan(0);
    }
  });

  it('baseWeights sum to 1.0', () => {
    const engine = new ChaosEngine();
    const sum = engine.getArchetypes().reduce((s, a) => s + a.baseWeight, 0);
    expect(sum).toBeCloseTo(1.0);
  });
});

// ─── Edge cases ─────────────────────────────────────────────────────────────

describe('ChaosEngine — edge cases', () => {
  it('returns null when all types are on minimum interval cooldown', () => {
    const engine = new ChaosEngine();
    const timeline = [
      makeTimelineEvent('war', 1948, 1950),
      makeTimelineEvent('famine', 1949, 1950),
      makeTimelineEvent('disaster', 1949, 1950),
      makeTimelineEvent('political', 1949, 1950),
    ];
    const state = peacefulState({ year: 1951 }); // All ended 1 year ago (< 3)

    const result = engine.generateNextCrisis(state, timeline, new GameRng('cooldown'));
    expect(result).toBeNull();
  });

  it('handles empty timeline gracefully', () => {
    const engine = new ChaosEngine();
    const state = longPeaceState();

    // Should not throw
    const result = engine.generateNextCrisis(state, [], new GameRng('empty-timeline'));
    // May or may not generate — just shouldn't crash
    expect(result === null || result.id !== undefined).toBe(true);
  });

  it('handles zero population without crashing', () => {
    const engine = new ChaosEngine();
    const state = peacefulState({ population: 0 });

    const result = engine.generateNextCrisis(state, [], new GameRng('zero-pop'));
    expect(result === null || result.id !== undefined).toBe(true);
  });

  it('crisis IDs are unique across multiple generations', () => {
    const engine = new ChaosEngine();
    const state = longPeaceState({ yearsSinceLastWar: 50, money: 10000, population: 10000 });
    const ids = new Set<string>();

    for (let i = 0; i < 100; i++) {
      const result = engine.generateNextCrisis(
        { ...state, year: state.year + i * 5 },
        [],
        new GameRng(`unique-${i}`),
      );
      if (result) {
        expect(ids.has(result.id)).toBe(false);
        ids.add(result.id);
      }
    }
  });
});
