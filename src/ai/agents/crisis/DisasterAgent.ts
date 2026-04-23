/**
 * @module ai/agents/crisis/DisasterAgent
 *
 * Parameterized disaster agent — handles ANY disaster type (nuclear,
 * seismic, environmental, industrial) via phase-based behavior driven
 * by CrisisDefinition peakParams.
 *
 * Disaster subtypes and their peakParams conventions:
 *   - Nuclear (Chernobyl, Kyshtym): high diseaseMult, moderate destruction, very long aftermath
 *   - Seismic (Armenian earthquake): high destructionCount, high casualtyCount, short aftermath
 *   - Environmental (Aral Sea): near-zero immediate damage, decades of productionMult decline
 *   - Industrial (Nedelin): localized destruction + casualties, short aftermath
 *
 * Phase lifecycle:
 *   buildup  → warning signs, minor production dips, toast warnings
 *   peak     → immediate destruction, casualties, infrastructure damage (single tick)
 *   aftermath → long-term disease, decay, production decline (exponential decay)
 *   resolved → no impact
 */

import type {
  CrisisAgentSaveData,
  CrisisContext,
  CrisisDefinition,
  CrisisImpact,
  CrisisPhase,
  ICrisisAgent,
} from './types';

// ─── Peak Param Keys ────────────────────────────────────────────────────────

/**
 * Expected peakParams keys for disaster definitions.
 * All are optional — absent keys default to 0 or 1.0 (neutral).
 */
export const DISASTER_PARAM_KEYS = {
  /** Number of buildings to destroy at peak. */
  destructionCount: 'destructionCount',
  /** Immediate deaths at peak. */
  casualtyCount: 'casualtyCount',
  /** Money cost at peak (positive = cost, applied as negative delta). */
  moneyCost: 'moneyCost',
  /** Production multiplier at peak (0-1, lower = worse). */
  productionMult: 'productionMult',
  /** Disease rate multiplier during aftermath (>1 = more disease). */
  diseaseMult: 'diseaseMult',
  /** Decay rate multiplier during aftermath (>1 = faster decay). */
  decayMult: 'decayMult',
  /** Morale modifier at peak (-1 to 0). */
  moralePenalty: 'moralePenalty',
  /** Population growth multiplier during aftermath (0-1). */
  growthMult: 'growthMult',
} as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Read a numeric param with a default value. */
function param(peakParams: Record<string, number>, key: string, defaultValue: number): number {
  const v = peakParams[key];
  return v !== undefined ? v : defaultValue;
}

/**
 * Exponential decay curve for aftermath effects.
 * Returns a value in (0, 1] that starts at 1.0 and decays toward 0
 * as ticksElapsed approaches totalTicks.
 *
 * Uses: intensity = exp(-3 * t / T)
 * At t=0: 1.0, at t=T: ~0.05 (95% decayed).
 */
export function aftermathDecay(ticksElapsed: number, totalTicks: number): number {
  if (totalTicks <= 0) return 0;
  const t = Math.min(ticksElapsed, totalTicks);
  return Math.exp(-3 * (t / totalTicks));
}

// ─── DisasterAgent ──────────────────────────────────────────────────────────

export class DisasterAgent implements ICrisisAgent {
  private definition!: CrisisDefinition;
  private phase: CrisisPhase = 'resolved';
  private ticksInPhase = 0;
  private configured = false;

  /** Whether the crisis has ever been started (prevents re-activation). */
  private hasStarted = false;

  // ── ICrisisAgent ────────────────────────────────────────────────────────

  configure(def: CrisisDefinition): void {
    this.definition = def;
    this.phase = 'resolved';
    this.ticksInPhase = 0;
    this.hasStarted = false;
    this.configured = true;
  }

  evaluate(ctx: CrisisContext): CrisisImpact[] {
    if (!this.configured) return [];

    // Check if crisis should start (one-time trigger)
    if (this.phase === 'resolved') {
      if (!this.hasStarted && ctx.year >= this.definition.startYear) {
        this.hasStarted = true;
        if (this.definition.buildupTicks > 0) {
          this.phase = 'buildup';
          this.ticksInPhase = 0;
        } else {
          // Zero buildup — go straight to peak
          this.phase = 'peak';
          this.ticksInPhase = 0;
        }
      } else {
        return [];
      }
    }

    // Evaluate current phase and produce impact
    const result = this.evaluateCurrentPhase(ctx);

    // Advance tick counter (after evaluation)
    this.ticksInPhase++;

    // Check for phase transition (after tick increment)
    this.checkPhaseTransition();

    return result;
  }

  isActive(): boolean {
    return this.configured && this.phase !== 'resolved';
  }

  getPhase(): CrisisPhase {
    return this.phase;
  }

  serialize(): CrisisAgentSaveData {
    return {
      definition: this.definition,
      phase: this.phase,
      ticksInPhase: this.ticksInPhase,
      extra: {
        hasStarted: this.hasStarted,
      },
    };
  }

  restore(data: CrisisAgentSaveData): void {
    this.definition = data.definition;
    this.phase = data.phase;
    this.ticksInPhase = data.ticksInPhase;
    this.hasStarted = !!data.extra?.hasStarted;
    this.configured = true;
  }

  // ── Phase Evaluation ──────────────────────────────────────────────────

  private evaluateCurrentPhase(ctx: CrisisContext): CrisisImpact[] {
    switch (this.phase) {
      case 'buildup':
        return this.evaluateBuildup(ctx);
      case 'peak':
        return this.evaluatePeak(ctx);
      case 'aftermath':
        return this.evaluateAftermath(ctx);
      default:
        return [];
    }
  }

  /**
   * Check if current phase is complete and transition to next.
   * Called after ticksInPhase has been incremented.
   */
  private checkPhaseTransition(): void {
    switch (this.phase) {
      case 'buildup':
        if (this.ticksInPhase >= this.definition.buildupTicks) {
          this.phase = 'peak';
          this.ticksInPhase = 0;
        }
        break;
      case 'peak':
        // Peak is always exactly one tick for disasters
        this.phase = 'aftermath';
        this.ticksInPhase = 0;
        break;
      case 'aftermath':
        if (this.ticksInPhase >= this.definition.aftermathTicks) {
          this.phase = 'resolved';
          this.ticksInPhase = 0;
        }
        break;
    }
  }

  // ── Phase Evaluators ──────────────────────────────────────────────────

  private evaluateBuildup(_ctx: CrisisContext): CrisisImpact[] {
    const pp = this.definition.peakParams;
    const buildupProgress = this.definition.buildupTicks > 0 ? this.ticksInPhase / this.definition.buildupTicks : 1;

    const impact: CrisisImpact = {
      crisisId: this.definition.id,
    };

    // Minor production dip ramping up during buildup
    const baseProdMult = param(pp, 'productionMult', 0.8);
    // Interpolate from 1.0 toward peak production mult (only 30% of peak effect)
    const prodMult = 1.0 - (1.0 - baseProdMult) * buildupProgress * 0.3;
    if (prodMult < 1.0) {
      impact.economy = { productionMult: prodMult };
    }

    // Warning toasts during buildup
    const toasts: Array<{ text: string; severity?: 'warning' | 'critical' | 'evacuation' }> = [];
    if (this.ticksInPhase === 0) {
      toasts.push({
        text: `Reports of unusual activity near ${this.definition.name} — monitoring situation`,
        severity: 'warning',
      });
    }
    const halfwayTick = Math.ceil(this.definition.buildupTicks * 0.5);
    if (buildupProgress > 0.5 && this.ticksInPhase === halfwayTick) {
      toasts.push({
        text: `Infrastructure stress indicators rising — ${this.definition.name} developing`,
        severity: 'warning',
      });
    }

    if (toasts.length > 0) {
      impact.narrative = { toastMessages: toasts };
    }

    return [impact];
  }

  private evaluatePeak(ctx: CrisisContext): CrisisImpact[] {
    const pp = this.definition.peakParams;
    const impact: CrisisImpact = {
      crisisId: this.definition.id,
    };

    // Destruction targets — select random grid positions
    const destructionCount = Math.floor(param(pp, 'destructionCount', 0));
    if (destructionCount > 0) {
      const targets: Array<{ gridX: number; gridY: number }> = [];
      for (let i = 0; i < destructionCount; i++) {
        targets.push({
          gridX: ctx.rng.int(0, 29),
          gridY: ctx.rng.int(0, 29),
        });
      }
      impact.infrastructure = { destructionTargets: targets };
    }

    // Casualties
    const casualtyCount = Math.floor(param(pp, 'casualtyCount', 0));
    if (casualtyCount > 0) {
      impact.workforce = {
        casualtyCount: Math.min(casualtyCount, ctx.population),
        moraleModifier: param(pp, 'moralePenalty', -0.3),
      };
    } else {
      // Even without casualties, disasters hit morale
      const moralePenalty = param(pp, 'moralePenalty', 0);
      if (moralePenalty < 0) {
        impact.workforce = { moraleModifier: moralePenalty };
      }
    }

    // Economy — money cost and production
    const moneyCost = param(pp, 'moneyCost', 0);
    const prodMult = param(pp, 'productionMult', 0.8);
    if (moneyCost > 0 || prodMult < 1.0) {
      impact.economy = {};
      if (moneyCost > 0) impact.economy.moneyDelta = -moneyCost;
      if (prodMult < 1.0) impact.economy.productionMult = prodMult;
    }

    // Peak narrative
    impact.narrative = {
      toastMessages: [
        {
          text: `TECHNICAL INCIDENT AT ${this.definition.name.toUpperCase()} — SITUATION UNDER CONTROL`,
          severity: 'critical',
        },
      ],
      pravdaHeadlines: [`MINOR INCIDENT AT ${this.definition.name.toUpperCase()} POSES NO THREAT TO HEROIC WORKERS`],
    };

    // Visual effects — nuclear flash for radiation disasters, earthquake shake for seismic, dust storm for others
    const peakDisease = param(pp, 'diseaseMult', 1.0);
    const hasDestruction = destructionCount > 0;
    if (peakDisease >= 2.0) {
      // Radiation disaster (Chernobyl-level) — bright nuclear flash
      impact.visual = { effect: 'nuclear_flash', intensity: 0.8, durationTicks: 60 };
    } else if (hasDestruction && this.definition.type === 'disaster') {
      // Seismic / structural disaster — camera shake
      impact.visual = { effect: 'earthquake_shake', intensity: 1.0, durationTicks: 12 };
    } else {
      // Environmental / industrial disaster — dust storm haze
      impact.visual = { effect: 'dust_storm', intensity: 0.7, durationTicks: 24 };
    }

    return [impact];
  }

  private evaluateAftermath(_ctx: CrisisContext): CrisisImpact[] {
    const pp = this.definition.peakParams;
    const decay = aftermathDecay(this.ticksInPhase, this.definition.aftermathTicks);

    const impact: CrisisImpact = {
      crisisId: this.definition.id,
    };

    // Disease multiplier — decays from peak value toward 1.0
    const peakDisease = param(pp, 'diseaseMult', 1.0);
    if (peakDisease > 1.0) {
      const currentDisease = 1.0 + (peakDisease - 1.0) * decay;
      impact.social = { diseaseMult: currentDisease };
    }

    // Decay multiplier — decays from peak value toward 1.0
    const peakDecay = param(pp, 'decayMult', 1.0);
    if (peakDecay > 1.0) {
      const currentDecay = 1.0 + (peakDecay - 1.0) * decay;
      impact.infrastructure = { decayMult: currentDecay };
    }

    // Production multiplier — decays from peak value toward 1.0
    const peakProd = param(pp, 'productionMult', 0.8);
    if (peakProd < 1.0) {
      const currentProd = 1.0 - (1.0 - peakProd) * decay;
      impact.economy = { productionMult: currentProd };
    }

    // Growth multiplier — decays from peak value toward 1.0
    const peakGrowth = param(pp, 'growthMult', 1.0);
    if (peakGrowth < 1.0) {
      const currentGrowth = 1.0 - (1.0 - peakGrowth) * decay;
      if (!impact.social) impact.social = {};
      impact.social.growthMult = currentGrowth;
    }

    return [impact];
  }
}
