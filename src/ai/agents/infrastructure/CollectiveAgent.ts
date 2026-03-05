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
import { GRID_SIZE, infrastructure } from '@/config';
import { classifyBuilding } from '@/config/buildingClassification';
import { isProtected } from '@/config/protectedClasses';
import { getBuildingDef } from '@/data/buildingDefs';
import {
  buildings,
  buildingsLogic,
  getResourceEntity,
  operationalBuildings,
  terrainFeatures,
  underConstruction,
} from '@/ecs/archetypes';
import { setCaravanTarget } from '@/stores/gameStore';
import { placeNewBuilding } from '@/ecs/factories/buildingFactories';
import type { Entity, Resources } from '@/ecs/world';
import { world } from '@/ecs/world';
import type { AgentParameterProfile } from '../../../game/engine/agentParameterMatrix';
import type { GameRng } from '../../../game/SeedSystem';
import { getBuildInterval } from '../../../growth/GrowthPacing';
import { findBestPlacement, type PlacementContext } from '../../../growth/SiteSelectionRules';
import type { PlanMandateState } from '../political/PoliticalAgent';
import type { WorkerStats } from '../workforce/types';
import { cascadeDisplacement } from './displacementSystem';
import { checkScaleUpTrigger, scaleUpBuilding } from './megaScalingSystem';

// ── Re-exported types (absorbed from governor.ts) ─────────────────────────────

/** Collective operational focus (from governor.ts). */
export type CollectiveFocus = 'food' | 'construction' | 'production' | 'balanced';

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
  bootstrapped?: boolean;
}

// ── Governor Constants (from config/infrastructure.json) ─────────────────────

const gcfg = infrastructure.governor;
const dcfg = infrastructure.demand;
const acfg = infrastructure.autoBuilder;

/** Food per capita below which the collective is in food crisis. */
export const FOOD_CRISIS_THRESHOLD = gcfg.foodCrisisThreshold;

/** Hunger level above which an individual worker is starving. */
export const HUNGER_CRISIS_THRESHOLD = gcfg.hungerCrisisThreshold;

/** Durability percentage below which a building needs repair. */
export const REPAIR_THRESHOLD = gcfg.repairThreshold;

/** Minimum age for a worker to receive governor assignments. */
const MIN_WORKING_AGE = gcfg.minWorkingAge;

/** Food threshold modifier when player focuses on food production. */
export const FOOD_FOCUS_MULTIPLIER = gcfg.foodFocusMultiplier;

// ── Demand System Constants (from config/infrastructure.json) ────────────────

/** Food per capita below this is a critical shortage. */
export const FOOD_CRITICAL_THRESHOLD = dcfg.foodCriticalThreshold;

/** Food per capita below this triggers urgent farm demand. */
export const FOOD_DEMAND_THRESHOLD = dcfg.foodDemandThreshold;

/** Vodka per capita below this triggers urgent distillery demand. */
export const VODKA_DEMAND_THRESHOLD = dcfg.vodkaDemandThreshold;

/** Vodka per capita below this is a critical shortage. */
export const VODKA_CRITICAL_THRESHOLD = dcfg.vodkaCriticalThreshold;

/** Housing occupancy ratio at or above this triggers urgent demand. */
export const HOUSING_OCCUPANCY_THRESHOLD = dcfg.housingOccupancyThreshold;

// ── AutoBuilder Constants (from config/infrastructure.json) ──────────────────

/** Maximum Manhattan distance from an existing building to consider for placement. */
export const MAX_PLACEMENT_DISTANCE = acfg.maxPlacementDistance;

/** Maximum number of candidates to keep before random selection. */
export const CANDIDATE_LIMIT = acfg.candidateLimit;

/** How often (in ticks) the autonomous collective checks for construction needs. */
const COLLECTIVE_CHECK_INTERVAL = acfg.collectiveCheckInterval;

/** Terrain feature types that block building placement. */
const IMPASSABLE_FEATURES = new Set(['mountain', 'river', 'forest']);

// ── CollectivePlanner Constants (absorbed from CollectivePlanner.ts) ──────────

const DEMAND_PRIORITY_WEIGHT: Record<DemandPriority, number> = infrastructure.planner.demandPriorityWeight as Record<
  DemandPriority,
  number
>;

const MANDATE_WEIGHT = infrastructure.planner.mandateWeight;

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

  /** Whether the early game bootstrap has already run. */
  private bootstrapped = false;

  /** Current sorted construction queue (mandates + demands merged). */
  private buildQueue: ConstructionRequest[] = [];

  /** Latest detected construction demands. */
  private pendingDemands: ConstructionDemand[] = [];

  /** Seeded RNG (set via setRng). */
  private rng?: GameRng;

  /** Active terrain profile — controls construction type for off-world settlements. */
  private profile: Readonly<AgentParameterProfile> | null = null;

  /** Cached fertility map for resource-proximity placement. Rebuilt each tickAutonomous. */
  private fertilityCache?: Map<string, number>;

  /** Cached arcology footprint cells ("x,y" → mergeGroup) for adjacency-aware placement. */
  private arcologyCellsCache?: Map<string, string>;

  constructor() {
    super();
    this.name = 'CollectiveAgent';
  }

  /** Set the seeded RNG for deterministic collective rolls. */
  setRng(rng: GameRng): void {
    this.rng = rng;
  }

  /**
   * Set the active agent parameter profile.
   * constructionType determines building class (standard, pressurized_dome, underground, orbital).
   */
  setProfile(profile: Readonly<AgentParameterProfile>): void {
    this.profile = profile;
  }

  /** Get the active construction type from the profile ('standard' if no profile set). */
  getConstructionType(): AgentParameterProfile['constructionType'] {
    return this.profile?.constructionType ?? 'standard';
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
   * Uses era-aware site selection when eraId is available, falling back
   * to distance-based random selection otherwise.
   *
   * If no candidates are found within MAX_PLACEMENT_DISTANCE, expands
   * the search to cover the full grid.
   */
  findPlacementCell(rng: GameRng, defId?: string, eraId?: string): { gridX: number; gridY: number } | null {
    const buildingEntities = buildings.entities;
    if (buildingEntities.length === 0) {
      return null;
    }

    const occupied = this.buildOccupiedSet();

    // Try era-aware placement if we have context
    if (defId && eraId) {
      const ctx = this.buildPlacementContext(eraId, occupied);
      // Try normal range first
      const result = findBestPlacement(defId, ctx, MAX_PLACEMENT_DISTANCE);
      if (result) {
        return { gridX: result.x, gridY: result.z };
      }
      // Expand search to full grid (GRID_SIZE * 2 ensures full Manhattan coverage)
      const expanded = findBestPlacement(defId, ctx, GRID_SIZE * 2);
      if (expanded) {
        return { gridX: expanded.x, gridY: expanded.z };
      }
      return null;
    }

    // Legacy fallback: distance-based random selection
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
   *
   * For protected-class buildings (government/military), if no open cell
   * is available, attempts displacement cascade — demolishing the lowest-priority
   * expendable building to free a tile.
   *
   * @param defId - Building definition ID to place
   * @param rng - Seeded RNG for placement randomness
   * @param eraId - Current era for era-aware placement (optional)
   */
  autoPlaceBuilding(defId: string, rng: GameRng, eraId?: string): Entity | null {
    const cell = this.findPlacementCell(rng, defId, eraId);
    if (cell) {
      try {
        return placeNewBuilding(cell.gridX, cell.gridY, defId);
      } catch (e) {
        console.warn(`[CollectiveAgent] Failed to place ${defId} at (${cell.gridX}, ${cell.gridY}):`, e);
        return null;
      }
    }

    // No open cell found — try displacement for protected-class buildings
    const demandClass = classifyBuilding(defId);
    if (!isProtected(demandClass)) {
      return null;
    }

    const result = cascadeDisplacement(demandClass, buildings.entities);
    if (!result.success || !result.demolished) {
      return null;
    }

    const { gridX, gridY } = result.demolished.freedTile;
    try {
      return placeNewBuilding(gridX, gridY, defId);
    } catch (e) {
      console.warn(`[CollectiveAgent] Failed to place ${defId} at displaced tile (${gridX}, ${gridY}):`, e);
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

  // ── Absorbed SimulationEngine Methods ──────────────────────────────────────

  /**
   * Place essential starter buildings on the very first autonomous tick.
   * Runs once: government-hq near water (or center), 2 izbas nearby, 1 farm.
   */
  public earlyGameBootstrap(rng: GameRng, eraId?: string, arrivalComplete?: boolean): void {
    if (this.bootstrapped) return;

    // Don't bootstrap until arrival sequence has had time to start (first 30 ticks)
    // This prevents buildings appearing before the caravan reaches the settlement
    if (arrivalComplete === false) return;

    // Require minimum materials and no existing buildings for bootstrap
    const storeRef = getResourceEntity();
    if (!storeRef || storeRef.resources.timber < 30) return;
    if (buildings.entities.length > 0) return; // settlement already has buildings

    const occupied = this.buildOccupiedSet();

    // Place Government HQ — prefer near water, fallback to center
    const ctx = eraId ? this.buildPlacementContext(eraId, occupied) : null;
    let hqCell: { gridX: number; gridY: number } | null = null;

    if (ctx) {
      const result = findBestPlacement('government-hq', ctx, GRID_SIZE);
      if (result) hqCell = { gridX: result.x, gridY: result.z };
    }
    if (!hqCell) {
      // Fallback: center of map
      const center = Math.floor(GRID_SIZE / 2);
      hqCell = { gridX: center, gridY: center };
    }

    try {
      const hq = placeNewBuilding(hqCell.gridX, hqCell.gridY, 'government-hq');
      if (hq) {
        occupied.add(`${hqCell.gridX},${hqCell.gridY}`);
        // Signal camera to follow caravan toward the settlement center
        setCaravanTarget(hqCell.gridX, hqCell.gridY);
      }
    } catch {
      /* placement failed — not fatal */
    }

    // Place 2-3 izbas near the party-hq
    const izbaCount = 2 + rng.pickIndex(2); // 2 or 3
    for (let i = 0; i < izbaCount; i++) {
      const defId = i % 2 === 0 ? 'workers-house-a' : 'workers-house-b';
      const cell = this.findNearbyEmpty(hqCell.gridX, hqCell.gridY, occupied, rng);
      if (cell) {
        try {
          const entity = placeNewBuilding(cell.gridX, cell.gridY, defId);
          if (entity) occupied.add(`${cell.gridX},${cell.gridY}`);
        } catch {
          /* placement failed */
        }
      }
    }

    // Place 1 farm near the settlement
    const farmCell = this.findNearbyEmpty(hqCell.gridX, hqCell.gridY, occupied, rng, 4);
    if (farmCell) {
      try {
        placeNewBuilding(farmCell.gridX, farmCell.gridY, 'collective-farm-hq');
      } catch {
        /* placement failed */
      }
    }

    this.bootstrapped = true;
  }

  /** Find an empty cell within radius of (cx, cy), avoiding occupied cells. */
  private findNearbyEmpty(
    cx: number,
    cy: number,
    occupied: Set<string>,
    rng: GameRng,
    minDist = 2,
  ): { gridX: number; gridY: number } | null {
    const candidates: Array<{ gridX: number; gridY: number; dist: number }> = [];
    const maxDist = minDist + 3;

    for (let dx = -maxDist; dx <= maxDist; dx++) {
      for (let dy = -maxDist; dy <= maxDist; dy++) {
        const dist = Math.abs(dx) + Math.abs(dy);
        if (dist < minDist || dist > maxDist) continue;

        const nx = cx + dx;
        const ny = cy + dy;
        if (!this.isInBounds(nx, ny)) continue;
        if (occupied.has(`${nx},${ny}`)) continue;

        candidates.push({ gridX: nx, gridY: ny, dist });
      }
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.dist - b.dist);
    const top = candidates.slice(0, Math.min(5, candidates.length));
    return top[rng.pickIndex(top.length)]!;
  }

  /**
   * Full autonomous construction pipeline: detect demands, merge mandates, auto-place.
   * Also checks for mega-scaling opportunities on housing buildings.
   * Absorbs SimulationEngine.tickCollectiveViaAgent().
   */
  public tickAutonomous(deps: {
    totalTicks: number;
    rng: GameRng | undefined;
    mandateState: PlanMandateState | null;
    eraId?: string;
    callbacks: { onToast: (msg: string, severity?: string) => void; onAdvisor: (msg: string) => void };
    recordBuildingForMandates: (defId: string) => void;
    /** Terrain tiles for fertility-aware placement. */
    terrainTiles?: Array<{ type: string; fertility: number }>;
    /** Grid size for terrain tile indexing. */
    gridSize?: number;
    /** Active arcologies for adjacency-aware placement. */
    arcologies?: Array<{ footprint: Array<{ x: number; y: number }>; mergeGroup: string }>;
  }): void {
    // Use era-based interval if eraId is provided, otherwise use config default
    const interval = deps.eraId ? getBuildInterval(deps.eraId) : COLLECTIVE_CHECK_INTERVAL;
    if (deps.totalTicks % interval !== 0) return;
    if (deps.totalTicks < 60) return;

    // Check mega-scaling before construction (population pressure may scale existing buildings)
    if (deps.eraId) {
      const storeCheck = getResourceEntity();
      if (storeCheck) {
        this.checkMegaScaling(deps.eraId, storeCheck.resources.population, deps.callbacks);
      }
    }

    if (underConstruction.entities.length >= 3) return;

    const storeRef = getResourceEntity();
    if (!storeRef) return;

    const res = storeRef.resources;
    const housingCap = this.getHousingCapacity();

    // Step 1-2: CollectiveAgent detects demands and generates queue
    const demands = this.detectConstructionDemands(res.population, housingCap, {
      food: res.food,
      vodka: res.vodka,
      power: res.power,
    });
    const queue = this.generateQueue(deps.mandateState, demands);
    if (queue.length === 0) return;

    const request = queue[0]!;

    // Material availability gate
    if (res.timber < 10 || res.steel < 5) {
      if (deps.totalTicks % 120 === 0) {
        deps.callbacks.onAdvisor(
          `Comrade, the collective wishes to build ${request.label}, but we lack materials. We need timber and steel.`,
        );
      }
      return;
    }

    // Build fertility cache from terrain tiles for resource-proximity placement
    if (deps.terrainTiles && deps.gridSize) {
      this.fertilityCache = buildFertilityMap(deps.terrainTiles, deps.gridSize);
    }

    // Build arcology cells cache for adjacency-aware placement
    if (deps.arcologies && deps.arcologies.length > 0) {
      this.arcologyCellsCache = new Map();
      for (const arc of deps.arcologies) {
        for (const cell of arc.footprint) {
          this.arcologyCellsCache.set(`${cell.x},${cell.y}`, arc.mergeGroup);
        }
      }
    } else {
      this.arcologyCellsCache = undefined;
    }

    // Step 3: Auto-place via CollectiveAgent with era-aware placement
    const rng = this.rng ?? deps.rng;
    if (!rng) return;

    const entity = this.autoPlaceBuilding(request.defId, rng, deps.eraId);
    if (entity) {
      deps.recordBuildingForMandates(request.defId);

      if (request.source === 'mandate') {
        deps.callbacks.onToast(`DECREE FULFILLED: Construction of ${request.label} has begun`);
      } else {
        deps.callbacks.onToast(`WORKERS' INITIATIVE: The collective begins ${request.label}`);
        deps.callbacks.onAdvisor(`The workers have started building on their own, Comrade. ${request.reason}.`);
      }
    }
  }

  // ── Mega-Scaling: Population Pressure Scale-Up ──────────────────────────────

  /**
   * Checks all operational housing buildings for mega-scaling opportunities.
   *
   * When total population exceeds a building's effective capacity * 1.5
   * and the current era allows a higher tier, the building is scaled up.
   * Uses the building definition's base housingCap as the tier-0 reference.
   *
   * @param eraId - Current era identifier for max tier lookup
   * @param population - Current total population (demand signal)
   * @param callbacks - Toast/advisor callbacks for UI notification
   */
  checkMegaScaling(
    eraId: string,
    population: number,
    callbacks: { onToast: (msg: string, severity?: string) => void },
  ): void {
    for (const entity of operationalBuildings.entities) {
      const bldg = entity.building;
      if (bldg.housingCap <= 0) continue;

      const def = getBuildingDef(bldg.defId);
      if (!def) continue;

      const tier: number = (bldg as any).tier ?? 0;
      const baseCapacity = def.stats.housingCap;

      // Current effective capacity is the tier-scaled value
      if (!checkScaleUpTrigger(bldg.housingCap, population, eraId, tier)) continue;

      const result = scaleUpBuilding(baseCapacity, tier);
      if (!result) continue;

      // Apply scale-up to the ECS component
      (bldg as any).tier = result.newTier;
      bldg.housingCap = result.newCapacity;

      callbacks.onToast(
        `EXPANSION: ${bldg.defId} scaled to Tier ${result.newTier} (capacity: ${Math.floor(result.newCapacity)})`,
      );
    }
  }

  // ── Private Helpers: Housing Capacity ──────────────────────────────────────

  private getHousingCapacity(): number {
    let cap = 0;
    for (const entity of operationalBuildings.entities) {
      cap += Math.max(0, entity.building.housingCap);
    }
    return cap;
  }

  // ── Serialization ───────────────────────────────────────────────────────────

  /** Serialize agent state for save/load. */
  getState(): CollectiveAgentState {
    return {
      focus: this.focus,
      lastBuildTick: this.lastBuildTick,
      buildQueue: [...this.buildQueue],
      pendingDemands: [...this.pendingDemands],
      bootstrapped: this.bootstrapped,
    };
  }

  /** Restore agent state from a serialized snapshot. */
  loadState(state: CollectiveAgentState): void {
    this.focus = state.focus;
    this.lastBuildTick = state.lastBuildTick;
    this.buildQueue = [...state.buildQueue];
    this.pendingDemands = [...state.pendingDemands];
    this.bootstrapped = state.bootstrapped ?? false;
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

  /** Build a PlacementContext from current ECS state for era-aware placement. */
  private buildPlacementContext(eraId: string, occupied: Set<string>): PlacementContext {
    const buildingList: Array<{ x: number; z: number; defId: string }> = [];
    for (const entity of buildings.entities) {
      buildingList.push({
        x: entity.position.gridX,
        z: entity.position.gridY,
        defId: entity.building.defId,
      });
    }

    const waterCells: Array<{ x: number; z: number }> = [];
    const treeCells: Array<{ x: number; z: number }> = [];
    for (const entity of terrainFeatures.entities) {
      const ft = entity.terrainFeature.featureType;
      if (ft === 'river' || ft === 'water') {
        waterCells.push({ x: entity.position.gridX, z: entity.position.gridY });
      } else if (ft === 'forest') {
        treeCells.push({ x: entity.position.gridX, z: entity.position.gridY });
      }
    }

    return {
      gridSize: GRID_SIZE,
      buildings: buildingList,
      eraId,
      waterCells,
      treeCells,
      occupiedCells: occupied,
      fertilityCells: this.fertilityCache,
      arcologyCells: this.arcologyCellsCache,
    };
  }

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

// ── Fertility Map Builder ──────────────────────────────────────────────────

/**
 * Build a fertility lookup map from flat terrain tile array.
 * Tiles are stored in row-major order: index = z * gridSize + x.
 */
function buildFertilityMap(
  tiles: Array<{ type: string; fertility: number }>,
  gridSize: number,
): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < tiles.length; i++) {
    const x = i % gridSize;
    const z = Math.floor(i / gridSize);
    map.set(`${x},${z}`, tiles[i]!.fertility);
  }
  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// Standalone governor functions (formerly in workers/governor.ts)
// Used by WorkerSystem.runGovernorTick() and BehavioralGovernor tests.
// ─────────────────────────────────────────────────────────────────────────────

const _sharedAgent = new CollectiveAgent();

/**
 * Evaluate the highest-priority need for a worker given current state.
 * Standalone wrapper around CollectiveAgent.evaluateWorkerPriority().
 */
export function evaluateWorkerPriority(
  worker: Entity,
  stats: WorkerStats,
  resources: Resources,
  focus: CollectiveFocus,
): GovernorPriority {
  return _sharedAgent.evaluateWorkerPriority(worker, stats, resources, focus);
}

/**
 * Find the best building to assign a worker to for a given priority.
 * Standalone wrapper around CollectiveAgent.findBestAssignment().
 */
export function findBestAssignment(priority: GovernorPriority, citizenClass: string): GovernorRecommendation | null {
  return _sharedAgent.findBestAssignment(priority, citizenClass);
}

/**
 * Run the full governor pipeline for a single worker.
 * Standalone wrapper around CollectiveAgent.runGovernor().
 *
 * @param focus - Collective focus override (the standalone version accepts it as param)
 */
export function runGovernor(
  worker: Entity,
  stats: WorkerStats,
  resources: Resources,
  focus: CollectiveFocus,
): GovernorRecommendation | null {
  _sharedAgent.setFocus(focus);
  return _sharedAgent.runGovernor(worker, stats, resources);
}

// ─────────────────────────────────────────────────────────────────────────────
// Standalone demand/build functions (formerly in workers/demandSystem.ts, autoBuilder.ts)
// Used by SimulationEngine's autonomous collective tick.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect construction demands based on current population and resource state.
 * Standalone wrapper around CollectiveAgent.detectConstructionDemands().
 */
export function detectConstructionDemands(
  population: number,
  housingCapacity: number,
  resources: ResourceSnapshot,
): ConstructionDemand[] {
  return _sharedAgent.detectConstructionDemands(population, housingCapacity, resources);
}

/**
 * Autonomously place a building near existing buildings.
 * Standalone wrapper around CollectiveAgent.autoPlaceBuilding().
 */
export function autoPlaceBuilding(defId: string, rng: GameRng): Entity | null {
  return _sharedAgent.autoPlaceBuilding(defId, rng);
}

/**
 * Find a placement cell near existing buildings.
 * Standalone wrapper around CollectiveAgent.findPlacementCell().
 */
export function findPlacementCell(rng: GameRng): { gridX: number; gridY: number } | null {
  return _sharedAgent.findPlacementCell(rng);
}

// ─────────────────────────────────────────────────────────────────────────────
// Backward-compat class: CollectivePlanner
// Lightweight wrapper that delegates to a shared CollectiveAgent instance.
// Formerly in game/CollectivePlanner.ts.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lightweight planner that merges mandates and demands into a build queue.
 * @deprecated Use CollectiveAgent.generateQueue() directly.
 */
export class CollectivePlanner {
  generateQueue(mandateState: PlanMandateState | null, demands: ConstructionDemand[]): ConstructionRequest[] {
    return _sharedAgent.generateQueue(mandateState, demands);
  }
}
