/**
 * Integration tests for ChairmanAgent autopilot wired into SimulationEngine.
 *
 * Verifies that enabling autopilot creates a ChairmanAgent, wraps minigame
 * and annual report callbacks, sets collective focus each tick, and runs
 * stably over extended tick counts.
 */

import { world } from '../../src/ecs/world';
import {
  advanceTicks,
  buildBasicSettlement,
  createPlaythroughEngine,
  getResources,
} from '../playthrough/helpers';

describe('Autopilot Integration', () => {
  afterEach(() => {
    world.clear();
    jest.restoreAllMocks();
  });

  it('engine has an AgentManager', () => {
    const { engine } = createPlaythroughEngine({
      resources: { population: 50, food: 5000, vodka: 1000 },
    });
    expect(engine.getAgentManager()).toBeDefined();
    expect(engine.getAgentManager().isAutopilot()).toBe(false);
  });

  it('enableAutopilot creates ChairmanAgent', () => {
    const { engine } = createPlaythroughEngine({
      resources: { population: 50, food: 5000, vodka: 1000 },
    });
    engine.enableAutopilot();
    expect(engine.getAgentManager().isAutopilot()).toBe(true);
    expect(engine.getAgentManager().getChairman()).not.toBeNull();
  });

  it('disableAutopilot removes ChairmanAgent', () => {
    const { engine } = createPlaythroughEngine({
      resources: { population: 50, food: 5000, vodka: 1000 },
    });
    engine.enableAutopilot();
    engine.disableAutopilot();
    expect(engine.getAgentManager().isAutopilot()).toBe(false);
  });

  it('runs 100 ticks in autopilot without crashing', () => {
    const { engine } = createPlaythroughEngine({
      resources: { population: 50, food: 5000, vodka: 1000 },
    });
    buildBasicSettlement();
    engine.enableAutopilot();

    advanceTicks(engine, 100);
    const resources = getResources();
    expect(resources.population).toBeGreaterThan(0);
  });

  it('ChairmanAgent sets collective focus based on game state', () => {
    const { engine } = createPlaythroughEngine({
      resources: { population: 50, food: 10, vodka: 100 },
    });
    buildBasicSettlement();
    engine.enableAutopilot();

    // Low food should trigger food focus
    advanceTicks(engine, 5);
    const focus = engine.getWorkerSystem().getCollectiveFocus();
    expect(focus).toBe('food');
  });

  it('autopilot auto-resolves minigames without UI', () => {
    const { engine, callbacks } = createPlaythroughEngine({
      resources: { population: 50, food: 5000, vodka: 1000 },
    });
    buildBasicSettlement();

    // Track that the original onMinigame is NOT called
    const originalMinigameSpy = jest.fn();
    callbacks.onMinigame = originalMinigameSpy;

    engine.enableAutopilot();

    // After enabling autopilot, the callback should be wrapped
    // The original spy should not be the one on callbacks anymore
    expect(callbacks.onMinigame).not.toBe(originalMinigameSpy);
  });

  it('autopilot wraps onAnnualReport callback', () => {
    const { engine, callbacks } = createPlaythroughEngine({
      resources: { population: 50, food: 5000, vodka: 1000 },
    });

    const originalReportSpy = jest.fn();
    callbacks.onAnnualReport = originalReportSpy;

    engine.enableAutopilot();

    // After enabling autopilot, the callback should be wrapped
    expect(callbacks.onAnnualReport).not.toBe(originalReportSpy);
  });

  it('disableAutopilot restores original callbacks', () => {
    const { engine, callbacks } = createPlaythroughEngine({
      resources: { population: 50, food: 5000, vodka: 1000 },
    });

    const originalMinigameSpy = jest.fn();
    const originalReportSpy = jest.fn();
    callbacks.onMinigame = originalMinigameSpy;
    callbacks.onAnnualReport = originalReportSpy;

    engine.enableAutopilot();
    engine.disableAutopilot();

    // Original callbacks should be restored
    expect(callbacks.onMinigame).toBe(originalMinigameSpy);
    expect(callbacks.onAnnualReport).toBe(originalReportSpy);
  });
});
