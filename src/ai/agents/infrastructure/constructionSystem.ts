/**
 * @module ecs/systems/constructionSystem
 *
 * Advances buildings through construction phases each simulation tick.
 *
 * Buildings placed via placeNewBuilding() start at phase 'foundation'
 * with constructionTicks=0. Each tick:
 *   1. Check material availability (timber, steel, cement, prefab)
 *   2. Deduct per-tick material cost from resources
 *   3. Increment constructionTicks (potentially multiple if worker bonus applies)
 *   4. Derive progress from ticks / effectiveBaseTicks
 *   5. Transition phase at thresholds (50% → 'building', 100% → 'complete')
 *
 * If materials are insufficient, construction PAUSES — ticks do not advance
 * and no materials are consumed. Construction resumes when materials arrive.
 *
 * Worker speed bonus: citizens assigned to a building defId that is under
 * construction contribute labor. When workers meet or exceed the
 * constructionCost.staffCap, construction advances at double speed.
 * With no workers assigned, construction still advances at base speed
 * (manual labor implied).
 *
 * Only buildings in the `underConstruction` archetype are processed.
 * On completion, the entity is reindexed so it joins operational
 * archetypes (producers, housing, etc.).
 */

import { getBuildingDef } from '@/data/buildingDefs';
import { assignedCitizens, getResourceEntity, underConstruction } from '@/ecs/archetypes';
import type { Entity } from '@/ecs/world';
import { world } from '@/ecs/world';

/**
 * Default construction ticks when a building def doesn't specify constructionCost.
 * At ~3 ticks per in-game day, this is roughly 5 days of construction.
 */
export const DEFAULT_BASE_TICKS = 15;

/** Default staffCap when a building def doesn't specify constructionCost.staffCap. */
export const DEFAULT_STAFF_CAP = 5;

/**
 * Default material cost when a building def doesn't specify constructionCost.
 * Represents a small wooden structure (Era 1 kolkhoz building).
 */
export const DEFAULT_MATERIAL_COST = {
  timber: 30,
  steel: 10,
  cement: 5,
  prefab: 0,
} as const;

type MaterialSet = { timber: number; steel: number; cement: number; prefab: number };
const MATERIAL_KEYS = ['timber', 'steel', 'cement', 'prefab'] as const;

/** Compute per-tick material deduction rate (ceil to ensure total is consumed). */
function perTickCost(totalCost: number, baseTicks: number): number {
  if (totalCost <= 0) return 0;
  return Math.max(1, Math.ceil(totalCost / baseTicks));
}

/** Check if resources are sufficient for one construction tick. */
function hasSufficientMaterials(resources: MaterialSet, costs: MaterialSet, baseTicks: number): boolean {
  return MATERIAL_KEYS.every((k) => {
    const rate = perTickCost(costs[k], baseTicks);
    return rate === 0 || resources[k] >= rate;
  });
}

/** Deduct per-tick material costs from resources, clamping to exact totals. */
function deductMaterials(res: MaterialSet, costs: MaterialSet, baseTicks: number, ticksSoFar: number): void {
  for (const k of MATERIAL_KEYS) {
    const rate = perTickCost(costs[k], baseTicks);
    const remaining = costs[k] - ticksSoFar * rate;
    res[k] -= Math.min(rate, Math.max(0, remaining));
  }
}

/** Resolve material costs for a building, falling back to defaults. */
function resolveCosts(defId: string, eraTimeMult: number, weatherTimeMult: number, seasonMult: number) {
  const def = getBuildingDef(defId);
  const defCost = def?.stats.constructionCost;
  const baseTicks = defCost?.baseTicks ?? DEFAULT_BASE_TICKS;
  return {
    effectiveBaseTicks: Math.max(1, Math.ceil(baseTicks * eraTimeMult * weatherTimeMult * seasonMult)),
    materialCost: {
      timber: defCost?.timber ?? DEFAULT_MATERIAL_COST.timber,
      steel: defCost?.steel ?? DEFAULT_MATERIAL_COST.steel,
      cement: defCost?.cement ?? DEFAULT_MATERIAL_COST.cement,
      prefab: defCost?.prefab ?? DEFAULT_MATERIAL_COST.prefab,
    },
    staffCap: defCost?.staffCap ?? DEFAULT_STAFF_CAP,
  };
}

/**
 * Compute worker speed multiplier for a construction site.
 *
 * Workers assigned to the building's defId are split evenly across all
 * construction sites of that type. The ratio of per-site workers to
 * staffCap determines the speed bonus:
 *   - 0 workers: 1.0x (base speed — manual labor implied)
 *   - staffCap workers: 2.0x (double speed — fully staffed)
 *   - >staffCap: capped at 2.0x (no benefit from overstaffing)
 *
 * @param workerCount - Workers assigned to this defId
 * @param siteCount - Number of active construction sites for this defId
 * @param staffCap - Optimal worker count per site
 */
export function workerSpeedMult(workerCount: number, siteCount: number, staffCap: number): number {
  if (siteCount <= 0 || staffCap <= 0) return 1.0;
  const workersPerSite = workerCount / siteCount;
  const ratio = Math.min(workersPerSite / staffCap, 1.0);
  return 1.0 + ratio; // 1.0x → 2.0x
}

/** Advance a single building entity through construction. */
function advanceBuilding(
  entity: Entity,
  res: MaterialSet | undefined,
  eraTimeMult: number,
  weatherTimeMult: number,
  seasonMult: number,
  speedMult: number,
): void {
  const building = entity.building;
  if (!building) return;
  const phase = building.constructionPhase;
  if (phase == null || phase === 'complete') return;

  const { effectiveBaseTicks, materialCost } = resolveCosts(building.defId, eraTimeMult, weatherTimeMult, seasonMult);

  if (res && !hasSufficientMaterials(res, materialCost, effectiveBaseTicks)) return;
  if (res) deductMaterials(res, materialCost, effectiveBaseTicks, building.constructionTicks ?? 0);

  // Apply worker speed multiplier: advance more ticks per simulation tick
  const tickAdvance = Math.max(1, Math.floor(speedMult));
  const ticks = Math.min((building.constructionTicks ?? 0) + tickAdvance, effectiveBaseTicks);
  building.constructionTicks = ticks;
  building.constructionProgress = Math.min(1, ticks / effectiveBaseTicks);

  if (ticks >= effectiveBaseTicks) {
    building.constructionPhase = 'complete';
    building.constructionProgress = 1;
    world.reindex(entity);
  } else if (building.constructionProgress >= 0.5 && phase === 'foundation') {
    building.constructionPhase = 'building';
  }
}

/**
 * Runs the construction system for one simulation tick.
 *
 * @param eraTimeMult - Era-specific construction time multiplier (default 1.0).
 * @param weatherTimeMult - Weather-specific construction time multiplier (default 1.0).
 * @param seasonMult - Seasonal build cost multiplier (default 1.0). Rasputitsa penalty mitigated by road quality.
 */
export function constructionSystem(eraTimeMult = 1.0, weatherTimeMult = 1.0, seasonMult = 1.0): void {
  const snapshot = [...underConstruction.entities];
  if (snapshot.length === 0) return;

  const res = getResourceEntity()?.resources;

  // Count workers assigned to each defId and how many sites exist per defId
  const workersByDef = new Map<string, number>();
  const sitesByDef = new Map<string, number>();

  for (const entity of snapshot) {
    const defId = entity.building.defId;
    sitesByDef.set(defId, (sitesByDef.get(defId) ?? 0) + 1);
  }

  for (const citizen of assignedCitizens.entities) {
    const assignment = citizen.citizen.assignment;
    if (assignment && sitesByDef.has(assignment)) {
      workersByDef.set(assignment, (workersByDef.get(assignment) ?? 0) + 1);
    }
  }

  for (const entity of snapshot) {
    const defId = entity.building.defId;
    const { staffCap } = resolveCosts(defId, eraTimeMult, weatherTimeMult, seasonMult);
    const workers = workersByDef.get(defId) ?? 0;
    const sites = sitesByDef.get(defId) ?? 1;
    const speedMult = workerSpeedMult(workers, sites, staffCap);

    advanceBuilding(entity, res, eraTimeMult, weatherTimeMult, seasonMult, speedMult);
  }
}
