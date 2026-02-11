/**
 * @fileoverview Behavioral Governor — Autonomous Worker AI.
 *
 * Workers in the collective self-organize via a 5-level priority stack:
 *   1. Survive     — food production when starving (hunger > threshold or food crisis)
 *   2. State demand — construction mandates, quota-relevant buildings
 *   3. Trudodni    — fill production buildings to meet labor quotas
 *   4. Improve     — repair damaged infrastructure (durability < 50%)
 *   5. Private     — stay idle, rest at home
 *
 * The player sets a CollectiveFocus that shifts the governor's thresholds.
 * Force-assigned and player-assigned workers are never overridden.
 * Auto-assigned workers can be reassigned when priorities shift.
 *
 * Children (age < 14) are excluded from all governor evaluation.
 */

import { buildingsLogic, underConstruction } from '@/ecs/archetypes';
import type { Entity, Resources } from '@/ecs/world';
import { world } from '@/ecs/world';
import type { WorkerStats } from './types';

// ── Public Types ──────────────────────────────────────────────────────────────

/** The 5-level priority stack, evaluated top-to-bottom. */
export type GovernorPriority = 'survive' | 'state_demand' | 'trudodni' | 'improve' | 'private';

/**
 * Player-controlled collective focus.
 * Shifts governor thresholds to prioritize different activities.
 */
export type CollectiveFocus = 'food' | 'construction' | 'production' | 'balanced';

/** Result of the governor's evaluation — where to assign the worker. */
export interface GovernorRecommendation {
  buildingDefId: string;
  gridX: number;
  gridY: number;
  priority: GovernorPriority;
}

// ── Thresholds ────────────────────────────────────────────────────────────────

/** Food per capita below which the collective is in food crisis. */
export const FOOD_CRISIS_THRESHOLD = 2.0;

/** Hunger level above which an individual worker is starving. */
export const HUNGER_CRISIS_THRESHOLD = 60;

/** Durability percentage below which a building needs repair. */
const REPAIR_THRESHOLD = 50;

/** Minimum age for a worker to receive governor assignments. */
const MIN_WORKING_AGE = 14;

/** Food threshold modifier when player focuses on food production. */
const FOOD_FOCUS_MULTIPLIER = 3.0;

// ── Priority Evaluation ───────────────────────────────────────────────────────

/**
 * Evaluate the highest-priority need for a worker given current state.
 * Returns the priority level — the caller then finds a matching building.
 */
export function evaluateWorkerPriority(
  worker: Entity,
  _stats: WorkerStats,
  resources: Resources,
  focus: CollectiveFocus
): GovernorPriority {
  const hunger = worker.citizen?.hunger ?? 0;
  const foodPerCapita = resources.population > 0 ? resources.food / resources.population : 999;

  // Effective thresholds shift based on collective focus
  const foodThreshold =
    focus === 'food' ? FOOD_CRISIS_THRESHOLD * FOOD_FOCUS_MULTIPLIER : FOOD_CRISIS_THRESHOLD;

  // Level 1: Survive — individual starvation or collective food crisis
  if (hunger >= HUNGER_CRISIS_THRESHOLD || foodPerCapita < foodThreshold) {
    return 'survive';
  }

  // Level 2: State demand — buildings under construction
  // 'construction' or 'balanced' focus routes idle workers to construction.
  // Auto-assigned workers already at production buildings won't be pulled away
  // (runGovernor returns null for auto-assigned workers unless priority is 'survive').
  const hasConstruction = underConstruction.entities.length > 0;
  if (hasConstruction && (focus === 'construction' || focus === 'balanced')) {
    return 'state_demand';
  }

  // Level 3: Trudodni — production buildings need workers
  const hasProducers = hasOperationalProducers();
  if (hasProducers) {
    return 'trudodni';
  }

  // Level 4: Improve — damaged buildings need repair
  const hasDamaged = hasDamagedBuildings();
  if (hasDamaged) {
    return 'improve';
  }

  // Level 5: Private — nothing urgent, worker rests
  return 'private';
}

// ── Assignment Finding ────────────────────────────────────────────────────────

/**
 * Find the best building to assign a worker to for a given priority.
 * Returns null if no suitable building exists.
 */
export function findBestAssignment(
  priority: GovernorPriority,
  _citizenClass: string
): GovernorRecommendation | null {
  switch (priority) {
    case 'survive':
      return findFoodBuilding();
    case 'state_demand':
      return findConstructionSite();
    case 'trudodni':
      return findProductionBuilding();
    case 'improve':
      return findDamagedBuilding();
    case 'private':
      return null;
  }
}

// ── Integrated Governor Run ───────────────────────────────────────────────────

/**
 * Run the full governor pipeline for a single worker.
 *
 * Returns a recommendation if the worker should be (re)assigned,
 * or null if they should keep their current assignment / stay idle.
 *
 * Skips evaluation for:
 * - Children under MIN_WORKING_AGE
 * - Force-assigned workers (assignmentSource === 'forced')
 * - Player-assigned workers (assignmentSource === 'player')
 */
export function runGovernor(
  worker: Entity,
  stats: WorkerStats,
  resources: Resources,
  focus: CollectiveFocus
): GovernorRecommendation | null {
  // Children don't work
  const age = worker.citizen?.age ?? 25;
  if (age < MIN_WORKING_AGE) return null;

  // Never override force or player assignments
  if (stats.assignmentSource === 'forced' || stats.assignmentSource === 'player') {
    return null;
  }

  // Evaluate priority
  const priority = evaluateWorkerPriority(worker, stats, resources, focus);

  // If worker already has an auto-assignment, only reassign if priority is survive
  // (don't churn workers between buildings unless critical)
  if (worker.citizen?.assignment && stats.assignmentSource === 'auto' && priority !== 'survive') {
    return null;
  }

  // Find a building matching the priority
  const recommendation = findBestAssignment(priority, worker.citizen?.class ?? 'worker');
  if (!recommendation) return null;

  return { ...recommendation, priority };
}

// ── Internal Helpers ──────────────────────────────────────────────────────────

/** Check if any operational producer buildings exist. */
function hasOperationalProducers(): boolean {
  for (const entity of buildingsLogic) {
    const phase = entity.building.constructionPhase;
    if ((phase == null || phase === 'complete') && entity.building.produces != null) {
      return true;
    }
  }
  return false;
}

/** Check if any buildings have durability below repair threshold. */
function hasDamagedBuildings(): boolean {
  for (const entity of world.with('building', 'durability')) {
    if (entity.durability.current < REPAIR_THRESHOLD) {
      return true;
    }
  }
  return false;
}

/** Find the best food production building. */
function findFoodBuilding(): GovernorRecommendation | null {
  for (const entity of buildingsLogic) {
    const phase = entity.building.constructionPhase;
    if (
      (phase == null || phase === 'complete') &&
      entity.building.produces?.resource === 'food' &&
      entity.building.powered
    ) {
      return {
        buildingDefId: entity.building.defId,
        gridX: entity.position.gridX,
        gridY: entity.position.gridY,
        priority: 'survive',
      };
    }
  }
  return null;
}

/** Find a building under construction. */
function findConstructionSite(): GovernorRecommendation | null {
  const sites = underConstruction.entities;
  if (sites.length === 0) return null;
  const site = sites[0]!;
  return {
    buildingDefId: site.building.defId,
    gridX: site.position.gridX,
    gridY: site.position.gridY,
    priority: 'state_demand',
  };
}

/** Find any operational production building. */
function findProductionBuilding(): GovernorRecommendation | null {
  for (const entity of buildingsLogic) {
    const phase = entity.building.constructionPhase;
    if (
      (phase == null || phase === 'complete') &&
      entity.building.produces != null &&
      entity.building.powered
    ) {
      return {
        buildingDefId: entity.building.defId,
        gridX: entity.position.gridX,
        gridY: entity.position.gridY,
        priority: 'trudodni',
      };
    }
  }
  return null;
}

/** Find the most damaged building that needs repair. */
function findDamagedBuilding(): GovernorRecommendation | null {
  let worst: {
    entity: Entity & { position: { gridX: number; gridY: number }; building: { defId: string } };
    durability: number;
  } | null = null;
  for (const entity of world.with('building', 'durability', 'position')) {
    if (entity.durability.current < REPAIR_THRESHOLD) {
      if (!worst || entity.durability.current < worst.durability) {
        worst = { entity, durability: entity.durability.current };
      }
    }
  }
  if (!worst) return null;
  return {
    buildingDefId: worst.entity.building.defId,
    gridX: worst.entity.position.gridX,
    gridY: worst.entity.position.gridY,
    priority: 'improve',
  };
}
