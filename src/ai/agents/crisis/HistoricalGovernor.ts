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
 *
 * Reads PressureSystem to modulate crisis severity — high pressure in
 * relevant domains amplifies crisis impacts. Also evaluates historical
 * cold branches (dekulakization, ethnic deportation, virgin lands,
 * moscow promotion) from worldBranches.ts.
 */

import { HISTORICAL_CRISES } from '@/config/historicalCrises';
import type { WorldState } from '../core/WorldAgent';
import type { GovernanceType, SphereId } from '../core/worldCountries';
import {
  type BranchSystemSaveData,
  type BranchTracker,
  COLD_BRANCHES,
  type ColdBranch,
  evaluateBranches,
  restoreBranchSystem,
  serializeBranchSystem,
} from '../core/worldBranches';
import { DisasterAgent } from './DisasterAgent';
import { FamineAgent } from './FamineAgent';
import type { DynamicModifiers, GovernorContext, GovernorDirective, GovernorSaveData, IGovernor } from './Governor';
import { DEFAULT_MODIFIERS } from './Governor';
import type { PressureDomain } from './pressure/PressureDomains';
import { PressureSystem } from './pressure/PressureSystem';
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

// ─── Historical Cold Branches ────────────────────────────────────────────────

/** IDs of cold branches relevant to historical mode (pre-1991 Soviet history). */
const HISTORICAL_BRANCH_IDS = new Set([
  'dekulakization_purge',
  'ethnic_deportation',
  'virgin_lands_assignment',
  'moscow_promotion',
]);

/** Subset of COLD_BRANCHES applicable to historical mode. */
const HISTORICAL_COLD_BRANCHES: readonly ColdBranch[] = COLD_BRANCHES.filter((b) =>
  HISTORICAL_BRANCH_IDS.has(b.id),
);

// ─── Pressure → Severity Mapping ──────────────────────────────────────────────

/**
 * Map crisis types to the pressure domains that amplify their severity.
 * When the relevant domain is already under high pressure, crisis impacts
 * are scaled up (the situation was already bad, crisis makes it worse).
 */
const CRISIS_PRESSURE_DOMAINS: Record<string, PressureDomain[]> = {
  war: ['demographic', 'infrastructure', 'morale'],
  famine: ['food', 'health', 'demographic'],
  disaster: ['infrastructure', 'health'],
};

/**
 * Compute a severity multiplier from pressure readings for a given crisis type.
 * Returns 1.0 (no amplification) when no pressure readings are available,
 * up to 1.5 when all relevant domains are at maximum pressure.
 */
function computePressureSeverityMult(pressureSystem: PressureSystem, crisisType: string): number {
  const domains = CRISIS_PRESSURE_DOMAINS[crisisType];
  if (!domains || domains.length === 0) return 1.0;

  let totalPressure = 0;
  for (const domain of domains) {
    totalPressure += pressureSystem.getLevel(domain);
  }
  const avgPressure = totalPressure / domains.length;

  // Scale: 0 pressure → 1.0x, 1.0 pressure → 1.5x
  return 1.0 + avgPressure * 0.5;
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

  // ── Pressure System ──────────────────────────────────────────────────────
  private pressureSystem: PressureSystem;

  // ── Cold Branch State ────────────────────────────────────────────────────
  private activatedBranches: Set<string> = new Set();
  private branchTrackers: Map<string, BranchTracker> = new Map();

  constructor() {
    this.pressureSystem = new PressureSystem();
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
   * Pipeline:
   * 1. Tick PressureSystem (if readings available)
   * 2. Promote pending → active crises by year
   * 3. Evaluate active agents with pressure-modulated severity
   * 4. Evaluate historical cold branches
   * 5. Prune resolved entries
   * 6. Merge impacts into DynamicModifiers
   */
  evaluate(ctx: GovernorContext): GovernorDirective {
    this.currentYear = ctx.year;
    const allImpacts: CrisisImpact[] = [];

    // ── Tick pressure system (if readings available) ─────────────────────
    if (ctx.pressureReadings) {
      const worldModifiers = ctx.worldAgent?.computePressureModifiers() ?? {};
      this.pressureSystem.tick(ctx.pressureReadings, worldModifiers);
    }

    // ── Promote pending → active (sorted, so stop at first future entry) ──
    while (this.pendingEntries.length > 0 && ctx.year >= this.pendingEntries[0]!.definition.startYear) {
      const entry = this.pendingEntries.shift()!;
      entry.agent.configure(entry.definition);
      entry.activated = true;
      this.activeEntries.push(entry);
    }

    // ── Evaluate only active entries ────────────────────────────────────
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

      // ── Pressure severity modulation ──────────────────────────────────
      // When pressure is already high in relevant domains, amplify impacts
      if (ctx.pressureReadings) {
        const severityMult = computePressureSeverityMult(this.pressureSystem, entry.definition.type);
        if (severityMult > 1.0) {
          for (const impact of impacts) {
            if (impact.social?.growthMult !== undefined) {
              // Push growth penalty further below 1.0
              impact.social.growthMult = 1.0 - (1.0 - impact.social.growthMult) * severityMult;
            }
            if (impact.infrastructure?.decayMult !== undefined && impact.infrastructure.decayMult > 1.0) {
              // Amplify decay above 1.0
              impact.infrastructure.decayMult = 1.0 + (impact.infrastructure.decayMult - 1.0) * severityMult;
            }
            if (impact.economy?.productionMult !== undefined && impact.economy.productionMult < 1.0) {
              // Push production penalty further below 1.0
              impact.economy.productionMult = 1.0 - (1.0 - impact.economy.productionMult) * severityMult;
            }
          }
        }
      }

      allImpacts.push(...impacts);
    }

    // ── Cold branch evaluation ──────────────────────────────────────────
    if (ctx.pressureReadings) {
      const branchImpacts = this.evaluateColdBranches(ctx);
      allImpacts.push(...branchImpacts);
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

  /** Get the pressure system (for testing/inspection). */
  getPressureSystem(): PressureSystem {
    return this.pressureSystem;
  }

  /** Get activated cold branches (for testing/inspection). */
  getActivatedBranches(): ReadonlySet<string> {
    return this.activatedBranches;
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
        pressureState: this.pressureSystem.serialize(),
        branchSystem: serializeBranchSystem(this.activatedBranches, this.branchTrackers),
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

    // Restore pressure system (missing in old saves → defaults)
    if (data.state.pressureState) {
      this.pressureSystem.restore(data.state.pressureState as Parameters<PressureSystem['restore']>[0]);
    }

    // Restore branch system (missing in old saves → empty)
    if (data.state.branchSystem) {
      const branchData = restoreBranchSystem(data.state.branchSystem as BranchSystemSaveData);
      this.activatedBranches = branchData.activatedBranches;
      this.branchTrackers = branchData.trackers;
    }
  }

  // ─── Cold Branch Evaluation ─────────────────────────────────────────────

  /**
   * Evaluate historical cold branches against current pressure state.
   * Returns narrative impacts for activated branches and spawns crisis
   * agents when branches define them.
   */
  private evaluateColdBranches(ctx: GovernorContext): CrisisImpact[] {
    const impacts: CrisisImpact[] = [];
    const pressureState = this.pressureSystem.getState();

    // Build pressure state for branch evaluation
    const pressureForBranches: Record<PressureDomain, { level: number }> = {} as any;
    for (const [domain, gauge] of Object.entries(pressureState)) {
      pressureForBranches[domain as PressureDomain] = { level: gauge.level };
    }

    // WorldState + spheres from pressureReadings (assembled upstream)
    const worldState = ctx.pressureReadings?.worldState;
    const spheres = ctx.pressureReadings?.spheres;
    if (!worldState || !spheres) return impacts;

    const activated = evaluateBranches(
      HISTORICAL_COLD_BRANCHES,
      this.activatedBranches,
      this.branchTrackers,
      pressureForBranches,
      worldState as unknown as WorldState,
      ctx.year,
      spheres as unknown as Record<SphereId, { governance: GovernanceType; aggregateHostility: number }>,
    );

    for (const branch of activated) {
      // Apply pressure spikes
      if (branch.effects.pressureSpikes) {
        for (const [domain, spike] of Object.entries(branch.effects.pressureSpikes)) {
          this.pressureSystem.applySpike(domain as PressureDomain, spike);
        }
      }

      // Create crisis from branch if defined
      if (branch.effects.crisisDefinition) {
        const def = {
          ...branch.effects.crisisDefinition,
          startYear: ctx.year,
          endYear: ctx.year + (branch.effects.crisisDefinition.endYear - branch.effects.crisisDefinition.startYear || 2),
        };
        const agent = createAgentForType(def.type);
        if (agent) {
          agent.configure(def);
          this.activeEntries.push({ definition: def, agent, activated: true });
        }
      }

      // Narrative impact
      impacts.push({
        crisisId: `branch-${branch.id}-${ctx.year}`,
        narrative: {
          pravdaHeadlines: [branch.effects.narrative.pravdaHeadline],
          toastMessages: [{ text: branch.effects.narrative.toast, severity: 'critical' }],
        },
      });
    }

    return impacts;
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
