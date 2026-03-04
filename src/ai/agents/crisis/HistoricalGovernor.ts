/**
 * @module ai/agents/crisis/HistoricalGovernor
 *
 * Governor for Historical mode — feeds real Soviet history dates
 * to crisis agents. When the in-game year reaches 1941, the Great
 * Patriotic War agent activates and starts conscripting workers, etc.
 *
 * Loads all CrisisDefinition objects from the historical crisis database,
 * creates one agent per crisis (WarAgent, FamineAgent, DisasterAgent),
 * and evaluates them each tick to produce merged DynamicModifiers.
 */

import { HISTORICAL_CRISES } from '@/config/historicalCrises';
import { DisasterAgent } from './DisasterAgent';
import { FamineAgent } from './FamineAgent';
import type { DynamicModifiers, GovernorContext, GovernorDirective, GovernorSaveData, IGovernor } from './Governor';
import { DEFAULT_MODIFIERS } from './Governor';
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

// ─── HistoricalGovernor ─────────────────────────────────────────────────────

export class HistoricalGovernor implements IGovernor {
  /**
   * Entries waiting to be activated (startYear not yet reached).
   * Sorted by startYear — only need to check the front of the list.
   */
  private pendingEntries: AgentEntry[] = [];
  /**
   * Entries currently producing impacts (activated + still active).
   * Typically 0-3 entries — never grows large.
   */
  private activeEntries: AgentEntry[] = [];
  private currentYear = 0;

  constructor() {
    this.loadCrises(HISTORICAL_CRISES);
  }

  /**
   * Load crisis definitions and create agent instances.
   * Sorted by startYear so we only check the front of pending list.
   */
  private loadCrises(crises: readonly CrisisDefinition[]): void {
    this.pendingEntries = [];
    this.activeEntries = [];
    const sorted = [...crises].sort((a, b) => a.startYear - b.startYear);
    for (const def of sorted) {
      const agent = createAgentForType(def.type);
      if (agent) {
        this.pendingEntries.push({
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
   * Only touches:
   * 1. Front of pendingEntries (sorted by startYear) — promote when ready
   * 2. activeEntries (typically 0-3) — evaluate impacts
   * Never scans the full historical crisis database every tick.
   */
  evaluate(ctx: GovernorContext): GovernorDirective {
    this.currentYear = ctx.year;

    // ── Promote pending → active (sorted, so stop at first future entry) ──
    while (this.pendingEntries.length > 0 && ctx.year >= this.pendingEntries[0]!.definition.startYear) {
      const entry = this.pendingEntries.shift()!;
      entry.agent.configure(entry.definition);
      entry.activated = true;
      this.activeEntries.push(entry);
    }

    // ── Evaluate only active entries ────────────────────────────────────
    const allImpacts: CrisisImpact[] = [];
    const activeCrisisIds = this.getActiveCrises();

    for (const entry of this.activeEntries) {
      // If past end year and agent is still in peak, transition to aftermath
      if (ctx.year > entry.definition.endYear && entry.agent.getPhase() === 'peak') {
        if (entry.agent instanceof WarAgent) {
          entry.agent.transitionToAftermath();
        }
      }

      const crisisCtx: CrisisContext = {
        year: ctx.year,
        month: ctx.month,
        population: ctx.population,
        food: ctx.food,
        money: ctx.money,
        rng: ctx.rng,
        activeCrises: activeCrisisIds,
      };

      const impacts = entry.agent.evaluate(crisisCtx);
      allImpacts.push(...impacts);
    }

    // ── Prune resolved entries (aftermath complete) ─────────────────────
    // Only check yearly to avoid per-tick overhead
    if (ctx.month === 1) {
      this.activeEntries = this.activeEntries.filter((entry) => entry.agent.isActive());
    }

    const modifiers = this.mergeModifiers(allImpacts);
    return { crisisImpacts: allImpacts, modifiers };
  }

  /** Return IDs of all currently active crises. */
  getActiveCrises(): string[] {
    return this.activeEntries.filter((e) => e.agent.isActive()).map((e) => e.definition.id);
  }

  /** Called at the start of each new game year. */
  onYearBoundary(year: number): void {
    this.currentYear = year;
  }

  /** Serialize governor state for save persistence. */
  serialize(): GovernorSaveData {
    const agentStates: Record<string, CrisisAgentSaveData> = {};
    const activatedSet: string[] = [];

    for (const entry of this.activeEntries) {
      agentStates[entry.definition.id] = entry.agent.serialize();
      activatedSet.push(entry.definition.id);
    }

    return {
      mode: 'historical',
      activeCrises: this.getActiveCrises(),
      state: {
        currentYear: this.currentYear,
        agentStates,
        activatedSet,
      },
    };
  }

  /** Restore governor state from saved data. */
  restore(data: GovernorSaveData): void {
    this.currentYear = (data.state.currentYear as number) ?? 0;
    const agentStates = (data.state.agentStates as Record<string, CrisisAgentSaveData>) ?? {};
    const activatedSet = new Set((data.state.activatedSet as string[]) ?? []);

    // Re-partition: activated entries move from pending → active
    const stillPending: AgentEntry[] = [];
    for (const entry of this.pendingEntries) {
      if (activatedSet.has(entry.definition.id)) {
        entry.activated = true;
        const savedState = agentStates[entry.definition.id];
        if (savedState) {
          entry.agent.configure(entry.definition);
          entry.agent.restore(savedState);
        }
        this.activeEntries.push(entry);
      } else {
        stillPending.push(entry);
      }
    }
    this.pendingEntries = stillPending;
  }

  // ─── Impact Merging ─────────────────────────────────────────────────────

  /**
   * Merge crisis impacts into DynamicModifiers.
   *
   * Multiplicative fields (quotaMultiplier, growthMultiplier, decayMultiplier,
   * consumptionMultiplier) are computed as:
   *   base * product(crisis_mult or 1.0)
   *
   * Non-numeric fields keep their DEFAULT_MODIFIERS values unless a crisis
   * explicitly pushes them (e.g. KGB aggression during purges).
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
