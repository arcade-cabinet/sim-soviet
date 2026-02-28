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

import type { With } from 'miniplex';
import { buildingsLogic, getResourceEntity } from '@/ecs/archetypes';
import type { Entity } from '@/ecs/world';
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

  const totalPower = calculateTotalPower();
  const powerUsed = distributePower(totalPower);

  store.resources.power = totalPower;
  store.resources.powerUsed = powerUsed;
}

/** Phase 1: Sum total power output from all power-generating buildings. */
function calculateTotalPower(): number {
  let total = 0;
  for (const entity of buildingsLogic) {
    if (entity.building.powerOutput > 0) {
      total += entity.building.powerOutput;
    }
  }
  return total;
}

/** Phase 2: Distribute power to consumers; mark powered/unpowered. */
function distributePower(totalPower: number): number {
  let powerUsed = 0;
  for (const entity of buildingsLogic) {
    const req = entity.building.powerReq;
    if (req > 0) {
      powerUsed = assignConsumerPower(entity, powerUsed, totalPower);
    } else {
      ensureAlwaysPowered(entity);
    }
  }
  return powerUsed;
}

/** Assign power to a consuming building, reindex if state changes. */
function assignConsumerPower(
  entity: With<Entity, 'position' | 'building'>,
  powerUsed: number,
  totalPower: number,
): number {
  const newUsed = powerUsed + entity.building.powerReq;
  const wasPowered = entity.building.powered;
  const isPowered = newUsed <= totalPower;

  entity.building.powered = isPowered;
  if (wasPowered !== isPowered) {
    world.reindex(entity);
  }
  return isPowered ? newUsed : powerUsed;
}

/** Power plants and zero-requirement buildings are always powered. */
function ensureAlwaysPowered(entity: With<Entity, 'position' | 'building'>): void {
  if (!entity.building.powered) {
    entity.building.powered = true;
    world.reindex(entity);
  }
}
