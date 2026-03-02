/**
 * @fileoverview EconomyAgent — Planned economy decision-making Yuka agent.
 *
 * Absorbs core decision logic from economy.ts and TrudodniSystem.ts:
 * - Trudodni accrual (7 categories, gender-differentiated, per-building)
 * - Fondy delivery (era-based reliability + interval scheduling)
 * - Blat risk management (safe threshold=15, arrest threshold=30)
 * - Ration card activation (historical periods)
 * - MTS rental decisions (grain multiplier vs cash cost)
 * - Currency reform checks (historical redenominations)
 * - Heating system management (pechka → district → crumbling)
 * - Production chain processing
 * - State machine: NormalOperations → CrisisMode → ReformPeriod
 *
 * Telegrams emitted: FONDY_DELIVERED, BLAT_KGB_RISK, STAKHANOVITE_EVENT,
 *   RATION_ACTIVATED, CURRENCY_REFORM, HEATING_FAILING, MTS_APPLIED
 */

import { Vehicle } from 'yuka';
import { MSG } from '../../telegrams';
import type { GameRng } from '../../../game/SeedSystem';

// Re-export key types from economy.ts for consumers
export type {
  EraId,
  DifficultyLevel,
  TransferableResource,
  FondyConfig,
  FondyState,
  FondyDeliveryResult,
  TrudodniState,
  BlatState,
  BlatPurpose,
  BlatEffect,
  RationTier,
  RationConfig,
  RationState,
  RationDemand,
  StakhanoviteEvent,
  ProductionStep,
  ProductionChain,
  RemainderAllocation,
  MTSResult,
  MTSState,
  HeatingTier,
  HeatingConfig,
  HeatingState,
  HeatingResult,
  CurrencyReform,
  CurrencyReformResult,
  DifficultyMultipliers,
  BlatKgbResult,
  EconomyTickResult,
  ConsumerGoodsState,
  EconomySaveData,
} from './economy-core';

import {
  // Constants
  BLAT_SAFE_THRESHOLD,
  BLAT_ARREST_THRESHOLD,
  KGB_INVESTIGATION_CHANCE_PER_POINT,
  MINIMUM_TRUDODNI_BY_DIFFICULTY,
  TRUDODNI_PER_BUILDING,
  DEFAULT_TRUDODNI,
  FONDY_BY_ERA,
  RATION_PERIODS,
  DEFAULT_RATIONS,
  PRODUCTION_CHAINS,
  MTS_START_YEAR,
  MTS_END_YEAR,
  MTS_DEFAULTS,
  DISTRICT_HEATING_POPULATION,
  DISTRICT_TO_CRUMBLING_TICKS,
  HEATING_CONFIGS,
  CURRENCY_REFORMS,
  STAKHANOVITE_CHANCE,
  DIFFICULTY_MULTIPLIERS,
  ERA_ESCALATION,
  ERA_RESOURCE_MULT,
  DIFFICULTY_QUOTA_MULT,
  DIFFICULTY_RESOURCE_MULT,
  QUOTA_MET_ESCALATION,
  QUOTA_MISSED_REDUCTION,
  // Pure functions
  calculateBuildingTrudodni,
  calculateNextQuota,
  calculateRationDemand,
  calculateStartingResources,
  shouldRationsBeActive,
  shouldMTSBeActive,
  determineHeatingTier,
  getDifficultyMultipliers,
  findPendingReform,
  applyCurrencyReform,
  // Types
  type EraId,
  type DifficultyLevel,
  type TransferableResource,
  type FondyState,
  type FondyDeliveryResult,
  type TrudodniState,
  type BlatState,
  type BlatPurpose,
  type BlatEffect,
  type RationConfig,
  type RationState,
  type RationDemand,
  type StakhanoviteEvent,
  type MTSResult,
  type MTSState,
  type HeatingState,
  type HeatingResult,
  type CurrencyReform,
  type CurrencyReformResult,
  type DifficultyMultipliers,
  type BlatKgbResult,
  type EconomyTickResult,
  type ConsumerGoodsState,
  type EconomySaveData,
  type RemainderAllocation,
} from './economy-core';

import { defaultCategory, TRUDODNI_VALUES } from './trudodni';
import type { MemberRole } from '../../../ecs/world';
import { buildingsLogic, citizens, dvory, getResourceEntity, operationalBuildings } from '../../../ecs/archetypes';

// ---------------------------------------------------------------------------
// Constants (re-exported for consumers)
// ---------------------------------------------------------------------------

export {
  BLAT_SAFE_THRESHOLD,
  BLAT_ARREST_THRESHOLD,
  MINIMUM_TRUDODNI_BY_DIFFICULTY,
  FONDY_BY_ERA,
  RATION_PERIODS,
  HEATING_CONFIGS,
  DISTRICT_HEATING_POPULATION,
  DISTRICT_TO_CRUMBLING_TICKS,
  MTS_START_YEAR,
  MTS_END_YEAR,
  MTS_DEFAULTS,
  CURRENCY_REFORMS,
  STAKHANOVITE_CHANCE,
  DIFFICULTY_MULTIPLIERS,
  ERA_ESCALATION,
};

// ---------------------------------------------------------------------------
// Agent state machine
// ---------------------------------------------------------------------------

/** Economy operational state machine: NormalOperations → CrisisMode → ReformPeriod. */
export type EconomyMode = 'NormalOperations' | 'CrisisMode' | 'ReformPeriod';

/** Thresholds for state machine transitions. */
const CRISIS_BLAT_THRESHOLD = BLAT_ARREST_THRESHOLD; // blat > 30 triggers crisis
const CRISIS_RATION_ACTIVATION = true; // ration activation signals crisis
const REFORM_CURRENCY_TRIGGER = true; // currency reform triggers reform period

const STAKHANOVITE_FIRST_NAMES = [
  'Ivan', 'Pyotr', 'Nikolai', 'Vasily', 'Alexei',
  'Boris', 'Mikhail', 'Sergei', 'Andrei', 'Dmitry',
];
const STAKHANOVITE_LAST_NAMES = [
  'Stakhanov', 'Petrov', 'Ivanov', 'Kozlov', 'Novikov',
  'Morozov', 'Volkov', 'Lebedev', 'Kuznetsov', 'Popov',
];

const ZERO_RESOURCES: Record<TransferableResource, number> = {
  food: 0, vodka: 0, money: 0, steel: 0, timber: 0,
};

const WINTER_MONTHS = new Set([1, 2, 3, 11, 12]);

// ---------------------------------------------------------------------------
// EconomyAgent
// ---------------------------------------------------------------------------

/**
 * EconomyAgent — Yuka Vehicle agent managing all planned economy decisions.
 *
 * Absorbs the EconomySystem class from economy.ts, extending Yuka's Vehicle
 * for compatibility with EntityManager. Manages the full economy tick including
 * trudodni accrual, fondy delivery, blat KGB risk, ration activation,
 * MTS rental, heating management, and currency reforms.
 */
export class EconomyAgent extends Vehicle {
  /** Current era identifier. */
  private era: EraId;
  /** Current difficulty level. */
  private difficulty: DifficultyLevel;
  /** Seeded RNG for deterministic simulation. */
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

  // Currency reforms — own copy so mutations don't affect shared constant
  private reforms: CurrencyReform[];

  // State machine
  private mode: EconomyMode = 'NormalOperations';

  constructor(era: EraId = 'revolution', difficulty: DifficultyLevel = 'comrade') {
    super();
    this.name = 'EconomyAgent';
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

  // ── Yuka Vehicle update ─────────────────────────────────────────────────

  /**
   * Yuka update hook — called each simulation frame by EntityManager.
   * Delegates to the economy tick when invoked directly.
   *
   * @param delta - Frame delta in seconds (not used; economy uses discrete ticks)
   */
  override update(delta: number): this {
    // Yuka lifecycle hook: state machine transitions can run each frame
    this.updateStateMachine();
    return this;
  }

  /**
   * Update economy state machine based on current conditions.
   * Transitions:
   * - NormalOperations → CrisisMode if blat > BLAT_ARREST_THRESHOLD or rations active
   * - CrisisMode → NormalOperations if blat < BLAT_SAFE_THRESHOLD and rations inactive
   * - Any → ReformPeriod if a currency reform is pending (reset to Normal after)
   */
  private updateStateMachine(): void {
    const inCrisis =
      this.blat.connections > CRISIS_BLAT_THRESHOLD || this.rations.active;

    switch (this.mode) {
      case 'NormalOperations':
        if (inCrisis) this.mode = 'CrisisMode';
        break;
      case 'CrisisMode':
        if (!inCrisis) this.mode = 'NormalOperations';
        break;
      case 'ReformPeriod':
        // Auto-exit ReformPeriod after one tick (triggered by currency reform)
        this.mode = inCrisis ? 'CrisisMode' : 'NormalOperations';
        break;
    }
  }

  // ── RNG ────────────────────────────────────────────────────────────────────

  /** Set the seeded RNG for deterministic random checks. */
  setRng(rng: GameRng): void {
    this.rng = rng;
  }

  private rand(): number {
    return this.rng ? this.rng.random() : Math.random();
  }

  private pickIndex(length: number): number {
    return this.rng ? this.rng.pickIndex(length) : Math.floor(Math.random() * length);
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

  getMode(): EconomyMode {
    return this.mode;
  }

  // ── Trudodni ───────────────────────────────────────────────────────────────

  /**
   * Accrue trudodni for a building and all its workers.
   *
   * @param key - Unique key for this building (e.g., "gridX,gridY")
   * @param defId - Building definition ID (used to look up trudodni rate)
   * @param workers - Number of workers assigned
   */
  recordTrudodni(key: string, defId: string, workers: number): void {
    const earned = calculateBuildingTrudodni(defId, workers);
    this.trudodniTotal += earned;
    const existing = this.trudodniPerBuilding.get(key) ?? 0;
    this.trudodniPerBuilding.set(key, existing + earned);
  }

  /**
   * Accrue monthly trudodni from ECS dvor/citizen data.
   *
   * For each citizen entity linked to a dvor with an assignment, calculates
   * trudodni based on gender and role (7-category system), updates member
   * trudodniEarned, and accumulates per-building totals.
   *
   * @returns Total trudodni accrued and number of members processed
   */
  accrueTrudodniFromDvory(): { totalTrudodni: number; memberCount: number } {
    // In aggregate mode (raion pool defined), citizen entities do not exist.
    // Trudodni is tracked per-building via building.trudodniAccrued instead.
    const resources = getResourceEntity()?.resources;
    if (resources?.raion) {
      let totalTrudodni = 0;
      let buildingCount = 0;
      for (const entity of operationalBuildings.entities) {
        const bldg = entity.building;
        const accrued = bldg.trudodniAccrued;
        if (accrued > 0) {
          const pos = entity.position;
          const buildingId = `${pos.x},${pos.y}`;
          this.trudodniPerBuilding.set(
            buildingId,
            (this.trudodniPerBuilding.get(buildingId) ?? 0) + accrued,
          );
          totalTrudodni += accrued;
          buildingCount++;
        }
      }
      this.trudodniTotal += totalTrudodni;
      return { totalTrudodni, memberCount: buildingCount };
    }

    let totalTrudodni = 0;
    let memberCount = 0;

    const citizenLookup = new Map<string, { gender: 'male' | 'female'; assignment?: string }>();
    for (const entity of citizens) {
      const c = entity.citizen;
      if (c.dvorId && c.dvorMemberId && c.gender) {
        citizenLookup.set(`${c.dvorId}:${c.dvorMemberId}`, {
          gender: c.gender,
          assignment: c.assignment,
        });
      }
    }

    const DAYS_PER_MONTH = 26; // 6-day work week
    for (const entity of dvory) {
      const dvor = entity.dvor;
      for (const member of dvor.members) {
        const citizenInfo = citizenLookup.get(`${dvor.id}:${member.id}`);
        if (!citizenInfo || !citizenInfo.assignment) continue;

        const category = defaultCategory(member.gender, member.role as MemberRole);
        const monthlyTrudodni = TRUDODNI_VALUES[category] * DAYS_PER_MONTH;

        member.trudodniEarned += monthlyTrudodni;
        totalTrudodni += monthlyTrudodni;
        memberCount++;

        const buildingId = citizenInfo.assignment;
        this.trudodniPerBuilding.set(
          buildingId,
          (this.trudodniPerBuilding.get(buildingId) ?? 0) + monthlyTrudodni,
        );
      }
    }

    this.trudodniTotal += totalTrudodni;
    return { totalTrudodni, memberCount };
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

  /**
   * Attempt a fondy delivery if the scheduled tick has passed.
   *
   * Delivery succeeds based on era reliability. If successful, delivers
   * 70-100% of allocated amounts (random quantity roll).
   *
   * @param tick - Current simulation tick
   * @returns Delivery result, or null if not scheduled this tick
   */
  processDelivery(tick: number): FondyDeliveryResult | null {
    if (tick < this.fondy.nextDeliveryTick) return null;

    const delivered = this.rand() < this.fondy.reliability;

    let actualDelivered: Record<TransferableResource, number>;
    let reason: string;

    if (delivered) {
      const quantity = 0.7 + this.rand() * 0.3;
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

  /**
   * Spend blat connections for a specific purpose.
   *
   * Purposes:
   * - improve_delivery: +5% fondy reliability
   * - reduce_quota: returns effect for SimulationEngine to apply
   * - kgb_protection: temporary KGB threat reduction
   * - consumer_goods: boost consumer goods availability
   * - trading: favorable trade terms (money bonus)
   *
   * KGB detection risk: 2% per point above threshold of 5.
   *
   * @param amount - Blat points to spend
   * @param purpose - What the blat is being used for
   */
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
        this.fondy.reliability = Math.min(1.0, this.fondy.reliability + 0.05);
        effect = { type: 'improve_delivery', value: 0.05 };
        break;
      case 'reduce_quota':
        effect = { type: 'reduce_quota', value: amount * 0.05 };
        break;
      case 'kgb_protection':
        effect = { type: 'kgb_protection', value: amount * 2 };
        break;
      case 'consumer_goods':
        this.consumerGoods.available += amount * 5;
        effect = { type: 'consumer_goods', value: amount * 5 };
        break;
      case 'trading':
        effect = { type: 'trading', value: amount * 10 };
        break;
    }

    // KGB detection: 2% per point above threshold of 5
    const kgbThreshold = 5;
    let kgbDetected = false;
    if (amount > kgbThreshold) {
      const excessPoints = amount - kgbThreshold;
      const detectionChance = excessPoints * 0.02;
      if (this.rand() < detectionChance) {
        kgbDetected = true;
      }
    }

    return { success: true, kgbDetected, effect };
  }

  /**
   * Passive per-tick KGB risk from accumulated blat connections.
   *
   * - Below BLAT_SAFE_THRESHOLD (15): safe
   * - Above threshold: 1% investigation chance per excess point per tick
   * - Above BLAT_ARREST_THRESHOLD (30): additional 1% arrest chance per tick
   *
   * Requires seeded RNG for deterministic checks.
   */
  checkBlatKgbRisk(): BlatKgbResult | null {
    const connections = this.blat.connections;
    if (connections <= BLAT_SAFE_THRESHOLD) return null;
    if (!this.rng) return null;

    const excessPoints = connections - BLAT_SAFE_THRESHOLD;
    const investigationChance = Math.min(1, excessPoints * KGB_INVESTIGATION_CHANCE_PER_POINT);

    let investigated = false;
    let arrested = false;
    let announcement: string | null = null;

    if (this.rand() < investigationChance) {
      investigated = true;
      announcement =
        'KGB Report: Citizen has been observed maintaining suspiciously ' +
        'extensive personal connections. An investigation has been opened.';
    }

    if (connections > BLAT_ARREST_THRESHOLD && this.rand() < 0.01) {
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

  /**
   * Check for a Stakhanovite event at any building.
   *
   * Low probability (0.5%) per tick. If triggered, generates a named worker
   * with a production boost (1.5-4.0x), propaganda value, and quota increase.
   *
   * @param buildingDefIds - Currently placed building defIds
   */
  checkStakhanovite(buildingDefIds: string[]): StakhanoviteEvent | null {
    if (buildingDefIds.length === 0) return null;
    if (this.rand() >= STAKHANOVITE_CHANCE) return null;

    const building = buildingDefIds[this.pickIndex(buildingDefIds.length)]!;
    const firstName = STAKHANOVITE_FIRST_NAMES[this.pickIndex(STAKHANOVITE_FIRST_NAMES.length)]!;
    const lastName = STAKHANOVITE_LAST_NAMES[this.pickIndex(STAKHANOVITE_LAST_NAMES.length)]!;
    const workerName = `${firstName} ${lastName}`;

    const productionBoost = 1.5 + this.rand() * 2.5;
    const propagandaValue = Math.round(10 + this.rand() * 40);
    const quotaIncrease = 0.15 + this.rand() * 0.1;

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

  /**
   * Decide whether to apply MTS (Machine-Tractor Station) rental this tick.
   *
   * MTS was active 1928-1958. If active and funds are available, deducts
   * rental cost and returns a grain production multiplier of 1.3x.
   *
   * @param year - Current game year
   * @param money - Current money available
   */
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

  /**
   * Process heating system for the current tick.
   *
   * Determines tier based on population and repair age:
   * - pechka (wood stove): default, low population
   * - district: 100+ population, modern infrastructure
   * - crumbling: district tier degraded after 1000 ticks without repair
   *
   * During winter months (1,2,3,11,12), consumes fuel. Without fuel,
   * population is at risk proportional to heating inefficiency.
   *
   * @param population - Current population
   * @param month - Current month (1-12)
   * @param hasHeatingResource - Whether fuel resource is available
   */
  processHeating(population: number, month: number, hasHeatingResource: boolean): HeatingResult {
    const newTier = determineHeatingTier(population, this.heating.ticksSinceRepair, this.heating.tier);
    this.heating.tier = newTier;
    this.heating.efficiency = HEATING_CONFIGS[newTier].baseEfficiency;

    if (newTier === 'district' || newTier === 'crumbling') {
      this.heating.ticksSinceRepair++;
    }

    const isWinter = WINTER_MONTHS.has(month);
    const operational = hasHeatingResource;
    let populationAtRisk = 0;
    let fuelConsumed: HeatingResult['fuelConsumed'] = null;

    if (isWinter) {
      if (operational) {
        const cfg = HEATING_CONFIGS[newTier];
        fuelConsumed = { resource: cfg.consumption.resource, amount: cfg.consumption.amount };
        this.heating.failing = false;
      } else {
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

  /**
   * Check for and apply any pending historical currency reforms.
   *
   * Historical redenominations (1924 Chervonets, 1947 Post-War, 1961 Khrushchev,
   * 1991 Pavlov confiscation). Marks reforms as applied once processed.
   *
   * @param year - Current game year
   * @param money - Current money balance
   */
  checkCurrencyReform(year: number, money: number): CurrencyReformResult | null {
    const pending = findPendingReform(this.reforms, year);
    if (!pending) return null;

    const result = applyCurrencyReform(money, pending);
    pending.applied = true;

    // Currency reform triggers ReformPeriod state
    this.mode = 'ReformPeriod';

    return {
      reform: {
        ...pending,
        confiscation: pending.confiscation ? { ...pending.confiscation } : undefined,
      },
      ...result,
    };
  }

  /**
   * Pre-mark currency reforms that occurred before the game's starting year.
   * Call after construction when starting a game at a later historical date.
   */
  markReformsBeforeYear(startYear: number): void {
    for (const reform of this.reforms) {
      if (reform.year < startYear) {
        reform.applied = true;
      }
    }
  }

  // ── Consumer Goods ──────────────────────────────────────────────────────

  tickConsumerGoods(population: number, settlementTier: string): void {
    if (settlementTier !== 'pgt' && settlementTier !== 'gorod') {
      this.consumerGoods.satisfaction = 0;
      return;
    }

    this.consumerGoods.demand = population * 0.5;
    const blatBonus = this.blat.connections * 0.5;
    this.consumerGoods.available = 20 + blatBonus;
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
   * Process production chains — multi-step resource conversion.
   *
   * Checks each chain's building requirements and input availability.
   * If all conditions met, consumes inputs and produces outputs.
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
      let canExecute = true;
      for (const step of chain.steps) {
        if (!buildingSet.has(step.building)) {
          canExecute = false;
          break;
        }
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

      for (const step of chain.steps) {
        for (const [resource, amount] of Object.entries(step.input)) {
          (resources as Record<string, number>)[resource] = Math.max(
            0,
            ((resources as Record<string, number>)[resource] ?? 0) - amount,
          );
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

  // ── Main Economy Tick ──────────────────────────────────────────────────────

  /**
   * Run a full economy tick, orchestrating all subsystems.
   *
   * Called each simulation tick with current game state. Processes:
   * 1. Trudodni accrual for each building
   * 2. Fondy delivery check
   * 3. Stakhanovite event check
   * 4. Ration activation
   * 5. MTS rental decision
   * 6. Heating management
   * 7. Currency reform check
   * 8. Blat KGB risk assessment
   * 9. State machine update
   *
   * @param currentTick - Current simulation tick number
   * @param year - Current game year
   * @param population - Current population
   * @param buildingDefIds - List of placed building defIds
   * @param options - Additional context (money, month, heating resource)
   */
  economyTick(
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

    // Trudodni — accrue for each building
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

    // Blat KGB risk
    const blatKgbResult = this.checkBlatKgbRisk();

    // State machine update
    this.updateStateMachine();

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

  // ── Apply Tick Results (absorbs SimulationEngine.tickEconomySystem) ───────

  /**
   * Run full economy tick and apply all side effects.
   * Absorbs SimulationEngine.tickEconomySystem() orchestration logic.
   *
   * Performs the complete economy cycle:
   * 1. Reads ECS resource store and building state
   * 2. Runs economyTick() internally
   * 3. Applies fondy material deliveries to ECS resources
   * 4. Applies remainder allocation (70/30 split)
   * 5. Syncs trudodni/blat to ECS
   * 6. Handles currency reform (callbacks)
   * 7. Handles stakhanovite events (callbacks, quota modification, KGB commendation)
   * 8. Handles MTS farm productivity (store multiplier, deduct cost)
   * 9. Handles ration card deductions (food/vodka consumption, worker deaths)
   * 10. Handles heating (fuel deduction, population attrition)
   * 11. Handles blat KGB risk (investigation/arrest marks)
   * 12. Handles consumer goods tick
   *
   * @param deps - External dependencies injected from SimulationEngine
   * @returns Object containing mtsGrainMultiplier for next tick's farm modifier
   */
  public applyTickResults(deps: {
    chronology: { getDate(): { totalTicks: number; year: number; month: number } };
    workers: { removeWorkersByCount(count: number, reason: string): void };
    kgb: {
      addMark(reason: string, tick: number, desc: string): void;
      addCommendation(reason: string, tick: number, desc: string): void;
    };
    callbacks: {
      onToast: (msg: string, severity?: string) => void;
      onAdvisor: (msg: string) => void;
      onPravda: (msg: string) => void;
    };
    quota: { target: number };
    settlement: { getCurrentTier(): string };
    stakhanoviteBoosts: Map<string, number>;
  }): { mtsGrainMultiplier: number } {
    const store = getResourceEntity();
    if (!store) return { mtsGrainMultiplier: 1.0 };

    const r = store.resources;
    const date = deps.chronology.getDate();
    const totalTicks = date.totalTicks;
    const year = date.year;
    const month = date.month;

    // Gather building defIds from ECS
    const buildingDefIds: string[] = [];
    for (const entity of buildingsLogic) {
      buildingDefIds.push(entity.building.defId);
    }

    // Determine whether the settlement has heating fuel (timber > 0 or power surplus)
    const hasHeatingResource = r.timber > 0 || r.power > r.powerUsed;

    // Run the core economy tick
    const result = this.economyTick(totalTicks, year, r.population, buildingDefIds, {
      money: r.money,
      month,
      hasHeatingResource,
    });

    // Apply fondy material deliveries to ECS resources
    if (result.fondyDelivered?.delivered) {
      const delivered = result.fondyDelivered.actualDelivered;
      r.timber += delivered.timber;
      r.steel += delivered.steel;
      r.money += delivered.money;
      r.food += delivered.food;
      r.vodka += delivered.vodka;
    }

    // Remainder allocation — distribute surplus after compulsory deliveries
    // 70% goes to local distribution, 30% reserved for next tick
    if (result.fondyDelivered?.delivered) {
      const delivered = result.fondyDelivered.actualDelivered;
      const surplus = {
        food: Math.max(0, delivered.food * 0.3),
        vodka: Math.max(0, delivered.vodka * 0.3),
        money: Math.max(0, delivered.money * 0.3),
        steel: Math.max(0, delivered.steel * 0.3),
        timber: Math.max(0, delivered.timber * 0.3),
      };
      const remainder = this.allocateRemainder(surplus);
      // Apply distributed portion directly to resources
      r.food += remainder.distributed.food;
      r.vodka += remainder.distributed.vodka;
      r.money += remainder.distributed.money;
      r.steel += remainder.distributed.steel;
      r.timber += remainder.distributed.timber;
    }

    // Sync trudodni and blat to ECS
    r.trudodni += result.trudodniEarned;
    r.blat = result.blatLevel;

    // Apply currency reform (money transformation)
    if (result.currencyReform) {
      r.money = result.currencyReform.moneyAfter;
      const reformName = result.currencyReform.reform.name;
      deps.callbacks.onToast(`CURRENCY REFORM: ${reformName}`, 'critical');
      deps.callbacks.onAdvisor(
        `Comrade, the State has enacted the ${reformName}. ` +
          `Your treasury has been adjusted from ${Math.round(result.currencyReform.moneyBefore)} ` +
          `to ${Math.round(result.currencyReform.moneyAfter)} rubles.`,
      );
    }

    // Stakhanovite event — apply all effects
    let mtsGrainMultiplier = 1.0;
    if (result.stakhanovite) {
      const s = result.stakhanovite;
      deps.callbacks.onPravda(
        `HERO OF LABOR: Comrade ${s.workerName} at ${s.building} exceeds quota by ${Math.round((s.productionBoost - 1) * 100)}%!`,
      );

      // Apply production boost — store for next tick's production calculation
      deps.stakhanoviteBoosts.set(s.building, s.productionBoost);

      // Apply quota increase — raise current plan targets
      deps.quota.target = Math.round(deps.quota.target * (1 + s.quotaIncrease));

      // Apply propaganda value — grant commendation for high propaganda
      if (s.propagandaValue >= 30) {
        deps.kgb.addCommendation('stakhanovite_celebrated', totalTicks, s.announcement);
      }
    } else {
      // Clear stakhanovite boosts when no event active
      deps.stakhanoviteBoosts.clear();
    }

    // MTS farm productivity — store grain multiplier for next tick's farmMod
    if (result.mtsResult?.applied) {
      r.money = Math.max(0, r.money - result.mtsResult.cost);
      mtsGrainMultiplier = result.mtsResult.grainMultiplier;
    }

    // Ration card deductions — consume food/vodka based on ration demand
    if (result.rationDemand && result.rationsActive) {
      const demand = result.rationDemand;
      if (demand.food > 0) {
        if (r.food >= demand.food) {
          r.food -= demand.food;
        } else {
          // Insufficient food for rations — starvation penalty
          const deficit = demand.food - r.food;
          r.food = 0;
          const starvationLosses = Math.ceil(deficit * 0.1);
          // Route ration starvation through WorkerSystem with dvor cleanup
          deps.workers.removeWorkersByCount(starvationLosses, 'ration_starvation');
          deps.callbacks.onToast('RATION SHORTAGE: Insufficient food for card holders', 'critical');
        }
      }
      if (demand.vodka > 0) {
        r.vodka = Math.max(0, r.vodka - demand.vodka);
        // No death from vodka shortage — citizens merely suffer
      }
    }

    // Heating — fuel consumption + at-risk population
    if (result.heatingResult) {
      // Deduct fuel consumed by the heating system (timber for pechka, power for district/crumbling)
      const fuel = result.heatingResult.fuelConsumed;
      if (fuel) {
        if (fuel.resource === 'timber') {
          r.timber = Math.max(0, r.timber - fuel.amount);
        }
        // Power is consumed implicitly via powerUsed; no deduction needed here
      }

      // Non-operational heating in winter causes population attrition
      if (!result.heatingResult.operational) {
        const atRisk = result.heatingResult.populationAtRisk;
        if (atRisk > 0) {
          const losses = Math.ceil(atRisk * 0.01); // 1% of at-risk pop per tick
          deps.workers.removeWorkersByCount(losses, 'heating_failure');
        }
      }
    }

    // Blat KGB risk — passive investigation/arrest from high connections
    if (result.blatKgbResult) {
      const kgb = result.blatKgbResult;
      if (kgb.investigated) {
        deps.kgb.addMark(
          'blat_noticed',
          totalTicks,
          kgb.announcement ?? 'KGB investigation into blat connections',
        );
        deps.callbacks.onToast('KGB INVESTIGATION: Blat connections noticed', 'critical');
      }
      if (kgb.arrested) {
        deps.kgb.addMark(
          'blat_noticed',
          totalTicks,
          kgb.announcement ?? 'Arrested for anti-Soviet networking activities',
        );
        deps.callbacks.onAdvisor(
          'Comrade, your extensive network of personal favors has attracted ' +
            'unwelcome attention from the organs of state security. ' +
            'Perhaps fewer friends would be safer.',
        );
      }
    }

    // Consumer goods — satisfaction from blat + settlement tier
    const settlementTier = deps.settlement.getCurrentTier();
    this.tickConsumerGoods(r.population, settlementTier);

    return { mtsGrainMultiplier };
  }

  // ── Serialization ──────────────────────────────────────────────────────────

  /** Serialize full economy state for save/load. */
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

  /** Restore EconomyAgent from serialized save data. */
  static deserialize(data: EconomySaveData): EconomyAgent {
    const agent = new EconomyAgent(data.era, data.difficulty);

    // Restore trudodni
    agent.trudodniTotal = data.trudodni.totalContributed;
    agent.trudodniPerBuilding = new Map(data.trudodni.perBuilding);
    agent.trudodniMinimum = data.trudodni.minimumRequired;

    // Restore fondy
    agent.fondy.reliability = data.fondy.reliability;
    agent.fondy.deliveryInterval = data.fondy.deliveryInterval;
    agent.fondy.interval = data.fondy.deliveryInterval;
    agent.fondy.allocated = { ...data.fondy.allocated };
    agent.fondy.nextDeliveryTick = data.fondy.nextDeliveryTick;

    // Restore blat
    agent.blat.connections = data.blat.connections;
    agent.blat.totalSpent = data.blat.totalSpent;
    agent.blat.totalEarned = data.blat.totalEarned;

    // Restore rations
    agent.rations.active = data.rations.active;
    agent.rations.rations = deepCloneRationConfig(data.rations.rations);

    // Restore MTS
    if (data.mts) {
      agent.mts.active = data.mts.active;
      agent.mts.totalRentalSpent = data.mts.totalRentalSpent;
      agent.mts.tractorUnits = data.mts.tractorUnits;
    }

    // Restore heating
    if (data.heating) {
      agent.heating.tier = data.heating.tier;
      agent.heating.ticksSinceRepair = data.heating.ticksSinceRepair;
      agent.heating.efficiency = data.heating.efficiency;
      agent.heating.failing = data.heating.failing;
    }

    // Restore currency reforms
    if (data.currencyReforms) {
      agent.reforms = data.currencyReforms.map((r) => ({
        ...r,
        confiscation: r.confiscation ? { ...r.confiscation } : undefined,
      }));
    }

    // Restore consumer goods
    if (data.consumerGoods) {
      agent.consumerGoods = { ...data.consumerGoods };
    }

    return agent;
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

// ─────────────────────────────────────────────────────────────────────────────
//  RE-EXPORT pure functions for consumers that used economy.ts directly
// ─────────────────────────────────────────────────────────────────────────────

export {
  calculateBuildingTrudodni,
  calculateNextQuota,
  calculateRationDemand,
  calculateStartingResources,
  shouldRationsBeActive,
  shouldMTSBeActive,
  determineHeatingTier,
  getDifficultyMultipliers,
  findPendingReform,
  applyCurrencyReform,
  TRUDODNI_PER_BUILDING,
  DEFAULT_TRUDODNI,
  QUOTA_MET_ESCALATION,
  QUOTA_MISSED_REDUCTION,
  DIFFICULTY_QUOTA_MULT,
  DIFFICULTY_RESOURCE_MULT,
  ERA_RESOURCE_MULT,
  DEFAULT_RATIONS,
  PRODUCTION_CHAINS,
};

/** Backward-compat alias: EconomySystem is now EconomyAgent. */
export { EconomyAgent as EconomySystem };

// Re-export trudodni tracking functions (from trudodni.ts, originally TrudodniSystem.ts)
export { TRUDODNI_VALUES, defaultCategory };
export {
  accrueTrudodni,
  resetBuildingTrudodni,
  getBuildingTrudodni,
  getAllBuildingTrudodni,
  type TrudodniCategory,
  type TrudodniAccrualResult,
} from './trudodni';
