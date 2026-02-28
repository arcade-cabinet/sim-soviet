/**
 * @module ecs/systems
 *
 * Barrel export for all ECS systems.
 * Each system is a pure function that operates on the world.
 */

export {
  constructionSystem,
  DEFAULT_BASE_TICKS,
  DEFAULT_MATERIAL_COST,
  DEFAULT_STAFF_CAP,
  workerSpeedMult,
} from './constructionSystem';
export type { StarvationCallback } from './consumptionSystem';
export { consumptionSystem, setStarvationCallback } from './consumptionSystem';
export type { BuildingCollapsedCallback } from './decaySystem';
export { decaySystem, setBuildingCollapsedCallback } from './decaySystem';
export type { DemographicTickResult } from './demographicSystem';
export { ageAllMembers, birthCheck, deathCheck, demographicTick } from './demographicSystem';
export type { PopulationGrowthResult } from './populationSystem';
export { populationSystem } from './populationSystem';
export { powerSystem } from './powerSystem';
export type { ProductionModifiers } from './productionSystem';
export { productionSystem } from './productionSystem';
export type { QuotaResourceType, QuotaState, ResourceQuota } from './quotaSystem';
export { areAllQuotasMet, createDefaultQuota, quotaSystem } from './quotaSystem';
export { calculateStorageCapacity, getBuildingStorageContribution, storageSystem } from './storageSystem';
