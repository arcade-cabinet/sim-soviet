/**
 * @fileoverview Tests for DynamicDifficultyProvider.
 *
 * Validates that computeDynamicDifficulty correctly layers era modifiers
 * with crisis impacts to produce DifficultyConfig values, and that
 * modifiersToDifficultyConfig adapts DynamicModifiers correctly.
 */

import { computeDynamicDifficulty, modifiersToDifficultyConfig } from '@/ai/agents/crisis/DynamicDifficultyProvider';
import type { DynamicModifiers } from '@/ai/agents/crisis/Governor';
import { DEFAULT_MODIFIERS } from '@/ai/agents/crisis/Governor';
import type { CrisisImpact } from '@/ai/agents/crisis/types';

// ─── No-crisis baseline ────────────────────────────────────────────────────

describe('computeDynamicDifficulty — no-crisis baseline', () => {
  it('returns DEFAULT_MODIFIERS values with no args', () => {
    const config = computeDynamicDifficulty();
    expect(config.label).toBe('Dynamic');
    expect(config.quotaMultiplier).toBe(DEFAULT_MODIFIERS.quotaMultiplier);
    expect(config.markDecayTicks).toBe(DEFAULT_MODIFIERS.markDecayTicks);
    expect(config.politrukRatio).toBe(DEFAULT_MODIFIERS.politrukRatio);
    expect(config.kgbAggression).toBe(DEFAULT_MODIFIERS.kgbAggression);
    expect(config.growthMultiplier).toBe(DEFAULT_MODIFIERS.growthMultiplier);
    expect(config.winterModifier).toBe(DEFAULT_MODIFIERS.winterModifier);
    expect(config.decayMultiplier).toBe(DEFAULT_MODIFIERS.decayMultiplier);
    expect(config.resourceMultiplier).toBe(DEFAULT_MODIFIERS.resourceMultiplier);
    expect(config.consumptionMultiplier).toBe(DEFAULT_MODIFIERS.consumptionMultiplier);
  });
});

// ─── Single crisis impacts ─────────────────────────────────────────────────

describe('computeDynamicDifficulty — single crisis impacts', () => {
  it('war impact with quotaMult 1.5 increases quotaMultiplier', () => {
    const impacts: CrisisImpact[] = [{ crisisId: 'ww2', political: { quotaMult: 1.5 } }];
    const config = computeDynamicDifficulty(undefined, impacts);
    expect(config.quotaMultiplier).toBe(1.5);
  });

  it('famine impact with growthMult 0.3 reduces growthMultiplier', () => {
    const impacts: CrisisImpact[] = [{ crisisId: 'holodomor', social: { growthMult: 0.3 } }];
    const config = computeDynamicDifficulty(undefined, impacts);
    expect(config.growthMultiplier).toBeCloseTo(0.3);
  });

  it('disaster impact with decayMult 2.0 increases decayMultiplier', () => {
    const impacts: CrisisImpact[] = [{ crisisId: 'chernobyl', infrastructure: { decayMult: 2.0 } }];
    const config = computeDynamicDifficulty(undefined, impacts);
    expect(config.decayMultiplier).toBe(2.0);
  });
});

// ─── Multiple concurrent crises ────────────────────────────────────────────

describe('computeDynamicDifficulty — multiple concurrent crises', () => {
  it('two quotaMult impacts multiply correctly (1.5 * 1.5 = 2.25)', () => {
    const impacts: CrisisImpact[] = [
      { crisisId: 'ww2', political: { quotaMult: 1.5 } },
      { crisisId: 'purge', political: { quotaMult: 1.5 } },
    ];
    const config = computeDynamicDifficulty(undefined, impacts);
    expect(config.quotaMultiplier).toBeCloseTo(2.25);
  });

  it('war + disaster decayMult multiply correctly (1.5 * 2.0 = 3.0)', () => {
    const impacts: CrisisImpact[] = [
      { crisisId: 'ww2', infrastructure: { decayMult: 1.5 } },
      { crisisId: 'chernobyl', infrastructure: { decayMult: 2.0 } },
    ];
    const config = computeDynamicDifficulty(undefined, impacts);
    expect(config.decayMultiplier).toBeCloseTo(3.0);
  });

  it('mixed crisis types compose independently', () => {
    const impacts: CrisisImpact[] = [
      { crisisId: 'ww2', political: { quotaMult: 1.5 }, social: { growthMult: 0.5 } },
      { crisisId: 'chernobyl', infrastructure: { decayMult: 2.0 } },
    ];
    const config = computeDynamicDifficulty(undefined, impacts);
    expect(config.quotaMultiplier).toBeCloseTo(1.5);
    expect(config.growthMultiplier).toBeCloseTo(0.5);
    expect(config.decayMultiplier).toBeCloseTo(2.0);
  });
});

// ─── KGB aggression mapping ────────────────────────────────────────────────

describe('computeDynamicDifficulty — KGB aggression mapping', () => {
  it('kgbAggressionMult 1.0 keeps default medium', () => {
    const impacts: CrisisImpact[] = [{ crisisId: 'minor', political: { kgbAggressionMult: 1.0 } }];
    const config = computeDynamicDifficulty(undefined, impacts);
    expect(config.kgbAggression).toBe('medium');
  });

  it('kgbAggressionMult 1.5 maps to medium', () => {
    const impacts: CrisisImpact[] = [{ crisisId: 'purge', political: { kgbAggressionMult: 1.5 } }];
    const config = computeDynamicDifficulty(undefined, impacts);
    expect(config.kgbAggression).toBe('medium');
  });

  it('kgbAggressionMult 2.5 maps to high', () => {
    const impacts: CrisisImpact[] = [{ crisisId: 'great-purge', political: { kgbAggressionMult: 2.5 } }];
    const config = computeDynamicDifficulty(undefined, impacts);
    expect(config.kgbAggression).toBe('high');
  });

  it('kgbAggressionMult exactly 2.0 maps to high', () => {
    const impacts: CrisisImpact[] = [{ crisisId: 'purge', political: { kgbAggressionMult: 2.0 } }];
    const config = computeDynamicDifficulty(undefined, impacts);
    expect(config.kgbAggression).toBe('high');
  });

  it('takes max kgbAggressionMult across multiple crises', () => {
    const impacts: CrisisImpact[] = [
      { crisisId: 'minor', political: { kgbAggressionMult: 1.2 } },
      { crisisId: 'major', political: { kgbAggressionMult: 2.5 } },
    ];
    const config = computeDynamicDifficulty(undefined, impacts);
    expect(config.kgbAggression).toBe('high');
  });

  it('base kgbAggression low stays low with no crisis kgb impact', () => {
    const config = computeDynamicDifficulty({ kgbAggression: 'low' });
    expect(config.kgbAggression).toBe('low');
  });
});

// ─── Base modifiers override defaults ──────────────────────────────────────

describe('computeDynamicDifficulty — base modifier overrides', () => {
  it('overrides quotaMultiplier from base', () => {
    const config = computeDynamicDifficulty({ quotaMultiplier: 2.0 });
    expect(config.quotaMultiplier).toBe(2.0);
  });

  it('overridden base multiplies with crisis impacts', () => {
    const impacts: CrisisImpact[] = [{ crisisId: 'ww2', political: { quotaMult: 1.5 } }];
    const config = computeDynamicDifficulty({ quotaMultiplier: 2.0 }, impacts);
    expect(config.quotaMultiplier).toBeCloseTo(3.0);
  });

  it('overrides growthMultiplier from base', () => {
    const config = computeDynamicDifficulty({ growthMultiplier: 0.5 });
    expect(config.growthMultiplier).toBe(0.5);
  });

  it('preserves non-overridden defaults', () => {
    const config = computeDynamicDifficulty({ quotaMultiplier: 2.0 });
    expect(config.markDecayTicks).toBe(DEFAULT_MODIFIERS.markDecayTicks);
    expect(config.politrukRatio).toBe(DEFAULT_MODIFIERS.politrukRatio);
    expect(config.winterModifier).toBe(DEFAULT_MODIFIERS.winterModifier);
    expect(config.resourceMultiplier).toBe(DEFAULT_MODIFIERS.resourceMultiplier);
  });
});

// ─── modifiersToDifficultyConfig ───────────────────────────────────────────

describe('modifiersToDifficultyConfig', () => {
  it('converts DynamicModifiers with label Dynamic', () => {
    const modifiers: DynamicModifiers = { ...DEFAULT_MODIFIERS };
    const config = modifiersToDifficultyConfig(modifiers);
    expect(config.label).toBe('Dynamic');
    expect(config.quotaMultiplier).toBe(modifiers.quotaMultiplier);
    expect(config.markDecayTicks).toBe(modifiers.markDecayTicks);
    expect(config.politrukRatio).toBe(modifiers.politrukRatio);
    expect(config.kgbAggression).toBe(modifiers.kgbAggression);
    expect(config.growthMultiplier).toBe(modifiers.growthMultiplier);
    expect(config.winterModifier).toBe(modifiers.winterModifier);
    expect(config.decayMultiplier).toBe(modifiers.decayMultiplier);
    expect(config.resourceMultiplier).toBe(modifiers.resourceMultiplier);
    expect(config.consumptionMultiplier).toBe(modifiers.consumptionMultiplier);
  });

  it('preserves custom modifier values', () => {
    const modifiers: DynamicModifiers = {
      ...DEFAULT_MODIFIERS,
      quotaMultiplier: 3.0,
      kgbAggression: 'high',
      decayMultiplier: 2.5,
    };
    const config = modifiersToDifficultyConfig(modifiers);
    expect(config.label).toBe('Dynamic');
    expect(config.quotaMultiplier).toBe(3.0);
    expect(config.kgbAggression).toBe('high');
    expect(config.decayMultiplier).toBe(2.5);
  });
});

// ─── Empty crisis impacts array ────────────────────────────────────────────

describe('computeDynamicDifficulty — empty impacts array', () => {
  it('empty array behaves same as no impacts', () => {
    const withEmpty = computeDynamicDifficulty(undefined, []);
    const withUndefined = computeDynamicDifficulty(undefined, undefined);
    expect(withEmpty).toEqual(withUndefined);
  });
});
