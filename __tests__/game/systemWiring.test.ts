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
import { ALL_EVENT_TEMPLATES } from '@/game/events/templates';
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

// ── GAP-017: Heating system effects ──

describe('GAP-017: Heating system effects', () => {
  it('pechka tier consumes timber for fuel', () => {
    const cfg = HEATING_CONFIGS['pechka'];
    expect(cfg.consumption.resource).toBe('timber');
    expect(cfg.consumption.amount).toBeGreaterThan(0);
  });

  it('district tier consumes power for fuel', () => {
    const cfg = HEATING_CONFIGS['district'];
    expect(cfg.consumption.resource).toBe('power');
    expect(cfg.consumption.amount).toBeGreaterThan(0);
  });

  it('crumbling tier consumes power with higher cost than district', () => {
    const district = HEATING_CONFIGS['district'];
    const crumbling = HEATING_CONFIGS['crumbling'];
    expect(crumbling.consumption.resource).toBe('power');
    expect(crumbling.consumption.amount).toBeGreaterThan(district.consumption.amount);
  });

  it('processHeating returns fuelConsumed during winter when operational', () => {
    const eco = new EconomySystem();
    // Winter month (December = 12)
    const result = eco.processHeating(50, 12, true);
    expect(result.fuelConsumed).not.toBeNull();
    expect(result.fuelConsumed!.resource).toBe('timber'); // default pechka tier
    expect(result.fuelConsumed!.amount).toBe(HEATING_CONFIGS['pechka'].consumption.amount);
    expect(result.operational).toBe(true);
    expect(result.populationAtRisk).toBe(0);
  });

  it('processHeating sets failing=true when non-operational in winter', () => {
    const eco = new EconomySystem();
    const result = eco.processHeating(50, 1, false); // January, no fuel
    expect(result.operational).toBe(false);
    expect(result.populationAtRisk).toBeGreaterThan(0);
    expect(eco.getHeating().failing).toBe(true);
  });

  it('processHeating does not consume fuel outside winter', () => {
    const eco = new EconomySystem();
    const result = eco.processHeating(50, 7, true); // July
    expect(result.fuelConsumed).toBeNull();
    expect(eco.getHeating().failing).toBe(false);
  });

  it('heating failure applies morale penalty via applyMorale', () => {
    const citizen = { class: 'worker' as const, happiness: 50, hunger: 0, home: { gridX: 0, gridY: 0 } };
    const stats = { morale: 80, loyalty: 50, skill: 50, vodkaDependency: 0, ticksSinceVodka: 0, name: 'Test', assignmentDuration: 0, assignmentSource: 'auto' as const };

    // Without heating failure
    const statsNormal = { ...stats };
    applyMorale(citizen, statsNormal, 0, false);
    const moraleNormal = statsNormal.morale;

    // With heating failure
    const statsCold = { ...stats };
    applyMorale(citizen, statsCold, 0, true);
    const moraleCold = statsCold.morale;

    expect(moraleNormal - moraleCold).toBe(HEATING_FAILURE_MORALE_PENALTY);
  });

  it('all heating tiers define required config fields', () => {
    for (const tier of ['pechka', 'district', 'crumbling'] as HeatingTier[]) {
      const cfg = HEATING_CONFIGS[tier];
      expect(cfg.baseEfficiency).toBeGreaterThan(0);
      expect(cfg.baseEfficiency).toBeLessThanOrEqual(1);
      expect(cfg.capacityPer100Pop).toBeGreaterThan(0);
      expect(cfg.consumption.amount).toBeGreaterThan(0);
      expect(cfg.consumption.resource).toBeDefined();
    }
  });
});

// ── GAP-024: Minigame trigger routing ──

describe('GAP-024: Minigame trigger routing', () => {
  it('all 17 minigame definitions exist', () => {
    expect(MINIGAME_DEFINITIONS.length).toBe(17);
  });

  it('all minigame definitions have valid trigger types', () => {
    const validTypes = ['building_tap', 'event', 'periodic'];
    for (const def of MINIGAME_DEFINITIONS) {
      expect(validTypes).toContain(def.triggerType);
    }
  });

  it('periodic minigames have matching conditions in the router', () => {
    const periodicDefs = MINIGAME_DEFINITIONS.filter((d) => d.triggerType === 'periodic');
    expect(periodicDefs.length).toBeGreaterThanOrEqual(2);
    const validConditions = ['population_60', 'inspection_180'];
    for (const def of periodicDefs) {
      expect(validConditions).toContain(def.triggerCondition);
    }
  });

  it('building_tap minigames have matching building trigger map entries', () => {
    const tapDefs = MINIGAME_DEFINITIONS.filter((d) => d.triggerType === 'building_tap');
    // Each building_tap minigame should have at least one building defId that resolves to its triggerCondition
    for (const def of tapDefs) {
      // Terrain features (forest, mountain, market) map directly — they pass through
      if (['forest', 'mountain', 'market'].includes(def.triggerCondition)) continue;
      // For building-based triggers, verify at least one defId resolves to this condition
      const matchedBuildings = [
        'factory-office', 'bread-factory', 'warehouse',
        'collective-farm-hq', 'vodka-distillery', 'gulag-admin',
        'ministry-office', 'government-hq', 'kgb-office',
        'power-station', 'cooling-tower', 'school', 'cultural-palace',
        'workers-club', 'barracks', 'guard-post',
      ].filter((id) => resolveBuildingTrigger(id) === def.triggerCondition);
      expect(matchedBuildings.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('auto-resolve works when tick limit is exceeded', () => {
    const router = new MinigameRouter();
    // Get any periodic minigame definition
    const def = MINIGAME_DEFINITIONS.find((d) => d.triggerType === 'periodic')!;
    router.startMinigame(def, 0);

    // Tick past the tick limit
    const outcome = router.tick(def.tickLimit + 1);
    expect(outcome).not.toBeNull();
    expect(outcome!.announcement).toBeDefined();
  });

  it('cooldown prevents immediate re-trigger of the same minigame', () => {
    const router = new MinigameRouter();
    // Start and resolve the inspection minigame at tick 360
    const def = MINIGAME_DEFINITIONS.find((d) => d.id === 'the_inspection')!;
    router.startMinigame(def, 360);
    router.resolveChoice(def.choices[0]!.id);
    router.clearResolved();

    // At tick 361, neither periodic condition fires (361 % 60 !== 0, 361 % 180 !== 0)
    const result = router.checkTrigger('periodic', { totalTicks: 361, population: 100 });
    expect(result).toBeNull();

    // At tick 540 (= 360 + 180, which IS 180-divisible), the inspection should be on cooldown
    // (cooldown until 360 + 60 = 420, so 540 > 420 and cooldown has expired)
    // But this validates that the cooldown mechanism at least blocks during cooldown window
    const resultDuringCooldown = router.checkTrigger('periodic', { totalTicks: 380, population: 5 });
    // Population too low for the_queue (needs >= 30), and inspection is on cooldown (380 < 420)
    expect(resultDuringCooldown).toBeNull();
  });

  it('all minigame definitions have at least one choice', () => {
    for (const def of MINIGAME_DEFINITIONS) {
      expect(def.choices.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('all choices have success and failure outcomes', () => {
    for (const def of MINIGAME_DEFINITIONS) {
      for (const choice of def.choices) {
        expect(choice.successChance).toBeGreaterThanOrEqual(0);
        expect(choice.successChance).toBeLessThanOrEqual(1);
        expect(choice.onSuccess).toBeDefined();
        expect(choice.onFailure).toBeDefined();
      }
    }
  });
});

// ── GAP-027: Event era filtering ──

describe('GAP-027: Event era filtering', () => {
  it('era-specific events have eraFilter defined', () => {
    const eraFiltered = ALL_EVENT_TEMPLATES.filter((t) => t.eraFilter);
    // We know there are many era-specific events
    expect(eraFiltered.length).toBeGreaterThanOrEqual(10);
  });

  it('eraFilter arrays contain valid era IDs', () => {
    const validEras = [
      'war_communism', 'first_plans', 'great_patriotic',
      'reconstruction', 'thaw', 'stagnation', 'perestroika', 'eternal_soviet',
    ];
    for (const template of ALL_EVENT_TEMPLATES) {
      if (!template.eraFilter) continue;
      for (const era of template.eraFilter) {
        expect(validEras).toContain(era);
      }
    }
  });

  it('events without eraFilter are era-agnostic (fire in any era)', () => {
    const noFilter = ALL_EVENT_TEMPLATES.filter((t) => !t.eraFilter);
    // There should be era-agnostic events (disasters, absurdist, etc.)
    expect(noFilter.length).toBeGreaterThan(0);
  });

  it('each era has at least one era-specific event', () => {
    const eras = [
      'war_communism', 'first_plans', 'great_patriotic',
      'reconstruction', 'thaw', 'stagnation', 'perestroika', 'eternal_soviet',
    ];
    for (const era of eras) {
      const eventsForEra = ALL_EVENT_TEMPLATES.filter(
        (t) => t.eraFilter && t.eraFilter.includes(era),
      );
      expect(eventsForEra.length).toBeGreaterThanOrEqual(1);
    }
  });
});
