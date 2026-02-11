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

/**
 * Compute per-tick material deduction. We use ceil() so that the total
 * consumed across all ticks is exactly the total cost (the last tick
 * gets clamped to the remaining amount via the tracker).
 */
function perTickCost(totalCost: number, baseTicks: number): number {
  if (totalCost <= 0) return 0;
  return Math.max(1, Math.ceil(totalCost / baseTicks));
}

/**
 * Check if resources are sufficient for one construction tick.
 */
function hasSufficientMaterials(
  resources: { timber: number; steel: number; cement: number; prefab: number },
  costs: { timber: number; steel: number; cement: number; prefab: number },
  baseTicks: number
): boolean {
  if (
    perTickCost(costs.timber, baseTicks) > 0 &&
    resources.timber < perTickCost(costs.timber, baseTicks)
  )
    return false;
  if (
    perTickCost(costs.steel, baseTicks) > 0 &&
    resources.steel < perTickCost(costs.steel, baseTicks)
  )
    return false;
  if (
    perTickCost(costs.cement, baseTicks) > 0 &&
    resources.cement < perTickCost(costs.cement, baseTicks)
  )
    return false;
  if (
    perTickCost(costs.prefab, baseTicks) > 0 &&
    resources.prefab < perTickCost(costs.prefab, baseTicks)
  )
    return false;
  return true;
}

/**
 * Runs the construction system for one simulation tick.
 *
 * @param eraTimeMult - Era-specific construction time multiplier (default 1.0).
 *   Values > 1 slow construction (manual era), < 1 speed it up (industrial era).
 * @param weatherTimeMult - Weather-specific construction time multiplier (default 1.0).
 *   Stacks multiplicatively with eraTimeMult.
 */
export function constructionSystem(eraTimeMult: number = 1.0, weatherTimeMult: number = 1.0): void {
  // Iterate a snapshot — completion triggers reindex which may mutate the bucket
  const snapshot = [...underConstruction.entities];
  const store = getResourceEntity();
  const res = store?.resources;

  for (const entity of snapshot) {
    const { building } = entity;
    const phase = building.constructionPhase;
    if (phase == null || phase === 'complete') continue;

    // Determine costs from building def (or defaults)
    const def = getBuildingDef(building.defId);
    const defCost = def?.stats.constructionCost;
    const baseTicks = defCost?.baseTicks ?? DEFAULT_BASE_TICKS;
    const effectiveBaseTicks = Math.max(1, Math.ceil(baseTicks * eraTimeMult * weatherTimeMult));

    const materialCost = {
      timber: defCost?.timber ?? DEFAULT_MATERIAL_COST.timber,
      steel: defCost?.steel ?? DEFAULT_MATERIAL_COST.steel,
      cement: defCost?.cement ?? DEFAULT_MATERIAL_COST.cement,
      prefab: defCost?.prefab ?? DEFAULT_MATERIAL_COST.prefab,
    };

    // Check material availability — pause if insufficient
    if (res && !hasSufficientMaterials(res, materialCost, effectiveBaseTicks)) {
      continue;
    }

    // Deduct materials for this tick
    if (res) {
      // Track how much has already been consumed (ticks already elapsed × per-tick)
      const ticksSoFar = building.constructionTicks ?? 0;
      const consumeForTick = (total: number) => {
        const rate = perTickCost(total, effectiveBaseTicks);
        // On the last tick, consume only what's remaining to hit the exact total
        const alreadyConsumed = ticksSoFar * rate;
        const remaining = total - alreadyConsumed;
        return Math.min(rate, Math.max(0, remaining));
      };

      res.timber -= consumeForTick(materialCost.timber);
      res.steel -= consumeForTick(materialCost.steel);
      res.cement -= consumeForTick(materialCost.cement);
      res.prefab -= consumeForTick(materialCost.prefab);
    }

    // Advance integer tick counter
    const ticks = (building.constructionTicks ?? 0) + 1;
    building.constructionTicks = ticks;

    // Derive progress from integer ratio (avoids floating-point accumulation)
    const progress = Math.min(1, ticks / effectiveBaseTicks);
    building.constructionProgress = progress;

    // Phase transitions
    if (ticks >= effectiveBaseTicks) {
      building.constructionPhase = 'complete';
      building.constructionProgress = 1;
      world.reindex(entity);
    } else if (progress >= 0.5 && phase === 'foundation') {
      building.constructionPhase = 'building';
    }
  }
}
