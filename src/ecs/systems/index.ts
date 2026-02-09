/**
 * @module ecs/systems
 *
 * Barrel export for all ECS systems.
 * Each system is a pure function that operates on the world.
 */

export { powerSystem } from './powerSystem';
export { productionSystem } from './productionSystem';
export { consumptionSystem, setStarvationCallback } from './consumptionSystem';
export type { StarvationCallback } from './consumptionSystem';
export { populationSystem } from './populationSystem';
export { decaySystem, setBuildingCollapsedCallback } from './decaySystem';
export type { BuildingCollapsedCallback } from './decaySystem';
export { quotaSystem, createDefaultQuota } from './quotaSystem';
export type { QuotaState } from './quotaSystem';
