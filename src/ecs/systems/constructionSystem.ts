/**
 * @module ecs/systems/constructionSystem
 *
 * Advances buildings through construction phases each simulation tick.
 *
 * Buildings placed via placeNewBuilding() start at phase 'foundation'
 * with constructionTicks=0. Each tick:
 *   1. Check material availability (timber, steel, cement, prefab)
 *   2. Deduct per-tick material cost from resources
 *   3. Increment constructionTicks
 *   4. Derive progress from ticks / effectiveBaseTicks
 *   5. Transition phase at thresholds (50% → 'building', 100% → 'complete')
 *
 * If materials are insufficient, construction PAUSES — ticks do not advance
 * and no materials are consumed. Construction resumes when materials arrive.
 *
 * Only buildings in the `underConstruction` archetype are processed.
 * On completion, the entity is reindexed so it joins operational
 * archetypes (producers, housing, etc.).
 */

import { getBuildingDef } from '@/data/buildingDefs';
import { getResourceEntity, underConstruction } from '@/ecs/archetypes';
import type { Entity } from '@/ecs/world';
import { world } from '@/ecs/world';

/**
 * Default construction ticks when a building def doesn't specify constructionCost.
 * At ~3 ticks per in-game day, this is roughly 5 days of construction.
 */
export const DEFAULT_BASE_TICKS = 15;

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
function hasSufficientMaterials(
  resources: MaterialSet,
  costs: MaterialSet,
  baseTicks: number
): boolean {
  return MATERIAL_KEYS.every((k) => {
    const rate = perTickCost(costs[k], baseTicks);
    return rate === 0 || resources[k] >= rate;
  });
}

/** Deduct per-tick material costs from resources, clamping to exact totals. */
function deductMaterials(
  res: MaterialSet,
  costs: MaterialSet,
  baseTicks: number,
  ticksSoFar: number
): void {
  for (const k of MATERIAL_KEYS) {
    const rate = perTickCost(costs[k], baseTicks);
    const remaining = costs[k] - ticksSoFar * rate;
    res[k] -= Math.min(rate, Math.max(0, remaining));
  }
}

/** Resolve material costs for a building, falling back to defaults. */
function resolveCosts(defId: string, eraTimeMult: number, weatherTimeMult: number) {
  const def = getBuildingDef(defId);
  const defCost = def?.stats.constructionCost;
  const baseTicks = defCost?.baseTicks ?? DEFAULT_BASE_TICKS;
  return {
    effectiveBaseTicks: Math.max(1, Math.ceil(baseTicks * eraTimeMult * weatherTimeMult)),
    materialCost: {
      timber: defCost?.timber ?? DEFAULT_MATERIAL_COST.timber,
      steel: defCost?.steel ?? DEFAULT_MATERIAL_COST.steel,
      cement: defCost?.cement ?? DEFAULT_MATERIAL_COST.cement,
      prefab: defCost?.prefab ?? DEFAULT_MATERIAL_COST.prefab,
    },
  };
}

/** Advance a single building entity through construction. */
function advanceBuilding(
  entity: Entity,
  res: MaterialSet | undefined,
  eraTimeMult: number,
  weatherTimeMult: number
): void {
  const building = entity.building;
  if (!building) return;
  const phase = building.constructionPhase;
  if (phase == null || phase === 'complete') return;

  const { effectiveBaseTicks, materialCost } = resolveCosts(
    building.defId,
    eraTimeMult,
    weatherTimeMult
  );

  if (res && !hasSufficientMaterials(res, materialCost, effectiveBaseTicks)) return;
  if (res) deductMaterials(res, materialCost, effectiveBaseTicks, building.constructionTicks ?? 0);

  const ticks = (building.constructionTicks ?? 0) + 1;
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
 */
export function constructionSystem(eraTimeMult: number = 1.0, weatherTimeMult: number = 1.0): void {
  const snapshot = [...underConstruction.entities];
  const res = getResourceEntity()?.resources;
  for (const entity of snapshot) {
    advanceBuilding(entity, res, eraTimeMult, weatherTimeMult);
  }
}
