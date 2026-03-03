/**
 * @module ai/agents/crisis/FreeformGovernor
 *
 * Governor for Freeform (alternate-history) mode. Plays real Soviet
 * history up to a player-chosen divergence year, then switches to
 * ChaosEngine-driven crisis generation for speculative timelines.
 *
 * Before divergenceYear: activates historical crises exactly as
 * HistoricalGovernor would (same agents, same dates, same phase logic).
 *
 * After divergenceYear: ChaosEngine evaluates archetype triggers
 * against current game state and generates new crises. All events
 * (historical and generated) are recorded in a TimelineSystem for
 * feedback-driven crisis cascading.
 *
 * Uses the same crisis agents (WarAgent, FamineAgent, DisasterAgent)
 * for both phases.
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
import { HISTORICAL_CRISES } from '@/config/historicalCrises';
import { ChaosEngine, type ChaosState } from './ChaosEngine';
import { TimelineSystem, type TimelineEvent } from './TimelineSystem';
import { WarAgent } from './WarAgent';
import { FamineAgent } from './FamineAgent';
import { DisasterAgent } from './DisasterAgent';

// ─── Agent Entry ────────────────────────────────────────────────────────────

/** Internal tracking structure for each crisis + its agent. */
interface AgentEntry {
  definition: CrisisDefinition;
  agent: ICrisisAgent;
  activated: boolean;
}

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * Create the appropriate crisis agent for a given crisis type.
 * Political crises are handled by the existing PoliticalAgent and skipped.
 */
function createAgentForType(type: string): ICrisisAgent | null {
  switch (type) {
    case 'war':
      return new WarAgent();
    case 'famine':
      return new FamineAgent();
    case 'disaster':
      return new DisasterAgent();
    case 'political':
      return null; // handled by existing PoliticalAgent
    default:
      return null;
  }
}

// ─── FreeformGovernor ─────────────────────────────────────────────────────

/**
 * Alternate-history governor that replays real Soviet history up to a
 * divergence year, then uses ChaosEngine for extrapolation.
 *
 * @param divergenceYear - Year at which history diverges (1917-1991)
 */
export class FreeformGovernor implements IGovernor {
  private divergenceYear: number;
  private hasDiverged = false;
  private historicalEntries: AgentEntry[] = [];
  private freeformEntries: AgentEntry[] = [];
  private chaosEngine: ChaosEngine;
  private timeline: TimelineSystem;
  private currentYear = 0;

  /** Track years since last crisis of each type (for ChaosState). */
  private yearsSinceLastWar = 10;
  private yearsSinceLastFamine = 10;
  private yearsSinceLastDisaster = 10;
  private yearsSinceLastPolitical = 10;
  private totalCrisesExperienced = 0;

  constructor(divergenceYear: number) {
    this.divergenceYear = Math.max(1917, Math.min(1991, divergenceYear));
    this.chaosEngine = new ChaosEngine();
    this.timeline = new TimelineSystem();
    this.loadHistoricalCrises();
  }

  /**
   * Load historical crisis definitions that start before the divergence year.
   * Crises with startYear >= divergenceYear are excluded (they never happened
   * in this timeline).
   */
  private loadHistoricalCrises(): void {
    this.historicalEntries = [];
    for (const def of HISTORICAL_CRISES) {
      // Only include crises that would have started before divergence
      if (def.startYear >= this.divergenceYear) continue;

      const agent = createAgentForType(def.type);
      if (agent) {
        this.historicalEntries.push({
          definition: def,
          agent,
          activated: false,
        });
      }
    }
  }

  /**
   * Evaluate the current tick and return a GovernorDirective.
   *
   * Pre-divergence: activates historical crises by start year.
   * Post-divergence: uses ChaosEngine for new crisis generation.
   * Both phases: evaluates all active agents and merges impacts.
   */
  evaluate(ctx: GovernorContext): GovernorDirective {
    this.currentYear = ctx.year;

    // Check for divergence transition
    if (!this.hasDiverged && ctx.year >= this.divergenceYear) {
      this.hasDiverged = true;
      this.recordDivergence(ctx);
    }

    const allImpacts: CrisisImpact[] = [];

    // Build the active crises list before evaluation (for CrisisContext)
    const activeCrisisIds = this.getActiveCrises();

    // ── Evaluate historical crises ──────────────────────────────────────

    for (const entry of this.historicalEntries) {
      // Only activate new historical crises before divergence
      if (
        !entry.activated &&
        ctx.year >= entry.definition.startYear &&
        !this.hasDiverged
      ) {
        entry.agent.configure(entry.definition);
        entry.activated = true;
        this.recordEvent(entry.definition, true);
        this.totalCrisesExperienced++;
      }

      // Handle WarAgent aftermath transition (same as HistoricalGovernor)
      if (
        entry.activated &&
        ctx.year > entry.definition.endYear &&
        entry.agent.getPhase() === 'peak'
      ) {
        if (entry.agent instanceof WarAgent) {
          entry.agent.transitionToAftermath();
        }
      }

      // Evaluate all activated agents (they may still be active in aftermath)
      if (entry.activated) {
        const crisisCtx = this.buildCrisisContext(ctx, activeCrisisIds);
        const impacts = entry.agent.evaluate(crisisCtx);
        allImpacts.push(...impacts);
      }
    }

    // ── Post-divergence: ChaosEngine-generated crises ────────────────────

    if (this.hasDiverged) {
      this.maybeGenerateNewCrisis(ctx);

      for (const entry of this.freeformEntries) {
        // Handle WarAgent aftermath transition for freeform crises too
        if (
          entry.activated &&
          ctx.year > entry.definition.endYear &&
          entry.agent.getPhase() === 'peak'
        ) {
          if (entry.agent instanceof WarAgent) {
            entry.agent.transitionToAftermath();
          }
        }

        if (entry.activated) {
          const crisisCtx = this.buildCrisisContext(ctx, activeCrisisIds);
          const impacts = entry.agent.evaluate(crisisCtx);
          allImpacts.push(...impacts);
        }
      }
    }

    // Merge into modifiers (same logic as HistoricalGovernor)
    const modifiers = this.mergeModifiers(allImpacts);

    return {
      crisisImpacts: allImpacts,
      modifiers,
    };
  }

  /** Return IDs of all currently active crises (historical + freeform). */
  getActiveCrises(): string[] {
    const historicalActive = this.historicalEntries
      .filter((e) => e.activated && e.agent.isActive())
      .map((e) => e.definition.id);

    const freeformActive = this.freeformEntries
      .filter((e) => e.activated && e.agent.isActive())
      .map((e) => e.definition.id);

    return [...historicalActive, ...freeformActive];
  }

  /**
   * Called at the start of each new game year.
   * Updates year-since counters: increments all, resets types with active crises.
   */
  onYearBoundary(year: number): void {
    this.currentYear = year;

    // Increment all year-since counters
    this.yearsSinceLastWar++;
    this.yearsSinceLastFamine++;
    this.yearsSinceLastDisaster++;
    this.yearsSinceLastPolitical++;

    // Reset counters for types that have active crises
    const allEntries = [...this.historicalEntries, ...this.freeformEntries];

    for (const entry of allEntries) {
      if (entry.activated && entry.agent.isActive()) {
        switch (entry.definition.type) {
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
      }
    }
  }

  /** Serialize governor state for save persistence. */
  serialize(): GovernorSaveData {
    const historicalAgentStates: Record<string, CrisisAgentSaveData> = {};
    const historicalActivatedSet: string[] = [];

    for (const entry of this.historicalEntries) {
      if (entry.activated) {
        historicalAgentStates[entry.definition.id] = entry.agent.serialize();
        historicalActivatedSet.push(entry.definition.id);
      }
    }

    const freeformEntrySaves = this.freeformEntries.map((entry) => ({
      definition: entry.definition,
      agentState: entry.agent.serialize(),
      activated: entry.activated,
    }));

    return {
      mode: 'freeform',
      activeCrises: this.getActiveCrises(),
      state: {
        divergenceYear: this.divergenceYear,
        hasDiverged: this.hasDiverged,
        currentYear: this.currentYear,
        historicalAgentStates,
        historicalActivatedSet,
        freeformEntries: freeformEntrySaves,
        timeline: this.timeline.serialize(),
        yearsSinceLastWar: this.yearsSinceLastWar,
        yearsSinceLastFamine: this.yearsSinceLastFamine,
        yearsSinceLastDisaster: this.yearsSinceLastDisaster,
        yearsSinceLastPolitical: this.yearsSinceLastPolitical,
        totalCrisesExperienced: this.totalCrisesExperienced,
      },
    };
  }

  /** Restore governor state from saved data. */
  restore(data: GovernorSaveData): void {
    const s = data.state;

    this.divergenceYear = (s['divergenceYear'] as number) ?? this.divergenceYear;
    this.hasDiverged = (s['hasDiverged'] as boolean) ?? false;
    this.currentYear = (s['currentYear'] as number) ?? 0;
    this.yearsSinceLastWar = (s['yearsSinceLastWar'] as number) ?? 10;
    this.yearsSinceLastFamine = (s['yearsSinceLastFamine'] as number) ?? 10;
    this.yearsSinceLastDisaster = (s['yearsSinceLastDisaster'] as number) ?? 10;
    this.yearsSinceLastPolitical = (s['yearsSinceLastPolitical'] as number) ?? 10;
    this.totalCrisesExperienced = (s['totalCrisesExperienced'] as number) ?? 0;

    // Restore timeline
    const timelineData = s['timeline'] as ReturnType<TimelineSystem['serialize']> | undefined;
    if (timelineData) {
      this.timeline.restore(timelineData);
    }

    // Reload historical entries for this divergence year
    this.loadHistoricalCrises();

    // Restore historical agent states
    const historicalActivatedSet = new Set(
      (s['historicalActivatedSet'] as string[]) ?? [],
    );
    const historicalAgentStates =
      (s['historicalAgentStates'] as Record<string, CrisisAgentSaveData>) ?? {};

    for (const entry of this.historicalEntries) {
      if (historicalActivatedSet.has(entry.definition.id)) {
        entry.activated = true;
        const savedState = historicalAgentStates[entry.definition.id];
        if (savedState) {
          entry.agent.configure(entry.definition);
          entry.agent.restore(savedState);
        }
      }
    }

    // Restore freeform entries
    this.freeformEntries = [];
    const savedFreeform =
      (s['freeformEntries'] as Array<{
        definition: CrisisDefinition;
        agentState: CrisisAgentSaveData;
        activated: boolean;
      }>) ?? [];

    for (const saved of savedFreeform) {
      const agent = createAgentForType(saved.definition.type);
      if (agent) {
        agent.configure(saved.definition);
        agent.restore(saved.agentState);
        this.freeformEntries.push({
          definition: saved.definition,
          agent,
          activated: saved.activated,
        });
      }
    }
  }

  // ─── Getters (for testing/inspection) ───────────────────────────────────

  /** Whether the governor has passed the divergence year. */
  isDiverged(): boolean {
    return this.hasDiverged;
  }

  /** The configured divergence year. */
  getDivergenceYear(): number {
    return this.divergenceYear;
  }

  /** Get the timeline system (for inspection/testing). */
  getTimeline(): TimelineSystem {
    return this.timeline;
  }

  /** Get year-since counters (for testing). */
  getYearsSinceCounters(): {
    war: number;
    famine: number;
    disaster: number;
    political: number;
  } {
    return {
      war: this.yearsSinceLastWar,
      famine: this.yearsSinceLastFamine,
      disaster: this.yearsSinceLastDisaster,
      political: this.yearsSinceLastPolitical,
    };
  }

  /** Get total crises experienced count (for testing). */
  getTotalCrisesExperienced(): number {
    return this.totalCrisesExperienced;
  }

  // ─── Private: ChaosEngine Crisis Generation ────────────────────────────

  /**
   * Attempt to generate a new crisis via ChaosEngine.
   * Only fires once per year (on month 1) to avoid crisis spam.
   */
  private maybeGenerateNewCrisis(ctx: GovernorContext): void {
    if (ctx.month !== 1) return;

    const chaosState: ChaosState = {
      year: ctx.year,
      population: ctx.population,
      food: ctx.food,
      money: ctx.money,
      yearsSinceLastWar: this.yearsSinceLastWar,
      yearsSinceLastFamine: this.yearsSinceLastFamine,
      yearsSinceLastDisaster: this.yearsSinceLastDisaster,
      yearsSinceLastPolitical: this.yearsSinceLastPolitical,
      activeCrises: this.getActiveCrises(),
      totalCrisesExperienced: this.totalCrisesExperienced,
    };

    const newCrisis = this.chaosEngine.generateNextCrisis(
      chaosState,
      this.timeline.getAllEvents(),
      ctx.rng,
    );

    if (newCrisis) {
      const agent = createAgentForType(newCrisis.type);
      if (agent) {
        agent.configure(newCrisis);
        const entry: AgentEntry = {
          definition: newCrisis,
          agent,
          activated: true,
        };
        this.freeformEntries.push(entry);
        this.recordEvent(newCrisis, false);
        this.totalCrisesExperienced++;
      }
    }
  }

  // ─── Private: Helpers ──────────────────────────────────────────────────

  /** Build a CrisisContext from GovernorContext. */
  private buildCrisisContext(
    ctx: GovernorContext,
    activeCrisisIds: string[],
  ): CrisisContext {
    return {
      year: ctx.year,
      month: ctx.month,
      population: ctx.population,
      food: ctx.food,
      money: ctx.money,
      rng: ctx.rng,
      activeCrises: activeCrisisIds,
    };
  }

  /**
   * Record a crisis event to the timeline.
   *
   * @param def - The crisis definition to record
   * @param isHistorical - Whether this is a real historical event
   */
  private recordEvent(def: CrisisDefinition, isHistorical: boolean): void {
    const event: TimelineEvent = {
      eventId: def.id,
      crisisType: def.type,
      name: def.name,
      startYear: def.startYear,
      endYear: def.endYear,
      isHistorical,
      recordedTick: 0,
      parameters: { ...def.peakParams },
    };
    this.timeline.recordEvent(event);
  }

  /** Record the divergence point on the timeline. */
  private recordDivergence(ctx: GovernorContext): void {
    this.timeline.recordDivergence({
      year: ctx.year,
      month: ctx.month,
      historicalContext: `Soviet history through ${this.divergenceYear}`,
      playerChoice: `Timeline diverges at year ${this.divergenceYear}`,
      divergenceTick: ctx.totalTicks,
    });
  }

  // ─── Private: Impact Merging ──────────────────────────────────────────

  /**
   * Merge crisis impacts into DynamicModifiers.
   *
   * Multiplicative fields (quotaMultiplier, growthMultiplier, decayMultiplier,
   * consumptionMultiplier) are computed as:
   *   base * product(crisis_mult or 1.0)
   *
   * Non-numeric fields keep their DEFAULT_MODIFIERS values unless a crisis
   * explicitly pushes them (e.g. KGB aggression during purges).
   *
   * Identical to HistoricalGovernor.mergeModifiers().
   */
  private mergeModifiers(impacts: CrisisImpact[]): DynamicModifiers {
    let quotaMult = 1.0;
    let growthMult = 1.0;
    let decayMult = 1.0;
    let consumptionMult = 1.0;

    // Track max KGB aggression across all impacts
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

    // Map KGB aggression multiplier to aggression level
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
