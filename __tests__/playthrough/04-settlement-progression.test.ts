import { getMetaEntity } from '../../src/ecs/archetypes';
import { createBuilding } from '../../src/ecs/factories';
import { world } from '../../src/ecs/world';
import { advanceTicks, createPlaythroughEngine } from './helpers';

describe('Playthrough: Settlement Progression', () => {
  afterEach(() => {
    world.clear();
    jest.restoreAllMocks();
  });

  // ── Scenario 1: Settlement starts as selo ──────────────────────────────────

  it('new settlement defaults to selo tier', () => {
    const { engine } = createPlaythroughEngine();

    expect(engine.getSettlement().getCurrentTier()).toBe('selo');

    const meta = getMetaEntity();
    expect(meta).toBeDefined();
    expect(meta!.gameMeta.settlementTier).toBe('selo');
  });

  // ── Scenario 2: Upgrade to posyolok ────────────────────────────────────────

  it('upgrades to posyolok with population, industry, and sustained ticks', () => {
    const { engine, callbacks } = createPlaythroughEngine({
      resources: { population: 80, food: 9999, vodka: 9999, money: 9999 },
    });

    // Place buildings: power + housing + industry (factory-office)
    createBuilding(0, 0, 'power-station');
    createBuilding(2, 0, 'apartment-tower-a');
    createBuilding(4, 0, 'factory-office');

    // posyolok requires 30 consecutive upgrade ticks
    // Tick generously to account for population fluctuations
    advanceTicks(engine, 50);

    expect(engine.getSettlement().getCurrentTier()).toBe('posyolok');
    expect(callbacks.onSettlementChange).toHaveBeenCalled();

    // Verify the event shape
    const event = callbacks.onSettlementChange.mock.calls[0]![0];
    expect(event.type).toBe('upgrade');
    expect(event.fromTier).toBe('selo');
    expect(event.toTier).toBe('posyolok');
  });

  // ── Scenario 3: Downgrade on population loss ──────────────────────────────

  it('downgrades from posyolok to selo when population drops below threshold', () => {
    const { engine, callbacks } = createPlaythroughEngine({
      resources: { population: 80, food: 9999, vodka: 9999, money: 9999 },
    });

    // Place buildings to achieve posyolok
    createBuilding(0, 0, 'power-station');
    createBuilding(2, 0, 'apartment-tower-a');
    createBuilding(4, 0, 'factory-office');

    // Achieve posyolok tier first
    advanceTicks(engine, 50);
    expect(engine.getSettlement().getCurrentTier()).toBe('posyolok');

    // Clear the settlement change mock to track downgrade events
    callbacks.onSettlementChange.mockClear();
    callbacks.onAdvisor.mockClear();
    callbacks.onToast.mockClear();

    // Drop population drastically via WorkerSystem
    engine.getWorkerSystem().syncPopulation(5);

    // Downgrade requires 60 consecutive ticks below population threshold
    // Keep draining population each iteration to fight population growth
    for (let i = 0; i < 80; i++) {
      engine.tick();
      // Re-sync population to stay below threshold every few ticks
      if (i % 5 === 0) {
        engine.getWorkerSystem().syncPopulation(5);
      }
    }

    expect(engine.getSettlement().getCurrentTier()).toBe('selo');

    // Downgrades fire onAdvisor + onToast (NOT onSettlementChange)
    expect(callbacks.onAdvisor).toHaveBeenCalled();
    expect(callbacks.onToast).toHaveBeenCalledWith(expect.stringContaining('DOWNGRADED'), 'critical');
  });

  // ── Scenario 4: Settlement tier persists in gameMeta ───────────────────────

  it('settlement tier syncs to gameMeta after upgrade', () => {
    const { engine } = createPlaythroughEngine({
      resources: { population: 80, food: 9999, vodka: 9999, money: 9999 },
    });

    // Place buildings for posyolok
    createBuilding(0, 0, 'power-station');
    createBuilding(2, 0, 'apartment-tower-a');
    createBuilding(4, 0, 'factory-office');

    // Tick past upgrade threshold
    advanceTicks(engine, 50);

    expect(engine.getSettlement().getCurrentTier()).toBe('posyolok');

    const meta = getMetaEntity();
    expect(meta).toBeDefined();
    expect(meta!.gameMeta.settlementTier).toBe('posyolok');
  });
});
