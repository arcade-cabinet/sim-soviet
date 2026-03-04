/**
 * @module ai/agents/crisis/FreeformGovernor
 *
 * Governor for Freeform (alternate-history) mode. Uses probability-driven
 * crisis generation from tick 0 — no predetermined divergence point.
 *
 * Historical crises are seeded into the ChaosEngine as "probable events"
 * that CAN happen but don't have to happen at exact historical dates.
 * The timeline diverges naturally through accumulated differences.
 *
 * Uses the same crisis agents (WarAgent, FamineAgent, DisasterAgent)
 * as HistoricalGovernor.
 */

import { HISTORICAL_CRISES } from '@/config/historicalCrises';
import { ChaosEngine, type ChaosState } from './ChaosEngine';
import { DisasterAgent } from './DisasterAgent';
import { FamineAgent } from './FamineAgent';
import type { DynamicModifiers, GovernorContext, GovernorDirective, GovernorSaveData, IGovernor } from './Governor';
import { DEFAULT_MODIFIERS } from './Governor';
import { type TimelineEvent, TimelineSystem } from './TimelineSystem';
import type { CrisisAgentSaveData, CrisisContext, CrisisDefinition, CrisisImpact, ICrisisAgent } from './types';
import { WarAgent } from './WarAgent';

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

// ─── Historical Crisis Window ───────────────────────────────────────────────

/**
 * Probability window for a historical crisis in Freeform mode.
 * Instead of activating at a fixed year, each crisis has a window
 * during which it can probabilistically trigger.
 */
interface HistoricalCrisisWindow {
  definition: CrisisDefinition;
  /** Earliest year this crisis can trigger (historical start - 5). */
  windowStart: number;
  /** Latest year this crisis can trigger (historical start + 10). */
  windowEnd: number;
  /** Base probability per year-check (0-1). */
  baseProbability: number;
  /** Whether this crisis has already been triggered or skipped. */
  resolved: boolean;
  /** Whether this crisis was triggered (vs skipped). */
  triggered: boolean;
}

/**
 * Compute probability window for a historical crisis.
 * Wars: 90%+ over a 10-year window, highly probable.
 * Famines: depend on food conditions, moderate base probability.
 * Disasters: lower base probability, more random.
 * Political: moderate probability, condition-dependent.
 */
function createCrisisWindow(def: CrisisDefinition): HistoricalCrisisWindow {
  const duration = def.endYear - def.startYear;
  // Window: starts 3 years before historical date, ends 10 years after
  const windowStart = def.startYear - 3;
  const windowEnd = def.startYear + 10;
  const windowYears = windowEnd - windowStart;

  // Base probability scaled so cumulative probability over window ≈ target
  // P(at least once in N years) = 1 - (1-p)^N
  // For wars: target ~90%, for others: target ~60-70%
  let targetCumulative: number;
  switch (def.type) {
    case 'war':
      // Wars are highly probable (human nature)
      targetCumulative = def.severity === 'existential' ? 0.95 : 0.85;
      break;
    case 'famine':
      // Famines are condition-dependent
      targetCumulative = 0.7;
      break;
    case 'disaster':
      // Disasters are more random
      targetCumulative = 0.5;
      break;
    case 'political':
      // Political events are moderately probable
      targetCumulative = 0.6;
      break;
    default:
      targetCumulative = 0.5;
  }

  // Solve: 1 - (1-p)^N = target => p = 1 - (1-target)^(1/N)
  const baseProbability = 1 - Math.pow(1 - targetCumulative, 1 / windowYears);

  return {
    definition: { ...def, startYear: def.startYear, endYear: def.startYear + duration },
    windowStart,
    windowEnd,
    baseProbability,
    resolved: false,
    triggered: false,
  };
}

// ─── FreeformGovernor ─────────────────────────────────────────────────────

/**
 * Alternate-history governor with probability-driven events from tick 0.
 * No predetermined divergence point — the timeline diverges naturally.
 *
 * Historical crises become probability-weighted windows. The ChaosEngine
 * generates additional crises based on game state feedback loops.
 *
 * @param divergenceYear - DEPRECATED. Kept for backward compatibility
 *        with old saves. New games ignore this parameter.
 */
export class FreeformGovernor implements IGovernor {
  /** @deprecated Kept for backward compat with old saves. Not used in new games. */
  private divergenceYear: number;
  /** @deprecated Always true in new games. Kept for backward compat. */
  private hasDiverged = true;

  private historicalWindows: HistoricalCrisisWindow[] = [];
  private activeEntries: AgentEntry[] = [];
  private chaosEngine: ChaosEngine;
  private timeline: TimelineSystem;
  private currentYear = 0;

  /** Track years since last crisis of each type (for ChaosState). */
  private yearsSinceLastWar = 10;
  private yearsSinceLastFamine = 10;
  private yearsSinceLastDisaster = 10;
  private yearsSinceLastPolitical = 10;
  private totalCrisesExperienced = 0;

  constructor(divergenceYear?: number) {
    // divergenceYear is now ignored for new games but accepted for backward compat
    this.divergenceYear = divergenceYear ?? 1917;
    this.chaosEngine = new ChaosEngine();
    this.timeline = new TimelineSystem();
    this.loadHistoricalWindows();
  }

  /**
   * Load historical crisis definitions as probability windows.
   * Each historical crisis becomes a probabilistic event that may or may
   * not fire during its window period.
   */
  private loadHistoricalWindows(): void {
    this.historicalWindows = [];
    for (const def of HISTORICAL_CRISES) {
      const window = createCrisisWindow(def);
      this.historicalWindows.push(window);
    }
  }

  /**
   * Evaluate the current tick and return a GovernorDirective.
   *
   * Each tick:
   * 1. Check historical crisis windows for probabilistic activation
   * 2. Run ChaosEngine for additional crisis generation
   * 3. Evaluate all active agents and merge impacts
   */
  evaluate(ctx: GovernorContext): GovernorDirective {
    this.currentYear = ctx.year;

    const allImpacts: CrisisImpact[] = [];
    const activeCrisisIds = this.getActiveCrises();

    // ── Check historical crisis windows (on month 1 only) ──────────────
    if (ctx.month === 1) {
      this.checkHistoricalWindows(ctx);
    }

    // ── ChaosEngine: generate new crises ────────────────────────────────
    this.maybeGenerateNewCrisis(ctx);

    // ── Evaluate all active agents ──────────────────────────────────────
    for (const entry of this.activeEntries) {
      // Handle WarAgent aftermath transition
      if (entry.activated && ctx.year > entry.definition.endYear && entry.agent.getPhase() === 'peak') {
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

    // ── Prune resolved entries to prevent unbounded growth ────────────
    // Agents that have fully resolved (aftermath complete) will never
    // produce impacts again. Keeping them wastes CPU on every tick.
    if (ctx.month === 1) {
      this.activeEntries = this.activeEntries.filter(
        (entry) => !entry.activated || entry.agent.isActive(),
      );
    }

    // Merge into modifiers
    const modifiers = this.mergeModifiers(allImpacts);

    return {
      crisisImpacts: allImpacts,
      modifiers,
    };
  }

  /**
   * Check historical crisis windows and probabilistically activate crises.
   * Called once per year (month 1).
   */
  private checkHistoricalWindows(ctx: GovernorContext): void {
    for (const window of this.historicalWindows) {
      if (window.resolved) continue;
      if (ctx.year < window.windowStart) continue;

      // Past the window without triggering — mark as skipped
      if (ctx.year > window.windowEnd) {
        window.resolved = true;
        continue;
      }

      // Check for type-specific conditions that boost or suppress probability
      let adjustedProbability = window.baseProbability;
      adjustedProbability = this.adjustProbabilityByConditions(window, ctx, adjustedProbability);

      // Suppress if there's already an active crisis of this type
      const hasActiveOfType = this.activeEntries.some(
        (e) => e.activated && e.agent.isActive() && e.definition.type === window.definition.type,
      );
      if (hasActiveOfType) continue;

      // Roll
      const roll = ctx.rng.random();
      if (roll < adjustedProbability) {
        this.activateHistoricalCrisis(window, ctx);
      }
    }
  }

  /**
   * Adjust probability based on game conditions.
   * Famines more likely when food is low, wars more likely during peace, etc.
   */
  private adjustProbabilityByConditions(
    window: HistoricalCrisisWindow,
    ctx: GovernorContext,
    baseProbability: number,
  ): number {
    let p = baseProbability;

    switch (window.definition.type) {
      case 'famine': {
        // Boost famine probability when food is low
        const monthsOfFood = ctx.population > 0 ? ctx.food / (ctx.population * 0.5) : Infinity;
        if (monthsOfFood < 6) {
          p *= 1.5;
        }
        // Suppress when food is abundant
        if (monthsOfFood > 24) {
          p *= 0.3;
        }
        break;
      }
      case 'war': {
        // Long peace increases probability
        if (this.yearsSinceLastWar > 15) {
          p *= 1.3;
        }
        break;
      }
      case 'political': {
        // Boost during instability
        if (this.yearsSinceLastFamine <= 3 || this.yearsSinceLastWar <= 3) {
          p *= 1.3;
        }
        break;
      }
    }

    return Math.min(1, p);
  }

  /**
   * Activate a historical crisis from its probability window.
   */
  private activateHistoricalCrisis(window: HistoricalCrisisWindow, ctx: GovernorContext): void {
    const agent = createAgentForType(window.definition.type);
    if (!agent) {
      window.resolved = true;
      window.triggered = false;
      return;
    }

    // Adjust the crisis timing to start now
    const duration = window.definition.endYear - window.definition.startYear;
    const adjustedDef: CrisisDefinition = {
      ...window.definition,
      startYear: ctx.year,
      endYear: ctx.year + duration,
    };

    agent.configure(adjustedDef);
    const entry: AgentEntry = {
      definition: adjustedDef,
      agent,
      activated: true,
    };
    this.activeEntries.push(entry);

    window.resolved = true;
    window.triggered = true;
    this.totalCrisesExperienced++;

    this.recordEvent(adjustedDef, true);
  }

  /** Return IDs of all currently active crises. */
  getActiveCrises(): string[] {
    return this.activeEntries.filter((e) => e.activated && e.agent.isActive()).map((e) => e.definition.id);
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
    for (const entry of this.activeEntries) {
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
    const entrySaves = this.activeEntries.map((entry) => ({
      definition: entry.definition,
      agentState: entry.agent.serialize(),
      activated: entry.activated,
    }));

    const windowSaves = this.historicalWindows.map((w) => ({
      definitionId: w.definition.id,
      resolved: w.resolved,
      triggered: w.triggered,
    }));

    return {
      mode: 'freeform',
      activeCrises: this.getActiveCrises(),
      state: {
        divergenceYear: this.divergenceYear,
        hasDiverged: this.hasDiverged,
        currentYear: this.currentYear,
        activeEntries: entrySaves,
        historicalWindowStates: windowSaves,
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

    this.divergenceYear = (s.divergenceYear as number) ?? 1917;
    this.hasDiverged = (s.hasDiverged as boolean) ?? true;
    this.currentYear = (s.currentYear as number) ?? 0;
    this.yearsSinceLastWar = (s.yearsSinceLastWar as number) ?? 10;
    this.yearsSinceLastFamine = (s.yearsSinceLastFamine as number) ?? 10;
    this.yearsSinceLastDisaster = (s.yearsSinceLastDisaster as number) ?? 10;
    this.yearsSinceLastPolitical = (s.yearsSinceLastPolitical as number) ?? 10;
    this.totalCrisesExperienced = (s.totalCrisesExperienced as number) ?? 0;

    // Restore timeline
    const timelineData = s.timeline as ReturnType<TimelineSystem['serialize']> | undefined;
    if (timelineData) {
      this.timeline.restore(timelineData);
    }

    // Restore historical window states
    this.loadHistoricalWindows();
    const windowStates = (s.historicalWindowStates as Array<{
      definitionId: string;
      resolved: boolean;
      triggered: boolean;
    }>) ?? [];
    for (const ws of windowStates) {
      const window = this.historicalWindows.find((w) => w.definition.id === ws.definitionId);
      if (window) {
        window.resolved = ws.resolved;
        window.triggered = ws.triggered;
      }
    }

    // Backward compatibility: restore old-format saves (historicalEntries + freeformEntries)
    if (s.historicalAgentStates || s.freeformEntries) {
      this.restoreOldFormat(s);
      return;
    }

    // Restore active entries
    this.activeEntries = [];
    const savedEntries =
      (s.activeEntries as Array<{
        definition: CrisisDefinition;
        agentState: CrisisAgentSaveData;
        activated: boolean;
      }>) ?? [];

    for (const saved of savedEntries) {
      const agent = createAgentForType(saved.definition.type);
      if (agent) {
        agent.configure(saved.definition);
        agent.restore(saved.agentState);
        this.activeEntries.push({
          definition: saved.definition,
          agent,
          activated: saved.activated,
        });
      }
    }
  }

  /**
   * Restore from old save format (pre-organic divergence).
   * Old saves had historicalEntries + freeformEntries with a divergence year.
   */
  private restoreOldFormat(s: Record<string, unknown>): void {
    this.activeEntries = [];

    // Restore old historical entries
    const historicalActivatedSet = new Set((s.historicalActivatedSet as string[]) ?? []);
    const historicalAgentStates = (s.historicalAgentStates as Record<string, CrisisAgentSaveData>) ?? {};

    for (const defId of historicalActivatedSet) {
      const def = HISTORICAL_CRISES.find((c) => c.id === defId);
      if (!def) continue;
      const agent = createAgentForType(def.type);
      if (!agent) continue;
      agent.configure(def);
      const savedState = historicalAgentStates[defId];
      if (savedState) agent.restore(savedState);
      this.activeEntries.push({ definition: def, agent, activated: true });

      // Mark the corresponding window as resolved
      const window = this.historicalWindows.find((w) => w.definition.id === defId);
      if (window) {
        window.resolved = true;
        window.triggered = true;
      }
    }

    // Restore old freeform entries
    const savedFreeform =
      (s.freeformEntries as Array<{
        definition: CrisisDefinition;
        agentState: CrisisAgentSaveData;
        activated: boolean;
      }>) ?? [];

    for (const saved of savedFreeform) {
      const agent = createAgentForType(saved.definition.type);
      if (agent) {
        agent.configure(saved.definition);
        agent.restore(saved.agentState);
        this.activeEntries.push({
          definition: saved.definition,
          agent,
          activated: saved.activated,
        });
      }
    }
  }

  // ─── Getters (for testing/inspection) ───────────────────────────────────

  /** @deprecated Always true in new games. Kept for backward compat. */
  isDiverged(): boolean {
    return this.hasDiverged;
  }

  /** @deprecated Returns 1917 for new games. Kept for backward compat. */
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

  /** Get historical crisis windows (for testing). */
  getHistoricalWindows(): readonly HistoricalCrisisWindow[] {
    return this.historicalWindows;
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

    const newCrisis = this.chaosEngine.generateNextCrisis(chaosState, this.timeline.getAllEvents(), ctx.rng);

    if (newCrisis) {
      const agent = createAgentForType(newCrisis.type);
      if (agent) {
        agent.configure(newCrisis);
        const entry: AgentEntry = {
          definition: newCrisis,
          agent,
          activated: true,
        };
        this.activeEntries.push(entry);
        this.recordEvent(newCrisis, false);
        this.totalCrisesExperienced++;
      }
    }
  }

  // ─── Private: Helpers ──────────────────────────────────────────────────

  /** Build a CrisisContext from GovernorContext. */
  private buildCrisisContext(ctx: GovernorContext, activeCrisisIds: string[]): CrisisContext {
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
   * @param isHistorical - Whether this originated from a historical crisis definition
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

  // ─── Private: Impact Merging ──────────────────────────────────────────

  /**
   * Merge crisis impacts into DynamicModifiers.
   * Identical to HistoricalGovernor.mergeModifiers().
   */
  private mergeModifiers(impacts: CrisisImpact[]): DynamicModifiers {
    let quotaMult = 1.0;
    let growthMult = 1.0;
    let decayMult = 1.0;
    const consumptionMult = 1.0;

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
