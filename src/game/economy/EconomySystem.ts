/**
 * @module game/economy/EconomySystem
 *
 * The comprehensive planned economy orchestrator.
 *
 * Manages trudodni, fondy, blat, rations, MTS, heating, currency reforms,
 * and Stakhanovite events. Does NOT directly modify ECS state — returns
 * results for the SimulationEngine to apply.
 */

import type { GameRng } from '../SeedSystem';
import { applyCurrencyReform, CURRENCY_REFORMS, findPendingReform } from './currency';
import { getDifficultyMultipliers } from './difficulty';
import { FONDY_BY_ERA } from './fondy';
import { determineHeatingTier, HEATING_CONFIGS } from './heating';
import { cloneTransferable, zeroTransferable } from './helpers';
import { MTS_DEFAULTS, shouldMTSBeActive } from './mts';
import { calculateRationDemand, DEFAULT_RATIONS, shouldRationsBeActive } from './rations';
import {
  STAKHANOVITE_ANNOUNCEMENTS,
  STAKHANOVITE_BOOST_MAX,
  STAKHANOVITE_BOOST_MIN,
  STAKHANOVITE_CHANCE,
  STAKHANOVITE_FIRST_NAMES,
  STAKHANOVITE_QUOTA_INCREASE_FACTOR,
  STAKHANOVITE_SURNAMES,
} from './stakhanovites';
import { calculateBuildingTrudodni, MINIMUM_TRUDODNI_BY_DIFFICULTY } from './trudodni';
import type {
  BlatState,
  CurrencyReformEvent,
  CurrencyReformResult,
  DifficultyLevel,
  DifficultyMultipliers,
  EconomySaveData,
  EconomyTickResult,
  EraId,
  FondyAllocation,
  FondyDeliveryResult,
  HeatingState,
  HeatingTickResult,
  HeatingTier,
  MTSState,
  MTSTickResult,
  RationConfig,
  RationDemand,
  RemainderAllocation,
  StakhanoviteEvent,
  TransferableResource,
  TrudodniRecord,
} from './types';

export class EconomySystem {
  private trudodni: TrudodniRecord;
  private fondy: FondyAllocation;
  private blat: BlatState;
  private rations: RationConfig;
  private mts: MTSState;
  private heating: HeatingState;
  private currencyReforms: CurrencyReformEvent[];
  private era: EraId;
  private difficulty: DifficultyLevel;
  private rng: GameRng | null = null;

  constructor(era: EraId = 'revolution', difficulty: DifficultyLevel = 'comrade') {
    this.era = era;
    this.difficulty = difficulty;

    // Initialize trudodni
    this.trudodni = {
      totalContributed: 0,
      perBuilding: new Map(),
      minimumRequired: MINIMUM_TRUDODNI_BY_DIFFICULTY[difficulty],
    };

    // Initialize fondy from era config
    const fondyConfig = FONDY_BY_ERA[era];
    this.fondy = {
      allocated: cloneTransferable(fondyConfig.allocated),
      delivered: zeroTransferable(),
      nextDeliveryTick: fondyConfig.interval,
      deliveryInterval: fondyConfig.interval,
      reliability: fondyConfig.reliability,
    };

    // Initialize blat — everyone starts with a few connections
    this.blat = {
      connections: 10,
      totalSpent: 0,
      totalEarned: 10,
    };

    // Initialize rations — default inactive
    this.rations = {
      active: false,
      rations: { ...DEFAULT_RATIONS },
    };

    // Initialize MTS
    this.mts = {
      active: false,
      tractorUnits: MTS_DEFAULTS.tractorUnits,
      rentalCostPerUnit: MTS_DEFAULTS.rentalCostPerUnit,
      grainBoostMultiplier: MTS_DEFAULTS.grainBoostMultiplier,
      totalRentalSpent: 0,
    };

    // Initialize heating — start with pechka
    const pechkaConfig = HEATING_CONFIGS.pechka;
    this.heating = {
      tier: 'pechka',
      consumption: { ...pechkaConfig.consumption },
      capacityServed: pechkaConfig.capacityPer100Pop,
      efficiency: pechkaConfig.baseEfficiency,
      ticksSinceRepair: 0,
      failing: false,
    };

    // Initialize currency reforms as independent copies
    this.currencyReforms = CURRENCY_REFORMS.map((r) => ({ ...r }));
  }

  /** Provide a seeded RNG for deterministic behavior. */
  setRng(rng: GameRng): void {
    this.rng = rng;
  }

  /** Update the era (called when EraSystem transitions). */
  setEra(era: EraId): void {
    this.era = era;
    const config = FONDY_BY_ERA[era];
    this.fondy.allocated = cloneTransferable(config.allocated);
    this.fondy.deliveryInterval = config.interval;
    this.fondy.reliability = config.reliability;
  }

  /** Get the current era. */
  getEra(): EraId {
    return this.era;
  }

  /** Get the current difficulty. */
  getDifficulty(): DifficultyLevel {
    return this.difficulty;
  }

  // ── Trudodni ──────────────────────────────────────────────────

  /** Get current trudodni record (read-only snapshot). */
  getTrudodni(): Readonly<TrudodniRecord> {
    return this.trudodni;
  }

  /**
   * Record trudodni earned at a building for this tick.
   *
   * @param buildingKey Grid position key "x,y"
   * @param defId       Building definition ID
   * @param workers     Number of workers assigned
   * @returns Trudodni earned this tick at this building
   */
  recordTrudodni(buildingKey: string, defId: string, workers: number): number {
    const earned = calculateBuildingTrudodni(defId, workers);
    this.trudodni.totalContributed += earned;

    const existing = this.trudodni.perBuilding.get(buildingKey) ?? 0;
    this.trudodni.perBuilding.set(buildingKey, existing + earned);

    return earned;
  }

  /** Reset trudodni for new plan period. */
  resetTrudodni(): void {
    this.trudodni.totalContributed = 0;
    this.trudodni.perBuilding.clear();
  }

  /**
   * Check if trudodni minimum has been met.
   * Returns the ratio of contributed to required (>= 1.0 means met).
   */
  getTrudodniRatio(): number {
    if (this.trudodni.minimumRequired <= 0) return 1.0;
    return this.trudodni.totalContributed / this.trudodni.minimumRequired;
  }

  // ── Fondy ─────────────────────────────────────────────────────

  /** Get current fondy allocation (read-only snapshot). */
  getFondy(): Readonly<FondyAllocation> {
    return this.fondy;
  }

  /**
   * Process a fondy delivery attempt.
   *
   * Checks if it's time for a delivery, then rolls for reliability.
   * Each resource is independently subject to the reliability check
   * with additional per-resource variance.
   *
   * @param currentTick Current simulation tick
   * @returns Delivery result, or null if no delivery was due
   */
  processDelivery(currentTick: number): FondyDeliveryResult | null {
    if (currentTick < this.fondy.nextDeliveryTick) {
      return null;
    }

    // Schedule next delivery
    this.fondy.nextDeliveryTick = currentTick + this.fondy.deliveryInterval;

    const rand = this.rng ? () => this.rng!.random() : () => Math.random();

    // Master delivery check — sometimes nothing arrives at all
    if (rand() > this.fondy.reliability) {
      return {
        allocated: cloneTransferable(this.fondy.allocated),
        actualDelivered: zeroTransferable(),
        delivered: false,
        reason: 'Delivery train was rerouted to a higher-priority settlement.',
      };
    }

    // Delivery happens, but each resource has independent variance
    const actual = zeroTransferable();
    const keys: TransferableResource[] = ['food', 'vodka', 'money', 'steel', 'timber'];
    for (const key of keys) {
      // Each resource gets reliability * (0.5 to 1.0) of allocated
      const resourceReliability = 0.5 + rand() * 0.5;
      actual[key] = Math.round(
        this.fondy.allocated[key] * this.fondy.reliability * resourceReliability
      );
    }

    // Accumulate delivered totals
    for (const key of keys) {
      this.fondy.delivered[key] += actual[key];
    }

    return {
      allocated: cloneTransferable(this.fondy.allocated),
      actualDelivered: actual,
      delivered: true,
      reason: 'Delivery arrived. Contents may differ from manifest.',
    };
  }

  // ── Blat ──────────────────────────────────────────────────────

  /** Get current blat state (read-only). */
  getBlat(): Readonly<BlatState> {
    return this.blat;
  }

  /**
   * Grant blat connections from an event or achievement.
   *
   * @param amount  Amount of blat to grant (capped at 100 total)
   */
  grantBlat(amount: number): void {
    this.blat.connections = Math.min(100, this.blat.connections + amount);
    this.blat.totalEarned += amount;
  }

  /**
   * Spend blat to improve fondy reliability or unlock benefits.
   *
   * Each blat transaction carries KGB detection risk: 2% per point spent
   * above a threshold of 5. High blat spending = corruption investigation.
   *
   * @param amount  Amount to spend
   * @param purpose Description of what the blat is being used for
   * @returns Object with `success` (had enough blat) and `kgbDetected` (corruption caught)
   */
  spendBlat(amount: number, purpose: string): { success: boolean; kgbDetected: boolean } {
    if (this.blat.connections < amount) {
      return { success: false, kgbDetected: false };
    }
    this.blat.connections -= amount;
    this.blat.totalSpent += amount;

    // Spending blat temporarily improves fondy reliability
    if (purpose === 'improve_delivery') {
      this.fondy.reliability = Math.min(1.0, this.fondy.reliability + 0.05);
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

    return { success: true, kgbDetected };
  }

  // ── Rations ───────────────────────────────────────────────────

  /** Get current ration configuration. */
  getRations(): Readonly<RationConfig> {
    return this.rations;
  }

  /**
   * Update ration card status based on the current year.
   *
   * @param year Current in-game year
   */
  updateRations(year: number): void {
    this.rations.active = shouldRationsBeActive(year);
  }

  /**
   * Calculate total ration demand for a given population.
   * Returns null if rations are not active.
   */
  calculateDemand(population: number): RationDemand | null {
    if (!this.rations.active) return null;
    return calculateRationDemand(population, this.rations.rations);
  }

  // ── MTS ─────────────────────────────────────────────────────────

  /** Get current MTS state (read-only). */
  getMTS(): Readonly<MTSState> {
    return this.mts;
  }

  /**
   * Process MTS for one tick.
   *
   * If active and the player has enough money, charge rental and
   * return a grain production multiplier. Otherwise, no boost.
   *
   * @param year    Current in-game year
   * @param money   Current money balance
   * @returns MTS tick result, or null if MTS is not active this era
   */
  processMTS(year: number, money: number): MTSTickResult | null {
    this.mts.active = shouldMTSBeActive(year);
    if (!this.mts.active) return null;

    const cost = this.mts.tractorUnits * this.mts.rentalCostPerUnit;
    if (money < cost) {
      return { applied: false, cost: 0, grainMultiplier: 1.0 };
    }

    this.mts.totalRentalSpent += cost;
    return {
      applied: true,
      cost,
      grainMultiplier: this.mts.grainBoostMultiplier,
    };
  }

  // ── Heating ────────────────────────────────────────────────────

  /** Get current heating state (read-only). */
  getHeating(): Readonly<HeatingState> {
    return this.heating;
  }

  /**
   * Process heating for one tick.
   *
   * Evaluates tier progression, resource consumption, and breakdown risk.
   * During winter months (Nov-Mar), heating failure puts population at risk.
   *
   * @param population Current population
   * @param month      Current month (1-12)
   * @param hasResource Whether the required resource is available
   * @returns Heating tick result
   */
  processHeating(population: number, month: number, hasResource: boolean): HeatingTickResult {
    // Check tier progression
    const newTier = determineHeatingTier(
      population,
      this.heating.ticksSinceRepair,
      this.heating.tier
    );
    if (newTier !== this.heating.tier) {
      this.upgradeHeatingTier(newTier);
    }

    const config = HEATING_CONFIGS[this.heating.tier];
    const isWinter = month >= 11 || month <= 3;

    // Increment repair timer (for district/crumbling)
    if (this.heating.tier !== 'pechka') {
      this.heating.ticksSinceRepair++;
    }

    // Check for breakdown
    let breakdown = false;
    if (config.breakdownChancePerTick > 0) {
      const rand = this.rng ? this.rng.random() : Math.random();
      if (rand < config.breakdownChancePerTick) {
        breakdown = true;
        this.heating.failing = true;
      }
    }

    // Consume resources if available and not broken
    const operational = hasResource && !this.heating.failing;
    const consumed = operational
      ? { resource: config.consumption.resource as string, amount: config.consumption.amount }
      : { resource: config.consumption.resource as string, amount: 0 };

    // Update efficiency
    this.heating.efficiency = operational ? config.baseEfficiency : 0;

    // Calculate population at risk (winter only, when heating fails)
    const populationAtRisk = isWinter && !operational ? Math.ceil(population * 0.1) : 0;

    return { consumed, operational, populationAtRisk, breakdown };
  }

  /** Repair heating (resets failure state and timer). */
  repairHeating(): void {
    this.heating.failing = false;
    this.heating.ticksSinceRepair = 0;
  }

  /** Upgrade heating to a new tier. */
  private upgradeHeatingTier(tier: HeatingTier): void {
    const config = HEATING_CONFIGS[tier];
    this.heating.tier = tier;
    this.heating.consumption = { ...config.consumption };
    this.heating.capacityServed = config.capacityPer100Pop;
    this.heating.efficiency = config.baseEfficiency;
    if (tier === 'district') {
      this.heating.ticksSinceRepair = 0;
      this.heating.failing = false;
    }
  }

  // ── Currency Reform ────────────────────────────────────────────

  /** Get all currency reforms (read-only). */
  getCurrencyReforms(): ReadonlyArray<CurrencyReformEvent> {
    return this.currencyReforms;
  }

  /**
   * Check for and apply any pending currency reforms.
   *
   * @param year  Current in-game year
   * @param money Current money balance
   * @returns Reform result if one was applied, null otherwise
   */
  checkCurrencyReform(year: number, money: number): CurrencyReformResult | null {
    const pending = findPendingReform(this.currencyReforms, year);
    if (!pending) return null;

    const result = applyCurrencyReform(money, pending);
    pending.applied = true;
    return result;
  }

  // ── Difficulty Multipliers ─────────────────────────────────────

  /** Get the full difficulty multiplier set for the current difficulty. */
  getMultipliers(): DifficultyMultipliers {
    return getDifficultyMultipliers(this.difficulty);
  }

  // ── Stakhanovite ──────────────────────────────────────────────

  /**
   * Check for a Stakhanovite event this tick.
   *
   * Small probability per tick. If it fires, a random worker
   * dramatically exceeds their quota, generating propaganda...
   * and raising quotas for everyone else. The cruel irony of
   * individual achievement under collective planning.
   *
   * @param buildingDefIds Array of building defIds currently operating
   * @returns StakhanoviteEvent if one occurred, null otherwise
   */
  checkStakhanovite(buildingDefIds: string[]): StakhanoviteEvent | null {
    if (buildingDefIds.length === 0) return null;

    const rand = this.rng ? this.rng.random() : Math.random();
    if (rand > STAKHANOVITE_CHANCE) return null;

    const rng = this.rng;
    const pickRand = rng ? () => rng.random() : () => Math.random();
    const pickIndex = (len: number) => Math.floor(pickRand() * len);

    const firstName = STAKHANOVITE_FIRST_NAMES[pickIndex(STAKHANOVITE_FIRST_NAMES.length)]!;
    const surname = STAKHANOVITE_SURNAMES[pickIndex(STAKHANOVITE_SURNAMES.length)]!;
    const workerName = `${firstName} ${surname}`;
    const building = buildingDefIds[pickIndex(buildingDefIds.length)]!;

    const boost =
      STAKHANOVITE_BOOST_MIN + pickRand() * (STAKHANOVITE_BOOST_MAX - STAKHANOVITE_BOOST_MIN);
    const boostPercent = Math.round((boost - 1) * 100);

    const template = STAKHANOVITE_ANNOUNCEMENTS[pickIndex(STAKHANOVITE_ANNOUNCEMENTS.length)]!;
    const announcement = template
      .replace('{name}', workerName)
      .replace('{boost}', String(boostPercent))
      .replace('{building}', building);

    return {
      workerName,
      building,
      productionBoost: boost,
      propagandaValue: Math.round(boostPercent / 10),
      quotaIncrease: Math.round(boost * STAKHANOVITE_QUOTA_INCREASE_FACTOR * 100) / 100,
      announcement,
    };
  }

  // ── Remainder Allocation ──────────────────────────────────────

  /**
   * Allocate surplus resources after fondy deliveries.
   *
   * Splits surplus between citizen distribution (70%) and
   * strategic reserves (30%). Because the state always keeps a cut,
   * even from the remainder of the remainder.
   *
   * @param surplus Resources available for allocation
   * @returns How the surplus was split
   */
  allocateRemainder(surplus: Record<TransferableResource, number>): RemainderAllocation {
    const distributed = zeroTransferable();
    const reserved = zeroTransferable();

    const keys: TransferableResource[] = ['food', 'vodka', 'money', 'steel', 'timber'];
    for (const key of keys) {
      const amount = surplus[key] ?? 0;
      distributed[key] = Math.round(amount * 0.7);
      reserved[key] = amount - distributed[key]; // Remainder goes to reserve
    }

    return { distributed, reserved };
  }

  // ── Main Tick ─────────────────────────────────────────────────

  /**
   * Run the economy system for one simulation tick.
   *
   * @param totalTicks    Current total tick count
   * @param year          Current in-game year
   * @param population    Current population
   * @param buildingDefIds Array of active building defIds
   * @returns Comprehensive tick result
   */
  tick(
    totalTicks: number,
    year: number,
    population: number,
    buildingDefIds: string[],
    context?: {
      month?: number;
      money?: number;
      hasHeatingResource?: boolean;
    }
  ): EconomyTickResult {
    const month = context?.month ?? 1;
    const money = context?.money ?? 0;
    const hasHeatingResource = context?.hasHeatingResource ?? true;

    // Update ration status
    this.updateRations(year);

    // Calculate trudodni from active buildings (simplified: 1 worker per building)
    let trudodniEarned = 0;
    for (const defId of buildingDefIds) {
      const earned = calculateBuildingTrudodni(defId, 1);
      trudodniEarned += earned;
      this.trudodni.totalContributed += earned;
    }

    // Process fondy delivery
    const fondyDelivered = this.processDelivery(totalTicks);

    // Process MTS
    const mtsResult = this.processMTS(year, money);

    // Process heating
    const heatingResult = this.processHeating(population, month, hasHeatingResource);

    // Check currency reform
    const currencyReform = this.checkCurrencyReform(year, money);

    // Stakhanovite check
    const stakhanovite = this.checkStakhanovite(buildingDefIds);

    // If Stakhanovite, grant some blat for the propaganda value
    if (stakhanovite) {
      this.grantBlat(stakhanovite.propagandaValue);
    }

    // Calculate ration demand
    const rationDemand = this.calculateDemand(population);

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
    };
  }

  // ── Serialization ─────────────────────────────────────────────

  /** Serialize the full economy state for save/load. */
  serialize(): EconomySaveData {
    return {
      trudodni: {
        totalContributed: this.trudodni.totalContributed,
        perBuilding: Array.from(this.trudodni.perBuilding.entries()),
        minimumRequired: this.trudodni.minimumRequired,
      },
      fondy: {
        allocated: cloneTransferable(this.fondy.allocated),
        delivered: cloneTransferable(this.fondy.delivered),
        nextDeliveryTick: this.fondy.nextDeliveryTick,
        deliveryInterval: this.fondy.deliveryInterval,
        reliability: this.fondy.reliability,
      },
      blat: { ...this.blat },
      rations: {
        active: this.rations.active,
        rations: {
          worker: { ...this.rations.rations.worker },
          employee: { ...this.rations.rations.employee },
          dependent: { ...this.rations.rations.dependent },
          child: { ...this.rations.rations.child },
        },
      },
      mts: { ...this.mts },
      heating: {
        ...this.heating,
        consumption: { ...this.heating.consumption },
      },
      currencyReforms: this.currencyReforms.map((r) => ({ ...r })),
      era: this.era,
      difficulty: this.difficulty,
    };
  }

  /** Restore an economy system from saved data. */
  static deserialize(data: EconomySaveData): EconomySystem {
    const system = new EconomySystem(data.era, data.difficulty);

    system.trudodni = {
      totalContributed: data.trudodni.totalContributed,
      perBuilding: new Map(data.trudodni.perBuilding),
      minimumRequired: data.trudodni.minimumRequired,
    };

    system.fondy = {
      allocated: cloneTransferable(data.fondy.allocated),
      delivered: cloneTransferable(data.fondy.delivered),
      nextDeliveryTick: data.fondy.nextDeliveryTick,
      deliveryInterval: data.fondy.deliveryInterval,
      reliability: data.fondy.reliability,
    };

    system.blat = { ...data.blat };
    system.rations = {
      active: data.rations.active,
      rations: {
        worker: { ...data.rations.rations.worker },
        employee: { ...data.rations.rations.employee },
        dependent: { ...data.rations.rations.dependent },
        child: { ...data.rations.rations.child },
      },
    };

    system.mts = { ...data.mts };
    system.heating = {
      ...data.heating,
      consumption: { ...data.heating.consumption },
    };
    system.currencyReforms = data.currencyReforms.map((r) => ({ ...r }));

    return system;
  }
}
