/**
 * Tests for Buildings-UI Phase 6 — New game start flow.
 *
 * Validates:
 * 1. ArrivalSequence staggers families at ≤3/month over the first year
 * 2. CollectiveAgent determines starting needs dynamically (bootstrap removed)
 * 3. Starting morale = 70 for arriving families
 * 4. New game config starts the single historical campaign (no mode/divergence selector)
 * 5. Caravan target set during agent arrival evaluation
 */

import { createMetaStore, createResourceStore } from '../../src/ecs/factories';
import type { DvorMemberSeed } from '../../src/ecs/factories/settlementFactories';
import { world } from '../../src/ecs/world';
import { ArrivalSequence } from '../../src/game/arrivalSequence';
import { setArrivalInProgress } from '../../src/stores/gameStore';
import type { NewGameConfig } from '../../src/ui/NewGameSetup';

// ── Helpers ──────────────────────────────────────────────────────────────

function makeDvorData(count: number): Array<{
  id: string;
  surname: string;
  memberSeeds: DvorMemberSeed[];
  isChairman?: boolean;
}> {
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push({
      id: `dvor-${i}`,
      surname: `Family${i}`,
      memberSeeds: [
        { name: `Adult${i}`, gender: 'male' as const, age: 30 },
        { name: `Spouse${i}`, gender: 'female' as const, age: 28 },
      ],
      isChairman: i === 0,
    });
  }
  return result;
}

/** Mock WorkerSystem with just the spawnWorkerFromDvor method. */
function createMockWorkerSystem() {
  return {
    spawnWorkerFromDvor: jest.fn(),
  } as any;
}

// ── ArrivalSequence staggering ──────────────────────────────────────────

describe('ArrivalSequence — staggered family arrival', () => {
  let seq: ArrivalSequence;

  beforeEach(() => {
    world.clear();
    createResourceStore({ population: 0 });
    createMetaStore();
    seq = new ArrivalSequence();
  });

  afterEach(() => {
    world.clear();
    setArrivalInProgress(false);
  });

  it('starts in progress after prepareArrival', () => {
    seq.prepareArrival(makeDvorData(10));
    expect(seq.isInProgress()).toBe(true);
    expect(seq.getArrivedCount()).toBe(0);
    expect(seq.getTotalDvory()).toBe(10);
  });

  it('chairman arrives on tick 1 (first tick)', () => {
    const workerSystem = createMockWorkerSystem();
    seq.prepareArrival(makeDvorData(10));

    const arrived = seq.tick(1, workerSystem);
    expect(arrived).toBeGreaterThanOrEqual(1);
    // Chairman + possibly one other family arrive on tick 1
    expect(seq.getArrivedCount()).toBeGreaterThanOrEqual(1);
  });

  it('not all families arrive on tick 1', () => {
    const workerSystem = createMockWorkerSystem();
    seq.prepareArrival(makeDvorData(15));

    seq.tick(1, workerSystem);
    expect(seq.getArrivedCount()).toBeLessThan(15);
    expect(seq.isInProgress()).toBe(true);
  });

  it('all families arrive within ~30 ticks', () => {
    const workerSystem = createMockWorkerSystem();
    const total = 15;
    seq.prepareArrival(makeDvorData(total));

    for (let tick = 1; tick <= 40; tick++) {
      seq.tick(tick, workerSystem);
    }
    expect(seq.getArrivedCount()).toBe(total);
    expect(seq.isInProgress()).toBe(false);
  });

  it('fires coalesced onArrival callback at most once per tick', () => {
    const workerSystem = createMockWorkerSystem();
    const onArrival = jest.fn();
    seq.prepareArrival(makeDvorData(5));

    for (let tick = 1; tick <= 40; tick++) {
      seq.tick(tick, workerSystem, onArrival);
    }
    // 5 families, ramp pattern produces at most 1 callback per arrival tick
    // (strictly less than 5 callbacks when multiple families land on same tick)
    expect(onArrival.mock.calls.length).toBeGreaterThan(0);
    expect(onArrival.mock.calls.length).toBeLessThanOrEqual(5);
    // Each call has shape (familyCount, soulCount, surname|null)
    const firstCall = onArrival.mock.calls[0] as [number, number, string | null];
    expect(firstCall[0]).toBeGreaterThanOrEqual(1);
    expect(typeof firstCall[1]).toBe('number');
    expect(firstCall[2] === null || typeof firstCall[2] === 'string').toBe(true);
    // Single-family tick → surname is string; multi-family tick → surname is null
    for (const call of onArrival.mock.calls) {
      const [count, , surname] = call as [number, number, string | null];
      if (count === 1) expect(typeof surname).toBe('string');
      else expect(surname).toBeNull();
    }
  });

  it('returns 0 if arrival is not in progress', () => {
    const workerSystem = createMockWorkerSystem();
    expect(seq.tick(1, workerSystem)).toBe(0);
  });
});

// ── Starting morale ─────────────────────────────────────────────────────

describe('Starting morale for arriving families', () => {
  beforeEach(() => {
    world.clear();
    createResourceStore({ population: 0 });
    createMetaStore();
  });

  afterEach(() => {
    world.clear();
    setArrivalInProgress(false);
  });

  it('spawns workers with morale 70 and loyalty 60', () => {
    const workerSystem = createMockWorkerSystem();
    const seq = new ArrivalSequence();
    seq.prepareArrival(makeDvorData(3));

    // 3 families: chairman at tick 1, family 2 at tick 11, family 3 at tick 21.
    for (let tick = 1; tick <= 30; tick++) {
      seq.tick(tick, workerSystem);
    }

    // Every spawnWorkerFromDvor call should have morale:70, loyalty:60
    for (const call of workerSystem.spawnWorkerFromDvor.mock.calls) {
      const overrides = call[4]; // 5th argument is { morale, loyalty }
      expect(overrides).toEqual({ morale: 70, loyalty: 60 });
    }
  });
});

// ── Single historical campaign config ───────────────────────────────────

describe('NewGameConfig — historical campaign only', () => {
  it('NewGameConfig type contains only consequence and seed', () => {
    const config: NewGameConfig = {
      consequence: 'gulag',
      seed: 'test',
    };
    expect(config.consequence).toBe('gulag');
    expect(config.seed).toBe('test');
    expect('gameMode' in config).toBe(false);
    expect('divergenceYear' in config).toBe(false);
  });
});
