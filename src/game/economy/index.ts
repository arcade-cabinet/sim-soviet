/**
 * @module game/economy
 *
 * Barrel file re-exporting the full public API of the economy subpackage.
 */

export { PRODUCTION_CHAINS } from './chains';
export { applyCurrencyReform, CURRENCY_REFORMS, findPendingReform } from './currency';
export {
  calculateStartingResources,
  DIFFICULTY_MULTIPLIERS,
  DIFFICULTY_RESOURCE_MULT,
  ERA_RESOURCE_MULT,
  getDifficultyMultipliers,
} from './difficulty';
// ── Class ────────────────────────────────────────────────────────
export { EconomySystem } from './EconomySystem';
export { FONDY_BY_ERA } from './fondy';
export {
  DISTRICT_HEATING_POPULATION,
  DISTRICT_TO_CRUMBLING_TICKS,
  determineHeatingTier,
  HEATING_CONFIGS,
} from './heating';
export { MTS_DEFAULTS, MTS_END_YEAR, MTS_START_YEAR, shouldMTSBeActive } from './mts';
export {
  calculateNextQuota,
  DIFFICULTY_QUOTA_MULT,
  ERA_ESCALATION,
  QUOTA_MET_ESCALATION,
  QUOTA_MISSED_REDUCTION,
} from './quota';
export {
  calculateRationDemand,
  DEFAULT_RATIONS,
  RATION_PERIODS,
  shouldRationsBeActive,
} from './rations';
export { STAKHANOVITE_CHANCE } from './stakhanovites';
// ── Pure Functions ───────────────────────────────────────────────
// ── Constants ────────────────────────────────────────────────────
export {
  calculateBuildingTrudodni,
  DEFAULT_TRUDODNI,
  MINIMUM_TRUDODNI_BY_DIFFICULTY,
  TRUDODNI_PER_BUILDING,
} from './trudodni';
// ── Types ────────────────────────────────────────────────────────
export type {
  AllResources,
  BaseResources,
  BlatState,
  CurrencyReformEvent,
  CurrencyReformResult,
  DifficultyLevel,
  DifficultyMultipliers,
  EconomySaveData,
  EconomyTickResult,
  EraId,
  ExtendedResources,
  FondyAllocation,
  FondyDeliveryResult,
  HeatingState,
  HeatingTickResult,
  HeatingTier,
  MTSState,
  MTSTickResult,
  ProductionChain,
  ProductionStep,
  RationConfig,
  RationDemand,
  RationTier,
  RemainderAllocation,
  StakhanoviteEvent,
  TransferableResource,
  TrudodniRecord,
} from './types';
