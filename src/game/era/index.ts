/**
 * @module game/era
 *
 * Era and campaign system — historical era progression with building
 * gates, modifiers, and campaign flavor text.
 */

export { ERA_DEFINITIONS, ERA_ORDER } from './definitions';
export { EraSystem } from './EraSystem';
export {
  BUILDING_TIER_REQUIREMENTS,
  getBuildingTierRequirement,
  SETTLEMENT_TIER_ORDER,
  tierMeetsRequirement,
} from './tiers';
// Public API — matches original EraSystem.ts exports
export type {
  ConstructionMethod,
  EraCheckpoint,
  EraCondition,
  EraDefinition,
  EraId,
  EraModifiers,
  EraSystemSaveData,
} from './types';
