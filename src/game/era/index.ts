/**
 * @module game/era
 *
 * Era and campaign system — historical era progression with building
 * gates, modifiers, and campaign flavor text.
 */

export { ERA_DEFINITIONS, ERA_ORDER } from './definitions';
export { EraSystem } from './EraSystem';
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
