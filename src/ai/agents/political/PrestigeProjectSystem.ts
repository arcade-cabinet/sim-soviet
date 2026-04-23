/**
 * @module ai/agents/political/PrestigeProjectSystem
 *
 * Prestige project management -- massive Soviet historical mega-projects
 * from monuments to industrial works.
 *
 * These are NOT player-chosen. Moscow mandates them when political
 * conditions align. Only one project can be active at a time
 * (Soviet bureaucracy -- one mega-project at a time).
 *
 * Projects form a dependency tree loaded from src/config/prestige.json.
 *
 * @param PrestigeContext - Current game state snapshot for eligibility checks
 * @param PrestigeProjectState - Serializable state for save/load
 */

import prestigeData from '../../../config/prestige.json';
import { ERA_ORDER } from '../../../game/era/definitions';

// ─── Types ──────────────────────────────────────────────────────────────────

/** A prestige project definition loaded from config. */
export interface PrestigeProject {
  /** Unique project identifier. */
  id: string;
  /** Display name. */
  name: string;
  /** Sardonic description. */
  description: string;
  /** Era during which this project becomes eligible. */
  era: string;
  /** Minimum population required. */
  minPopulation: number;
  /** Minimum political standing (0-1) required. */
  minPoliticalStanding?: number;
  /** Minimum tech level (0-1) required. */
  minTechLevel?: number;
  /** Minimum calendar year required. */
  minYear?: number;
  /** Number of ticks to construct. */
  constructionTicks: number;
  /** Resource costs deducted upfront on start. */
  resourceCost: Record<string, number>;
  /** Effects applied on completion. */
  effects: Record<string, number | boolean | string>;
  /** Capability strings unlocked on completion. */
  unlocks: string[];
  /** ID of prerequisite project that must be completed first, or null. */
  prerequisite: string | null;
  /** Pravda headline when construction starts. */
  pravdaAnnouncement: string;
  /** Toast message on completion. */
  completionToast: string;
}

/** Serializable prestige project state for save/load. */
export interface PrestigeProjectState {
  /** IDs of projects that have been completed. */
  completed: string[];
  /** Currently active project (only one at a time), or null. */
  active: { projectId: string; ticksRemaining: number } | null;
  /** Capability strings unlocked from completed projects. */
  unlockedCapabilities: string[];
}

/** Game state snapshot needed for prestige eligibility checks. */
export interface PrestigeContext {
  /** Current total population. */
  population: number;
  /** Current calendar year. */
  year: number;
  /** Current era ID. */
  eraId: string;
  /** Political standing (0-1). */
  politicalStanding: number;
  /** Technology level (0-1). */
  techLevel: number;
  /** Available resources keyed by resource name. */
  resources: Record<string, number>;
  /** Current prestige project state. */
  state: PrestigeProjectState;
}

/** Result of a single prestige tick. */
export interface PrestigeTickResult {
  /** Updated state after this tick. */
  state: PrestigeProjectState;
  /** Project that just completed this tick, or null. */
  justCompleted: PrestigeProject | null;
  /** Projects available to start (conditions met, not started, prerequisite done). */
  available: PrestigeProject[];
  /** Resources to deduct this tick (non-null only when a new project starts). */
  resourceDeduction: Record<string, number> | null;
  /** Pravda headline for a newly started project, or null. */
  pravdaHeadline: string | null;
  /** Toast message for a just-completed project, or null. */
  completionMessage: string | null;
}

// ─── Project Catalog ────────────────────────────────────────────────────────

/** All prestige projects loaded from config. */
const PROJECTS: PrestigeProject[] = (prestigeData as unknown as { projects: PrestigeProject[] }).projects;

/**
 * Get the full prestige project catalog.
 *
 * @returns Read-only array of all prestige project definitions
 */
export function getAllProjects(): readonly PrestigeProject[] {
  return PROJECTS;
}

/**
 * Look up a prestige project by ID.
 *
 * @param id - Project identifier
 * @returns The project definition, or undefined if not found
 */
export function getProjectById(id: string): PrestigeProject | undefined {
  return PROJECTS.find((p) => p.id === id);
}

// ─── State Factory ──────────────────────────────────────────────────────────

/**
 * Create an empty initial prestige project state.
 *
 * @returns Fresh PrestigeProjectState with nothing completed or active
 */
export function createPrestigeState(): PrestigeProjectState {
  return {
    completed: [],
    active: null,
    unlockedCapabilities: [],
  };
}

// ─── Era Index Helpers ──────────────────────────────────────────────────────

/**
 * Get the index of an era ID in ERA_ORDER.
 * Returns -1 if not found.
 *
 * @param eraId - Era identifier to look up
 * @returns 0-based index, or -1 if not found
 */
function eraIndex(eraId: string): number {
  return ERA_ORDER.indexOf(eraId as (typeof ERA_ORDER)[number]);
}

/**
 * Check whether the current era is at or past the required era for a project.
 *
 * @param currentEraId - The current game era
 * @param requiredEraId - The era the project requires
 * @returns True if the current era is at or after the required era
 */
function eraReached(currentEraId: string, requiredEraId: string): boolean {
  const current = eraIndex(currentEraId);
  const required = eraIndex(requiredEraId);
  if (current < 0 || required < 0) return false;
  return current >= required;
}

// ─── Eligibility ────────────────────────────────────────────────────────────

/**
 * Check whether a project's conditions are met in the given context.
 * Does NOT check resource affordability -- only population, era, tech, year,
 * political standing, and prerequisites.
 *
 * @param project - The prestige project definition
 * @param ctx - Current game context
 * @returns True if all non-resource conditions are met
 */
function meetsConditions(project: PrestigeProject, ctx: PrestigeContext): boolean {
  // Already completed?
  if (ctx.state.completed.includes(project.id)) return false;

  // Currently active?
  if (ctx.state.active?.projectId === project.id) return false;

  // Prerequisite not completed?
  if (project.prerequisite && !ctx.state.completed.includes(project.prerequisite)) return false;

  // Era not reached?
  if (!eraReached(ctx.eraId, project.era)) return false;

  // Population too low?
  if (ctx.population < project.minPopulation) return false;

  // Political standing too low?
  if (project.minPoliticalStanding != null && ctx.politicalStanding < project.minPoliticalStanding) return false;

  // Tech level too low?
  if (project.minTechLevel != null && ctx.techLevel < project.minTechLevel) return false;

  // Year not reached?
  if (project.minYear != null && ctx.year < project.minYear) return false;

  return true;
}

/**
 * Check whether the player can afford a project's resource costs.
 *
 * @param project - The prestige project definition
 * @param resources - Available resources keyed by name
 * @returns True if all resource costs can be paid
 */
export function canAffordProject(project: PrestigeProject, resources: Record<string, number>): boolean {
  for (const [resource, cost] of Object.entries(project.resourceCost)) {
    if ((resources[resource] ?? 0) < cost) return false;
  }
  return true;
}

// ─── Available Projects ─────────────────────────────────────────────────────

/**
 * Get all projects whose conditions are met and that the player can afford.
 *
 * @param ctx - Current game context
 * @returns Array of eligible, affordable prestige projects
 */
export function getAvailableProjects(ctx: PrestigeContext): PrestigeProject[] {
  return PROJECTS.filter((p) => meetsConditions(p, ctx) && canAffordProject(p, ctx.resources));
}

// ─── Start Project ──────────────────────────────────────────────────────────

/**
 * Start a prestige project. Deducts resources upfront.
 * Returns null if the project cannot be found or there is already an active project.
 *
 * @param state - Current prestige state (will be cloned, not mutated)
 * @param projectId - ID of the project to start
 * @returns Updated state and resource cost to deduct, or null if invalid
 */
export function startProject(
  state: PrestigeProjectState,
  projectId: string,
): { state: PrestigeProjectState; resourceCost: Record<string, number> } | null {
  if (state.active !== null) return null;

  const project = getProjectById(projectId);
  if (!project) return null;

  if (state.completed.includes(projectId)) return null;

  return {
    state: {
      ...state,
      completed: [...state.completed],
      active: { projectId, ticksRemaining: project.constructionTicks },
      unlockedCapabilities: [...state.unlockedCapabilities],
    },
    resourceCost: { ...project.resourceCost },
  };
}

// ─── Tick ───────────────────────────────────────────────────────────────────

/**
 * Advance prestige project state by one tick.
 *
 * - If an active project is under construction, decrements ticksRemaining.
 * - If ticksRemaining hits 0, completes the project (adds to completed,
 *   merges unlocks, clears active).
 * - If no project is active, checks for the first available project whose
 *   conditions are met and starts it automatically (Moscow mandates).
 *
 * @param ctx - Current game context including prestige state
 * @returns Tick result with updated state and any events
 */
export function tickPrestigeProjects(ctx: PrestigeContext): PrestigeTickResult {
  const state: PrestigeProjectState = {
    completed: [...ctx.state.completed],
    active: ctx.state.active ? { ...ctx.state.active } : null,
    unlockedCapabilities: [...ctx.state.unlockedCapabilities],
  };

  let justCompleted: PrestigeProject | null = null;
  let resourceDeduction: Record<string, number> | null = null;
  let pravdaHeadline: string | null = null;
  let completionMessage: string | null = null;

  // ── Tick active project ──────────────────────────────────────────────────

  if (state.active !== null) {
    state.active.ticksRemaining--;

    if (state.active.ticksRemaining <= 0) {
      // Project completed!
      const project = getProjectById(state.active.projectId);
      if (project) {
        justCompleted = project;
        completionMessage = project.completionToast;
        state.completed.push(project.id);
        for (const cap of project.unlocks) {
          if (!state.unlockedCapabilities.includes(cap)) {
            state.unlockedCapabilities.push(cap);
          }
        }
      }
      state.active = null;
    }
  }

  // ── Auto-start next project (Moscow mandates) ───────────────────────────

  if (state.active === null) {
    const ctxForAvailability: PrestigeContext = { ...ctx, state };
    const available = getAvailableProjects(ctxForAvailability);

    if (available.length > 0) {
      const next = available[0]!;
      resourceDeduction = { ...next.resourceCost };
      pravdaHeadline = next.pravdaAnnouncement;
      state.active = {
        projectId: next.id,
        ticksRemaining: next.constructionTicks,
      };
    }
  }

  // ── Compute currently available (for UI/queries) ────────────────────────

  const ctxFinal: PrestigeContext = { ...ctx, state };
  const available = state.active === null ? getAvailableProjects(ctxFinal) : [];

  return {
    state,
    justCompleted,
    available,
    resourceDeduction,
    pravdaHeadline,
    completionMessage,
  };
}

// ─── Serialization ──────────────────────────────────────────────────────────

/**
 * Serialize prestige state for save persistence.
 * The state is already a plain object -- this just ensures a clean copy.
 *
 * @param state - The prestige project state to serialize
 * @returns A JSON-safe copy of the state
 */
export function serializePrestigeState(state: PrestigeProjectState): PrestigeProjectState {
  return {
    completed: [...state.completed],
    active: state.active ? { ...state.active } : null,
    unlockedCapabilities: [...state.unlockedCapabilities],
  };
}

/**
 * Restore prestige state from saved data.
 *
 * @param data - Saved prestige state
 * @returns Restored PrestigeProjectState
 */
export function restorePrestigeState(data: PrestigeProjectState): PrestigeProjectState {
  return {
    completed: [...(data.completed ?? [])],
    active: data.active ? { projectId: data.active.projectId, ticksRemaining: data.active.ticksRemaining } : null,
    unlockedCapabilities: [...(data.unlockedCapabilities ?? [])],
  };
}
