/**
 * @module ai/agents/crisis/pressure/pressureAccumulation
 *
 * Dual-spread pressure accumulation model.
 *
 * Like the food allocation system (baseline uniform + spiked biased):
 *
 * - **Layer 1 (Uniform)**: BASELINE added to ALL domains per tick.
 *   Systemic entropy — the Soviet system always decays.
 *
 * - **Layer 2 (Spiked)**: BUDGET distributed proportionally to current
 *   pressure levels. Stressed domains attract MORE pressure. Positive
 *   feedback loop.
 *
 * - **Venting**: Pressure decreases when raw readings improve (player
 *   fixes the problem).
 *
 * - **EMA smoothing**: α=0.15 for trend detection.
 *
 * Formula per domain:
 *   pressureNext = pressureCurrent * DECAY
 *                + rawReading * RAW_WEIGHT
 *                + (baseline + spiked) * worldModifier
 *                - ventAmount
 */

import { PRESSURE_DOMAINS, type PressureDomain, type PressureGauge, type PressureState } from './PressureDomains';
import { THRESHOLDS } from './pressureThresholds';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Natural decay per tick (5% — prevents runaway). */
export const DECAY = 0.95;

/** Weight of instantaneous raw reading in the update. */
export const RAW_WEIGHT = 0.3;

/** Uniform baseline added to ALL domains per tick (systemic entropy). */
export const BASELINE = 0.002;

/** Total budget distributed proportionally to stressed domains per tick. */
export const BUDGET = 0.008;

/** EMA smoothing factor for trend tracking. */
export const EMA_ALPHA = 0.15;

/** Minimum venting threshold — raw reading must improve by this much to vent. */
export const VENT_THRESHOLD = 0.05;

/** Maximum vent per tick (prevents instant pressure drops). */
export const MAX_VENT_PER_TICK = 0.05;

// ─── Utility ─────────────────────────────────────────────────────────────────

/** Clamp a value to [0, 1]. */
function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// ─── Core Accumulation ───────────────────────────────────────────────────────

/**
 * Compute the spiked distribution for Layer 2.
 *
 * Distributes BUDGET proportionally to current pressure levels.
 * If all pressures are zero, distributes uniformly (BUDGET / 10).
 *
 * @param state - Current pressure state
 * @returns Per-domain spiked allocation
 */
export function computeSpikedDistribution(state: PressureState): Record<PressureDomain, number> {
  const result = {} as Record<PressureDomain, number>;

  // Sum all current pressure levels
  let totalPressure = 0;
  for (const domain of PRESSURE_DOMAINS) {
    totalPressure += state[domain].level;
  }

  if (totalPressure <= 0) {
    // No existing pressure — distribute uniformly
    const uniform = BUDGET / PRESSURE_DOMAINS.length;
    for (const domain of PRESSURE_DOMAINS) {
      result[domain] = uniform;
    }
  } else {
    // Proportional distribution
    for (const domain of PRESSURE_DOMAINS) {
      result[domain] = (state[domain].level / totalPressure) * BUDGET;
    }
  }

  return result;
}

/**
 * Compute vent amount for a domain.
 *
 * Venting occurs when the raw reading has IMPROVED (dropped) relative
 * to the last reading. The vent amount is proportional to the improvement,
 * capped at MAX_VENT_PER_TICK.
 *
 * @param gauge - Current gauge state
 * @param rawReading - New raw reading (0-1)
 * @returns Vent amount (0 = no venting)
 */
export function computeVent(gauge: PressureGauge, rawReading: number): number {
  const improvement = gauge.lastRawReading - rawReading;
  if (improvement < VENT_THRESHOLD) return 0;
  return Math.min(MAX_VENT_PER_TICK, improvement * 0.5);
}

/**
 * Update a single pressure gauge for one tick.
 *
 * @param gauge - Current gauge state (will not be mutated)
 * @param rawReading - Normalized 0-1 reading from pressureNormalization
 * @param spiked - Spiked distribution amount for this domain
 * @param worldModifier - Multiplier from WorldAgent (1.0 = neutral)
 * @returns New gauge state
 */
export function tickGauge(
  gauge: PressureGauge,
  rawReading: number,
  spiked: number,
  worldModifier: number,
): PressureGauge {
  // Accumulation
  const accumulation = (BASELINE + spiked) * worldModifier;
  const vent = computeVent(gauge, rawReading);

  // Core formula
  let newLevel = gauge.level * DECAY + rawReading * RAW_WEIGHT + accumulation - vent;
  newLevel = clamp01(newLevel);

  // EMA trend
  const newTrend = gauge.trend * (1 - EMA_ALPHA) + rawReading * EMA_ALPHA;

  // Threshold counter tracking
  let warningTicks = gauge.warningTicks;
  let criticalTicks = gauge.criticalTicks;

  if (newLevel >= THRESHOLDS.WARNING) {
    warningTicks++;
  } else {
    warningTicks = 0;
  }

  if (newLevel >= THRESHOLDS.CRITICAL) {
    criticalTicks++;
  } else {
    criticalTicks = 0;
  }

  return {
    level: newLevel,
    trend: clamp01(newTrend),
    warningTicks,
    criticalTicks,
    lastRawReading: rawReading,
  };
}

/**
 * Update the full pressure state for one tick.
 *
 * @param state - Current pressure state (will not be mutated)
 * @param rawReadings - Per-domain 0-1 readings from pressureNormalization
 * @param worldModifiers - Per-domain multiplier from WorldAgent (1.0 = neutral)
 * @returns New pressure state
 */
export function tickPressure(
  state: PressureState,
  rawReadings: Record<PressureDomain, number>,
  worldModifiers: Partial<Record<PressureDomain, number>>,
): PressureState {
  const spiked = computeSpikedDistribution(state);

  const newState = {} as PressureState;
  for (const domain of PRESSURE_DOMAINS) {
    newState[domain] = tickGauge(state[domain], rawReadings[domain], spiked[domain], worldModifiers[domain] ?? 1.0);
  }

  return newState;
}
