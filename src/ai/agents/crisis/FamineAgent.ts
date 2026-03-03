/**
 * @module ai/agents/crisis/FamineAgent
 *
 * Crisis agent for famine events. Handles any famine via parameterized
 * behavior — from the 1921-22 Russian famine to the Holodomor to
 * post-war food crises.
 *
 * Phase lifecycle: buildup → peak → aftermath → resolved
 *
 * Compounds with active wars: food drain and disease are amplified
 * when a war crisis is concurrent.
 */

import type {
  CrisisAgentSaveData,
  CrisisContext,
  CrisisDefinition,
  CrisisImpact,
  CrisisPhase,
  ICrisisAgent,
} from './types';

// ─── Severity Scaling Tables ────────────────────────────────────────────────

/** Per-tick food drain per capita at peak, by severity. */
const FOOD_DRAIN_PER_CAPITA: Record<string, number> = {
  localized: 0.1,
  regional: 0.2,
  national: 0.4,
  existential: 0.6,
};

/** Disease multiplier range at peak, by severity. */
const DISEASE_MULT: Record<string, number> = {
  localized: 1.5,
  regional: 2.0,
  national: 2.5,
  existential: 3.0,
};

/** Morale modifier at peak, by severity. */
const MORALE_HIT: Record<string, number> = {
  localized: -0.3,
  regional: -0.5,
  national: -0.6,
  existential: -0.8,
};

/** Growth multiplier at peak, by severity. */
const GROWTH_MULT: Record<string, number> = {
  localized: 0.3,
  regional: 0.25,
  national: 0.2,
  existential: 0.1,
};

/** Production multiplier at peak, by severity. */
const PRODUCTION_MULT: Record<string, number> = {
  localized: 0.6,
  regional: 0.5,
  national: 0.4,
  existential: 0.3,
};

// ─── Pravda Headlines ───────────────────────────────────────────────────────

const BUILDUP_HEADLINES = [
  'TEMPORARY AGRICULTURAL SHORTFALL — PARTY ASSURES ADEQUATE RESERVES',
  'COMRADES URGED TO PRACTICE FOOD ECONOMY FOR THE COLLECTIVE',
  'AGRICULTURAL MINISTRY REPORTS MINOR CROP DEVIATION FROM PLAN',
];

const PEAK_HEADLINES = [
  'HEROIC WORKERS PERSEVERE THROUGH DIFFICULT HARVEST CONDITIONS',
  'STATE GRAIN RESERVES DEPLOYED TO REGIONS IN NEED',
  'PARTY CONDEMNS SABOTEURS AND HOARDERS OF GRAIN',
  'SOCIALIST SOLIDARITY OVERCOMES TEMPORARY FOOD DIFFICULTIES',
];

const AFTERMATH_HEADLINES = [
  'AGRICULTURAL RECOVERY UNDERWAY — NEW SOWING CAMPAIGN BEGINS',
  'FOOD SITUATION NORMALIZING THANKS TO PARTY LEADERSHIP',
];

// ─── War Compounding Constants ──────────────────────────────────────────────

const WAR_FOOD_AMPLIFIER = 1.5;
const WAR_DISEASE_AMPLIFIER = 1.3;

// ─── FamineAgent ────────────────────────────────────────────────────────────

export class FamineAgent implements ICrisisAgent {
  private definition!: CrisisDefinition;
  private phase: CrisisPhase = 'resolved';
  private ticksInPhase = 0;
  private configured = false;

  /** Configure the agent with a famine crisis definition. */
  configure(def: CrisisDefinition): void {
    this.definition = def;
    this.phase = 'buildup';
    this.ticksInPhase = 0;
    this.configured = true;
  }

  /** Whether this crisis is currently active (not resolved). */
  isActive(): boolean {
    return this.configured && this.phase !== 'resolved';
  }

  /** Current lifecycle phase. */
  getPhase(): CrisisPhase {
    return this.phase;
  }

  /** Evaluate current tick and return crisis impact tickets. */
  evaluate(ctx: CrisisContext): CrisisImpact[] {
    if (!this.configured || this.phase === 'resolved') {
      return [];
    }

    this.ticksInPhase++;

    const hasActiveWar = ctx.activeCrises.some((id) => id.includes('war'));
    let impact: CrisisImpact;

    switch (this.phase) {
      case 'buildup':
        impact = this.evaluateBuildup(ctx);
        if (this.ticksInPhase >= this.definition.buildupTicks) {
          this.phase = 'peak';
          this.ticksInPhase = 0;
        }
        break;

      case 'peak':
        impact = this.evaluatePeak(ctx, hasActiveWar);
        // Peak duration: total crisis ticks minus buildup and aftermath
        if (this.ticksInPhase >= this.peakDuration()) {
          this.phase = 'aftermath';
          this.ticksInPhase = 0;
        }
        break;

      case 'aftermath':
        impact = this.evaluateAftermath(ctx);
        if (this.ticksInPhase >= this.definition.aftermathTicks) {
          this.phase = 'resolved';
          this.ticksInPhase = 0;
        }
        break;

      default:
        return [];
    }

    return [impact];
  }

  /** Serialize agent state for save persistence. */
  serialize(): CrisisAgentSaveData {
    return {
      definition: this.definition,
      phase: this.phase,
      ticksInPhase: this.ticksInPhase,
    };
  }

  /** Restore agent state from saved data. */
  restore(data: CrisisAgentSaveData): void {
    this.definition = data.definition;
    this.phase = data.phase;
    this.ticksInPhase = data.ticksInPhase;
    this.configured = true;
  }

  // ─── Phase Evaluators ───────────────────────────────────────────────────

  /**
   * Buildup phase: food production declining, warning toasts.
   * Ramp factor goes from 0 → 1 over buildupTicks.
   */
  private evaluateBuildup(ctx: CrisisContext): CrisisImpact {
    const ramp = this.definition.buildupTicks > 0 ? this.ticksInPhase / this.definition.buildupTicks : 1;
    const severity = this.definition.severity;

    // Production mult ramps from 0.9 down toward peak value
    const peakProd = PRODUCTION_MULT[severity] ?? 0.5;
    const productionMult = 1.0 - ramp * (1.0 - peakProd) * 0.5; // partial ramp during buildup

    // Growth begins declining
    const peakGrowth = GROWTH_MULT[severity] ?? 0.2;
    const growthMult = 1.0 - ramp * (1.0 - peakGrowth) * 0.3;

    const headline = ctx.rng.pick(BUILDUP_HEADLINES);

    return {
      crisisId: this.definition.id,
      economy: {
        productionMult,
      },
      social: {
        growthMult,
      },
      narrative: {
        pravdaHeadlines: [headline],
        toastMessages:
          ramp > 0.5
            ? [{ text: 'COMRADES, CONSERVE GRAIN — TEMPORARY SHORTFALL EXPECTED', severity: 'warning' as const }]
            : [],
      },
    };
  }

  /**
   * Peak phase: direct food drain, starvation deaths, disease spike,
   * severe morale plunge, production heavily reduced.
   */
  private evaluatePeak(ctx: CrisisContext, hasActiveWar: boolean): CrisisImpact {
    const severity = this.definition.severity;

    // Food drain: proportional to population
    const drainPerCapita = FOOD_DRAIN_PER_CAPITA[severity] ?? 0.2;
    let foodDelta = -(ctx.population * drainPerCapita);

    // Disease multiplier
    let diseaseMult = DISEASE_MULT[severity] ?? 2.0;

    // War compounding
    if (hasActiveWar) {
      foodDelta *= WAR_FOOD_AMPLIFIER;
      diseaseMult *= WAR_DISEASE_AMPLIFIER;
    }

    // Starvation casualties: severity-scaled fraction of population
    const casualtyRate = drainPerCapita * 0.01;
    const casualtyCount = Math.max(1, Math.floor(ctx.population * casualtyRate));

    const moraleModifier = MORALE_HIT[severity] ?? -0.5;
    const growthMult = GROWTH_MULT[severity] ?? 0.2;
    const productionMult = PRODUCTION_MULT[severity] ?? 0.5;

    const headline = ctx.rng.pick(PEAK_HEADLINES);

    return {
      crisisId: this.definition.id,
      economy: {
        productionMult,
        foodDelta,
      },
      workforce: {
        casualtyCount,
        moraleModifier,
      },
      social: {
        diseaseMult,
        growthMult,
      },
      narrative: {
        pravdaHeadlines: [headline],
        toastMessages: [{ text: 'STARVATION SPREADING — GRAIN RESERVES DEPLETED', severity: 'critical' as const }],
      },
    };
  }

  /**
   * Aftermath phase: gradual recovery — production improving,
   * disease lingering, morale slowly recovering.
   * Recovery factor goes from 0 → 1 over aftermathTicks.
   */
  private evaluateAftermath(ctx: CrisisContext): CrisisImpact {
    const recovery = this.definition.aftermathTicks > 0 ? this.ticksInPhase / this.definition.aftermathTicks : 1;
    const severity = this.definition.severity;

    // Production recovering toward 1.0
    const peakProd = PRODUCTION_MULT[severity] ?? 0.5;
    const productionMult = peakProd + recovery * (1.0 - peakProd);

    // Disease slowly returning to 1.0
    const peakDisease = DISEASE_MULT[severity] ?? 2.0;
    const diseaseMult = peakDisease - recovery * (peakDisease - 1.0);

    // Growth slowly returning to normal
    const peakGrowth = GROWTH_MULT[severity] ?? 0.2;
    const growthMult = peakGrowth + recovery * (1.0 - peakGrowth);

    // Morale slow recovery
    const peakMorale = MORALE_HIT[severity] ?? -0.5;
    const moraleModifier = peakMorale * (1.0 - recovery);

    const headline = ctx.rng.pick(AFTERMATH_HEADLINES);

    return {
      crisisId: this.definition.id,
      economy: {
        productionMult,
      },
      workforce: {
        moraleModifier,
      },
      social: {
        diseaseMult,
        growthMult,
      },
      narrative: {
        pravdaHeadlines: [headline],
      },
    };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  /**
   * Calculate peak duration as total crisis span minus buildup/aftermath.
   * Minimum 1 tick so peak always occurs.
   */
  private peakDuration(): number {
    const totalYears = this.definition.endYear - this.definition.startYear;
    // Assume ~12 ticks/year as a baseline
    const totalTicks = Math.max(1, totalYears * 12);
    return Math.max(1, totalTicks - this.definition.buildupTicks - this.definition.aftermathTicks);
  }
}
