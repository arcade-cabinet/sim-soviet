/**
 * @fileoverview Tests for SettlementSummary wiring into GovernorContext.
 *
 * Validates:
 * 1. GovernorContext accepts an optional settlement field
 * 2. HistoricalGovernor + FreeformGovernor evaluate() works with settlement present
 * 3. Settlement summary fields are correctly typed
 * 4. Backward compat: evaluate() works without settlement (undefined)
 */

import type { GovernorContext } from '@/ai/agents/crisis/Governor';
import { DEFAULT_MODIFIERS } from '@/ai/agents/crisis/Governor';
import { HistoricalGovernor } from '@/ai/agents/crisis/HistoricalGovernor';
import { FreeformGovernor } from '@/ai/agents/crisis/FreeformGovernor';
import type { SettlementSummary } from '@/game/engine/SettlementSummary';
import { buildSettlementSummary } from '@/game/engine/SettlementSummary';
import { GameRng } from '@/game/SeedSystem';

// ─── Fixtures ───────────────────────────────────────────────────────────────

function makeSettlement(overrides?: Partial<SettlementSummary>): SettlementSummary {
  return buildSettlementSummary({
    year: 1940,
    month: 6,
    population: 5000,
    buildingCount: 30,
    totalFood: 2000,
    totalPower: 100,
    totalMorale: 55,
    activeCrisisCount: 0,
    activeCrisisTypes: new Set<string>(),
    trendDeltas: { food: 10, population: 5, morale: -2, power: 0 },
    yearsSinceLastWar: 15,
    yearsSinceLastFamine: 8,
    yearsSinceLastDisaster: 20,
    ...overrides,
  });
}

function makeCtx(overrides?: Partial<GovernorContext>): GovernorContext {
  return {
    year: 1917,
    month: 1,
    population: 5000,
    food: 2000,
    money: 1000,
    rng: new GameRng('settlement-test'),
    totalTicks: 0,
    eraId: 'revolution',
    ...overrides,
  };
}

// ─── GovernorContext type: settlement is optional ─────────────────────────────

describe('GovernorContext settlement field', () => {
  it('accepts context without settlement (backward compat)', () => {
    const ctx = makeCtx();
    expect(ctx.settlement).toBeUndefined();

    const gov = new HistoricalGovernor();
    const directive = gov.evaluate(ctx);
    expect(directive).toBeDefined();
    expect(directive.modifiers).toEqual(DEFAULT_MODIFIERS);
  });

  it('accepts context with settlement present', () => {
    const settlement = makeSettlement();
    const ctx = makeCtx({ settlement });
    expect(ctx.settlement).toBeDefined();
    expect(ctx.settlement!.buildingCount).toBe(30);
    expect(ctx.settlement!.totalMorale).toBe(55);
  });

  it('settlement trendDeltas are accessible', () => {
    const settlement = makeSettlement({
      trendDeltas: { food: -50, population: -10, morale: -5, power: 0 },
    });
    const ctx = makeCtx({ settlement });
    expect(ctx.settlement!.trendDeltas.food).toBe(-50);
    expect(ctx.settlement!.trendDeltas.population).toBe(-10);
  });

  it('settlement activeCrisisTypes is a Set', () => {
    const settlement = makeSettlement({
      activeCrisisCount: 2,
      activeCrisisTypes: new Set(['war', 'famine']),
    });
    const ctx = makeCtx({ settlement });
    expect(ctx.settlement!.activeCrisisTypes).toBeInstanceOf(Set);
    expect(ctx.settlement!.activeCrisisTypes.has('war')).toBe(true);
    expect(ctx.settlement!.activeCrisisTypes.has('famine')).toBe(true);
  });

  it('settlement yearsSince fields are numbers', () => {
    const settlement = makeSettlement({
      yearsSinceLastWar: 0,
      yearsSinceLastFamine: Infinity,
      yearsSinceLastDisaster: 5,
    });
    const ctx = makeCtx({ settlement });
    expect(ctx.settlement!.yearsSinceLastWar).toBe(0);
    expect(ctx.settlement!.yearsSinceLastFamine).toBe(Infinity);
    expect(ctx.settlement!.yearsSinceLastDisaster).toBe(5);
  });
});

// ─── HistoricalGovernor with settlement ──────────────────────────────────────

describe('HistoricalGovernor with settlement in context', () => {
  it('evaluates normally when settlement is provided', () => {
    const gov = new HistoricalGovernor();
    const settlement = makeSettlement({ year: 1941 });
    const ctx = makeCtx({ year: 1941, month: 6, settlement });

    const directive = gov.evaluate(ctx);
    expect(directive).toBeDefined();
    expect(gov.getActiveCrises()).toContain('great_patriotic_war');
  });

  it('produces same crisis activation with or without settlement', () => {
    const seed = 'hist-settlement-test';
    const gov1 = new HistoricalGovernor();
    const gov2 = new HistoricalGovernor();

    // Without settlement
    const dir1 = gov1.evaluate(makeCtx({ year: 1941, rng: new GameRng(seed) }));

    // With settlement
    const settlement = makeSettlement({ year: 1941 });
    const dir2 = gov2.evaluate(makeCtx({ year: 1941, rng: new GameRng(seed), settlement }));

    // Same crises should activate
    expect(gov1.getActiveCrises().sort()).toEqual(gov2.getActiveCrises().sort());

    // Same impact crisis IDs
    const ids1 = dir1.crisisImpacts.map((i) => i.crisisId).sort();
    const ids2 = dir2.crisisImpacts.map((i) => i.crisisId).sort();
    expect(ids1).toEqual(ids2);
  });

  it('settlement with active crisis data does not alter governor behavior', () => {
    const gov = new HistoricalGovernor();
    const settlement = makeSettlement({
      year: 1917,
      activeCrisisCount: 3,
      activeCrisisTypes: new Set(['war', 'famine', 'disaster']),
    });
    const ctx = makeCtx({ year: 1917, month: 1, settlement });

    const directive = gov.evaluate(ctx);
    // 1917 has no crises in HistoricalGovernor regardless of settlement data
    expect(gov.getActiveCrises()).toEqual([]);
    expect(directive.modifiers).toEqual(DEFAULT_MODIFIERS);
  });
});

// ─── FreeformGovernor with settlement ────────────────────────────────────────

describe('FreeformGovernor with settlement in context', () => {
  it('evaluates normally when settlement is provided', () => {
    const gov = new FreeformGovernor();
    const settlement = makeSettlement({ year: 1917 });
    const ctx = makeCtx({ year: 1917, month: 1, settlement });

    const directive = gov.evaluate(ctx);
    expect(directive).toBeDefined();
    expect(directive.modifiers).toBeDefined();
  });

  it('does not crash with empty settlement', () => {
    const gov = new FreeformGovernor();
    const settlement = makeSettlement({
      population: 0,
      buildingCount: 0,
      totalFood: 0,
      totalPower: 0,
      totalMorale: 0,
    });
    const ctx = makeCtx({ year: 1920, month: 1, settlement });

    expect(() => gov.evaluate(ctx)).not.toThrow();
  });
});

// ─── buildSettlementSummary pure function ────────────────────────────────────

describe('buildSettlementSummary', () => {
  it('returns a shallow copy of input', () => {
    const input = makeSettlement();
    const output = buildSettlementSummary(input);

    expect(output).toEqual(input);
    expect(output).not.toBe(input);
  });

  it('preserves all fields', () => {
    const input = makeSettlement({
      year: 1960,
      month: 3,
      population: 100000,
      buildingCount: 500,
      totalFood: 50000,
      totalPower: 2000,
      totalMorale: 72,
      activeCrisisCount: 1,
      activeCrisisTypes: new Set(['disaster']),
      trendDeltas: { food: 100, population: 50, morale: 3, power: -10 },
      yearsSinceLastWar: 15,
      yearsSinceLastFamine: 28,
      yearsSinceLastDisaster: 0,
    });
    const output = buildSettlementSummary(input);

    expect(output.year).toBe(1960);
    expect(output.month).toBe(3);
    expect(output.population).toBe(100000);
    expect(output.buildingCount).toBe(500);
    expect(output.totalFood).toBe(50000);
    expect(output.totalPower).toBe(2000);
    expect(output.totalMorale).toBe(72);
    expect(output.activeCrisisCount).toBe(1);
    expect(output.activeCrisisTypes.has('disaster')).toBe(true);
    expect(output.trendDeltas.food).toBe(100);
    expect(output.yearsSinceLastWar).toBe(15);
    expect(output.yearsSinceLastFamine).toBe(28);
    expect(output.yearsSinceLastDisaster).toBe(0);
  });
});
