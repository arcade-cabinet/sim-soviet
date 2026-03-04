/**
 * @module ai/agents/crisis/pressure/PressureCrisisEngine
 *
 * Monitors pressure gauges and triggers crisis emergence.
 * Replaces ChaosEngine's dice-roll approach with sustained-threshold detection.
 *
 * Three tiers of emergence:
 *   - Warning + sustained 6 ticks → minor incident (Pravda + morale)
 *   - Critical + sustained 12 ticks → major crisis (CrisisDefinition)
 *   - Emergency + sustained 3 ticks → fast-tracked major crisis
 *
 * Only fires ONE crisis per domain at a time (no spam).
 * Produces standard CrisisImpact[] and CrisisDefinition — downstream
 * pipeline (CrisisImpactApplicator) is unchanged.
 */

import type { CrisisDefinition, CrisisImpact } from '../types';
import { PRESSURE_DOMAINS, type PressureDomain, type PressureState } from './PressureDomains';
import {
  generateCrisisFromTemplate,
  MAJOR_CRISES,
  MINOR_INCIDENTS,
} from './pressureCrisisMapping';
import { SUSTAIN_TICKS, THRESHOLDS } from './pressureThresholds';

// ─── Engine State ────────────────────────────────────────────────────────────

/** Per-domain tracking of what's already been fired. */
interface DomainCrisisState {
  /** Whether a minor incident is currently active for this domain. */
  minorActive: boolean;
  /** Whether a major crisis is currently active for this domain. */
  majorActive: boolean;
  /** ID of the active major crisis (for tracking). */
  activeCrisisId: string | null;
}

/** Result of a single emergence check. */
export interface EmergenceResult {
  /** Minor incident impacts (Tier 1 warnings). */
  minorImpacts: CrisisImpact[];
  /** Major crisis definitions to spawn (Tier 1 critical). */
  majorCrises: CrisisDefinition[];
}

// ─── PressureCrisisEngine ────────────────────────────────────────────────────

/**
 * Monitors pressure state and produces crisis emergence events.
 */
export class PressureCrisisEngine {
  private domainStates: Record<PressureDomain, DomainCrisisState>;
  private crisisCounter = 0;

  constructor() {
    this.domainStates = {} as Record<PressureDomain, DomainCrisisState>;
    for (const domain of PRESSURE_DOMAINS) {
      this.domainStates[domain] = { minorActive: false, majorActive: false, activeCrisisId: null };
    }
  }

  /**
   * Check all domains for crisis emergence.
   * Called every tick from the governor pipeline.
   *
   * @param pressureState - Current pressure state from PressureSystem
   * @param year - Current game year (for crisis IDs)
   * @param activeCrisisIds - IDs of currently active crises (to prevent duplicates)
   */
  checkForEmergence(
    pressureState: PressureState,
    year: number,
    activeCrisisIds: string[],
  ): EmergenceResult {
    const result: EmergenceResult = { minorImpacts: [], majorCrises: [] };

    for (const domain of PRESSURE_DOMAINS) {
      const gauge = pressureState[domain];
      const ds = this.domainStates[domain];

      // Clean up: if a major crisis was active but is no longer in the active list, clear it
      if (ds.activeCrisisId && !activeCrisisIds.includes(ds.activeCrisisId)) {
        ds.majorActive = false;
        ds.activeCrisisId = null;
      }

      // ── Major crisis check (emergency fast-track OR sustained critical) ──
      if (!ds.majorActive) {
        const emergencyTriggered = gauge.level >= THRESHOLDS.EMERGENCY && gauge.criticalTicks >= SUSTAIN_TICKS.EMERGENCY_MAJOR;
        const criticalTriggered = gauge.level >= THRESHOLDS.CRITICAL && gauge.criticalTicks >= SUSTAIN_TICKS.CRITICAL_MAJOR;

        if (emergencyTriggered || criticalTriggered) {
          const template = MAJOR_CRISES[domain];
          const crisisId = `pressure-${domain}-${year}-${++this.crisisCounter}`;
          const crisis = generateCrisisFromTemplate(template, year, gauge.level, crisisId);
          result.majorCrises.push(crisis);
          ds.majorActive = true;
          ds.activeCrisisId = crisisId;
          ds.minorActive = false; // major supersedes minor
        }
      }

      // ── Minor incident check (sustained warning) ──
      if (!ds.majorActive && !ds.minorActive) {
        if (gauge.level >= THRESHOLDS.WARNING && gauge.warningTicks >= SUSTAIN_TICKS.WARNING_MINOR) {
          const template = MINOR_INCIDENTS[domain];
          result.minorImpacts.push(template.impact);
          ds.minorActive = true;
        }
      }

      // ── Clear minor if pressure drops below warning ──
      if (ds.minorActive && gauge.level < THRESHOLDS.WARNING) {
        ds.minorActive = false;
      }
    }

    return result;
  }

  /** Get IDs of all active pressure-driven major crises. */
  getActiveCrisisIds(): string[] {
    const ids: string[] = [];
    for (const domain of PRESSURE_DOMAINS) {
      if (this.domainStates[domain].activeCrisisId) {
        ids.push(this.domainStates[domain].activeCrisisId!);
      }
    }
    return ids;
  }

  /** Mark a crisis as resolved (agent finished its lifecycle). */
  resolveCrisis(crisisId: string): void {
    for (const domain of PRESSURE_DOMAINS) {
      if (this.domainStates[domain].activeCrisisId === crisisId) {
        this.domainStates[domain].majorActive = false;
        this.domainStates[domain].activeCrisisId = null;
        break;
      }
    }
  }

  /** Reset all domain states (new game). */
  reset(): void {
    for (const domain of PRESSURE_DOMAINS) {
      this.domainStates[domain] = { minorActive: false, majorActive: false, activeCrisisId: null };
    }
    this.crisisCounter = 0;
  }

  /** Serialize for save/load. */
  serialize(): { domainStates: Record<PressureDomain, DomainCrisisState>; crisisCounter: number } {
    const states = {} as Record<PressureDomain, DomainCrisisState>;
    for (const domain of PRESSURE_DOMAINS) {
      states[domain] = { ...this.domainStates[domain] };
    }
    return { domainStates: states, crisisCounter: this.crisisCounter };
  }

  /** Restore from saved data. */
  restore(data: { domainStates: Record<PressureDomain, DomainCrisisState>; crisisCounter: number }): void {
    for (const domain of PRESSURE_DOMAINS) {
      if (data.domainStates[domain]) {
        this.domainStates[domain] = { ...data.domainStates[domain] };
      }
    }
    this.crisisCounter = data.crisisCounter;
  }
}
