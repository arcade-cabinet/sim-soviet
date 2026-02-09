/**
 * @fileoverview Citizen class definitions for SimSoviet 2000.
 *
 * Each citizen class has unique behavior modifiers that affect movement speed,
 * resource consumption, production efficiency, happiness baselines, and
 * state machine transition probabilities. These profiles drive the
 * goal-driven AI and finite state machines in {@link CitizenAgent}.
 */

// ─────────────────────────────────────────────────────────
//  CITIZEN CLASS ENUM
// ─────────────────────────────────────────────────────────

/** All possible citizen classes in the Soviet hierarchy. */
export enum CitizenClass {
  WORKER = 'worker',
  PARTY_OFFICIAL = 'party_official',
  ENGINEER = 'engineer',
  FARMER = 'farmer',
  SOLDIER = 'soldier',
  PRISONER = 'prisoner',
}

// ─────────────────────────────────────────────────────────
//  BEHAVIOR PROFILE
// ─────────────────────────────────────────────────────────

/**
 * A behavior profile governs how a citizen class interacts with the simulation.
 * Each numeric modifier is a multiplier (1.0 = baseline) unless otherwise noted.
 */
export interface CitizenBehaviorProfile {
  /** Display name for UI. */
  readonly label: string;

  /** The class this profile belongs to. */
  readonly citizenClass: CitizenClass;

  // ── Movement ─────────────────────────────────────────

  /** Multiplier on base movement speed (1.0 = normal). */
  readonly speedMultiplier: number;

  /** How quickly the citizen turns (radians/sec multiplier). */
  readonly turnRateMultiplier: number;

  // ── Needs ────────────────────────────────────────────

  /** Baseline happiness (0..1). Citizens drift toward this value. */
  readonly happinessBaseline: number;

  /** Food consumption multiplier per tick. */
  readonly foodConsumption: number;

  /** Vodka consumption multiplier per tick. Higher = drinks more. */
  readonly vodkaConsumption: number;

  /** How fast hunger grows (higher = hungrier faster). */
  readonly hungerRate: number;

  /** How fast thirst for vodka grows. */
  readonly thirstRate: number;

  // ── Work ─────────────────────────────────────────────

  /** Production efficiency at workplace (1.0 = 100%). */
  readonly productionEfficiency: number;

  /** Building types this class can work at. Empty = no restriction. */
  readonly allowedWorkplaces: readonly string[];

  /** Whether this class actually contributes to production. */
  readonly actuallyWorks: boolean;

  // ── Political ────────────────────────────────────────

  /** Base loyalty to the party (0..1). Affects protest chance. */
  readonly loyaltyBaseline: number;

  /** Fear baseline (0..1). Affects flee/panic thresholds. */
  readonly fearBaseline: number;

  /** Radius (grid cells) within which this citizen affects neighbors. */
  readonly influenceRadius: number;

  /** Loyalty modifier applied to neighbors within influence radius. */
  readonly loyaltyInfluence: number;

  /** Protest probability multiplier. Higher = more likely to protest. */
  readonly protestMultiplier: number;

  // ── Special ──────────────────────────────────────────

  /** Whether this citizen can repair decaying buildings. */
  readonly canRepair: boolean;

  /** Whether this citizen suppresses dissent in nearby workers. */
  readonly suppressesDissent: boolean;

  /** If true, avoidance behaviors steer other citizens away. */
  readonly isIntimidating: boolean;

  /** Chance per tick of attempting to escape (prisoners only). */
  readonly escapeChance: number;

  /** Whether this class follows seasonal work patterns. */
  readonly seasonalWork: boolean;
}

// ─────────────────────────────────────────────────────────
//  CLASS DEFINITIONS
// ─────────────────────────────────────────────────────────

/**
 * Worker -- The backbone of the Soviet economy.
 *
 * Goes to assigned factory or farm. Low happiness baseline, drinks more vodka.
 * Can be reassigned. Protests when conditions deteriorate.
 */
const WORKER_PROFILE: CitizenBehaviorProfile = {
  label: 'Worker',
  citizenClass: CitizenClass.WORKER,

  speedMultiplier: 1.0,
  turnRateMultiplier: 1.0,

  happinessBaseline: 0.35,
  foodConsumption: 1.0,
  vodkaConsumption: 1.5,
  hungerRate: 1.0,
  thirstRate: 1.3,

  productionEfficiency: 1.0,
  allowedWorkplaces: ['farm', 'distillery', 'power'],
  actuallyWorks: true,

  loyaltyBaseline: 0.5,
  fearBaseline: 0.3,
  influenceRadius: 0,
  loyaltyInfluence: 0,
  protestMultiplier: 1.5,

  canRepair: false,
  suppressesDissent: false,
  isIntimidating: false,
  escapeChance: 0,
  seasonalWork: false,
};

/**
 * Party Official -- Does not actually work. "Supervises."
 *
 * High happiness, takes extra food rations. Boosts loyalty of nearby workers
 * through "inspiring" presence (and implied threats).
 */
const PARTY_OFFICIAL_PROFILE: CitizenBehaviorProfile = {
  label: 'Party Official',
  citizenClass: CitizenClass.PARTY_OFFICIAL,

  speedMultiplier: 0.7,
  turnRateMultiplier: 0.8,

  happinessBaseline: 0.85,
  foodConsumption: 1.8,
  vodkaConsumption: 1.2,
  hungerRate: 0.6,
  thirstRate: 0.8,

  productionEfficiency: 0,
  allowedWorkplaces: [],
  actuallyWorks: false,

  loyaltyBaseline: 0.95,
  fearBaseline: 0.1,
  influenceRadius: 5,
  loyaltyInfluence: 0.15,
  protestMultiplier: 0.1,

  canRepair: false,
  suppressesDissent: true,
  isIntimidating: true,
  escapeChance: 0,
  seasonalWork: false,
};

/**
 * Engineer -- Works at power plants, higher efficiency.
 *
 * Required for advanced buildings. Can repair decaying structures.
 * Valued but perpetually overworked.
 */
const ENGINEER_PROFILE: CitizenBehaviorProfile = {
  label: 'Engineer',
  citizenClass: CitizenClass.ENGINEER,

  speedMultiplier: 0.9,
  turnRateMultiplier: 1.0,

  happinessBaseline: 0.45,
  foodConsumption: 1.0,
  vodkaConsumption: 1.0,
  hungerRate: 1.0,
  thirstRate: 1.0,

  productionEfficiency: 1.5,
  allowedWorkplaces: ['power'],
  actuallyWorks: true,

  loyaltyBaseline: 0.6,
  fearBaseline: 0.2,
  influenceRadius: 0,
  loyaltyInfluence: 0,
  protestMultiplier: 0.8,

  canRepair: true,
  suppressesDissent: false,
  isIntimidating: false,
  escapeChance: 0,
  seasonalWork: false,
};

/**
 * Farmer -- Works at kolkhoz (farms).
 *
 * Food production bonus. Follows seasonal work patterns:
 * spring/summer = high production, winter = reduced output.
 */
const FARMER_PROFILE: CitizenBehaviorProfile = {
  label: 'Farmer',
  citizenClass: CitizenClass.FARMER,

  speedMultiplier: 1.0,
  turnRateMultiplier: 1.0,

  happinessBaseline: 0.4,
  foodConsumption: 1.2,
  vodkaConsumption: 1.4,
  hungerRate: 1.2,
  thirstRate: 1.2,

  productionEfficiency: 1.3,
  allowedWorkplaces: ['farm'],
  actuallyWorks: true,

  loyaltyBaseline: 0.45,
  fearBaseline: 0.25,
  influenceRadius: 0,
  loyaltyInfluence: 0,
  protestMultiplier: 1.2,

  canRepair: false,
  suppressesDissent: false,
  isIntimidating: false,
  escapeChance: 0,
  seasonalWork: true,
};

/**
 * Soldier -- Patrols near gulag and government buildings.
 *
 * Suppresses dissent (reduces protest chance in radius).
 * Consumes more food. Does not produce resources.
 */
const SOLDIER_PROFILE: CitizenBehaviorProfile = {
  label: 'Soldier',
  citizenClass: CitizenClass.SOLDIER,

  speedMultiplier: 1.3,
  turnRateMultiplier: 1.5,

  happinessBaseline: 0.5,
  foodConsumption: 1.6,
  vodkaConsumption: 1.0,
  hungerRate: 1.3,
  thirstRate: 0.8,

  productionEfficiency: 0,
  allowedWorkplaces: ['gulag'],
  actuallyWorks: false,

  loyaltyBaseline: 0.85,
  fearBaseline: 0.15,
  influenceRadius: 4,
  loyaltyInfluence: -0.1,
  protestMultiplier: 0.05,

  canRepair: false,
  suppressesDissent: true,
  isIntimidating: true,
  escapeChance: 0,
  seasonalWork: false,
};

/**
 * Prisoner -- Assigned to gulag, works but slowly.
 *
 * Very low happiness, high escape chance. Produces at 50% efficiency.
 * Cannot leave assigned building area. Other citizens avoid them.
 */
const PRISONER_PROFILE: CitizenBehaviorProfile = {
  label: 'Prisoner',
  citizenClass: CitizenClass.PRISONER,

  speedMultiplier: 0.5,
  turnRateMultiplier: 0.6,

  happinessBaseline: 0.05,
  foodConsumption: 0.6,
  vodkaConsumption: 0.0,
  hungerRate: 1.5,
  thirstRate: 0.5,

  productionEfficiency: 0.5,
  allowedWorkplaces: ['gulag'],
  actuallyWorks: true,

  loyaltyBaseline: 0.05,
  fearBaseline: 0.9,
  influenceRadius: 0,
  loyaltyInfluence: 0,
  protestMultiplier: 0.0,

  canRepair: false,
  suppressesDissent: false,
  isIntimidating: false,
  escapeChance: 0.02,
  seasonalWork: false,
};

// ─────────────────────────────────────────────────────────
//  PROFILE REGISTRY
// ─────────────────────────────────────────────────────────

/** Lookup table mapping each citizen class to its behavior profile. */
export const CITIZEN_PROFILES: Readonly<Record<CitizenClass, CitizenBehaviorProfile>> = {
  [CitizenClass.WORKER]: WORKER_PROFILE,
  [CitizenClass.PARTY_OFFICIAL]: PARTY_OFFICIAL_PROFILE,
  [CitizenClass.ENGINEER]: ENGINEER_PROFILE,
  [CitizenClass.FARMER]: FARMER_PROFILE,
  [CitizenClass.SOLDIER]: SOLDIER_PROFILE,
  [CitizenClass.PRISONER]: PRISONER_PROFILE,
} as const;

// ─────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────

/**
 * Returns the behavior profile for a given citizen class.
 * @param citizenClass - The class to look up.
 * @returns The corresponding behavior profile.
 */
export function getProfile(citizenClass: CitizenClass): CitizenBehaviorProfile {
  return CITIZEN_PROFILES[citizenClass];
}

/**
 * Calculates the seasonal production modifier for a farmer.
 * Spring/summer months (4-9) yield full production;
 * autumn (10-11) yields 60%; winter (12-3) yields 20%.
 *
 * @param month - The current month (1-12).
 * @returns A production multiplier between 0.2 and 1.0.
 */
export function getSeasonalModifier(month: number): number {
  if (month >= 4 && month <= 9) return 1.0;
  if (month >= 10 && month <= 11) return 0.6;
  return 0.2; // Winter: months 12, 1, 2, 3
}

/**
 * Returns the initial class distribution for spawning citizens.
 * The distribution is weighted: most citizens are workers, with smaller
 * numbers of specialists.
 *
 * @returns An array of [CitizenClass, weight] tuples summing to 1.0.
 */
export function getClassDistribution(): ReadonlyArray<readonly [CitizenClass, number]> {
  return [
    [CitizenClass.WORKER, 0.50],
    [CitizenClass.FARMER, 0.20],
    [CitizenClass.ENGINEER, 0.10],
    [CitizenClass.SOLDIER, 0.10],
    [CitizenClass.PARTY_OFFICIAL, 0.05],
    [CitizenClass.PRISONER, 0.05],
  ] as const;
}

import type { GameRng } from '../game/SeedSystem';

/**
 * Selects a random citizen class based on the weighted distribution.
 * @returns A randomly selected citizen class.
 */
export function randomCitizenClass(rng?: GameRng): CitizenClass {
  const distribution = getClassDistribution();
  let roll = rng?.random() ?? Math.random();
  for (const [cls, weight] of distribution) {
    roll -= weight;
    if (roll <= 0) return cls;
  }
  return CitizenClass.WORKER;
}
