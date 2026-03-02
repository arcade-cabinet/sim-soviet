/**
 * @fileoverview Constants for the worker system: thresholds, rates, and class data.
 */

import type { CitizenComponent } from '@/ecs/world';

/** Weighted class distribution for random spawning.
 *  Order: worker, engineer, farmer, party_official, soldier, prisoner */
export const CLASS_WEIGHTS: readonly number[] = [40, 15, 25, 5, 10, 5];
export const CLASS_ORDER: readonly CitizenComponent['class'][] = [
  'worker',
  'engineer',
  'farmer',
  'party_official',
  'soldier',
  'prisoner',
];

/** Production bonuses by class for their specialty buildings. */
export const CLASS_PRODUCTION_BONUS: Record<CitizenComponent['class'], number> = {
  worker: 0,
  engineer: 0.2,
  farmer: 0.3,
  party_official: -0.5,
  soldier: 0,
  prisoner: 0.1,
};

/** Building defId prefixes that count as "factory" for engineer bonus. */
export const FACTORY_PREFIXES = ['vodka-distillery', 'factory', 'industrial'];

/** Building defId prefixes that count as "farm" for farmer bonus. */
export const FARM_PREFIXES = ['collective-farm', 'kolkhoz', 'farm'];

/** Base food consumed per worker per tick. */
export const FOOD_PER_WORKER = 0.1;

/** Base vodka consumed per worker per tick (scaled by dependency). */
export const VODKA_PER_WORKER = 0.05;

/** Morale penalty when food is unavailable. */
export const HUNGER_MORALE_PENALTY = 5;

/** Morale penalty per tick when vodka is needed but unavailable. */
export const VODKA_WITHDRAWAL_PENALTY = 3;

/** Morale boost from receiving vodka. */
export const VODKA_MORALE_BOOST = 2;

/** Morale boost from being housed. */
export const HOUSING_MORALE_BOOST = 1;

/** Morale penalty for being unhoused. */
export const UNHOUSED_MORALE_PENALTY = 2;

/** Morale penalty when heating fails in winter (-30% of max morale = -30 flat). */
export const HEATING_FAILURE_MORALE_PENALTY = 30;

/** Party official morale boost to others (per official, per tick). */
export const PARTY_MORALE_BOOST = 0.5;

/** Loyalty threshold below which defection check occurs. */
export const DEFECTION_LOYALTY_THRESHOLD = 20;

/** Base defection probability per tick when below loyalty threshold. */
export const DEFECTION_BASE_CHANCE = 0.02;

/** Prisoner escape chance per tick. */
export const PRISONER_ESCAPE_CHANCE = 0.005;

/** Stakhanovite event chance per tick for high-morale workers. */
export const STAKHANOVITE_CHANCE = 0.003;

/** Morale threshold above which Stakhanovite events can trigger. */
export const STAKHANOVITE_MORALE_THRESHOLD = 75;

/** Skill growth per tick when assigned to work. */
export const SKILL_GROWTH_RATE = 0.01;

/** Maximum vodka dependency escalation per tick. */
export const VODKA_DEPENDENCY_GROWTH = 0.1;

// ─────────────────────────────────────────────────────────
//  POPULATION DRAIN CONSTANTS
// ─────────────────────────────────────────────────────────

/** Morale threshold below which workers begin fleeing. */
export const FLIGHT_MORALE_THRESHOLD = 30;

/** Critical morale threshold — accelerated flight. */
export const FLIGHT_MORALE_CRITICAL = 15;

/** How often (in ticks) the migration check runs. */
export const FLIGHT_CHECK_INTERVAL = 60;

/** Workers fleeing per check when morale < FLIGHT_MORALE_THRESHOLD. */
export const FLIGHT_COUNT_NORMAL: [min: number, max: number] = [1, 2];

/** Workers fleeing per check when morale < FLIGHT_MORALE_CRITICAL. */
export const FLIGHT_COUNT_CRITICAL: [min: number, max: number] = [3, 5];

/** Youth flight check interval (ticks). */
export const YOUTH_FLIGHT_INTERVAL = 120;

/** Youth max age for flight eligibility. */
export const YOUTH_MAX_AGE = 25;

/** Youth min age for flight eligibility. */
export const YOUTH_MIN_AGE = 16;

/** Morale threshold below which youth consider leaving. */
export const YOUTH_FLIGHT_MORALE_THRESHOLD = 40;

/** Building defIds that prevent youth flight (cultural/educational). */
export const YOUTH_RETENTION_BUILDINGS = ['school', 'club', 'cinema', 'library', 'university'];

/** Workplace accident probability per factory per tick. */
export const ACCIDENT_RATE_PER_FACTORY = 1 / 500;

/** Accident rate multiplier for low-skill workers (skill < 20). */
export const ACCIDENT_LOW_SKILL_MULT = 2.0;

// ─────────────────────────────────────────────────────────
//  POPULATION INFLOW CONSTANTS
// ─────────────────────────────────────────────────────────

/** Moscow assignment: min-max workers per decree. */
export const MOSCOW_ASSIGNMENT_COUNT: [min: number, max: number] = [3, 12];

/** Forced resettlement: min-max hostile workers. */
export const FORCED_RESETTLEMENT_COUNT: [min: number, max: number] = [5, 30];

/** Forced resettlement: initial morale range for hostile workers. */
export const FORCED_RESETTLEMENT_MORALE: [min: number, max: number] = [10, 30];

/** Kolkhoz amalgamation: min-max workers from merged collective. */
export const KOLKHOZ_AMALGAMATION_COUNT: [min: number, max: number] = [20, 60];

// ─────────────────────────────────────────────────────────
//  TRUDODNI CONSTANTS
// ─────────────────────────────────────────────────────────

/** Base annual trudodni requirement per worker. */
export const TRUDODNI_ANNUAL_MINIMUM = 200;

/** Morale penalty for failing to meet trudodni minimum. */
export const TRUDODNI_SHORTFALL_MORALE_PENALTY = 10;

/** Trudodni earned per tick when assigned to production. */
export const TRUDODNI_PER_TICK = 0.5;

// ─────────────────────────────────────────────────────────
//  PRIVATE PLOT CONSTANTS
// ─────────────────────────────────────────────────────────

/** Food produced per hectare of private plot per year. */
export const PRIVATE_PLOT_FOOD_PER_HECTARE = 10;

/** Morale boost per tick when private plot is active. */
export const PRIVATE_PLOT_MORALE_BOOST = 5;

// ─────────────────────────────────────────────────────────
//  NAME GENERATION DATA
// ─────────────────────────────────────────────────────────

export const FIRST_NAMES_MALE = [
  'Ivan',
  'Pyotr',
  'Sergei',
  'Alexei',
  'Dmitri',
  'Nikolai',
  'Vasily',
  'Grigory',
  'Mikhail',
  'Andrei',
  'Boris',
  'Viktor',
  'Yuri',
  'Pavel',
  'Oleg',
] as const;

export const FIRST_NAMES_FEMALE = [
  'Natalya',
  'Olga',
  'Svetlana',
  'Tatyana',
  'Ekaterina',
  'Anna',
  'Maria',
  'Irina',
  'Valentina',
  'Lyudmila',
  'Galina',
  'Tamara',
  'Nina',
  'Vera',
  'Zoya',
] as const;

export const PATRONYMICS_MALE = [
  'Ivanovich',
  'Petrovich',
  'Sergeyevich',
  'Nikolayevich',
  'Dmitrievich',
  'Alekseyevich',
  'Vasilyevich',
  'Mikhailovich',
  'Pavlovich',
  'Borisovich',
] as const;

export const PATRONYMICS_FEMALE = [
  'Ivanovna',
  'Petrovna',
  'Sergeyevna',
  'Nikolayevna',
  'Dmitrievna',
  'Alekseyevna',
  'Vasilyevna',
  'Mikhailovna',
  'Pavlovna',
  'Borisovna',
] as const;
