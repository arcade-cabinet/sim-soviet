/**
 * @module ai/agents/narrative/prestigeLifecycle
 *
 * Pure functions for the prestige project lifecycle:
 * demand announcement, construction start, yearly tick, and completion evaluation.
 */

import { PRESTIGE_PROJECTS, type PrestigeProject } from '../../../config/prestigeProjects';
import type { EraId } from '../../../game/era/types';
import { ERA_DEFINITIONS } from '../../../game/era/definitions';
import type { GameRng } from '../../../game/SeedSystem';

/** Politburo announcement of a prestige project demand. */
export interface PrestigeProjectDemand {
  /** The prestige project being demanded. */
  project: PrestigeProject;
  /** Era this demand belongs to. */
  era: EraId;
  /** Year the Politburo announces the project (within the era's range). */
  announcementYear: number;
}

/** In-progress construction state for a prestige project. */
export interface ConstructionState {
  /** The project under construction. */
  project: PrestigeProject;
  /** Years of construction completed so far. */
  progress: number;
  /** Calendar year construction began. */
  startYear: number;
  /** Resources that were deducted when construction started. */
  resourcesInvested: { money: number; food?: number; power?: number };
}

/** Result of evaluating a prestige project for completion or failure. */
export interface CompletionResult {
  /** Whether the project was completed successfully. */
  success: boolean;
  /** Rewards granted on success. */
  rewards?: { politicalCapital: number; moraleBoost: number };
  /** Penalties applied on failure. */
  penalties?: { politicalCapitalLoss: number; arrestRisk: number };
}

/**
 * Politburo announces the era's prestige project.
 * The announcement year is randomized within the era's date range.
 *
 * @param era - The era to demand a project for
 * @param rng - Seeded RNG for deterministic announcement year
 */
export function demandPrestigeProject(era: EraId, rng: GameRng): PrestigeProjectDemand | null {
  const project = PRESTIGE_PROJECTS[era];
  if (!project) return null; // Sub-eras have no prestige projects
  const eraDef = ERA_DEFINITIONS[era];
  const startYear = eraDef.startYear;
  const endYear = eraDef.endYear === -1 ? startYear + 20 : eraDef.endYear;
  const announcementYear = rng.int(startYear, Math.max(startYear, endYear - project.durationYears));

  return { project, era, announcementYear };
}

/**
 * Start construction of a prestige project by deducting costs from available resources.
 * Returns null if resources are insufficient (no resources are deducted in that case).
 *
 * @param project - The prestige project to begin
 * @param resources - Mutable resource pool; costs are deducted in-place on success
 * @param currentYear - Calendar year construction begins
 */
export function startConstruction(
  project: PrestigeProject,
  resources: { money: number; food: number; power: number },
  currentYear: number,
): ConstructionState | null {
  const { money, food, power } = project.cost;

  if (resources.money < money) return null;
  if (food != null && resources.food < food) return null;
  if (power != null && resources.power < power) return null;

  resources.money -= money;
  const invested: ConstructionState['resourcesInvested'] = { money };

  if (food != null) {
    resources.food -= food;
    invested.food = food;
  }
  if (power != null) {
    resources.power -= power;
    invested.power = power;
  }

  return {
    project,
    progress: 0,
    startYear: currentYear,
    resourcesInvested: invested,
  };
}

/**
 * Advance construction by one year. Returns a new state (does not mutate input).
 *
 * @param state - Current construction state
 */
export function tickConstruction(state: ConstructionState): ConstructionState {
  return { ...state, progress: state.progress + 1 };
}

/**
 * Evaluate whether a prestige project is complete or has failed.
 * Success if progress >= durationYears; failure otherwise.
 *
 * @param state - Current construction state to evaluate
 */
export function completeProject(state: ConstructionState): CompletionResult {
  if (state.progress >= state.project.durationYears) {
    return {
      success: true,
      rewards: {
        politicalCapital: state.project.reward.politicalCapital,
        moraleBoost: state.project.reward.moraleBoost,
      },
    };
  }

  return {
    success: false,
    penalties: {
      politicalCapitalLoss: state.project.failurePenalty.politicalCapitalLoss,
      arrestRisk: state.project.failurePenalty.arrestRisk,
    },
  };
}
