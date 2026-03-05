import { getMetaEntity, getResourceEntity } from '../../src/ecs/archetypes';
import { createBuilding, createMetaStore, createResourceStore } from '../../src/ecs/factories';
import { world } from '../../src/ecs/world';
import { TICKS_PER_YEAR } from '../../src/game/Chronology';
import { type SyncMetaDeps, syncSystemsToMeta } from '../../src/game/engine/phaseFinalize';
import { GameGrid } from '../../src/game/GameGrid';
import type { SimCallbacks } from '../../src/game/SimulationEngine';
import { SimulationEngine } from '../../src/game/SimulationEngine';

function createMockCallbacks(): SimCallbacks {
  return {
    onToast: jest.fn(),
    onAdvisor: jest.fn(),
    onPravda: jest.fn(),
    onStateChange: jest.fn(),
    onGameOver: jest.fn(),
    onGameTally: jest.fn(),
  };
}

describe('phaseFinalize', () => {
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

  it('calls onStateChange every tick', () => {
    engine.tick();
    expect(cb.onStateChange).toHaveBeenCalledTimes(1);
    engine.tick();
    expect(cb.onStateChange).toHaveBeenCalledTimes(2);
  });

  it('triggers endGame when population reaches 0 after first year', () => {
    createBuilding(0, 0, 'apartment-tower-a');
    // Advance past first year (TICKS_PER_YEAR + 1 ticks)
    // Mock endGame to prevent actual game-over side effects
    jest.spyOn(engine as any, 'endGame').mockImplementation(() => {});
    const store = getResourceEntity()!;
    store.resources.food = 10000;
    store.resources.vodka = 10000;
    for (let i = 0; i < TICKS_PER_YEAR + 1; i++) {
      store.resources.food = 10000;
      store.resources.vodka = 10000;
      engine.tick();
    }
    // Now set population to 0 and tick
    engine.getWorkerSystem().syncPopulation(0);
    engine.tick();
    expect((engine as any).endGame).toHaveBeenCalledWith(
      false,
      'All citizens have perished. The settlement is abandoned.',
    );
  });
});

describe('syncSystemsToMeta (standalone)', () => {
  beforeEach(() => {
    world.clear();
    createMetaStore();
  });

  afterEach(() => {
    world.clear();
  });

  it('writes quota, KGB, era, and settlement data to meta entity', () => {
    const deps: SyncMetaDeps = {
      quota: { type: 'vodka', target: 500, current: 250, deadlineYear: 1922 },
      kgb: { getBlackMarks: () => 3, getCommendations: () => 1, getThreatLevel: () => 'investigated' },
      political: { getCurrentEraId: () => 'collectivization' },
      settlement: { getCurrentTier: () => 'rabochiy-poselok' },
      transport: { getQuality: () => 'gravel', getCondition: () => 0.75 },
      politburo: { getGeneralSecretary: () => ({ name: 'Test Leader', personality: 'reformer' }) },
    };

    syncSystemsToMeta(deps);

    const meta = getMetaEntity()!;
    expect(meta.gameMeta.quota.type).toBe('vodka');
    expect(meta.gameMeta.quota.target).toBe(500);
    expect(meta.gameMeta.quota.current).toBe(250);
    expect(meta.gameMeta.blackMarks).toBe(3);
    expect(meta.gameMeta.commendations).toBe(1);
    expect(meta.gameMeta.threatLevel).toBe('investigated');
    expect(meta.gameMeta.currentEra).toBe('collectivization');
    expect(meta.gameMeta.settlementTier).toBe('rabochiy-poselok');
    expect(meta.gameMeta.leaderName).toBe('Test Leader');
    expect(meta.gameMeta.leaderPersonality).toBe('reformer');
    expect(meta.gameMeta.roadQuality).toBe('gravel');
    expect(meta.gameMeta.roadCondition).toBe(0.75);
  });

  it('does nothing when meta entity is missing', () => {
    world.clear(); // Remove meta entity
    const deps: SyncMetaDeps = {
      quota: { type: 'food', target: 400, current: 200, deadlineYear: 1922 },
      kgb: { getBlackMarks: () => 0, getCommendations: () => 0, getThreatLevel: () => 'clean' },
      political: { getCurrentEraId: () => 'revolution' },
      settlement: { getCurrentTier: () => 'selo' },
      transport: { getQuality: () => 'dirt', getCondition: () => 0.5 },
      politburo: { getGeneralSecretary: () => ({ name: 'Lenin', personality: 'revolutionary' }) },
    };
    // Should not throw
    expect(() => syncSystemsToMeta(deps)).not.toThrow();
  });
});
