/**
 * @module ai/agents/crisis/WarAgent
 *
 * Parameterized war crisis agent. Handles ANY war (Civil War, GPW,
 * proxy conflicts, etc.) via CrisisDefinition peakParams.
 *
 * Phase lifecycle: resolved -> buildup -> peak -> aftermath -> resolved
 *
 * Key peakParams consumed:
 *   - conscriptionRate: fraction of population conscripted at peak (0-1)
 *   - productionMult: wartime production multiplier (e.g. 1.2 for fervor)
 *   - bombardmentRate: fraction of buildings targeted per tick at peak (0-1)
 *   - foodDrain: absolute food consumed per tick by war effort
 *   - moneyDrain: absolute money consumed per tick by war effort
 *   - veteranReturnRate: fraction of conscripted returned in aftermath (0-1)
 */

import { TICKS_PER_MONTH } from '@/game/Chronology';
import type {
  CrisisAgentSaveData,
  CrisisContext,
  CrisisDefinition,
  CrisisImpact,
  CrisisPhase,
  ICrisisAgent,
} from './types';

// ─── Severity → intensity mapping ────────────────────────────────────────────

const SEVERITY_INTENSITY: Record<string, number> = {
  localized: 0.25,
  regional: 0.5,
  national: 0.75,
  existential: 1.0,
};

// ─── Default peakParam values ────────────────────────────────────────────────

const DEFAULT_CONSCRIPTION_RATE = 0.1;
const DEFAULT_PRODUCTION_MULT = 1.15;
const DEFAULT_BOMBARDMENT_RATE = 0;
const DEFAULT_FOOD_DRAIN = 0;
const DEFAULT_MONEY_DRAIN = 0;
const DEFAULT_VETERAN_RETURN_RATE = 0.7;

// ─── Buildup narrative pool ──────────────────────────────────────────────────

const BUILDUP_HEADLINES = [
  'MOTHERLAND IN DANGER — MILITARY PREPARATIONS ACCELERATE',
  'BORDER TENSIONS ESCALATE — CITIZENS URGED TO REMAIN VIGILANT',
  'COMRADES! THE HOUR OF SACRIFICE APPROACHES',
];

const PEAK_HEADLINES = [
  'GLORIOUS FORCES ADVANCE ON ALL FRONTS',
  'FACTORIES RETOOLED FOR WARTIME PRODUCTION — QUOTAS DOUBLED',
  'HERO WORKERS EXCEED AMMUNITION TARGETS BY 200%',
  'ENEMY BOMBARDMENT DESTROYS CIVILIAN INFRASTRUCTURE',
];

const AFTERMATH_HEADLINES = [
  'VETERANS RETURN TO REBUILD THE MOTHERLAND',
  'WAR-WEARY CITIZENS CELEBRATE HARD-WON PEACE',
  'RECONSTRUCTION BRIGADES FORMED — EVERY HAND NEEDED',
];

// ─── WarAgent ────────────────────────────────────────────────────────────────

export class WarAgent implements ICrisisAgent {
  private definition: CrisisDefinition | null = null;
  private phase: CrisisPhase = 'resolved';
  private ticksInPhase = 0;
  private totalConscripted = 0;

  /** Configure with a war crisis definition. */
  configure(def: CrisisDefinition): void {
    this.definition = def;
    this.phase = 'buildup';
    this.ticksInPhase = 0;
    this.totalConscripted = 0;
  }

  /** Whether this crisis is currently in an active phase. */
  isActive(): boolean {
    return this.phase !== 'resolved';
  }

  /** Current lifecycle phase. */
  getPhase(): CrisisPhase {
    return this.phase;
  }

  /**
   * Evaluate current tick and produce CrisisImpact tickets.
   * Returns empty array when resolved or unconfigured.
   */
  evaluate(ctx: CrisisContext): CrisisImpact[] {
    if (!this.definition || this.phase === 'resolved') {
      return [];
    }

    this.ticksInPhase++;

    let impacts: CrisisImpact[];

    switch (this.phase) {
      case 'buildup':
        impacts = this.evaluateBuildup(ctx);
        if (this.ticksInPhase >= this.monthsToTicks(this.definition.buildupTicks)) {
          this.phase = 'peak';
          this.ticksInPhase = 0;
        }
        break;

      case 'peak':
        impacts = this.evaluatePeak(ctx);
        break;

      case 'aftermath':
        impacts = this.evaluateAftermath(ctx);
        if (this.ticksInPhase >= this.monthsToTicks(this.definition.aftermathTicks)) {
          this.phase = 'resolved';
          this.ticksInPhase = 0;
        }
        break;

      default:
        impacts = [];
    }

    return impacts;
  }

  /**
   * Advance from peak to aftermath. Called externally by the governor
   * when the crisis end condition is met.
   */
  transitionToAftermath(): void {
    if (this.phase === 'peak') {
      this.phase = 'aftermath';
      this.ticksInPhase = 0;
    }
  }

  /** Serialize agent state for save/load. */
  serialize(): CrisisAgentSaveData {
    return {
      definition: this.definition!,
      phase: this.phase,
      ticksInPhase: this.ticksInPhase,
      extra: {
        totalConscripted: this.totalConscripted,
      },
    };
  }

  /** Restore agent state from saved data. */
  restore(data: CrisisAgentSaveData): void {
    this.definition = data.definition;
    this.phase = data.phase;
    this.ticksInPhase = data.ticksInPhase;
    this.totalConscripted = (data.extra?.totalConscripted as number) ?? 0;
  }

  // ─── Phase evaluators ──────────────────────────────────────────────────────

  private evaluateBuildup(ctx: CrisisContext): CrisisImpact[] {
    const def = this.definition!;
    const intensity = SEVERITY_INTENSITY[def.severity] ?? 0.5;

    // Ramp fraction: 0 at start → 1 at end of buildup
    const buildupTicks = this.monthsToTicks(def.buildupTicks);
    const ramp = buildupTicks > 0 ? this.ticksInPhase / buildupTicks : 1;
    const monthlyPulse = this.isMonthlyPulse();

    const conscriptionRate = this.param('conscriptionRate', DEFAULT_CONSCRIPTION_RATE);
    const rampedConscription = monthlyPulse ? Math.floor((ctx.population * conscriptionRate * ramp * 0.3) / 12) : 0;

    const impact: CrisisImpact = {
      crisisId: def.id,
      economy: {
        moneyDelta: monthlyPulse ? -Math.floor(this.getMoneyDrain() * ramp * intensity) : 0,
      },
      workforce: {
        conscriptionCount: rampedConscription,
        moraleModifier: -0.05 * ramp * intensity,
      },
      political: {
        kgbAggressionMult: 1 + 0.3 * ramp * intensity,
      },
    };

    this.totalConscripted += rampedConscription;

    // Narrative: occasional propaganda during buildup
    if (monthlyPulse && ctx.rng.coinFlip(0.15)) {
      impact.narrative = {
        toastMessages: [{ text: 'THE MOTHERLAND CALLS \u2014 PREPARE FOR SACRIFICE', severity: 'warning' }],
        pravdaHeadlines: [ctx.rng.pick(BUILDUP_HEADLINES)],
      };
    }

    return [impact];
  }

  private evaluatePeak(ctx: CrisisContext): CrisisImpact[] {
    const def = this.definition!;
    const intensity = SEVERITY_INTENSITY[def.severity] ?? 0.5;
    const monthlyPulse = this.isMonthlyPulse();

    const conscriptionRate = this.param('conscriptionRate', DEFAULT_CONSCRIPTION_RATE);
    const conscriptionCount = monthlyPulse
      ? this.monthlyPopulationCount(ctx.population, conscriptionRate * intensity)
      : 0;
    const casualtyRate = this.param('casualtyRate', 0);
    const casualtyCount = monthlyPulse ? Math.floor(ctx.population * casualtyRate * intensity) : 0;
    const productionMult = this.param('productionMult', DEFAULT_PRODUCTION_MULT);
    const foodDrain = monthlyPulse ? this.getFoodDrain(ctx) : 0;
    const moneyDrain = monthlyPulse ? this.getMoneyDrain() : 0;
    const bombardmentRate = this.getBombardmentRate();

    this.totalConscripted += conscriptionCount;

    const impact: CrisisImpact = {
      crisisId: def.id,
      economy: {
        productionMult,
        foodDelta: -Math.floor(foodDrain * intensity),
        moneyDelta: -Math.floor(moneyDrain * intensity),
      },
      workforce: {
        conscriptionCount,
        casualtyCount,
        moraleModifier: -0.15 * intensity,
      },
      political: {
        kgbAggressionMult: 1 + 0.5 * intensity,
        quotaMult: 1 + 0.3 * intensity,
      },
      social: {
        diseaseMult: 1 + 0.3 * intensity,
        growthMult: 1 - 0.4 * intensity,
      },
    };

    // Bombardment: random building destruction during peak
    const numTargets =
      monthlyPulse && bombardmentRate > 0 ? Math.max(1, Math.floor(bombardmentRate * intensity * 10)) : 0;
    if (numTargets > 0) {
      const targets: Array<{ gridX: number; gridY: number }> = [];
      for (let i = 0; i < numTargets; i++) {
        targets.push({
          gridX: ctx.rng.int(0, 29),
          gridY: ctx.rng.int(0, 29),
        });
      }
      impact.infrastructure = {
        decayMult: 1 + 0.5 * intensity,
        destructionTargets: targets,
      };
    }

    // Narrative during peak
    if (monthlyPulse && ctx.rng.coinFlip(0.25)) {
      impact.narrative = {
        pravdaHeadlines: [ctx.rng.pick(PEAK_HEADLINES)],
        toastMessages:
          numTargets > 0
            ? [
                {
                  text: `Enemy bombardment! ${numTargets} target${numTargets > 1 ? 's' : ''} hit!`,
                  severity: 'critical',
                },
              ]
            : [],
      };
    }

    return [impact];
  }

  private evaluateAftermath(ctx: CrisisContext): CrisisImpact[] {
    const def = this.definition!;
    const intensity = SEVERITY_INTENSITY[def.severity] ?? 0.5;

    // Decay fraction: 1 at start → 0 at end of aftermath
    const aftermathTicks = this.monthsToTicks(def.aftermathTicks);
    const decay = aftermathTicks > 0 ? 1 - this.ticksInPhase / aftermathTicks : 0;
    const monthlyPulse = this.isMonthlyPulse();

    const veteranReturnRate = this.param('veteranReturnRate', DEFAULT_VETERAN_RETURN_RATE);

    // Return veterans gradually over the aftermath period
    const totalToReturn = Math.floor(this.totalConscripted * veteranReturnRate);
    const returningPerMonth = monthlyPulse ? Math.floor(totalToReturn / Math.max(def.aftermathTicks, 1)) : 0;

    const impact: CrisisImpact = {
      crisisId: def.id,
      workforce: {
        // Negative conscription = veteran returns
        conscriptionCount: -returningPerMonth,
        moraleModifier: -0.05 * decay * intensity,
      },
      infrastructure: {
        decayMult: 1 + 0.3 * decay * intensity,
      },
      social: {
        growthMult: 1 - 0.2 * decay * intensity,
      },
    };

    // Occasional narrative during aftermath
    if (monthlyPulse && ctx.rng.coinFlip(0.1)) {
      impact.narrative = {
        pravdaHeadlines: [ctx.rng.pick(AFTERMATH_HEADLINES)],
      };
    }

    return [impact];
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /** Read a peakParam with a default fallback. */
  private param(key: string, fallback: number): number {
    return this.definition?.peakParams[key] ?? fallback;
  }

  /** Crisis JSON durations are authored in simulation months. */
  private monthsToTicks(months: number): number {
    return Math.max(1, months * TICKS_PER_MONTH);
  }

  private isMonthlyPulse(): boolean {
    return this.ticksInPhase > 0 && this.ticksInPhase % TICKS_PER_MONTH === 0;
  }

  private monthlyPopulationCount(population: number, annualRate: number): number {
    if (population <= 0 || annualRate <= 0) return 0;
    return Math.max(1, Math.floor((population * annualRate) / 12));
  }

  private getBombardmentRate(): number {
    return (
      this.definition?.peakParams.bombardmentRate ??
      this.definition?.peakParams.bombardmentChance ??
      DEFAULT_BOMBARDMENT_RATE
    );
  }

  private getFoodDrain(ctx: CrisisContext): number {
    const absoluteDrain = this.definition?.peakParams.foodDrain;
    if (absoluteDrain !== undefined) return Math.floor(absoluteDrain);

    const requisitionRate = this.definition?.peakParams.foodRequisitionRate;
    if (requisitionRate !== undefined) {
      return Math.floor((ctx.food * requisitionRate) / 12);
    }

    return DEFAULT_FOOD_DRAIN;
  }

  private getMoneyDrain(): number {
    const absoluteDrain = this.definition?.peakParams.moneyDrain;
    if (absoluteDrain !== undefined) return Math.floor(absoluteDrain);

    const moneyDelta = this.definition?.peakParams.moneyDelta;
    if (moneyDelta !== undefined) return Math.floor(Math.abs(moneyDelta));

    return DEFAULT_MONEY_DRAIN;
  }
}
