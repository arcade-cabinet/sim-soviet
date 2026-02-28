/**
 * @module game/political/doctrine
 *
 * DOCTRINE SIGNATURE MECHANICS
 *
 * Each era has unique gameplay mechanics from its political doctrine:
 *
 * 1. **War Communism / Revolution (1917-1922)**: Forced grain requisitioning —
 *    all food production goes to state first. Workers get only leftovers.
 *
 * 2. **Collectivization (1922-1932)**: Private plot seizure — periodic
 *    redistribution of privately-held food, occasional population resistance.
 *
 * 3. **Industrialization (1932-1941)**: Stakhanovite quota bonus system —
 *    workers who exceed quota get bonuses, but others face pressure.
 *
 * 4. **Great Patriotic War (1941-1945)**: Military mobilization —
 *    50% workforce conscription, wartime production bonuses.
 *
 * These mechanics apply composable effects each tick when their era is active.
 */

import type { GameRng } from '@/game/SeedSystem';
import type { DoctrineMechanicConfig, DoctrineMechanicEffect, DoctrineMechanicId } from './types';

// ─── Mechanic Configurations ────────────────────────────────────────────────

export const DOCTRINE_MECHANICS: Record<DoctrineMechanicId, DoctrineMechanicConfig> = {
  grain_requisitioning: {
    id: 'grain_requisitioning',
    activeEras: ['revolution'],
    intervalTicks: 30, // Every month
  },
  collectivization_seizure: {
    id: 'collectivization_seizure',
    activeEras: ['collectivization'],
    intervalTicks: 90, // Every quarter
  },
  stakhanovite_bonus: {
    id: 'stakhanovite_bonus',
    activeEras: ['industrialization', 'reconstruction', 'thaw_and_freeze'],
    intervalTicks: 30, // Monthly
  },
  wartime_conscription: {
    id: 'wartime_conscription',
    activeEras: ['great_patriotic'],
    intervalTicks: 60, // Bi-monthly
  },
};

// ─── Mechanic Constants ─────────────────────────────────────────────────────

/** Fraction of food requisitioned during War Communism. */
const GRAIN_REQUISITION_RATE = 0.3;

/** Fraction of food seized during collectivization events. */
const COLLECTIVIZATION_SEIZURE_RATE = 0.15;

/** Chance of resistance during collectivization (pop loss). */
const COLLECTIVIZATION_RESISTANCE_CHANCE = 0.2;

/** Stakhanovite production bonus when workers exceed quota. */
const STAKHANOVITE_PRODUCTION_BONUS = 0.15;

/** Stakhanovite pressure penalty on non-Stakhanovites. */
const STAKHANOVITE_PRESSURE_PENALTY = 0.05;

/** Fraction of population available for wartime conscription. */
const WARTIME_CONSCRIPTION_RATE = 0.05;

/** Production bonus during wartime (patriotic fervor). */
const WARTIME_PRODUCTION_BONUS = 0.1;

// ─── Mechanic Implementations ───────────────────────────────────────────────

/**
 * War Communism: Forced grain requisitioning.
 * All food production goes to the state first. Citizens get leftovers.
 */
function applyGrainRequisitioning(currentFood: number, rng: GameRng): DoctrineMechanicEffect {
  const foodTaken = Math.floor(currentFood * GRAIN_REQUISITION_RATE);

  return {
    mechanicId: 'grain_requisitioning',
    description: `Prodrazvyorstka: ${foodTaken} food requisitioned for the revolutionary cause.`,
    foodDelta: -foodTaken,
    moneyDelta: 0,
    vodkaDelta: 0,
    popDelta: 0,
    productionMult: 1.0,
  };
}

/**
 * Collectivization: Private plot seizure.
 * Periodic food redistribution with chance of resistance.
 */
function applyCollectivizationSeizure(
  currentFood: number,
  currentPop: number,
  rng: GameRng,
): DoctrineMechanicEffect {
  const foodSeized = Math.floor(currentFood * COLLECTIVIZATION_SEIZURE_RATE);

  // Chance of resistance causing population loss (kulak resistance)
  let popLoss = 0;
  if (currentPop > 10 && rng.coinFlip(COLLECTIVIZATION_RESISTANCE_CHANCE)) {
    popLoss = rng.int(1, Math.max(1, Math.floor(currentPop * 0.02)));
  }

  const desc = popLoss > 0
    ? `Collectivization: ${foodSeized} food seized. ${popLoss} kulak${popLoss > 1 ? 's' : ''} resisted and were dealt with.`
    : `Collectivization: ${foodSeized} food redistributed to the collective.`;

  return {
    mechanicId: 'collectivization_seizure',
    description: desc,
    foodDelta: -foodSeized,
    moneyDelta: Math.floor(foodSeized * 0.3), // Some monetary value from seizure
    vodkaDelta: 0,
    popDelta: -popLoss,
    productionMult: 1.0,
  };
}

/**
 * Industrialization: Stakhanovite quota bonus system.
 * Workers who exceed quota get bonuses; others face increased pressure.
 */
function applyStakhanoviteBonus(quotaProgress: number, rng: GameRng): DoctrineMechanicEffect {
  // If quota progress is ahead of schedule (> 0.5 normalized), bonus applies
  const aheadOfSchedule = quotaProgress > 0.5;

  if (aheadOfSchedule) {
    return {
      mechanicId: 'stakhanovite_bonus',
      description: 'Stakhanovite movement: Workers exceed norms. Production bonus applied.',
      foodDelta: 0,
      moneyDelta: rng.int(5, 15),
      vodkaDelta: rng.int(1, 5),
      popDelta: 0,
      productionMult: 1.0 + STAKHANOVITE_PRODUCTION_BONUS,
    };
  }

  return {
    mechanicId: 'stakhanovite_bonus',
    description: 'Workers fall short of Stakhanovite norms. Pressure increases.',
    foodDelta: 0,
    moneyDelta: 0,
    vodkaDelta: 0,
    popDelta: 0,
    productionMult: 1.0 - STAKHANOVITE_PRESSURE_PENALTY,
  };
}

/**
 * Great Patriotic War: Military mobilization.
 * Periodic conscription of workforce with wartime production bonus.
 */
function applyWartimeConscription(currentPop: number, rng: GameRng): DoctrineMechanicEffect {
  const conscripted = Math.max(1, Math.floor(currentPop * WARTIME_CONSCRIPTION_RATE));

  return {
    mechanicId: 'wartime_conscription',
    description: `The Motherland calls: ${conscripted} worker${conscripted > 1 ? 's' : ''} mobilized for the front.`,
    foodDelta: 0,
    moneyDelta: 0,
    vodkaDelta: 0,
    popDelta: -conscripted,
    productionMult: 1.0 + WARTIME_PRODUCTION_BONUS, // Patriotic fervor
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** Context needed to evaluate doctrine mechanics. */
export interface DoctrineContext {
  currentEraId: string;
  totalTicks: number;
  currentFood: number;
  currentPop: number;
  currentMoney: number;
  /** Quota progress as a fraction (0-1). */
  quotaProgress: number;
  rng: GameRng;
}

/**
 * Evaluate all active doctrine mechanics for the current era.
 * Returns an array of effects to apply.
 */
export function evaluateDoctrineMechanics(ctx: DoctrineContext): DoctrineMechanicEffect[] {
  const effects: DoctrineMechanicEffect[] = [];

  for (const config of Object.values(DOCTRINE_MECHANICS)) {
    // Skip mechanics not active in the current era
    if (!config.activeEras.includes(ctx.currentEraId)) continue;

    // Check interval
    if (config.intervalTicks > 0 && ctx.totalTicks % config.intervalTicks !== 0) continue;

    const effect = applyMechanic(config.id, ctx);
    if (effect) {
      effects.push(effect);
    }
  }

  return effects;
}

/** Apply a single doctrine mechanic and return its effect. */
function applyMechanic(mechanicId: DoctrineMechanicId, ctx: DoctrineContext): DoctrineMechanicEffect | null {
  switch (mechanicId) {
    case 'grain_requisitioning':
      return applyGrainRequisitioning(ctx.currentFood, ctx.rng);
    case 'collectivization_seizure':
      return applyCollectivizationSeizure(ctx.currentFood, ctx.currentPop, ctx.rng);
    case 'stakhanovite_bonus':
      return applyStakhanoviteBonus(ctx.quotaProgress, ctx.rng);
    case 'wartime_conscription':
      return ctx.currentPop > 10 ? applyWartimeConscription(ctx.currentPop, ctx.rng) : null;
    default:
      return null;
  }
}

/**
 * Get the composable policy effects for a given era's doctrine.
 * Returns production/consumption multipliers and building gates.
 */
export interface DoctrinePolicy {
  /** Production multiplier from doctrine (stacks with era modifiers). */
  productionMult: number;
  /** Consumption multiplier from doctrine. */
  consumptionMult: number;
  /** Whether private gardens are allowed. */
  privateGardensAllowed: boolean;
  /** Whether black market is tolerated. */
  blackMarketTolerated: boolean;
}

const DOCTRINE_POLICIES: Record<string, DoctrinePolicy> = {
  revolution: {
    productionMult: 0.8,
    consumptionMult: 1.2,
    privateGardensAllowed: true, // NEP remnants
    blackMarketTolerated: true,
  },
  collectivization: {
    productionMult: 0.9,
    consumptionMult: 1.0,
    privateGardensAllowed: false, // Collectivized
    blackMarketTolerated: false,
  },
  industrialization: {
    productionMult: 1.1,
    consumptionMult: 1.0,
    privateGardensAllowed: false,
    blackMarketTolerated: false,
  },
  great_patriotic: {
    productionMult: 0.7,
    consumptionMult: 1.5,
    privateGardensAllowed: true, // Desperate times
    blackMarketTolerated: true,
  },
  reconstruction: {
    productionMult: 1.0,
    consumptionMult: 0.9,
    privateGardensAllowed: true,
    blackMarketTolerated: false,
  },
  thaw_and_freeze: {
    productionMult: 1.1,
    consumptionMult: 0.9,
    privateGardensAllowed: true,
    blackMarketTolerated: true,
  },
  stagnation: {
    productionMult: 0.9,
    consumptionMult: 1.1,
    privateGardensAllowed: true,
    blackMarketTolerated: true,
  },
  the_eternal: {
    productionMult: 1.0,
    consumptionMult: 1.0,
    privateGardensAllowed: true,
    blackMarketTolerated: true,
  },
};

/** Default policy for unknown eras. */
const DEFAULT_POLICY: DoctrinePolicy = {
  productionMult: 1.0,
  consumptionMult: 1.0,
  privateGardensAllowed: false,
  blackMarketTolerated: false,
};

/** Get the doctrine policy for a given era. */
export function getDoctrinePolicyForEra(eraId: string): DoctrinePolicy {
  return DOCTRINE_POLICIES[eraId] ?? DEFAULT_POLICY;
}
