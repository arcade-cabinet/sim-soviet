/**
 * @module ai/agents/crisis/pressure/pressureThresholds
 *
 * Threshold constants for pressure-valve crisis emergence.
 *
 * Three levels determine when incidents and crises fire:
 *   - Warning (0.50):  Minor incidents after sustained duration
 *   - Critical (0.75): Major crises after sustained duration
 *   - Emergency (0.90): Major crises fast-tracked (shorter sustain)
 *
 * Data sourced from src/config/pressure.json.
 */

import pressureConfig from '@/config/pressure.json';

/** Pressure level thresholds. */
export const THRESHOLDS = {
  /** Minor incident threshold. */
  WARNING: pressureConfig.thresholds.WARNING,
  /** Major crisis threshold. */
  CRITICAL: pressureConfig.thresholds.CRITICAL,
  /** Emergency — fast-tracked major crisis. */
  EMERGENCY: pressureConfig.thresholds.EMERGENCY,
} as const;

/** Sustained tick durations before crises emerge. */
export const SUSTAIN_TICKS = {
  /** Ticks at warning before minor incident fires (~0.5 year at 12 ticks/year). */
  WARNING_MINOR: pressureConfig.sustainTicks.WARNING_MINOR,
  /** Ticks at critical before major crisis fires (~1 year). */
  CRITICAL_MAJOR: pressureConfig.sustainTicks.CRITICAL_MAJOR,
  /** Ticks at emergency before fast-tracked major crisis fires (~3 months). */
  EMERGENCY_MAJOR: pressureConfig.sustainTicks.EMERGENCY_MAJOR,
} as const;
