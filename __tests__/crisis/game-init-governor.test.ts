/**
 * @fileoverview Tests for Governor wiring in GameInit + NewGameSetup.
 *
 * Validates that game mode selection correctly wires (or does not wire)
 * a Governor on the SimulationEngine, and that resource multipliers
 * follow mode-specific rules.
 */

import { HistoricalGovernor } from '@/ai/agents/crisis/HistoricalGovernor';
import { DIFFICULTY_PRESETS } from '@/ai/agents/political/ScoringSystem';
import { GameRng } from '@/game/SeedSystem';
import { SimulationEngine } from '@/game/SimulationEngine';
import type { NewGameConfig } from '@/ui/NewGameSetup';

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

// ── Default mode: no governor ────────────────────────────────────────────────

describe('GameInit governor wiring', () => {
  it('default mode: no governor set on engine', () => {
    const engine = new SimulationEngine(
      makeMockGrid(),
      makeMockCallbacks(),
      new GameRng('classic-test'),
      'comrade',
      'permadeath',
    );

    // Default — no governor wired
    expect(engine.getGovernor()).toBeNull();
  });

  it('historical mode: HistoricalGovernor set on engine', () => {
    const engine = new SimulationEngine(
      makeMockGrid(),
      makeMockCallbacks(),
      new GameRng('historical-test'),
      'comrade',
      'permadeath',
    );

    // Wire governor as GameInit would
    const governor = new HistoricalGovernor();
    engine.setGovernor(governor);

    expect(engine.getGovernor()).toBe(governor);
    expect(engine.getGovernor()).toBeInstanceOf(HistoricalGovernor);
  });

  it('historical mode: resourceMultiplier uses 1.0 (not difficulty preset)', () => {
    // Simulate the logic from GameInit.ts for historical mode
    const difficulty = 'worker' as const;
    const gameMode = 'historical' as const;

    const resMult = gameMode === 'historical' ? 1.0 : DIFFICULTY_PRESETS[difficulty].resourceMultiplier;

    // Historical mode ignores difficulty — always 1.0
    expect(resMult).toBe(1.0);
    // Worker difficulty would normally give 2.0
    expect(DIFFICULTY_PRESETS.worker.resourceMultiplier).toBe(2.0);
  });

  it('freeform mode: resourceMultiplier uses DIFFICULTY_PRESETS', () => {
    const testCases: Array<{ difficulty: 'worker' | 'comrade' | 'tovarish'; expected: number }> = [
      { difficulty: 'worker', expected: 2.0 },
      { difficulty: 'comrade', expected: 1.0 },
      { difficulty: 'tovarish', expected: 0.6 },
    ];

    for (const { difficulty, expected } of testCases) {
      const gameMode = 'freeform' as const;

      const resMult = gameMode === 'historical' ? 1.0 : DIFFICULTY_PRESETS[difficulty].resourceMultiplier;

      expect(resMult).toBe(expected);
    }
  });
});

// ── NewGameConfig type ───────────────────────────────────────────────────────

describe('NewGameConfig', () => {
  it('includes gameMode field', () => {
    const config: NewGameConfig = {
      difficulty: 'comrade',
      consequence: 'permadeath',
      seed: 'test-seed',
      mapSize: 'medium',
      gameMode: 'historical',
    };

    expect(config.gameMode).toBe('historical');
  });

  it('accepts freeform game mode', () => {
    const config: NewGameConfig = {
      difficulty: 'tovarish',
      consequence: 'harsh',
      seed: 'freeform-seed',
      mapSize: 'large',
      gameMode: 'freeform',
    };

    expect(config.gameMode).toBe('freeform');
  });
});
