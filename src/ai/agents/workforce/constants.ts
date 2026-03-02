/**
 * @fileoverview Constants for the worker system: thresholds, rates, and class data.
 */

import type { CitizenComponent } from '@/ecs/world';
import { economy, workforce } from '@/config';

const cfg = workforce;

/** Weighted class distribution for random spawning.
 *  Order: worker, engineer, farmer, party_official, soldier, prisoner */
export const CLASS_WEIGHTS: readonly number[] = cfg.classWeights;
export const CLASS_ORDER: readonly CitizenComponent['class'][] = [
  'worker',
  'engineer',
  'farmer',
  'party_official',
  'soldier',
  'prisoner',
];

/** Production bonuses by class for their specialty buildings. */
export const CLASS_PRODUCTION_BONUS: Record<CitizenComponent['class'], number> =
  cfg.classProductionBonus as Record<CitizenComponent['class'], number>;

/** Building defId prefixes that count as "factory" for engineer bonus. */
export const FACTORY_PREFIXES = ['vodka-distillery', 'factory', 'industrial'];

/** Building defId prefixes that count as "farm" for farmer bonus. */
export const FARM_PREFIXES = ['collective-farm', 'kolkhoz', 'farm'];

/** Base food consumed per worker per tick. */
export const FOOD_PER_WORKER = cfg.consumption.foodPerWorker;

/** Base vodka consumed per worker per tick (scaled by dependency). */
export const VODKA_PER_WORKER = cfg.consumption.vodkaPerWorker;

/** Morale penalty when food is unavailable. */
export const HUNGER_MORALE_PENALTY = cfg.morale.hungerPenalty;

/** Morale penalty per tick when vodka is needed but unavailable. */
export const VODKA_WITHDRAWAL_PENALTY = cfg.morale.vodkaWithdrawalPenalty;

/** Morale boost from receiving vodka. */
export const VODKA_MORALE_BOOST = cfg.morale.vodkaBoost;

/** Morale boost from being housed. */
export const HOUSING_MORALE_BOOST = cfg.morale.housingBoost;

/** Morale penalty for being unhoused. */
export const UNHOUSED_MORALE_PENALTY = cfg.morale.unhousedPenalty;

/** Morale penalty when heating fails in winter (-30% of max morale = -30 flat). */
export const HEATING_FAILURE_MORALE_PENALTY = cfg.morale.heatingFailurePenalty;

/** Party official morale boost to others (per official, per tick). */
export const PARTY_MORALE_BOOST = cfg.morale.partyBoostPerTick;

/** Loyalty threshold below which defection check occurs. */
export const DEFECTION_LOYALTY_THRESHOLD = cfg.loyalty.defectionThreshold;

/** Base defection probability per tick when below loyalty threshold. */
export const DEFECTION_BASE_CHANCE = cfg.loyalty.defectionBaseChance;

/** Prisoner escape chance per tick. */
export const PRISONER_ESCAPE_CHANCE = cfg.loyalty.prisonerEscapeChance;

/** Stakhanovite event chance per tick for high-morale workers. */
export const STAKHANOVITE_CHANCE = cfg.skills.stakhanoviteChance;

/** Morale threshold above which Stakhanovite events can trigger. */
export const STAKHANOVITE_MORALE_THRESHOLD = cfg.skills.stakhanoviteMoraleThreshold;

/** Skill growth per tick when assigned to work. */
export const SKILL_GROWTH_RATE = cfg.skills.skillGrowthRate;

/** Maximum vodka dependency escalation per tick. */
export const VODKA_DEPENDENCY_GROWTH = cfg.skills.vodkaDependencyGrowth;

// ─────────────────────────────────────────────────────────
//  POPULATION DRAIN CONSTANTS
// ─────────────────────────────────────────────────────────

/** Morale threshold below which workers begin fleeing. */
export const FLIGHT_MORALE_THRESHOLD = cfg.flight.moraleThreshold;

/** Critical morale threshold — accelerated flight. */
export const FLIGHT_MORALE_CRITICAL = cfg.flight.moraleCritical;

/** How often (in ticks) the migration check runs. */
export const FLIGHT_CHECK_INTERVAL = cfg.flight.checkInterval;

/** Workers fleeing per check when morale < FLIGHT_MORALE_THRESHOLD. */
export const FLIGHT_COUNT_NORMAL: [min: number, max: number] = [cfg.flight.countNormalMin, cfg.flight.countNormalMax];

/** Workers fleeing per check when morale < FLIGHT_MORALE_CRITICAL. */
export const FLIGHT_COUNT_CRITICAL: [min: number, max: number] = [cfg.flight.countCriticalMin, cfg.flight.countCriticalMax];

/** Youth flight check interval (ticks). */
export const YOUTH_FLIGHT_INTERVAL = cfg.flight.youthInterval;

/** Youth max age for flight eligibility. */
export const YOUTH_MAX_AGE = cfg.flight.youthMaxAge;

/** Youth min age for flight eligibility. */
export const YOUTH_MIN_AGE = cfg.flight.youthMinAge;

/** Morale threshold below which youth consider leaving. */
export const YOUTH_FLIGHT_MORALE_THRESHOLD = cfg.flight.youthMoraleThreshold;

/** Building defIds that prevent youth flight (cultural/educational). */
export const YOUTH_RETENTION_BUILDINGS = ['school', 'club', 'cinema', 'library', 'university'];

/** Workplace accident probability per factory per tick. */
export const ACCIDENT_RATE_PER_FACTORY = cfg.accidents.ratePerFactory;

/** Accident rate multiplier for low-skill workers (skill < 20). */
export const ACCIDENT_LOW_SKILL_MULT = cfg.accidents.lowSkillMultiplier;

// ─────────────────────────────────────────────────────────
//  POPULATION INFLOW CONSTANTS
// ─────────────────────────────────────────────────────────

/** Moscow assignment: min-max workers per decree. */
export const MOSCOW_ASSIGNMENT_COUNT: [min: number, max: number] = [cfg.inflow.moscowAssignmentMin, cfg.inflow.moscowAssignmentMax];

/** Forced resettlement: min-max hostile workers. */
export const FORCED_RESETTLEMENT_COUNT: [min: number, max: number] = [cfg.inflow.forcedResettlementMin, cfg.inflow.forcedResettlementMax];

/** Forced resettlement: initial morale range for hostile workers. */
export const FORCED_RESETTLEMENT_MORALE: [min: number, max: number] = [cfg.inflow.forcedResettlementMoraleMin, cfg.inflow.forcedResettlementMoraleMax];

/** Kolkhoz amalgamation: min-max workers from merged collective. */
export const KOLKHOZ_AMALGAMATION_COUNT: [min: number, max: number] = [cfg.inflow.kolkhozAmalgamationMin, cfg.inflow.kolkhozAmalgamationMax];

// ─────────────────────────────────────────────────────────
//  TRUDODNI CONSTANTS
// ─────────────────────────────────────────────────────────

/** Base annual trudodni requirement per worker. */
export const TRUDODNI_ANNUAL_MINIMUM = economy.trudodni.annualMinimum;

/** Morale penalty for failing to meet trudodni minimum. */
export const TRUDODNI_SHORTFALL_MORALE_PENALTY = economy.trudodni.shortfallMoralePenalty;

/** Trudodni earned per tick when assigned to production. */
export const TRUDODNI_PER_TICK = economy.trudodni.perTick;

// ─────────────────────────────────────────────────────────
//  PRIVATE PLOT CONSTANTS
// ─────────────────────────────────────────────────────────

/** Food produced per hectare of private plot per year. */
export const PRIVATE_PLOT_FOOD_PER_HECTARE = cfg.privatePlots.foodPerHectare;

/** Morale boost per tick when private plot is active. */
export const PRIVATE_PLOT_MORALE_BOOST = cfg.privatePlots.moraleBoost;

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
