/**
 * Shared test setup helpers for ECS-based tests.
 *
 * Provides a single function to initialize the ECS world with resource
 * and meta singletons, plus a fresh GameGrid.
 */
import { getMetaEntity, getResourceEntity } from '@/ecs/archetypes';
import { createMetaStore, createResourceStore } from '@/ecs/factories';
import type { GameMeta } from '@/ecs/world';
import { world } from '@/ecs/world';
import { GameGrid } from '@/game/GameGrid';

/**
 * Clears the ECS world and creates fresh resource + meta store singletons
 * along with a new GameGrid.
 */
export function setupEcsForTest(
  resourceOverrides?: Partial<{
    money: number;
    food: number;
    vodka: number;
    power: number;
    powerUsed: number;
    population: number;
  }>,
  metaOverrides?: Partial<GameMeta>
) {
  world.clear();
  const grid = new GameGrid();
  createResourceStore(resourceOverrides);
  createMetaStore(metaOverrides);
  return { grid, store: getResourceEntity()!, meta: getMetaEntity()! };
}
