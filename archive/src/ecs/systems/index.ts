/**
 * @module ecs/systems
 *
 * Barrel export for all ECS systems.
 * Each system is a pure function that operates on the world.
 */

export { constructionSystem, DEFAULT_BASE_TICKS } from './constructionSystem';
export type { StarvationCallback } from './consumptionSystem';
export { consumptionSystem, setStarvationCallback } from './consumptionSystem';
export type { BuildingCollapsedCallback } from './decaySystem';
export { decaySystem, setBuildingCollapsedCallback } from './decaySystem';
export type { DemographicTickResult } from './demographicSystem';
export { ageAllMembers, birthCheck, deathCheck, demographicTick } from './demographicSystem';
export { populationSystem } from './populationSystem';
export { powerSystem } from './powerSystem';
export { productionSystem } from './productionSystem';
export type { QuotaState } from './quotaSystem';
export { createDefaultQuota, quotaSystem } from './quotaSystem';
export { calculateStorageCapacity, storageSystem } from './storageSystem';
