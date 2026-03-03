/**
 * @module ecs/systems
 *
 * Barrel export for all ECS systems.
 * Each system is a pure function that operates on the world.
 */

export type {
  ConsumptionResult,
  ResentmentCallback,
  StarvationCallback,
} from '../../ai/agents/economy/consumptionSystem';
export {
  consumptionSystem,
  resetStarvationCounter,
  setResentmentCallback,
  setStarvationCallback,
} from '../../ai/agents/economy/consumptionSystem';
export type { ProductionModifiers } from '../../ai/agents/economy/productionSystem';
export { effectiveWorkers, productionSystem } from '../../ai/agents/economy/productionSystem';
export {
  calculateStorageCapacity,
  getBuildingStorageContribution,
  storageSystem,
} from '../../ai/agents/economy/storageSystem';
// Re-export from new agent location
export {
  constructionSystem,
  DEFAULT_BASE_TICKS,
  DEFAULT_MATERIAL_COST,
  DEFAULT_STAFF_CAP,
  workerSpeedMult,
} from '../../ai/agents/infrastructure/constructionSystem';
// Re-export from new agent location
export type { BuildingCollapsedCallback } from '../../ai/agents/infrastructure/decaySystem';
export { decaySystem, setBuildingCollapsedCallback } from '../../ai/agents/infrastructure/decaySystem';
export type { QuotaResourceType, QuotaState, ResourceQuota } from '../../ai/agents/political/PoliticalAgent';
export { areAllQuotasMet, createDefaultQuota, quotaSystem } from '../../ai/agents/political/PoliticalAgent';
export type {
  AgedIntoWorkingRef,
  DeadMemberRef,
  DemographicTickResult,
} from '../../ai/agents/social/demographicSystem';
export {
  ageAllMembers,
  birthCheck,
  deathCheck,
  demographicTick,
  ERA_BIRTH_RATE_MULTIPLIER,
  getWorkingMotherPenalty,
  householdFormation,
  pregnancyTick,
} from '../../ai/agents/social/demographicSystem';
export type { DistributionResult, RoleBucket } from './distributionWeights';
export {
  computeDistribution,
  computeRoleBuckets,
  DISTRIBUTION_WEIGHTS,
  RESENTMENT_MORALE_PENALTY,
  RESENTMENT_THRESHOLD,
} from './distributionWeights';
export type { PopulationGrowthResult } from './populationSystem';
export { populationSystem } from './populationSystem';
export { powerSystem } from './powerSystem';
