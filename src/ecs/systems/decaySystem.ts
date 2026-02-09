/**
 * @module ecs/systems/decaySystem
 *
 * Reduces building durability over time.
 *
 * Buildings decay each tick by their `decayRate`. When durability
 * reaches zero the building entity is removed from the world.
 * This simulates the inevitable crumbling of Soviet infrastructure.
 */

import { decayableBuildings } from '@/ecs/archetypes';
import { world } from '@/ecs/world';

/** Callback fired when a building collapses due to decay */
export type BuildingCollapsedCallback = (
  gridX: number,
  gridY: number,
  buildingType: string,
) => void;

/** Stored callback for building collapse events */
let _onBuildingCollapsed: BuildingCollapsedCallback | undefined;

/**
 * Registers a callback that fires when a building collapses.
 *
 * @param cb - Callback to invoke on collapse, or undefined to clear
 */
export function setBuildingCollapsedCallback(cb: BuildingCollapsedCallback | undefined): void {
  _onBuildingCollapsed = cb;
}

/**
 * Runs the decay system for one simulation tick.
 *
 * Iterates all buildings with a durability component and reduces
 * their durability by their decay rate. Buildings that reach 0
 * durability are removed from the world.
 */
export function decaySystem(): void {
  // Collect entities to remove (cannot modify during iteration)
  const toRemove: Array<{ entity: (typeof decayableBuildings.entities)[number]; gridX: number; gridY: number; type: string }> = [];

  for (const entity of decayableBuildings) {
    entity.durability.current -= entity.durability.decayRate;

    if (entity.durability.current <= 0) {
      entity.durability.current = 0;

      // Gather info before removal
      const pos = 'position' in entity && entity.position
        ? entity.position
        : undefined;

      toRemove.push({
        entity,
        gridX: pos?.gridX ?? -1,
        gridY: pos?.gridY ?? -1,
        type: entity.building.type,
      });
    }
  }

  // Remove collapsed buildings
  for (const { entity, gridX, gridY, type } of toRemove) {
    world.remove(entity);
    _onBuildingCollapsed?.(gridX, gridY, type);
  }
}
