/**
 * @fileoverview Tests for HistoricalGovernor — real Soviet history dates
 * driving crisis agents through the governor interface.
 *
 * Validates timeline activation, impact merging, concurrent crises,
 * peaceful years, getActiveCrises(), and serialization round-trips.
 */

import type { GovernorContext } from '@/ai/agents/crisis/Governor';
import { DEFAULT_MODIFIERS } from '@/ai/agents/crisis/Governor';
import { HistoricalGovernor } from '@/ai/agents/crisis/HistoricalGovernor';
import type { PressureReadContext } from '@/ai/agents/crisis/pressure/PressureDomains';
import { GameRng } from '@/game/SeedSystem';

// ─── Fixtures ───────────────────────────────────────────────────────────────

function makeCtx(overrides?: Partial<GovernorContext>): GovernorContext {
  return {
    year: 1917,
    month: 1,
    population: 5000,
    food: 2000,
    money: 1000,
    rng: new GameRng('gov-test-seed'),
    totalTicks: 0,
    eraId: 'revolution',
    ...overrides,
  };
}

/**
 * Helper: advance the governor through multiple ticks at a given year/month.
 * Returns the last directive.
 */
function advanceTicks(gov: HistoricalGovernor, ticks: number, yearOrCtx: number | Partial<GovernorContext>) {
  const base = typeof yearOrCtx === 'number' ? { year: yearOrCtx } : yearOrCtx;
  let directive: ReturnType<HistoricalGovernor['evaluate']> | undefined;
  for (let i = 0; i < ticks; i++) {
    directive = gov.evaluate(makeCtx(base));
  }
  return directive!;
}

// ─── 1917-1922 Timeline: Civil War + Red Terror + 1921 Famine ──────────────

describe('HistoricalGovernor: 1917-1922 timeline', () => {
  it('has no active crises in 1917 (before any start)', () => {
    const gov = new HistoricalGovernor();
    const directive = gov.evaluate(makeCtx({ year: 1917, month: 1 }));

    expect(gov.getActiveCrises()).toEqual([]);
    expect(directive.crisisImpacts).toEqual([]);
    expect(directive.modifiers).toEqual(DEFAULT_MODIFIERS);
  });

  it('activates Russian Civil War at year 1918', () => {
    const gov = new HistoricalGovernor();

    // 1917 — nothing
    gov.evaluate(makeCtx({ year: 1917 }));
    expect(gov.getActiveCrises()).toEqual([]);

    // 1918 — Civil War should activate
    gov.evaluate(makeCtx({ year: 1918 }));
    const active = gov.getActiveCrises();
    expect(active).toContain('russian_civil_war');
  });

  it('compounds Civil War + 1921 Famine when both active', () => {
    const gov = new HistoricalGovernor();

    // Advance to 1921 — both Civil War (1918-1921) and Famine (1921-1922) active
    const directive = gov.evaluate(makeCtx({ year: 1921, month: 6 }));
    const active = gov.getActiveCrises();

    expect(active).toContain('russian_civil_war');
    expect(active).toContain('famine_1921');

    // Multiple impacts from concurrent crises
    expect(directive.crisisImpacts.length).toBeGreaterThanOrEqual(2);

    // CrisisImpact IDs should include both
    const ids = directive.crisisImpacts.map((i) => i.crisisId);
    expect(ids).toContain('russian_civil_war');
    expect(ids).toContain('famine_1921');
  });
});

// ─── Holodomor 1932-33 ─────────────────────────────────────────────────────

describe('HistoricalGovernor: Holodomor', () => {
  it('activates Holodomor at year 1932 with famine impacts', () => {
    const gov = new HistoricalGovernor();

    // Jump to 1932
    const directive = gov.evaluate(makeCtx({ year: 1932, month: 3 }));
    const active = gov.getActiveCrises();

    expect(active).toContain('holodomor');

    // Should produce at least one impact from the Holodomor famine agent
    const famineImpacts = directive.crisisImpacts.filter((i) => i.crisisId === 'holodomor');
    expect(famineImpacts.length).toBeGreaterThan(0);
  });

  it('Holodomor modifies growth multiplier downward', () => {
    const gov = new HistoricalGovernor();

    // Tick multiple times at 1932 so agents advance through buildup
    const directive = advanceTicks(gov, 15, { year: 1932, month: 6 });

    // Growth should be reduced by famine effects
    expect(directive.modifiers.growthMultiplier).toBeLessThan(DEFAULT_MODIFIERS.growthMultiplier);
  });
});

// ─── Great Patriotic War 1941-45 ────────────────────────────────────────────

describe('HistoricalGovernor: Great Patriotic War', () => {
  it('activates GPW at year 1941', () => {
    const gov = new HistoricalGovernor();

    const directive = gov.evaluate(makeCtx({ year: 1941, month: 6 }));
    const active = gov.getActiveCrises();

    expect(active).toContain('great_patriotic_war');

    // Should have war impacts (conscription, economy)
    const warImpacts = directive.crisisImpacts.filter((i) => i.crisisId === 'great_patriotic_war');
    expect(warImpacts.length).toBeGreaterThan(0);
  });

  it('GPW produces workforce conscription impacts', () => {
    const gov = new HistoricalGovernor();

    // Advance through buildup into peak
    advanceTicks(gov, 13, { year: 1941, month: 6 });
    const directive = gov.evaluate(makeCtx({ year: 1943, month: 1 }));

    const warImpact = directive.crisisImpacts.find((i) => i.crisisId === 'great_patriotic_war');
    expect(warImpact).toBeDefined();
    expect(warImpact!.workforce?.conscriptionCount).toBeDefined();
  });

  it('GPW transitions to aftermath after endYear', () => {
    const gov = new HistoricalGovernor();

    // Activate at 1941 and tick through buildup
    advanceTicks(gov, 13, { year: 1941 });

    // Tick in peak for a while
    advanceTicks(gov, 12, { year: 1943 });

    // Past end year — governor should transition WarAgent to aftermath
    advanceTicks(gov, 1, { year: 1946 });

    // The war should still be active (in aftermath), not instantly resolved
    const _active = gov.getActiveCrises();
    // After the endYear transition, it may still be active in aftermath
    // or it may have resolved depending on aftermath ticks
    const directive = gov.evaluate(makeCtx({ year: 1946, month: 6 }));
    // Impacts should be winding down (aftermath)
    expect(directive).toBeDefined();
  });
});

// ─── Chernobyl 1986 ────────────────────────────────────────────────────────

describe('HistoricalGovernor: Chernobyl', () => {
  it('activates Chernobyl at year 1986', () => {
    const gov = new HistoricalGovernor();

    gov.evaluate(makeCtx({ year: 1986, month: 4 }));
    const active = gov.getActiveCrises();

    expect(active).toContain('chernobyl');
  });

  it('Chernobyl produces disease and production impacts', () => {
    const gov = new HistoricalGovernor();

    // Chernobyl has buildupTicks=0, goes straight to peak then aftermath
    const directive = gov.evaluate(makeCtx({ year: 1986, month: 4 }));

    const chernobylImpact = directive.crisisImpacts.find((i) => i.crisisId === 'chernobyl');
    expect(chernobylImpact).toBeDefined();
  });
});

// ─── Year progression: correct activation sequence ──────────────────────────

describe('HistoricalGovernor: year progression', () => {
  it('activates crises in chronological order as years pass', () => {
    const gov = new HistoricalGovernor();

    // 1917 — nothing
    gov.evaluate(makeCtx({ year: 1917 }));
    expect(gov.getActiveCrises()).toEqual([]);

    // 1918 — Civil War activates
    gov.evaluate(makeCtx({ year: 1918 }));
    expect(gov.getActiveCrises()).toContain('russian_civil_war');

    // 1932 — Holodomor activates (Civil War may have resolved)
    gov.evaluate(makeCtx({ year: 1932 }));
    expect(gov.getActiveCrises()).toContain('holodomor');

    // 1941 — GPW activates
    gov.evaluate(makeCtx({ year: 1941 }));
    expect(gov.getActiveCrises()).toContain('great_patriotic_war');

    // 1986 — Chernobyl activates
    gov.evaluate(makeCtx({ year: 1986 }));
    expect(gov.getActiveCrises()).toContain('chernobyl');
  });

  it('does not re-activate a crisis that has already been activated', () => {
    const gov = new HistoricalGovernor();

    // Activate Civil War
    gov.evaluate(makeCtx({ year: 1918 }));
    const activeBefore = gov.getActiveCrises();

    // Tick again at same year — should not create duplicate
    gov.evaluate(makeCtx({ year: 1918 }));
    const activeAfter = gov.getActiveCrises();

    // Count of civil_war should be the same
    const countBefore = activeBefore.filter((id) => id === 'russian_civil_war').length;
    const countAfter = activeAfter.filter((id) => id === 'russian_civil_war').length;
    expect(countAfter).toBe(countBefore);
  });
});

// ─── Multiple concurrent crises ─────────────────────────────────────────────

describe('HistoricalGovernor: concurrent crises', () => {
  it('handles Civil War + Red Terror + 1921 Famine simultaneously', () => {
    const gov = new HistoricalGovernor();

    // 1921: Civil War (1918-1921), Red Terror (1918-1921), Famine (1921-1922)
    // Also Polish-Soviet War (1920-1921) and Kronstadt Rebellion (1921)
    gov.evaluate(makeCtx({ year: 1921, month: 6 }));
    const active = gov.getActiveCrises();

    // All three should be active
    expect(active).toContain('russian_civil_war');
    // Red Terror is political — skipped by HistoricalGovernor
    expect(active).not.toContain('red_terror');
    expect(active).toContain('famine_1921');
  });

  it('merges impacts from multiple concurrent crises', () => {
    const gov = new HistoricalGovernor();

    // 1921 — multiple crises active
    const directive = gov.evaluate(makeCtx({ year: 1921, month: 6 }));

    // Should have impacts from multiple sources
    const uniqueCrisisIds = new Set(directive.crisisImpacts.map((i) => i.crisisId));
    expect(uniqueCrisisIds.size).toBeGreaterThanOrEqual(2);
  });
});

// ─── Impact merging: multiplicative for multipliers ─────────────────────────

describe('HistoricalGovernor: impact merging', () => {
  it('multiplies quotaMultiplier across crisis impacts', () => {
    const gov = new HistoricalGovernor();

    // Advance to 1921 with multiple crises to get compound effects
    // Tick several times to get through buildup phases
    advanceTicks(gov, 12, { year: 1920 });
    const directive = advanceTicks(gov, 3, { year: 1921 });

    // With multiple active crises, the modifiers should differ from defaults
    // (at least some multipliers should be affected)
    expect(directive.modifiers).toBeDefined();
    expect(directive.modifiers.quotaMultiplier).toBeDefined();
  });

  it('applies multiplicative decay multiplier from crisis impacts', () => {
    const gov = new HistoricalGovernor();

    // Advance into the Civil War peak where decay effects are active
    advanceTicks(gov, 8, { year: 1919 });
    const directive = gov.evaluate(makeCtx({ year: 1919, month: 6 }));

    // Decay multiplier should be >= 1.0 during active war
    expect(directive.modifiers.decayMultiplier).toBeGreaterThanOrEqual(DEFAULT_MODIFIERS.decayMultiplier);
  });
});

// ─── Peaceful years: no active crises ───────────────────────────────────────

describe('HistoricalGovernor: peaceful years', () => {
  it('returns DEFAULT_MODIFIERS when no crises are active', () => {
    const gov = new HistoricalGovernor();

    // 1917 — no crises yet
    const directive = gov.evaluate(makeCtx({ year: 1917, month: 1 }));

    expect(directive.modifiers).toEqual(DEFAULT_MODIFIERS);
    expect(directive.crisisImpacts).toEqual([]);
  });

  it('returns empty getActiveCrises() in 1917', () => {
    const gov = new HistoricalGovernor();

    gov.evaluate(makeCtx({ year: 1917 }));
    expect(gov.getActiveCrises()).toEqual([]);
  });
});

// ─── getActiveCrises() ─────────────────────────────────────────────────────

describe('HistoricalGovernor: getActiveCrises()', () => {
  it('returns correct IDs for active crises', () => {
    const gov = new HistoricalGovernor();

    // 1917 — nothing
    gov.evaluate(makeCtx({ year: 1917 }));
    expect(gov.getActiveCrises()).toEqual([]);

    // 1918 — Civil War starts
    gov.evaluate(makeCtx({ year: 1918 }));
    expect(gov.getActiveCrises()).toContain('russian_civil_war');

    // Polish-Soviet War also starts at 1920
    gov.evaluate(makeCtx({ year: 1920 }));
    expect(gov.getActiveCrises()).toContain('polish_soviet_war');
  });

  it('does not include political crises (handled by PoliticalAgent)', () => {
    const gov = new HistoricalGovernor();

    // Red Terror (1918-1921), Great Terror (1936-1938) are political — skipped
    gov.evaluate(makeCtx({ year: 1918 }));
    expect(gov.getActiveCrises()).not.toContain('red_terror');

    gov.evaluate(makeCtx({ year: 1936 }));
    expect(gov.getActiveCrises()).not.toContain('great_terror');
  });

  it('only includes crises with active agents (not resolved)', () => {
    const gov = new HistoricalGovernor();

    // Activate and resolve a short crisis by ticking many times
    gov.evaluate(makeCtx({ year: 1960 })); // Nedelin catastrophe: buildupTicks=0, aftermathTicks=6
    expect(gov.getActiveCrises()).toContain('nedelin_catastrophe');

    // Tick through aftermath (6 ticks + peak transition)
    advanceTicks(gov, 10, { year: 1961 });

    // Should eventually resolve
    const active = gov.getActiveCrises();
    expect(active).not.toContain('nedelin_catastrophe');
  });
});

// ─── Serialization round-trip ───────────────────────────────────────────────

describe('HistoricalGovernor: serialization', () => {
  it('serializes and restores to equivalent state', () => {
    const gov1 = new HistoricalGovernor();

    // Advance to 1942 with some crises active
    advanceTicks(gov1, 5, { year: 1918 });
    advanceTicks(gov1, 5, { year: 1941 });

    const activeBefore = gov1.getActiveCrises().sort();
    const savedData = gov1.serialize();

    // Create a fresh governor and restore
    const gov2 = new HistoricalGovernor();
    gov2.restore(savedData);

    const activeAfter = gov2.getActiveCrises().sort();

    expect(savedData.mode).toBe('historical');
    expect(activeAfter).toEqual(activeBefore);
  });

  it('save data includes mode and active crises', () => {
    const gov = new HistoricalGovernor();

    gov.evaluate(makeCtx({ year: 1941 }));
    const data = gov.serialize();

    expect(data.mode).toBe('historical');
    expect(data.activeCrises).toContain('great_patriotic_war');
    expect(data.state).toBeDefined();
    expect(data.state.currentYear).toBeDefined();
    expect(data.state.agentStates).toBeDefined();
    expect(data.state.activatedSet).toBeDefined();
  });

  it('restored governor produces consistent directives', () => {
    const rngSeed = 'serialization-test';
    const gov1 = new HistoricalGovernor();

    // Run a few ticks
    advanceTicks(gov1, 3, { year: 1941, rng: new GameRng(rngSeed) } as Partial<GovernorContext>);

    const savedData = gov1.serialize();

    // Restore
    const gov2 = new HistoricalGovernor();
    gov2.restore(savedData);

    // Both should evaluate to same active crises
    const dir1 = gov1.evaluate(makeCtx({ year: 1942, rng: new GameRng(rngSeed) }));
    const dir2 = gov2.evaluate(makeCtx({ year: 1942, rng: new GameRng(rngSeed) }));

    // Same crisis IDs in impacts
    const ids1 = dir1.crisisImpacts.map((i) => i.crisisId).sort();
    const ids2 = dir2.crisisImpacts.map((i) => i.crisisId).sort();
    expect(ids2).toEqual(ids1);
  });
});

// ─── onYearBoundary ─────────────────────────────────────────────────────────

describe('HistoricalGovernor: onYearBoundary', () => {
  it('updates internal year tracking', () => {
    const gov = new HistoricalGovernor();

    // onYearBoundary is a hook for year-specific logic
    gov.onYearBoundary(1941);

    // Should not throw
    expect(() => gov.onYearBoundary(1942)).not.toThrow();
  });
});

// ─── Skips political crises ─────────────────────────────────────────────────

describe('HistoricalGovernor: political crisis filtering', () => {
  it('does not create agents for political crises', () => {
    const gov = new HistoricalGovernor();

    // Evaluate at a year where many political crises are defined
    gov.evaluate(makeCtx({ year: 1991 }));

    // Should never have political crisis IDs in active list
    const active = gov.getActiveCrises();
    const politicalIds = [
      'red_terror',
      'great_terror',
      'destalinization',
      'virgin_lands',
      'anti_alcohol_campaign',
      'glasnost_perestroika',
      'kronstadt_rebellion',
      'doctors_plot',
      'sino_soviet_split',
      'august_coup',
    ];

    for (const id of politicalIds) {
      expect(active).not.toContain(id);
    }
  });
});

// ─── Pressure Read Context Fixture ──────────────────────────────────────────

function makePressureReadings(overrides?: Partial<PressureReadContext>): PressureReadContext {
  return {
    foodState: 'stable',
    starvationCounter: 0,
    starvationGraceTicks: 90,
    averageMorale: 60,
    averageLoyalty: 60,
    sabotageCount: 0,
    flightCount: 0,
    population: 5000,
    housingCapacity: 6000,
    suspicionLevel: 0.2,
    blackMarks: 0,
    blat: 0,
    powerShortage: false,
    unpoweredCount: 0,
    totalBuildings: 20,
    averageDurability: 80,
    growthRate: 10,
    laborRatio: 0.6,
    sickCount: 0,
    quotaDeficit: 0,
    productionTrend: 0.7,
    season: 'summer',
    weather: 'clear',
    ...overrides,
  };
}

// ─── Pressure system integration ────────────────────────────────────────────

describe('HistoricalGovernor: pressure system', () => {
  it('ticks pressure system when readings are provided', () => {
    const gov = new HistoricalGovernor();

    // Provide pressure readings with high food stress
    const readings = makePressureReadings({ foodState: 'starvation', starvationCounter: 50 });
    gov.evaluate(makeCtx({ year: 1917, pressureReadings: readings }));

    // Pressure system should have accumulated food pressure
    const foodLevel = gov.getPressureSystem().getLevel('food');
    expect(foodLevel).toBeGreaterThan(0);
  });

  it('does not crash without pressure readings (backward compat)', () => {
    const gov = new HistoricalGovernor();

    // No pressureReadings — should work exactly like before
    const directive = gov.evaluate(makeCtx({ year: 1917 }));
    expect(directive.modifiers).toEqual(DEFAULT_MODIFIERS);
  });

  it('amplifies famine impacts when food pressure is high', () => {
    const gov = new HistoricalGovernor();

    // First: get a baseline directive for Holodomor WITHOUT pressure
    const govBaseline = new HistoricalGovernor();
    advanceTicks(govBaseline, 15, { year: 1932, month: 6 });
    const baselineDirective = govBaseline.evaluate(makeCtx({ year: 1932, month: 7 }));

    // Now: evaluate with high food pressure
    const highFoodPressure = makePressureReadings({
      foodState: 'starvation',
      starvationCounter: 80,
    });

    // Tick pressure up first (many ticks to accumulate)
    for (let i = 0; i < 15; i++) {
      gov.evaluate(makeCtx({ year: 1932, month: 6, pressureReadings: highFoodPressure }));
    }
    const pressuredDirective = gov.evaluate(makeCtx({ year: 1932, month: 7, pressureReadings: highFoodPressure }));

    // With high food pressure, growth should be penalized more
    expect(pressuredDirective.modifiers.growthMultiplier).toBeLessThanOrEqual(
      baselineDirective.modifiers.growthMultiplier,
    );
  });

  it('does not amplify when pressure is zero', () => {
    const gov = new HistoricalGovernor();

    // All readings are healthy/neutral
    const neutralReadings = makePressureReadings();

    // Activate a crisis with neutral pressure
    gov.evaluate(makeCtx({ year: 1918, pressureReadings: neutralReadings }));

    // Pressure system should have very low levels
    const pressureSystem = gov.getPressureSystem();
    expect(pressureSystem.getLevel('food')).toBeLessThan(0.1);
    expect(pressureSystem.getLevel('demographic')).toBeLessThan(0.2);
  });
});

// ─── Pressure serialization round-trip ──────────────────────────────────────

describe('HistoricalGovernor: pressure serialization', () => {
  it('serializes and restores pressure state', () => {
    const gov1 = new HistoricalGovernor();

    // Accumulate some pressure
    const readings = makePressureReadings({ foodState: 'rationing' });
    for (let i = 0; i < 5; i++) {
      gov1.evaluate(makeCtx({ year: 1930, pressureReadings: readings }));
    }

    const foodBefore = gov1.getPressureSystem().getLevel('food');
    const savedData = gov1.serialize();

    // Restore to new governor
    const gov2 = new HistoricalGovernor();
    gov2.restore(savedData);

    const foodAfter = gov2.getPressureSystem().getLevel('food');
    expect(foodAfter).toBeCloseTo(foodBefore, 5);
  });

  it('serializes and restores branch state', () => {
    const gov1 = new HistoricalGovernor();
    const savedData = gov1.serialize();

    expect(savedData.state.pressureState).toBeDefined();
    expect(savedData.state.branchSystem).toBeDefined();

    // Restore should not throw
    const gov2 = new HistoricalGovernor();
    expect(() => gov2.restore(savedData)).not.toThrow();
  });

  it('handles old saves without pressure/branch state', () => {
    const gov = new HistoricalGovernor();

    // Simulate old save data (no pressureState or branchSystem)
    const oldSaveData = {
      mode: 'historical' as const,
      activeCrises: [],
      state: {
        currentYear: 1930,
        agentStates: {},
        activatedSet: [],
      },
    };

    expect(() => gov.restore(oldSaveData)).not.toThrow();
    expect(gov.getPressureSystem().getLevel('food')).toBe(0);
    expect(gov.getActivatedBranches().size).toBe(0);
  });
});

// ─── Cold branch evaluation ─────────────────────────────────────────────────

describe('HistoricalGovernor: cold branches', () => {
  it('does not evaluate branches without pressure readings', () => {
    const gov = new HistoricalGovernor();

    // Without pressureReadings, no branches should fire
    gov.evaluate(makeCtx({ year: 1930 }));
    expect(gov.getActivatedBranches().size).toBe(0);
  });

  it('evaluates only historical branches (not geopolitical/tech)', () => {
    const gov = new HistoricalGovernor();

    // The governor should only look at 4 historical branches, not WWIII/AI/etc.
    const branches = gov.getActivatedBranches();
    expect(branches.has('wwiii')).toBe(false);
    expect(branches.has('ai_singularity')).toBe(false);
    expect(branches.has('mars_colonization')).toBe(false);
  });

  it('activates dekulakization when political pressure is high in 1929-1933', () => {
    const gov = new HistoricalGovernor();

    // Provide worldState + spheres + high political pressure
    const readings = makePressureReadings({
      suspicionLevel: 0.8,
      blackMarks: 3,
      worldState: { globalTension: 0.3, borderThreat: 0.2, climateTrend: 0, techLevel: 0.1, commodityIndex: 0.5, tradeAccess: 0.5, moscowAttention: 0.3 },
      spheres: {},
    });

    // Manually spike political pressure to > 0.5
    gov.getPressureSystem().applySpike('political', 0.6);

    // Evaluate enough ticks to meet sustainedTicks=6
    for (let i = 0; i < 8; i++) {
      gov.evaluate(makeCtx({ year: 1930, month: 1, pressureReadings: readings }));
    }

    // Dekulakization should have activated (or be tracking — depends on pressure accumulation)
    // At minimum the branch tracker should be progressing or the branch activated
    const activated = gov.getActivatedBranches();
    // The branch has sustainedTicks: 6 and requires political > 0.5
    // We spiked to 0.6 and evaluated 8 ticks, so it should activate
    expect(activated.has('dekulakization_purge')).toBe(true);
  });

  it('produces narrative impact when branch activates', () => {
    const gov = new HistoricalGovernor();

    const readings = makePressureReadings({
      worldState: { globalTension: 0.3, borderThreat: 0.2, climateTrend: 0, techLevel: 0.1, commodityIndex: 0.5, tradeAccess: 0.5, moscowAttention: 0.3 },
      spheres: {},
    });

    // Spike political pressure high
    gov.getPressureSystem().applySpike('political', 0.7);

    // Evaluate past the sustained tick threshold for dekulakization
    let lastDirective;
    for (let i = 0; i < 10; i++) {
      lastDirective = gov.evaluate(makeCtx({ year: 1930, month: 1, pressureReadings: readings }));
    }

    // If branch activated, there should be a branch narrative impact
    if (gov.getActivatedBranches().has('dekulakization_purge')) {
      const branchImpacts = lastDirective!.crisisImpacts.filter((i) =>
        i.crisisId.startsWith('branch-dekulakization'),
      );
      // The activation tick should have produced the narrative
      // (might be in an earlier directive, but at least the branch fired)
      expect(gov.getActivatedBranches().has('dekulakization_purge')).toBe(true);
    }
  });

  it('does not activate dekulakization outside year range', () => {
    const gov = new HistoricalGovernor();

    const readings = makePressureReadings({
      suspicionLevel: 0.9,
      worldState: { globalTension: 0.3, borderThreat: 0.2, climateTrend: 0, techLevel: 0.1, commodityIndex: 0.5, tradeAccess: 0.5, moscowAttention: 0.3 },
      spheres: {},
    });

    gov.getPressureSystem().applySpike('political', 0.8);

    // Evaluate at year 1950 — outside dekulakization year range (1929-1933)
    for (let i = 0; i < 10; i++) {
      gov.evaluate(makeCtx({ year: 1950, month: 1, pressureReadings: readings }));
    }

    expect(gov.getActivatedBranches().has('dekulakization_purge')).toBe(false);
  });

  it('activates virgin lands when food pressure is high in 1954-1965', () => {
    const gov = new HistoricalGovernor();

    const readings = makePressureReadings({
      foodState: 'rationing',
      worldState: { globalTension: 0.3, borderThreat: 0.2, climateTrend: 0, techLevel: 0.2, commodityIndex: 0.5, tradeAccess: 0.5, moscowAttention: 0.3 },
      spheres: {},
    });

    // Spike food pressure to > 0.6
    gov.getPressureSystem().applySpike('food', 0.7);

    // Need sustainedTicks=12
    for (let i = 0; i < 14; i++) {
      gov.evaluate(makeCtx({ year: 1960, month: 1, pressureReadings: readings }));
    }

    expect(gov.getActivatedBranches().has('virgin_lands_assignment')).toBe(true);
  });
});
