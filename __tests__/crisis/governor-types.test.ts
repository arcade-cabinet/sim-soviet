/**
 * @fileoverview Tests for Governor interface and DynamicModifiers.
 *
 * Validates that DynamicModifiers has the same shape as DifficultyConfig,
 * DEFAULT_MODIFIERS is frozen, GovernorDirective structure, and that
 * IGovernor can be implemented as a mock.
 */

import { GameRng } from '@/game/SeedSystem';
import {
  DEFAULT_MODIFIERS,
} from '@/ai/agents/crisis/Governor';
import type {
  DynamicModifiers,
  GovernorContext,
  GovernorDirective,
  GovernorMode,
  GovernorSaveData,
  IGovernor,
} from '@/ai/agents/crisis/Governor';
import type { DifficultyConfig } from '@/ai/agents/political/ScoringSystem';
import type { CrisisImpact } from '@/ai/agents/crisis/types';

// ─── Fixtures ───────────────────────────────────────────────────────────────

function makeGovernorContext(overrides?: Partial<GovernorContext>): GovernorContext {
  return {
    year: 1930,
    month: 3,
    population: 2000,
    food: 800,
    money: 300,
    rng: new GameRng('gov-test'),
    totalTicks: 120,
    eraId: 'collectivization',
    ...overrides,
  };
}

// ─── DynamicModifiers shape parity with DifficultyConfig ────────────────────

describe('DynamicModifiers', () => {
  it('has the same fields as DifficultyConfig (minus label)', () => {
    // DifficultyConfig has a "label" field that DynamicModifiers omits.
    // All other fields must match exactly.
    const difficultyKeys: (keyof DifficultyConfig)[] = [
      'label',
      'quotaMultiplier',
      'markDecayTicks',
      'politrukRatio',
      'kgbAggression',
      'growthMultiplier',
      'winterModifier',
      'decayMultiplier',
      'resourceMultiplier',
      'consumptionMultiplier',
    ];

    const modifierKeys: (keyof DynamicModifiers)[] = [
      'quotaMultiplier',
      'markDecayTicks',
      'politrukRatio',
      'kgbAggression',
      'growthMultiplier',
      'winterModifier',
      'decayMultiplier',
      'resourceMultiplier',
      'consumptionMultiplier',
    ];

    // Every modifier key must exist in DifficultyConfig
    for (const key of modifierKeys) {
      expect(difficultyKeys).toContain(key);
    }

    // DifficultyConfig has exactly one extra key: "label"
    const extraKeys = difficultyKeys.filter(k => !modifierKeys.includes(k as keyof DynamicModifiers));
    expect(extraKeys).toEqual(['label']);
  });

  it('is assignable from DifficultyConfig (minus label) at runtime', () => {
    // Simulate extracting modifiers from a DifficultyConfig object
    const difficulty: DifficultyConfig = {
      label: 'Comrade',
      quotaMultiplier: 1.0,
      markDecayTicks: 720,
      politrukRatio: 30,
      kgbAggression: 'medium',
      growthMultiplier: 1.0,
      winterModifier: 'standard',
      decayMultiplier: 1.0,
      resourceMultiplier: 1.0,
      consumptionMultiplier: 1.0,
    };

    // Extract all fields except label
    const { label: _, ...modifiers } = difficulty;
    const dynamic: DynamicModifiers = modifiers;

    expect(dynamic.quotaMultiplier).toBe(1.0);
    expect(dynamic.kgbAggression).toBe('medium');
    expect(dynamic.winterModifier).toBe('standard');
  });
});

// ─── DEFAULT_MODIFIERS ─────────────────────────────────────────────────────

describe('DEFAULT_MODIFIERS', () => {
  it('has all required fields with "comrade" difficulty values', () => {
    expect(DEFAULT_MODIFIERS.quotaMultiplier).toBe(1.0);
    expect(DEFAULT_MODIFIERS.markDecayTicks).toBe(720);
    expect(DEFAULT_MODIFIERS.politrukRatio).toBe(30);
    expect(DEFAULT_MODIFIERS.kgbAggression).toBe('medium');
    expect(DEFAULT_MODIFIERS.growthMultiplier).toBe(1.0);
    expect(DEFAULT_MODIFIERS.winterModifier).toBe('standard');
    expect(DEFAULT_MODIFIERS.decayMultiplier).toBe(1.0);
    expect(DEFAULT_MODIFIERS.resourceMultiplier).toBe(1.0);
    expect(DEFAULT_MODIFIERS.consumptionMultiplier).toBe(1.0);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(DEFAULT_MODIFIERS)).toBe(true);
  });

  it('rejects mutations silently', () => {
    (DEFAULT_MODIFIERS as Record<string, unknown>)['quotaMultiplier'] = 999;
    expect(DEFAULT_MODIFIERS.quotaMultiplier).toBe(1.0);
  });

  it('has exactly 9 fields', () => {
    expect(Object.keys(DEFAULT_MODIFIERS)).toHaveLength(9);
  });
});

// ─── GovernorContext ────────────────────────────────────────────────────────

describe('GovernorContext', () => {
  it('contains all required fields', () => {
    const ctx = makeGovernorContext();
    expect(ctx.year).toBe(1930);
    expect(ctx.month).toBe(3);
    expect(ctx.population).toBe(2000);
    expect(ctx.food).toBe(800);
    expect(ctx.money).toBe(300);
    expect(ctx.rng).toBeInstanceOf(GameRng);
    expect(ctx.totalTicks).toBe(120);
    expect(ctx.eraId).toBe('collectivization');
  });
});

// ─── GovernorDirective ─────────────────────────────────────────────────────

describe('GovernorDirective', () => {
  it('holds crisis impacts and modifiers', () => {
    const impact: CrisisImpact = {
      crisisId: 'ww2',
      economy: { productionMult: 0.6 },
    };

    const directive: GovernorDirective = {
      crisisImpacts: [impact],
      modifiers: { ...DEFAULT_MODIFIERS },
    };

    expect(directive.crisisImpacts).toHaveLength(1);
    expect(directive.crisisImpacts[0]!.crisisId).toBe('ww2');
    expect(directive.modifiers.quotaMultiplier).toBe(1.0);
  });

  it('can represent a peaceful tick with no impacts', () => {
    const directive: GovernorDirective = {
      crisisImpacts: [],
      modifiers: { ...DEFAULT_MODIFIERS },
    };

    expect(directive.crisisImpacts).toHaveLength(0);
  });

  it('supports modified difficulty during crisis', () => {
    const directive: GovernorDirective = {
      crisisImpacts: [{ crisisId: 'holodomor' }],
      modifiers: {
        ...DEFAULT_MODIFIERS,
        consumptionMultiplier: 2.0,
        growthMultiplier: 0.3,
        kgbAggression: 'high',
      },
    };

    expect(directive.modifiers.consumptionMultiplier).toBe(2.0);
    expect(directive.modifiers.growthMultiplier).toBe(0.3);
    expect(directive.modifiers.kgbAggression).toBe('high');
  });
});

// ─── GovernorMode ──────────────────────────────────────────────────────────

describe('GovernorMode', () => {
  it('accepts all three modes', () => {
    const modes: GovernorMode[] = ['historical', 'freeform', 'classic'];
    expect(modes).toHaveLength(3);
    expect(modes).toContain('historical');
    expect(modes).toContain('freeform');
    expect(modes).toContain('classic');
  });
});

// ─── GovernorSaveData ──────────────────────────────────────────────────────

describe('GovernorSaveData', () => {
  it('serializes minimum required fields', () => {
    const save: GovernorSaveData = {
      mode: 'historical',
      activeCrises: ['ww2'],
      state: {},
    };
    expect(save.mode).toBe('historical');
    expect(save.activeCrises).toEqual(['ww2']);
    expect(save.state).toEqual({});
  });

  it('supports arbitrary state for subclass data', () => {
    const save: GovernorSaveData = {
      mode: 'freeform',
      activeCrises: [],
      state: { divergenceYear: 1953, branchId: 'khrushchev-falls' },
    };
    expect(save.state['divergenceYear']).toBe(1953);
    expect(save.state['branchId']).toBe('khrushchev-falls');
  });

  it('round-trips through JSON serialization', () => {
    const original: GovernorSaveData = {
      mode: 'classic',
      activeCrises: ['famine-1932', 'purge-1937'],
      state: { yearsElapsed: 20 },
    };
    const json = JSON.stringify(original);
    const restored: GovernorSaveData = JSON.parse(json);
    expect(restored).toEqual(original);
  });
});

// ─── IGovernor interface compliance ────────────────────────────────────────

describe('IGovernor', () => {
  it('can be implemented as a mock governor', () => {
    const mockGovernor: IGovernor = {
      evaluate: jest.fn().mockReturnValue({
        crisisImpacts: [],
        modifiers: { ...DEFAULT_MODIFIERS },
      } satisfies GovernorDirective),
      getActiveCrises: jest.fn().mockReturnValue([]),
      onYearBoundary: jest.fn(),
      serialize: jest.fn().mockReturnValue({
        mode: 'classic',
        activeCrises: [],
        state: {},
      } satisfies GovernorSaveData),
      restore: jest.fn(),
    };

    const ctx = makeGovernorContext();
    const directive = mockGovernor.evaluate(ctx);
    expect(directive.crisisImpacts).toEqual([]);
    expect(directive.modifiers.quotaMultiplier).toBe(1.0);

    expect(mockGovernor.getActiveCrises()).toEqual([]);

    mockGovernor.onYearBoundary(1931);
    expect(mockGovernor.onYearBoundary).toHaveBeenCalledWith(1931);

    const saved = mockGovernor.serialize();
    expect(saved.mode).toBe('classic');

    mockGovernor.restore(saved);
    expect(mockGovernor.restore).toHaveBeenCalledWith(saved);
  });

  it('can produce crisis impacts during active crises', () => {
    const warImpact: CrisisImpact = {
      crisisId: 'ww2',
      economy: { productionMult: 0.6 },
      workforce: { conscriptionCount: 150, moraleModifier: -0.2 },
    };

    const warModifiers: DynamicModifiers = {
      ...DEFAULT_MODIFIERS,
      quotaMultiplier: 1.5,
      kgbAggression: 'high',
      consumptionMultiplier: 1.3,
    };

    const mockGovernor: IGovernor = {
      evaluate: jest.fn().mockReturnValue({
        crisisImpacts: [warImpact],
        modifiers: warModifiers,
      } satisfies GovernorDirective),
      getActiveCrises: jest.fn().mockReturnValue(['ww2']),
      onYearBoundary: jest.fn(),
      serialize: jest.fn().mockReturnValue({
        mode: 'historical',
        activeCrises: ['ww2'],
        state: { warStartTick: 288 },
      } satisfies GovernorSaveData),
      restore: jest.fn(),
    };

    expect(mockGovernor.getActiveCrises()).toEqual(['ww2']);

    const directive = mockGovernor.evaluate(makeGovernorContext({ year: 1942 }));
    expect(directive.crisisImpacts).toHaveLength(1);
    expect(directive.crisisImpacts[0]!.crisisId).toBe('ww2');
    expect(directive.modifiers.quotaMultiplier).toBe(1.5);
    expect(directive.modifiers.kgbAggression).toBe('high');
  });

  it('handles year boundary transitions', () => {
    const yearBoundarySpy = jest.fn();

    const mockGovernor: IGovernor = {
      evaluate: jest.fn().mockReturnValue({
        crisisImpacts: [],
        modifiers: { ...DEFAULT_MODIFIERS },
      }),
      getActiveCrises: jest.fn().mockReturnValue([]),
      onYearBoundary: yearBoundarySpy,
      serialize: jest.fn().mockReturnValue({
        mode: 'historical',
        activeCrises: [],
        state: {},
      }),
      restore: jest.fn(),
    };

    mockGovernor.onYearBoundary(1918);
    mockGovernor.onYearBoundary(1919);
    mockGovernor.onYearBoundary(1920);

    expect(yearBoundarySpy).toHaveBeenCalledTimes(3);
    expect(yearBoundarySpy).toHaveBeenCalledWith(1918);
    expect(yearBoundarySpy).toHaveBeenCalledWith(1919);
    expect(yearBoundarySpy).toHaveBeenCalledWith(1920);
  });
});
