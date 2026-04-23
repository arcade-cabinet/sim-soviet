/**
 * @fileoverview Tests for Governor wiring in GameInit + NewGameSetup.
 *
 * Validates that the reduced 1.0 flow wires the historical governor and
 * exposes a single historical campaign config.
 */

import { HistoricalGovernor } from '@/ai/agents/crisis/HistoricalGovernor';
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

describe('GameInit governor wiring', () => {
  it('historical mode: HistoricalGovernor set on engine', () => {
    const engine = new SimulationEngine(
      makeMockGrid(),
      makeMockCallbacks(),
      new GameRng('historical-test'),
      'comrade',
      'rasstrelyat',
    );

    // Wire governor as GameInit would
    const governor = new HistoricalGovernor();
    engine.setGovernor(governor);

    expect(engine.getGovernor()).toBe(governor);
    expect(engine.getGovernor()).toBeInstanceOf(HistoricalGovernor);
  });

  it('setGovernor always leaves engine in historical mode', () => {
    const engine = new SimulationEngine(
      makeMockGrid(),
      makeMockCallbacks(),
      new GameRng('historical-only-test'),
      'comrade',
      'rasstrelyat',
    );
    engine.setGovernor(new HistoricalGovernor());
    expect(engine.getGovernor()?.serialize().mode).toBe('historical');
  });
});

// ── NewGameConfig type ───────────────────────────────────────────────────────

describe('NewGameConfig', () => {
  it('contains only historical campaign start options', () => {
    const config: NewGameConfig = {
      consequence: 'rasstrelyat',
      seed: 'test-seed',
    };

    expect(config.consequence).toBe('rasstrelyat');
    expect(config.seed).toBe('test-seed');
    expect('gameMode' in config).toBe(false);
  });
});
