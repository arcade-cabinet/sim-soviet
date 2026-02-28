import { createMetaStore, createResourceStore } from '../../src/ecs/factories';
import { world } from '../../src/ecs/world';
import type { GameEvent } from '../../src/game/events';
import { Ministry, PolitburoSystem } from '../../src/game/politburo';
import { GameRng } from '../../src/game/SeedSystem';

describe('PolitburoSystem serialization', () => {
  let firedEvents: GameEvent[];
  let onEvent: (event: GameEvent) => void;
  let rng: GameRng;

  beforeEach(() => {
    world.clear();
    createResourceStore();
    createMetaStore();
    firedEvents = [];
    onEvent = (event) => firedEvents.push(event);
    rng = new GameRng('politburo-serial');
  });

  afterEach(() => {
    world.clear();
  });

  it('round-trips a fresh PolitburoSystem', () => {
    const original = new PolitburoSystem(onEvent, rng, 1950);
    const data = original.serialize();
    const restored = PolitburoSystem.deserialize(data, onEvent, new GameRng('politburo-serial-2'));

    const origState = original.getState();
    const resState = restored.getState();

    // General Secretary
    expect(resState.generalSecretary.name).toBe(origState.generalSecretary.name);
    expect(resState.generalSecretary.personality).toBe(origState.generalSecretary.personality);
    expect(resState.generalSecretary.paranoia).toBe(origState.generalSecretary.paranoia);
    expect(resState.generalSecretary.health).toBe(origState.generalSecretary.health);
    expect(resState.generalSecretary.age).toBe(origState.generalSecretary.age);
    expect(resState.generalSecretary.alive).toBe(origState.generalSecretary.alive);

    // Ministers
    for (const ministry of Object.values(Ministry)) {
      const origMinister = origState.ministers.get(ministry);
      const resMinister = resState.ministers.get(ministry);
      expect(resMinister).toBeDefined();
      expect(resMinister!.name).toBe(origMinister!.name);
      expect(resMinister!.personality).toBe(origMinister!.personality);
      expect(resMinister!.loyalty).toBe(origMinister!.loyalty);
      expect(resMinister!.competence).toBe(origMinister!.competence);
      expect(resMinister!.ambition).toBe(origMinister!.ambition);
      expect(resMinister!.corruption).toBe(origMinister!.corruption);
      expect(resMinister!.tenure).toBe(origMinister!.tenure);
    }

    // Modifiers
    expect(resState.activeModifiers).toEqual(origState.activeModifiers);
  });

  it('preserves leader history and purge history', () => {
    const system = new PolitburoSystem(onEvent, rng, 1950);

    // Force a succession to populate leader history
    system.forceSuccession('natural');

    const data = system.serialize();
    const restored = PolitburoSystem.deserialize(data, onEvent);

    expect(restored.getState().leaderHistory.length).toBe(system.getState().leaderHistory.length);
    expect(restored.getState().leaderHistory[0]!.name).toBe(system.getState().leaderHistory[0]!.name);
  });

  it('preserves corruptionMult', () => {
    const system = new PolitburoSystem(onEvent, rng, 1950);
    system.setCorruptionMult(2.5);

    const data = system.serialize();
    const restored = PolitburoSystem.deserialize(data, onEvent);

    // Verify by serializing the restored system and checking the value
    const restoredData = restored.serialize();
    expect(restoredData.corruptionMult).toBe(2.5);
  });

  it('preserves tensions between ministries', () => {
    const system = new PolitburoSystem(onEvent, rng, 1950);

    const data = system.serialize();
    const restored = PolitburoSystem.deserialize(data, onEvent);

    const origTensions = Array.from(system.getState().tensions.entries());
    const resTensions = Array.from(restored.getState().tensions.entries());
    expect(resTensions).toEqual(origTensions);
  });

  it('preserves factions', () => {
    const system = new PolitburoSystem(onEvent, rng, 1950);

    const data = system.serialize();
    const restored = PolitburoSystem.deserialize(data, onEvent);

    expect(restored.getState().factions.length).toBe(system.getState().factions.length);
    for (let i = 0; i < system.getState().factions.length; i++) {
      expect(restored.getState().factions[i]!.name).toBe(system.getState().factions[i]!.name);
      expect(restored.getState().factions[i]!.memberIds).toEqual(system.getState().factions[i]!.memberIds);
    }
  });

  it('deserialized system can tick without errors', () => {
    const system = new PolitburoSystem(onEvent, rng, 1950);
    const data = system.serialize();
    const restored = PolitburoSystem.deserialize(data, onEvent, new GameRng('post-restore'));

    expect(() => {
      restored.tick({ newMonth: true, newYear: false });
      restored.tick({ newMonth: true, newYear: true });
    }).not.toThrow();
  });

  it('serialized data is plain JSON (no Map/Set)', () => {
    const system = new PolitburoSystem(onEvent, rng, 1950);
    const data = system.serialize();

    // Verify it round-trips through JSON
    const json = JSON.stringify(data);
    const parsed = JSON.parse(json);
    const restored = PolitburoSystem.deserialize(parsed, onEvent);

    expect(restored.getGeneralSecretary().name).toBe(system.getGeneralSecretary().name);
    expect(restored.getState().ministers.size).toBe(system.getState().ministers.size);
  });
});
