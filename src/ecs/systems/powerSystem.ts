/**
 * @module ecs/systems/powerSystem
 *
 * Calculates power distribution across all buildings.
 *
 * Power plants generate power; other buildings consume it.
 * Buildings are powered on a first-come-first-served basis
 * (ordered by their position in the world). Once available
 * power is exhausted, remaining buildings are marked unpowered.
 *
 * After running, the resource store's `power` and `powerUsed`
 * fields are updated.
 */

import { getResourceEntity, buildingsLogic } from '@/ecs/archetypes';
import { world } from '@/ecs/world';

/**
 * Runs the power distribution system for one simulation tick.
 *
 * 1. Sum total power output from all power-generating buildings.
 * 2. Iterate all buildings, consuming power for those that require it.
 * 3. Mark each building as powered or unpowered accordingly.
 * 4. Update the resource store with totals.
 */
export function powerSystem(): void {
  const store = getResourceEntity();
  if (!store) return;

  // Phase 1: Calculate total power supply
  let totalPower = 0;
  for (const entity of buildingsLogic) {
    if (entity.building.powerOutput > 0) {
      totalPower += entity.building.powerOutput;
    }
  }

  // Phase 2: Distribute power to consumers
  let powerUsed = 0;
  for (const entity of buildingsLogic) {
    const req = entity.building.powerReq;
    if (req > 0) {
      const newUsed = powerUsed + req;
      const wasPowered = entity.building.powered;
      const isPowered = newUsed <= totalPower;

      entity.building.powered = isPowered;

      if (isPowered) {
        powerUsed = newUsed;
      }

      // Reindex if powered state changed (for predicate queries)
      if (wasPowered !== isPowered) {
        world.reindex(entity);
      }
    } else if (entity.building.powerOutput > 0) {
      // Power plants are always "powered"
      if (!entity.building.powered) {
        entity.building.powered = true;
        world.reindex(entity);
      }
    } else {
      // No power requirement and no output — always powered (e.g. roads)
      if (!entity.building.powered) {
        entity.building.powered = true;
        world.reindex(entity);
      }
    }
  }

  // Phase 3: Update resource store
  store.resources.power = totalPower;
  store.resources.powerUsed = powerUsed;
}
