import { citizens } from '@/ecs/archetypes';
import { createBuilding, createMetaStore, createResourceStore } from '@/ecs/factories';
import { world } from '@/ecs/world';
import { GameRng } from '@/game/SeedSystem';
import type { WorkerTickContext } from '@/game/workers';
import { WorkerSystem } from '@/game/workers';

/** Build a default tick context with overrides. */
function makeCtx(overrides: Partial<WorkerTickContext> = {}): WorkerTickContext {
  return {
    vodkaAvailable: 100,
    foodAvailable: 1000,
    heatingFailing: false,
    month: 6,
    eraId: 'revolution',
    totalTicks: 0,
    ...overrides,
  };
}

describe('WorkerSystem — Population Drains via tick()', () => {
  let system: WorkerSystem;
  let rng: GameRng;

  beforeEach(() => {
    world.clear();
    createResourceStore({ food: 1000, population: 10 });
    createMetaStore();
    rng = new GameRng('test-pop-dynamics');
    system = new WorkerSystem(rng);
  });

  afterEach(() => {
    world.clear();
  });

  // ── Migration flight ─────────────────────────────────────

  describe('migration flight (low morale)', () => {
    it('drains workers when collective morale is very low', () => {
      system.syncPopulation(30);
      // Set all workers to very low morale (below FLIGHT_MORALE_THRESHOLD of 30)
      for (const s of system.getStatsMap().values()) {
        (s as { morale: number }).morale = 10;
      }

      let totalDrains = 0;
      for (let i = 0; i < 500; i++) {
        // Flight checks happen every FLIGHT_CHECK_INTERVAL (60) ticks
        const result = system.tick(makeCtx({ totalTicks: i * 60 }));
        totalDrains += result.drains.filter((d) => d.reason === 'migration').length;
      }

      expect(totalDrains).toBeGreaterThan(0);
    });

    it('no migration when morale is above threshold', () => {
      system.syncPopulation(10);
      for (const s of system.getStatsMap().values()) {
        (s as { morale: number }).morale = 60;
      }

      let totalDrains = 0;
      for (let i = 0; i < 100; i++) {
        const result = system.tick(makeCtx({ totalTicks: i * 60 }));
        totalDrains += result.drains.filter((d) => d.reason === 'migration').length;
      }

      expect(totalDrains).toBe(0);
    });
  });

  // ── Youth flight ─────────────────────────────────────────

  describe('youth flight', () => {
    it('removes workers over many ticks when morale is low', () => {
      system.syncPopulation(30);
      // Set low morale to increase flight chance (below YOUTH_FLIGHT_MORALE_THRESHOLD of 40)
      for (const s of system.getStatsMap().values()) {
        (s as { morale: number }).morale = 20;
      }

      let totalFlight = 0;
      for (let i = 0; i < 500; i++) {
        // Youth flight checks every YOUTH_FLIGHT_INTERVAL (120) ticks
        const result = system.tick(makeCtx({ totalTicks: i * 120 }));
        totalFlight += result.drains.filter((d) => d.reason === 'youth_flight').length;
      }

      expect(totalFlight).toBeGreaterThan(0);
    });
  });

  // ── Defections ───────────────────────────────────────────

  describe('defections', () => {
    it('workers with very low loyalty can defect', () => {
      system.syncPopulation(20);
      // Defections trigger when loyalty < DEFECTION_LOYALTY_THRESHOLD (20)
      for (const s of system.getStatsMap().values()) {
        (s as { loyalty: number }).loyalty = 5;
      }

      let totalDefections = 0;
      for (let i = 0; i < 300; i++) {
        const result = system.tick(makeCtx({ totalTicks: i }));
        totalDefections += result.defections.length;
      }

      expect(totalDefections).toBeGreaterThan(0);
    });
  });

  // ── Drain events tracked ─────────────────────────────────

  describe('drain event tracking', () => {
    it('drain events include worker names', () => {
      system.syncPopulation(20);
      for (const s of system.getStatsMap().values()) {
        (s as { morale: number }).morale = 1;
      }

      const allDrains: Array<{ name: string; reason: string }> = [];
      for (let i = 0; i < 300; i++) {
        const result = system.tick(makeCtx({ totalTicks: i * 60 }));
        for (const d of result.drains) {
          allDrains.push(d);
        }
      }

      if (allDrains.length > 0) {
        // Names are generated as "FirstName MiddleName LastName"
        expect(allDrains[0]!.name.length).toBeGreaterThan(0);
      }
    });
  });

  // ── Population count stays consistent ────────────────────

  describe('population consistency', () => {
    it('tick result population matches getPopulation()', () => {
      system.syncPopulation(15);
      const result = system.tick(makeCtx({ totalTicks: 1 }));
      expect(result.population).toBe(system.getPopulation());
    });
  });
});

describe('WorkerSystem — Event-Driven Inflows', () => {
  let system: WorkerSystem;
  let rng: GameRng;

  beforeEach(() => {
    world.clear();
    createResourceStore();
    createMetaStore();
    rng = new GameRng('test-inflows');
    system = new WorkerSystem(rng);
  });

  afterEach(() => {
    world.clear();
  });

  // ── Moscow assignments ─────────────────────────────────────

  describe('moscowAssignment', () => {
    it('spawns workers and returns inflow event', () => {
      const event = system.moscowAssignment();
      expect(event.count).toBeGreaterThan(0);
      expect(event.reason).toBe('moscow_assignment');
      expect([...citizens].length).toBe(event.count);
    });

    it('spawns 3-12 workers', () => {
      const event = system.moscowAssignment();
      expect(event.count).toBeGreaterThanOrEqual(3);
      expect(event.count).toBeLessThanOrEqual(12);
    });
  });

  // ── Forced resettlement ────────────────────────────────────

  describe('forcedResettlement', () => {
    it('spawns hostile workers with low morale', () => {
      const event = system.forcedResettlement();
      expect(event.count).toBeGreaterThan(0);
      expect(event.reason).toBe('forced_resettlement');
      // Average morale should be low (FORCED_RESETTLEMENT_MORALE is [10, 30])
      expect(event.averageMorale).toBeLessThanOrEqual(30);
    });

    it('spawns 5-30 workers', () => {
      const event = system.forcedResettlement();
      expect(event.count).toBeGreaterThanOrEqual(5);
      expect(event.count).toBeLessThanOrEqual(30);
    });
  });

  // ── Kolkhoz amalgamation ───────────────────────────────────

  describe('kolkhozAmalgamation', () => {
    it('spawns workers with moderate stats', () => {
      const event = system.kolkhozAmalgamation();
      expect(event.count).toBeGreaterThan(0);
      expect(event.reason).toBe('kolkhoz_amalgamation');
      // Average morale should be moderate (30-60 range)
      expect(event.averageMorale).toBeGreaterThanOrEqual(30);
      expect(event.averageMorale).toBeLessThanOrEqual(60);
    });

    it('spawns 20-60 workers', () => {
      const event = system.kolkhozAmalgamation();
      expect(event.count).toBeGreaterThanOrEqual(20);
      expect(event.count).toBeLessThanOrEqual(60);
    });
  });
});

describe('WorkerSystem — Assignment', () => {
  let system: WorkerSystem;
  let rng: GameRng;

  beforeEach(() => {
    world.clear();
    createResourceStore();
    createMetaStore();
    rng = new GameRng('test-assign');
    system = new WorkerSystem(rng);
  });

  afterEach(() => {
    world.clear();
  });

  it('assignWorker assigns a citizen to a building', () => {
    createBuilding(0, 0, 'power-station');
    system.syncPopulation(5);
    const worker = [...citizens][0]!;

    const success = system.assignWorker(worker, 0, 0);
    expect(success).toBe(true);
    expect(worker.citizen.assignment).toBe('power-station');
  });

  it('assignWorker fails for non-existent building', () => {
    system.syncPopulation(1);
    const worker = [...citizens][0]!;

    const success = system.assignWorker(worker, 99, 99);
    expect(success).toBe(false);
  });

  it('unassignWorker clears assignment', () => {
    createBuilding(0, 0, 'power-station');
    system.syncPopulation(1);
    const worker = [...citizens][0]!;

    system.assignWorker(worker, 0, 0);
    expect(worker.citizen.assignment).toBe('power-station');

    system.unassignWorker(worker);
    expect(worker.citizen.assignment).toBeUndefined();
  });
});

describe('WorkerSystem — Core API', () => {
  let system: WorkerSystem;
  let rng: GameRng;

  beforeEach(() => {
    world.clear();
    createResourceStore();
    createMetaStore();
    rng = new GameRng('test-core');
    system = new WorkerSystem(rng);
  });

  afterEach(() => {
    world.clear();
  });

  it('getPopulation returns total managed workers', () => {
    system.syncPopulation(15);
    expect(system.getPopulation()).toBe(15);
  });

  it('getAverageMorale returns average', () => {
    system.syncPopulation(10);
    // All workers start at morale 50
    const avg = system.getAverageMorale();
    expect(avg).toBe(50);
  });

  it('getAverageMorale returns 50 with no workers', () => {
    expect(system.getAverageMorale()).toBe(50);
  });

  it('syncPopulation spawns workers to match target', () => {
    system.syncPopulation(10);
    expect(system.getPopulation()).toBe(10);
    expect([...citizens].length).toBe(10);
  });

  it('syncPopulation removes excess workers', () => {
    system.syncPopulation(10);
    system.syncPopulation(5);
    expect(system.getPopulation()).toBe(5);
  });

  it('spawnWorker creates a citizen entity with stats', () => {
    const entity = system.spawnWorker();
    expect(entity.citizen).toBeDefined();
    expect(system.getStatsMap().has(entity)).toBe(true);
    const stats = system.getStatsMap().get(entity)!;
    expect(stats.morale).toBe(50);
    expect(stats.name.length).toBeGreaterThan(0);
  });

  it('arrestWorker removes a non-party worker', () => {
    system.syncPopulation(5);
    const before = system.getPopulation();

    const event = system.arrestWorker();
    expect(event).not.toBeNull();
    expect(event!.reason).toBe('kgb_arrest');
    expect(system.getPopulation()).toBe(before - 1);
  });

  it('arrestWorker returns null when no eligible workers', () => {
    // No workers at all
    const event = system.arrestWorker();
    expect(event).toBeNull();
  });
});
