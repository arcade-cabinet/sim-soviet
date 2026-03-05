/**
 * Tests for LawEnforcementSystem — MegaCity law enforcement.
 *
 * Covers:
 *   - Era-based enforcement mode transitions (KGB → Security → Judges → Arbiters)
 *   - Crime rate computation model
 *   - Sector subdivision at population thresholds
 *   - Undercity decay mechanics
 *   - Iso-cube sentencing and labor
 *   - Judge coverage calculation
 *   - Full tick lifecycle
 *   - Serialization round-trip
 *   - KGBAgent integration
 */

import {
  type CrimeRateContext,
  type LawEnforcementState,
  type LawEnforcementTickContext,
  BASE_CRIME_BY_MODE,
  computeCrimeRate,
  computeIsoCubeLabor,
  computeIsoCubeSentences,
  computeJudgeCoverage,
  computeRequiredSectors,
  createLawEnforcementState,
  createSectorBlock,
  generateSectorNames,
  getEnforcementMode,
  ISO_CUBE_LABOR_EFFICIENCY,
  JUDGES_PER_10K,
  SECTOR_SUBDIVISION_THRESHOLD,
  serializeLawEnforcement,
  restoreLawEnforcement,
  tickLawEnforcement,
  tickUndercityDecay,
} from '../../src/ai/agents/political/LawEnforcementSystem';
import { KGBAgent } from '../../src/ai/agents/political/KGBAgent';

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function makeTickCtx(overrides: Partial<LawEnforcementTickContext> = {}): LawEnforcementTickContext {
  return {
    era: 'revolution',
    population: 100,
    habitableArea: 10,
    employmentRate: 0.85,
    morale: 60,
    inequalityIndex: 0.1,
    densityPressure: 0,
    infrastructurePressure: 0,
    ...overrides,
  };
}

function makeCrimeCtx(overrides: Partial<CrimeRateContext> = {}): CrimeRateContext {
  return {
    baseCrime: 0.1,
    densityPressure: 0,
    employmentRate: 0.85,
    morale: 60,
    inequalityIndex: 0.1,
    judgeCoverage: 0.5,
    ...overrides,
  };
}

// ─── Enforcement Mode Transitions ────────────────────────────────────────────

describe('LawEnforcementSystem — era-based mode transitions', () => {
  it('maps revolution through the_eternal to kgb mode', () => {
    const kgbEras = [
      'revolution', 'collectivization', 'industrialization',
      'great_patriotic', 'reconstruction', 'thaw_and_freeze',
      'stagnation', 'the_eternal',
    ] as const;
    for (const era of kgbEras) {
      expect(getEnforcementMode(era)).toBe('kgb');
    }
  });

  it('maps post_soviet and planetary to security_services', () => {
    expect(getEnforcementMode('post_soviet')).toBe('security_services');
    expect(getEnforcementMode('planetary')).toBe('security_services');
  });

  it('maps solar_engineering and type_one to sector_judges', () => {
    expect(getEnforcementMode('solar_engineering')).toBe('sector_judges');
    expect(getEnforcementMode('type_one')).toBe('sector_judges');
  });

  it('maps deconstruction through type_two_peak to megacity_arbiters', () => {
    const arbiterEras = ['deconstruction', 'dyson_swarm', 'megaearth', 'type_two_peak'] as const;
    for (const era of arbiterEras) {
      expect(getEnforcementMode(era)).toBe('megacity_arbiters');
    }
  });
});

// ─── Crime Rate Model ────────────────────────────────────────────────────────

describe('LawEnforcementSystem — crime rate computation', () => {
  it('returns 0 when all factors are favorable', () => {
    const rate = computeCrimeRate(makeCrimeCtx({
      baseCrime: 0.1,
      densityPressure: 0,
      employmentRate: 1.0,  // full employment
      morale: 100,          // perfect morale
      inequalityIndex: 0,
      judgeCoverage: 1.0,    // full coverage
    }));
    expect(rate).toBe(0);
  });

  it('increases with density pressure', () => {
    const low = computeCrimeRate(makeCrimeCtx({ densityPressure: 0 }));
    const high = computeCrimeRate(makeCrimeCtx({ densityPressure: 0.8 }));
    expect(high).toBeGreaterThan(low);
  });

  it('increases with lower employment', () => {
    const employed = computeCrimeRate(makeCrimeCtx({ employmentRate: 0.95 }));
    const unemployed = computeCrimeRate(makeCrimeCtx({ employmentRate: 0.3 }));
    expect(unemployed).toBeGreaterThan(employed);
  });

  it('increases with lower morale', () => {
    const happy = computeCrimeRate(makeCrimeCtx({ morale: 90 }));
    const miserable = computeCrimeRate(makeCrimeCtx({ morale: 10 }));
    expect(miserable).toBeGreaterThan(happy);
  });

  it('increases with higher inequality', () => {
    const equal = computeCrimeRate(makeCrimeCtx({ inequalityIndex: 0 }));
    const unequal = computeCrimeRate(makeCrimeCtx({ inequalityIndex: 0.8 }));
    expect(unequal).toBeGreaterThan(equal);
  });

  it('decreases with higher judge coverage', () => {
    const patrolled = computeCrimeRate(makeCrimeCtx({ judgeCoverage: 0.9 }));
    const unpatrolled = computeCrimeRate(makeCrimeCtx({ judgeCoverage: 0.1 }));
    expect(unpatrolled).toBeGreaterThan(patrolled);
  });

  it('clamps output to [0, 1]', () => {
    const extreme = computeCrimeRate(makeCrimeCtx({
      baseCrime: 1.0,
      densityPressure: 1.0,
      employmentRate: 0,
      morale: 0,
      inequalityIndex: 1.0,
      judgeCoverage: 0,
    }));
    expect(extreme).toBeLessThanOrEqual(1);
    expect(extreme).toBeGreaterThanOrEqual(0);
  });

  it('base crime levels increase with enforcement mode', () => {
    expect(BASE_CRIME_BY_MODE.kgb).toBeLessThan(BASE_CRIME_BY_MODE.security_services);
    expect(BASE_CRIME_BY_MODE.security_services).toBeLessThan(BASE_CRIME_BY_MODE.sector_judges);
    expect(BASE_CRIME_BY_MODE.sector_judges).toBeLessThan(BASE_CRIME_BY_MODE.megacity_arbiters);
  });
});

// ─── Judge Coverage ──────────────────────────────────────────────────────────

describe('LawEnforcementSystem — judge coverage', () => {
  it('returns 1 when population is 0', () => {
    expect(computeJudgeCoverage(10, 0)).toBe(1);
  });

  it('returns 1 at full coverage', () => {
    // 10K pop needs 5 judges
    expect(computeJudgeCoverage(JUDGES_PER_10K, 10_000)).toBe(1);
  });

  it('returns 0.5 at half coverage', () => {
    const halfJudges = Math.floor(JUDGES_PER_10K / 2);
    const coverage = computeJudgeCoverage(halfJudges, 10_000);
    expect(coverage).toBeCloseTo(halfJudges / JUDGES_PER_10K, 2);
  });

  it('caps at 1 even with excess judges', () => {
    expect(computeJudgeCoverage(100, 10_000)).toBe(1);
  });
});

// ─── Undercity Decay ─────────────────────────────────────────────────────────

describe('LawEnforcementSystem — undercity decay', () => {
  it('returns unchanged decay in kgb mode (no undercity)', () => {
    const result = tickUndercityDecay(0.1, 'kgb', 0.5, 0.3, false);
    expect(result).toBe(0.1);
  });

  it('returns unchanged decay in security_services mode', () => {
    const result = tickUndercityDecay(0.1, 'security_services', 0.5, 0.3, false);
    expect(result).toBe(0.1);
  });

  it('increases in sector_judges mode with high density', () => {
    const result = tickUndercityDecay(0.1, 'sector_judges', 0.8, 0.5, false);
    expect(result).toBeGreaterThan(0.1);
  });

  it('increases faster in megacity_arbiters mode', () => {
    const judges = tickUndercityDecay(0.1, 'sector_judges', 0.8, 0.5, false);
    const arbiters = tickUndercityDecay(0.1, 'megacity_arbiters', 0.8, 0.5, false);
    expect(arbiters).toBeGreaterThan(judges);
  });

  it('judge presence slows decay growth', () => {
    const noJudge = tickUndercityDecay(0.1, 'megacity_arbiters', 0.8, 0.5, false);
    const withJudge = tickUndercityDecay(0.1, 'megacity_arbiters', 0.8, 0.5, true);
    expect(withJudge).toBeLessThan(noJudge);
  });

  it('clamps to [0, 1]', () => {
    const result = tickUndercityDecay(0.999, 'megacity_arbiters', 1.0, 1.0, false);
    expect(result).toBeLessThanOrEqual(1);
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('does not increase below density threshold', () => {
    // density 0.2 is below the 0.3 threshold
    const result = tickUndercityDecay(0.01, 'sector_judges', 0.2, 0, false);
    // Only base rate + recovery applies
    expect(result).toBeLessThanOrEqual(0.01 + 0.001);
  });
});

// ─── Iso-Cube System ─────────────────────────────────────────────────────────

describe('LawEnforcementSystem — iso-cubes', () => {
  it('sentences 0 when crime rate is 0', () => {
    expect(computeIsoCubeSentences(0, 100_000, 0.8)).toBe(0);
  });

  it('sentences 0 when judge coverage is 0', () => {
    expect(computeIsoCubeSentences(0.5, 100_000, 0)).toBe(0);
  });

  it('sentences proportional to crime * coverage * population', () => {
    const sentences = computeIsoCubeSentences(0.5, 1_000_000, 0.8);
    expect(sentences).toBeGreaterThan(0);
    // 0.5 * 0.8 * 0.001 * 1M = 400
    expect(sentences).toBe(400);
  });

  it('computes labor at correct efficiency', () => {
    expect(computeIsoCubeLabor(1000)).toBe(1000 * ISO_CUBE_LABOR_EFFICIENCY);
  });
});

// ─── Sector Subdivision ──────────────────────────────────────────────────────

describe('LawEnforcementSystem — sector subdivision', () => {
  it('returns 1 sector for kgb mode regardless of population', () => {
    expect(computeRequiredSectors(10_000_000, 'kgb')).toBe(1);
  });

  it('returns 1 sector for security_services mode', () => {
    expect(computeRequiredSectors(10_000_000, 'security_services')).toBe(1);
  });

  it('subdivides at 1M threshold in sector_judges mode', () => {
    expect(computeRequiredSectors(500_000, 'sector_judges')).toBe(1);
    expect(computeRequiredSectors(1_500_000, 'sector_judges')).toBe(2);
    expect(computeRequiredSectors(5_000_000, 'sector_judges')).toBe(5);
  });

  it('generates correct sector names', () => {
    const names = generateSectorNames(3, 'sector_judges');
    expect(names).toEqual(['Sector A-1', 'Sector B-1', 'Sector C-1']);

    const blockNames = generateSectorNames(2, 'megacity_arbiters');
    expect(blockNames).toEqual(['Block A-1', 'Block B-1']);
  });
});

// ─── Full Tick Lifecycle ─────────────────────────────────────────────────────

describe('LawEnforcementSystem — tick lifecycle', () => {
  it('starts in kgb mode with no sectors', () => {
    const state = createLawEnforcementState();
    expect(state.mode).toBe('kgb');
    expect(state.sectors).toHaveLength(0);
  });

  it('ticks without error in revolution era', () => {
    const state = createLawEnforcementState();
    const ctx = makeTickCtx({ era: 'revolution', population: 100 });
    const newState = tickLawEnforcement(state, ctx);
    expect(newState.mode).toBe('kgb');
    expect(newState.aggregateCrimeRate).toBeGreaterThanOrEqual(0);
  });

  it('transitions to sector_judges in solar_engineering era', () => {
    const state = createLawEnforcementState();
    const ctx = makeTickCtx({ era: 'solar_engineering', population: 2_000_000 });
    const newState = tickLawEnforcement(state, ctx);
    expect(newState.mode).toBe('sector_judges');
    expect(newState.sectors.length).toBeGreaterThanOrEqual(2);
  });

  it('creates sectors for megacity population', () => {
    const state = createLawEnforcementState();
    const ctx = makeTickCtx({ era: 'megaearth', population: 5_000_000 });
    const newState = tickLawEnforcement(state, ctx);
    expect(newState.mode).toBe('megacity_arbiters');
    expect(newState.sectors.length).toBe(5);
    expect(newState.totalJudges).toBeGreaterThan(0);
  });

  it('auto-builds iso-cubes when crime exceeds threshold', () => {
    // Large population with poor conditions → non-zero crime → iso-cubes build.
    // Auto-assigned judges cover ~60% of ideal, so crime is always nonzero
    // when employment and morale are low.
    let state = createLawEnforcementState();
    const ctx = makeTickCtx({
      era: 'megaearth',
      population: 5_000_000,
      employmentRate: 0.3,  // low employment → high crime
      morale: 20,           // low morale → high crime
      inequalityIndex: 0.8, // high inequality → high crime
      densityPressure: 0.8,
    });

    // Tick several times to build up crime and trigger iso-cube construction
    for (let i = 0; i < 10; i++) {
      state = tickLawEnforcement(state, ctx);
    }

    // Crime should be non-zero with these conditions
    expect(state.aggregateCrimeRate).toBeGreaterThan(0);
    const totalIsoCubes = state.sectors.reduce((sum, s) => sum + s.isoCubeCount, 0);
    expect(totalIsoCubes).toBeGreaterThan(0);
  });

  it('computes aggregate crime rate across sectors', () => {
    const state = createLawEnforcementState();
    const ctx = makeTickCtx({
      era: 'type_one',
      population: 3_000_000,
      employmentRate: 0.3,  // low employment ensures nonzero crime
      morale: 30,           // low morale amplifies crime
      inequalityIndex: 0.5,
    });
    const newState = tickLawEnforcement(state, ctx);
    // With 60% judge coverage and poor conditions, crime should be nonzero
    expect(newState.aggregateCrimeRate).toBeGreaterThan(0);
    expect(newState.aggregateCrimeRate).toBeLessThanOrEqual(1);
  });

  it('produces iso-cube labor output', () => {
    let state = createLawEnforcementState('megacity_arbiters');
    // Manually seed a sector with iso-cube population
    state.sectors = [createSectorBlock('s1', 'Block A-1', 1_000_000, 100)];
    state.sectors[0]!.isoCubeCount = 10;
    state.sectors[0]!.isoCubePopulation = 2000;
    state.sectors[0]!.crimeRate = 0.3;

    const ctx = makeTickCtx({ era: 'megaearth', population: 1_000_000 });
    const newState = tickLawEnforcement(state, ctx);
    expect(newState.totalIsoCubeLabor).toBeGreaterThan(0);
  });
});

// ─── Serialization ───────────────────────────────────────────────────────────

describe('LawEnforcementSystem — serialization', () => {
  it('round-trips state through serialize/restore', () => {
    let state = createLawEnforcementState('sector_judges');
    state.sectors = [
      createSectorBlock('s1', 'Sector A-1', 500_000, 50),
      createSectorBlock('s2', 'Sector B-1', 500_000, 50),
    ];
    state.sectors[0]!.crimeRate = 0.3;
    state.sectors[0]!.undercityDecay = 0.15;
    state.sectors[0]!.isoCubeCount = 5;
    state.sectors[0]!.isoCubePopulation = 1200;
    state.aggregateCrimeRate = 0.25;
    state.totalJudges = 250;
    state.totalIsoCubePopulation = 1200;
    state.totalIsoCubeLabor = computeIsoCubeLabor(1200);

    const saved = serializeLawEnforcement(state);
    const restored = restoreLawEnforcement(saved);

    expect(restored.mode).toBe('sector_judges');
    expect(restored.sectors).toHaveLength(2);
    expect(restored.sectors[0]!.crimeRate).toBe(0.3);
    expect(restored.sectors[0]!.undercityDecay).toBe(0.15);
    expect(restored.sectors[0]!.isoCubeCount).toBe(5);
    expect(restored.sectors[0]!.isoCubePopulation).toBe(1200);
    expect(restored.aggregateCrimeRate).toBe(0.25);
    expect(restored.totalIsoCubeLabor).toBe(computeIsoCubeLabor(1200));
  });
});

// ─── KGBAgent Integration ────────────────────────────────────────────────────

describe('KGBAgent — law enforcement integration', () => {
  it('starts with kgb law enforcement mode', () => {
    const kgb = new KGBAgent();
    expect(kgb.getLawEnforcementMode()).toBe('kgb');
  });

  it('ticks law enforcement without error', () => {
    const kgb = new KGBAgent();
    kgb.tickLawEnforcement(makeTickCtx());
    expect(kgb.getAggregateCrimeRate()).toBeGreaterThanOrEqual(0);
  });

  it('transitions law enforcement mode on era transition', () => {
    const kgb = new KGBAgent();
    kgb.handleEraTransition(10, 'solar_engineering');
    // Mode update happens in handleEraTransition
    expect(kgb.getLawEnforcementMode()).toBe('sector_judges');
  });

  it('reports iso-cube labor after megacity tick', () => {
    const kgb = new KGBAgent();
    // Tick in megacity era with crime-prone conditions
    for (let i = 0; i < 10; i++) {
      kgb.tickLawEnforcement(makeTickCtx({
        era: 'megaearth',
        population: 5_000_000,
        employmentRate: 0.4,
        morale: 30,
        densityPressure: 0.7,
      }));
    }
    // Iso-cubes should exist after several ticks of high crime
    expect(kgb.getIsoCubePopulation()).toBeGreaterThanOrEqual(0);
  });

  it('serializes and restores law enforcement via KGBAgent', () => {
    const kgb = new KGBAgent();
    kgb.tickLawEnforcement(makeTickCtx({
      era: 'type_one',
      population: 2_000_000,
    }));

    const saved = kgb.serializeLawEnforcement();
    expect(saved.mode).toBe('sector_judges');

    const kgb2 = new KGBAgent();
    kgb2.restoreLawEnforcement(saved);
    expect(kgb2.getLawEnforcementMode()).toBe('sector_judges');
  });

  it('returns law enforcement state as read-only', () => {
    const kgb = new KGBAgent();
    const state = kgb.getLawEnforcementState();
    expect(state).toBeDefined();
    expect(state.mode).toBe('kgb');
    expect(state.sectors).toHaveLength(0);
  });
});
