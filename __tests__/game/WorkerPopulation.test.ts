import { citizens } from '@/ecs/archetypes';
import { createBuilding, createMetaStore, createResourceStore } from '@/ecs/factories';
import { powerSystem } from '@/ecs/systems';
import { world } from '@/ecs/world';
import { GameRng } from '@/game/SeedSystem';
import { WorkerSystem } from '@/game/workers';

describe('WorkerSystem — Population Dynamics', () => {
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

  // ── Natural attrition ──────────────────────────────────────

  describe('tickPopulationDynamics — natural attrition', () => {
    it('removes low-health workers over many ticks', () => {
      system.syncPopulation(20);
      // Set a few workers to very low health
      const allStats = [...system.getStatsMap().values()];
      allStats[0]!.health = 3; // Below death threshold
      allStats[1]!.health = 4;

      let totalDeaths = 0;
      for (let i = 0; i < 200; i++) {
        const result = system.tickPopulationDynamics(i, 100, 1000, 20);
        totalDeaths += result.attritionDeaths;
      }

      // Workers with health <= 5 should die from health decay
      expect(totalDeaths).toBeGreaterThan(0);
    });

    it('aging slowly reduces health', () => {
      system.syncPopulation(5);
      const stats = [...system.getStatsMap().values()][0]!;
      const initialHealth = stats.health;

      // Run many ticks
      for (let i = 0; i < 100; i++) {
        system.tickPopulationDynamics(i, 100, 1000, 5);
      }

      // Health should have decreased due to aging
      expect(stats.health).toBeLessThan(initialHealth);
    });

    it('starvation accelerates health decay', () => {
      const worker = system.spawnWorker();
      worker.citizen!.hunger = 90; // Starving
      const stats = system.getStatsMap().get(worker)!;
      const initialHealth = stats.health;

      system.tickPopulationDynamics(1, 100, 1000, 1);

      // Should lose more than just aging (2 + 0.05)
      expect(stats.health).toBeLessThan(initialHealth - 1);
    });
  });

  // ── Youth flight ───────────────────────────────────────────

  describe('tickPopulationDynamics — youth flight', () => {
    it('removes workers over many ticks', () => {
      system.syncPopulation(30);
      // Set low morale to increase flight chance
      for (const s of system.getStatsMap().values()) {
        s.morale = 20;
      }

      let totalFlight = 0;
      for (let i = 0; i < 500; i++) {
        const result = system.tickPopulationDynamics(i, 100, 1000, 30);
        totalFlight += result.youthFlight;
      }

      expect(totalFlight).toBeGreaterThan(0);
    });

    it('prefers removing unassigned workers', () => {
      system.syncPopulation(10);
      const allCitizens = [...citizens];

      // Assign first 5 workers
      for (let i = 0; i < 5; i++) {
        createBuilding(i, 0, 'power-station');
        system.assignWorker(allCitizens[i]!, i, 0);
      }

      let flight = 0;
      for (let i = 0; i < 300; i++) {
        const result = system.tickPopulationDynamics(i, 100, 1000, 10);
        flight += result.youthFlight;
      }

      // If any youth fled, check that assigned workers survived preferentially
      if (flight > 0) {
        const remaining = [...citizens].filter((e) => e.citizen.assignment != null);
        expect(remaining.length).toBeGreaterThan(0);
      }
    });
  });

  // ── Illegal migration ─────────────────────────────────────

  describe('tickPopulationDynamics — illegal migration', () => {
    it('workers with morale < 20 can flee', () => {
      system.syncPopulation(20);
      for (const s of system.getStatsMap().values()) {
        s.morale = 5; // Very low morale
      }

      let totalMigration = 0;
      for (let i = 0; i < 100; i++) {
        const result = system.tickPopulationDynamics(i, 100, 1000, 20);
        totalMigration += result.illegalMigration;
      }

      expect(totalMigration).toBeGreaterThan(0);
    });

    it('workers with morale >= 20 do not flee via migration', () => {
      system.syncPopulation(10);
      for (const s of system.getStatsMap().values()) {
        s.morale = 50; // Comfortable
      }

      let totalMigration = 0;
      for (let i = 0; i < 100; i++) {
        const result = system.tickPopulationDynamics(i, 100, 1000, 10);
        totalMigration += result.illegalMigration;
      }

      expect(totalMigration).toBe(0);
    });

    it('flee chance scales with how far below threshold morale is', () => {
      // Very low morale should have higher flee rate
      system.syncPopulation(50);
      for (const s of system.getStatsMap().values()) {
        s.morale = 1; // Nearly zero
      }

      let migration1 = 0;
      for (let i = 0; i < 50; i++) {
        const result = system.tickPopulationDynamics(i, 100, 1000, 50);
        migration1 += result.illegalMigration;
      }

      // Reset
      world.clear();
      createResourceStore({ food: 1000 });
      createMetaStore();
      const rng2 = new GameRng('test-pop-dynamics-2');
      const sys2 = new WorkerSystem(rng2);
      sys2.syncPopulation(50);
      for (const s of sys2.getStatsMap().values()) {
        s.morale = 18; // Just below threshold
      }

      let migration2 = 0;
      for (let i = 0; i < 50; i++) {
        const result = sys2.tickPopulationDynamics(i, 100, 1000, 50);
        migration2 += result.illegalMigration;
      }

      // Very low morale workers flee more than barely-below-threshold workers
      expect(migration1).toBeGreaterThanOrEqual(migration2);
    });
  });

  // ── Natural births ─────────────────────────────────────────

  describe('tickPopulationDynamics — natural births', () => {
    it('births occur when housing and food conditions met', () => {
      system.syncPopulation(5);

      let totalBirths = 0;
      for (let i = 0; i < 500; i++) {
        // housingCap > pop, food > 2 * pop
        const result = system.tickPopulationDynamics(i, 100, 1000, 5);
        totalBirths += result.births;
      }

      expect(totalBirths).toBeGreaterThan(0);
    });

    it('no births when at housing capacity', () => {
      system.syncPopulation(10);

      let totalBirths = 0;
      for (let i = 0; i < 200; i++) {
        // housingCap = current pop → no births
        const result = system.tickPopulationDynamics(i, 10, 1000, 10);
        totalBirths += result.births;
      }

      expect(totalBirths).toBe(0);
    });

    it('no births when food is insufficient', () => {
      system.syncPopulation(10);

      let totalBirths = 0;
      for (let i = 0; i < 200; i++) {
        // food < 2 * population → no births
        const result = system.tickPopulationDynamics(i, 100, 10, 10);
        totalBirths += result.births;
      }

      expect(totalBirths).toBe(0);
    });

    it('birth rate scales with birthMult', () => {
      system.syncPopulation(5);

      let highBirths = 0;
      for (let i = 0; i < 500; i++) {
        const result = system.tickPopulationDynamics(i, 100, 1000, 5, 1.0, 2.0);
        highBirths += result.births;
      }

      world.clear();
      createResourceStore({ food: 1000 });
      createMetaStore();
      const rng2 = new GameRng('test-pop-dynamics');
      const sys2 = new WorkerSystem(rng2);
      sys2.syncPopulation(5);

      let lowBirths = 0;
      for (let i = 0; i < 500; i++) {
        const result = sys2.tickPopulationDynamics(i, 100, 1000, 5, 1.0, 0.5);
        lowBirths += result.births;
      }

      // Higher birth mult should produce more births on average
      expect(highBirths).toBeGreaterThanOrEqual(lowBirths);
    });
  });

  // ── Drain multiplier ───────────────────────────────────────

  describe('tickPopulationDynamics — drain multiplier', () => {
    it('higher drain mult increases drain rate', () => {
      system.syncPopulation(30);
      for (const s of system.getStatsMap().values()) {
        s.morale = 5;
      }

      let highDrainLosses = 0;
      for (let i = 0; i < 100; i++) {
        const result = system.tickPopulationDynamics(i, 100, 1000, 30, 2.0);
        highDrainLosses += result.attritionDeaths + result.youthFlight + result.illegalMigration;
      }

      world.clear();
      createResourceStore({ food: 1000 });
      createMetaStore();
      const rng2 = new GameRng('test-pop-dynamics');
      const sys2 = new WorkerSystem(rng2);
      sys2.syncPopulation(30);
      for (const s of sys2.getStatsMap().values()) {
        s.morale = 5;
      }

      let lowDrainLosses = 0;
      for (let i = 0; i < 100; i++) {
        const result = sys2.tickPopulationDynamics(i, 100, 1000, 30, 0.5);
        lowDrainLosses += result.attritionDeaths + result.youthFlight + result.illegalMigration;
      }

      expect(highDrainLosses).toBeGreaterThanOrEqual(lowDrainLosses);
    });
  });

  // ── Removed names tracking ─────────────────────────────────

  describe('tickPopulationDynamics — name tracking', () => {
    it('tracks names of removed workers', () => {
      system.syncPopulation(20);
      for (const s of system.getStatsMap().values()) {
        s.morale = 1;
        s.health = 3; // Very low health
      }

      let allNames: string[] = [];
      for (let i = 0; i < 100; i++) {
        const result = system.tickPopulationDynamics(i, 100, 1000, 20);
        allNames = allNames.concat(result.removedNames);
      }

      if (allNames.length > 0) {
        expect(allNames[0]!.length).toBeGreaterThan(0);
        expect(allNames[0]!.split(' ').length).toBe(3);
      }
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

  describe('receiveMoscowWorkers', () => {
    it('spawns the requested number of workers', () => {
      const spawned = system.receiveMoscowWorkers(8);
      expect(spawned.length).toBe(8);
      expect([...citizens].length).toBe(8);
    });

    it('workers have variable stats', () => {
      const spawned = system.receiveMoscowWorkers(10);
      const loyalties = spawned.map((e) => system.getStatsMap().get(e)!.loyalty);
      const uniqueLoyalties = new Set(loyalties);
      // With 10 workers and wide range, we should see some variety
      expect(uniqueLoyalties.size).toBeGreaterThan(1);
    });

    it('some workers may be informants (high loyalty)', () => {
      // Spawn enough to statistically guarantee at least one informant (20% chance)
      const spawned = system.receiveMoscowWorkers(30);
      const highLoyalty = spawned.filter((e) => system.getStatsMap().get(e)!.loyalty >= 70);
      expect(highLoyalty.length).toBeGreaterThan(0);
    });
  });

  // ── Forced resettlement ────────────────────────────────────

  describe('receiveResettlement', () => {
    it('spawns hostile workers with low morale', () => {
      const spawned = system.receiveResettlement(10);
      expect(spawned.length).toBe(10);

      for (const e of spawned) {
        const stats = system.getStatsMap().get(e)!;
        expect(stats.morale).toBeLessThanOrEqual(30);
        expect(stats.loyalty).toBeLessThanOrEqual(20);
      }
    });

    it('resettled workers have lower health', () => {
      const spawned = system.receiveResettlement(10);
      for (const e of spawned) {
        const stats = system.getStatsMap().get(e)!;
        expect(stats.health).toBeLessThanOrEqual(80);
      }
    });
  });

  // ── Kolkhoz amalgamation ───────────────────────────────────

  describe('receiveAmalgamation', () => {
    it('spawns workers with mixed stats', () => {
      const spawned = system.receiveAmalgamation(30);
      expect(spawned.length).toBe(30);
      expect([...citizens].length).toBe(30);
    });

    it('amalgamation workers have moderate stats', () => {
      const spawned = system.receiveAmalgamation(20);
      for (const e of spawned) {
        const stats = system.getStatsMap().get(e)!;
        expect(stats.morale).toBeGreaterThanOrEqual(20);
        expect(stats.morale).toBeLessThanOrEqual(60);
        expect(stats.skill).toBeGreaterThanOrEqual(20);
        expect(stats.skill).toBeLessThanOrEqual(70);
      }
    });
  });
});

describe('WorkerSystem — Auto-Assign', () => {
  let system: WorkerSystem;
  let rng: GameRng;

  beforeEach(() => {
    world.clear();
    createResourceStore();
    createMetaStore();
    rng = new GameRng('test-auto-assign');
    system = new WorkerSystem(rng);
  });

  afterEach(() => {
    world.clear();
  });

  it('assigns idle workers to buildings with job slots', () => {
    // Create a farm and a power station
    createBuilding(0, 0, 'power-station'); // 15 jobs, role: power
    createBuilding(2, 2, 'collective-farm-hq'); // 10 jobs, role: agriculture

    system.syncPopulation(10);
    const assigned = system.autoAssign();

    expect(assigned).toBeGreaterThan(0);
    expect(assigned).toBeLessThanOrEqual(10);
  });

  it('prioritizes food production over power', () => {
    createBuilding(0, 0, 'power-station'); // power role
    createBuilding(2, 2, 'collective-farm-hq'); // agriculture role

    system.syncPopulation(5);
    system.autoAssign();

    // Agriculture is higher priority — farm should get workers first
    const farmWorkers = [...citizens].filter((e) => e.citizen.assignment === 'collective-farm-hq');
    expect(farmWorkers.length).toBeGreaterThan(0);
  });

  it('does not overfill buildings beyond job capacity', () => {
    createBuilding(0, 0, 'post-office'); // 6 jobs
    system.syncPopulation(20);
    system.autoAssign();

    const postWorkers = [...citizens].filter((e) => e.citizen.assignment === 'post-office');
    expect(postWorkers.length).toBeLessThanOrEqual(6);
  });

  it('returns 0 when no idle workers', () => {
    createBuilding(0, 0, 'power-station');
    system.syncPopulation(5);

    // Assign all workers manually
    for (const c of [...citizens]) {
      system.assignWorker(c, 0, 0);
    }

    const assigned = system.autoAssign();
    expect(assigned).toBe(0);
  });

  it('returns 0 when no buildings with jobs', () => {
    createBuilding(0, 0, 'apartment-tower-a'); // housing, 0 jobs
    system.syncPopulation(5);

    const assigned = system.autoAssign();
    expect(assigned).toBe(0);
  });
});

describe('WorkerSystem — Housing Management', () => {
  let system: WorkerSystem;
  let rng: GameRng;

  beforeEach(() => {
    world.clear();
    createResourceStore();
    createMetaStore();
    rng = new GameRng('test-housing');
    system = new WorkerSystem(rng);
  });

  afterEach(() => {
    world.clear();
  });

  it('assigns homeless workers to powered housing', () => {
    // Create powered housing
    createBuilding(0, 0, 'power-station');
    createBuilding(1, 1, 'apartment-tower-a'); // housingCap=50

    // Power the buildings
    powerSystem();

    system.syncPopulation(5);
    const housed = system.assignHousing();

    expect(housed).toBe(5);
    expect(system.getHousedCount()).toBe(5);
  });

  it('does not assign to unpowered housing', () => {
    createBuilding(1, 1, 'apartment-tower-a'); // Unpowered

    system.syncPopulation(5);
    const housed = system.assignHousing();

    expect(housed).toBe(0);
  });

  it('respects housing capacity limits', () => {
    createBuilding(0, 0, 'power-station');
    createBuilding(1, 1, 'workers-house-a'); // Lower housing cap

    powerSystem();

    // Get the actual housing cap
    const cap = system.getHousingCapacity();
    system.syncPopulation(cap + 10); // More workers than housing
    const housed = system.assignHousing();

    expect(housed).toBeLessThanOrEqual(cap);
  });

  it('getHousingCapacity returns total from powered buildings', () => {
    createBuilding(0, 0, 'power-station');
    createBuilding(1, 1, 'apartment-tower-a'); // 50
    createBuilding(2, 2, 'apartment-tower-b'); // varies

    powerSystem();

    const cap = system.getHousingCapacity();
    expect(cap).toBeGreaterThan(0);
  });

  it('getWorkerCount returns total managed workers', () => {
    system.syncPopulation(15);
    expect(system.getWorkerCount()).toBe(15);
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
});
