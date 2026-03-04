import { getResourceEntity } from '../../src/ecs/archetypes';
import { createMetaStore, createResourceStore } from '../../src/ecs/factories';
import { world } from '../../src/ecs/world';
import { applyEventEffects } from '../../src/game/engine/eventEffects';
import type { GameEvent } from '../../src/ai/agents/narrative/events';
import type { WorkerSystem } from '../../src/ai/agents/workforce/WorkerSystem';

/** Create a minimal GameEvent with specified effects. */
function makeEvent(effects: Partial<GameEvent['effects']>): GameEvent {
  return {
    id: 'test_event',
    title: 'Test Event',
    description: 'A test event',
    severity: 'minor',
    effects: {
      money: 0,
      food: 0,
      vodka: 0,
      pop: 0,
      power: 0,
      ...effects,
    },
  } as GameEvent;
}

/** Create a mock WorkerSystem with spies. */
function createMockWorkerSystem(): WorkerSystem {
  return {
    spawnInflowDvor: jest.fn(),
    removeWorkersByCount: jest.fn(),
  } as unknown as WorkerSystem;
}

describe('applyEventEffects', () => {
  beforeEach(() => {
    world.clear();
    createResourceStore();
    createMetaStore();
  });

  afterEach(() => {
    world.clear();
  });

  it('applies money effect to resource store', () => {
    const store = getResourceEntity()!;
    store.resources.money = 100;
    const workers = createMockWorkerSystem();

    applyEventEffects(makeEvent({ money: 50 }), workers);
    expect(store.resources.money).toBe(150);
  });

  it('applies food effect to resource store', () => {
    const store = getResourceEntity()!;
    store.resources.food = 200;
    const workers = createMockWorkerSystem();

    applyEventEffects(makeEvent({ food: -50 }), workers);
    expect(store.resources.food).toBe(150);
  });

  it('applies vodka effect to resource store', () => {
    const store = getResourceEntity()!;
    store.resources.vodka = 30;
    const workers = createMockWorkerSystem();

    applyEventEffects(makeEvent({ vodka: 20 }), workers);
    expect(store.resources.vodka).toBe(50);
  });

  it('applies power effect to resource store', () => {
    const store = getResourceEntity()!;
    store.resources.power = 50;
    const workers = createMockWorkerSystem();

    applyEventEffects(makeEvent({ power: 25 }), workers);
    expect(store.resources.power).toBe(75);
  });

  it('spawns workers for positive pop effect', () => {
    const workers = createMockWorkerSystem();
    applyEventEffects(makeEvent({ pop: 10 }), workers);
    expect(workers.spawnInflowDvor).toHaveBeenCalledWith(10, 'event');
  });

  it('removes workers for negative pop effect', () => {
    const workers = createMockWorkerSystem();
    applyEventEffects(makeEvent({ pop: -5 }), workers);
    expect(workers.removeWorkersByCount).toHaveBeenCalledWith(5, 'event');
  });

  it('clamps resources to zero (no negative money)', () => {
    const store = getResourceEntity()!;
    store.resources.money = 10;
    const workers = createMockWorkerSystem();

    applyEventEffects(makeEvent({ money: -100 }), workers);
    expect(store.resources.money).toBe(0);
  });

  it('handles missing resource store gracefully', () => {
    world.clear(); // Remove all entities including resource store
    const workers = createMockWorkerSystem();
    // Should not throw
    expect(() => applyEventEffects(makeEvent({ food: 50 }), workers)).not.toThrow();
  });
});
