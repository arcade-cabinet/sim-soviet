/**
 * @module ai/agents/crisis/pressure/PressureSystem
 *
 * Orchestrator for the historical pressure-valve crisis system.
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

export class PressureSystem {
  private state: PressureState;

  constructor() {
    this.state = createPressureState();
  }

  tick(ctx: PressureReadContext, worldModifiers: Partial<Record<PressureDomain, number>> = {}): void {
    const rawReadings = normalizeAllDomains(ctx);
    this.state = tickPressure(this.state, rawReadings, worldModifiers);
  }

  getState(): Readonly<PressureState> {
    return this.state;
  }

  getLevel(domain: PressureDomain): number {
    return this.state[domain].level;
  }

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

  getWarningDomains(): PressureDomain[] {
    return PRESSURE_DOMAINS.filter((d) => this.state[d].level >= 0.5);
  }

  getCriticalDomains(): PressureDomain[] {
    return PRESSURE_DOMAINS.filter((d) => this.state[d].level >= 0.75);
  }

  applySpike(domain: PressureDomain, amount: number): void {
    const gauge = this.state[domain];
    gauge.level = Math.min(1, Math.max(0, gauge.level + amount));
  }

  reset(): void {
    this.state = createPressureState();
  }

  serialize(): PressureStateSaveData {
    return serializePressureState(this.state);
  }

  restore(data: PressureStateSaveData): void {
    this.state = restorePressureState(data);
  }
}
