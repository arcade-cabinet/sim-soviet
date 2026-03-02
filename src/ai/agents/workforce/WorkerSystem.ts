/**
 * @fileoverview WorkerSystem — AUTHORITATIVE population manager.
 *
 * This is the single source of truth for population count.
 * In entity mode: the ECS citizen entity count IS the population.
 * In aggregate mode: RaionPool.totalPopulation IS the population,
 * and building entities track per-building workforce aggregates.
 *
 * populationSystem is no longer used for growth — this system handles:
 *   - Spawning/removing citizen entities (entity mode)
 *   - Incrementing/decrementing building workforce + raion pool (aggregate mode)
 *   - Per-worker tick (vodka, food, morale, defection, production)
 *   - Population drains (migration, youth flight, KGB arrest, disease, accidents)
 *   - Population inflows (Moscow assignments, forced resettlement, kolkhoz)
 *   - Trudodni tracking
 *   - Behavioral governor
 */

import {
  buildingsLogic,
  citizens,
  dvory,
  getResourceEntity,
  maleCitizens,
  operationalBuildings,
} from '@/ecs/archetypes';
import { createCitizen, createDvor } from '@/ecs/factories';
import { laborCapacityForAge } from '@/ecs/factories/demographics';
import type { BuildingComponent, CitizenComponent, DvorMember, Entity, RaionPool } from '@/ecs/world';
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
  FOOD_PER_WORKER,
  FORCED_RESETTLEMENT_COUNT,
  FORCED_RESETTLEMENT_MORALE,
  KOLKHOZ_AMALGAMATION_COUNT,
  MOSCOW_ASSIGNMENT_COUNT,
  TRUDODNI_PER_TICK,
  VODKA_PER_WORKER,
  YOUTH_FLIGHT_INTERVAL,
  YOUTH_FLIGHT_MORALE_THRESHOLD,
  YOUTH_MAX_AGE,
  YOUTH_MIN_AGE,
  YOUTH_RETENTION_BUILDINGS,
} from './constants';
import type { CollectiveFocus } from '../infrastructure/CollectiveAgent';
import { runGovernor } from '../infrastructure/CollectiveAgent';
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

/**
 * Authoritative population manager: spawns/removes citizen entities,
 * processes per-worker consumption/production/morale each tick,
 * handles population drains/inflows, and runs the behavioral governor.
 *
 * Supports two modes:
 * - **Entity mode**: individual citizen ECS entities (pop <= 200)
 * - **Aggregate mode**: statistical tracking via RaionPool + building workforce fields (pop > 200)
 */
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

  // ── Aggregate Mode Helpers ────────────────────────────────

  /**
   * Returns the RaionPool if the game is in aggregate mode, or undefined
   * if still in entity mode. This is the canonical aggregate-mode check.
   */
  private getRaion(): RaionPool | undefined {
    const store = getResourceEntity();
    return store?.resources.raion;
  }

  /** Whether the system is operating in aggregate mode. */
  isAggregateMode(): boolean {
    return this.getRaion() != null;
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

  /**
   * Remove all citizen entities from the world and clear all stats.
   * In aggregate mode, resets building workforce fields and clears the raion pool.
   * Used during save-load restoration to reset before re-creating from saved dvory.
   */
  clearAllWorkers(): void {
    const raion = this.getRaion();
    if (raion) {
      // Aggregate mode: reset building workforce fields
      for (const b of buildingsLogic) {
        b.building.workerCount = 0;
        b.building.residentCount = 0;
        b.building.avgMorale = 0;
        b.building.avgSkill = 0;
        b.building.avgLoyalty = 0;
        b.building.avgVodkaDep = 0;
        b.building.trudodniAccrued = 0;
        b.building.householdCount = 0;
      }
      // Clear the raion pool from resource store
      const store = getResourceEntity();
      if (store) {
        store.resources.raion = undefined;
      }
    } else {
      // Entity mode: remove citizen entities
      for (const entity of [...citizens]) {
        world.remove(entity);
      }
    }
    this.stats.clear();
    this.trudodniTracker.clear();
  }

  /**
   * Restore previously-saved stats for a citizen entity.
   * Used during save-load restoration to overwrite the defaults
   * created by syncPopulationFromDvory().
   */
  restoreWorkerStats(entity: Entity, stats: WorkerStats): void {
    this.stats.set(entity, { ...stats });
  }

  /**
   * Authoritative population count.
   * Entity mode: citizen entity count.
   * Aggregate mode: raion.totalPopulation.
   */
  getPopulation(): number {
    const raion = this.getRaion();
    if (raion) return raion.totalPopulation;
    return [...citizens].length;
  }

  /**
   * Calculate average morale across all workers.
   * Aggregate mode reads from raion.avgMorale.
   */
  getAverageMorale(): number {
    const raion = this.getRaion();
    if (raion) return raion.avgMorale;
    let sum = 0;
    let count = 0;
    for (const stats of this.stats.values()) {
      sum += stats.morale;
      count++;
    }
    return count > 0 ? sum / count : 50;
  }

  /**
   * Calculate average skill across all workers, mapped to a multiplier.
   *
   * Raw skill values are in [0..100]. This maps to [0.5..1.5]:
   * - skill 0   -> 0.5  (half efficiency)
   * - skill 50  -> 1.0  (baseline)
   * - skill 100 -> 1.5  (50% bonus)
   *
   * Aggregate mode reads from raion.avgSkill.
   *
   * @returns Skill multiplier in [0.5..1.5], defaults to 1.0 if no workers
   */
  getAverageSkill(): number {
    const raion = this.getRaion();
    if (raion) {
      return 0.5 + (raion.avgSkill / 100);
    }
    let sum = 0;
    let count = 0;
    for (const stats of this.stats.values()) {
      sum += stats.skill;
      count++;
    }
    if (count === 0) return 1.0;
    const avgSkill = sum / count; // [0..100]
    return 0.5 + (avgSkill / 100);  // [0.5..1.5]
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
   * Create a new dvor for incoming population (inflow events) and spawn linked citizens.
   *
   * In entity mode: creates dvor + citizen entities as before.
   * In aggregate mode: increments raion pool counts and distributes workers
   * to building workforces (idle pool first, then lowest-staffed buildings).
   *
   * @param count - Number of adults to add
   * @param reason - Descriptive tag for the dvor ID (e.g. 'moscow', 'growth')
   * @param overrides - Optional stat overrides per worker (morale, loyalty, skill)
   * @returns Array of spawned citizen entities (empty in aggregate mode)
   */
  spawnInflowDvor(
    count: number,
    reason: string,
    overrides?: Partial<Pick<WorkerStats, 'morale' | 'loyalty' | 'skill'>>,
  ): Entity[] {
    if (count <= 0) return [];

    const raion = this.getRaion();
    if (raion) {
      return this.spawnInflowAggregate(count, overrides);
    }

    const rng = this.rng;
    const timestamp = Date.now();
    const dvorId = `${reason}-${timestamp}-${rng ? rng.int(0, 9999) : 0}`;

    // Generate member seeds with proper Russian names
    const memberSeeds: Array<{ name: string; gender: 'male' | 'female'; age: number }> = [];
    let surname = 'Unknown';
    for (let i = 0; i < count; i++) {
      const generated = rng ? generateWorkerName(rng) : { name: 'Unnamed Worker', gender: 'male' as const };
      // Extract surname from the full name (last word)
      const parts = generated.name.split(' ');
      if (i === 0) surname = parts[parts.length - 1] ?? 'Unknown';
      const age = rng ? rng.int(18, 45) : 30;
      memberSeeds.push({ name: generated.name, gender: generated.gender, age });
    }

    // Create the dvor entity with all members
    const dvorEntity = createDvor(dvorId, surname, memberSeeds);
    if (!dvorEntity.dvor) return [];

    // Spawn citizen entities linked to each dvor member
    const spawned: Entity[] = [];
    for (const member of dvorEntity.dvor.members) {
      const entity = this.spawnWorkerFromDvor(member, dvorId);
      if (entity) {
        // Apply stat overrides if provided
        if (overrides) {
          const stats = this.stats.get(entity);
          if (stats) {
            if (overrides.morale !== undefined) stats.morale = overrides.morale;
            if (overrides.loyalty !== undefined) stats.loyalty = overrides.loyalty;
            if (overrides.skill !== undefined) stats.skill = overrides.skill;
          }
        }
        spawned.push(entity);
      }
    }

    return spawned;
  }

  /**
   * Aggregate-mode inflow: increments raion pool counts and distributes
   * incoming workers to building workforces.
   */
  private spawnInflowAggregate(
    count: number,
    overrides?: Partial<Pick<WorkerStats, 'morale' | 'loyalty' | 'skill'>>,
  ): Entity[] {
    const raion = this.getRaion()!;
    const rng = this.rng;
    const morale = overrides?.morale ?? 50;
    const loyalty = overrides?.loyalty ?? 50;
    const skill = overrides?.skill ?? 30;

    // Update raion totals
    raion.totalPopulation += count;
    raion.totalHouseholds += 1; // One new household
    raion.idleWorkers += count;
    raion.laborForce += count;

    // Blend incoming workers into raion averages
    const oldPop = raion.totalPopulation - count;
    if (oldPop > 0) {
      raion.avgMorale = (raion.avgMorale * oldPop + morale * count) / raion.totalPopulation;
      raion.avgLoyalty = (raion.avgLoyalty * oldPop + loyalty * count) / raion.totalPopulation;
      raion.avgSkill = (raion.avgSkill * oldPop + skill * count) / raion.totalPopulation;
    } else {
      raion.avgMorale = morale;
      raion.avgLoyalty = loyalty;
      raion.avgSkill = skill;
    }

    // Add to age-sex buckets (all working-age adults)
    for (let i = 0; i < count; i++) {
      const age = rng ? rng.int(18, 45) : 30;
      const bucket = Math.min(Math.floor(age / 5), 19);
      const isMale = rng ? rng.coinFlip() : i % 2 === 0;
      if (isMale) {
        raion.maleAgeBuckets[bucket]++;
      } else {
        raion.femaleAgeBuckets[bucket]++;
      }
    }

    // Update class counts (default to worker class)
    raion.classCounts['worker'] = (raion.classCounts['worker'] ?? 0) + count;

    // Sync resource store population
    const store = getResourceEntity();
    if (store) {
      store.resources.population = raion.totalPopulation;
    }

    return []; // No entities spawned in aggregate mode
  }

  /**
   * Remove N citizens by priority (idle/unassigned first, lowest morale).
   * Entity mode: uses removeWorker() which handles dvor member cleanup.
   * Aggregate mode: decrements from building workforces (idle first, then lowest-morale buildings).
   *
   * @param count - Number of citizens to remove
   * @param reason - Reason for removal (logged on each removeWorker call)
   */
  removeWorkersByCount(count: number, reason: string): void {
    if (count <= 0) return;

    const raion = this.getRaion();
    if (raion) {
      this.removeWorkersAggregate(count, raion);
      return;
    }

    const currentCitizens = [...citizens];
    // Prefer idle/unassigned, then lowest morale
    const sorted = currentCitizens.sort((a, b) => {
      const aAssigned = a.citizen.assignment != null ? 1 : 0;
      const bAssigned = b.citizen.assignment != null ? 1 : 0;
      if (aAssigned !== bAssigned) return aAssigned - bAssigned;
      // Among same assignment status, remove lowest morale first
      const aMorale = this.stats.get(a)?.morale ?? 50;
      const bMorale = this.stats.get(b)?.morale ?? 50;
      return aMorale - bMorale;
    });

    const toRemove = Math.min(count, sorted.length);
    for (let i = 0; i < toRemove; i++) {
      this.removeWorker(sorted[i]!, reason);
    }

    // Sync resource store
    const store = getResourceEntity();
    if (store) {
      store.resources.population = this.getPopulation();
    }
  }

  /**
   * Aggregate-mode worker removal: decrement idle pool first,
   * then from buildings sorted by lowest morale (weakest first).
   */
  private removeWorkersAggregate(count: number, raion: RaionPool): void {
    const totalRemoved = Math.min(count, raion.totalPopulation);
    let remaining = totalRemoved;

    // Phase 1: remove from idle pool
    const fromIdle = Math.min(remaining, raion.idleWorkers);
    raion.idleWorkers -= fromIdle;
    remaining -= fromIdle;

    // Phase 2: remove from building workforces (lowest morale first)
    if (remaining > 0) {
      const staffed = [...buildingsLogic]
        .filter((e) => e.building.workerCount > 0)
        .sort((a, b) => a.building.avgMorale - b.building.avgMorale);

      for (const entity of staffed) {
        if (remaining <= 0) break;
        const bld = entity.building;
        const take = Math.min(remaining, bld.workerCount);
        bld.workerCount -= take;
        raion.assignedWorkers = Math.max(0, raion.assignedWorkers - take);
        remaining -= take;
      }
    }

    // Phase 3: decrement age buckets to keep them in sync with totalPopulation.
    // Removed workers were working-age, so decrement working-age buckets first.
    let bucketRemaining = totalRemoved;

    // Working-age male buckets first (3-12 = ages 15-64), youngest first
    for (let i = 3; i <= 12 && bucketRemaining > 0; i++) {
      const take = Math.min(bucketRemaining, raion.maleAgeBuckets[i]!);
      raion.maleAgeBuckets[i]! -= take;
      bucketRemaining -= take;
    }

    // Working-age female buckets (3-12), youngest first
    for (let i = 3; i <= 12 && bucketRemaining > 0; i++) {
      const take = Math.min(bucketRemaining, raion.femaleAgeBuckets[i]!);
      raion.femaleAgeBuckets[i]! -= take;
      bucketRemaining -= take;
    }

    // Fallback: any remaining from non-working-age buckets
    if (bucketRemaining > 0) {
      for (let i = 0; i < 20 && bucketRemaining > 0; i++) {
        if (i >= 3 && i <= 12) continue; // already processed
        const mTake = Math.min(bucketRemaining, raion.maleAgeBuckets[i]!);
        raion.maleAgeBuckets[i]! -= mTake;
        bucketRemaining -= mTake;
        if (bucketRemaining <= 0) break;
        const fTake = Math.min(bucketRemaining, raion.femaleAgeBuckets[i]!);
        raion.femaleAgeBuckets[i]! -= fTake;
        bucketRemaining -= fTake;
      }
    }

    // Update raion totals (clamp to prevent negative population)
    raion.totalPopulation = Math.max(0, raion.totalPopulation - totalRemoved);

    // Recalculate labor force from actual bucket contents
    let laborForce = 0;
    for (let i = 3; i <= 12; i++) {
      laborForce += raion.maleAgeBuckets[i]! + raion.femaleAgeBuckets[i]!;
    }
    raion.laborForce = laborForce;

    // Sync resource store
    const store = getResourceEntity();
    if (store) {
      store.resources.population = raion.totalPopulation;
    }
  }

  /**
   * Remove N citizens, preferring males aged 18-51 (conscription-age).
   * Falls back to females (any working-age) if insufficient males in range.
   * Used for military conscription only — other drains use removeWorkersByCount().
   *
   * Aggregate mode: decrements from male age buckets 3-10 (ages 15-51) first,
   * then falls back to female buckets + general removal.
   *
   * @param count - Number of citizens to conscript
   * @param reason - Reason for removal (e.g. 'conscription')
   * @returns Actual number of citizens removed
   */
  removeWorkersByCountMaleFirst(count: number, reason: string): number {
    if (count <= 0) return 0;

    const raion = this.getRaion();
    if (raion) {
      return this.removeWorkersMaleFirstAggregate(count, raion);
    }

    // Phase 1: males aged 18-51, sorted idle-first then lowest morale
    const eligibleMales = [...maleCitizens]
      .filter((e) => {
        const age = e.citizen.age ?? 25;
        return age >= 18 && age <= 51;
      })
      .sort((a, b) => {
        const aAssigned = a.citizen.assignment != null ? 1 : 0;
        const bAssigned = b.citizen.assignment != null ? 1 : 0;
        if (aAssigned !== bAssigned) return aAssigned - bAssigned;
        const aMorale = this.stats.get(a)?.morale ?? 50;
        const bMorale = this.stats.get(b)?.morale ?? 50;
        return aMorale - bMorale;
      });

    let removed = 0;
    const toRemoveMale = Math.min(count, eligibleMales.length);
    for (let i = 0; i < toRemoveMale; i++) {
      this.removeWorker(eligibleMales[i]!, reason);
      removed++;
    }

    // Phase 2: fallback to any remaining citizens (females, out-of-range males)
    const remaining = count - removed;
    if (remaining > 0) {
      const fallback = [...citizens].sort((a, b) => {
        const aAssigned = a.citizen.assignment != null ? 1 : 0;
        const bAssigned = b.citizen.assignment != null ? 1 : 0;
        if (aAssigned !== bAssigned) return aAssigned - bAssigned;
        const aMorale = this.stats.get(a)?.morale ?? 50;
        const bMorale = this.stats.get(b)?.morale ?? 50;
        return aMorale - bMorale;
      });

      const toRemoveFallback = Math.min(remaining, fallback.length);
      for (let i = 0; i < toRemoveFallback; i++) {
        this.removeWorker(fallback[i]!, reason);
        removed++;
      }
    }

    // Sync resource store
    const store = getResourceEntity();
    if (store) {
      store.resources.population = this.getPopulation();
    }

    return removed;
  }

  /**
   * Aggregate-mode male-first conscription: decrement from male age buckets
   * 3-10 (ages 15-51), then female buckets, then general pool.
   */
  private removeWorkersMaleFirstAggregate(count: number, raion: RaionPool): number {
    let remaining = count;
    let removed = 0;

    // Phase 1: males aged 18-51 (buckets 3-10)
    for (let bucket = 3; bucket <= 10 && remaining > 0; bucket++) {
      const take = Math.min(remaining, raion.maleAgeBuckets[bucket]!);
      raion.maleAgeBuckets[bucket] -= take;
      remaining -= take;
      removed += take;
    }

    // Phase 2: females aged 18-51 (buckets 3-10)
    for (let bucket = 3; bucket <= 10 && remaining > 0; bucket++) {
      const take = Math.min(remaining, raion.femaleAgeBuckets[bucket]!);
      raion.femaleAgeBuckets[bucket] -= take;
      remaining -= take;
      removed += take;
    }

    // Update totals (clamp to prevent negative population)
    raion.totalPopulation = Math.max(0, raion.totalPopulation - removed);

    // Recalculate labor force from actual bucket contents
    let laborForce = 0;
    for (let i = 3; i <= 12; i++) {
      laborForce += raion.maleAgeBuckets[i]! + raion.femaleAgeBuckets[i]!;
    }
    raion.laborForce = laborForce;

    // Decrement from building workforces
    this.removeWorkersFromBuildings(removed, raion);

    // Sync resource store
    const store = getResourceEntity();
    if (store) {
      store.resources.population = raion.totalPopulation;
    }

    return removed;
  }

  /**
   * Shared helper: decrement N workers from building workforces in aggregate mode.
   * Removes from idle pool first, then from lowest-morale buildings.
   */
  private removeWorkersFromBuildings(count: number, raion: RaionPool): void {
    let remaining = count;

    // Remove from idle pool first
    const fromIdle = Math.min(remaining, raion.idleWorkers);
    raion.idleWorkers -= fromIdle;
    remaining -= fromIdle;

    // Then from buildings sorted by lowest morale
    if (remaining > 0) {
      const staffed = [...buildingsLogic]
        .filter((e) => e.building.workerCount > 0)
        .sort((a, b) => a.building.avgMorale - b.building.avgMorale);

      for (const entity of staffed) {
        if (remaining <= 0) break;
        const bld = entity.building;
        const take = Math.min(remaining, bld.workerCount);
        bld.workerCount -= take;
        raion.assignedWorkers = Math.max(0, raion.assignedWorkers - take);
        remaining -= take;
      }
    }
  }

  /**
   * Spawn or remove citizen entities to match the target population count.
   * Spawns workers when below target, removes excess when above.
   * @deprecated Use spawnInflowDvor() for inflows and removeWorkersByCount() for outflows.
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
   * @deprecated Use spawnInflowDvor() for production code. This creates anonymous (non-dvor-linked) citizens.
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
   * Spawn a citizen entity from a dvor member, using the member's real
   * demographic data (gender, age, household link).
   * Skips infants/toddlers under age 5 — they're tracked in dvor members
   * but don't need citizen entities.
   */
  spawnWorkerFromDvor(member: DvorMember, dvorId: string, homeX?: number, homeY?: number): Entity | null {
    if (member.age < 5) return null;

    const capacity = laborCapacityForAge(member.age, member.gender);
    const citizenClass: CitizenComponent['class'] = capacity >= 0.3 ? 'worker' : 'farmer';

    const entity = createCitizen(citizenClass, homeX, homeY, member.gender, member.age, dvorId);
    if (entity.citizen) {
      entity.citizen.name = member.name;
      entity.citizen.dvorMemberId = member.id;
    }

    const rng = this.rng;
    const stats: WorkerStats = {
      morale: 50,
      loyalty: rng ? rng.int(40, 80) : 60,
      skill: rng ? rng.int(10, 40) : 25,
      vodkaDependency: rng ? rng.int(5, 30) : 15,
      ticksSinceVodka: 0,
      name: member.name,
      assignmentDuration: 0,
      assignmentSource: 'auto',
    };

    this.stats.set(entity, stats);
    return entity;
  }

  /**
   * Spawn citizen entities for all members across all dvory in the ECS world.
   * In aggregate mode, returns raion.totalPopulation (no entities to spawn).
   * Returns the total number of citizen entities created / population count.
   */
  syncPopulationFromDvory(): number {
    const raion = this.getRaion();
    if (raion) return raion.totalPopulation;

    let count = 0;
    for (const entity of dvory) {
      for (const member of entity.dvor.members) {
        const spawned = this.spawnWorkerFromDvor(member, entity.dvor.id);
        if (spawned) count++;
      }
    }
    return count;
  }

  /**
   * Sync citizen entity dvorId/dvorMemberId to match current dvor membership.
   *
   * Called after householdFormation() moves members between dvory.
   * Scans all citizen entities with a dvorMemberId and checks if they still
   * exist in their original dvor. If not, finds the new dvor containing
   * a member with a matching name and updates the citizen's links.
   */
  syncCitizenDvorIds(): void {
    for (const entity of citizens) {
      const c = entity.citizen;
      if (!c.dvorId || !c.dvorMemberId) continue;

      // Check if member still exists in the original dvor
      let found = false;
      for (const d of dvory) {
        if (d.dvor.id === c.dvorId) {
          if (d.dvor.members.some((m) => m.id === c.dvorMemberId)) {
            found = true;
          }
          break;
        }
      }
      if (found) continue;

      // Member was moved — find them by name in all dvory
      const name = c.name;
      if (!name) continue;
      for (const d of dvory) {
        const member = d.dvor.members.find((m) => m.name === name);
        if (member) {
          c.dvorId = d.dvor.id;
          c.dvorMemberId = member.id;
          break;
        }
      }
    }
  }

  /**
   * Remove a worker from the world and clean up stats.
   * Also removes the corresponding dvor member if linked.
   * @param entity - The citizen entity to remove
   * @param _reason - Reason for removal (for logging/events)
   * @param skipDvorCleanup - True when deathCheck already removed the dvor member
   */
  removeWorker(entity: Entity, _reason: string, skipDvorCleanup = false): void {
    // Clean up dvor member linkage
    if (!skipDvorCleanup && entity.citizen?.dvorId && entity.citizen?.dvorMemberId) {
      const targetDvorId = entity.citizen.dvorId;
      const targetMemberId = entity.citizen.dvorMemberId;
      for (const d of dvory) {
        if (d.dvor.id === targetDvorId) {
          d.dvor.members = d.dvor.members.filter((m) => m.id !== targetMemberId);
          break;
        }
      }
    }

    this.stats.delete(entity);
    this.trudodniTracker.delete(entity);
    world.remove(entity);
  }

  /**
   * Remove the citizen entity corresponding to a specific dvor member.
   * Called when deathCheck removes a member — the dvor side is already cleaned up.
   * Returns true if a matching citizen was found and removed.
   */
  removeWorkerByDvorMember(dvorId: string, memberId: string): boolean {
    for (const entity of citizens) {
      if (entity.citizen.dvorId === dvorId && entity.citizen.dvorMemberId === memberId) {
        this.removeWorker(entity, 'demographic_death', true);
        return true;
      }
    }
    return false; // No entity — member was under age 5 (infant/toddler)
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
   *
   * Aggregate mode: decrements from raion pool + building workforce.
   */
  arrestWorker(): PopulationDrainEvent | null {
    const raion = this.getRaion();
    if (raion) {
      if (raion.totalPopulation <= 0) return null;
      this.removeWorkersAggregate(1, raion);
      return { name: 'Arrested Citizen', class: 'worker', reason: 'kgb_arrest' };
    }

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

    this.spawnInflowDvor(count, 'moscow');

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

    const morale = rng
      ? rng.int(FORCED_RESETTLEMENT_MORALE[0], FORCED_RESETTLEMENT_MORALE[1])
      : FORCED_RESETTLEMENT_MORALE[0];
    const loyalty = rng ? rng.int(5, 25) : 10;
    this.spawnInflowDvor(count, 'resettlement', { morale, loyalty });

    return {
      count,
      reason: 'forced_resettlement',
      averageMorale: morale,
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

    const morale = rng ? rng.int(30, 60) : 45;
    const skill = rng ? rng.int(15, 50) : 30;
    this.spawnInflowDvor(count, 'kolkhoz', { morale, skill });

    return {
      count,
      reason: 'kolkhoz_amalgamation',
      averageMorale: morale,
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
    const raion = this.getRaion();
    if (raion) {
      return this._tickAggregate(ctx, raion);
    }
    return this._tickEntity(ctx);
  }

  /**
   * Entity-mode tick: processes individual citizen entities.
   */
  private _tickEntity(ctx: WorkerTickContext): WorkerTickResult {
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

  /**
   * Aggregate-mode tick: iterates buildings instead of citizens.
   * Processes consumption, morale, defection, and production at the
   * building level using aggregate workforce stats.
   */
  private _tickAggregate(ctx: WorkerTickContext, raion: RaionPool): WorkerTickResult {
    const rng = this.rng;
    const drains: PopulationDrainEvent[] = [];
    const inflows: PopulationInflowEvent[] = [];

    let vodkaConsumed = 0;
    let foodConsumed = 0;
    const classEfficiency = emptyClassRecord();
    let totalWorkers = 0;
    let totalEfficiency = 0;

    // Process each staffed building
    for (const entity of buildingsLogic) {
      const bld = entity.building;
      if (bld.workerCount <= 0) continue;

      const wc = bld.workerCount;

      // Food consumption: per-worker rate * count
      const foodNeeded = FOOD_PER_WORKER * wc;
      if (ctx.foodAvailable >= foodNeeded) {
        ctx.foodAvailable -= foodNeeded;
        foodConsumed += foodNeeded;
      } else {
        // Partial food: morale penalty proportional to shortfall
        foodConsumed += ctx.foodAvailable;
        ctx.foodAvailable = 0;
        bld.avgMorale = Math.max(0, bld.avgMorale - 5);
      }

      // Vodka consumption: per-worker rate * average dependency * count
      const vodkaNeeded = VODKA_PER_WORKER * (bld.avgVodkaDep / 50) * wc;
      if (ctx.vodkaAvailable >= vodkaNeeded) {
        ctx.vodkaAvailable -= vodkaNeeded;
        vodkaConsumed += vodkaNeeded;
        bld.avgMorale = Math.min(100, bld.avgMorale + 1);
      } else {
        vodkaConsumed += ctx.vodkaAvailable;
        ctx.vodkaAvailable = 0;
        bld.avgMorale = Math.max(0, bld.avgMorale - 2);
      }

      // Heating failure penalty
      if (ctx.heatingFailing) {
        bld.avgMorale = Math.max(0, bld.avgMorale - 5);
      }

      // Trudodni accrual
      bld.trudodniAccrued += TRUDODNI_PER_TICK * wc;

      // Skill growth
      bld.avgSkill = Math.min(100, bld.avgSkill + 0.01);

      // Production efficiency
      const efficiency = calcBaseEfficiency(bld.avgMorale, bld.avgSkill);
      totalEfficiency += efficiency * wc;
      totalWorkers += wc;

      // Defection check: low-loyalty buildings lose workers
      if (bld.avgLoyalty < 20) {
        const defectionChance = 0.02 * (1 - bld.avgLoyalty / 20);
        const defectors = Math.floor(wc * defectionChance);
        if (defectors > 0) {
          bld.workerCount -= defectors;
          raion.totalPopulation = Math.max(0, raion.totalPopulation - defectors);
          raion.assignedWorkers = Math.max(0, raion.assignedWorkers - defectors);
          raion.laborForce = Math.max(0, raion.laborForce - defectors);

          // Decrement age buckets to stay in sync (working-age males first)
          let bucketRem = defectors;
          for (let bi = 3; bi <= 12 && bucketRem > 0; bi++) {
            const take = Math.min(bucketRem, raion.maleAgeBuckets[bi]!);
            raion.maleAgeBuckets[bi]! -= take;
            bucketRem -= take;
          }
          for (let bi = 3; bi <= 12 && bucketRem > 0; bi++) {
            const take = Math.min(bucketRem, raion.femaleAgeBuckets[bi]!);
            raion.femaleAgeBuckets[bi]! -= take;
            bucketRem -= take;
          }

          drains.push({
            name: `${defectors} workers`,
            class: 'worker',
            reason: 'defection',
          });
        }
      }
    }

    // Set overall class efficiency (simplified: all workers treated as generic)
    const avgEff = totalWorkers > 0 ? totalEfficiency / totalWorkers : 0;
    classEfficiency.worker = avgEff;

    // Aggregate-mode population drains
    this.processMigrationFlightAggregate(ctx.totalTicks, drains, raion);
    this.processYouthFlightAggregate(ctx.totalTicks, drains, raion);
    this.processWorkplaceAccidentsAggregate(drains, raion);

    // Update raion morale from building averages
    this.syncRaionFromBuildings(raion);

    this.tickCounter++;

    // Sync resource store
    const store = getResourceEntity();
    if (store) {
      store.resources.population = raion.totalPopulation;
    }

    return {
      vodkaConsumed,
      foodConsumed,
      defections: drains
        .filter((d) => d.reason === 'defection' || d.reason === 'escape')
        .map((d) => ({ name: d.name, class: d.class })),
      stakhanovites: [],
      classEfficiency,
      drains,
      inflows,
      averageMorale: raion.avgMorale,
      population: raion.totalPopulation,
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
      const roll = rng ? rng.random() : Math.random();
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

        if (lowSkill.length > 0 && (rng ? rng.random() : Math.random()) < ACCIDENT_LOW_SKILL_MULT / 3) {
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

  // ── Aggregate Drain Processors ──────────────────────────

  /**
   * Aggregate-mode migration flight: decrement raion pool when morale is low.
   */
  private processMigrationFlightAggregate(totalTicks: number, drains: PopulationDrainEvent[], raion: RaionPool): void {
    if (totalTicks % FLIGHT_CHECK_INTERVAL !== 0 || totalTicks === 0) return;
    if (raion.avgMorale >= FLIGHT_MORALE_THRESHOLD) return;

    const rng = this.rng;
    const [min, max] = raion.avgMorale < FLIGHT_MORALE_CRITICAL ? FLIGHT_COUNT_CRITICAL : FLIGHT_COUNT_NORMAL;
    const fleeCount = rng ? rng.int(min, max) : min;
    const actual = Math.min(fleeCount, raion.totalPopulation);

    if (actual <= 0) return;

    this.removeWorkersAggregate(actual, raion);
    drains.push({
      name: `${actual} workers`,
      class: 'worker',
      reason: 'migration',
    });
  }

  /**
   * Aggregate-mode youth flight: decrement young workers from raion age buckets.
   */
  private processYouthFlightAggregate(totalTicks: number, drains: PopulationDrainEvent[], raion: RaionPool): void {
    if (totalTicks % YOUTH_FLIGHT_INTERVAL !== 0 || totalTicks === 0) return;
    if (raion.avgMorale >= YOUTH_FLIGHT_MORALE_THRESHOLD) return;

    const hasRetention = [...operationalBuildings].some((e) => YOUTH_RETENTION_BUILDINGS.includes(e.building.defId));
    if (hasRetention) return;

    // Youth age 16-25 = buckets 3-5
    let found = false;
    for (let bucket = 3; bucket <= 5; bucket++) {
      if (raion.maleAgeBuckets[bucket]! > 0) {
        raion.maleAgeBuckets[bucket]--;
        found = true;
        break;
      }
      if (raion.femaleAgeBuckets[bucket]! > 0) {
        raion.femaleAgeBuckets[bucket]--;
        found = true;
        break;
      }
    }

    if (found) {
      raion.totalPopulation--;
      raion.laborForce = Math.max(0, raion.laborForce - 1);
      this.removeWorkersFromBuildings(1, raion);
      drains.push({
        name: 'Young worker',
        class: 'worker',
        reason: 'youth_flight',
      });
    }
  }

  /**
   * Aggregate-mode workplace accidents: probabilistic worker death per factory.
   */
  private processWorkplaceAccidentsAggregate(drains: PopulationDrainEvent[], raion: RaionPool): void {
    const rng = this.rng;
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

    for (let i = 0; i < factoryCount; i++) {
      const roll = rng ? rng.random() : Math.random();
      if (roll < ACCIDENT_RATE_PER_FACTORY) {
        // Find a factory building with workers to be the accident location
        const factoryBuildings = [...buildingsLogic].filter((e) => {
          const bld = e.building;
          if (bld.workerCount <= 0) return false;
          const defId = bld.defId;
          return defId.includes('factory') || defId.includes('industrial') || defId === 'vodka-distillery';
        });

        if (factoryBuildings.length === 0) break;
        const target = rng
          ? factoryBuildings[rng.int(0, factoryBuildings.length - 1)]!
          : factoryBuildings[0]!;

        target.building.workerCount--;
        raion.totalPopulation = Math.max(0, raion.totalPopulation - 1);
        raion.assignedWorkers = Math.max(0, raion.assignedWorkers - 1);
        raion.laborForce = Math.max(0, raion.laborForce - 1);
        raion.deathsThisYear++;
        raion.totalDeaths++;

        drains.push({
          name: 'Factory worker',
          class: 'worker',
          reason: 'workplace_accident',
        });
        break; // One accident per tick max
      }
    }
  }

  /**
   * Sync raion-level averages from building-level workforce data.
   * Called at the end of each aggregate tick.
   */
  private syncRaionFromBuildings(raion: RaionPool): void {
    let moraleSum = 0;
    let loyaltySum = 0;
    let skillSum = 0;
    let totalWorkers = 0;
    let assignedWorkers = 0;

    for (const entity of buildingsLogic) {
      const bld = entity.building;
      if (bld.workerCount <= 0) continue;
      moraleSum += bld.avgMorale * bld.workerCount;
      loyaltySum += bld.avgLoyalty * bld.workerCount;
      skillSum += bld.avgSkill * bld.workerCount;
      totalWorkers += bld.workerCount;
      assignedWorkers += bld.workerCount;
    }

    if (totalWorkers > 0) {
      raion.avgMorale = moraleSum / totalWorkers;
      raion.avgLoyalty = loyaltySum / totalWorkers;
      raion.avgSkill = skillSum / totalWorkers;
    }
    raion.assignedWorkers = assignedWorkers;
    raion.idleWorkers = Math.max(0, raion.laborForce - assignedWorkers);
  }

  // ── Entity GC Sweep ─────────────────────────────────────

  /**
   * Annual safety-net sweep: remove orphan citizen entities.
   *
   * An "orphan" is a citizen entity whose dvorId references a dvor that
   * no longer exists in the world, or whose dvorMemberId no longer exists
   * within the referenced dvor. This can happen from race conditions
   * between demographic death checks and worker system removal.
   *
   * Only runs in entity mode (aggregate mode has no citizen entities).
   * Returns the number of orphans removed.
   */
  sweepOrphanCitizens(): number {
    if (this.isAggregateMode()) return 0;

    // Build a set of valid dvor IDs and member IDs for O(1) lookup
    const validMembers = new Set<string>();
    const validDvorIds = new Set<string>();
    for (const d of dvory) {
      validDvorIds.add(d.dvor.id);
      for (const m of d.dvor.members) {
        validMembers.add(`${d.dvor.id}:${m.id}`);
      }
    }

    const orphans: Entity[] = [];
    for (const entity of citizens) {
      const c = entity.citizen;

      // Citizens without dvor linkage are not orphans — they may be
      // early-game workers spawned before the dvor system existed
      if (!c.dvorId) continue;

      // Check if the dvor itself still exists
      if (!validDvorIds.has(c.dvorId)) {
        orphans.push(entity);
        continue;
      }

      // Check if the member still exists within the dvor
      if (c.dvorMemberId && !validMembers.has(`${c.dvorId}:${c.dvorMemberId}`)) {
        orphans.push(entity);
      }
    }

    for (const entity of orphans) {
      this.removeWorker(entity, 'gc_orphan', true);
    }

    return orphans.length;
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
