/**
 * @fileoverview Tests for DIFFICULTY_PRESETS deprecation in Governor codepaths.
 *
 * Validates that ScoringSystem.getDifficultyConfig() returns:
 *   - DIFFICULTY_PRESETS when no governor modifiers are set (classic mode)
 *   - DynamicModifiers (via modifiersToDifficultyConfig) when governor is active
 *   - Reverts to DIFFICULTY_PRESETS when governor modifiers are cleared
 *
 * Also validates SimulationEngine integration:
 *   - Classic mode (no governor): ScoringSystem never receives governor modifiers
 *   - Historical mode (with governor): ScoringSystem receives governor modifiers after tick
 */

import type {
  DynamicModifiers,
  GovernorContext,
  GovernorDirective,
  GovernorSaveData,
  IGovernor,
} from '@/ai/agents/crisis/Governor';
import { DEFAULT_MODIFIERS } from '@/ai/agents/crisis/Governor';
import { DIFFICULTY_PRESETS, ScoringSystem } from '@/ai/agents/political/ScoringSystem';
import { createMetaStore, createResourceStore } from '@/ecs/factories';
import { world } from '@/ecs/world';
import { GameGrid } from '@/game/GameGrid';
import type { SimCallbacks } from '@/game/SimulationEngine';
import { SimulationEngine } from '@/game/SimulationEngine';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createMockCallbacks(): SimCallbacks {
  return {
    onToast: jest.fn(),
    onAdvisor: jest.fn(),
    onPravda: jest.fn(),
    onStateChange: jest.fn(),
    onTutorialMilestone: jest.fn(),
    onAchievement: jest.fn(),
    onGameTally: jest.fn(),
    onGameOver: jest.fn(),
    onEraChanged: jest.fn(),
    onMinigame: jest.fn(),
    onSettlementChange: jest.fn(),
  };
}

function createMockGovernor(overrides?: Partial<GovernorDirective>): IGovernor {
  const directive: GovernorDirective = {
    crisisImpacts: [],
    modifiers: { ...DEFAULT_MODIFIERS },
    ...overrides,
  };

  return {
    evaluate: jest.fn((_ctx: GovernorContext): GovernorDirective => directive),
    getActiveCrises: () => [],
    onYearBoundary: jest.fn(),
    serialize: (): GovernorSaveData => ({
      mode: 'historical',
      activeCrises: [],
      state: {},
    }),
    restore: jest.fn(),
  };
}

// ─── ScoringSystem unit tests ─────────────────────────────────────────────────

describe('ScoringSystem.getDifficultyConfig — governor modifier injection', () => {
  it('returns DIFFICULTY_PRESETS when no governor modifiers are set', () => {
    const scoring = new ScoringSystem('worker', 'rasstrelyat');
    const config = scoring.getDifficultyConfig();

    expect(config.label).toBe(DIFFICULTY_PRESETS.worker.label);
    expect(config.quotaMultiplier).toBe(DIFFICULTY_PRESETS.worker.quotaMultiplier);
    expect(config.growthMultiplier).toBe(DIFFICULTY_PRESETS.worker.growthMultiplier);
    expect(config.decayMultiplier).toBe(DIFFICULTY_PRESETS.worker.decayMultiplier);
    expect(config.consumptionMultiplier).toBe(DIFFICULTY_PRESETS.worker.consumptionMultiplier);
    expect(config.resourceMultiplier).toBe(DIFFICULTY_PRESETS.worker.resourceMultiplier);
    expect(config.kgbAggression).toBe(DIFFICULTY_PRESETS.worker.kgbAggression);
    expect(config.markDecayTicks).toBe(DIFFICULTY_PRESETS.worker.markDecayTicks);
    expect(config.politrukRatio).toBe(DIFFICULTY_PRESETS.worker.politrukRatio);
    expect(config.winterModifier).toBe(DIFFICULTY_PRESETS.worker.winterModifier);
  });

  it('returns governor modifiers when set via setGovernorModifiers()', () => {
    const scoring = new ScoringSystem('worker', 'rasstrelyat');
    const customModifiers: DynamicModifiers = {
      ...DEFAULT_MODIFIERS,
      quotaMultiplier: 2.5,
      kgbAggression: 'high',
      decayMultiplier: 3.0,
    };

    scoring.setGovernorModifiers(customModifiers);
    const config = scoring.getDifficultyConfig();

    expect(config.label).toBe('Dynamic');
    expect(config.quotaMultiplier).toBe(2.5);
    expect(config.kgbAggression).toBe('high');
    expect(config.decayMultiplier).toBe(3.0);
    // Other fields should come from the governor modifiers (DEFAULT_MODIFIERS base)
    expect(config.growthMultiplier).toBe(DEFAULT_MODIFIERS.growthMultiplier);
    expect(config.consumptionMultiplier).toBe(DEFAULT_MODIFIERS.consumptionMultiplier);
  });

  it('reverts to DIFFICULTY_PRESETS when setGovernorModifiers(null) is called', () => {
    const scoring = new ScoringSystem('tovarish', 'gulag');
    const customModifiers: DynamicModifiers = {
      ...DEFAULT_MODIFIERS,
      quotaMultiplier: 5.0,
    };

    // Set governor modifiers
    scoring.setGovernorModifiers(customModifiers);
    expect(scoring.getDifficultyConfig().quotaMultiplier).toBe(5.0);
    expect(scoring.getDifficultyConfig().label).toBe('Dynamic');

    // Clear governor modifiers
    scoring.setGovernorModifiers(null);
    const config = scoring.getDifficultyConfig();

    expect(config.label).toBe(DIFFICULTY_PRESETS.tovarish.label);
    expect(config.quotaMultiplier).toBe(DIFFICULTY_PRESETS.tovarish.quotaMultiplier);
    expect(config.decayMultiplier).toBe(DIFFICULTY_PRESETS.tovarish.decayMultiplier);
  });

  it('each difficulty level returns its own preset when no governor modifiers', () => {
    for (const level of ['worker', 'comrade', 'tovarish'] as const) {
      const scoring = new ScoringSystem(level, 'rasstrelyat');
      const config = scoring.getDifficultyConfig();
      expect(config.label).toBe(DIFFICULTY_PRESETS[level].label);
      expect(config.quotaMultiplier).toBe(DIFFICULTY_PRESETS[level].quotaMultiplier);
    }
  });

  it('governor modifiers override regardless of difficulty level', () => {
    // Even with worker (easiest) difficulty, governor modifiers take precedence
    const scoring = new ScoringSystem('worker', 'rehabilitated');
    const harshModifiers: DynamicModifiers = {
      ...DEFAULT_MODIFIERS,
      quotaMultiplier: 3.0,
      decayMultiplier: 2.0,
      consumptionMultiplier: 2.5,
    };

    scoring.setGovernorModifiers(harshModifiers);
    const config = scoring.getDifficultyConfig();

    expect(config.quotaMultiplier).toBe(3.0);
    expect(config.decayMultiplier).toBe(2.0);
    expect(config.consumptionMultiplier).toBe(2.5);
    // Should NOT return worker preset values
    expect(config.quotaMultiplier).not.toBe(DIFFICULTY_PRESETS.worker.quotaMultiplier);
  });
});

// ─── SimulationEngine integration tests ───────────────────────────────────────

describe('SimulationEngine — ScoringSystem governor modifier wiring', () => {
  let grid: GameGrid;
  let cb: ReturnType<typeof createMockCallbacks>;
  let engine: SimulationEngine;

  beforeEach(() => {
    world.clear();
    grid = new GameGrid();
    cb = createMockCallbacks();
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    createResourceStore();
    createMetaStore();
    engine = new SimulationEngine(grid, cb);
  });

  afterEach(() => {
    world.clear();
    jest.restoreAllMocks();
  });

  it('classic mode: ScoringSystem has no governor modifiers after tick', () => {
    // No governor set — classic mode
    engine.tick();

    const scoring = engine.getScoring();
    const config = scoring.getDifficultyConfig();

    // Should return preset, not Dynamic
    expect(config.label).not.toBe('Dynamic');
    expect(config.label).toBe(DIFFICULTY_PRESETS.comrade.label);
  });

  it('historical mode: ScoringSystem receives governor modifiers after tick', () => {
    const customMods: DynamicModifiers = {
      ...DEFAULT_MODIFIERS,
      quotaMultiplier: 2.0,
      decayMultiplier: 1.5,
    };
    const gov = createMockGovernor({
      modifiers: customMods,
    });
    engine.setGovernor(gov);

    engine.tick();

    const scoring = engine.getScoring();
    const config = scoring.getDifficultyConfig();

    expect(config.label).toBe('Dynamic');
    expect(config.quotaMultiplier).toBe(2.0);
    expect(config.decayMultiplier).toBe(1.5);
  });

  it('removing governor reverts ScoringSystem to DIFFICULTY_PRESETS on next tick', () => {
    const gov = createMockGovernor({
      modifiers: {
        ...DEFAULT_MODIFIERS,
        quotaMultiplier: 4.0,
      },
    });
    engine.setGovernor(gov);

    // Tick with governor active
    engine.tick();
    expect(engine.getScoring().getDifficultyConfig().label).toBe('Dynamic');

    // Remove governor by setting a null-returning one isn't possible via API,
    // but we can verify the fallback path: if cachedDirective is null
    // (e.g. no governor), scoring reverts.
    // Simulate by setting governor to null indirectly via a fresh engine tick
    // after governor was removed. The setGovernor API replaces the governor.
    // Create a new engine without governor to test the null path.
    world.clear();
    createResourceStore();
    createMetaStore();
    const engine2 = new SimulationEngine(grid, cb);
    engine2.tick();

    const config = engine2.getScoring().getDifficultyConfig();
    expect(config.label).toBe(DIFFICULTY_PRESETS.comrade.label);
  });

  it('governor modifiers update each tick as directive changes', () => {
    let callCount = 0;
    const mods1: DynamicModifiers = { ...DEFAULT_MODIFIERS, quotaMultiplier: 1.5 };
    const mods2: DynamicModifiers = { ...DEFAULT_MODIFIERS, quotaMultiplier: 3.0 };

    const gov: IGovernor = {
      evaluate: jest.fn((): GovernorDirective => {
        callCount++;
        return {
          crisisImpacts: [],
          modifiers: callCount === 1 ? mods1 : mods2,
        };
      }),
      getActiveCrises: () => [],
      onYearBoundary: jest.fn(),
      serialize: () => ({ mode: 'historical', activeCrises: [], state: {} }),
      restore: jest.fn(),
    };

    engine.setGovernor(gov);

    // First tick: mods1
    engine.tick();
    expect(engine.getScoring().getDifficultyConfig().quotaMultiplier).toBe(1.5);

    // Second tick: mods2
    engine.tick();
    expect(engine.getScoring().getDifficultyConfig().quotaMultiplier).toBe(3.0);
  });
});
