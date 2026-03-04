/**
 * @module ai/agents/crisis/pressure/pressureThresholds
 *
 * Threshold constants for pressure-valve crisis emergence.
 *
 * Three levels determine when incidents and crises fire:
 *   - Warning (0.50):  Minor incidents after sustained duration
 *   - Critical (0.75): Major crises after sustained duration
 *   - Emergency (0.90): Major crises fast-tracked (shorter sustain)
 */

/** Pressure level thresholds. */
export const THRESHOLDS = {
  /** Minor incident threshold. */
  WARNING: 0.50,
  /** Major crisis threshold. */
  CRITICAL: 0.75,
  /** Emergency — fast-tracked major crisis. */
  EMERGENCY: 0.90,
} as const;

/** Sustained tick durations before crises emerge. */
export const SUSTAIN_TICKS = {
  /** Ticks at warning before minor incident fires (~0.5 year at 12 ticks/year). */
  WARNING_MINOR: 6,
  /** Ticks at critical before major crisis fires (~1 year). */
  CRITICAL_MAJOR: 12,
  /** Ticks at emergency before fast-tracked major crisis fires (~3 months). */
  EMERGENCY_MAJOR: 3,
} as const;
