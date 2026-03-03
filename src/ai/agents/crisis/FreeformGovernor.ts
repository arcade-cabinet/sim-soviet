/**
 * @module ai/agents/crisis/FreeformGovernor
 *
 * Governor for Freeform (alternate-history) mode.
 *
 * Plays real Soviet history up to a configurable divergence year,
 * then branches into procedurally generated alternate history using
 * the ChaosEngine. Records all events to a TimelineSystem for
 * causal chain tracking and chaos engine feedback.
 *
 * Pre-divergence: delegates entirely to HistoricalGovernor.
 * At divergence: records a DivergencePoint, switches to ChaosEngine.
 * Post-divergence: generates crises via ChaosEngine, manages active
 * crisis agents, merges impacts into DynamicModifiers.
 */

import type {
  IGovernor,
  GovernorContext,
  GovernorDirective,
  DynamicModifiers,
  GovernorSaveData,
} from './Governor';
import { DEFAULT_MODIFIERS } from './Governor';
import type {
  CrisisImpact,
  CrisisContext,
  ICrisisAgent,
  CrisisDefinition,
  CrisisAgentSaveData,
} from './types';
import { HistoricalGovernor } from './HistoricalGovernor';
import { ChaosEngine, ChaosState } from './ChaosEngine';
import { TimelineSystem, TimelineEvent } from './TimelineSystem';
import { WarAgent } from './WarAgent';
import { FamineAgent } from './FamineAgent';
import { DisasterAgent } from './DisasterAgent';
import { GameRng } from '@/game/SeedSystem';

// ─── Agent Factory ──────────────────────────────────────────────────────────

/** Create a crisis agent for the given crisis type. */
function createAgentForType(type: string): ICrisisAgent | null {
  switch (type) {
    case 'war':
      return new WarAgent();
    case 'famine':
      return new FamineAgent();
    case 'disaster':
      return new DisasterAgent();
    default:
      return null;
  }
}

// ─── Freeform Agent Entry ───────────────────────────────────────────────────

/** Tracking entry for a chaos-generated crisis agent. */
interface FreeformAgentEntry {
  definition: CrisisDefinition;
  agent: ICrisisAgent;
}

// ─── FreeformGovernor ───────────────────────────────────────────────────────

export class FreeformGovernor implements IGovernor {
  private divergenceYear: number;
  private diverged = false;
  private historicalGovernor: HistoricalGovernor;
  private chaosEngine: ChaosEngine;
  private timeline: TimelineSystem;
  private rng: GameRng;
  private activeFreeformAgents: Map<string, FreeformAgentEntry> = new Map();

  /** Year-since counters for chaos engine state. */
  private yearsSinceLastWar = 0;
  private yearsSinceLastFamine = 0;
  private yearsSinceLastDisaster = 0;
  private yearsSinceLastPolitical = 0;

  /** Last year we checked for new crises (to avoid duplicate checks). */
  private lastCrisisCheckYear = 0;

  constructor(divergenceYear: number, rng: GameRng) {
    this.divergenceYear = divergenceYear;
    this.rng = rng;
    this.historicalGovernor = new HistoricalGovernor();
    this.chaosEngine = new ChaosEngine();
    this.timeline = new TimelineSystem();
  }

  /** Evaluate the current tick and return a directive. */
  evaluate(ctx: GovernorContext): GovernorDirective {
    if (ctx.year < this.divergenceYear) {
      // Pre-divergence: delegate to historical governor
      const directive = this.historicalGovernor.evaluate(ctx);

      // Record active historical crises to the timeline
      this.recordHistoricalCrises(ctx);

      return directive;
    }

    // At divergence point: record and switch
    if (!this.diverged) {
      this.diverged = true;
      this.timeline.recordDivergence({
        year: ctx.year,
        month: ctx.month,
        historicalContext: `Diverged from Soviet history at ${ctx.year}`,
        playerChoice: 'freeform_start',
        divergenceTick: ctx.totalTicks,
      });
    }

    // Post-divergence: use chaos engine
    return this.evaluateFreeform(ctx);
  }

  /** Return IDs of all currently active crises. */
  getActiveCrises(): string[] {
    if (!this.diverged) {
      return this.historicalGovernor.getActiveCrises();
    }

    const active: string[] = [];
    for (const [id, entry] of this.activeFreeformAgents) {
      if (entry.agent.isActive()) {
        active.push(id);
      }
    }
    return active;
  }

  /** Called at the start of each new game year. */
  onYearBoundary(year: number): void {
    if (!this.diverged) {
      this.historicalGovernor.onYearBoundary(year);
    }

    // Increment year-since counters
    this.yearsSinceLastWar++;
    this.yearsSinceLastFamine++;
    this.yearsSinceLastDisaster++;
    this.yearsSinceLastPolitical++;
  }

  /** Serialize governor state for save persistence. */
  serialize(): GovernorSaveData {
    const agentStates: Record<string, CrisisAgentSaveData> = {};
    for (const [id, entry] of this.activeFreeformAgents) {
      agentStates[id] = entry.agent.serialize();
    }

    return {
      mode: 'freeform',
      activeCrises: this.getActiveCrises(),
      state: {
        divergenceYear: this.divergenceYear,
        diverged: this.diverged,
        seed: this.rng.seed,
        historicalGovernor: this.historicalGovernor.serialize(),
        timeline: this.timeline.serialize(),
        agentStates,
        yearsSinceLastWar: this.yearsSinceLastWar,
        yearsSinceLastFamine: this.yearsSinceLastFamine,
        yearsSinceLastDisaster: this.yearsSinceLastDisaster,
        yearsSinceLastPolitical: this.yearsSinceLastPolitical,
        lastCrisisCheckYear: this.lastCrisisCheckYear,
      },
    };
  }

  /** Restore governor state from saved data. */
  restore(data: GovernorSaveData): void {
    const s = data.state;

    this.divergenceYear = (s['divergenceYear'] as number) ?? this.divergenceYear;
    this.diverged = (s['diverged'] as boolean) ?? false;
    this.yearsSinceLastWar = (s['yearsSinceLastWar'] as number) ?? 0;
    this.yearsSinceLastFamine = (s['yearsSinceLastFamine'] as number) ?? 0;
    this.yearsSinceLastDisaster = (s['yearsSinceLastDisaster'] as number) ?? 0;
    this.yearsSinceLastPolitical = (s['yearsSinceLastPolitical'] as number) ?? 0;
    this.lastCrisisCheckYear = (s['lastCrisisCheckYear'] as number) ?? 0;

    // Restore historical governor
    const histData = s['historicalGovernor'] as GovernorSaveData | undefined;
    if (histData) {
      this.historicalGovernor.restore(histData);
    }

    // Restore timeline
    const timelineData = s['timeline'] as ReturnType<TimelineSystem['serialize']> | undefined;
    if (timelineData) {
      this.timeline.restore(timelineData);
    }

    // Restore RNG from seed
    const seed = s['seed'] as string | undefined;
    if (seed) {
      this.rng = new GameRng(seed);
    }

    // Restore freeform agents
    const agentStates = (s['agentStates'] as Record<string, CrisisAgentSaveData>) ?? {};
    this.activeFreeformAgents.clear();
    for (const [id, agentData] of Object.entries(agentStates)) {
      const agent = createAgentForType(agentData.definition.type);
      if (agent) {
        agent.configure(agentData.definition);
        agent.restore(agentData);
        this.activeFreeformAgents.set(id, {
          definition: agentData.definition,
          agent,
        });
      }
    }
  }

  /** Get the timeline system (for testing/inspection). */
  getTimeline(): TimelineSystem {
    return this.timeline;
  }

  /** Whether the governor has passed the divergence point. */
  hasDiverged(): boolean {
    return this.diverged;
  }

  // ─── Private: Freeform Evaluation ──────────────────────────────────────────

  private evaluateFreeform(ctx: GovernorContext): GovernorDirective {
    // Check for new crises from chaos engine (once per year, at month 1)
    if (ctx.month === 1 && ctx.year > this.lastCrisisCheckYear) {
      this.lastCrisisCheckYear = ctx.year;

      const chaosState: ChaosState = {
        year: ctx.year,
        population: ctx.population,
        food: ctx.food,
        money: ctx.money,
        yearsSinceLastWar: this.yearsSinceLastWar,
        yearsSinceLastFamine: this.yearsSinceLastFamine,
        yearsSinceLastDisaster: this.yearsSinceLastDisaster,
        yearsSinceLastPolitical: this.yearsSinceLastPolitical,
        activeCrises: [...this.activeFreeformAgents.keys()],
        totalCrisesExperienced: this.timeline.getAllEvents().length,
      };

      const newCrisis = this.chaosEngine.generateNextCrisis(
        chaosState,
        this.timeline.getAllEvents(),
        this.rng,
      );

      if (newCrisis) {
        this.activateFreeformCrisis(newCrisis, ctx);
      }
    }

    // Evaluate all active agents
    const allImpacts: CrisisImpact[] = [];
    const activeCrisisIds = this.getActiveCrises();

    const crisisCtx: CrisisContext = {
      year: ctx.year,
      month: ctx.month,
      population: ctx.population,
      food: ctx.food,
      money: ctx.money,
      rng: ctx.rng,
      activeCrises: activeCrisisIds,
    };

    for (const [id, entry] of this.activeFreeformAgents) {
      if (entry.agent.isActive()) {
        const impacts = entry.agent.evaluate(crisisCtx);
        allImpacts.push(...impacts);
      } else {
        // Agent resolved — record end event
        this.activeFreeformAgents.delete(id);
      }
    }

    // Merge impacts into DynamicModifiers
    const modifiers = this.mergeModifiers(allImpacts);

    return {
      crisisImpacts: allImpacts,
      modifiers,
    };
  }

  // ─── Private: Crisis Activation ────────────────────────────────────────────

  private activateFreeformCrisis(def: CrisisDefinition, ctx: GovernorContext): void {
    const agent = createAgentForType(def.type);
    if (!agent) return;

    agent.configure(def);
    this.activeFreeformAgents.set(def.id, { definition: def, agent });

    // Reset year-since counter for this crisis type
    switch (def.type) {
      case 'war':
        this.yearsSinceLastWar = 0;
        break;
      case 'famine':
        this.yearsSinceLastFamine = 0;
        break;
      case 'disaster':
        this.yearsSinceLastDisaster = 0;
        break;
      case 'political':
        this.yearsSinceLastPolitical = 0;
        break;
    }

    // Record to timeline
    this.timeline.recordEvent({
      eventId: def.id,
      crisisType: def.type,
      name: def.name,
      startYear: def.startYear,
      endYear: def.endYear,
      isHistorical: false,
      parameters: { ...def.peakParams },
      recordedTick: ctx.totalTicks,
    });
  }

  // ─── Private: Historical Event Recording ───────────────────────────────────

  private recordHistoricalCrises(ctx: GovernorContext): void {
    const activeCrises = this.historicalGovernor.getActiveCrises();
    for (const crisisId of activeCrises) {
      // Only record each crisis once
      const existing = this.timeline.queryEvents({
        yearRange: { start: ctx.year, end: ctx.year },
      });
      if (existing.some((e) => e.eventId === crisisId)) continue;

      this.timeline.recordEvent({
        eventId: crisisId,
        crisisType: this.inferCrisisType(crisisId),
        name: crisisId,
        startYear: ctx.year,
        endYear: ctx.year + 1,
        isHistorical: true,
        recordedTick: ctx.totalTicks,
      });
    }
  }

  /** Infer crisis type from crisis ID prefix. */
  private inferCrisisType(crisisId: string): 'war' | 'famine' | 'disaster' | 'political' {
    if (crisisId.includes('war') || crisisId.includes('gpw') || crisisId.includes('afghan') ||
        crisisId.includes('civil') || crisisId.includes('finnish') || crisisId.includes('polish') ||
        crisisId.includes('korean') || crisisId.includes('sino')) {
      return 'war';
    }
    if (crisisId.includes('famine') || crisisId.includes('holodomor') || crisisId.includes('hunger')) {
      return 'famine';
    }
    if (crisisId.includes('disaster') || crisisId.includes('chernobyl') || crisisId.includes('kyshtym') ||
        crisisId.includes('earthquake') || crisisId.includes('aral') || crisisId.includes('nedelin')) {
      return 'disaster';
    }
    return 'political';
  }

  // ─── Private: Impact Merging ───────────────────────────────────────────────

  /**
   * Merge crisis impacts into DynamicModifiers.
   * Same logic as HistoricalGovernor.mergeModifiers.
   */
  private mergeModifiers(impacts: CrisisImpact[]): DynamicModifiers {
    let quotaMult = 1.0;
    let growthMult = 1.0;
    let decayMult = 1.0;
    let consumptionMult = 1.0;
    let maxKgbMult = 1.0;

    for (const impact of impacts) {
      if (impact.political?.quotaMult !== undefined) {
        quotaMult *= impact.political.quotaMult;
      }
      if (impact.social?.growthMult !== undefined) {
        growthMult *= impact.social.growthMult;
      }
      if (impact.infrastructure?.decayMult !== undefined) {
        decayMult *= impact.infrastructure.decayMult;
      }
      if (impact.political?.kgbAggressionMult !== undefined) {
        maxKgbMult = Math.max(maxKgbMult, impact.political.kgbAggressionMult);
      }
    }

    let kgbAggression: 'low' | 'medium' | 'high' = DEFAULT_MODIFIERS.kgbAggression;
    if (maxKgbMult >= 2.0) {
      kgbAggression = 'high';
    } else if (maxKgbMult >= 1.3) {
      kgbAggression = 'medium';
    }

    return {
      quotaMultiplier: DEFAULT_MODIFIERS.quotaMultiplier * quotaMult,
      markDecayTicks: DEFAULT_MODIFIERS.markDecayTicks,
      politrukRatio: DEFAULT_MODIFIERS.politrukRatio,
      kgbAggression,
      growthMultiplier: DEFAULT_MODIFIERS.growthMultiplier * growthMult,
      winterModifier: DEFAULT_MODIFIERS.winterModifier,
      decayMultiplier: DEFAULT_MODIFIERS.decayMultiplier * decayMult,
      resourceMultiplier: DEFAULT_MODIFIERS.resourceMultiplier,
      consumptionMultiplier: DEFAULT_MODIFIERS.consumptionMultiplier * consumptionMult,
    };
  }
}
