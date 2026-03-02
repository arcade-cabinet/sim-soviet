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

// ── Economy Config ─────────────────────────────────────────────────────────

/** Blat (connections) system parameters. */
export interface BlatConfig {
  safeThreshold: number;
  arrestThreshold: number;
  kgbInvestigationChancePerPoint: number;
  spendKgbThreshold: number;
  spendKgbDetectionChancePerPoint: number;
  fondyReliabilityBoostPerSpend: number;
  quotaReductionPerPoint: number;
  kgbProtectionPerPoint: number;
  consumerGoodsPerPoint: number;
  tradingMoneyPerPoint: number;
  maxConnections: number;
  startingConnections: number;
  arrestChancePerTick: number;
}

/** Trudodni (labor-day) system parameters. */
export interface TrudodniConfig {
  defaultRate: number;
  perBuilding: Record<string, number>;
  minimumByDifficulty: Record<string, number>;
  values: Record<string, number>;
  daysPerMonth: number;
  annualMinimum: number;
  shortfallMoralePenalty: number;
  perTick: number;
}

/** Quota escalation parameters. */
export interface QuotaConfig {
  metEscalation: number;
  missedReduction: number;
  eraEscalation: Record<string, number>;
  difficultyMult: Record<string, number>;
}

/** Starting resource base values and multipliers. */
export interface StartingResourcesConfig {
  base: Record<string, number>;
  difficultyMult: Record<string, number>;
  eraMult: Record<string, number>;
}

/** Difficulty multiplier preset. */
export interface DifficultyPreset {
  quotaTarget: number;
  startingResources: number;
  birthRate: number;
  decayRate: number;
  politruksPer100: number;
  fondyReliability: number;
  deliveryRate: number;
  eventSeverity: number;
  markDecayRate: number;
  starvationRate: number;
}

/** Stakhanovite event parameters. */
export interface StakhanoviteConfig {
  chance: number;
  productionBoostMin: number;
  productionBoostRange: number;
  propagandaMin: number;
  propagandaRange: number;
  quotaIncreaseBase: number;
  quotaIncreaseRange: number;
}

/** MTS (Machine-Tractor Station) parameters. */
export interface MTSConfig {
  startYear: number;
  endYear: number;
  tractorUnits: number;
  rentalCostPerUnit: number;
  grainBoostMultiplier: number;
}

/** Heating tier config (flat — no nested resource objects). */
export interface HeatingTierConfig {
  consumptionAmount: number;
  consumptionResource: string;
  baseEfficiency: number;
  capacityPer100Pop: number;
  repairThreshold: number;
}

/** Heating system parameters. */
export interface HeatingConfigRoot {
  districtPopulation: number;
  districtToCrumblingTicks: number;
  pechka: HeatingTierConfig;
  district: HeatingTierConfig;
  crumbling: HeatingTierConfig;
}

/** Fondy era config (flat — reliability, interval, and resource amounts). */
export interface FondyEraConfig {
  reliability: number;
  interval: number;
  food: number;
  vodka: number;
  money: number;
  steel: number;
  timber: number;
}

/** Ration period definition. */
export interface RationPeriod {
  start: number;
  end: number;
}

/** Ration tier allocation. */
export interface RationTierConfig {
  share: number;
  food: number;
  vodka: number;
}

/** Ration system parameters. */
export interface RationsConfig {
  periods: RationPeriod[];
  defaultTiers: Record<string, RationTierConfig>;
}

/** Currency reform definition (JSON-safe, no `applied` flag). */
export interface CurrencyReformConfig {
  year: number;
  name: string;
  rate: number;
  confiscation?: { threshold: number; rate: number };
}

/** Seasonal spoilage multiplier thresholds. */
export interface SeasonalSpoilageConfig {
  summerMonthStart: number;
  summerMonthEnd: number;
  summerMultiplier: number;
  winterMonthStart: number;
  winterMonthEnd: number;
  winterMultiplier: number;
}

/** Storage and spoilage system parameters. */
export interface StorageConfig {
  baseCapacity: number;
  overflowSpoilageRate: number;
  storedSpoilageRate: number;
  coldStorageSpoilageRate: number;
  elevatorSpoilageRate: number;
  singleColdStorageRate: number;
  seasonalSpoilage: SeasonalSpoilageConfig;
  byRole: Record<string, number>;
  byDef: Record<string, number>;
}

/** Consumption system parameters. */
export interface ConsumptionConfig {
  starvationGraceTicks: number;
  maxStarvationDeathsPerTick: number;
  foodPerPopDivisor: number;
  vodkaPerPopDivisor: number;
}

/** Production system parameters. */
export interface ProductionConfig {
  overstaffingMinContribution: number;
  overstaffingDecayRate: number;
  grainToVodkaRatio: number;
  vodkaMoraleBonus: number;
  foodCrisisThreshold: number;
}

/** Private plot parameters. */
export interface PrivatePlotsConfig {
  baseFoodPerHectarePerYear: number;
  monthsPerYear: number;
  livestockFood: Record<string, number>;
  eraMultiplier: Record<string, number>;
}

/** Remainder allocation parameters. */
export interface RemainderConfig {
  distributedFraction: number;
}

/** Delivery quantity randomization range. */
export interface DeliveryQuantityConfig {
  min: number;
  range: number;
}

/** Consumer goods starting state. */
export interface ConsumerGoodsConfig {
  startingAvailable: number;
  startingDemand: number;
  startingSatisfaction: number;
}

/** Complete economy configuration. */
export interface EconomyConfig {
  blat: BlatConfig;
  trudodni: TrudodniConfig;
  quota: QuotaConfig;
  startingResources: StartingResourcesConfig;
  difficulty: Record<string, DifficultyPreset>;
  stakhanovite: StakhanoviteConfig;
  mts: MTSConfig;
  heating: HeatingConfigRoot;
  fondy: Record<string, FondyEraConfig>;
  rations: RationsConfig;
  currencyReforms: CurrencyReformConfig[];
  storage: StorageConfig;
  consumption: ConsumptionConfig;
  production: ProductionConfig;
  privatePlots: PrivatePlotsConfig;
  remainder: RemainderConfig;
  deliveryQuantity: DeliveryQuantityConfig;
  consumerGoods: ConsumerGoodsConfig;
}

// ── Workforce Config ───────────────────────────────────────────────────────

/** Worker consumption rates. */
export interface WorkforceConsumptionConfig {
  foodPerWorker: number;
  vodkaPerWorker: number;
}

/** Worker morale modifiers. */
export interface WorkforceMoraleConfig {
  hungerPenalty: number;
  vodkaWithdrawalPenalty: number;
  vodkaBoost: number;
  housingBoost: number;
  unhousedPenalty: number;
  heatingFailurePenalty: number;
  partyBoostPerTick: number;
}

/** Loyalty and defection parameters. */
export interface WorkforceLoyaltyConfig {
  defectionThreshold: number;
  defectionBaseChance: number;
  prisonerEscapeChance: number;
}

/** Skill and stakhanovite parameters. */
export interface WorkforceSkillsConfig {
  stakhanoviteChance: number;
  stakhanoviteMoraleThreshold: number;
  skillGrowthRate: number;
  vodkaDependencyGrowth: number;
}

/** Population flight parameters. */
export interface WorkforceFlightConfig {
  moraleThreshold: number;
  moraleCritical: number;
  checkInterval: number;
  countNormalMin: number;
  countNormalMax: number;
  countCriticalMin: number;
  countCriticalMax: number;
  youthInterval: number;
  youthMaxAge: number;
  youthMinAge: number;
  youthMoraleThreshold: number;
}

/** Workplace accident parameters. */
export interface WorkforceAccidentsConfig {
  ratePerFactory: number;
  lowSkillMultiplier: number;
}

/** Population inflow parameters. */
export interface WorkforceInflowConfig {
  moscowAssignmentMin: number;
  moscowAssignmentMax: number;
  forcedResettlementMin: number;
  forcedResettlementMax: number;
  forcedResettlementMoraleMin: number;
  forcedResettlementMoraleMax: number;
  kolkhozAmalgamationMin: number;
  kolkhozAmalgamationMax: number;
}

/** Private plot parameters (workforce). */
export interface WorkforcePrivatePlotsConfig {
  foodPerHectare: number;
  moraleBoost: number;
}

/** Aggregate transition parameters. */
export interface WorkforceTransitionConfig {
  aggregateThreshold: number;
  defaultMorale: number;
  defaultSkill: number;
  defaultLoyalty: number;
  defaultVodkaDep: number;
  ageBucketCount: number;
  maxPregnancyTicks: number;
}

/** Gender labor config for a single era. */
export interface GenderLaborEraConfig {
  femaleHeavyIndustry: number;
  femaleAgriculture: number;
  femaleServices: number;
  femalesMilitary: boolean;
}

/** Complete workforce configuration. */
export interface WorkforceConfig {
  classWeights: number[];
  classProductionBonus: Record<string, number>;
  consumption: WorkforceConsumptionConfig;
  morale: WorkforceMoraleConfig;
  loyalty: WorkforceLoyaltyConfig;
  skills: WorkforceSkillsConfig;
  flight: WorkforceFlightConfig;
  accidents: WorkforceAccidentsConfig;
  inflow: WorkforceInflowConfig;
  privatePlots: WorkforcePrivatePlotsConfig;
  transition: WorkforceTransitionConfig;
  genderLabor: Record<string, GenderLaborEraConfig>;
}

// ── Chronology Config ──────────────────────────────────────────────────────

/** Time model constants. */
export interface ChronologyConfig {
  hoursPerTick: number;
  ticksPerDay: number;
  daysPerMonth: number;
  monthsPerYear: number;
  startYear: number;
  startMonth: number;
}
