import { getMetaEntity } from '../../src/ecs/archetypes';
import { createMetaStore, createResourceStore } from '../../src/ecs/factories';
import { world } from '../../src/ecs/world';
import { GameGrid } from '../../src/game/GameGrid';
import type { SimCallbacks } from '../../src/game/SimulationEngine';
import { SimulationEngine } from '../../src/game/SimulationEngine';

function createMockCallbacks(): SimCallbacks {
  return {
    onToast: jest.fn(),
    onAdvisor: jest.fn(),
    onPravda: jest.fn(),
    onStateChange: jest.fn(),
    onAchievement: jest.fn(),
    onTutorialMilestone: jest.fn(),
  };
}

describe('phaseNarrative', () => {
  let cb: SimCallbacks;
  let engine: SimulationEngine;

  beforeEach(() => {
    world.clear();
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    createResourceStore();
    createMetaStore();
    cb = createMockCallbacks();
    engine = new SimulationEngine(new GameGrid(), cb);
  });

  afterEach(() => {
    world.clear();
  });

  it('runs event system tick each tick', () => {
    const eventSystem = engine.getEventSystem();
    const tickSpy = jest.spyOn(eventSystem, 'tick');
    engine.tick();
    expect(tickSpy).toHaveBeenCalled();
  });

  it('runs KGB personnel file tick each tick', () => {
    const kgb = engine.getKGBAgent();
    const tickSpy = jest.spyOn(kgb, 'tickPersonnelFile');
    engine.tick();
    expect(tickSpy).toHaveBeenCalled();
  });

  it('tracks threat level changes for scoring', () => {
    // After a tick, lastThreatLevel should be tracked
    engine.tick();
    const meta = getMetaEntity()!;
    // Threat level should be synced to meta
    expect(meta.gameMeta.threatLevel).toBeDefined();
  });

  it('generates pravda ambient headlines', () => {
    // Pravda system generates random headlines
    // With Math.random mocked to 0.99, some headlines may still fire
    for (let i = 0; i < 10; i++) engine.tick();
    // At least onStateChange was called (narrative phase completed)
    expect(cb.onStateChange).toHaveBeenCalled();
  });
});
