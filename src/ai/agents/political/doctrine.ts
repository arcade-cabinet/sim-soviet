/**
 * @module ai/agents/political/doctrine
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

import { political } from '@/config';
import type { GameRng } from '@/game/SeedSystem';
import type { DoctrineMechanicConfig, DoctrineMechanicEffect, DoctrineMechanicId } from './types';

const dcfg = political.doctrine;

// ─── Mechanic Configurations ────────────────────────────────────────────────

/** Configuration for each doctrine signature mechanic keyed by mechanic ID. */
export const DOCTRINE_MECHANICS: Record<DoctrineMechanicId, DoctrineMechanicConfig> = {
  grain_requisitioning: {
    id: 'grain_requisitioning',
    activeEras: ['revolution'],
    intervalTicks: dcfg.mechanicIntervals.grain_requisitioning,
  },
  collectivization_seizure: {
    id: 'collectivization_seizure',
    activeEras: ['collectivization'],
    intervalTicks: dcfg.mechanicIntervals.collectivization_seizure,
  },
  stakhanovite_bonus: {
    id: 'stakhanovite_bonus',
    activeEras: ['industrialization', 'reconstruction', 'thaw_and_freeze'],
    intervalTicks: dcfg.mechanicIntervals.stakhanovite_bonus,
  },
  wartime_conscription: {
    id: 'wartime_conscription',
    activeEras: ['great_patriotic'],
    intervalTicks: dcfg.mechanicIntervals.wartime_conscription,
  },
  thaw_freeze_oscillation: {
    id: 'thaw_freeze_oscillation',
    activeEras: ['thaw_and_freeze'],
    intervalTicks: dcfg.mechanicIntervals.thaw_freeze_oscillation,
  },
  stagnation_rot: {
    id: 'stagnation_rot',
    activeEras: ['stagnation'],
    intervalTicks: dcfg.mechanicIntervals.stagnation_rot,
  },
  eternal_bureaucracy: {
    id: 'eternal_bureaucracy',
    activeEras: ['the_eternal'],
    intervalTicks: dcfg.mechanicIntervals.eternal_bureaucracy,
  },
};

// ─── Mechanic Constants ─────────────────────────────────────────────────────

/** Fraction of food requisitioned during War Communism. */
const GRAIN_REQUISITION_RATE = dcfg.grainRequisitionRate;

/** Fraction of food seized during collectivization events. */
const COLLECTIVIZATION_SEIZURE_RATE = dcfg.collectivizationSeizureRate;

/** Chance of resistance during collectivization (pop loss). */
const COLLECTIVIZATION_RESISTANCE_CHANCE = dcfg.collectivizationResistanceChance;

/** Stakhanovite production bonus when workers exceed quota. */
const STAKHANOVITE_PRODUCTION_BONUS = dcfg.stakhanoviteProductionBonus;

/** Stakhanovite pressure penalty on non-Stakhanovites. */
const STAKHANOVITE_PRESSURE_PENALTY = dcfg.stakhanovitePressurePenalty;

/** Fraction of population available for wartime conscription. */
const WARTIME_CONSCRIPTION_RATE = dcfg.wartimeConscriptionRate;

/** Production bonus during wartime (patriotic fervor). */
const WARTIME_PRODUCTION_BONUS = dcfg.wartimeProductionBonus;

// ── Thaw/Freeze Constants ─────────────────────────────────────────────────

/** Ticks per thaw/freeze phase (720 ticks ~ 2 in-game years at 30 ticks/month). */
const THAW_FREEZE_PHASE_TICKS = dcfg.thawFreezePhaseTicks;

/** Morale boost during thaw phase. */
const THAW_MORALE_BOOST = dcfg.thawMoraleBoost;

/** Morale penalty during freeze phase. */
const FREEZE_MORALE_PENALTY = dcfg.freezeMoralePenalty;

/** Production bonus during thaw phase (relaxed policies). */
const THAW_PRODUCTION_BONUS = dcfg.thawProductionBonus;

/** Production penalty during freeze phase (crackdowns). */
const FREEZE_PRODUCTION_PENALTY = dcfg.freezeProductionPenalty;

// ── Stagnation Constants ──────────────────────────────────────────────────

/** Building decay rate multiplier during stagnation. */
const STAGNATION_DECAY_MULT = dcfg.stagnationDecayMult;

/** Base paperwork accumulation per tick during stagnation. */
const STAGNATION_PAPERWORK_PER_TICK = dcfg.stagnationPaperworkPerTick;

/** Productivity decrease per year of stagnation (cumulative). */
const STAGNATION_PRODUCTIVITY_LOSS_PER_YEAR = dcfg.stagnationProductivityLossPerYear;

/** Corruption rate multiplier during stagnation. */
const STAGNATION_CORRUPTION_MULT = dcfg.stagnationCorruptionMult;

// ── Eternal Bureaucracy Constants ─────────────────────────────────────────

/** Paperwork victory threshold — reaching this wins the "bureaucratic singularity". */
export const ETERNAL_PAPERWORK_THRESHOLD = dcfg.eternalPaperworkThreshold;

/** Base paperwork accumulation per tick in the eternal era. */
const ETERNAL_PAPERWORK_BASE = dcfg.eternalPaperworkBase;

/** Exponential growth factor for paperwork (per 1000 existing paperwork). */
const ETERNAL_PAPERWORK_GROWTH_FACTOR = dcfg.eternalPaperworkGrowthFactor;

/** Production slowdown per 1000 paperwork accumulated. */
const ETERNAL_BUREAUCRACY_SLOWDOWN_PER_1000 = dcfg.eternalBureaucracySlowdownPer1000;

// ─── Thaw/Freeze State ─────────────────────────────────────────────────────

/** Tracked oscillation state for the thaw/freeze mechanic. */
export interface ThawFreezeState {
  /** Current phase: 'thaw' or 'freeze'. */
  phase: 'thaw' | 'freeze';
  /** Tick when the current phase started. */
  phaseStartTick: number;
}

/** Module-level thaw/freeze state. Persisted via serialize/deserialize. */
let _thawFreezeState: ThawFreezeState = { phase: 'thaw', phaseStartTick: 0 };

/** Get the current thaw/freeze state (for serialization and UI). */
export function getThawFreezeState(): ThawFreezeState {
  return { ..._thawFreezeState };
}

/** Set the thaw/freeze state (for deserialization). */
export function setThawFreezeState(state: ThawFreezeState): void {
  _thawFreezeState = { ...state };
}

/** Reset the thaw/freeze state (for new games). */
export function resetThawFreezeState(): void {
  _thawFreezeState = { phase: 'thaw', phaseStartTick: 0 };
}

// ─── Paperwork State ──────────────────────────────────────────────────────

/** Module-level accumulated paperwork for stagnation/eternal mechanics. */
let _paperwork = 0;

/** Get the current paperwork accumulation. */
export function getPaperwork(): number {
  return _paperwork;
}

/** Set the paperwork value (for deserialization). */
export function setPaperwork(value: number): void {
  if (!Number.isFinite(value)) return;
  _paperwork = Math.max(0, value);
}

/** Reset paperwork (for new games). */
export function resetPaperwork(): void {
  _paperwork = 0;
}

/** Add paperwork from doctrine effects. Returns new total. */
export function addPaperwork(delta: number): number {
  if (!Number.isFinite(delta)) return _paperwork;
  _paperwork = Math.max(0, _paperwork + delta);
  return _paperwork;
}

// ─── Mechanic Implementations ───────────────────────────────────────────────

/**
 * War Communism: Forced grain requisitioning.
 * All food production goes to the state first. Citizens get leftovers.
 */
function applyGrainRequisitioning(currentFood: number, _rng: GameRng): DoctrineMechanicEffect {
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
function applyCollectivizationSeizure(currentFood: number, currentPop: number, rng: GameRng): DoctrineMechanicEffect {
  const foodSeized = Math.floor(currentFood * COLLECTIVIZATION_SEIZURE_RATE);

  // Chance of resistance causing population loss (kulak resistance)
  let popLoss = 0;
  if (currentPop > 10 && rng.coinFlip(COLLECTIVIZATION_RESISTANCE_CHANCE)) {
    popLoss = rng.int(1, Math.max(1, Math.floor(currentPop * 0.02)));
  }

  const desc =
    popLoss > 0
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
function applyWartimeConscription(currentPop: number, _rng: GameRng): DoctrineMechanicEffect {
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

/**
 * Thaw & Freeze: Oscillation between relaxed and tightened policies.
 * Alternates every ~2 in-game years. Thaw = bonus morale + production,
 * Freeze = penalty morale + crackdowns.
 */
function applyThawFreezeOscillation(totalTicks: number, _rng: GameRng): DoctrineMechanicEffect {
  // Check if it's time to toggle phase
  const ticksInPhase = totalTicks - _thawFreezeState.phaseStartTick;
  if (ticksInPhase >= THAW_FREEZE_PHASE_TICKS) {
    _thawFreezeState = {
      phase: _thawFreezeState.phase === 'thaw' ? 'freeze' : 'thaw',
      phaseStartTick: totalTicks,
    };
  }

  const isThaw = _thawFreezeState.phase === 'thaw';

  if (isThaw) {
    return {
      mechanicId: 'thaw_freeze_oscillation',
      description: 'The Thaw: Policies relaxed. Private plots expanded. Citizens breathe easier. Temporarily.',
      foodDelta: 0,
      moneyDelta: 0,
      vodkaDelta: 0,
      popDelta: 0,
      productionMult: 1.0 + THAW_PRODUCTION_BONUS,
      moraleDelta: THAW_MORALE_BOOST,
    };
  }

  return {
    mechanicId: 'thaw_freeze_oscillation',
    description: 'The Freeze: Policies tightened. Crackdowns resume. The thaw was, as always, temporary.',
    foodDelta: 0,
    moneyDelta: 0,
    vodkaDelta: 0,
    popDelta: 0,
    productionMult: 1.0 - FREEZE_PRODUCTION_PENALTY,
    moraleDelta: FREEZE_MORALE_PENALTY,
  };
}

/**
 * Stagnation: Buildings decay faster, paperwork accumulates,
 * productivity decreases over time, corruption accelerates.
 */
function applyStagnationRot(totalTicks: number, eraStartTick: number, _rng: GameRng): DoctrineMechanicEffect {
  // Calculate years of stagnation (360 ticks per year)
  const ticksInStagnation = Math.max(totalTicks - eraStartTick, 0);
  const yearsOfStagnation = Math.floor(ticksInStagnation / 360);

  // Productivity loss is cumulative per year
  const productivityLoss = Math.min(yearsOfStagnation * STAGNATION_PRODUCTIVITY_LOSS_PER_YEAR, 0.3);

  return {
    mechanicId: 'stagnation_rot',
    description:
      yearsOfStagnation > 5
        ? `Year ${yearsOfStagnation} of stagnation. Productivity down ${Math.round(productivityLoss * 100)}%. The rust is structural.`
        : `Stagnation deepens. Bureaucracy accumulates. Buildings crumble. Vodka consumption rises.`,
    foodDelta: 0,
    moneyDelta: 0,
    vodkaDelta: 0,
    popDelta: 0,
    productionMult: 1.0 - productivityLoss,
    decayMult: STAGNATION_DECAY_MULT,
    paperworkDelta: STAGNATION_PAPERWORK_PER_TICK,
    corruptionMult: STAGNATION_CORRUPTION_MULT,
  };
}

/**
 * The Eternal Soviet: Paperwork accumulates exponentially.
 * All systems slow as bureaucracy overwhelms everything.
 * Victory condition: reach the paperwork singularity threshold.
 */
function applyEternalBureaucracy(currentPaperwork: number, _rng: GameRng): DoctrineMechanicEffect {
  // Exponential growth: more paperwork = faster accumulation
  const growthBonus = Math.floor(currentPaperwork * ETERNAL_PAPERWORK_GROWTH_FACTOR);
  const paperworkGain = ETERNAL_PAPERWORK_BASE + growthBonus;

  // Systems slow down based on paperwork accumulation
  const slowdown = Math.min(
    Math.floor(currentPaperwork / 1000) * ETERNAL_BUREAUCRACY_SLOWDOWN_PER_1000,
    0.5, // Cap at 50% slowdown
  );

  const nearSingularity = currentPaperwork + paperworkGain >= ETERNAL_PAPERWORK_THRESHOLD;

  const desc = nearSingularity
    ? `BUREAUCRATIC SINGULARITY IMMINENT: ${currentPaperwork + paperworkGain}/${ETERNAL_PAPERWORK_THRESHOLD} paperwork. The forms are filling themselves.`
    : currentPaperwork > 3000
      ? `Paperwork: ${currentPaperwork}. The city is a filing cabinet. Citizens are appendices.`
      : currentPaperwork > 1000
        ? `Paperwork: ${currentPaperwork}. Buildings exist only as references in other documents.`
        : `Paperwork: ${currentPaperwork}. The bureaucracy grows. It does not know why. It does not need to.`;

  return {
    mechanicId: 'eternal_bureaucracy',
    description: desc,
    foodDelta: 0,
    moneyDelta: 0,
    vodkaDelta: 0,
    popDelta: 0,
    productionMult: 1.0 - slowdown,
    paperworkDelta: paperworkGain,
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
  /** Tick when the current era started (for stagnation year tracking). */
  eraStartTick?: number;
  /** Current accumulated paperwork (for eternal bureaucracy). */
  currentPaperwork?: number;
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
    case 'thaw_freeze_oscillation':
      return applyThawFreezeOscillation(ctx.totalTicks, ctx.rng);
    case 'stagnation_rot':
      return applyStagnationRot(ctx.totalTicks, ctx.eraStartTick ?? 0, ctx.rng);
    case 'eternal_bureaucracy':
      return applyEternalBureaucracy(ctx.currentPaperwork ?? 0, ctx.rng);
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

/** Build DOCTRINE_POLICIES from config (numeric mults) + hardcoded booleans. */
const BOOLEAN_POLICIES: Record<string, { privateGardensAllowed: boolean; blackMarketTolerated: boolean }> = {
  revolution: { privateGardensAllowed: true, blackMarketTolerated: true },
  collectivization: { privateGardensAllowed: false, blackMarketTolerated: false },
  industrialization: { privateGardensAllowed: false, blackMarketTolerated: false },
  great_patriotic: { privateGardensAllowed: true, blackMarketTolerated: true },
  reconstruction: { privateGardensAllowed: true, blackMarketTolerated: false },
  thaw_and_freeze: { privateGardensAllowed: true, blackMarketTolerated: true },
  stagnation: { privateGardensAllowed: true, blackMarketTolerated: true },
  the_eternal: { privateGardensAllowed: true, blackMarketTolerated: true },
};

const DOCTRINE_POLICIES: Record<string, DoctrinePolicy> = Object.fromEntries(
  Object.entries(dcfg.policies).map(([eraId, mults]) => [
    eraId,
    {
      ...mults,
      ...(BOOLEAN_POLICIES[eraId] ?? { privateGardensAllowed: false, blackMarketTolerated: false }),
    },
  ]),
);

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
