/**
 * @module ecs/systems/productionSystem
 *
 * Runs producer buildings each tick, adding their output to the
 * global resource stockpile.
 *
 * Only powered producer buildings contribute resources. Unpowered
 * producers are silently skipped.
 */

import { getBuildingDef } from '@/data/buildingDefs';
import { citizens, getResourceEntity, producers } from '@/ecs/archetypes';

/**
 * Minimum contribution ratio for extra workers (below this, no benefit).
 * After ~6 extra workers the geometric decay drops below this threshold.
 */
const OVERSTAFFING_MIN_CONTRIBUTION = 0.015625; // 0.5^6

/**
 * Calculate effective worker count with overstaffing diminishing returns.
 *
 * The first `staffCap` workers contribute 100% productivity each.
 * Each additional worker beyond staffCap contributes 50% less than the
 * previous extra worker (geometric decay):
 *   extra worker 1 → 50%, extra worker 2 → 25%, extra worker 3 → 12.5%, ...
 *
 * Contributions below ~1.5% are capped at 0 (after ~6 extra workers).
 *
 * This reflects the real Soviet problem of throwing bodies at production
 * targets: the first few extras help, but packing a factory floor with
 * twice the workers mostly generates queues for the single wrench.
 */
export function effectiveWorkers(workers: number, staffCap: number): number {
  if (staffCap <= 0 || workers <= staffCap) return workers;

  let effective = staffCap;
  const extra = workers - staffCap;
  // Fractional overstaffing triggers full tier benefits (avgWorkers may be
  // fractional from division). Even 0.01 extra unlocks the first 50% tier.
  let contribution = 0.5; // first extra worker contributes 50%

  for (let i = 0; i < extra; i++) {
    if (contribution < OVERSTAFFING_MIN_CONTRIBUTION) break;
    effective += contribution;
    contribution *= 0.5;
  }

  return effective;
}

/**
 * Count workers assigned to each building defId.
 * Returns a map of defId → assigned worker count.
 */
function countAssignedWorkers(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entity of citizens) {
    const assignment = entity.citizen.assignment;
    if (assignment) {
      counts.set(assignment, (counts.get(assignment) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * Optional expanded production modifiers for the full formula:
 *   baseRate x workers x skill x season x doctrine x condition
 */
export interface ProductionModifiers {
  /** Average worker skill factor (0.5 - 1.5, default 1.0) */
  skillFactor?: number;
  /** Building average condition factor (0.0 - 1.0, default 1.0) */
  conditionFactor?: number;
  /** Per-building stakhanovite boosts (defId → multiplier) */
  stakhanoviteBoosts?: ReadonlyMap<string, number>;
}

/**
 * Runs the production system for one simulation tick.
 *
 * Iterates all buildings that have a `produces` field. If the
 * building is powered, its output is added to the resource store.
 * Overstaffing beyond staffCap has geometric diminishing returns (50% decay).
 *
 * FIX-07: Expanded formula: baseRate x workers x skill x season x doctrine x condition
 * (season and doctrine are folded into farmModifier/vodkaModifier by SimulationEngine)
 *
 * @param farmModifier  Weather-driven multiplier for food output (0.0–2.0, default 1.0).
 * @param vodkaModifier Politburo-driven multiplier for vodka output (default 1.0).
 * @param mods          Optional expanded production modifiers.
 */
export function productionSystem(farmModifier = 1.0, vodkaModifier = 1.0, mods?: ProductionModifiers): void {
  const store = getResourceEntity();
  if (!store) return;

  // Count workers per building defId for overstaffing calculation
  const workerCounts = countAssignedWorkers();

  // Count buildings per defId to spread workers evenly across instances
  const buildingCounts = new Map<string, number>();
  for (const entity of producers) {
    const defId = entity.building.defId;
    buildingCounts.set(defId, (buildingCounts.get(defId) ?? 0) + 1);
  }

  for (const entity of producers) {
    // Only powered buildings produce
    if (!entity.building.powered) continue;

    const prod = entity.building.produces;
    if (!prod) continue;

    // Calculate overstaffing multiplier from building def's staffCap
    let workerMult = 1.0;
    const defId = entity.building.defId;
    const def = getBuildingDef(defId);
    const staffCap = def?.stats.staffCap;
    if (staffCap && staffCap > 0) {
      const totalWorkers = workerCounts.get(defId) ?? 0;
      const numBuildings = buildingCounts.get(defId) ?? 1;
      const avgWorkers = totalWorkers / numBuildings;
      if (avgWorkers > staffCap) {
        workerMult = effectiveWorkers(avgWorkers, staffCap) / avgWorkers;
      }
    }

    // FIX-07: Expanded production formula factors
    const skillFactor = mods?.skillFactor ?? 1.0;
    const conditionFactor = mods?.conditionFactor ?? 1.0;
    // FIX-02: Apply per-building stakhanovite boost if active
    const stakhanoviteBoost = mods?.stakhanoviteBoosts?.get(defId) ?? 1.0;
    const expandedMult = workerMult * skillFactor * conditionFactor * stakhanoviteBoost;

    switch (prod.resource) {
      case 'food':
        store.resources.food += prod.amount * farmModifier * expandedMult;
        break;
      case 'vodka': {
        // FIX-05: Vodka/grain diversion — 2 grain (food) per 1 vodka produced
        const vodkaOutput = prod.amount * vodkaModifier * expandedMult;
        const grainCost = vodkaOutput * 2;
        if (store.resources.food >= grainCost) {
          store.resources.food -= grainCost;
          store.resources.vodka += vodkaOutput;
        } else {
          // Insufficient grain — produce proportionally to available grain
          const affordable = store.resources.food / 2;
          if (affordable > 0) {
            store.resources.food -= affordable * 2;
            store.resources.vodka += affordable;
          }
        }
        break;
      }
    }
  }
}
