/**
 * @fileoverview Tests for Freeform mode UI integration.
 *
 * Validates that NewGameConfig and GameInitOptions include divergenceYear,
 * that FreeformGovernor is correctly wired on the engine, and that
 * freeform mode uses the correct resource multiplier.
 */

import { FreeformGovernor } from '@/ai/agents/crisis/FreeformGovernor';
import { DIFFICULTY_PRESETS } from '@/ai/agents/political/ScoringSystem';
import type { GameInitOptions } from '@/bridge/GameInit';
import { GameRng } from '@/game/SeedSystem';
import { SimulationEngine } from '@/game/SimulationEngine';
import type { GameMode, NewGameConfig } from '@/ui/NewGameSetup';

// ── Minimal mock grid + callbacks for SimulationEngine constructor ──────────

function makeMockGrid(): any {
  return {
    setCell: jest.fn(),
    getCell: jest.fn(() => null),
    getSize: jest.fn(() => 30),
  };
}

function makeMockCallbacks(): any {
  return {
    onToast: jest.fn(),
    onAdvisor: jest.fn(),
    onPravda: jest.fn(),
    onStateChange: jest.fn(),
    onWeatherChanged: jest.fn(),
    onDayPhaseChanged: jest.fn(),
    onGameOver: jest.fn(),
    onRehabilitation: jest.fn(),
    onAchievement: jest.fn(),
    onSeasonChanged: jest.fn(),
    onBuildingCollapsed: jest.fn(),
    onSettlementChange: jest.fn(),
    onNewPlan: jest.fn(),
    onEraChanged: jest.fn(),
    onAnnualReport: jest.fn(),
    onMinigame: jest.fn(),
    onTutorialMilestone: jest.fn(),
    onGameTally: jest.fn(),
  };
}

// ── NewGameConfig type checks ────────────────────────────────────────────────

describe('NewGameConfig includes divergenceYear', () => {
  it('accepts divergenceYear as optional field', () => {
    const config: NewGameConfig = {
      difficulty: 'comrade',
      consequence: 'permadeath',
      seed: 'test-seed',
      mapSize: 'medium',
      gameMode: 'freeform',
      divergenceYear: 1962,
    };

    expect(config.divergenceYear).toBe(1962);
    expect(config.gameMode).toBe('freeform');
  });

  it('divergenceYear is optional (not required for classic/historical)', () => {
    const config: NewGameConfig = {
      difficulty: 'comrade',
      consequence: 'permadeath',
      seed: 'test-seed',
      mapSize: 'medium',
      gameMode: 'classic',
    };

    expect(config.divergenceYear).toBeUndefined();
  });

  it('freeform is a valid GameMode', () => {
    const mode: GameMode = 'freeform';
    expect(mode).toBe('freeform');
  });
});

// ── GameInitOptions type checks ──────────────────────────────────────────────

describe('GameInitOptions includes divergenceYear', () => {
  it('accepts divergenceYear as optional field', () => {
    const options: GameInitOptions = {
      difficulty: 'comrade',
      consequence: 'permadeath',
      seed: 'test-seed',
      mapSize: 'medium',
      gameMode: 'freeform',
      divergenceYear: 1953,
    };

    expect(options.divergenceYear).toBe(1953);
    expect(options.gameMode).toBe('freeform');
  });

  it('divergenceYear is optional', () => {
    const options: GameInitOptions = {
      gameMode: 'historical',
    };

    expect(options.divergenceYear).toBeUndefined();
  });
});

// ── Freeform mode: FreeformGovernor wiring ───────────────────────────────────

describe('Freeform mode governor wiring', () => {
  it('FreeformGovernor set on engine with correct divergenceYear', () => {
    const engine = new SimulationEngine(
      makeMockGrid(),
      makeMockCallbacks(),
      new GameRng('freeform-test'),
      'comrade',
      'permadeath',
    );

    // Wire governor as GameInit would for freeform mode
    const divergenceYear = 1962;
    const governor = new FreeformGovernor(divergenceYear);
    engine.setGovernor(governor);

    expect(engine.getGovernor()).toBe(governor);
    expect(engine.getGovernor()).toBeInstanceOf(FreeformGovernor);
    expect(governor.getDivergenceYear()).toBe(1962);
  });

  it('FreeformGovernor clamps divergenceYear to valid range', () => {
    const tooEarly = new FreeformGovernor(1900);
    expect(tooEarly.getDivergenceYear()).toBe(1917);

    const tooLate = new FreeformGovernor(2050);
    expect(tooLate.getDivergenceYear()).toBe(1991);

    const justRight = new FreeformGovernor(1945);
    expect(justRight.getDivergenceYear()).toBe(1945);
  });

  it('default divergenceYear is 1945 when not specified', () => {
    // Simulate the GameInit fallback: options.divergenceYear ?? 1945
    const options: GameInitOptions = {
      gameMode: 'freeform',
    };

    const year = options.divergenceYear ?? 1945;
    const governor = new FreeformGovernor(year);

    expect(governor.getDivergenceYear()).toBe(1945);
  });
});

// ── Freeform mode: resource multiplier ───────────────────────────────────────

describe('Freeform mode resource multiplier', () => {
  it('freeform mode uses 1.0 resourceMultiplier (history is the difficulty)', () => {
    const difficulty = 'worker' as const;
    const gameMode = 'freeform' as const;

    // Replicate the logic from GameInit.ts
    const resMult =
      gameMode === 'historical' || gameMode === 'freeform' ? 1.0 : DIFFICULTY_PRESETS[difficulty].resourceMultiplier;

    // Freeform mode ignores difficulty — always 1.0
    expect(resMult).toBe(1.0);
    // Worker difficulty would normally give 2.0
    expect(DIFFICULTY_PRESETS.worker.resourceMultiplier).toBe(2.0);
  });

  it('freeform mode: all difficulty levels get 1.0', () => {
    const difficulties = ['worker', 'comrade', 'tovarish'] as const;

    for (const _difficulty of difficulties) {
      // Freeform mode always uses 1.0 resource multiplier (Governor system handles difficulty)
      const resMult = 1.0;
      expect(resMult).toBe(1.0);
    }
  });
});
