/**
 * @module game/PlanMandates
 *
 * 5-Year Plan Building Mandates — the state doesn't just set quotas,
 * it mandates which buildings to construct.
 *
 * Each era generates a set of mandated buildings based on historical
 * priorities (e.g., industrialization era → factories, wartime → barracks).
 * Difficulty scales the number required.
 *
 * The player fulfills mandates by placing the specified buildings.
 * Fulfillment is tracked per plan cycle and affects scoring/marks.
 */

import type { DifficultyLevel } from './ScoringSystem';

// ── Types ─────────────────────────────────────────────────────────────────────

/** A single building construction mandate from the 5-Year Plan. */
export interface BuildingMandate {
  /** Building definition ID */
  defId: string;
  /** Number of this building required */
  required: number;
  /** Display label */
  label: string;
}

/** A mandate with fulfillment tracking. */
export interface MandateWithFulfillment extends BuildingMandate {
  /** Number of this building placed so far */
  fulfilled: number;
}

/** State for the current plan's mandates. */
export interface PlanMandateState {
  mandates: MandateWithFulfillment[];
}

// ── Mandate Templates per Era ─────────────────────────────────────────────────

interface MandateTemplate {
  defId: string;
  label: string;
  baseRequired: number;
}

const ERA_MANDATE_TEMPLATES: Record<string, MandateTemplate[]> = {
  revolution: [
    { defId: 'workers-house-a', label: 'Workers Housing', baseRequired: 2 },
    { defId: 'collective-farm-hq', label: 'Collective Farm HQ', baseRequired: 1 },
    { defId: 'guard-post', label: 'Guard Post', baseRequired: 1 },
  ],
  collectivization: [
    { defId: 'workers-house-b', label: 'Workers Housing B', baseRequired: 2 },
    { defId: 'warehouse', label: 'Warehouse', baseRequired: 1 },
    { defId: 'school', label: 'School', baseRequired: 1 },
  ],
  industrialization: [
    { defId: 'power-station', label: 'Power Station', baseRequired: 1 },
    { defId: 'factory-office', label: 'Factory Office', baseRequired: 1 },
    { defId: 'vodka-distillery', label: 'Vodka Distillery', baseRequired: 1 },
  ],
  great_patriotic: [
    { defId: 'barracks', label: 'Military Barracks', baseRequired: 2 },
    { defId: 'hospital', label: 'Field Hospital', baseRequired: 1 },
    { defId: 'guard-post', label: 'Guard Post', baseRequired: 2 },
  ],
  reconstruction: [
    { defId: 'workers-house-a', label: 'Workers Housing', baseRequired: 3 },
    { defId: 'power-station', label: 'Power Station', baseRequired: 1 },
    { defId: 'bread-factory', label: 'Bread Factory', baseRequired: 1 },
  ],
  thaw_and_freeze: [
    { defId: 'apartment-tower-a', label: 'Apartment Tower', baseRequired: 2 },
    { defId: 'cultural-palace', label: 'Cultural Palace', baseRequired: 1 },
    { defId: 'polyclinic', label: 'Polyclinic', baseRequired: 1 },
  ],
  stagnation: [
    { defId: 'apartment-tower-b', label: 'Apartment Tower B', baseRequired: 3 },
    { defId: 'ministry-office', label: 'Ministry Office', baseRequired: 1 },
    { defId: 'workers-club', label: 'Workers Club', baseRequired: 1 },
  ],
  the_eternal: [
    { defId: 'apartment-tower-d', label: 'Apartment Tower D', baseRequired: 3 },
    { defId: 'government-hq', label: 'Government HQ', baseRequired: 1 },
    { defId: 'kgb-office', label: 'KGB Office', baseRequired: 1 },
    { defId: 'train-station', label: 'Train Station', baseRequired: 1 },
  ],
};

/** Difficulty scaling for mandate required counts. */
const DIFFICULTY_MULTIPLIERS: Record<DifficultyLevel, number> = {
  worker: 0.75,
  comrade: 1.0,
  tovarish: 1.5,
};

// ── Functions ─────────────────────────────────────────────────────────────────

/**
 * Generate building mandates for a given era and difficulty.
 * Returns an array of mandates with required counts scaled by difficulty.
 */
export function createMandatesForEra(eraId: string, difficulty: DifficultyLevel): BuildingMandate[] {
  const templates = ERA_MANDATE_TEMPLATES[eraId];
  if (!templates) {
    console.warn(`[PlanMandates] Unknown era ID "${eraId}", falling back to revolution`);
  }
  const resolved = templates ?? ERA_MANDATE_TEMPLATES.revolution!;
  const mult = DIFFICULTY_MULTIPLIERS[difficulty];

  return resolved.map((t) => ({
    defId: t.defId,
    label: t.label,
    required: Math.max(1, Math.round(t.baseRequired * mult)),
  }));
}

/**
 * Create a fresh mandate tracking state from a list of mandates.
 * All fulfillment counts start at 0.
 */
export function createPlanMandateState(mandates: BuildingMandate[]): PlanMandateState {
  return {
    mandates: mandates.map((m) => ({ ...m, fulfilled: 0 })),
  };
}

/**
 * Record that a building was placed. Increments fulfillment for matching mandates.
 * Returns a new state (immutable).
 */
export function recordBuildingPlaced(state: PlanMandateState, buildingDefId: string): PlanMandateState {
  return {
    mandates: state.mandates.map((m) => (m.defId === buildingDefId ? { ...m, fulfilled: m.fulfilled + 1 } : m)),
  };
}

/**
 * Get the overall mandate fulfillment ratio (0.0 - 1.0).
 * Calculated as total fulfilled / total required (capped at 1.0 per mandate).
 */
export function getMandateFulfillment(state: PlanMandateState): number {
  if (state.mandates.length === 0) return 1;

  const totalRequired = state.mandates.reduce((sum, m) => sum + m.required, 0);
  if (totalRequired === 0) return 1;

  const totalFulfilled = state.mandates.reduce((sum, m) => sum + Math.min(m.fulfilled, m.required), 0);
  return totalFulfilled / totalRequired;
}

/** Check if a single mandate is complete (fulfilled >= required). */
export function isMandateComplete(mandate: MandateWithFulfillment): boolean {
  return mandate.fulfilled >= mandate.required;
}

/** Check if all mandates in the state are complete. */
export function allMandatesComplete(state: PlanMandateState): boolean {
  return state.mandates.every(isMandateComplete);
}
