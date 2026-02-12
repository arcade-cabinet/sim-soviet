/**
 * @module ecs/factories
 *
 * Barrel re-export — all factory functions are now in src/ecs/factories/.
 * This file exists so that existing imports like
 *   import { createBuilding } from '@/ecs/factories'
 * continue to work without changes.
 */

export type { Difficulty, DvorMemberSeed } from './factories/index';
export {
  ageCategoryFromAge,
  clearTerrainFeatures,
  completeConstruction,
  computeRenderSlot,
  createBuilding,
  createCitizen,
  createDvor,
  createForest,
  createGrid,
  createMarsh,
  createMetaStore,
  createMountain,
  createResourceStore,
  createRiver,
  createStartingSettlement,
  createTile,
  isOperational,
  laborCapacityForAge,
  memberRoleForAge,
  placeNewBuilding,
} from './factories/index';
