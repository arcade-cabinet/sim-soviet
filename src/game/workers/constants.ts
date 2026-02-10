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
