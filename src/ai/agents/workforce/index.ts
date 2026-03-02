/**
 * @fileoverview Barrel file for the workforce agent subpackage.
 *
 * Re-exports WorkerAgent, WorkerSystem, and all public types/utilities
 * needed by external consumers (SimulationEngine, UI panels, tests).
 */

export { WorkerAgent } from './WorkerAgent';
export { WorkerSystem } from './WorkerSystem';
export type { WorkerStatEntry, WorkerSystemSaveData, WorkerTickContext } from './WorkerSystem';
export { generateWorkerName } from './classes';
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
export {
  COLLECTIVE_DIRECTIVES,
  getDirectiveByFocus,
  type CollectiveDirective,
  type RiskLevel,
} from './collectiveDirectives';
export {
  getGenderLaborConfig,
  getGenderLaborMultiplier,
  type GenderLaborConfig,
} from './genderLabor';
export {
  CLASS_ORDER,
  CLASS_WEIGHTS,
  CLASS_PRODUCTION_BONUS,
  TRUDODNI_ANNUAL_MINIMUM,
  TRUDODNI_SHORTFALL_MORALE_PENALTY,
  TRUDODNI_PER_TICK,
  PRIVATE_PLOT_FOOD_PER_HECTARE,
  PRIVATE_PLOT_MORALE_BOOST,
  HEATING_FAILURE_MORALE_PENALTY,
} from './constants';
export { applyMorale, calcBaseEfficiency, calcClassBonus } from './classes';
export {
  getPopulationMode,
  collapseEntitiesToBuildings,
  type PopulationMode,
} from './collectiveTransition';
