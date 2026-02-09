/**
 * @module ecs/systems/productionSystem
 *
 * Runs producer buildings each tick, adding their output to the
 * global resource stockpile.
 *
 * Only powered producer buildings contribute resources. Unpowered
 * producers are silently skipped.
 */

import { getResourceEntity, producers } from '@/ecs/archetypes';

/**
 * Runs the production system for one simulation tick.
 *
 * Iterates all buildings that have a `produces` field. If the
 * building is powered, its output is added to the resource store.
 *
 * @param farmModifier  Weather-driven multiplier for food output (0.0–2.0, default 1.0).
 * @param vodkaModifier Politburo-driven multiplier for vodka output (default 1.0).
 */
export function productionSystem(farmModifier = 1.0, vodkaModifier = 1.0): void {
  const store = getResourceEntity();
  if (!store) return;

  for (const entity of producers) {
    // Only powered buildings produce
    if (!entity.building.powered) continue;

    const prod = entity.building.produces;
    if (!prod) continue;

    switch (prod.resource) {
      case 'food':
        store.resources.food += prod.amount * farmModifier;
        break;
      case 'vodka':
        store.resources.vodka += prod.amount * vodkaModifier;
        break;
    }
  }
}
