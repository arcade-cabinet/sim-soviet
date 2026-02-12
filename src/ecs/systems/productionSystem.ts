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
 * Calculate effective worker count with overstaffing diminishing returns.
 *
 * Workers beyond staffCap contribute only 25% effectiveness —
 * reflects the real Soviet problem of throwing bodies at production targets.
 *
 * effectiveWorkers = min(workers, staffCap) + max(0, workers - staffCap) × 0.25
 */
function effectiveWorkers(workers: number, staffCap: number): number {
  if (staffCap <= 0 || workers <= staffCap) return workers;
  return staffCap + (workers - staffCap) * 0.25;
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
 * Runs the production system for one simulation tick.
 *
 * Iterates all buildings that have a `produces` field. If the
 * building is powered, its output is added to the resource store.
 * Overstaffing beyond staffCap has diminishing returns (25% efficiency).
 *
 * @param farmModifier  Weather-driven multiplier for food output (0.0–2.0, default 1.0).
 * @param vodkaModifier Politburo-driven multiplier for vodka output (default 1.0).
 */
export function productionSystem(farmModifier = 1.0, vodkaModifier = 1.0): void {
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

    switch (prod.resource) {
      case 'food':
        store.resources.food += prod.amount * farmModifier * workerMult;
        break;
      case 'vodka':
        store.resources.vodka += prod.amount * vodkaModifier * workerMult;
        break;
    }
  }
}
