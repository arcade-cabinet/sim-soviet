/**
 * @module game/economy
 *
 * PLANNED ECONOMY SYSTEM
 * =======================
 * SimSoviet 2000 — The Five Primary Currencies
 *
 * Rubles are SECONDARY. The five primary currencies are:
 * 1. Trudodni (labor units)
 * 2. Fondy (material allocations)
 * 3. Compulsory Deliveries (handled by CompulsoryDeliveries.ts)
 * 4. The Remainder (post-delivery allocation)
 * 5. Blat (connections)
 *
 * This module also handles:
 * - Production chains (multi-step resource conversion)
 * - Ration card activation by historical period
 * - Stakhanovite events
 * - MTS (Machine-Tractor Stations) — era-specific equipment rental
 * - Heating progression (pechka → district → crumbling)
 * - Currency reforms (historical ruble redenominations)
 * - Difficulty multipliers
 * - Quota escalation math
 * - Starting resource calculation
 */

import type { GameRng } from './SeedSystem';

// ─────────────────────────────────────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type EraId =
  | 'revolution'
  | 'industrialization'
  | 'wartime'
  | 'reconstruction'
  | 'thaw'
  | 'stagnation'
  | 'perestroika'
  | 'eternal';

export type DifficultyLevel = 'worker' | 'comrade' | 'tovarish';

/** Resources that can be transferred between entities / allocated via fondy. */
export type TransferableResource = 'food' | 'vodka' | 'money' | 'steel' | 'timber';

export interface FondyConfig {
  reliability: number;
  interval: number;
  allocated: Record<TransferableResource, number>;
}

export interface FondyState extends FondyConfig {
  nextDeliveryTick: number;
  deliveryInterval: number;
}

export interface FondyDeliveryResult {
  delivered: boolean;
  allocated: Record<TransferableResource, number>;
  actualDelivered: Record<TransferableResource, number>;
  reason: string;
}

export interface TrudodniState {
  totalContributed: number;
  perBuilding: Map<string, number>;
  minimumRequired: number;
}

export interface BlatState {
  connections: number;
  totalSpent: number;
  totalEarned: number;
}

/** FIX-09: All valid blat spending purposes. */
export type BlatPurpose =
  | 'improve_delivery'
  | 'reduce_quota'
  | 'kgb_protection'
  | 'consumer_goods'
  | 'trading';

/** FIX-09: Effect returned from blat spending (for SimulationEngine to apply). */
export interface BlatEffect {
  type: BlatPurpose;
  /** Numeric effect value — meaning depends on type. */
  value: number;
}

export interface RationTier {
  share: number;
  food: number;
  vodka: number;
}

export interface RationConfig {
  worker: RationTier;
  employee: RationTier;
  dependent: RationTier;
  children: RationTier;
}

export interface RationState {
  active: boolean;
  rations: RationConfig;
}

export interface RationDemand {
  food: number;
  vodka: number;
}

export interface StakhanoviteEvent {
  workerName: string;
  building: string;
  productionBoost: number;
  propagandaValue: number;
  quotaIncrease: number;
  announcement: string;
}

export interface ProductionStep {
  building: string;
  input: Record<string, number>;
  output: Record<string, number>;
  ticksRequired: number;
}

export interface ProductionChain {
  id: string;
  steps: ProductionStep[];
}

export interface RemainderAllocation {
  distributed: Record<TransferableResource, number>;
  reserved: Record<TransferableResource, number>;
}

export interface MTSResult {
  applied: boolean;
  cost: number;
  grainMultiplier: number;
}

export interface MTSState {
  active: boolean;
  totalRentalSpent: number;
  tractorUnits: number;
}

export type HeatingTier = 'pechka' | 'district' | 'crumbling';

export interface HeatingConfig {
  consumption: { amount: number; resource: string };
  baseEfficiency: number;
  capacityPer100Pop: number;
  repairThreshold: number;
}

export interface HeatingState {
  tier: HeatingTier;
  ticksSinceRepair: number;
  efficiency: number;
  failing: boolean;
}

export interface HeatingResult {
  operational: boolean;
  populationAtRisk: number;
  tier: HeatingTier;
  /** Fuel consumed this tick (only during winter months). */
  fuelConsumed: { resource: string; amount: number } | null;
}

export interface CurrencyReform {
  year: number;
  name: string;
  rate: number;
  applied: boolean;
  /** If set, confiscation-style reform (Pavlov 1991). */
  confiscation?: { threshold: number; rate: number };
}

export interface CurrencyReformResult {
  reform: CurrencyReform;
  moneyBefore: number;
  moneyAfter: number;
  amountLost: number;
}

export interface DifficultyMultipliers {
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

/**
 * Result of the passive per-tick blat KGB risk check.
 *
 * High blat connections attract KGB attention. Above BLAT_SAFE_THRESHOLD,
 * each excess point carries a 1% investigation chance per tick. At very
 * high levels (>30), there is also a 1% arrest risk per tick.
 */
export interface BlatKgbResult {
  /** Whether a KGB investigation was triggered (→ black mark) */
  investigated: boolean;
  /** Whether an arrest was triggered (→ additional black mark via PersonnelFile) */
  arrested: boolean;
  /** Soviet-flavored announcement text (only set when investigated or arrested) */
  announcement: string | null;
}

/** Blat connections at or below this level are safe from KGB scrutiny. */
export const BLAT_SAFE_THRESHOLD = 15;

/** Blat connections above this level risk outright arrest. */
export const BLAT_ARREST_THRESHOLD = 30;

/** KGB investigation probability per excess blat point per tick. */
export const KGB_INVESTIGATION_CHANCE_PER_POINT = 0.01;

export interface EconomyTickResult {
  trudodniEarned: number;
  fondyDelivered: FondyDeliveryResult | null;
  stakhanovite: StakhanoviteEvent | null;
  blatLevel: number;
  rationsActive: boolean;
  rationDemand: RationDemand | null;
  mtsResult: MTSResult | null;
  heatingResult: HeatingResult | undefined;
  currencyReform: CurrencyReformResult | null;
  /** Passive per-tick KGB risk from high blat level */
  blatKgbResult: BlatKgbResult | null;
}

export interface ConsumerGoodsState {
  available: number;
  demand: number;
  satisfaction: number;
}

export interface EconomySaveData {
  trudodni: {
    totalContributed: number;
    perBuilding: [string, number][];
    minimumRequired: number;
  };
  fondy: {
    reliability: number;
    deliveryInterval: number;
    allocated: Record<TransferableResource, number>;
    nextDeliveryTick: number;
  };
  blat: {
    connections: number;
    totalSpent: number;
    totalEarned: number;
  };
  rations: {
    active: boolean;
    rations: RationConfig;
  };
  era: EraId;
  difficulty: DifficultyLevel;
  mts: {
    active: boolean;
    totalRentalSpent: number;
    tractorUnits: number;
  };
  heating: {
    tier: HeatingTier;
    ticksSinceRepair: number;
    efficiency: number;
    failing: boolean;
  };
  currencyReforms: {
    year: number;
    name: string;
    rate: number;
    applied: boolean;
    confiscation?: { threshold: number; rate: number };
  }[];
  consumerGoods?: ConsumerGoodsState;
}

// ─────────────────────────────────────────────────────────────────────────────
//  CONSTANTS — Trudodni
// ─────────────────────────────────────────────────────────────────────────────

/** Default trudodni rate per worker per tick for unknown buildings. */
export const DEFAULT_TRUDODNI = 0.5;

/**
 * Trudodni rate per worker per tick, keyed by building defId.
 *
 * Historical basis: 7-9 difficulty categories.
 * Cat 1 (simple) = 0.5, Cat 6 (heavy industry) = 1.5, Cat 8 (power) = 3.0.
 */
export const TRUDODNI_PER_BUILDING: Record<string, number> = {
  // Agriculture (Cat 2-3)
  'collective-farm-hq': 1.0,
  'kolkhoz-hq': 1.0,
  kolkhoz: 1.0,
  greenhouse: 0.7,
  barn: 0.7,

  // Light industry (Cat 4)
  'vodka-distillery': 1.0,
  'vodka-plant': 1.0,
  bakery: 1.0,

  // Construction / medium industry (Cat 5)
  factory: 1.2,
  warehouse: 1.2,

  // Heavy industry (Cat 6)
  'coal-plant': 1.5,
  'steel-mill': 1.5,
  'cement-works': 1.5,

  // Specialist (Cat 7)
  hospital: 2.0,
  school: 2.0,
  university: 2.0,

  // Heavy machinery / power (Cat 8)
  'power-station': 3.0,
  tec: 3.0,

  // Government / admin (below factory)
  ministry: 0.7,
  'party-hq': 0.7,
  soviet: 0.7,

  // Propaganda / culture
  monument: 0.5,
  cinema: 0.7,
  'radio-tower': 1.0,

  // Military / security
  gulag: 1.5,
  barracks: 1.0,
  'guard-tower': 0.5,
};

/** Minimum trudodni required per tick, by difficulty. */
export const MINIMUM_TRUDODNI_BY_DIFFICULTY: Record<DifficultyLevel, number> = {
  worker: 50,
  comrade: 100,
  tovarish: 200,
};

// ─────────────────────────────────────────────────────────────────────────────
//  CONSTANTS — Fondy (Material Allocations)
// ─────────────────────────────────────────────────────────────────────────────

const ZERO_RESOURCES: Record<TransferableResource, number> = {
  food: 0,
  vodka: 0,
  money: 0,
  steel: 0,
  timber: 0,
};

export const FONDY_BY_ERA: Record<EraId, FondyConfig> = {
  revolution: {
    reliability: 0.4,
    interval: 30,
    allocated: { food: 0, vodka: 0, money: 0, steel: 0, timber: 10 },
  },
  industrialization: {
    reliability: 0.6,
    interval: 20,
    allocated: { food: 5, vodka: 0, money: 10, steel: 20, timber: 15 },
  },
  wartime: {
    reliability: 0.3,
    interval: 40,
    allocated: { food: 5, vodka: 0, money: 5, steel: 10, timber: 5 },
  },
  reconstruction: {
    reliability: 0.5,
    interval: 25,
    allocated: { food: 5, vodka: 0, money: 10, steel: 15, timber: 10 },
  },
  thaw: {
    reliability: 0.8,
    interval: 15,
    allocated: { food: 10, vodka: 5, money: 20, steel: 25, timber: 20 },
  },
  stagnation: {
    reliability: 0.4,
    interval: 30,
    allocated: { food: 5, vodka: 5, money: 15, steel: 15, timber: 10 },
  },
  perestroika: {
    reliability: 0.3,
    interval: 35,
    allocated: { food: 3, vodka: 3, money: 10, steel: 10, timber: 8 },
  },
  eternal: {
    reliability: 0.2,
    interval: 40,
    allocated: { food: 2, vodka: 2, money: 5, steel: 5, timber: 5 },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
//  CONSTANTS — Rations
// ─────────────────────────────────────────────────────────────────────────────

/** Historical ration card periods. */
export const RATION_PERIODS: readonly { start: number; end: number }[] = [
  { start: 1929, end: 1935 },
  { start: 1941, end: 1947 },
  { start: 1983, end: 9999 },
];

/** Default ration tier distribution and per-capita consumption. */
export const DEFAULT_RATIONS: RationConfig = {
  worker: { share: 0.5, food: 1.0, vodka: 0.3 },
  employee: { share: 0.2, food: 0.7, vodka: 0.2 },
  dependent: { share: 0.2, food: 0.5, vodka: 0.1 },
  children: { share: 0.1, food: 0.4, vodka: 0.0 },
};

// ─────────────────────────────────────────────────────────────────────────────
//  CONSTANTS — Production Chains
// ─────────────────────────────────────────────────────────────────────────────

export const PRODUCTION_CHAINS: readonly ProductionChain[] = [
  {
    id: 'bread',
    steps: [
      { building: 'kolkhoz-hq', input: {}, output: { grain: 5 }, ticksRequired: 3 },
      { building: 'factory', input: { grain: 5 }, output: { bread: 3 }, ticksRequired: 2 },
    ],
  },
  {
    id: 'vodka',
    steps: [
      { building: 'kolkhoz-hq', input: {}, output: { grain: 5 }, ticksRequired: 3 },
      { building: 'vodka-plant', input: { grain: 5 }, output: { vodka: 2 }, ticksRequired: 4 },
    ],
  },
  {
    id: 'steel_goods',
    steps: [{ building: 'steel-mill', input: { steel: 3 }, output: { tools: 2 }, ticksRequired: 5 }],
  },
  {
    id: 'paperwork',
    steps: [
      {
        building: 'ministry',
        input: { timber: 2 },
        output: { paperwork: 5 },
        ticksRequired: 1,
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
//  CONSTANTS — Quota Escalation
// ─────────────────────────────────────────────────────────────────────────────

/** Multiplier applied to quota target when the plan is met. */
export const QUOTA_MET_ESCALATION = 1.15;

/** Multiplier applied to quota target when the plan is missed. */
export const QUOTA_MISSED_REDUCTION = 0.95;

/** Era-specific escalation multiplier for quota targets. */
export const ERA_ESCALATION: Record<EraId, number> = {
  revolution: 1.0,
  industrialization: 1.2,
  wartime: 1.4,
  reconstruction: 0.9,
  thaw: 1.0,
  stagnation: 1.1,
  perestroika: 0.8,
  eternal: 1.0,
};

/** Difficulty-specific quota target multiplier. */
export const DIFFICULTY_QUOTA_MULT: Record<DifficultyLevel, number> = {
  worker: 0.8,
  comrade: 1.0,
  tovarish: 1.3,
};

// ─────────────────────────────────────────────────────────────────────────────
//  CONSTANTS — Starting Resources
// ─────────────────────────────────────────────────────────────────────────────

/** Difficulty multiplier for starting resources. */
export const DIFFICULTY_RESOURCE_MULT: Record<DifficultyLevel, number> = {
  worker: 2.0,
  comrade: 1.0,
  tovarish: 0.5,
};

/** Era multiplier for starting resources. */
export const ERA_RESOURCE_MULT: Record<EraId, number> = {
  revolution: 0.8,
  industrialization: 0.9,
  wartime: 0.6,
  reconstruction: 0.7,
  thaw: 1.2,
  stagnation: 1.0,
  perestroika: 0.8,
  eternal: 0.5,
};

const BASE_STARTING_RESOURCES = {
  money: 2000,
  food: 200,
  vodka: 50,
  power: 0,
  population: 30,
  timber: 100,
  steel: 50,
  paperwork: 20,
} as const;

/** Typed starting resources — keys match BASE_STARTING_RESOURCES. */
export type StartingResources = { [K in keyof typeof BASE_STARTING_RESOURCES]: number };

// ─────────────────────────────────────────────────────────────────────────────
//  CONSTANTS — Difficulty Multipliers
// ─────────────────────────────────────────────────────────────────────────────

export const DIFFICULTY_MULTIPLIERS: Record<DifficultyLevel, DifficultyMultipliers> = {
  worker: {
    quotaTarget: 0.8,
    startingResources: 1.5,
    birthRate: 1.2,
    decayRate: 0.7,
    politruksPer100: 0.5,
    fondyReliability: 1.2,
    deliveryRate: 0.8,
    eventSeverity: 0.7,
    markDecayRate: 1.2,
    starvationRate: 0.7,
  },
  comrade: {
    quotaTarget: 1.0,
    startingResources: 1.0,
    birthRate: 1.0,
    decayRate: 1.0,
    politruksPer100: 1.0,
    fondyReliability: 1.0,
    deliveryRate: 1.0,
    eventSeverity: 1.0,
    markDecayRate: 1.0,
    starvationRate: 1.0,
  },
  tovarish: {
    quotaTarget: 1.3,
    startingResources: 0.7,
    birthRate: 0.8,
    decayRate: 1.3,
    politruksPer100: 1.5,
    fondyReliability: 0.7,
    deliveryRate: 1.2,
    eventSeverity: 1.3,
    markDecayRate: 0.7,
    starvationRate: 1.5,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
//  CONSTANTS — Stakhanovite
// ─────────────────────────────────────────────────────────────────────────────

/** Probability of a Stakhanovite event per check. Very small. */
export const STAKHANOVITE_CHANCE = 0.005;

const STAKHANOVITE_FIRST_NAMES = [
  'Ivan',
  'Pyotr',
  'Nikolai',
  'Vasily',
  'Alexei',
  'Boris',
  'Mikhail',
  'Sergei',
  'Andrei',
  'Dmitry',
];
const STAKHANOVITE_LAST_NAMES = [
  'Stakhanov',
  'Petrov',
  'Ivanov',
  'Kozlov',
  'Novikov',
  'Morozov',
  'Volkov',
  'Lebedev',
  'Kuznetsov',
  'Popov',
];

// ─────────────────────────────────────────────────────────────────────────────
//  CONSTANTS — MTS (Machine-Tractor Stations)
// ─────────────────────────────────────────────────────────────────────────────

/** MTS operated from 1928 to 1958. */
export const MTS_START_YEAR = 1928;
export const MTS_END_YEAR = 1958;

export const MTS_DEFAULTS = {
  tractorUnits: 5,
  rentalCostPerUnit: 10,
  grainBoostMultiplier: 1.3,
};

// ─────────────────────────────────────────────────────────────────────────────
//  CONSTANTS — Heating
// ─────────────────────────────────────────────────────────────────────────────

/** Population threshold for upgrading from pechka to district heating. */
export const DISTRICT_HEATING_POPULATION = 100;

/** Ticks at district tier before infrastructure crumbles. */
export const DISTRICT_TO_CRUMBLING_TICKS = 1000;

export const HEATING_CONFIGS: Record<HeatingTier, HeatingConfig> = {
  pechka: {
    consumption: { amount: 2, resource: 'timber' },
    baseEfficiency: 0.6,
    capacityPer100Pop: 50,
    repairThreshold: 500,
  },
  district: {
    consumption: { amount: 5, resource: 'power' },
    baseEfficiency: 0.9,
    capacityPer100Pop: 200,
    repairThreshold: 800,
  },
  crumbling: {
    consumption: { amount: 8, resource: 'power' },
    baseEfficiency: 0.5,
    capacityPer100Pop: 150,
    repairThreshold: 1200,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
//  CONSTANTS — Currency Reforms
// ─────────────────────────────────────────────────────────────────────────────

/** Historical Soviet currency reforms, in chronological order. */
export const CURRENCY_REFORMS: CurrencyReform[] = [
  { year: 1924, name: 'Chervonets Reform', rate: 50000, applied: false },
  { year: 1947, name: 'Post-War Reform', rate: 10, applied: false },
  { year: 1961, name: 'Khrushchev Reform', rate: 10, applied: false },
  {
    year: 1991,
    name: 'Pavlov Reform',
    rate: 1,
    applied: false,
    confiscation: { threshold: 1000, rate: 0.5 },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
//  PURE FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate trudodni earned at a building for a number of workers.
 * Uses the per-building rate table, falling back to DEFAULT_TRUDODNI.
 */
export function calculateBuildingTrudodni(defId: string, workers: number): number {
  const rate = TRUDODNI_PER_BUILDING[defId] ?? DEFAULT_TRUDODNI;
  return rate * workers;
}

/**
 * Calculate the next quota target based on whether the current was met,
 * era escalation, and difficulty multiplier.
 */
export function calculateNextQuota(
  current: number,
  met: boolean,
  eraEscalation: number,
  difficultyMult: number,
): number {
  const base = met ? QUOTA_MET_ESCALATION : QUOTA_MISSED_REDUCTION;
  return Math.round(current * base * eraEscalation * difficultyMult);
}

/**
 * Calculate ration demand for a population given a ration configuration.
 */
export function calculateRationDemand(population: number, rations: RationConfig): RationDemand {
  const tiers = [rations.worker, rations.employee, rations.dependent, rations.children];
  let food = 0;
  let vodka = 0;
  for (const tier of tiers) {
    const tierPop = population * tier.share;
    food += tierPop * tier.food;
    vodka += tierPop * tier.vodka;
  }
  return { food, vodka };
}

/**
 * Calculate starting resources for a new game, based on difficulty, era, and map size.
 */
export function calculateStartingResources(
  difficulty: DifficultyLevel,
  era: EraId,
  mapSize: number,
): StartingResources {
  const diffMult = DIFFICULTY_RESOURCE_MULT[difficulty];
  const eraMult = ERA_RESOURCE_MULT[era];
  const sizeMult = mapSize / 30;

  const result = {} as Record<string, number>;
  for (const [key, base] of Object.entries(BASE_STARTING_RESOURCES)) {
    result[key] = Math.round(base * diffMult * eraMult * sizeMult);
  }
  return result as StartingResources;
}

/** Returns whether rations should be active for a given year. */
export function shouldRationsBeActive(year: number): boolean {
  return RATION_PERIODS.some((p) => year >= p.start && year <= p.end);
}

/** Returns whether MTS should be active for a given year. */
export function shouldMTSBeActive(year: number): boolean {
  return year >= MTS_START_YEAR && year <= MTS_END_YEAR;
}

/**
 * Determine the current heating tier based on population, repair state,
 * and current tier.
 */
export function determineHeatingTier(
  population: number,
  ticksSinceRepair: number,
  currentTier: HeatingTier,
): HeatingTier {
  // Check crumbling degradation first (only from district)
  if (currentTier === 'district' && ticksSinceRepair >= DISTRICT_TO_CRUMBLING_TICKS) {
    return 'crumbling';
  }
  // Check upgrade to district
  if (population >= DISTRICT_HEATING_POPULATION) {
    return currentTier === 'crumbling' ? 'crumbling' : 'district';
  }
  return 'pechka';
}

/** Returns a defensive copy of the difficulty multipliers for a given level. */
export function getDifficultyMultipliers(level: DifficultyLevel): DifficultyMultipliers {
  return { ...DIFFICULTY_MULTIPLIERS[level] };
}

/**
 * Find the earliest unapplied currency reform whose year <= currentYear.
 */
export function findPendingReform(reforms: CurrencyReform[], currentYear: number): CurrencyReform | null {
  for (const reform of reforms) {
    if (!reform.applied && reform.year <= currentYear) {
      return reform;
    }
  }
  return null;
}

/**
 * Apply a currency reform to a money balance.
 * Standard reforms divide by rate. Pavlov-style confiscates excess above threshold.
 */
export function applyCurrencyReform(
  money: number,
  reform: CurrencyReform,
): { moneyBefore: number; moneyAfter: number; amountLost: number } {
  const moneyBefore = money;
  let moneyAfter: number;

  if (reform.confiscation) {
    const { threshold, rate } = reform.confiscation;
    if (money <= threshold) {
      moneyAfter = money;
    } else {
      const excess = money - threshold;
      const confiscated = Math.round(excess * rate);
      moneyAfter = money - confiscated;
    }
  } else {
    moneyAfter = Math.max(1, Math.round(money / reform.rate));
  }

  return {
    moneyBefore,
    moneyAfter,
    amountLost: moneyBefore - moneyAfter,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  WINTER DETECTION
// ─────────────────────────────────────────────────────────────────────────────

const WINTER_MONTHS = new Set([1, 2, 3, 11, 12]);

function isWinterMonth(month: number): boolean {
  return WINTER_MONTHS.has(month);
}

// ─────────────────────────────────────────────────────────────────────────────
//  ECONOMY SYSTEM CLASS
// ─────────────────────────────────────────────────────────────────────────────

export class EconomySystem {
  private era: EraId;
  private difficulty: DifficultyLevel;
  private rng: GameRng | null = null;

  // Trudodni
  private trudodniTotal = 0;
  private trudodniPerBuilding = new Map<string, number>();
  private trudodniMinimum: number;

  // Fondy
  private fondy: FondyState;

  // Blat
  private blat: BlatState;

  // Rations
  private rations: RationState;

  // MTS
  private mts: MTSState;

  // Heating
  private heating: HeatingState;

  // Consumer goods
  private consumerGoods: ConsumerGoodsState = { available: 50, demand: 100, satisfaction: 0.5 };

  // Currency reforms — own copy so mutations don't affect the shared constant
  private reforms: CurrencyReform[];

  constructor(era: EraId = 'revolution', difficulty: DifficultyLevel = 'comrade') {
    this.era = era;
    this.difficulty = difficulty;
    this.trudodniMinimum = MINIMUM_TRUDODNI_BY_DIFFICULTY[difficulty];

    // Init fondy from era config
    const fondyConfig = FONDY_BY_ERA[era];
    this.fondy = {
      reliability: fondyConfig.reliability,
      interval: fondyConfig.interval,
      deliveryInterval: fondyConfig.interval,
      allocated: { ...fondyConfig.allocated },
      nextDeliveryTick: fondyConfig.interval,
    };

    // Init blat at 10
    this.blat = { connections: 10, totalSpent: 0, totalEarned: 10 };

    // Init rations (inactive by default)
    this.rations = {
      active: false,
      rations: deepCloneRationConfig(DEFAULT_RATIONS),
    };

    // Init MTS
    this.mts = { active: false, totalRentalSpent: 0, tractorUnits: MTS_DEFAULTS.tractorUnits };

    // Init heating
    this.heating = { tier: 'pechka', ticksSinceRepair: 0, efficiency: 0.6, failing: false };

    // Own copy of currency reforms
    this.reforms = CURRENCY_REFORMS.map((r) => ({
      ...r,
      confiscation: r.confiscation ? { ...r.confiscation } : undefined,
    }));
  }

  /**
   * Pre-mark currency reforms that occurred before the game's starting year.
   * Call this after construction when starting a game at a later date.
   */
  markReformsBeforeYear(startYear: number): void {
    for (const reform of this.reforms) {
      if (reform.year < startYear) {
        reform.applied = true;
      }
    }
  }

  // ── RNG ────────────────────────────────────────────────────────────────────

  setRng(rng: GameRng): void {
    this.rng = rng;
  }

  // ── Era / Difficulty ────────────────────────────────────────────────────────

  getEra(): EraId {
    return this.era;
  }

  setEra(era: EraId): void {
    this.era = era;
    const config = FONDY_BY_ERA[era];
    this.fondy.reliability = config.reliability;
    this.fondy.deliveryInterval = config.interval;
    this.fondy.interval = config.interval;
    this.fondy.allocated = { ...config.allocated };
  }

  getDifficulty(): DifficultyLevel {
    return this.difficulty;
  }

  getMultipliers(): DifficultyMultipliers {
    return getDifficultyMultipliers(this.difficulty);
  }

  // ── Trudodni ───────────────────────────────────────────────────────────────

  recordTrudodni(key: string, defId: string, workers: number): void {
    const earned = calculateBuildingTrudodni(defId, workers);
    this.trudodniTotal += earned;
    const existing = this.trudodniPerBuilding.get(key) ?? 0;
    this.trudodniPerBuilding.set(key, existing + earned);
  }

  getTrudodni(): TrudodniState {
    return {
      totalContributed: this.trudodniTotal,
      perBuilding: new Map(this.trudodniPerBuilding),
      minimumRequired: this.trudodniMinimum,
    };
  }

  getTrudodniRatio(): number {
    if (this.trudodniMinimum === 0) return 1;
    return this.trudodniTotal / this.trudodniMinimum;
  }

  resetTrudodni(): void {
    this.trudodniTotal = 0;
    this.trudodniPerBuilding.clear();
  }

  // ── Fondy ──────────────────────────────────────────────────────────────────

  getFondy(): Readonly<FondyState> {
    return this.fondy;
  }

  processDelivery(tick: number): FondyDeliveryResult | null {
    if (tick < this.fondy.nextDeliveryTick) return null;

    const rand = this.rng ? this.rng.random() : Math.random();
    const delivered = rand < this.fondy.reliability;

    let actualDelivered: Record<TransferableResource, number>;
    let reason: string;

    if (delivered) {
      const quantityRoll = this.rng ? this.rng.random() : Math.random();
      const quantity = 0.7 + quantityRoll * 0.3;
      actualDelivered = { ...ZERO_RESOURCES };
      for (const key of Object.keys(ZERO_RESOURCES) as TransferableResource[]) {
        actualDelivered[key] = Math.round(this.fondy.allocated[key] * quantity);
      }
      reason = 'Delivered on schedule';
    } else {
      actualDelivered = { ...ZERO_RESOURCES };
      reason = 'Delivery failed — truck broke down en route';
    }

    this.fondy.nextDeliveryTick += this.fondy.deliveryInterval;

    return {
      delivered,
      allocated: { ...this.fondy.allocated },
      actualDelivered,
      reason,
    };
  }

  // ── Blat ───────────────────────────────────────────────────────────────────

  getBlat(): Readonly<BlatState> {
    return this.blat;
  }

  grantBlat(amount: number): void {
    this.blat.connections = Math.min(100, this.blat.connections + amount);
    this.blat.totalEarned += amount;
  }

  spendBlat(
    amount: number,
    purpose: BlatPurpose,
  ): { success: boolean; kgbDetected: boolean; effect?: BlatEffect } {
    if (this.blat.connections < amount) {
      return { success: false, kgbDetected: false };
    }
    this.blat.connections -= amount;
    this.blat.totalSpent += amount;

    let effect: BlatEffect | undefined;

    switch (purpose) {
      case 'improve_delivery':
        // Existing: improve fondy delivery reliability
        this.fondy.reliability = Math.min(1.0, this.fondy.reliability + 0.05);
        effect = { type: 'improve_delivery', value: 0.05 };
        break;
      case 'reduce_quota':
        // FIX-09: Spend blat to reduce current quota targets by 5% per point
        effect = { type: 'reduce_quota', value: amount * 0.05 };
        break;
      case 'kgb_protection':
        // FIX-09: Spend blat to reduce KGB investigation risk
        // Each point spent provides temporary protection (reduces effective threat)
        effect = { type: 'kgb_protection', value: amount * 2 };
        break;
      case 'consumer_goods':
        // FIX-09: Spend blat to acquire consumer goods (boost satisfaction)
        this.consumerGoods.available += amount * 5;
        effect = { type: 'consumer_goods', value: amount * 5 };
        break;
      case 'trading':
        // FIX-09: Spend blat for favorable trade terms (money bonus)
        effect = { type: 'trading', value: amount * 10 };
        break;
    }

    // KGB detection risk: 2% per point above threshold of 5
    // High blat + high visibility = corruption investigation
    const kgbThreshold = 5;
    let kgbDetected = false;
    if (amount > kgbThreshold) {
      const excessPoints = amount - kgbThreshold;
      const detectionChance = excessPoints * 0.02;
      const rand = this.rng ? this.rng.random() : Math.random();
      if (rand < detectionChance) {
        kgbDetected = true;
      }
    }

    return { success: true, kgbDetected, effect };
  }

  /**
   * Passive per-tick KGB risk from accumulated blat connections.
   *
   * The KGB doesn't need you to spend blat to notice you have it.
   * High connections mean you know people, and knowing people means
   * someone, somewhere, is writing a report about you.
   *
   * - Below BLAT_SAFE_THRESHOLD (15): safe, comrade. For now.
   * - Above threshold: 1% investigation chance per excess point per tick.
   * - Above BLAT_ARREST_THRESHOLD (30): additional 1% arrest chance per tick.
   */
  checkBlatKgbRisk(): BlatKgbResult | null {
    const connections = this.blat.connections;
    if (connections <= BLAT_SAFE_THRESHOLD) return null;
    // Require seeded RNG — per-tick random checks must be deterministic
    if (!this.rng) return null;

    const rng = this.rng;
    const rand = () => rng.random();
    const excessPoints = connections - BLAT_SAFE_THRESHOLD;
    const investigationChance = Math.min(1, excessPoints * KGB_INVESTIGATION_CHANCE_PER_POINT);

    let investigated = false;
    let arrested = false;
    let announcement: string | null = null;

    if (rand() < investigationChance) {
      investigated = true;
      announcement =
        'KGB Report: Citizen has been observed maintaining suspiciously ' +
        'extensive personal connections. An investigation has been opened.';
    }

    if (connections > BLAT_ARREST_THRESHOLD && rand() < 0.01) {
      arrested = true;
      announcement =
        'KGB DIRECTIVE: Citizen detained for questioning regarding ' +
        'anti-Soviet networking activities. File transferred to special tribunal.';
    }

    if (!investigated && !arrested) return null;

    return { investigated, arrested, announcement };
  }

  // ── Rations ────────────────────────────────────────────────────────────────

  getRations(): Readonly<RationState> {
    return this.rations;
  }

  updateRations(year: number): void {
    this.rations.active = shouldRationsBeActive(year);
  }

  calculateDemand(population: number): RationDemand | null {
    if (!this.rations.active) return null;
    return calculateRationDemand(population, this.rations.rations);
  }

  // ── Stakhanovite ──────────────────────────────────────────────────────────

  checkStakhanovite(buildingDefIds: string[]): StakhanoviteEvent | null {
    if (buildingDefIds.length === 0) return null;

    const rand = this.rng ? this.rng.random() : Math.random();
    if (rand >= STAKHANOVITE_CHANCE) return null;

    // Pick building
    const buildingIdx = this.rng
      ? this.rng.pickIndex(buildingDefIds.length)
      : Math.floor(Math.random() * buildingDefIds.length);
    const building = buildingDefIds[buildingIdx]!;

    // Generate worker name
    const firstIdx = this.rng
      ? this.rng.pickIndex(STAKHANOVITE_FIRST_NAMES.length)
      : Math.floor(Math.random() * STAKHANOVITE_FIRST_NAMES.length);
    const lastIdx = this.rng
      ? this.rng.pickIndex(STAKHANOVITE_LAST_NAMES.length)
      : Math.floor(Math.random() * STAKHANOVITE_LAST_NAMES.length);
    const workerName = `${STAKHANOVITE_FIRST_NAMES[firstIdx]} ${STAKHANOVITE_LAST_NAMES[lastIdx]}`;

    // Production boost: 1.5 - 4.0
    const boostRand = this.rng ? this.rng.random() : Math.random();
    const productionBoost = 1.5 + boostRand * 2.5;

    // Propaganda value: 10 - 50
    const propagandaValue = Math.round(10 + (this.rng ? this.rng.random() : Math.random()) * 40);

    // Quota increase: 15 - 25%
    const quotaIncrease = 0.15 + (this.rng ? this.rng.random() : Math.random()) * 0.1;

    return {
      workerName,
      building,
      productionBoost,
      propagandaValue,
      quotaIncrease,
      announcement: `HERO OF SOCIALIST LABOR: ${workerName} exceeds quota by ${Math.round((productionBoost - 1) * 100)}% at ${building}!`,
    };
  }

  // ── Remainder Allocation ───────────────────────────────────────────────────

  allocateRemainder(surplus: Record<TransferableResource, number>): RemainderAllocation {
    const distributed = { ...ZERO_RESOURCES };
    const reserved = { ...ZERO_RESOURCES };
    for (const key of Object.keys(ZERO_RESOURCES) as TransferableResource[]) {
      distributed[key] = Math.floor(surplus[key] * 0.7);
      reserved[key] = surplus[key] - distributed[key];
    }
    return { distributed, reserved };
  }

  // ── MTS ────────────────────────────────────────────────────────────────────

  getMTS(): Readonly<MTSState> {
    return this.mts;
  }

  processMTS(year: number, money: number): MTSResult | null {
    if (!shouldMTSBeActive(year)) {
      this.mts.active = false;
      return null;
    }

    this.mts.active = true;
    const totalCost = MTS_DEFAULTS.rentalCostPerUnit * MTS_DEFAULTS.tractorUnits;

    if (money >= totalCost) {
      this.mts.totalRentalSpent += totalCost;
      return {
        applied: true,
        cost: totalCost,
        grainMultiplier: MTS_DEFAULTS.grainBoostMultiplier,
      };
    }

    return { applied: false, cost: 0, grainMultiplier: 1.0 };
  }

  // ── Heating ────────────────────────────────────────────────────────────────

  getHeating(): Readonly<HeatingState> {
    return this.heating;
  }

  processHeating(population: number, month: number, hasHeatingResource: boolean): HeatingResult {
    // Determine tier
    const newTier = determineHeatingTier(population, this.heating.ticksSinceRepair, this.heating.tier);
    this.heating.tier = newTier;
    this.heating.efficiency = HEATING_CONFIGS[newTier].baseEfficiency;

    // Increment ticks since repair for district/crumbling tiers
    if (newTier === 'district' || newTier === 'crumbling') {
      this.heating.ticksSinceRepair++;
    }

    const isWinter = isWinterMonth(month);
    const operational = hasHeatingResource;
    let populationAtRisk = 0;
    let fuelConsumed: HeatingResult['fuelConsumed'] = null;

    if (isWinter) {
      if (operational) {
        // Consume fuel during winter
        const cfg = HEATING_CONFIGS[newTier];
        fuelConsumed = { resource: cfg.consumption.resource, amount: cfg.consumption.amount };
        this.heating.failing = false;
      } else {
        // Without heating in winter, population is at risk
        populationAtRisk = Math.round(population * (1 - this.heating.efficiency));
        this.heating.failing = true;
      }
    } else {
      this.heating.failing = false;
    }

    return { operational, populationAtRisk, tier: newTier, fuelConsumed };
  }

  repairHeating(): void {
    this.heating.ticksSinceRepair = 0;
    this.heating.failing = false;
  }

  // ── Currency Reforms ───────────────────────────────────────────────────────

  getCurrencyReforms(): CurrencyReform[] {
    return this.reforms.map((r) => ({
      ...r,
      confiscation: r.confiscation ? { ...r.confiscation } : undefined,
    }));
  }

  checkCurrencyReform(year: number, money: number): CurrencyReformResult | null {
    const pending = findPendingReform(this.reforms, year);
    if (!pending) return null;

    const result = applyCurrencyReform(money, pending);
    pending.applied = true;

    return {
      reform: {
        ...pending,
        confiscation: pending.confiscation ? { ...pending.confiscation } : undefined,
      },
      ...result,
    };
  }

  // ── Consumer Goods ──────────────────────────────────────────────────────

  tickConsumerGoods(population: number, settlementTier: string): void {
    // Consumer goods unlock at PGT tier
    if (settlementTier !== 'pgt' && settlementTier !== 'gorod') {
      this.consumerGoods.satisfaction = 0;
      return;
    }

    // Demand scales with population
    this.consumerGoods.demand = population * 0.5;

    // Available goods = base supply + blat bonus
    const blatBonus = this.blat.connections * 0.5;
    this.consumerGoods.available = 20 + blatBonus;

    // Satisfaction ratio (capped at 1.0)
    this.consumerGoods.satisfaction = Math.min(
      1.0,
      this.consumerGoods.demand > 0 ? this.consumerGoods.available / this.consumerGoods.demand : 0,
    );
  }

  getConsumerGoodsSatisfaction(): number {
    return this.consumerGoods.satisfaction;
  }

  // ── Production Chains ─────────────────────────────────────────────────────

  /**
   * FIX-10: Process production chains — multi-step resource conversion.
   *
   * Checks each chain's requirements against available buildings and resources.
   * If all inputs are available and the required building exists, consumes inputs
   * and produces outputs.
   *
   * @param buildingDefIds - Currently placed building defIds
   * @param resources - Mutable resource record to read/write
   * @returns Array of chain IDs that produced this tick
   */
  tickProductionChains(
    buildingDefIds: string[],
    resources: { food: number; vodka: number; timber: number; steel: number },
  ): string[] {
    const produced: string[] = [];
    const buildingSet = new Set(buildingDefIds);

    for (const chain of PRODUCTION_CHAINS) {
      // Check all steps can execute: building exists and inputs are available
      let canExecute = true;
      for (const step of chain.steps) {
        if (!buildingSet.has(step.building)) {
          canExecute = false;
          break;
        }
        // Check inputs
        for (const [resource, amount] of Object.entries(step.input)) {
          const available = (resources as Record<string, number>)[resource] ?? 0;
          if (available < amount) {
            canExecute = false;
            break;
          }
        }
        if (!canExecute) break;
      }

      if (!canExecute) continue;

      // Execute chain: consume inputs, produce outputs
      for (const step of chain.steps) {
        for (const [resource, amount] of Object.entries(step.input)) {
          (resources as Record<string, number>)[resource] =
            Math.max(0, ((resources as Record<string, number>)[resource] ?? 0) - amount);
        }
        for (const [resource, amount] of Object.entries(step.output)) {
          (resources as Record<string, number>)[resource] =
            ((resources as Record<string, number>)[resource] ?? 0) + amount;
        }
      }

      produced.push(chain.id);
    }

    return produced;
  }

  // ── Main Tick ──────────────────────────────────────────────────────────────

  tick(
    currentTick: number,
    year: number,
    population: number,
    buildingDefIds: string[],
    options?: {
      money?: number;
      month?: number;
      hasHeatingResource?: boolean;
    },
  ): EconomyTickResult {
    const money = options?.money ?? 0;
    const month = options?.month ?? 6;
    const hasHeatingResource = options?.hasHeatingResource ?? true;

    // Trudodni — record for each building
    let trudodniEarned = 0;
    for (const defId of buildingDefIds) {
      const earned = calculateBuildingTrudodni(defId, population);
      this.recordTrudodni(`tick-${currentTick}-${defId}`, defId, population);
      trudodniEarned += earned;
    }

    // Fondy delivery
    const fondyDelivered = this.processDelivery(currentTick);

    // Stakhanovite check
    const stakhanovite = this.checkStakhanovite(buildingDefIds);
    if (stakhanovite) {
      this.grantBlat(5);
    }

    // Rations
    this.updateRations(year);
    const rationDemand = this.calculateDemand(population);

    // MTS
    const mtsResult = this.processMTS(year, money);

    // Heating
    const heatingResult = this.processHeating(population, month, hasHeatingResource);

    // Currency reform
    const currencyReform = this.checkCurrencyReform(year, money);

    // Blat KGB risk — passive per-tick investigation/arrest chance
    const blatKgbResult = this.checkBlatKgbRisk();

    return {
      trudodniEarned,
      fondyDelivered,
      stakhanovite,
      blatLevel: this.blat.connections,
      rationsActive: this.rations.active,
      rationDemand,
      mtsResult,
      heatingResult,
      currencyReform,
      blatKgbResult,
    };
  }

  // ── Serialization ──────────────────────────────────────────────────────────

  serialize(): EconomySaveData {
    return {
      trudodni: {
        totalContributed: this.trudodniTotal,
        perBuilding: Array.from(this.trudodniPerBuilding.entries()),
        minimumRequired: this.trudodniMinimum,
      },
      fondy: {
        reliability: this.fondy.reliability,
        deliveryInterval: this.fondy.deliveryInterval,
        allocated: { ...this.fondy.allocated },
        nextDeliveryTick: this.fondy.nextDeliveryTick,
      },
      blat: {
        connections: this.blat.connections,
        totalSpent: this.blat.totalSpent,
        totalEarned: this.blat.totalEarned,
      },
      rations: {
        active: this.rations.active,
        rations: deepCloneRationConfig(this.rations.rations),
      },
      era: this.era,
      difficulty: this.difficulty,
      mts: {
        active: this.mts.active,
        totalRentalSpent: this.mts.totalRentalSpent,
        tractorUnits: this.mts.tractorUnits,
      },
      heating: {
        tier: this.heating.tier,
        ticksSinceRepair: this.heating.ticksSinceRepair,
        efficiency: this.heating.efficiency,
        failing: this.heating.failing,
      },
      currencyReforms: this.reforms.map((r) => ({
        year: r.year,
        name: r.name,
        rate: r.rate,
        applied: r.applied,
        confiscation: r.confiscation ? { ...r.confiscation } : undefined,
      })),
      consumerGoods: { ...this.consumerGoods },
    };
  }

  static deserialize(data: EconomySaveData): EconomySystem {
    const sys = new EconomySystem(data.era, data.difficulty);

    // Restore trudodni
    sys.trudodniTotal = data.trudodni.totalContributed;
    sys.trudodniPerBuilding = new Map(data.trudodni.perBuilding);
    sys.trudodniMinimum = data.trudodni.minimumRequired;

    // Restore fondy
    sys.fondy.reliability = data.fondy.reliability;
    sys.fondy.deliveryInterval = data.fondy.deliveryInterval;
    sys.fondy.interval = data.fondy.deliveryInterval;
    sys.fondy.allocated = { ...data.fondy.allocated };
    sys.fondy.nextDeliveryTick = data.fondy.nextDeliveryTick;

    // Restore blat
    sys.blat.connections = data.blat.connections;
    sys.blat.totalSpent = data.blat.totalSpent;
    sys.blat.totalEarned = data.blat.totalEarned;

    // Restore rations
    sys.rations.active = data.rations.active;
    sys.rations.rations = deepCloneRationConfig(data.rations.rations);

    // Restore MTS
    if (data.mts) {
      sys.mts.active = data.mts.active;
      sys.mts.totalRentalSpent = data.mts.totalRentalSpent;
      sys.mts.tractorUnits = data.mts.tractorUnits;
    }

    // Restore heating
    if (data.heating) {
      sys.heating.tier = data.heating.tier;
      sys.heating.ticksSinceRepair = data.heating.ticksSinceRepair;
      sys.heating.efficiency = data.heating.efficiency;
      sys.heating.failing = data.heating.failing;
    }

    // Restore currency reforms
    if (data.currencyReforms) {
      sys.reforms = data.currencyReforms.map((r) => ({
        ...r,
        confiscation: r.confiscation ? { ...r.confiscation } : undefined,
      }));
    }

    // Restore consumer goods
    if (data.consumerGoods) {
      sys.consumerGoods = { ...data.consumerGoods };
    }

    return sys;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function deepCloneRationConfig(config: RationConfig): RationConfig {
  return {
    worker: { ...config.worker },
    employee: { ...config.employee },
    dependent: { ...config.dependent },
    children: { ...config.children },
  };
}
