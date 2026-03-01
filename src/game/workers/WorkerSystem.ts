/**
 * @fileoverview WorkerSystem — AUTHORITATIVE population manager.
 *
 * This is the single source of truth for population count.
 * The ECS citizen entity count IS the population.
 *
 * populationSystem is no longer used for growth — this system handles:
 *   - Spawning/removing citizen entities
 *   - Per-worker tick (vodka, food, morale, defection, production)
 *   - Population drains (migration, youth flight, KGB arrest, disease, accidents)
 *   - Population inflows (Moscow assignments, forced resettlement, kolkhoz)
 *   - Trudodni tracking
 *   - Behavioral governor
 */

import { buildingsLogic, citizens, getResourceEntity, operationalBuildings } from '@/ecs/archetypes';
import { createCitizen } from '@/ecs/factories';
import type { CitizenComponent, Entity } from '@/ecs/world';
import { world } from '@/ecs/world';
import type { GameRng } from '@/game/SeedSystem';
import {
  applyMorale,
  calcBaseEfficiency,
  calcClassBonus,
  checkDefection,
  clamp,
  emptyClassRecord,
  generateWorkerName,
  processFood,
  processProductionAndGrowth,
  processVodka,
  resolveStatus,
} from './classes';
import {
  ACCIDENT_LOW_SKILL_MULT,
  ACCIDENT_RATE_PER_FACTORY,
  CLASS_ORDER,
  CLASS_WEIGHTS,
  FLIGHT_CHECK_INTERVAL,
  FLIGHT_COUNT_CRITICAL,
  FLIGHT_COUNT_NORMAL,
  FLIGHT_MORALE_CRITICAL,
  FLIGHT_MORALE_THRESHOLD,
  FORCED_RESETTLEMENT_COUNT,
  FORCED_RESETTLEMENT_MORALE,
  KOLKHOZ_AMALGAMATION_COUNT,
  MOSCOW_ASSIGNMENT_COUNT,
  TRUDODNI_PER_TICK,
  YOUTH_FLIGHT_INTERVAL,
  YOUTH_FLIGHT_MORALE_THRESHOLD,
  YOUTH_MAX_AGE,
  YOUTH_MIN_AGE,
  YOUTH_RETENTION_BUILDINGS,
} from './constants';
import type { CollectiveFocus } from './governor';
import { runGovernor } from './governor';
import type {
  PopulationDrainEvent,
  PopulationInflowEvent,
  TickContext,
  WorkerDisplayInfo,
  WorkerStats,
  WorkerTickResult,
} from './types';

/** Serialized per-worker stats keyed by a stable identifier. */
export interface WorkerStatEntry {
  /** Citizen class at time of save */
  class: CitizenComponent['class'];
  stats: WorkerStats;
}

/** Save data for the WorkerSystem (system-level state only). */
export interface WorkerSystemSaveData {
  /** Per-worker stats keyed by worker name for re-linking. */
  workers: WorkerStatEntry[];
}

/** Context passed to the tick method for external game state. */
export interface WorkerTickContext {
  vodkaAvailable: number;
  foodAvailable: number;
  heatingFailing: boolean;
  /** Current game month (1-12) for seasonal effects. */
  month: number;
  /** Current era ID for era-specific behaviors. */
  eraId: string;
  /** Total ticks elapsed (for periodic checks). */
  totalTicks: number;
  /** FIX-08: Trudodni fulfillment ratio (0-1+). Above 1.0 = exceeding minimum. */
  trudodniRatio?: number;
}

/** Governor runs every N ticks to avoid per-tick array copy overhead. */
const GOVERNOR_INTERVAL = 10;

export class WorkerSystem {
  private stats: Map<Entity, WorkerStats> = new Map();
  private rng: GameRng | null;
  private collectiveFocus: CollectiveFocus = 'balanced';
  private tickCounter = 0;
  private trudodniTracker: Map<Entity, number> = new Map();
  private overrideCount = 0;

  constructor(rng?: GameRng) {
    this.rng = rng ?? null;
  }

  // ── Public API ──────────────────────────────────────────

  /** Set the collective focus — shifts behavioral governor priorities. */
  setCollectiveFocus(focus: CollectiveFocus): void {
    this.collectiveFocus = focus;
  }

  /** Get the current collective focus. */
  getCollectiveFocus(): CollectiveFocus {
    return this.collectiveFocus;
  }

  /** Get the stats map (read-only, for testing). */
  getStatsMap(): ReadonlyMap<Entity, WorkerStats> {
    return this.stats;
  }

  /** Authoritative population count — the number of citizen entities. */
  getPopulation(): number {
    return [...citizens].length;
  }

  /** Calculate average morale across all workers. */
  getAverageMorale(): number {
    let sum = 0;
    let count = 0;
    for (const stats of this.stats.values()) {
      sum += stats.morale;
      count++;
    }
    return count > 0 ? sum / count : 50;
  }

  /** Get trudodni earned this year for a worker. */
  getTrudodni(entity: Entity): number {
    return this.trudodniTracker.get(entity) ?? 0;
  }

  /** Reset annual trudodni for all workers (call at year boundary). */
  resetAnnualTrudodni(): void {
    this.trudodniTracker.clear();
  }

  /**
   * Spawn or remove citizen entities to match the target population count.
   * Spawns workers when below target, removes excess when above.
   */
  syncPopulation(targetPopulation: number): void {
    const currentCitizens = [...citizens];
    const diff = targetPopulation - currentCitizens.length;

    if (diff > 0) {
      for (let i = 0; i < diff; i++) {
        this.spawnWorker();
      }
    } else if (diff < 0) {
      // Remove excess workers (prefer idle/unassigned first)
      const sorted = currentCitizens.sort((a, b) => {
        const aAssigned = a.citizen.assignment != null ? 1 : 0;
        const bAssigned = b.citizen.assignment != null ? 1 : 0;
        return aAssigned - bAssigned;
      });
      for (let i = 0; i < -diff && i < sorted.length; i++) {
        this.removeWorker(sorted[i]!, 'population_sync');
      }
    }

    // Keep resource store in sync with entity count
    const store = getResourceEntity();
    if (store) {
      store.resources.population = this.getPopulation();
    }
  }

  /**
   * Spawn a single worker with random class distribution.
   * Uses weighted random selection from CLASS_WEIGHTS.
   */
  spawnWorker(
    homeX?: number,
    homeY?: number,
    overrides?: Partial<Pick<WorkerStats, 'morale' | 'loyalty' | 'skill'>>,
  ): Entity {
    const rng = this.rng;
    const classIndex = rng ? rng.weightedIndex(CLASS_WEIGHTS) : 0;
    const citizenClass = CLASS_ORDER[classIndex]!;
    const generated = rng ? generateWorkerName(rng) : { name: 'Unnamed Worker', gender: 'male' as const };
    const name = generated.name;

    const entity = createCitizen(citizenClass, homeX, homeY);
    if (entity.citizen) {
      entity.citizen.name = name;
      if (!entity.citizen.gender) entity.citizen.gender = generated.gender;
    }

    const stats: WorkerStats = {
      morale: overrides?.morale ?? 50,
      loyalty: overrides?.loyalty ?? (rng ? rng.int(40, 80) : 60),
      skill: overrides?.skill ?? (rng ? rng.int(10, 40) : 25),
      vodkaDependency: citizenClass === 'prisoner' ? 0 : rng ? rng.int(5, 30) : 15,
      ticksSinceVodka: 0,
      name,
      assignmentDuration: 0,
      assignmentSource: 'auto',
    };

    this.stats.set(entity, stats);
    return entity;
  }

  /**
   * Remove a worker from the world and clean up stats.
   * @param entity - The citizen entity to remove
   * @param _reason - Reason for removal (for logging/events)
   */
  removeWorker(entity: Entity, _reason: string): void {
    this.stats.delete(entity);
    this.trudodniTracker.delete(entity);
    world.remove(entity);
  }

  /**
   * Assign a worker to a building at the given grid position.
   */
  assignWorker(
    worker: Entity,
    buildingGridX: number,
    buildingGridY: number,
    source: 'player' | 'forced' | 'auto' = 'player',
  ): boolean {
    if (!worker.citizen) return false;

    const buildingsQuery = world.with('position', 'building');
    let targetBuilding: Entity | null = null;
    for (const b of buildingsQuery) {
      if (b.position.gridX === buildingGridX && b.position.gridY === buildingGridY) {
        targetBuilding = b;
        break;
      }
    }
    if (!targetBuilding?.building) return false;

    worker.citizen.assignment = targetBuilding.building.defId;
    world.reindex(worker);

    const stats = this.stats.get(worker);
    if (stats) {
      stats.assignmentDuration = 0;
      stats.assignmentSource = source;
    }

    // Track player overrides for political cost
    if (source === 'player') {
      this.overrideCount++;
    }

    return true;
  }

  /** Unassign a worker from their current building. */
  unassignWorker(worker: Entity): void {
    if (!worker.citizen) return;
    worker.citizen.assignment = undefined;
    world.reindex(worker);

    const stats = this.stats.get(worker);
    if (stats) {
      stats.assignmentDuration = 0;
    }
  }

  /** Get the number of player overrides this era. */
  getOverrideCount(): number {
    return this.overrideCount;
  }

  /** Returns true if the chairman has been meddling (5+ overrides). */
  isChairmanMeddling(): boolean {
    return this.overrideCount >= 5;
  }

  /** Reset override count (called on era transitions). */
  resetOverrideCount(): void {
    this.overrideCount = 0;
  }

  // ── KGB Arrest (called externally) ─────────────────────

  /**
   * Remove a worker due to KGB arrest. Returns the drain event if successful.
   * Called by SimulationEngine when personnel file triggers an arrest.
   */
  arrestWorker(): PopulationDrainEvent | null {
    // Pick a random non-party worker
    const eligible = [...citizens].filter((e) => {
      const cls = e.citizen.class;
      return cls !== 'party_official' && cls !== 'prisoner';
    });
    if (eligible.length === 0) return null;

    const rng = this.rng;
    const target = rng ? eligible[rng.int(0, eligible.length - 1)]! : eligible[0]!;
    const stats = this.stats.get(target);
    const name = stats?.name ?? target.citizen.name ?? 'Unknown';
    const cls = target.citizen.class;

    this.removeWorker(target, 'kgb_arrest');
    return { name, class: cls, reason: 'kgb_arrest' };
  }

  // ── Population Inflows (called externally) ──────────────

  /**
   * Moscow sends new workers by decree.
   * Returns the inflow event with count of workers added.
   */
  moscowAssignment(): PopulationInflowEvent {
    const rng = this.rng;
    const count = rng ? rng.int(MOSCOW_ASSIGNMENT_COUNT[0], MOSCOW_ASSIGNMENT_COUNT[1]) : MOSCOW_ASSIGNMENT_COUNT[0];

    for (let i = 0; i < count; i++) {
      this.spawnWorker();
    }

    return { count, reason: 'moscow_assignment', averageMorale: 50 };
  }

  /**
   * Forced resettlement — hostile workers arrive with low morale.
   */
  forcedResettlement(): PopulationInflowEvent {
    const rng = this.rng;
    const count = rng
      ? rng.int(FORCED_RESETTLEMENT_COUNT[0], FORCED_RESETTLEMENT_COUNT[1])
      : FORCED_RESETTLEMENT_COUNT[0];

    let moraleSum = 0;
    for (let i = 0; i < count; i++) {
      const morale = rng
        ? rng.int(FORCED_RESETTLEMENT_MORALE[0], FORCED_RESETTLEMENT_MORALE[1])
        : FORCED_RESETTLEMENT_MORALE[0];
      const loyalty = rng ? rng.int(5, 25) : 10;
      this.spawnWorker(undefined, undefined, { morale, loyalty });
      moraleSum += morale;
    }

    return {
      count,
      reason: 'forced_resettlement',
      averageMorale: count > 0 ? moraleSum / count : 0,
    };
  }

  /**
   * Kolkhoz amalgamation — neighboring collective merges, many workers arrive.
   */
  kolkhozAmalgamation(): PopulationInflowEvent {
    const rng = this.rng;
    const count = rng
      ? rng.int(KOLKHOZ_AMALGAMATION_COUNT[0], KOLKHOZ_AMALGAMATION_COUNT[1])
      : KOLKHOZ_AMALGAMATION_COUNT[0];

    let moraleSum = 0;
    for (let i = 0; i < count; i++) {
      const morale = rng ? rng.int(30, 60) : 45;
      const skill = rng ? rng.int(15, 50) : 30;
      this.spawnWorker(undefined, undefined, { morale, skill });
      moraleSum += morale;
    }

    return {
      count,
      reason: 'kolkhoz_amalgamation',
      averageMorale: count > 0 ? moraleSum / count : 0,
    };
  }

  // ── Main Tick ───────────────────────────────────────────

  /**
   * Process one simulation tick for all workers.
   *
   * Accepts either a full context object or legacy positional args
   * (vodkaAvailable, foodAvailable, heatingFailing).
   */
  tick(ctx: WorkerTickContext): WorkerTickResult;
  tick(vodkaAvailable: number, foodAvailable: number, heatingFailing?: boolean): WorkerTickResult;
  tick(ctxOrVodka: WorkerTickContext | number, foodAvailable?: number, heatingFailing?: boolean): WorkerTickResult {
    const ctx: WorkerTickContext =
      typeof ctxOrVodka === 'number'
        ? {
            vodkaAvailable: ctxOrVodka,
            foodAvailable: foodAvailable ?? 0,
            heatingFailing: heatingFailing ?? false,
            month: 1,
            eraId: 'revolution',
            totalTicks: this.tickCounter,
          }
        : ctxOrVodka;
    return this._tick(ctx);
  }

  private _tick(ctx: WorkerTickContext): WorkerTickResult {
    const stakhanovites: WorkerTickResult['stakhanovites'] = [];
    const drains: PopulationDrainEvent[] = [];
    const inflows: PopulationInflowEvent[] = [];

    const tickCtx: TickContext = {
      remainingVodka: ctx.vodkaAvailable,
      remainingFood: ctx.foodAvailable,
      vodkaConsumed: 0,
      foodConsumed: 0,
      partyOfficialCount: 0,
      rng: this.rng,
      heatingFailing: ctx.heatingFailing,
    };

    for (const c of citizens) {
      if (c.citizen.class === 'party_official') tickCtx.partyOfficialCount++;
    }

    const { classEffSum, classCount, toRemove } = this.processCitizens(tickCtx, stakhanovites, ctx.trudodniRatio);

    // Process defections
    for (const { entity, name, cls } of toRemove) {
      const reason = cls === 'prisoner' ? ('escape' as const) : ('defection' as const);
      this.removeWorker(entity, reason);
      drains.push({ name, class: cls, reason });
    }

    // Population drains — periodic checks
    this.processMigrationFlight(ctx.totalTicks, drains);
    this.processYouthFlight(ctx.totalTicks, drains);
    this.processWorkplaceAccidents(drains);

    // Trudodni tracking for assigned workers
    this.trackTrudodni();

    // Governor
    this.runGovernorTick();

    // Compute class efficiency averages
    const classEfficiency = emptyClassRecord();
    for (const cls of CLASS_ORDER) {
      classEfficiency[cls] = classCount[cls] > 0 ? classEffSum[cls]! / classCount[cls]! : 0;
    }

    // Sync authoritative population to resource store
    const population = this.getPopulation();
    const store = getResourceEntity();
    if (store) {
      store.resources.population = population;
    }

    const averageMorale = this.getAverageMorale();

    return {
      vodkaConsumed: tickCtx.vodkaConsumed,
      foodConsumed: tickCtx.foodConsumed,
      defections: drains
        .filter((d) => d.reason === 'defection' || d.reason === 'escape')
        .map((d) => ({ name: d.name, class: d.class })),
      stakhanovites,
      classEfficiency,
      drains,
      inflows,
      averageMorale,
      population,
    };
  }

  // ── Drain Processors ────────────────────────────────────

  /**
   * Migration/flight — workers flee when collective morale is low.
   * The core survival mechanic of the game.
   */
  private processMigrationFlight(totalTicks: number, drains: PopulationDrainEvent[]): void {
    if (totalTicks % FLIGHT_CHECK_INTERVAL !== 0 || totalTicks === 0) return;

    const avgMorale = this.getAverageMorale();
    if (avgMorale >= FLIGHT_MORALE_THRESHOLD) return;

    const rng = this.rng;
    const [min, max] = avgMorale < FLIGHT_MORALE_CRITICAL ? FLIGHT_COUNT_CRITICAL : FLIGHT_COUNT_NORMAL;
    const fleeCount = rng ? rng.int(min, max) : min;

    // Select lowest-morale workers to flee
    const eligible = [...citizens]
      .map((e) => ({ entity: e, stats: this.stats.get(e) }))
      .filter((w) => w.stats != null && w.entity.citizen.class !== 'prisoner')
      .sort((a, b) => a.stats!.morale - b.stats!.morale);

    const toFlee = eligible.slice(0, fleeCount);
    for (const { entity, stats } of toFlee) {
      drains.push({
        name: stats!.name,
        class: entity.citizen.class,
        reason: 'migration',
      });
      this.removeWorker(entity, 'migration');
    }
  }

  /**
   * Youth flight — young workers (16-25) leave if conditions are bad
   * and the settlement lacks cultural/educational buildings.
   */
  private processYouthFlight(totalTicks: number, drains: PopulationDrainEvent[]): void {
    if (totalTicks % YOUTH_FLIGHT_INTERVAL !== 0 || totalTicks === 0) return;

    const avgMorale = this.getAverageMorale();
    if (avgMorale >= YOUTH_FLIGHT_MORALE_THRESHOLD) return;

    // Check if any youth retention buildings exist
    const hasRetention = [...operationalBuildings].some((e) => YOUTH_RETENTION_BUILDINGS.includes(e.building.defId));
    if (hasRetention) return;

    // One youth flees per check
    const youth = [...citizens].filter((e) => {
      const age = e.citizen.age ?? 25;
      return age >= YOUTH_MIN_AGE && age <= YOUTH_MAX_AGE && e.citizen.class !== 'prisoner';
    });

    if (youth.length === 0) return;

    const rng = this.rng;
    const target = rng ? youth[rng.int(0, youth.length - 1)]! : youth[0]!;
    const stats = this.stats.get(target);

    drains.push({
      name: stats?.name ?? target.citizen.name ?? 'Unknown Youth',
      class: target.citizen.class,
      reason: 'youth_flight',
    });
    this.removeWorker(target, 'youth_flight');
  }

  /**
   * Workplace accidents — factories occasionally kill workers.
   * Probability based on factory count and worker skill.
   */
  private processWorkplaceAccidents(drains: PopulationDrainEvent[]): void {
    const rng = this.rng;

    // Count operational factories
    let factoryCount = 0;
    for (const entity of buildingsLogic) {
      const phase = entity.building.constructionPhase;
      if ((phase == null || phase === 'complete') && entity.building.powered) {
        const defId = entity.building.defId;
        if (defId.includes('factory') || defId.includes('industrial') || defId === 'vodka-distillery') {
          factoryCount++;
        }
      }
    }

    if (factoryCount === 0) return;

    // Check for accident per factory
    for (let i = 0; i < factoryCount; i++) {
      const roll = rng?.random() ?? Math.random();
      if (roll < ACCIDENT_RATE_PER_FACTORY) {
        // Find a factory-assigned worker to be the victim
        const factoryWorkers = [...citizens].filter((e) => {
          const assignment = e.citizen.assignment;
          if (!assignment) return false;
          return (
            assignment.includes('factory') || assignment.includes('industrial') || assignment === 'vodka-distillery'
          );
        });

        if (factoryWorkers.length === 0) continue;

        // Low-skill workers more likely to be victims
        let victim: Entity;
        const lowSkill = factoryWorkers.filter((e) => {
          const stats = this.stats.get(e);
          return stats && stats.skill < 20;
        });

        if (lowSkill.length > 0 && (rng?.random() ?? Math.random()) < ACCIDENT_LOW_SKILL_MULT / 3) {
          victim = rng ? lowSkill[rng.int(0, lowSkill.length - 1)]! : lowSkill[0]!;
        } else {
          victim = rng ? factoryWorkers[rng.int(0, factoryWorkers.length - 1)]! : factoryWorkers[0]!;
        }

        const stats = this.stats.get(victim);
        drains.push({
          name: stats?.name ?? victim.citizen?.name ?? 'Unknown Worker',
          class: victim.citizen?.class ?? 'worker',
          reason: 'workplace_accident',
        });
        this.removeWorker(victim, 'workplace_accident');
        break; // One accident per tick max
      }
    }
  }

  // ── Trudodni Tracking ───────────────────────────────────

  /** Track trudodni earned per tick for assigned workers. */
  private trackTrudodni(): void {
    for (const entity of citizens) {
      if (!entity.citizen.assignment) continue;
      const current = this.trudodniTracker.get(entity) ?? 0;
      this.trudodniTracker.set(entity, current + TRUDODNI_PER_TICK);
    }
  }

  // ── Internal Processing ─────────────────────────────────

  /** Process all citizens: vodka, food, morale, defection, production. */
  private processCitizens(ctx: TickContext, stakhanovites: WorkerTickResult['stakhanovites'], trudodniRatio?: number) {
    const classEffSum = emptyClassRecord();
    const classCount = emptyClassRecord();
    const toRemove: Array<{ entity: Entity; name: string; cls: CitizenComponent['class'] }> = [];

    for (const entity of [...citizens]) {
      const stats = this.stats.get(entity);
      if (!stats) continue;

      const cls = entity.citizen.class;
      processVodka(stats, cls, ctx);
      processFood(entity.citizen, stats, ctx);
      applyMorale(entity.citizen, stats, ctx.partyOfficialCount, ctx.heatingFailing);

      // FIX-08: Trudodni -> morale: meeting the minimum gives a small morale boost
      if (trudodniRatio !== undefined) {
        if (trudodniRatio >= 1.0) {
          // Meeting or exceeding trudodni minimum: +2 morale (capped)
          stats.morale = Math.min(100, stats.morale + 2);
        } else if (trudodniRatio < 0.5) {
          // Severely underperforming: -3 morale (comrades notice slacking)
          stats.morale = Math.max(0, stats.morale - 3);
        }
        entity.citizen.happiness = Math.round(stats.morale);
      }

      if (checkDefection(cls, stats, ctx.rng)) {
        toRemove.push({ entity, name: stats.name, cls });
        continue;
      }

      const efficiency = processProductionAndGrowth(stats, entity.citizen.assignment, cls, ctx.rng, stakhanovites);
      classEffSum[cls] += efficiency;
      classCount[cls]++;
    }
    return { classEffSum, classCount, toRemove };
  }

  /** Run behavioral governor on throttled interval. */
  private runGovernorTick(): void {
    this.tickCounter++;
    if (this.tickCounter % GOVERNOR_INTERVAL !== 0) return;
    const store = getResourceEntity();
    if (!store) return;
    for (const entity of [...citizens]) {
      const stats = this.stats.get(entity);
      if (!stats) continue;
      const recommendation = runGovernor(entity, stats, store.resources, this.collectiveFocus);
      if (!recommendation) continue;
      entity.citizen.assignment = recommendation.buildingDefId;
      stats.assignmentSource = 'auto';
      stats.assignmentDuration = 0;
      world.reindex(entity);
    }
  }

  // ── Serialization ────────────────────────────────────

  /** Serialize system state for save/load. */
  serialize(): WorkerSystemSaveData {
    const workers: WorkerStatEntry[] = [];
    for (const entity of citizens) {
      const stats = this.stats.get(entity);
      if (!stats) continue;
      workers.push({
        class: entity.citizen.class,
        stats: { ...stats },
      });
    }
    return { workers };
  }

  /** Restore system state from save data, re-linking stats to existing ECS citizen entities. */
  static deserialize(data: WorkerSystemSaveData, rng?: GameRng): WorkerSystem {
    const system = new WorkerSystem(rng);

    const byName = new Map<string, WorkerStatEntry>();
    for (const entry of data.workers) {
      byName.set(entry.stats.name, entry);
    }

    for (const entity of citizens) {
      const stats = system.stats.get(entity);
      if (stats) continue;

      const entityName = findEntityName(entity, byName);
      if (entityName) {
        const entry = byName.get(entityName)!;
        system.stats.set(entity, { ...entry.stats });
        byName.delete(entityName);
      }
    }

    return system;
  }

  /** Get display info for a single worker entity. */
  getWorkerInfo(entity: Entity): WorkerDisplayInfo | null {
    if (!entity.citizen) return null;
    const stats = this.stats.get(entity);
    if (!stats) return null;

    const cls = entity.citizen.class;
    const assignment = entity.citizen.assignment ?? null;

    return {
      name: stats.name,
      class: cls,
      morale: Math.round(stats.morale),
      assignment,
      status: resolveStatus(entity.citizen, stats),
      productionEfficiency: clamp(
        calcBaseEfficiency(stats.morale, stats.skill) + calcClassBonus(cls, assignment ?? undefined),
        0,
        1.5,
      ),
    };
  }
}

/**
 * Attempt to find a saved worker entry matching a citizen entity.
 */
function findEntityName(entity: Entity, byName: Map<string, WorkerStatEntry>): string | null {
  if (!entity.citizen) return null;
  const cls = entity.citizen.class;

  for (const [name, entry] of byName) {
    if (entry.class === cls) return name;
  }
  const first = byName.keys().next();
  return first.done ? null : first.value;
}
