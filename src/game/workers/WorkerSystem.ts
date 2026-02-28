/**
 * @fileoverview WorkerSystem orchestrator -- manages citizen entity lifecycle.
 *
 * The existing populationSystem only tracks a number; this system
 * creates and manages actual citizen entities with morale, loyalty,
 * skill, vodka dependency, and class-specific production bonuses.
 */

import { citizens, getResourceEntity } from '@/ecs/archetypes';
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
import { CLASS_ORDER, CLASS_WEIGHTS } from './constants';
import type { CollectiveFocus } from './governor';
import { runGovernor } from './governor';
import type { TickContext, WorkerDisplayInfo, WorkerStats, WorkerTickResult } from './types';

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

/** Governor runs every N ticks to avoid per-tick array copy overhead. */
const GOVERNOR_INTERVAL = 10;

export class WorkerSystem {
  private stats: Map<Entity, WorkerStats> = new Map();
  private rng: GameRng | null;
  private collectiveFocus: CollectiveFocus = 'balanced';
  private tickCounter = 0;

  constructor(rng?: GameRng) {
    this.rng = rng ?? null;
  }

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
  }

  /**
   * Spawn a single worker with random class distribution.
   * Uses weighted random selection from CLASS_WEIGHTS.
   */
  spawnWorker(homeX?: number, homeY?: number): Entity {
    const rng = this.rng;
    const classIndex = rng ? rng.weightedIndex(CLASS_WEIGHTS) : 0;
    const citizenClass = CLASS_ORDER[classIndex]!;
    const generated = rng ? generateWorkerName(rng) : { name: 'Unnamed Worker', gender: 'male' as const };
    const name = generated.name;

    const entity = createCitizen(citizenClass, homeX, homeY);
    // Persist the name on the ECS citizen component
    if (entity.citizen) {
      entity.citizen.name = name;
      if (!entity.citizen.gender) entity.citizen.gender = generated.gender;
    }

    const stats: WorkerStats = {
      morale: 50,
      loyalty: rng ? rng.int(40, 80) : 60,
      skill: rng ? rng.int(10, 40) : 25,
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
    world.remove(entity);
  }

  /**
   * Assign a worker to a building at the given grid position.
   * Sets the citizen's assignment field to the building defId.
   * Returns false if no building found at that position.
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

  /**
   * Process one simulation tick for all workers.
   *
   * Steps:
   * 1. Vodka consumption per worker (based on dependency)
   * 2. Food consumption per worker
   * 3. Morale update (food, vodka, housing, party officials)
   * 4. Defection check for low-loyalty workers
   * 5. Production efficiency calculation
   * 6. Stakhanovite event check
   * 7. Skill growth for assigned workers
   */
  tick(vodkaAvailable: number, foodAvailable: number): WorkerTickResult {
    const stakhanovites: WorkerTickResult['stakhanovites'] = [];
    const ctx: TickContext = {
      remainingVodka: vodkaAvailable,
      remainingFood: foodAvailable,
      vodkaConsumed: 0,
      foodConsumed: 0,
      partyOfficialCount: 0,
      rng: this.rng,
    };

    for (const c of citizens) {
      if (c.citizen.class === 'party_official') ctx.partyOfficialCount++;
    }

    const { classEffSum, classCount, toRemove } = this.processCitizens(ctx, stakhanovites);
    const defections = this.processDefections(toRemove);
    this.runGovernorTick();

    const classEfficiency = emptyClassRecord();
    for (const cls of CLASS_ORDER) {
      classEfficiency[cls] = classCount[cls] > 0 ? classEffSum[cls]! / classCount[cls]! : 0;
    }

    return {
      vodkaConsumed: ctx.vodkaConsumed,
      foodConsumed: ctx.foodConsumed,
      defections,
      stakhanovites,
      classEfficiency,
    };
  }

  /** Process all citizens: vodka, food, morale, defection, production. */
  private processCitizens(ctx: TickContext, stakhanovites: WorkerTickResult['stakhanovites']) {
    const classEffSum = emptyClassRecord();
    const classCount = emptyClassRecord();
    const toRemove: Array<{ entity: Entity; name: string; cls: CitizenComponent['class'] }> = [];

    for (const entity of [...citizens]) {
      const stats = this.stats.get(entity);
      if (!stats) continue;

      const cls = entity.citizen.class;
      processVodka(stats, cls, ctx);
      processFood(entity.citizen, stats, ctx);
      applyMorale(entity.citizen, stats, ctx.partyOfficialCount);

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

  /** Remove defecting/escaping citizens and return defection records. */
  private processDefections(
    toRemove: Array<{ entity: Entity; name: string; cls: CitizenComponent['class'] }>,
  ): WorkerTickResult['defections'] {
    return toRemove.map(({ entity, name, cls }) => {
      this.removeWorker(entity, cls === 'prisoner' ? 'escape' : 'defection');
      return { name, class: cls };
    });
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

    // Build a list of current citizen entities to match against saved stats.
    // Match by name (unique per worker) — order-independent.
    const byName = new Map<string, WorkerStatEntry>();
    for (const entry of data.workers) {
      byName.set(entry.stats.name, entry);
    }

    for (const entity of citizens) {
      const stats = system.stats.get(entity);
      if (stats) continue; // already linked (shouldn't happen on fresh deserialize)

      // Try matching by the name stored on the entity's existing stats
      // (entities recreated by SaveSystem will already be in the ECS).
      // We iterate saved entries to find a match by name.
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
 * Currently matches by iterating saved entries for the same class.
 * Returns the name key if found, null otherwise.
 */
function findEntityName(entity: Entity, byName: Map<string, WorkerStatEntry>): string | null {
  if (!entity.citizen) return null;
  const cls = entity.citizen.class;

  // First pass: exact class match
  for (const [name, entry] of byName) {
    if (entry.class === cls) return name;
  }
  // Fallback: take any remaining entry (class may have changed)
  const first = byName.keys().next();
  return first.done ? null : first.value;
}
