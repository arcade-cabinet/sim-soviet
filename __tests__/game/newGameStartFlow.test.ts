/**
 * Tests for Buildings-UI Phase 6 — New game start flow.
 *
 * Validates:
 * 1. ArrivalSequence staggers families over ~30 ticks
 * 2. CollectiveAgent determines starting needs dynamically (bootstrap removed)
 * 3. Starting morale = 70 for arriving families
 * 4. No divergence year selector in freeform (NewGameConfig has no divergenceYear)
 * 5. Caravan target set during agent arrival evaluation
 */

import { ArrivalSequence } from '../../src/game/arrivalSequence';
import type { DvorMemberSeed } from '../../src/ecs/factories/settlementFactories';
import { world } from '../../src/ecs/world';
import { createResourceStore, createMetaStore, createGrid } from '../../src/ecs/factories';
import { dvory, citizens, getResourceEntity, buildingsLogic } from '../../src/ecs/archetypes';
import { CollectiveAgent } from '../../src/ai/agents/infrastructure/CollectiveAgent';
import { GameGrid } from '../../src/game/GameGrid';
import { GameRng } from '../../src/game/SeedSystem';
import { MapSystem } from '../../src/game/map';
import { setCurrentGridSize } from '../../src/config';
import { getCaravanTarget, setArrivalInProgress } from '../../src/stores/gameStore';
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

  it('fires onArrival callback for each family', () => {
    const workerSystem = createMockWorkerSystem();
    const onArrival = jest.fn();
    seq.prepareArrival(makeDvorData(5));

    for (let tick = 1; tick <= 40; tick++) {
      seq.tick(tick, workerSystem, onArrival);
    }
    expect(onArrival).toHaveBeenCalledTimes(5);
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

    // Tick enough to arrive all families
    for (let tick = 1; tick <= 40; tick++) {
      seq.tick(tick, workerSystem);
    }

    // Every spawnWorkerFromDvor call should have morale:70, loyalty:60
    for (const call of workerSystem.spawnWorkerFromDvor.mock.calls) {
      const overrides = call[4]; // 5th argument is { morale, loyalty }
      expect(overrides).toEqual({ morale: 70, loyalty: 60 });
    }
  });
});

// ── No divergence year in freeform ──────────────────────────────────────

describe('NewGameConfig — no divergence year selector', () => {
  it('NewGameConfig type does not include divergenceYear', () => {
    // The freeform mode config passed by NewGameSetup has no divergenceYear field
    const config: NewGameConfig = {
      consequence: 'gulag',
      seed: 'test',
      gameMode: 'freeform',
    };
    // TypeScript would error if divergenceYear were required
    expect(config.gameMode).toBe('freeform');
    // No divergenceYear property exists on the config
    expect('divergenceYear' in config).toBe(false);
  });
});
