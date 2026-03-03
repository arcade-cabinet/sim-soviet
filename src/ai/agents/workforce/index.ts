/**
 * @fileoverview Barrel file for the workforce agent subpackage.
 *
 * Re-exports WorkerAgent, WorkerSystem, and all public types/utilities
 * needed by external consumers (SimulationEngine, UI panels, tests).
 */

export { applyMorale, calcBaseEfficiency, calcClassBonus, generateWorkerName } from './classes';
export {
  COLLECTIVE_DIRECTIVES,
  type CollectiveDirective,
  getDirectiveByFocus,
  type RiskLevel,
} from './collectiveDirectives';
export {
  collapseEntitiesToBuildings,
  getPopulationMode,
  type PopulationMode,
} from './collectiveTransition';
export {
  CLASS_ORDER,
  CLASS_PRODUCTION_BONUS,
  CLASS_WEIGHTS,
  HEATING_FAILURE_MORALE_PENALTY,
  PRIVATE_PLOT_FOOD_PER_HECTARE,
  PRIVATE_PLOT_MORALE_BOOST,
  TRUDODNI_ANNUAL_MINIMUM,
  TRUDODNI_PER_TICK,
  TRUDODNI_SHORTFALL_MORALE_PENALTY,
} from './constants';
export {
  type GenderLaborConfig,
  getGenderLaborConfig,
  getGenderLaborMultiplier,
} from './genderLabor';
export type {
  AssignmentSource,
  PopulationDrainEvent,
  PopulationDrainReason,
  PopulationInflowEvent,
  PopulationInflowReason,
  TickContext,
  WorkerDisplayInfo,
  WorkerStats,
  WorkerTickResult,
} from './types';
export { WorkerAgent } from './WorkerAgent';
export type { WorkerStatEntry, WorkerSystemSaveData, WorkerTickContext } from './WorkerSystem';
export { WorkerSystem } from './WorkerSystem';
