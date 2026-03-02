/**
 * @module config/types
 *
 * TypeScript interfaces for all JSON config shapes.
 * These mirror the structure of the corresponding JSON files and provide
 * compile-time type safety for config consumers.
 */

// ── Demographics Config ──────────────────────────────────────────────────────

/** Birth rate parameters for aggregate (statistical) population mode. */
export interface AggregateBirthRates {
  /** Base monthly conception rate per eligible woman. */
  baseMonthlyConceptionRate: number;
  /** Lowest fertile age bucket index (inclusive). */
  fertileBucketMin: number;
  /** Highest fertile age bucket index (inclusive). */
  fertileBucketMax: number;
}

/** Labor force age bucket range for aggregate mode. */
export interface AggregateLaborForce {
  /** Lowest labor-force age bucket index (inclusive). */
  bucketMin: number;
  /** Highest labor-force age bucket index (inclusive). */
  bucketMax: number;
}

/** Food modifier thresholds for birth rate scaling. */
export interface FoodModifierConfig {
  /** Below this food level, minimum multiplier applies. */
  lowThreshold: number;
  /** Above this food level, maximum multiplier applies. */
  highThreshold: number;
  /** Multiplier when food is below lowThreshold. */
  minMultiplier: number;
  /** Multiplier when food is above highThreshold. */
  maxMultiplier: number;
}

/** Starvation death rate amplification parameters. */
export interface StarvationConfig {
  /** Maximum death rate multiplier at zero food. */
  maxMultiplier: number;
  /** Food level below which starvation modifier kicks in. */
  threshold: number;
  /** Scaling factor for the starvation curve. */
  scale: number;
}

/** All aggregate (statistical) demographics parameters. */
export interface AggregateConfig {
  /** Number of 5-year age buckets (0-4, 5-9, ..., 95-99). */
  numBuckets: number;
  /** Fraction of each bucket that advances per year (1/5 for 5-year buckets). */
  agingFraction: number;
  /** Birth rate parameters. */
  birthRates: AggregateBirthRates;
  /** Labor force age bucket range. */
  laborForce: AggregateLaborForce;
  /** Era-specific birth rate multipliers (aggregate mode). */
  eraBirthMultiplier: Record<string, number>;
  /** Era-specific death rate multipliers (aggregate mode). */
  eraDeathMultiplier: Record<string, number>;
  /** Annual mortality rates indexed by 5-year age bucket. */
  annualMortalityByBucket: number[];
  /** Food modifier thresholds for birth rate. */
  foodModifier: FoodModifierConfig;
  /** Starvation death amplification. */
  starvation: StarvationConfig;
}

// ── Entity mode config ───────────────────────────────────────────────────────

/** Birth rate parameters for entity (individual citizen) mode. */
export interface EntityBirthRates {
  /** Base annual birth probability per eligible woman. */
  baseAnnualRate: number;
  /** Minimum age for fertility. */
  fertilityMinAge: number;
  /** Maximum age for fertility. */
  fertilityMaxAge: number;
  /** Pregnancy duration in simulation ticks. */
  pregnancyDurationTicks: number;
}

/** Age-bracket mortality rate entry. */
export interface MortalityBracket {
  /** Maximum age for this bracket (exclusive). Use 999 for unbounded. */
  maxAge: number;
  /** Annual mortality rate for this bracket. */
  rate: number;
}

/** All entity-mode demographics parameters. */
export interface EntityConfig {
  /** Birth rate parameters. */
  birthRates: EntityBirthRates;
  /** Era-specific birth rate multipliers (entity mode). */
  eraBirthRateMultiplier: Record<string, number>;
  /** Age-bracket annual mortality rates. */
  annualMortality: MortalityBracket[];
  /** Additional monthly death rate from starvation (food = 0). */
  starvationMonthlyRate: number;
  /** Maximum age of children that impose the working mother penalty. */
  youngChildMaxAge: number;
  /** Female retirement/elder threshold age. */
  femaleElderAge: number;
  /** Male retirement/elder threshold age. */
  maleElderAge: number;
  /** Working mother labor penalty multiplier (e.g. 0.7 = 30% reduction). */
  workingMotherPenalty: number;
}

// ── Household formation ──────────────────────────────────────────────────────

/** Household formation parameters. */
export interface HouseholdFormationConfig {
  /** Minimum age for household formation eligibility. */
  minAge: number;
  /** Maximum age for household formation eligibility. */
  maxAge: number;
  /** Annual probability that an eligible pair forms a new household. */
  probability: number;
}

// ── Population trends ────────────────────────────────────────────────────────

/** Population trend detection thresholds. */
export interface TrendsConfig {
  /** Growth ratio below this triggers labor shortage warning. */
  laborShortageThreshold: number;
  /** Growth ratio above this triggers labor surplus notice. */
  laborSurplusThreshold: number;
  /** Every N citizens reached emits a population milestone. */
  populationMilestoneStep: number;
}

// ── Top-level config ─────────────────────────────────────────────────────────

/** Complete demographics configuration. */
export interface DemographicsConfig {
  /** Aggregate (statistical) mode parameters. */
  aggregate: AggregateConfig;
  /** Entity (individual citizen) mode parameters. */
  entity: EntityConfig;
  /** Household formation parameters. */
  householdFormation: HouseholdFormationConfig;
  /** Population trend thresholds. */
  trends: TrendsConfig;
}
