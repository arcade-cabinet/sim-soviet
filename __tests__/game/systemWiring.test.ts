/**
 * Tests for game system wiring: GAP-013 (pripiski downstream), GAP-023 (difficulty),
 * GAP-026 (weather effects), GAP-017 (heating), GAP-024 (minigame triggers),
 * and GAP-027 (event era filtering).
 */
import type { AnnualReportData, ReportSubmission } from '@/components/ui/AnnualReportModal';
import { getResourceEntity } from '@/ecs/archetypes';
import { createMetaStore, createResourceStore } from '@/ecs/factories';
import type { QuotaState } from '@/ecs/systems';
import { world } from '@/ecs/world';
import { EconomySystem, HEATING_CONFIGS, type HeatingTier } from '@/game/economy';
import {
  type AnnualReportContext,
  type AnnualReportEngineState,
  falsificationRisk,
  handleQuotaMet,
  processReport,
} from '@/game/engine/annualReportTick';
import { ALL_EVENT_TEMPLATES } from '@/game/events/allTemplates';
import { GameGrid } from '@/game/GameGrid';
import { resolveBuildingTrigger } from '@/game/minigames/BuildingMinigameMap';
import { MINIGAME_DEFINITIONS } from '@/game/minigames/definitions';
import { MinigameRouter } from '@/game/minigames/MinigameRouter';
import { DIFFICULTY_PRESETS } from '@/game/ScoringSystem';
import { SimulationEngine } from '@/game/SimulationEngine';
import { WEATHER_PROFILES, WeatherType } from '@/game/WeatherSystem';
import { HEATING_FAILURE_MORALE_PENALTY } from '@/game/workers/constants';
import { applyMorale, clamp } from '@/game/workers/classes';

function createMockCallbacks() {
  return {
    onToast: jest.fn(),
    onAdvisor: jest.fn(),
    onPravda: jest.fn(),
    onStateChange: jest.fn(),
    onAnnualReport: jest.fn(),
    onNewPlan: jest.fn(),
    onSettlementChange: jest.fn(),
    onGameOver: jest.fn(),
    onBuildingCollapsed: jest.fn(),
    onEraChanged: jest.fn(),
    onMinigame: jest.fn(),
  };
}

function createMockEngineState(overrides?: Partial<AnnualReportEngineState>): AnnualReportEngineState {
  return {
    quota: { type: 'food', target: 500, current: 600, deadlineYear: 1927 },
    consecutiveQuotaFailures: 0,
    pendingReport: false,
    mandateState: null,
    pripiskiCount: 0,
    quotaMultiplier: 1.0,
    ...overrides,
  };
}

function createMockContext(overrides?: Partial<AnnualReportContext>): AnnualReportContext {
  return {
    chronology: { getDate: () => ({ totalTicks: 100, year: 1927, month: 10, hour: 0 }) } as never,
    personnelFile: {
      addMark: jest.fn(),
      addCommendation: jest.fn(),
    } as never,
    scoring: {
      onQuotaMet: jest.fn(),
      onQuotaExceeded: jest.fn(),
    } as never,
    callbacks: createMockCallbacks(),
    rng: undefined,
    engineState: createMockEngineState(),
    deliveries: { resetTotals: jest.fn(), getTotalDelivered: jest.fn() } as never,
    endGame: jest.fn(),
    ...overrides,
  };
}

// ── GAP-013: Pripiski downstream effects ──

describe('GAP-013: Pripiski downstream effects', () => {
  beforeEach(() => {
    world.clear();
  });

  afterEach(() => {
    world.clear();
    jest.restoreAllMocks();
  });

  it('successful pripiski increments pripiskiCount', () => {
    createResourceStore({ food: 100, vodka: 50, population: 10 });
    // RNG returns 0.99 → always above investigation probability → not caught
    jest.spyOn(Math, 'random').mockReturnValue(0.99);

    const ctx = createMockContext({
      engineState: createMockEngineState({
        quota: { type: 'food', target: 500, current: 100, deadlineYear: 1927 },
      }),
    });

    // Submit falsified report (inflated quota to 600)
    processReport(ctx, { reportedQuota: 600, reportedSecondary: 60, reportedPop: 10 });

    expect(ctx.engineState.pripiskiCount).toBe(1);
  });

  it('detected pripiski does not increment pripiskiCount', () => {
    createResourceStore({ food: 100, vodka: 50, population: 10 });
    // RNG returns 0.01 → always below investigation probability → caught
    jest.spyOn(Math, 'random').mockReturnValue(0.01);

    const ctx = createMockContext({
      engineState: createMockEngineState({
        quota: { type: 'food', target: 500, current: 100, deadlineYear: 1927 },
      }),
    });

    processReport(ctx, { reportedQuota: 9999, reportedSecondary: 9999, reportedPop: 9999 });

    expect(ctx.engineState.pripiskiCount).toBe(0);
  });

  it('successful pripiski inflates next quota target by +20%', () => {
    createResourceStore({ food: 100, vodka: 50, population: 10 });
    createMetaStore({ date: { year: 1927, month: 10, tick: 0 } });
    jest.spyOn(Math, 'random').mockReturnValue(0.99);

    const ctx = createMockContext({
      engineState: createMockEngineState({
        quota: { type: 'food', target: 500, current: 100, deadlineYear: 1927 },
      }),
    });

    // Submit falsified report that passes quota check (reported >= target)
    processReport(ctx, { reportedQuota: 600, reportedSecondary: 60, reportedPop: 10 });

    // After successful pripiski + quota met → next quota target should be 500 * 1.2 = 600
    expect(ctx.engineState.quota.target).toBe(600);
  });

  it('honest report does not inflate next quota target', () => {
    createResourceStore({ food: 600, vodka: 50, population: 10 });
    createMetaStore({ date: { year: 1927, month: 10, tick: 0 } });

    const ctx = createMockContext({
      engineState: createMockEngineState({
        quota: { type: 'food', target: 500, current: 600, deadlineYear: 1927 },
      }),
    });

    // Submit honest report
    processReport(ctx, { reportedQuota: 600, reportedSecondary: 50, reportedPop: 10 });

    // Next quota target should be base 500 (no inflation)
    expect(ctx.engineState.quota.target).toBe(500);
  });

  it('prior pripiski history increases investigation probability by +15% each', () => {
    createResourceStore({ food: 100, vodka: 50, population: 10 });

    // First attempt: pripiskiCount=0, risk from 10% inflation on 100→110 = 10%
    // investigationProb = 10/100 + 0*0.15 = 0.10
    // With RNG=0.12, should NOT be caught (0.12 > 0.10)
    jest.spyOn(Math, 'random').mockReturnValue(0.12);

    const ctx1 = createMockContext({
      engineState: createMockEngineState({
        quota: { type: 'food', target: 500, current: 100, deadlineYear: 1927 },
        pripiskiCount: 0,
      }),
    });
    processReport(ctx1, { reportedQuota: 110, reportedSecondary: 50, reportedPop: 10 });
    expect(ctx1.callbacks.onToast).toHaveBeenCalledWith('Report accepted by Gosplan', 'warning');

    // Second attempt: pripiskiCount=1, same risk from inflation
    // investigationProb = 10/100 + 1*0.15 = 0.25
    // With RNG=0.12, SHOULD be caught (0.12 < 0.25)
    jest.spyOn(Math, 'random').mockReturnValue(0.12);

    const ctx2 = createMockContext({
      engineState: createMockEngineState({
        quota: { type: 'food', target: 500, current: 100, deadlineYear: 1927 },
        pripiskiCount: 1,
      }),
    });
    processReport(ctx2, { reportedQuota: 110, reportedSecondary: 50, reportedPop: 10 });
    expect(ctx2.callbacks.onToast).toHaveBeenCalledWith(
      expect.stringContaining('FALSIFICATION DETECTED'),
      'evacuation',
    );
  });

  it('falsification detected adds report_falsified mark to PersonnelFile', () => {
    createResourceStore({ food: 100, vodka: 50, population: 10 });
    jest.spyOn(Math, 'random').mockReturnValue(0.01); // caught

    const ctx = createMockContext({
      engineState: createMockEngineState({
        quota: { type: 'food', target: 500, current: 100, deadlineYear: 1927 },
      }),
    });

    processReport(ctx, { reportedQuota: 9999, reportedSecondary: 50, reportedPop: 10 });

    expect(ctx.personnelFile.addMark).toHaveBeenCalledWith('report_falsified', expect.any(Number));
  });
});

// ── GAP-023: Difficulty multipliers ──

describe('GAP-023: Difficulty multipliers', () => {
  beforeEach(() => {
    world.clear();
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
  });

  afterEach(() => {
    world.clear();
    jest.restoreAllMocks();
  });

  it('worker difficulty starts with quotaMultiplier=0.6 applied to initial quota', () => {
    createResourceStore();
    createMetaStore();
    const grid = new GameGrid();
    const cb = createMockCallbacks();
    const engine = new SimulationEngine(grid, cb, undefined, 'worker');

    const quota = engine.getQuota();
    // Default target is 500 * 0.6 = 300
    expect(quota.target).toBe(300);
  });

  it('tovarish difficulty starts with quotaMultiplier=1.5 applied to initial quota', () => {
    createResourceStore();
    createMetaStore();
    const grid = new GameGrid();
    const cb = createMockCallbacks();
    const engine = new SimulationEngine(grid, cb, undefined, 'tovarish');

    const quota = engine.getQuota();
    // Default target is 500 * 1.5 = 750
    expect(quota.target).toBe(750);
  });

  it('comrade difficulty starts with quotaMultiplier=1.0 (default)', () => {
    createResourceStore();
    createMetaStore();
    const grid = new GameGrid();
    const cb = createMockCallbacks();
    const engine = new SimulationEngine(grid, cb, undefined, 'comrade');

    const quota = engine.getQuota();
    expect(quota.target).toBe(500);
  });

  it('difficulty quotaMultiplier is applied to next quota after annual report', () => {
    createResourceStore({ food: 600, vodka: 50, population: 10 });
    createMetaStore({ date: { year: 1927, month: 10, tick: 0 } });

    // Simulate with worker difficulty quotaMultiplier = 0.6
    const ctx = createMockContext({
      engineState: createMockEngineState({
        quota: { type: 'food', target: 300, current: 600, deadlineYear: 1927 },
        quotaMultiplier: 0.6,
      }),
    });

    // Honest report, quota met
    processReport(ctx, { reportedQuota: 600, reportedSecondary: 50, reportedPop: 10 });

    // Next quota should be 500 * 0.6 = 300
    expect(ctx.engineState.quota.target).toBe(300);
  });

  it('difficulty presets define all expected fields', () => {
    for (const level of ['worker', 'comrade', 'tovarish'] as const) {
      const cfg = DIFFICULTY_PRESETS[level];
      expect(cfg.quotaMultiplier).toBeGreaterThan(0);
      expect(cfg.growthMultiplier).toBeGreaterThan(0);
      expect(cfg.decayMultiplier).toBeGreaterThan(0);
      expect(cfg.resourceMultiplier).toBeGreaterThan(0);
      expect(cfg.markDecayTicks).toBeGreaterThan(0);
      expect(cfg.politrukRatio).toBeGreaterThan(0);
    }
  });
});

// ── GAP-026: Weather effects on gameplay ──

describe('GAP-026: Weather effects on gameplay', () => {
  it('blizzard has farmModifier=0.0 (no farm production)', () => {
    const profile = WEATHER_PROFILES[WeatherType.BLIZZARD];
    expect(profile.farmModifier).toBe(0.0);
  });

  it('blizzard slows construction (+25%)', () => {
    const profile = WEATHER_PROFILES[WeatherType.BLIZZARD];
    expect(profile.constructionTimeMult).toBe(1.25);
  });

  it('heatwave reduces farm output to 50%', () => {
    const profile = WEATHER_PROFILES[WeatherType.HEATWAVE];
    expect(profile.farmModifier).toBe(0.5);
  });

  it('mud storm has highest construction penalty (+50%)', () => {
    const profile = WEATHER_PROFILES[WeatherType.MUD_STORM];
    expect(profile.constructionTimeMult).toBe(1.5);
  });

  it('miraculous sun doubles farm output', () => {
    const profile = WEATHER_PROFILES[WeatherType.MIRACULOUS_SUN];
    expect(profile.farmModifier).toBe(2.0);
  });

  it('clear weather has no production penalties', () => {
    const profile = WEATHER_PROFILES[WeatherType.CLEAR];
    expect(profile.farmModifier).toBe(1.0);
    expect(profile.constructionTimeMult).toBe(1.0);
    expect(profile.workerSpeedMult).toBe(1.0);
  });

  it('all weather types have required modifier fields', () => {
    for (const type of Object.values(WeatherType)) {
      const profile = WEATHER_PROFILES[type];
      expect(profile.farmModifier).toBeDefined();
      expect(profile.constructionTimeMult).toBeDefined();
      expect(profile.workerSpeedMult).toBeDefined();
      expect(profile.eventFrequencyModifier).toBeDefined();
    }
  });
});
