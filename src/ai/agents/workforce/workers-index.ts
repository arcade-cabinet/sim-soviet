/**
 * @fileoverview Barrel file for the worker system.
 */

export { generateWorkerName } from './classes';
export { computeLaborBudget, LABOR_BUDGET_CONFIG } from './laborBudget';
export type { LaborBudgetConfig, LaborBudgetResult } from './laborBudget';
export type {
  PopulationDrainEvent,
  PopulationDrainReason,
  PopulationInflowEvent,
  PopulationInflowReason,
  TickContext,
  WorkerDisplayInfo,
  WorkerStats,
  WorkerTickResult,
} from './types';
export type { WorkerSystemSaveData, WorkerTickContext } from './WorkerSystem';
export { WorkerSystem } from './WorkerSystem';
