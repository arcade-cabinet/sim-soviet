/**
 * @module ai/agents/crisis/pressure/PressureSystem
 *
 * Orchestrator for the pressure-valve crisis system.
 *
 * NOT a Yuka agent — pure function module. Reads existing agent metrics,
 * normalizes them to 0-1 pressure readings, and accumulates via the
 * dual-spread model.
 *
 * Usage:
 *   const ctx = assemblePressureReadContext(agents);  // in phaseChronology
 *   const readings = normalizeAllDomains(ctx);
 *   state = tickPressure(state, readings, worldModifiers);
 */

import {
  createPressureState,
  PRESSURE_DOMAINS,
  type PressureDomain,
  type PressureReadContext,
  type PressureState,
  type PressureStateSaveData,
  restorePressureState,
  serializePressureState,
} from './PressureDomains';
import { tickPressure } from './pressureAccumulation';
import { normalizeAllDomains } from './pressureNormalization';

// ─── PressureSystem ──────────────────────────────────────────────────────────

/**
 * Stateful pressure system that accumulates pressure over time.
 * Instantiated once per governor, updated each tick.
 */
export class PressureSystem {
  private state: PressureState;

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
    const rawReadings = normalizeAllDomains(ctx);
    this.state = tickPressure(this.state, rawReadings, worldModifiers);
  }

  /** Get current pressure state (read-only snapshot). */
  getState(): Readonly<PressureState> {
    return this.state;
  }

  /** Get pressure level for a specific domain. */
  getLevel(domain: PressureDomain): number {
    return this.state[domain].level;
  }

  /** Get the domain with highest current pressure. */
  getHighestPressure(): { domain: PressureDomain; level: number } {
    let maxDomain: PressureDomain = 'food';
    let maxLevel = 0;
    for (const domain of PRESSURE_DOMAINS) {
      if (this.state[domain].level > maxLevel) {
        maxLevel = this.state[domain].level;
        maxDomain = domain;
      }
    }
    return { domain: maxDomain, level: maxLevel };
  }

  /** Get all domains above the warning threshold. */
  getWarningDomains(): PressureDomain[] {
    return PRESSURE_DOMAINS.filter((d) => this.state[d].level >= 0.5);
  }

  /** Get all domains above the critical threshold. */
  getCriticalDomains(): PressureDomain[] {
    return PRESSURE_DOMAINS.filter((d) => this.state[d].level >= 0.75);
  }

  /**
   * Apply an external pressure spike to a domain.
   * Used by climate events, black swans, and cold branches to inject
   * one-time pressure additions outside the normal accumulation cycle.
   */
  applySpike(domain: PressureDomain, amount: number): void {
    const gauge = this.state[domain];
    gauge.level = Math.min(1, Math.max(0, gauge.level + amount));
  }

  /** Reset all pressure to zero. */
  reset(): void {
    this.state = createPressureState();
  }

  /** Serialize for save/load. */
  serialize(): PressureStateSaveData {
    return serializePressureState(this.state);
  }

  /** Restore from saved data. */
  restore(data: PressureStateSaveData): void {
    this.state = restorePressureState(data);
  }
}
