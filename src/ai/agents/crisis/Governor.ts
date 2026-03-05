/**
 * @module ai/agents/crisis/Governor
 *
 * Governor interface and DynamicModifiers — the runtime replacement for
 * hardcoded DifficultyConfig / DIFFICULTY_PRESETS.
 *
 * A Governor evaluates the game state each tick and produces:
 *   1. CrisisImpact tickets (delegated from crisis agents)
 *   2. DynamicModifiers — the same shape as DifficultyConfig, applied to
 *      every system that currently reads difficulty settings.
 *
 * Two concrete implementations will follow:
 *   - HistoricalGovernor: fires crises on historical dates, ends ~1991
 *   - FreeformGovernor: pattern-driven alternate-history extrapolation
 */

import type { SettlementSummary } from '@/game/engine/SettlementSummary';
import type { GameRng } from '@/game/SeedSystem';
import type { WorldAgent } from '../core/WorldAgent';
import type { PressureReadContext } from './pressure/PressureDomains';
import type { CrisisImpact } from './types';

// ─── Governor Mode ─────────────────────────────────────────────────────────

/** Which governor variant is active. */
export type GovernorMode = 'historical' | 'freeform';

// ─── Dynamic Modifiers ─────────────────────────────────────────────────────

/**
 * Drop-in replacement for DifficultyConfig.
 *
 * Every field mirrors DifficultyConfig exactly so existing systems can
 * swap from `difficultyConfig.quotaMultiplier` to
 * `dynamicModifiers.quotaMultiplier` without structural changes.
 */
export interface DynamicModifiers {
  /** Quota target multiplier (lower = easier). */
  quotaMultiplier: number;
  /** Ticks between automatic black mark decay (lower = faster decay = easier). */
  markDecayTicks: number;
  /** 1 politruk per N citizens (higher N = fewer politruks = easier). */
  politrukRatio: number;
  /** KGB investigation frequency. */
  kgbAggression: 'low' | 'medium' | 'high';
  /** Population growth rate multiplier. */
  growthMultiplier: number;
  /** Winter duration modifier. */
  winterModifier: 'shorter' | 'standard' | 'longer';
  /** Building decay rate multiplier (lower = slower decay = easier). */
  decayMultiplier: number;
  /** Starting resources multiplier. */
  resourceMultiplier: number;
  /** Food/vodka consumption rate multiplier (higher = hungrier citizens = harder). */
  consumptionMultiplier: number;
}

/**
 * Default modifiers — equivalent to "comrade" (medium) difficulty.
 * Frozen to prevent accidental mutation.
 */
export const DEFAULT_MODIFIERS: Readonly<DynamicModifiers> = Object.freeze({
  quotaMultiplier: 1.0,
  markDecayTicks: 720,
  politrukRatio: 30,
  kgbAggression: 'medium' as const,
  growthMultiplier: 1.0,
  winterModifier: 'standard' as const,
  decayMultiplier: 1.0,
  resourceMultiplier: 1.0,
  consumptionMultiplier: 1.0,
});

// ─── Governor Context ──────────────────────────────────────────────────────

/** Per-tick context passed to the governor for evaluation. */
export interface GovernorContext {
  /** Current game year. */
  year: number;
  /** Current month (1-12). */
  month: number;
  /** Current total population. */
  population: number;
  /** Current food stockpile. */
  food: number;
  /** Current money (rubles). */
  money: number;
  /** Seeded RNG instance. */
  rng: GameRng;
  /** Total simulation ticks elapsed. */
  totalTicks: number;
  /** Current era identifier. */
  eraId: string;
  /** Fixed-size settlement snapshot for governor decision-making. Optional for backward compat. */
  settlement?: SettlementSummary;
  /** Pressure system readings for pressure-based crisis generation. Optional for backward compat. */
  pressureReadings?: PressureReadContext;
  /** WorldAgent reference for computing per-domain pressure modifiers. Optional for backward compat. */
  worldAgent?: WorldAgent;
}

// ─── Governor Directive ────────────────────────────────────────────────────

/**
 * Output of a governor tick — crisis impacts plus updated modifiers.
 */
export interface GovernorDirective {
  /** Crisis impact tickets to apply this tick. */
  crisisImpacts: CrisisImpact[];
  /** Current dynamic modifiers (may change each tick during crises). */
  modifiers: DynamicModifiers;
}

// ─── Governor Save Data ────────────────────────────────────────────────────

/** Serialized governor state for save/load. */
export interface GovernorSaveData {
  /** Which governor variant is active. */
  mode: GovernorMode;
  /** IDs of currently active crises. */
  activeCrises: string[];
  /** Governor-specific state (subclasses extend). */
  state: Record<string, unknown>;
}

// ─── Governor Interface ────────────────────────────────────────────────────

/**
 * Contract for governor implementations.
 *
 * The governor is the top-level orchestrator for crises and dynamic
 * difficulty. SimulationEngine calls evaluate() each tick and applies
 * the returned directive.
 */
export interface IGovernor {
  /** Evaluate the current tick and return a directive. */
  evaluate(ctx: GovernorContext): GovernorDirective;

  /** IDs of currently active crises. */
  getActiveCrises(): string[];

  /** Called at the start of each new game year. */
  onYearBoundary(year: number): void;

  /** Serialize governor state for save persistence. */
  serialize(): GovernorSaveData;

  /** Restore governor state from saved data. */
  restore(data: GovernorSaveData): void;
}
