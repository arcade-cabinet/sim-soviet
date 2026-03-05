/**
 * @module ai/agents/crisis/pressure/PressureSystem
 *
 * Orchestrator for the pressure-valve crisis system.
 *
 * NOT a Yuka agent — pure function module. Reads existing agent metrics,
 * normalizes them to 0-1 pressure readings, and accumulates via the
 * dual-spread model.
 *
 * At post-scarcity (Kardashev >= 1.0, techLevel > 0.95), classical domains
 * transform via `transformDomains()`. Zeroed domains freeze; new post-scarcity
 * domains activate. Political and loyalty are AMPLIFIED (power never goes away).
 *
 * Usage:
 *   const ctx = assemblePressureReadContext(agents);  // in phaseChronology
 *   const readings = normalizeAllDomains(ctx);
 *   state = tickPressure(state, readings, worldModifiers);
 */

import {
  AMPLIFIED_AT_POST_SCARCITY,
  createGauge,
  createPressureState,
  createPostScarcityPressureState,
  POST_SCARCITY_DOMAINS,
  PRESSURE_DOMAINS,
  ZEROED_AT_POST_SCARCITY,
  type AnyPressureDomain,
  type ExtendedPressureState,
  type ExtendedPressureStateSaveData,
  type PostScarcityDomain,
  type PostScarcityPressureState,
  type PressureDomain,
  type PressureReadContext,
  type PressureState,
  type PressureStateSaveData,
  restoreExtendedPressureState,
  restorePressureState,
  serializeExtendedPressureState,
  serializePressureState,
} from './PressureDomains';
import { tickGauge, computeSpikedDistribution, BASELINE, DECAY, RAW_WEIGHT } from './pressureAccumulation';
import { tickPressure } from './pressureAccumulation';
import { normalizeAllDomains, normalizeAllPostScarcityDomains } from './pressureNormalization';

// ─── Constants ──────────────────────────────────────────────────────────────

/** Kardashev level threshold for domain transformation. */
export const TRANSFORMATION_KARDASHEV_THRESHOLD = 1.0;

/** Tech level threshold for domain transformation. */
export const TRANSFORMATION_TECH_THRESHOLD = 0.95;

/** Amplification multiplier for political/loyalty at post-scarcity. */
const AMPLIFICATION_MULTIPLIER = 1.5;

// ─── PressureSystem ──────────────────────────────────────────────────────────

/**
 * Stateful pressure system that accumulates pressure over time.
 * Instantiated once per governor, updated each tick.
 *
 * Supports post-scarcity domain transformation at Kardashev >= 1.0.
 */
export class PressureSystem {
  private state: PressureState;
  private postScarcityState: PostScarcityPressureState | null = null;
  private _transformed = false;
  private _transformedAtKardashev = 0;

  constructor() {
    this.state = createPressureState();
  }

  /**
   * Run one tick of pressure accumulation.
   *
   * @param ctx - Pressure read context (assembled from existing agent APIs)
   * @param worldModifiers - Per-domain multiplier from WorldAgent (1.0 = neutral)
   */
  tick(ctx: PressureReadContext, worldModifiers: Partial<Record<PressureDomain, number>> = {}): void {
    if (this._transformed) {
      this._tickTransformed(ctx, worldModifiers);
    } else {
      const rawReadings = normalizeAllDomains(ctx);
      this.state = tickPressure(this.state, rawReadings, worldModifiers);
    }
  }

  /**
   * Transform pressure domains for post-scarcity civilization.
   *
   * Preconditions: kardashevLevel >= 1.0 AND techLevel > 0.95.
   * Idempotent — calling again after transformation is a no-op.
   *
   * Effects:
   * - food, housing, power, economic gauges ZEROED (frozen at 0)
   * - political, loyalty gauges AMPLIFIED (1.5x pressure modifier)
   * - morale TRANSFORMED to ennui
   * - 5 new post-scarcity gauges activated: meaning, density, entropy, legacy, ennui
   *
   * @param kardashevLevel - Current Kardashev scale value
   * @returns true if transformation occurred, false if already transformed or below threshold
   */
  transformDomains(kardashevLevel: number): boolean {
    if (this._transformed) return false;
    if (kardashevLevel < TRANSFORMATION_KARDASHEV_THRESHOLD) return false;

    this._transformed = true;
    this._transformedAtKardashev = kardashevLevel;

    // Zero out replaced domains
    for (const domain of ZEROED_AT_POST_SCARCITY) {
      this.state[domain] = createGauge();
    }

    // Seed ennui from morale's current level (transformed, not zeroed)
    const moraleLevel = this.state.morale.level;

    // Initialize post-scarcity gauges
    this.postScarcityState = createPostScarcityPressureState();

    // Seed ennui from the morale state it replaces
    this.postScarcityState.ennui.level = moraleLevel;
    this.postScarcityState.ennui.trend = this.state.morale.trend;

    return true;
  }

  /** Whether domain transformation has occurred. */
  isTransformed(): boolean {
    return this._transformed;
  }

  /** Kardashev level at which transformation occurred (0 if not yet). */
  getTransformationKardashev(): number {
    return this._transformedAtKardashev;
  }

  /** Get current classical pressure state (read-only snapshot). */
  getState(): Readonly<PressureState> {
    return this.state;
  }

  /** Get post-scarcity pressure state (null if not yet transformed). */
  getPostScarcityState(): Readonly<PostScarcityPressureState> | null {
    return this.postScarcityState;
  }

  /** Get pressure level for a classical domain. */
  getLevel(domain: PressureDomain): number {
    return this.state[domain].level;
  }

  /** Get pressure level for a post-scarcity domain (0 if not transformed). */
  getPostScarcityLevel(domain: PostScarcityDomain): number {
    return this.postScarcityState?.[domain].level ?? 0;
  }

  /**
   * Get pressure level for any domain (classical or post-scarcity).
   */
  getAnyLevel(domain: AnyPressureDomain): number {
    if (domain in this.state) {
      return this.state[domain as PressureDomain].level;
    }
    return this.postScarcityState?.[domain as PostScarcityDomain]?.level ?? 0;
  }

  /** Get the domain with highest current pressure (includes post-scarcity). */
  getHighestPressure(): { domain: AnyPressureDomain; level: number } {
    let maxDomain: AnyPressureDomain = 'food';
    let maxLevel = 0;

    for (const domain of PRESSURE_DOMAINS) {
      if (this.state[domain].level > maxLevel) {
        maxLevel = this.state[domain].level;
        maxDomain = domain;
      }
    }

    if (this.postScarcityState) {
      for (const domain of POST_SCARCITY_DOMAINS) {
        if (this.postScarcityState[domain].level > maxLevel) {
          maxLevel = this.postScarcityState[domain].level;
          maxDomain = domain;
        }
      }
    }

    return { domain: maxDomain, level: maxLevel };
  }

  /** Get all classical domains above the warning threshold. */
  getWarningDomains(): PressureDomain[] {
    return PRESSURE_DOMAINS.filter((d) => this.state[d].level >= 0.5);
  }

  /** Get all classical domains above the critical threshold. */
  getCriticalDomains(): PressureDomain[] {
    return PRESSURE_DOMAINS.filter((d) => this.state[d].level >= 0.75);
  }

  /** Get post-scarcity domains above warning threshold. */
  getPostScarcityWarningDomains(): PostScarcityDomain[] {
    if (!this.postScarcityState) return [];
    return POST_SCARCITY_DOMAINS.filter((d) => this.postScarcityState![d].level >= 0.5);
  }

  /** Get post-scarcity domains above critical threshold. */
  getPostScarcityCriticalDomains(): PostScarcityDomain[] {
    if (!this.postScarcityState) return [];
    return POST_SCARCITY_DOMAINS.filter((d) => this.postScarcityState![d].level >= 0.75);
  }

  /**
   * Apply an external pressure spike to a domain (classical or post-scarcity).
   */
  applySpike(domain: AnyPressureDomain, amount: number): void {
    if (domain in this.state) {
      const gauge = this.state[domain as PressureDomain];
      gauge.level = Math.min(1, Math.max(0, gauge.level + amount));
    } else if (this.postScarcityState && domain in this.postScarcityState) {
      const gauge = this.postScarcityState[domain as PostScarcityDomain];
      gauge.level = Math.min(1, Math.max(0, gauge.level + amount));
    }
  }

  /** Reset all pressure to zero (including post-scarcity). */
  reset(): void {
    this.state = createPressureState();
    this.postScarcityState = null;
    this._transformed = false;
    this._transformedAtKardashev = 0;
  }

  /** Serialize for save/load (extended format). */
  serialize(): ExtendedPressureStateSaveData {
    return serializeExtendedPressureState({
      classical: this.state,
      postScarcity: this.postScarcityState,
      transformed: this._transformed,
      transformedAtKardashev: this._transformedAtKardashev,
    });
  }

  /** Restore from saved data (handles both legacy and extended formats). */
  restore(data: PressureStateSaveData | ExtendedPressureStateSaveData): void {
    if ('transformed' in data || 'postScarcityGauges' in data) {
      const extended = restoreExtendedPressureState(data as ExtendedPressureStateSaveData);
      this.state = extended.classical;
      this.postScarcityState = extended.postScarcity;
      this._transformed = extended.transformed;
      this._transformedAtKardashev = extended.transformedAtKardashev;
    } else {
      this.state = restorePressureState(data);
      this.postScarcityState = null;
      this._transformed = false;
      this._transformedAtKardashev = 0;
    }
  }

  // ── Private: Transformed tick ──────────────────────────────────────────────

  /**
   * Tick in transformed mode:
   * - Zeroed domains stay at 0 (skip accumulation)
   * - Amplified domains get 1.5x world modifier
   * - Persisting domains tick normally
   * - Post-scarcity domains accumulate from their own normalizers
   */
  private _tickTransformed(
    ctx: PressureReadContext,
    worldModifiers: Partial<Record<PressureDomain, number>>,
  ): void {
    // Classical domains
    const classicalReadings = normalizeAllDomains(ctx);
    const spiked = computeSpikedDistribution(this.state);

    const newState = {} as PressureState;
    for (const domain of PRESSURE_DOMAINS) {
      if ((ZEROED_AT_POST_SCARCITY as readonly string[]).includes(domain)) {
        // Zeroed: freeze at 0
        newState[domain] = createGauge();
      } else {
        // Active domain — apply amplification if applicable
        let modifier = worldModifiers[domain] ?? 1.0;
        if ((AMPLIFIED_AT_POST_SCARCITY as readonly string[]).includes(domain)) {
          modifier *= AMPLIFICATION_MULTIPLIER;
        }
        // Morale is still ticked classically (ennui reads from it too)
        newState[domain] = tickGauge(
          this.state[domain],
          classicalReadings[domain],
          spiked[domain],
          modifier,
        );
      }
    }
    this.state = newState;

    // Post-scarcity domains
    if (this.postScarcityState) {
      const psReadings = normalizeAllPostScarcityDomains(ctx);
      const newPS = {} as PostScarcityPressureState;
      for (const domain of POST_SCARCITY_DOMAINS) {
        // Simple accumulation for post-scarcity (no spiked distribution — they're independent)
        const gauge = this.postScarcityState[domain];
        const raw = psReadings[domain];
        // Simplified tick: decay + raw + small baseline
        let newLevel = gauge.level * DECAY + raw * RAW_WEIGHT + BASELINE;
        newLevel = Math.min(1, Math.max(0, newLevel));
        const newTrend = gauge.trend * 0.85 + raw * 0.15;

        let warningTicks = gauge.warningTicks;
        let criticalTicks = gauge.criticalTicks;
        if (newLevel >= 0.5) warningTicks++;
        else warningTicks = 0;
        if (newLevel >= 0.75) criticalTicks++;
        else criticalTicks = 0;

        newPS[domain] = {
          level: newLevel,
          trend: Math.min(1, Math.max(0, newTrend)),
          warningTicks,
          criticalTicks,
          lastRawReading: raw,
        };
      }
      this.postScarcityState = newPS;
    }
  }
}
