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
  footprintX: number,
  footprintY: number
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
 * Advances building durability by one simulation tick and removes collapsed buildings.
 *
 * Reduces each decayable building's durability by its decayRate multiplied by `decayMult`. When a building's durability reaches zero it is removed from the world and, if registered, the building-collapsed callback is invoked with the building's grid coordinates, building type, and footprint dimensions.
 *
 * @param decayMult - Multiplier applied to each building's `decayRate` for this tick (default: `1.0`)
 */
export function decaySystem(decayMult = 1.0): void {
  // Collect entities to remove (cannot modify during iteration)
  const toRemove: Array<{
    entity: (typeof decayableBuildings.entities)[number];
    gridX: number;
    gridY: number;
    type: string;
    footprintX: number;
    footprintY: number;
  }> = [];

  for (const entity of decayableBuildings) {
    entity.durability.current -= entity.durability.decayRate * decayMult;

    if (entity.durability.current <= 0) {
      entity.durability.current = 0;

      // Gather info before removal (entity data is lost after world.remove)
      const pos = 'position' in entity && entity.position ? entity.position : undefined;
      const fpX = 'renderable' in entity && entity.renderable ? entity.renderable.footprintX : 1;
      const fpY = 'renderable' in entity && entity.renderable ? entity.renderable.footprintY : 1;

      toRemove.push({
        entity,
        gridX: pos?.gridX ?? -1,
        gridY: pos?.gridY ?? -1,
        type: entity.building.defId,
        footprintX: fpX,
        footprintY: fpY,
      });
    }
  }

  // Remove collapsed buildings
  for (const { entity, gridX, gridY, type, footprintX, footprintY } of toRemove) {
    world.remove(entity);
    _onBuildingCollapsed?.(gridX, gridY, type, footprintX, footprintY);
  }
}