/**
 * @module ecs/factories
 *
 * Barrel re-export of all entity factory functions for SimSoviet 2000.
 *
 * Each sub-module creates pre-configured entities with the correct components
 * and adds them to the world. Building stats are sourced from the generated
 * buildingDefs.generated.json (via the Zod-validated data layer).
 */

export {
  completeConstruction,
  createBuilding,
  isOperational,
  placeNewBuilding,
} from './buildingFactories';
export { computeRenderSlot, createCitizen } from './citizenFactories';
export { ageCategoryFromAge, laborCapacityForAge, memberRoleForAge } from './demographics';
export type { Difficulty, DvorMemberSeed } from './settlementFactories';
export { createDvor, createStartingSettlement } from './settlementFactories';
export { createGrid, createMetaStore, createResourceStore, createTile } from './storeFactories';
