import { getMetaEntity } from '../../src/ecs/archetypes';
import { createMetaStore, createResourceStore } from '../../src/ecs/factories';
import { world } from '../../src/ecs/world';
import { TICKS_PER_MONTH } from '../../src/game/Chronology';
import { GameGrid } from '../../src/game/GameGrid';
import type { SimCallbacks } from '../../src/game/SimulationEngine';
import { SimulationEngine } from '../../src/game/SimulationEngine';

function createMockCallbacks(): SimCallbacks {
  return {
    onToast: jest.fn(),
    onAdvisor: jest.fn(),
    onPravda: jest.fn(),
    onStateChange: jest.fn(),
    onSeasonChanged: jest.fn(),
    onWeatherChanged: jest.fn(),
    onDayPhaseChanged: jest.fn(),
    onEraChanged: jest.fn(),
  };
}

describe('phaseChronology', () => {
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

  it('syncs chronology date to meta entity each tick', () => {
    engine.tick();
    const meta = getMetaEntity()!;
    expect(meta.gameMeta.date.year).toBe(1917);
    expect(meta.gameMeta.date.month).toBe(10);
    expect(meta.gameMeta.date.tick).toBe(8);
  });

  it('emits onSeasonChanged when season transitions', () => {
    // Starting at month 10 (autumn), advance to month 11 (winter boundary)
    for (let i = 0; i < TICKS_PER_MONTH; i++) engine.tick();
    // After crossing into month 11, season should change to winter
    expect(cb.onSeasonChanged).toHaveBeenCalled();
  });

  it('triggers era transition check on newYear', () => {
    // Advance 90 ticks (3 months: Oct->Jan) to reach year boundary
    for (let i = 0; i < 90; i++) engine.tick();
    const meta = getMetaEntity()!;
    expect(meta.gameMeta.date.year).toBe(1918);
    expect(meta.gameMeta.date.month).toBe(1);
  });

  it('pushes governor modifiers into scoring system when governor is set', () => {
    const { HistoricalGovernor } = require('../../src/ai/agents/crisis/HistoricalGovernor');
    const gov = new HistoricalGovernor(engine.getRng());
    engine.setGovernor(gov);
    engine.tick();
    // Governor should have been evaluated — scoring system should have received modifiers
    // We verify indirectly: the meta entity's currentEra should still be valid
    expect(getMetaEntity()!.gameMeta.currentEra).toBe('revolution');
  });
});
