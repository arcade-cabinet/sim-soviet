import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getResourceEntity } from '../ecs/archetypes';
import { createMetaStore, createResourceStore } from '../ecs/factories';
import { world } from '../ecs/world';
import { EventSystem, type GameEvent } from '../game/events';
import { GameRng } from '../game/SeedSystem';

describe('EventSystem serialization', () => {
  let firedEvents: GameEvent[];
  let onEvent: (event: GameEvent) => void;

  beforeEach(() => {
    world.clear();
    createResourceStore();
    createMetaStore();
    firedEvents = [];
    onEvent = (event) => firedEvents.push(event);
  });

  afterEach(() => {
    world.clear();
  });

  it('round-trips a fresh EventSystem', () => {
    const original = new EventSystem(onEvent);
    const data = original.serialize();
    const restored = EventSystem.deserialize(data, onEvent);

    expect(restored.getLastEvent()).toBeNull();
    expect(restored.getRecentEvents(5)).toEqual([]);
  });

  it('preserves lastEventTick', () => {
    const original = new EventSystem(onEvent);

    // Force an event to set lastEventTick
    original.triggerEvent('earthquake_bread');

    // Tick at 65 to update lastEventTick via the tick path (cooldown is 60)
    vi.spyOn(Math, 'random').mockReturnValue(0.01);
    original.tick(65);

    const data = original.serialize();
    expect(data.lastEventTick).toBe(65);

    const restored = EventSystem.deserialize(data, onEvent);
    const restoredData = restored.serialize();
    expect(restoredData.lastEventTick).toBe(65);
  });

  it('preserves event history through round-trip', () => {
    const original = new EventSystem(onEvent);

    original.triggerEvent('earthquake_bread');
    original.triggerEvent('cultural_palace_fire');
    original.triggerEvent('kgb_inspection');

    const data = original.serialize();
    firedEvents = [];
    const restored = EventSystem.deserialize(data, onEvent);

    const recent = restored.getRecentEvents(10);
    expect(recent).toHaveLength(3);
    expect(recent[0]!.id).toBe('earthquake_bread');
    expect(recent[1]!.id).toBe('cultural_palace_fire');
    expect(recent[2]!.id).toBe('kgb_inspection');
  });

  it('preserves recentEventIds for dedup', () => {
    const original = new EventSystem(onEvent);

    original.triggerEvent('earthquake_bread');
    original.triggerEvent('cultural_palace_fire');

    const data = original.serialize();
    expect(data.recentEventIds).toContain('earthquake_bread');
    expect(data.recentEventIds).toContain('cultural_palace_fire');

    const restored = EventSystem.deserialize(data, onEvent);
    const restoredData = restored.serialize();
    expect(restoredData.recentEventIds).toEqual(data.recentEventIds);
  });

  it('deserialized system respects cooldown from saved lastEventTick', () => {
    const original = new EventSystem(onEvent);

    // Trigger an event at tick 65 via the tick path (cooldown is 60)
    vi.spyOn(Math, 'random').mockReturnValue(0.01);
    original.tick(65);

    const data = original.serialize();
    firedEvents = [];
    const restored = EventSystem.deserialize(data, onEvent);

    // Tick at 80 — only 15 ticks since last event at 65, cooldown is 60
    restored.tick(80);
    expect(firedEvents).toHaveLength(0);

    // Tick at 130 — 65 ticks since last event, past cooldown
    restored.tick(130);
    // Should have tried to fire (might not if random doesn't produce eligible event)
    // But at minimum it should not throw
  });

  it('deserialized system can tick and fire events', () => {
    const original = new EventSystem(onEvent);
    const data = original.serialize();

    firedEvents = [];
    const restored = EventSystem.deserialize(data, onEvent);

    // Force trigger after deserialization
    restored.triggerEvent('hero_award');
    expect(firedEvents).toHaveLength(1);
    expect(firedEvents[0]!.id).toBe('hero_award');

    // Effects should apply
    const money = getResourceEntity()!.resources.money;
    expect(money).toBeGreaterThan(0);
  });

  it('preserves event effects in history', () => {
    const original = new EventSystem(onEvent);
    original.triggerEvent('earthquake_bread');

    const data = original.serialize();
    const restored = EventSystem.deserialize(data, onEvent);

    const last = restored.getLastEvent();
    expect(last!.effects).toEqual({ food: -15 });
  });

  it('serialized data is plain JSON', () => {
    const original = new EventSystem(onEvent);
    original.triggerEvent('earthquake_bread');
    original.triggerEvent('hero_award');

    const data = original.serialize();
    const json = JSON.stringify(data);
    const parsed = JSON.parse(json);

    const restored = EventSystem.deserialize(parsed, onEvent);
    expect(restored.getRecentEvents(5)).toHaveLength(2);
    expect(restored.getLastEvent()!.id).toBe('hero_award');
  });

  it('works with GameRng for deterministic deserialization', () => {
    const rng = new GameRng('event-serial');
    const original = new EventSystem(onEvent, rng);

    original.triggerEvent('earthquake_bread');
    const data = original.serialize();

    const restored = EventSystem.deserialize(data, onEvent, new GameRng('event-serial-2'));
    expect(restored.getLastEvent()!.id).toBe('earthquake_bread');
  });
});
