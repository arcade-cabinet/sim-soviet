/**
 * @fileoverview CollectiveAgent — Autonomous Collective AI.
 *
 * Absorbs the complete logic from:
 *   - governor.ts    — 5-level priority stack (survive → state_demand → trudodni → improve → private)
 *   - demandSystem.ts — threshold-based construction demand detection
 *   - autoBuilder.ts  — Manhattan-distance placement candidate selection
 *   - CollectivePlanner.ts — mandate + demand queue generation
 *
 * The agent's `update()` method runs the full pipeline each tick:
 *   1. Governor: evaluate worker priorities + find best assignments
 *   2. Demand detection: housing / food / power / vodka shortages
 *   3. Auto-build: place needed buildings autonomously near existing ones
 *   4. Queue generation: merge mandates + demands into sorted build queue
 *
 * Serialization: `getState()` / `loadState()` for save/load round-trips.
 */

import { Vehicle } from 'yuka';
import { GRID_SIZE } from '@/config';
import { buildingsLogic, buildings, operationalBuildings, terrainFeatures, underConstruction } from '@/ecs/archetypes';
import { placeNewBuilding } from '@/ecs/factories/buildingFactories';
import type { Entity, Resources } from '@/ecs/world';
import { world } from '@/ecs/world';
import type { PlanMandateState } from '../../game/PlanMandates';
import type { WorkerStats } from '../../game/workers/types';
import type { CollectiveFocus } from '../../game/workers/governor';
import type { GameRng } from '../../game/SeedSystem';

// ── Re-exported types (absorbed from governor.ts) ─────────────────────────────

/** The 5-level priority stack, evaluated top-to-bottom. */
export type GovernorPriority = 'survive' | 'state_demand' | 'trudodni' | 'improve' | 'private';

/** Result of the governor's evaluation — where to assign the worker. */
export interface GovernorRecommendation {
  buildingDefId: string;
  gridX: number;
  gridY: number;
  priority: GovernorPriority;
}

// ── Re-exported types (absorbed from demandSystem.ts) ─────────────────────────

/** Categories of construction demand. */
export type DemandCategory = 'housing' | 'food_production' | 'power' | 'vodka_production';

/** Priority levels for construction demands. */
export type DemandPriority = 'critical' | 'urgent' | 'normal';

/** A detected construction need with priority and suggested building types. */
export interface ConstructionDemand {
  category: DemandCategory;
  priority: DemandPriority;
  suggestedDefIds: string[];
  reason: string;
}

/** Snapshot of current resource levels for demand detection. */
export interface ResourceSnapshot {
  food: number;
  vodka: number;
  power: number;
}

// ── Re-exported types (absorbed from CollectivePlanner.ts) ────────────────────

/** Origin of a construction request: state mandate or worker demand. */
export type RequestSource = 'mandate' | 'demand';

/** A prioritized entry in the construction queue. */
export interface ConstructionRequest {
  defId: string;
  source: RequestSource;
  label: string;
  sortPriority: number; // lower = build first
  reason: string;
}

// ── Serialized state ──────────────────────────────────────────────────────────

/** Serializable state for save/load round-trips. */
export interface CollectiveAgentState {
  focus: CollectiveFocus;
  lastBuildTick: number;
  buildQueue: ConstructionRequest[];
  pendingDemands: ConstructionDemand[];
}

// ── Governor Constants (absorbed from governor.ts) ────────────────────────────

/** Food per capita below which the collective is in food crisis. */
export const FOOD_CRISIS_THRESHOLD = 2.0;

/** Hunger level above which an individual worker is starving. */
export const HUNGER_CRISIS_THRESHOLD = 60;

/** Durability percentage below which a building needs repair. */
export const REPAIR_THRESHOLD = 50;

/** Minimum age for a worker to receive governor assignments. */
const MIN_WORKING_AGE = 14;

/** Food threshold modifier when player focuses on food production. */
export const FOOD_FOCUS_MULTIPLIER = 3.0;

// ── Demand System Constants (absorbed from demandSystem.ts) ───────────────────

/** Food per capita below this is a critical shortage. */
export const FOOD_CRITICAL_THRESHOLD = 1.5;

/** Food per capita below this triggers urgent farm demand. */
export const FOOD_DEMAND_THRESHOLD = 3.0;

/** Vodka per capita below this triggers urgent distillery demand. */
export const VODKA_DEMAND_THRESHOLD = 1.0;

/** Vodka per capita below this is a critical shortage. */
export const VODKA_CRITICAL_THRESHOLD = 0.3;

/** Housing occupancy ratio at or above this triggers urgent demand. */
export const HOUSING_OCCUPANCY_THRESHOLD = 0.8;

// ── AutoBuilder Constants (absorbed from autoBuilder.ts) ──────────────────────

/** Maximum Manhattan distance from an existing building to consider for placement. */
export const MAX_PLACEMENT_DISTANCE = 4;

/** Maximum number of candidates to keep before random selection. */
export const CANDIDATE_LIMIT = 20;

/** Terrain feature types that block building placement. */
const IMPASSABLE_FEATURES = new Set(['mountain', 'river', 'forest']);

// ── CollectivePlanner Constants (absorbed from CollectivePlanner.ts) ──────────

const DEMAND_PRIORITY_WEIGHT: Record<DemandPriority, number> = {
  critical: 0, // Build before mandates
  urgent: 20, // Build after mandates
  normal: 30, // Lowest priority
};

const MANDATE_WEIGHT = 10; // Between critical demands and urgent demands

// ── Suggested Building DefIds (absorbed from demandSystem.ts) ─────────────────

const HOUSING_SUGGESTIONS = ['workers-house-a', 'workers-house-b'];
const FOOD_SUGGESTIONS = ['collective-farm-hq'];
const POWER_SUGGESTIONS = ['power-station'];
const VODKA_SUGGESTIONS = ['vodka-distillery'];

// ── CollectiveAgent ───────────────────────────────────────────────────────────

/**
 * The Collective — autonomous worker AI, demand detector, and construction planner.
 * Extends Yuka Vehicle for compatibility with EntityManager.
 *
 * Absorbs all logic from:
 *   governor.ts, demandSystem.ts, autoBuilder.ts, CollectivePlanner.ts
 *
 * @example
 * const collective = new CollectiveAgent();
 * collective.setFocus('food');
 * collective.update(delta, resources, rng, mandateState);
 * const queue = collective.getBuildQueue();
 */
export class CollectiveAgent extends Vehicle {
  /** Current player-set collective focus (shifts governor thresholds). */
  private focus: CollectiveFocus = 'balanced';

  /** Game tick of the last autonomous build action. */
  private lastBuildTick = 0;

  /** Current sorted construction queue (mandates + demands merged). */
  private buildQueue: ConstructionRequest[] = [];

  /** Latest detected construction demands. */
  private pendingDemands: ConstructionDemand[] = [];

  constructor() {
    super();
    this.name = 'CollectiveAgent';
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Set the player-controlled collective focus. */
  setFocus(focus: CollectiveFocus): void {
    this.focus = focus;
  }

  /** Get the current collective focus. */
  getFocus(): CollectiveFocus {
    return this.focus;
  }

  /** Get the current sorted construction queue. */
  getBuildQueue(): ConstructionRequest[] {
    return [...this.buildQueue];
  }

  /** Get the latest detected construction demands. */
  getPendingDemands(): ConstructionDemand[] {
    return [...this.pendingDemands];
  }

  /**
   * Main update loop — runs the full collective pipeline.
   *
   * 1. Detect construction demands from resource shortages
   * 2. Merge mandates + demands into a sorted build queue
   * 3. If build queue is non-empty, attempt autonomous placement of top item
   *
   * @param _delta - Time delta (unused — tick-driven not frame-driven)
   * @param resources - Current resource levels
   * @param rng - Seeded RNG for placement randomness
   * @param mandateState - Current 5-Year Plan mandates (null if no active plan)
   * @param currentTick - Current simulation tick (for throttling builds)
   * @param housingCapacity - Total housing capacity across all buildings
   */
  update(
    _delta: number,
    resources: Resources,
    rng: GameRng,
    mandateState: PlanMandateState | null,
    currentTick: number,
    housingCapacity: number,
  ): void {
    // Step 1: Detect demands
    this.pendingDemands = this.detectConstructionDemands(resources.population, housingCapacity, {
      food: resources.food,
      vodka: resources.vodka ?? 0,
      power: resources.power ?? 0,
    });

    // Step 2: Generate sorted build queue
    this.buildQueue = this.generateQueue(mandateState, this.pendingDemands);

    // Step 3: Attempt autonomous build if queue is non-empty
    if (this.buildQueue.length > 0 && currentTick > this.lastBuildTick) {
      const top = this.buildQueue[0]!;
      const placed = this.autoPlaceBuilding(top.defId, rng);
      if (placed) {
        this.lastBuildTick = currentTick;
      }
    }
  }

  // ── Governor: Priority Evaluation ──────────────────────────────────────────

  /**
   * Evaluate the highest-priority need for a worker given current state.
   *
   * 5-level priority stack:
   *   1. survive     — food production when starving
   *   2. state_demand — buildings under construction
   *   3. trudodni    — fill production buildings
   *   4. improve     — repair damaged infrastructure
   *   5. private     — nothing urgent, worker rests
   *
   * @param worker - Worker entity
   * @param _stats - Worker stats (reserved for future use)
   * @param resources - Current resource levels
   * @param focus - Player-set collective focus (shifts thresholds)
   */
  evaluateWorkerPriority(
    worker: Entity,
    _stats: WorkerStats,
    resources: Resources,
    focus: CollectiveFocus,
  ): GovernorPriority {
    const hunger = worker.citizen?.hunger ?? 0;
    const foodPerCapita = resources.population > 0 ? resources.food / resources.population : 999;

    // Effective thresholds shift based on collective focus
    const foodThreshold = focus === 'food' ? FOOD_CRISIS_THRESHOLD * FOOD_FOCUS_MULTIPLIER : FOOD_CRISIS_THRESHOLD;

    // Level 1: Survive — individual starvation or collective food crisis
    if (hunger >= HUNGER_CRISIS_THRESHOLD || foodPerCapita < foodThreshold) {
      return 'survive';
    }

    // Level 2: State demand — buildings under construction
    const hasConstruction = underConstruction.entities.length > 0;
    if (hasConstruction && (focus === 'construction' || focus === 'balanced')) {
      return 'state_demand';
    }

    // Level 3: Trudodni — production buildings need workers
    if (this.hasOperationalProducers()) {
      return 'trudodni';
    }

    // Level 4: Improve — damaged buildings need repair
    if (this.hasDamagedBuildings()) {
      return 'improve';
    }

    // Level 5: Private — nothing urgent, worker rests
    return 'private';
  }

  /**
   * Find the best building to assign a worker to for a given priority.
   * Returns null if no suitable building exists.
   */
  findBestAssignment(priority: GovernorPriority, _citizenClass: string): GovernorRecommendation | null {
    switch (priority) {
      case 'survive':
        return this.findFoodBuilding();
      case 'state_demand':
        return this.findConstructionSite();
      case 'trudodni':
        return this.findProductionBuilding();
      case 'improve':
        return this.findDamagedBuilding();
      case 'private':
        return null;
    }
  }

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
  runGovernor(worker: Entity, stats: WorkerStats, resources: Resources): GovernorRecommendation | null {
    // Children don't work
    const age = worker.citizen?.age ?? 25;
    if (age < MIN_WORKING_AGE) return null;

    // Never override force or player assignments
    if (stats.assignmentSource === 'forced' || stats.assignmentSource === 'player') {
      return null;
    }

    // Evaluate priority
    const priority = this.evaluateWorkerPriority(worker, stats, resources, this.focus);

    // If worker already has an auto-assignment, only reassign if priority is survive
    if (worker.citizen?.assignment && stats.assignmentSource === 'auto' && priority !== 'survive') {
      return null;
    }

    // Find a building matching the priority
    const recommendation = this.findBestAssignment(priority, worker.citizen?.class ?? 'worker');
    if (!recommendation) return null;

    return { ...recommendation, priority };
  }

  // ── Demand System: Shortage Detection ──────────────────────────────────────

  /**
   * Scans current game state for shortages and returns construction demands.
   *
   * @param population - Current total population
   * @param housingCapacity - Total housing capacity across all operational buildings
   * @param resources - Current resource snapshot (food, vodka, power)
   */
  detectConstructionDemands(
    population: number,
    housingCapacity: number,
    resources: ResourceSnapshot,
  ): ConstructionDemand[] {
    const demands: ConstructionDemand[] = [];

    const housingDemand = this.detectHousingDemand(population, housingCapacity);
    if (housingDemand) demands.push(housingDemand);

    const foodDemand = this.detectFoodDemand(population, resources.food);
    if (foodDemand) demands.push(foodDemand);

    const powerDemand = this.detectPowerDemand();
    if (powerDemand) demands.push(powerDemand);

    const vodkaDemand = this.detectVodkaDemand(population, resources.vodka);
    if (vodkaDemand) demands.push(vodkaDemand);

    return demands;
  }

  // ── AutoBuilder: Placement Logic ────────────────────────────────────────────

  /**
   * Finds a valid grid cell near existing buildings for autonomous placement.
   *
   * Algorithm:
   * 1. Gather all existing building positions
   * 2. If no buildings exist, return null
   * 3. Build a set of occupied cells (buildings + impassable terrain)
   * 4. For each building, scan cells within MAX_PLACEMENT_DISTANCE
   * 5. Deduplicate candidates, sort by distance, pick randomly from top CANDIDATE_LIMIT
   */
  findPlacementCell(rng: GameRng): { gridX: number; gridY: number } | null {
    const buildingEntities = buildings.entities;
    if (buildingEntities.length === 0) {
      return null;
    }

    const occupied = this.buildOccupiedSet();
    const candidateMap = new Map<string, { gridX: number; gridY: number; distance: number }>();

    for (const entity of buildingEntities) {
      const bx = entity.position.gridX;
      const by = entity.position.gridY;

      for (let dx = -MAX_PLACEMENT_DISTANCE; dx <= MAX_PLACEMENT_DISTANCE; dx++) {
        for (let dy = -MAX_PLACEMENT_DISTANCE; dy <= MAX_PLACEMENT_DISTANCE; dy++) {
          if (dx === 0 && dy === 0) continue;

          const dist = Math.abs(dx) + Math.abs(dy);
          if (dist > MAX_PLACEMENT_DISTANCE) continue;

          const cx = bx + dx;
          const cy = by + dy;

          if (!this.isInBounds(cx, cy)) continue;

          const key = `${cx},${cy}`;
          if (occupied.has(key)) continue;

          const existing = candidateMap.get(key);
          if (!existing || dist < existing.distance) {
            candidateMap.set(key, { gridX: cx, gridY: cy, distance: dist });
          }
        }
      }
    }

    const candidates = Array.from(candidateMap.values());
    if (candidates.length === 0) {
      return null;
    }

    candidates.sort((a, b) => a.distance - b.distance);
    const topCandidates = candidates.slice(0, CANDIDATE_LIMIT);
    const chosen = topCandidates[rng.pickIndex(topCandidates.length)]!;
    return { gridX: chosen.gridX, gridY: chosen.gridY };
  }

  /**
   * Autonomously places a building near existing buildings.
   * Returns the placed entity, or null if placement fails.
   */
  autoPlaceBuilding(defId: string, rng: GameRng): Entity | null {
    const cell = this.findPlacementCell(rng);
    if (!cell) {
      return null;
    }

    try {
      return placeNewBuilding(cell.gridX, cell.gridY, defId);
    } catch (e) {
      console.warn(`[CollectiveAgent] Failed to place ${defId} at (${cell.gridX}, ${cell.gridY}):`, e);
      return null;
    }
  }

  // ── CollectivePlanner: Queue Generation ────────────────────────────────────

  /**
   * Merges state-mandated buildings with worker-generated demands into
   * a single deduplicated, priority-sorted construction queue.
   *
   * Priority ordering (lower sortPriority = build first):
   *   critical demands (0) < mandates (10) < urgent demands (20) < normal demands (30)
   *
   * Deduplication: if a mandate already covers a defId, skip the demand.
   */
  generateQueue(mandateState: PlanMandateState | null, demands: ConstructionDemand[]): ConstructionRequest[] {
    const requests: ConstructionRequest[] = [];
    const mandateDefIds = new Set<string>();

    // Unfulfilled mandates
    if (mandateState) {
      for (const mandate of mandateState.mandates) {
        const remaining = mandate.required - mandate.fulfilled;
        if (remaining <= 0) continue;

        mandateDefIds.add(mandate.defId);

        for (let i = 0; i < remaining; i++) {
          requests.push({
            defId: mandate.defId,
            source: 'mandate',
            label: mandate.label,
            sortPriority: MANDATE_WEIGHT,
            reason: `5-Year Plan mandate: build ${mandate.label}`,
          });
        }
      }
    }

    // Worker demands (skip if mandate already covers the defId)
    for (const demand of demands) {
      const weight = DEMAND_PRIORITY_WEIGHT[demand.priority];

      for (const defId of demand.suggestedDefIds) {
        if (mandateDefIds.has(defId)) continue;

        requests.push({
          defId,
          source: 'demand',
          label: `${demand.category} demand`,
          sortPriority: weight,
          reason: demand.reason,
        });
      }
    }

    requests.sort((a, b) => a.sortPriority - b.sortPriority);
    return requests;
  }

  // ── Serialization ───────────────────────────────────────────────────────────

  /** Serialize agent state for save/load. */
  getState(): CollectiveAgentState {
    return {
      focus: this.focus,
      lastBuildTick: this.lastBuildTick,
      buildQueue: [...this.buildQueue],
      pendingDemands: [...this.pendingDemands],
    };
  }

  /** Restore agent state from a serialized snapshot. */
  loadState(state: CollectiveAgentState): void {
    this.focus = state.focus;
    this.lastBuildTick = state.lastBuildTick;
    this.buildQueue = [...state.buildQueue];
    this.pendingDemands = [...state.pendingDemands];
  }

  // ── Private Helpers: Governor ───────────────────────────────────────────────

  private hasOperationalProducers(): boolean {
    for (const entity of buildingsLogic) {
      const phase = entity.building.constructionPhase;
      if ((phase == null || phase === 'complete') && entity.building.produces != null) {
        return true;
      }
    }
    return false;
  }

  private hasDamagedBuildings(): boolean {
    for (const entity of world.with('building', 'durability')) {
      if (entity.durability.current < REPAIR_THRESHOLD) {
        return true;
      }
    }
    return false;
  }

  private findFoodBuilding(): GovernorRecommendation | null {
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

  private findConstructionSite(): GovernorRecommendation | null {
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

  private findProductionBuilding(): GovernorRecommendation | null {
    for (const entity of buildingsLogic) {
      const phase = entity.building.constructionPhase;
      if ((phase == null || phase === 'complete') && entity.building.produces != null && entity.building.powered) {
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

  private findDamagedBuilding(): GovernorRecommendation | null {
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

  // ── Private Helpers: Demand System ─────────────────────────────────────────

  private detectHousingDemand(population: number, housingCapacity: number): ConstructionDemand | null {
    if (population <= 0) return null;

    if (population > housingCapacity) {
      return {
        category: 'housing',
        priority: 'critical',
        suggestedDefIds: HOUSING_SUGGESTIONS,
        reason: `Population (${population}) exceeds housing capacity (${housingCapacity}) — workers are homeless`,
      };
    }

    const occupancyRatio = population / housingCapacity;
    if (occupancyRatio >= HOUSING_OCCUPANCY_THRESHOLD) {
      return {
        category: 'housing',
        priority: 'urgent',
        suggestedDefIds: HOUSING_SUGGESTIONS,
        reason: `Housing at ${Math.round(occupancyRatio * 100)}% capacity — approaching overcrowding`,
      };
    }

    return null;
  }

  private detectFoodDemand(population: number, food: number): ConstructionDemand | null {
    if (population <= 0) return null;

    const foodPerCapita = food / population;

    if (foodPerCapita < FOOD_CRITICAL_THRESHOLD) {
      return {
        category: 'food_production',
        priority: 'critical',
        suggestedDefIds: FOOD_SUGGESTIONS,
        reason: `Food per capita (${foodPerCapita.toFixed(1)}) is critically low — starvation imminent`,
      };
    }

    if (foodPerCapita < FOOD_DEMAND_THRESHOLD) {
      return {
        category: 'food_production',
        priority: 'urgent',
        suggestedDefIds: FOOD_SUGGESTIONS,
        reason: `Food per capita (${foodPerCapita.toFixed(1)}) is below safe levels — build more farms`,
      };
    }

    return null;
  }

  private detectPowerDemand(): ConstructionDemand | null {
    let unpoweredCount = 0;

    for (const entity of operationalBuildings.entities) {
      if (entity.building.powerReq > 0 && entity.building.powered === false) {
        unpoweredCount++;
      }
    }

    if (unpoweredCount === 0) return null;

    const priority: DemandPriority = unpoweredCount > 3 ? 'critical' : 'urgent';

    return {
      category: 'power',
      priority,
      suggestedDefIds: POWER_SUGGESTIONS,
      reason: `${unpoweredCount} building${unpoweredCount > 1 ? 's' : ''} without power — construct a power station`,
    };
  }

  private detectVodkaDemand(population: number, vodka: number): ConstructionDemand | null {
    if (population <= 0) return null;

    const vodkaPerCapita = vodka / population;

    if (vodkaPerCapita < VODKA_CRITICAL_THRESHOLD) {
      return {
        category: 'vodka_production',
        priority: 'critical',
        suggestedDefIds: VODKA_SUGGESTIONS,
        reason: `Vodka per capita (${vodkaPerCapita.toFixed(1)}) is critically low — morale plummeting`,
      };
    }

    if (vodkaPerCapita < VODKA_DEMAND_THRESHOLD) {
      return {
        category: 'vodka_production',
        priority: 'urgent',
        suggestedDefIds: VODKA_SUGGESTIONS,
        reason: `Vodka per capita (${vodkaPerCapita.toFixed(1)}) is below safe levels — build a distillery`,
      };
    }

    return null;
  }

  // ── Private Helpers: AutoBuilder ────────────────────────────────────────────

  private buildOccupiedSet(): Set<string> {
    const occupied = new Set<string>();

    for (const entity of buildings) {
      occupied.add(`${entity.position.gridX},${entity.position.gridY}`);
    }

    for (const entity of terrainFeatures) {
      if (IMPASSABLE_FEATURES.has(entity.terrainFeature.featureType)) {
        occupied.add(`${entity.position.gridX},${entity.position.gridY}`);
      }
    }

    return occupied;
  }

  private isInBounds(gridX: number, gridY: number): boolean {
    return gridX >= 1 && gridX < GRID_SIZE - 1 && gridY >= 1 && gridY < GRID_SIZE - 1;
  }
}
