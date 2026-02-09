/**
 * @module ecs/archetypes
 *
 * Pre-built Miniplex queries (archetypes) for common entity shapes.
 *
 * Each archetype is a reactive query that automatically indexes entities
 * as components are added or removed. Use these in systems and React
 * components instead of ad-hoc filtering.
 *
 * Miniplex 2.0 caches queries by key, so calling `world.with("position")`
 * twice returns the same Query object.
 */

import type { With } from 'miniplex';
import type { Entity } from './world';
import { world } from './world';

// ─── Building Archetypes ─────────────────────────────────────────────────────

/**
 * All building entities (have position, building data, and renderable info).
 */
export const buildings = world.with('position', 'building', 'renderable');

/**
 * Building entities that only need position + building (no renderable required).
 * Useful for logic-only systems that do not care about rendering.
 */
export const buildingsLogic = world.with('position', 'building');

/**
 * Buildings that are currently receiving power.
 *
 * NOTE: This uses a predicate query. After mutating `building.powered`,
 * you must call `world.reindex(entity)` for the entity to move between
 * the powered / unpowered buckets.
 */
export const poweredBuildings = buildingsLogic.where(
  (entity): entity is With<Entity, 'position' | 'building'> => entity.building.powered === true
);

/**
 * Buildings that are NOT currently receiving power.
 *
 * Same reindex caveat as `poweredBuildings`.
 */
export const unpoweredBuildings = buildingsLogic.where(
  (entity): entity is With<Entity, 'position' | 'building'> => entity.building.powered === false
);

/**
 * Producer buildings — buildings that have a `produces` field.
 * These generate food or vodka each simulation tick.
 */
export const producers = buildingsLogic.where(
  (entity): entity is With<Entity, 'position' | 'building'> => entity.building.produces != null
);

/**
 * Housing buildings — buildings with positive housing capacity.
 */
export const housing = buildingsLogic.where(
  (entity): entity is With<Entity, 'position' | 'building'> => entity.building.housingCap > 0
);

/**
 * Buildings that have a durability component (can decay).
 */
export const decayableBuildings = world.with('building', 'durability');

// ─── Citizen Archetypes ──────────────────────────────────────────────────────

/**
 * All citizen entities (have position and citizen data).
 */
export const citizens = world.with('position', 'citizen');

/**
 * Citizens that have been assigned to a workplace.
 */
export const assignedCitizens = citizens.where(
  (entity): entity is With<Entity, 'position' | 'citizen'> => entity.citizen.assignment != null
);

/**
 * Citizens that have been assigned housing.
 */
export const housedCitizens = citizens.where(
  (entity): entity is With<Entity, 'position' | 'citizen'> => entity.citizen.home != null
);

// ─── Tile Archetypes ─────────────────────────────────────────────────────────

/**
 * All tile entities (have position and tile data).
 */
export const tiles = world.with('position', 'tile');

// ─── Singleton Archetypes ────────────────────────────────────────────────────

/**
 * The resource store singleton entity.
 * Should contain exactly one entity at all times.
 */
export const resourceStore = world.with('resources', 'isResourceStore');

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Retrieves the singleton resource entity, or `undefined` if none exists.
 * Prefer this over indexing into `resourceStore.entities[0]` directly to
 * get proper TypeScript narrowing.
 */
export function getResourceEntity(): With<Entity, 'resources' | 'isResourceStore'> | undefined {
  return resourceStore.entities[0];
}
