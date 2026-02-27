/**
 * @module game/workers
 *
 * Worker entity system for SimSoviet 2000.
 *
 * Manages individual citizen entities with stats (morale, loyalty, skill,
 * health, vodka dependency), lifecycle (spawn, assignment, defection, removal),
 * and per-tick simulation (food/vodka consumption, morale drivers, skill growth).
 *
 * Workers are the core resource — the player's job is retention, not growth.
 */

import {
  FEMALE_GIVEN_NAMES,
  getSurname,
  MALE_GIVEN_NAMES,
  PATRONYMIC_FATHER_NAMES,
  PATRONYMIC_RULES,
  SURNAMES_RAW,
} from '@/ai/names';
import { GRID_SIZE } from '@/config';
import { getBuildingDef } from '@/data/buildingDefs';
import { buildingsLogic, citizens, housing as housingArchetype } from '@/ecs/archetypes';
import type { CitizenComponent, Entity } from '@/ecs/world';
import { world } from '@/ecs/world';
import type { GameRng } from '@/game/SeedSystem';

// ── Types ───────────────────────────────────────────────────────────────────

/** Per-worker extended stats stored alongside the ECS CitizenComponent. */
export interface WorkerStats {
  /** Procedurally generated "FirstName Patronymic" */
  name: string;
  /** 0-100: production speed, defection chance, riot threshold */
  morale: number;
  /** 0-100 (hidden): politruk flagging threshold, KGB targeting */
  loyalty: number;
  /** 0-100: trudodni per tick, construction speed, task quality */
  skill: number;
  /** 0-100: work capacity, starvation resistance */
  health: number;
  /** 0-100 (hidden): after enough vodka rations, workers need it */
  vodkaDependency: number;
  /** Ticks since the worker last received a vodka ration */
  ticksSinceVodka: number;
  /** Ticks spent at current assignment (for skill growth) */
  assignmentDuration: number;
}

/** Display info returned by getWorkerInfo for UI rendering. */
export interface WorkerInfo {
  name: string;
  morale: number;
  status: 'idle' | 'working' | 'hungry' | 'defecting' | 'drunk';
  productionEfficiency: number;
}

/** Result of a single WorkerSystem tick. */
export interface WorkerTickResult {
  defections: Entity[];
  vodkaConsumed: number;
  foodConsumed: number;
  classEfficiency: Record<string, number>;
}

/** Result of population dynamics processing (drains + inflows). */
export interface PopulationDynamicsResult {
  /** Workers lost to natural attrition (old age, illness, accidents). */
  attritionDeaths: number;
  /** Workers lost to youth flight. */
  youthFlight: number;
  /** Workers lost to illegal migration (morale-driven). */
  illegalMigration: number;
  /** Workers gained from natural births. */
  births: number;
  /** Names of removed workers (for toast/advisor messages). */
  removedNames: string[];
}

/** Auto-assign priority order for building roles. */
export type AutoAssignPriority =
  | 'agriculture'
  | 'power'
  | 'industry'
  | 'services'
  | 'culture'
  | 'military'
  | 'government';

/** Default auto-assign priority (from design doc). */
const AUTO_ASSIGN_PRIORITY: readonly AutoAssignPriority[] = [
  'agriculture', // Food production (prevent starvation)
  'power', // Power production (keep factories running)
  'industry', // Industrial output (meet quotas)
  'services', // Hospital, school — morale/skill
  'culture', // Cultural buildings
  'military', // Barracks, guard posts
  'government', // Government offices
];

// ── Constants ───────────────────────────────────────────────────────────────

const CITIZEN_CLASSES: readonly CitizenComponent['class'][] = [
  'worker',
  'engineer',
  'farmer',
  'party_official',
  'soldier',
  'prisoner',
];

/** Food units consumed per worker per tick. */
const FOOD_PER_WORKER = 1;

/** Vodka units consumed per non-prisoner worker per tick. */
const VODKA_PER_WORKER = 0.5;

// Morale modifiers (from design doc)
const MORALE_FED = 2;
const MORALE_FED_CAP = 80;
const MORALE_HUNGRY = -5;
const MORALE_VODKA = 3;
const MORALE_VODKA_WITHDRAWAL = -10;
const MORALE_HOUSED = 1;
const MORALE_HOMELESS = -5;
const MORALE_PARTY_BOOST = 0.5;

/** Vodka dependency threshold for withdrawal morale penalty. */
const VODKA_WITHDRAWAL_THRESHOLD = 30;

/** Loyalty threshold below which workers may defect. */
const DEFECTION_LOYALTY_THRESHOLD = 20;

/** Maximum defection probability per tick. */
const DEFECTION_MAX_CHANCE = 0.05;

/** Skill gained per tick while assigned to a task. */
const SKILL_GROWTH_RATE = 0.2;

// Class efficiency bonuses
const ENGINEER_INDUSTRY_BONUS = 0.2;
const FARMER_AGRICULTURE_BONUS = 0.3;
const PARTY_OFFICIAL_PENALTY = -0.5;
const PRISONER_BONUS = 0.1;

// ── Population Dynamics Constants ──────────────────────────────────────────

/** Average ticks between natural attrition deaths. */
const ATTRITION_INTERVAL = 60;
/** Average ticks between youth flight departures. */
const YOUTH_FLIGHT_INTERVAL = 120;
/** Average ticks between natural births (when conditions met). */
const BIRTH_INTERVAL = 90;
/** Morale threshold below which workers attempt illegal migration. */
const ILLEGAL_MIGRATION_MORALE_THRESHOLD = 20;
/** Illegal migration flee chance scaling: (threshold - morale) * this per tick. */
const ILLEGAL_MIGRATION_RATE = 0.005;
/** Health drain per tick when worker is starving (hunger > 80). */
const STARVATION_HEALTH_DRAIN = 2;
/** Health drain per tick from natural aging. */
const AGING_HEALTH_DRAIN = 0.05;
/** Health threshold at which worker dies from attrition. */
const DEATH_HEALTH_THRESHOLD = 5;

// ── Name Generation ─────────────────────────────────────────────────────────

/**
 * Generate a full Russian-style worker name: "Given Patronymic Surname".
 *
 * Uses the rich name database from @/ai/names for authentic three-part
 * names with gender-aware patronymics and gendered surnames.
 */
export function generateWorkerName(rng: GameRng): string {
  const isMale = rng.random() < 0.5;
  const gender: 'male' | 'female' = isMale ? 'male' : 'female';
  const givenName = isMale ? rng.pick(MALE_GIVEN_NAMES) : rng.pick(FEMALE_GIVEN_NAMES);
  const fatherName = rng.pick(PATRONYMIC_FATHER_NAMES);
  const patronymic = PATRONYMIC_RULES.generate(fatherName, gender);
  const surnameIndex = Math.floor(rng.random() * SURNAMES_RAW.length);
  const surname = getSurname(surnameIndex, gender);
  return `${givenName} ${patronymic} ${surname}`;
}

// ── Worker System ───────────────────────────────────────────────────────────

/**
 * Manages individual worker (citizen) entities and their extended stats.
 *
 * Each citizen in the ECS world has a corresponding WorkerStats entry
 * tracked in a Map. The system handles spawning, assignment, per-tick
 * stat updates (morale, loyalty, skill, vodka dependency), defection,
 * and resource consumption.
 */
export class WorkerSystem {
  private rng: GameRng;
  private stats: Map<Entity, WorkerStats> = new Map();

  constructor(rng: GameRng) {
    this.rng = rng;
  }

  /** Get the internal stats map (primarily for testing). */
  getStatsMap(): Map<Entity, WorkerStats> {
    return this.stats;
  }

  // ── Spawning ────────────────────────────────────────────────

  /**
   * Spawn a single worker entity in the ECS world.
   *
   * @param homeX - Optional grid X for home position
   * @param homeY - Optional grid Y for home position
   * @returns The created entity
   */
  spawnWorker(homeX?: number, homeY?: number): Entity {
    const name = generateWorkerName(this.rng);
    const citizenClass = this.rng.pick(CITIZEN_CLASSES);

    const citizen: CitizenComponent = {
      class: citizenClass,
      happiness: 50,
      hunger: 0,
      assignment: undefined,
      home: homeX != null && homeY != null ? { gridX: homeX, gridY: homeY } : undefined,
      name,
    };

    const entity: Entity = {
      position: {
        gridX: homeX ?? Math.floor(GRID_SIZE / 2),
        gridY: homeY ?? Math.floor(GRID_SIZE / 2),
      },
      citizen,
      isCitizen: true,
    };

    const added = world.add(entity);

    const workerStats: WorkerStats = {
      name,
      morale: 50,
      loyalty: this.rng.int(30, 70),
      skill: this.rng.int(10, 40),
      health: this.rng.int(60, 100),
      vodkaDependency: citizenClass === 'prisoner' ? 0 : this.rng.int(0, 20),
      ticksSinceVodka: 0,
      assignmentDuration: 0,
    };

    this.stats.set(added, workerStats);
    return added;
  }

  /**
   * Adjust worker count to match target population.
   * Spawns new workers or removes excess (preferring unassigned first).
   */
  syncPopulation(target: number): void {
    const currentCitizens = [...citizens];
    const current = currentCitizens.length;

    if (target > current) {
      for (let i = 0; i < target - current; i++) {
        this.spawnWorker();
      }
    } else if (target < current) {
      const toRemove = current - target;
      // Sort: unassigned workers first, then assigned
      const sorted = [...currentCitizens].sort((a, b) => {
        const aAssigned = a.citizen.assignment != null ? 1 : 0;
        const bAssigned = b.citizen.assignment != null ? 1 : 0;
        return aAssigned - bAssigned;
      });
      for (let i = 0; i < toRemove; i++) {
        this.removeWorker(sorted[i]!, 'population_sync');
      }
    }
  }

  /**
   * Remove a worker from the world and clean up stats.
   */
  removeWorker(entity: Entity, _reason: string): void {
    this.stats.delete(entity);
    world.remove(entity);
  }

  // ── Assignment ──────────────────────────────────────────────

  /**
   * Assign a worker to the building at the given grid position.
   * Returns false if no building exists at that position.
   */
  assignWorker(entity: Entity, gridX: number, gridY: number): boolean {
    const building = buildingsLogic.entities.find(
      (b) => b.position.gridX === gridX && b.position.gridY === gridY
    );
    if (!building) return false;

    entity.citizen!.assignment = building.building.defId;
    const workerStats = this.stats.get(entity);
    if (workerStats) workerStats.assignmentDuration = 0;
    world.reindex(entity);
    return true;
  }

  /**
   * Remove a worker's building assignment.
   */
  unassignWorker(entity: Entity): void {
    entity.citizen!.assignment = undefined;
    const workerStats = this.stats.get(entity);
    if (workerStats) workerStats.assignmentDuration = 0;
    world.reindex(entity);
  }

  // ── Info ────────────────────────────────────────────────────

  /**
   * Get display info for a worker entity.
   * Returns null if the entity is not a citizen or has no stats.
   */
  getWorkerInfo(entity: Entity): WorkerInfo | null {
    if (!entity.citizen) return null;
    const workerStats = this.stats.get(entity);
    if (!workerStats) return null;

    return {
      name: workerStats.name,
      morale: workerStats.morale,
      status: this.getStatus(entity, workerStats),
      productionEfficiency: this.getEfficiency(entity, workerStats),
    };
  }

  // ── Tick ────────────────────────────────────────────────────

  /**
   * Run one simulation tick for all workers.
   *
   * Processes food/vodka consumption, morale drivers, skill growth,
   * and defection checks. Returns aggregate stats.
   *
   * @param vodkaAvailable - Total vodka units available this tick
   * @param foodAvailable - Total food units available this tick
   */
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: worker tick updates morale, loyalty, skill, vodka dependency across all citizens
  tick(vodkaAvailable: number, foodAvailable: number): WorkerTickResult {
    const allCitizens = [...citizens];
    const defections: Entity[] = [];
    let foodConsumed = 0;
    let vodkaConsumed = 0;
    let remainingFood = foodAvailable;
    let remainingVodka = vodkaAvailable;

    const classEfficiencySum: Record<string, number> = {};
    const classCounts: Record<string, number> = {};

    // Check for party official presence (morale boost to others)
    const hasPartyOfficial = allCitizens.some((e) => e.citizen.class === 'party_official');

    for (const entity of allCitizens) {
      const workerStats = this.stats.get(entity);
      if (!workerStats) continue;

      // ── Food consumption ──
      const foodConsumption = Math.min(FOOD_PER_WORKER, remainingFood);
      if (foodConsumption >= FOOD_PER_WORKER) {
        remainingFood -= foodConsumption;
        foodConsumed += foodConsumption;
        entity.citizen.hunger = Math.max(0, entity.citizen.hunger - 1);
        if (workerStats.morale < MORALE_FED_CAP) {
          workerStats.morale = Math.min(MORALE_FED_CAP, workerStats.morale + MORALE_FED);
        }
      } else {
        // Partial or no food — worker goes hungry
        if (foodConsumption > 0) {
          remainingFood -= foodConsumption;
          foodConsumed += foodConsumption;
        }
        entity.citizen.hunger = Math.min(100, entity.citizen.hunger + 5);
        workerStats.morale = Math.max(0, workerStats.morale + MORALE_HUNGRY);
      }

      // ── Vodka consumption (prisoners don't drink) ──
      if (entity.citizen.class !== 'prisoner') {
        const vodkaConsumption = Math.min(VODKA_PER_WORKER, remainingVodka);
        if (vodkaConsumption >= VODKA_PER_WORKER) {
          remainingVodka -= vodkaConsumption;
          vodkaConsumed += vodkaConsumption;
          workerStats.morale = Math.min(100, workerStats.morale + MORALE_VODKA);
          workerStats.vodkaDependency = Math.min(100, workerStats.vodkaDependency + 0.5);
          workerStats.ticksSinceVodka = 0;
        } else {
          // No vodka available
          if (vodkaConsumption > 0) {
            remainingVodka -= vodkaConsumption;
            vodkaConsumed += vodkaConsumption;
          }
          workerStats.ticksSinceVodka++;
          if (workerStats.vodkaDependency > VODKA_WITHDRAWAL_THRESHOLD) {
            workerStats.morale = Math.max(0, workerStats.morale + MORALE_VODKA_WITHDRAWAL);
          }
        }
      }

      // ── Housing ──
      if (entity.citizen.home) {
        workerStats.morale = Math.min(100, workerStats.morale + MORALE_HOUSED);
      } else {
        workerStats.morale = Math.max(0, workerStats.morale + MORALE_HOMELESS);
      }

      // ── Party official morale boost ──
      if (hasPartyOfficial && entity.citizen.class !== 'party_official') {
        workerStats.morale = Math.min(100, workerStats.morale + MORALE_PARTY_BOOST);
      }

      // ── Skill growth (only when assigned) ──
      if (entity.citizen.assignment) {
        workerStats.skill = Math.min(100, workerStats.skill + SKILL_GROWTH_RATE);
        workerStats.assignmentDuration++;
      }

      // ── Defection check ──
      if (workerStats.loyalty < DEFECTION_LOYALTY_THRESHOLD) {
        const defectChance =
          ((DEFECTION_LOYALTY_THRESHOLD - workerStats.loyalty) / DEFECTION_LOYALTY_THRESHOLD) *
          DEFECTION_MAX_CHANCE;
        if (this.rng.random() < defectChance) {
          defections.push(entity);
          continue; // Skip efficiency tracking for defecting workers
        }
      }

      // ── Track class efficiency ──
      const citizenClass = entity.citizen.class;
      const eff = this.getEfficiency(entity, workerStats);
      classEfficiencySum[citizenClass] = (classEfficiencySum[citizenClass] ?? 0) + eff;
      classCounts[citizenClass] = (classCounts[citizenClass] ?? 0) + 1;
    }

    // Average class efficiencies
    const classEfficiency: Record<string, number> = {};
    for (const cls of Object.keys(classEfficiencySum)) {
      const count = classCounts[cls] ?? 1;
      classEfficiency[cls] = classEfficiencySum[cls]! / count;
    }

    // Remove defected workers
    for (const entity of defections) {
      this.removeWorker(entity, 'defection');
    }

    return {
      defections,
      vodkaConsumed,
      foodConsumed,
      classEfficiency,
    };
  }

  // ── Population Dynamics ─────────────────────────────────────────

  /**
   * Process constant population drains and natural births.
   * Called once per simulation tick by SimulationEngine (separate from the
   * per-worker `tick()` which handles consumption/morale).
   *
   * Implements from the design doc:
   * - Natural attrition: ~1 worker per 60 ticks (old age, illness)
   * - Youth flight: ~1 worker per 120 ticks (reduced by morale)
   * - Illegal migration: morale < 20 → flee chance per tick
   * - Natural births: ~1 per 90 ticks if housing + food conditions met
   *
   * @param totalTicks - Current total tick count
   * @param housingCap - Total housing capacity from powered buildings
   * @param foodSupply - Current food stockpile
   * @param populationCount - Current resource.population count
   * @param drainMult - Difficulty multiplier for drain intensity (default 1.0)
   * @param birthMult - Difficulty multiplier for birth rate (default 1.0)
   */
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: population dynamics handles emigration, death, births, and immigration with many conditions
  tickPopulationDynamics(
    _totalTicks: number,
    housingCap: number,
    foodSupply: number,
    populationCount: number,
    drainMult = 1.0,
    birthMult = 1.0
  ): PopulationDynamicsResult {
    const result: PopulationDynamicsResult = {
      attritionDeaths: 0,
      youthFlight: 0,
      illegalMigration: 0,
      births: 0,
      removedNames: [],
    };

    const allCitizens = [...citizens];
    if (allCitizens.length === 0) return result;

    // ── Natural attrition ──
    // ~1 worker per 60 ticks on average, scaled by drain multiplier
    const attritionChance = (1 / ATTRITION_INTERVAL) * drainMult;
    if (this.rng.random() < attritionChance) {
      // Pick lowest-health worker
      let weakest: Entity | null = null;
      let lowestHealth = Infinity;
      for (const entity of allCitizens) {
        const s = this.stats.get(entity);
        if (s && s.health < lowestHealth) {
          lowestHealth = s.health;
          weakest = entity;
        }
      }
      if (weakest) {
        const name = this.stats.get(weakest)?.name ?? 'Unknown';
        result.removedNames.push(name);
        this.removeWorker(weakest, 'natural_attrition');
        result.attritionDeaths++;
      }
    }

    // ── Health decay from starvation and aging ──
    for (const entity of [...citizens]) {
      const s = this.stats.get(entity);
      if (!s) continue;

      // Aging: slow health drain
      s.health = Math.max(0, s.health - AGING_HEALTH_DRAIN);

      // Starvation: faster health drain when hungry
      if (entity.citizen!.hunger > 80) {
        s.health = Math.max(0, s.health - STARVATION_HEALTH_DRAIN);
      }

      // Death from poor health
      if (s.health <= DEATH_HEALTH_THRESHOLD) {
        result.removedNames.push(s.name);
        this.removeWorker(entity, 'health_death');
        result.attritionDeaths++;
      }
    }

    // ── Youth flight ──
    // ~1 worker per 120 ticks, reduced by average morale
    const avgMorale = this.getAverageMorale();
    const moraleReduction = Math.max(0, 1 - avgMorale / 100); // Higher morale = less flight
    const youthFlightChance = (1 / YOUTH_FLIGHT_INTERVAL) * drainMult * (0.5 + moraleReduction);
    if (this.rng.random() < youthFlightChance && [...citizens].length > 1) {
      // Pick a random unassigned worker (young workers leave first)
      const unassigned = [...citizens].filter((e) => !e.citizen.assignment && this.stats.has(e));
      if (unassigned.length > 0) {
        const leaver = this.rng.pick(unassigned);
        const name = this.stats.get(leaver)?.name ?? 'Unknown';
        result.removedNames.push(name);
        this.removeWorker(leaver, 'youth_flight');
        result.youthFlight++;
      }
    }

    // ── Illegal migration ──
    // Workers with morale < threshold have a chance to flee each tick
    // fleeChance = (threshold - morale) * 0.5% per tick
    const migrationThreshold = ILLEGAL_MIGRATION_MORALE_THRESHOLD;
    for (const entity of [...citizens]) {
      const s = this.stats.get(entity);
      if (!s || s.morale >= migrationThreshold) continue;

      const fleeChance = (migrationThreshold - s.morale) * ILLEGAL_MIGRATION_RATE * drainMult;
      if (this.rng.random() < fleeChance) {
        result.removedNames.push(s.name);
        this.removeWorker(entity, 'illegal_migration');
        result.illegalMigration++;
      }
    }

    // ── Natural births ──
    // ~1 per 90 ticks if: housingUsed < housingCap AND food > 2 * population
    // Use the stable populationCount param (not live entity count) to avoid
    // in-tick fluctuations from attrition/flight feeding back into birth checks.
    if (populationCount < housingCap && foodSupply > 2 * populationCount) {
      const birthChance = (1 / BIRTH_INTERVAL) * birthMult;
      if (this.rng.random() < birthChance) {
        this.spawnWorker();
        result.births++;
      }
    }

    return result;
  }

  // ── Event-Driven Inflows ──────────────────────────────────────

  /**
   * Receive workers from Moscow assignment decree.
   * Workers have randomized stats — may include informants or troublemakers.
   *
   * @param count - Number of workers (3-12 per design doc)
   * @returns Spawned entities
   */
  receiveMoscowWorkers(count: number): Entity[] {
    const spawned: Entity[] = [];
    for (let i = 0; i < count; i++) {
      const entity = this.spawnWorker();
      const s = this.stats.get(entity);
      if (s) {
        // Moscow workers have wide stat variance
        s.loyalty = this.rng.int(10, 80);
        s.skill = this.rng.int(5, 60);
        // 20% chance of being a hidden informant (high loyalty, low morale)
        if (this.rng.random() < 0.2) {
          s.loyalty = this.rng.int(70, 100);
          s.morale = this.rng.int(20, 40);
        }
      }
      spawned.push(entity);
    }
    return spawned;
  }

  /**
   * Receive forced resettlement workers.
   * These arrive hostile: low morale, low loyalty. Must be housed and fed.
   *
   * @param count - Number of workers (5-30 per design doc)
   * @returns Spawned entities
   */
  receiveResettlement(count: number): Entity[] {
    const spawned: Entity[] = [];
    for (let i = 0; i < count; i++) {
      const entity = this.spawnWorker();
      const s = this.stats.get(entity);
      if (s) {
        s.morale = this.rng.int(10, 30);
        s.loyalty = this.rng.int(5, 20);
        s.skill = this.rng.int(5, 30);
        s.health = this.rng.int(40, 80);
      }
      spawned.push(entity);
    }
    return spawned;
  }

  /**
   * Receive workers from kolkhoz amalgamation (era event).
   * Workers come with existing loyalties and grudges.
   *
   * @param count - Number of workers (20-60 per design doc)
   * @returns Spawned entities
   */
  receiveAmalgamation(count: number): Entity[] {
    const spawned: Entity[] = [];
    for (let i = 0; i < count; i++) {
      const entity = this.spawnWorker();
      const s = this.stats.get(entity);
      if (s) {
        // Existing workers with mixed loyalties
        s.morale = this.rng.int(20, 60);
        s.loyalty = this.rng.int(15, 55);
        s.skill = this.rng.int(20, 70);
        s.health = this.rng.int(50, 90);
      }
      spawned.push(entity);
    }
    return spawned;
  }

  // ── Auto-Assign ───────────────────────────────────────────────

  /**
   * Automatically distribute idle workers to buildings by priority.
   * Priority order: food → power → industry → services → culture → military → government.
   *
   * Only fills buildings up to their `jobs` capacity. Returns the number
   * of workers assigned.
   */
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: auto-assignment matches idle workers to buildings with capacity checks
  autoAssign(): number {
    let assigned = 0;

    // Gather idle workers (no assignment)
    const idle = [...citizens].filter((e) => !e.citizen.assignment && this.stats.has(e));
    if (idle.length === 0) return 0;

    // Build a map of building → current assigned count
    const buildingWorkerCounts = new Map<string, number>();
    for (const entity of [...citizens]) {
      const assignment = entity.citizen.assignment;
      if (assignment) {
        buildingWorkerCounts.set(assignment, (buildingWorkerCounts.get(assignment) ?? 0) + 1);
      }
    }

    // Collect buildings grouped by priority role
    const buildingsByPriority: Array<{
      gridX: number;
      gridY: number;
      defId: string;
      jobs: number;
      currentWorkers: number;
    }> = [];

    for (const priority of AUTO_ASSIGN_PRIORITY) {
      for (const b of buildingsLogic.entities) {
        const def = getBuildingDef(b.building.defId);
        if (!def || def.role !== priority) continue;
        if (def.stats.jobs <= 0) continue;

        const currentWorkers = buildingWorkerCounts.get(b.building.defId) ?? 0;
        if (currentWorkers < def.stats.jobs) {
          buildingsByPriority.push({
            gridX: b.position.gridX,
            gridY: b.position.gridY,
            defId: b.building.defId,
            jobs: def.stats.jobs,
            currentWorkers,
          });
        }
      }
    }

    // Assign idle workers to buildings in priority order
    let idleIdx = 0;
    for (const building of buildingsByPriority) {
      const openSlots = building.jobs - building.currentWorkers;
      for (let i = 0; i < openSlots && idleIdx < idle.length; i++) {
        const worker = idle[idleIdx]!;
        if (this.assignWorker(worker, building.gridX, building.gridY)) {
          assigned++;
          building.currentWorkers++;
        }
        idleIdx++;
      }
      if (idleIdx >= idle.length) break;
    }

    return assigned;
  }

  // ── Housing Management ────────────────────────────────────────

  /**
   * Auto-assign homeless workers to available housing buildings.
   * Workers are assigned to the nearest housing with capacity.
   * Returns the number of workers housed.
   */
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: housing assignment matches unhoused workers to buildings with capacity/distance checks
  assignHousing(): number {
    let housed = 0;

    // Find homeless workers
    const homeless = [...citizens].filter((e) => !e.citizen.home && this.stats.has(e));
    if (homeless.length === 0) return 0;

    // Build housing capacity map: building position → remaining capacity
    const housingBuildings: Array<{
      gridX: number;
      gridY: number;
      remaining: number;
    }> = [];

    // Count current occupants per housing building
    const occupancy = new Map<string, number>();
    for (const entity of [...citizens]) {
      if (entity.citizen.home) {
        const key = `${entity.citizen.home.gridX},${entity.citizen.home.gridY}`;
        occupancy.set(key, (occupancy.get(key) ?? 0) + 1);
      }
    }

    for (const b of housingArchetype) {
      if (!b.building.powered || b.building.housingCap <= 0) continue;
      const key = `${b.position.gridX},${b.position.gridY}`;
      const current = occupancy.get(key) ?? 0;
      const remaining = b.building.housingCap - current;
      if (remaining > 0) {
        housingBuildings.push({
          gridX: b.position.gridX,
          gridY: b.position.gridY,
          remaining,
        });
      }
    }

    // Assign homeless workers to nearest available housing
    for (const worker of homeless) {
      if (housingBuildings.length === 0) break;

      const wx = worker.position!.gridX;
      const wy = worker.position!.gridY;

      // Find nearest housing with capacity
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < housingBuildings.length; i++) {
        const h = housingBuildings[i]!;
        const dist = Math.abs(h.gridX - wx) + Math.abs(h.gridY - wy);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }

      const housing = housingBuildings[bestIdx]!;
      worker.citizen!.home = { gridX: housing.gridX, gridY: housing.gridY };
      worker.position!.gridX = housing.gridX;
      worker.position!.gridY = housing.gridY;
      housing.remaining--;
      housed++;

      // Remove exhausted housing from the list
      if (housing.remaining <= 0) {
        housingBuildings.splice(bestIdx, 1);
      }
    }

    return housed;
  }

  /**
   * Get total housing capacity from all powered housing buildings.
   */
  getHousingCapacity(): number {
    let cap = 0;
    for (const b of housingArchetype) {
      if (b.building.powered) {
        cap += b.building.housingCap;
      }
    }
    return cap;
  }

  /**
   * Get the current number of housed workers.
   */
  getHousedCount(): number {
    return [...citizens].filter((e) => e.citizen.home != null).length;
  }

  /**
   * Get total worker count managed by this system.
   */
  getWorkerCount(): number {
    return this.stats.size;
  }

  /**
   * Get average morale across all workers.
   */
  getAverageMorale(): number {
    if (this.stats.size === 0) return 50;
    let total = 0;
    for (const s of this.stats.values()) {
      total += s.morale;
    }
    return total / this.stats.size;
  }

  /**
   * Get average loyalty across all workers (hidden stat, for system use).
   */
  getAverageLoyalty(): number {
    if (this.stats.size === 0) return 50;
    let total = 0;
    for (const s of this.stats.values()) {
      total += s.loyalty;
    }
    return total / this.stats.size;
  }

  // ── Private helpers ───────────────────────────────────────────

  private getStatus(entity: Entity, workerStats: WorkerStats): WorkerInfo['status'] {
    if (workerStats.loyalty < 10) return 'defecting';
    if (workerStats.vodkaDependency > 50 && workerStats.ticksSinceVodka > 10) return 'drunk';
    if (entity.citizen!.hunger >= 80) return 'hungry';
    if (entity.citizen!.assignment) return 'working';
    return 'idle';
  }

  private getEfficiency(entity: Entity, workerStats: WorkerStats): number {
    const base = (workerStats.morale / 100) * (0.5 + (workerStats.skill / 100) * 0.5);
    let bonus = 0;

    const citizenClass = entity.citizen!.class;
    const assignment = entity.citizen!.assignment;

    if (citizenClass === 'party_official') {
      bonus = PARTY_OFFICIAL_PENALTY;
    } else if (citizenClass === 'prisoner') {
      bonus = PRISONER_BONUS;
    } else if (assignment) {
      const def = getBuildingDef(assignment);
      if (citizenClass === 'engineer' && def?.role === 'industry') {
        bonus = ENGINEER_INDUSTRY_BONUS;
      } else if (citizenClass === 'farmer' && def?.role === 'agriculture') {
        bonus = FARMER_AGRICULTURE_BONUS;
      }
    }

    return Math.max(0, Math.min(1.5, base + bonus));
  }
}
