/**
 * @module game/arcology/ArcologySystem
 *
 * Pure function system that detects and manages building merges into
 * arcology mega-structures. Arcologies form when adjacent buildings
 * of the same merge group reach critical mass (3+ connected components).
 *
 * Only active when population >= arcologyThresholds.mergeStartPopulation (50,000).
 * At 500,000+ population, arcologies with high containment can receive domes.
 */

import type { World } from 'miniplex';
import type { Entity } from '../../ecs/world';
import arcologyConfig from '../../config/arcology.json';

// ── Types ────────────────────────────────────────────────────────────────────

/** A group of merged buildings forming a mega-structure. */
export interface Arcology {
  /** Unique arcology identifier. */
  id: string;
  /** Merge group key (e.g. 'residential', 'industrial'). */
  mergeGroup: string;
  /** Building entity IDs that merged into this arcology. */
  componentEntityIds: number[];
  /** Building defIds that merged. */
  componentDefIds: string[];
  /** Grid cells this arcology occupies. */
  footprint: { x: number; y: number }[];
  /** Center of mass position. */
  center: { x: number; y: number };
  /** Total population housed in this arcology. */
  population: number;
  /** Total worker count across merged buildings. */
  workers: number;
  /** Combined production multiplier (efficiency bonus from merging). */
  productionBonus: number;
  /** Self-containment ratio (0-1): 1.0 = fully enclosed, ready for dome. */
  containment: number;
  /** Whether this arcology has been assigned a dome. */
  hasDome: boolean;
  /** Dome radius (computed from footprint). */
  domeRadius: number;
}

/** Context required by the arcology evaluation function. */
export interface ArcologySystemContext {
  /** The ECS world to query for buildings. */
  world: World<Entity>;
  /** Current settlement population. */
  population: number;
  /** Existing arcologies from previous ticks. */
  arcologies: Arcology[];
}

/** Result of arcology evaluation. */
export interface ArcologySystemResult {
  /** All current arcologies (including preserved and new). */
  arcologies: Arcology[];
  /** New merges that happened this tick (for UI animation). */
  newMerges: Arcology[];
  /** Total population in arcologies. */
  arcologyPopulation: number;
  /** Whether dome construction should begin. */
  domeThresholdReached: boolean;
}

// ── Merge group lookup ───────────────────────────────────────────────────────

/** Merge groups from config: which building defIds can merge together. */
const MERGE_GROUPS: Record<string, string[]> = arcologyConfig.mergeGroups;

/**
 * Reverse lookup: defId -> merge group key.
 * Built once at module load from the config.
 */
const DEF_TO_GROUP: Map<string, string> = new Map();
for (const [group, defIds] of Object.entries(MERGE_GROUPS)) {
  for (const defId of defIds) {
    DEF_TO_GROUP.set(defId, group);
  }
}

// ── Internal helpers ─────────────────────────────────────────────────────────

/** Orthogonal neighbor offsets (no diagonals). */
const ORTHOGONAL_OFFSETS: ReadonlyArray<{ dx: number; dy: number }> = [
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: -1 },
  { dx: 0, dy: 1 },
];

/** Grid position encoded as string for Set/Map lookups. */
function posKey(x: number, y: number): string {
  return `${x},${y}`;
}

/**
 * Internal representation of a building on the grid,
 * used during flood-fill grouping.
 */
interface GridBuilding {
  /** Miniplex entity reference (for ID extraction). */
  entity: Entity & { position: { gridX: number; gridY: number }; building: { defId: string; workerCount: number; residentCount: number } };
  /** Entity index in the world (used as entity ID). */
  entityId: number;
  /** Grid position. */
  x: number;
  y: number;
  /** Building definition ID. */
  defId: string;
  /** Merge group this building belongs to. */
  mergeGroup: string;
}

/**
 * Flood fill from a starting cell to find all connected cells of the
 * same merge group. Uses BFS with orthogonal adjacency only.
 *
 * @param startKey - Position key of the starting cell
 * @param mergeGroup - The merge group to match
 * @param positionMap - Map of position key -> GridBuilding
 * @param visited - Set of already-visited position keys (mutated)
 * @returns Array of connected GridBuildings
 */
function floodFill(
  startKey: string,
  mergeGroup: string,
  positionMap: Map<string, GridBuilding>,
  visited: Set<string>,
): GridBuilding[] {
  const component: GridBuilding[] = [];
  const queue: string[] = [startKey];
  visited.add(startKey);

  while (queue.length > 0) {
    const key = queue.shift()!;
    const building = positionMap.get(key);
    if (!building) continue;

    component.push(building);

    // Check orthogonal neighbors
    for (const { dx, dy } of ORTHOGONAL_OFFSETS) {
      const nx = building.x + dx;
      const ny = building.y + dy;
      const nKey = posKey(nx, ny);

      if (visited.has(nKey)) continue;

      const neighbor = positionMap.get(nKey);
      if (!neighbor) continue;
      if (neighbor.mergeGroup !== mergeGroup) continue;

      visited.add(nKey);
      queue.push(nKey);
    }
  }

  return component;
}

/**
 * Compute the bounding dome radius from a set of footprint cells.
 * Uses the maximum distance from center to any footprint cell, plus
 * a 0.5-cell padding for visual coverage.
 */
function computeDomeRadius(
  footprint: { x: number; y: number }[],
  center: { x: number; y: number },
): number {
  let maxDistSq = 0;
  for (const cell of footprint) {
    const dx = cell.x - center.x;
    const dy = cell.y - center.y;
    maxDistSq = Math.max(maxDistSq, dx * dx + dy * dy);
  }
  return Math.sqrt(maxDistSq) + 0.5;
}

/** Generate a deterministic arcology ID from its component positions. */
function generateArcologyId(mergeGroup: string, footprint: { x: number; y: number }[]): string {
  // Sort footprint for deterministic ID regardless of discovery order
  const sorted = [...footprint].sort((a, b) => a.x - b.x || a.y - b.y);
  const minX = sorted[0].x;
  const minY = sorted[0].y;
  return `arc-${mergeGroup}-${minX}-${minY}`;
}

// ── Main evaluation function ─────────────────────────────────────────────────

/**
 * Evaluate the current world state and detect/update arcologies.
 *
 * Algorithm:
 * 1. Skip entirely if population < mergeStartPopulation threshold
 * 2. Index all buildings by grid position and merge group
 * 3. Flood-fill connected components of same-group buildings
 * 4. Filter to components with >= mergeMinBuildings
 * 5. Compute metrics (footprint, center, production bonus, containment)
 * 6. Preserve dome assignments from existing arcologies
 * 7. Check dome threshold conditions
 *
 * @param ctx - System context with world, population, and previous arcologies
 * @returns Updated arcology state
 */
export function evaluateArcologies(ctx: ArcologySystemContext): ArcologySystemResult {
  const { world, population, arcologies: existingArcologies } = ctx;
  const config = arcologyConfig;

  // Gate: only evaluate when population meets the threshold
  if (population < config.populationThresholds.arcologyStart) {
    return {
      arcologies: [],
      newMerges: [],
      arcologyPopulation: 0,
      domeThresholdReached: false,
    };
  }

  // ── Step 1: Index buildings by position ──

  const buildings = world.with('position', 'building', 'isBuilding');
  const positionMap = new Map<string, GridBuilding>();

  // Collect all entity indices for ID mapping
  const allEntities = world.entities;

  for (const entity of buildings) {
    const defId = entity.building.defId;
    const mergeGroup = DEF_TO_GROUP.get(defId);
    if (!mergeGroup) continue; // Building not in any merge group

    // Skip buildings under construction
    if (
      entity.building.constructionPhase !== undefined &&
      entity.building.constructionPhase !== 'complete'
    ) {
      continue;
    }

    const x = entity.position.gridX;
    const y = entity.position.gridY;
    const key = posKey(x, y);

    // Find entity ID (index in world)
    const entityId = allEntities.indexOf(entity as Entity);

    positionMap.set(key, {
      entity: entity as GridBuilding['entity'],
      entityId,
      x,
      y,
      defId,
      mergeGroup,
    });
  }

  // ── Step 2: Flood-fill connected components ──

  const visited = new Set<string>();
  const newArcologies: Arcology[] = [];

  // Build lookup of existing arcology dome status by ID
  const existingDomeStatus = new Map<string, boolean>();
  for (const arc of existingArcologies) {
    existingDomeStatus.set(arc.id, arc.hasDome);
  }

  // Build set of existing arcology IDs for new-merge detection
  const existingIds = new Set(existingArcologies.map((a) => a.id));

  for (const [key, building] of positionMap) {
    if (visited.has(key)) continue;

    const component = floodFill(key, building.mergeGroup, positionMap, visited);

    // Only form arcology from 3+ connected buildings
    if (component.length < config.mergeMinBuildings) continue;

    // ── Step 3: Compute arcology metrics ──

    const footprint = component.map((b) => ({ x: b.x, y: b.y }));

    // Center of mass
    let sumX = 0;
    let sumY = 0;
    for (const cell of footprint) {
      sumX += cell.x;
      sumY += cell.y;
    }
    const center = {
      x: sumX / footprint.length,
      y: sumY / footprint.length,
    };

    // Population and workers from building components
    let totalPopulation = 0;
    let totalWorkers = 0;
    for (const b of component) {
      totalPopulation += b.entity.building.residentCount;
      totalWorkers += b.entity.building.workerCount;
    }

    // Production bonus: 5% per building beyond 2, capped at maxProductionBonus
    const bonusBuildings = component.length - 2;
    const rawBonus = bonusBuildings * config.productionBonusPerBuilding;
    const productionBonus = 1.0 + Math.min(rawBonus, config.maxProductionBonus);

    // Containment: each building contributes containmentPerBuilding, capped at 1.0
    const containment = Math.min(1.0, component.length * config.containmentPerBuilding);

    // Dome radius from footprint
    const domeRadius = computeDomeRadius(footprint, center);

    // Generate deterministic ID
    const id = generateArcologyId(building.mergeGroup, footprint);

    // Preserve dome assignment from existing arcology
    const hasDome = existingDomeStatus.get(id) ?? false;

    const arcology: Arcology = {
      id,
      mergeGroup: building.mergeGroup,
      componentEntityIds: component.map((b) => b.entityId),
      componentDefIds: component.map((b) => b.defId),
      footprint,
      center,
      population: totalPopulation,
      workers: totalWorkers,
      productionBonus,
      containment,
      hasDome,
      domeRadius,
    };

    newArcologies.push(arcology);
  }

  // ── Step 4: Identify new merges (for UI animation) ──

  const newMerges = newArcologies.filter((a) => !existingIds.has(a.id));

  // ── Step 5: Total arcology population ──

  let arcologyPopulation = 0;
  for (const arc of newArcologies) {
    arcologyPopulation += arc.population;
  }

  // ── Step 6: Dome threshold check ──

  const domeThresholdReached =
    population >= config.populationThresholds.domeStart &&
    newArcologies.some((a) => a.containment >= config.domeContainmentThreshold);

  return {
    arcologies: newArcologies,
    newMerges,
    arcologyPopulation,
    domeThresholdReached,
  };
}
