/**
 * @module ai/agents/core/worldCountries
 *
 * Country and sphere data for 1917 starting state.
 * Countries are tracked individually until they merge into spheres
 * at temporal scale (freeform eternal mode).
 *
 * Governance types and transition rules are research-grounded:
 * each transition has historical precedent documented inline.
 *
 * Data is loaded from config/world.json; types remain here.
 */

import worldData from '../../../config/world.json';

// ─── Governance Types ────────────────────────────────────────────────────────

/**
 * Eight governance types, each with historical precedent.
 * Transitions between types are driven by sphere dynamics.
 */
export type GovernanceType =
  | 'democratic'
  | 'authoritarian'
  | 'oligarchic'
  | 'theocratic'
  | 'corporate'
  | 'technocratic'
  | 'communist'
  | 'feudal';

// ─── Sphere IDs ──────────────────────────────────────────────────────────────

export type SphereId = 'european' | 'sinosphere' | 'western' | 'middle_eastern' | 'eurasian' | 'corporate';

// ─── Country ─────────────────────────────────────────────────────────────────

/** Individual country (used in historical mode and early freeform). */
export interface Country {
  id: string;
  name: string;
  sphere: SphereId;
  /** Hostility toward Russia (0-1). */
  hostility: number;
  /** Trade relationship volume (0-1). */
  tradeVolume: number;
  /** Relative military strength (0-1). */
  militaryStrength: number;
  /** Year this country merges into its sphere (freeform only). */
  mergeYear?: number;
}

// ─── Governance Transitions ──────────────────────────────────────────────────

/** A governance transition rule with conditions and historical precedent. */
export interface GovernanceTransition {
  from: GovernanceType;
  to: GovernanceType;
  /** Base probability per year (modified by conditions). */
  baseProbability: number;
  /** Conditions that increase transition probability. */
  conditions: {
    /** Turchin phase range that favors this transition (crisis = 0.6-1.0). */
    turchinRange?: { min: number; max: number };
    /** Khaldun phase range (decay = 0.6-1.0). */
    khaldunRange?: { min: number; max: number };
    /** Minimum corporate share for corporate transitions. */
    minCorporateShare?: number;
    /** Minimum religious intensity for theocratic transitions. */
    minReligiousIntensity?: number;
  };
  /** Brief historical precedent note. */
  precedent: string;
}

// ─── Era Profiles ────────────────────────────────────────────────────────────

/** World state defaults per era (interpolated within era). */
export interface EraWorldProfile {
  globalTension: [number, number]; // [start, end] of era
  borderThreat: [number, number];
  tradeAccess: number;
  moscowAttention: number;
  ideologyRigidity: number;
}

// ─── Data Exports (from JSON) ────────────────────────────────────────────────

export const SPHERE_IDS = worldData.sphereIds as readonly SphereId[];
export const STARTING_COUNTRIES = worldData.startingCountries as readonly Country[];
export const GOVERNANCE_TRANSITIONS = worldData.governanceTransitions as readonly GovernanceTransition[];
export const ERA_WORLD_PROFILES = worldData.eraWorldProfiles as unknown as Record<string, EraWorldProfile>;
