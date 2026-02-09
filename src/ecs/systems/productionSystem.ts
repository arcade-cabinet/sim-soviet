/**
 * @module ecs/systems/productionSystem
 *
 * Runs producer buildings each tick, adding their output to the
 * global resource stockpile.
 *
 * Only powered producer buildings contribute resources. Unpowered
 * producers are silently skipped.
 */

import { producers, getResourceEntity } from '@/ecs/archetypes';

/**
 * Runs the production system for one simulation tick.
 *
 * Iterates all buildings that have a `produces` field. If the
 * building is powered, its output is added to the resource store.
 */
export function productionSystem(): void {
  const store = getResourceEntity();
  if (!store) return;

  for (const entity of producers) {
    // Only powered buildings produce
    if (!entity.building.powered) continue;

    const prod = entity.building.produces;
    if (!prod) continue;

    switch (prod.resource) {
      case 'food':
        store.resources.food += prod.amount;
        break;
      case 'vodka':
        store.resources.vodka += prod.amount;
        break;
    }
  }
}
