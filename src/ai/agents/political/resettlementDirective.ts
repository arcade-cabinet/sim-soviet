/**
 * @module ai/agents/political/resettlementDirective
 *
 * Forced resettlement — a PUNITIVE directive from Moscow.
 * Different from promotion: resettlement is punishment, not reward.
 *
 * Triggers when political pressure stays high, Moscow attention is elevated,
 * or specific cold branches activate (ethnic deportation).
 *
 * Warning period: 12 ticks (1 year) from directive to execution.
 * During warning the player can:
 *   - Enact disassembly policy (gather resources for transit)
 *   - Attempt bribe (high cost, risky)
 *   - Accept and prepare (preparation level affects transit mortality)
 *
 * Pure function module. No Yuka dependency. State is tracked by PoliticalAgent.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

/** Pressure state subset needed for resettlement risk evaluation. */
export interface ResettlementPressureContext {
  /** Political pressure gauge level (0-1). */
  politicalPressure: number;
  /** Loyalty pressure gauge level (0-1). */
  loyaltyPressure: number;
}

/** Political state subset needed for resettlement risk evaluation. */
export interface ResettlementPoliticalContext {
  /** Moscow attention level (0-1) from WorldAgent. */
  moscowAttention: number;
  /** KGB suspicion level (0-1). */
  suspicionLevel: number;
  /** Current blat balance. */
  blat: number;
}

/** World state subset needed for resettlement risk evaluation. */
export interface ResettlementWorldContext {
  /** Whether the ethnic deportation cold branch is active. */
  ethnicDeportationActive: boolean;
}

/** Player actions available during warning period. */
export type ResettlementPreparationAction = 'disassemble' | 'bribe' | 'accept';

/** Serializable resettlement directive state. */
export interface ResettlementDirectiveState {
  /** Current resettlement risk (0-1). */
  currentRisk: number;
  /** Whether a resettlement directive has been issued. */
  directiveIssued: boolean;
  /** Ticks remaining in warning period (starts at WARNING_PERIOD_TICKS). */
  warningTicksRemaining: number;
  /** Preparation level (0-1). Higher = lower transit mortality. */
  preparationLevel: number;
  /** Whether disassembly policy has been enacted. */
  disassemblyActive: boolean;
  /** Whether execution has completed (prevents re-triggering). */
  executed: boolean;
  /** Consecutive years political pressure > 0.7. */
  sustainedPressureYears: number;
}

/** Result of a resettlement bribe attempt. */
export interface ResettlementBribeResult {
  success: boolean;
  detected: boolean;
  blatCost: number;
}

/** Outcome of resettlement execution. */
export interface ResettlementOutcome {
  /** Fraction of population lost in transit (0-1). */
  mortalityRate: number;
  /** Absolute population lost. */
  populationLost: number;
  /** Resources salvaged via disassembly (fraction of original). */
  resourcesSalvaged: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** Warning period in ticks (12 ticks = 1 year). */
const WARNING_PERIOD_TICKS = 12;

/** Political pressure threshold for sustained risk accumulation. */
const POLITICAL_PRESSURE_THRESHOLD = 0.7;

/** Moscow attention threshold that can independently trigger resettlement. */
const MOSCOW_ATTENTION_THRESHOLD = 0.8;

/** Years of sustained political pressure before directive issues. */
const SUSTAINED_PRESSURE_YEARS = 3;

/** Blat cost for resettlement bribe (very expensive). */
const BRIBE_BLAT_COST = 10;

/** Detection chance for resettlement bribe (higher than promotion — more scrutiny). */
const BRIBE_DETECTION_CHANCE = 0.35;

/** Mortality rate when well-prepared (disassembly + full preparation). */
const WELL_PREPARED_MORTALITY = 0.05;

/** Mortality rate when completely unprepared. */
const UNPREPARED_MORTALITY = 0.3;

/** Preparation gained per tick when disassembly is active. */
const DISASSEMBLY_PREP_PER_TICK = 0.08;

/** Base preparation gained per tick just by having the warning. */
const BASE_PREP_PER_TICK = 0.02;

/** Resource salvage rate when disassembly is active (fraction per total prep). */
const MAX_SALVAGE_RATE = 0.6;

// ─── Pure Functions ─────────────────────────────────────────────────────────

/** Create initial resettlement state. */
export function createResettlementState(): ResettlementDirectiveState {
  return {
    currentRisk: 0,
    directiveIssued: false,
    warningTicksRemaining: 0,
    preparationLevel: 0,
    disassemblyActive: false,
    executed: false,
    sustainedPressureYears: 0,
  };
}

/**
 * Evaluate resettlement risk.
 *
 * Triggers:
 *   - Political pressure > 0.7 sustained for 3+ years
 *   - Moscow attention > 0.8 (can independently push risk)
 *   - Ethnic deportation cold branch active (immediate high risk)
 *
 * @returns Risk value 0-1
 */
export function evaluateResettlementRisk(
  pressure: ResettlementPressureContext,
  political: ResettlementPoliticalContext,
  worldCtx: ResettlementWorldContext,
): number {
  // Ethnic deportation cold branch = immediate maximum risk
  if (worldCtx.ethnicDeportationActive) {
    return 1.0;
  }

  // Political pressure contribution (max 0.4)
  const politicalContribution =
    pressure.politicalPressure > POLITICAL_PRESSURE_THRESHOLD
      ? (pressure.politicalPressure - POLITICAL_PRESSURE_THRESHOLD) * (0.4 / 0.3)
      : 0;

  // Moscow attention contribution (max 0.3)
  const moscowContribution =
    political.moscowAttention > MOSCOW_ATTENTION_THRESHOLD
      ? (political.moscowAttention - MOSCOW_ATTENTION_THRESHOLD) * (0.3 / 0.2)
      : 0;

  // KGB suspicion compounds the risk (max 0.2)
  const suspicionContribution = political.suspicionLevel * 0.2;

  // Loyalty pressure adds instability signal (max 0.1)
  const loyaltyContribution = pressure.loyaltyPressure > 0.6 ? (pressure.loyaltyPressure - 0.6) * 0.25 : 0;

  const raw = politicalContribution + moscowContribution + suspicionContribution + loyaltyContribution;
  return Math.max(0, Math.min(raw, 1.0));
}

/**
 * Tick resettlement state once per year.
 *
 * Tracks sustained pressure and issues directive when threshold crossed.
 *
 * @param state - Current resettlement state (mutated in place)
 * @param risk - This year's evaluated risk
 * @param currentYear - Game year (unused for now, available for future)
 * @returns Whether a new directive was just issued
 */
export function tickResettlementYearly(state: ResettlementDirectiveState, risk: number): boolean {
  if (state.executed || state.directiveIssued) return false;

  state.currentRisk = risk;

  if (risk > 0.5) {
    state.sustainedPressureYears++;
  } else {
    state.sustainedPressureYears = Math.max(0, state.sustainedPressureYears - 1);
  }

  // Issue directive after sustained high risk OR immediate ethnic deportation
  if (risk >= 1.0 || state.sustainedPressureYears >= SUSTAINED_PRESSURE_YEARS) {
    state.directiveIssued = true;
    state.warningTicksRemaining = WARNING_PERIOD_TICKS;
    return true;
  }

  return false;
}

/**
 * Tick the warning period (called per simulation tick, not per year).
 *
 * Advances preparation and counts down to execution.
 *
 * @param state - Current resettlement state (mutated in place)
 * @returns Whether execution should occur this tick
 */
export function tickWarningPeriod(state: ResettlementDirectiveState): boolean {
  if (!state.directiveIssued || state.executed) return false;

  // Accumulate preparation
  const prepGain = state.disassemblyActive ? BASE_PREP_PER_TICK + DISASSEMBLY_PREP_PER_TICK : BASE_PREP_PER_TICK;
  state.preparationLevel = Math.min(1.0, state.preparationLevel + prepGain);

  state.warningTicksRemaining--;

  if (state.warningTicksRemaining <= 0) {
    state.executed = true;
    return true;
  }

  return false;
}

/**
 * Enact disassembly policy during warning period.
 * Can only be done once; irreversible.
 *
 * @param state - Current resettlement state (mutated in place)
 * @returns Whether disassembly was successfully enacted
 */
export function enactDisassembly(state: ResettlementDirectiveState): boolean {
  if (!state.directiveIssued || state.executed || state.disassemblyActive) return false;
  state.disassemblyActive = true;
  return true;
}

/**
 * Attempt to bribe Moscow to cancel the resettlement directive.
 *
 * @param state - Current resettlement state (mutated in place)
 * @param rng - Random number 0-1 for detection roll
 * @param currentBlat - Player's current blat balance
 * @returns Bribe result
 */
export function attemptResettlementBribe(
  state: ResettlementDirectiveState,
  rng: number,
  currentBlat: number,
): ResettlementBribeResult {
  if (!state.directiveIssued || state.executed) {
    return { success: false, detected: false, blatCost: 0 };
  }

  const canAfford = currentBlat >= BRIBE_BLAT_COST;
  if (!canAfford) {
    return { success: false, detected: false, blatCost: 0 };
  }

  const detected = rng < BRIBE_DETECTION_CHANCE;

  // Bribe succeeds: cancel directive
  state.directiveIssued = false;
  state.warningTicksRemaining = 0;
  state.preparationLevel = 0;
  state.disassemblyActive = false;
  state.sustainedPressureYears = 0;

  return { success: true, detected, blatCost: BRIBE_BLAT_COST };
}

/**
 * Calculate the outcome of resettlement execution.
 *
 * Preparation level linearly interpolates between unprepared and prepared mortality.
 *
 * @param state - Resettlement state at execution time
 * @param currentPopulation - Current settlement population
 * @returns Outcome with mortality and salvage data
 */
export function calculateResettlementOutcome(
  state: ResettlementDirectiveState,
  currentPopulation: number,
): ResettlementOutcome {
  const prep = Math.max(0, Math.min(state.preparationLevel, 1.0));

  // Mortality interpolates: unprepared (30%) → prepared (5%)
  const mortalityRate = UNPREPARED_MORTALITY + (WELL_PREPARED_MORTALITY - UNPREPARED_MORTALITY) * prep;
  const populationLost = Math.floor(currentPopulation * mortalityRate);

  // Resources salvaged scale with preparation and disassembly
  const resourcesSalvaged = state.disassemblyActive ? prep * MAX_SALVAGE_RATE : prep * 0.1;

  return { mortalityRate, populationLost, resourcesSalvaged };
}

/** Exported constants for testing. */
export const RESETTLEMENT_CONSTANTS = {
  WARNING_PERIOD_TICKS,
  POLITICAL_PRESSURE_THRESHOLD,
  MOSCOW_ATTENTION_THRESHOLD,
  SUSTAINED_PRESSURE_YEARS,
  BRIBE_BLAT_COST,
  BRIBE_DETECTION_CHANCE,
  WELL_PREPARED_MORTALITY,
  UNPREPARED_MORTALITY,
  DISASSEMBLY_PREP_PER_TICK,
  BASE_PREP_PER_TICK,
  MAX_SALVAGE_RATE,
} as const;
