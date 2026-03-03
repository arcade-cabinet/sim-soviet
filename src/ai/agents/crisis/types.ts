/**
 * @module ai/agents/crisis/types
 *
 * Universal type contracts for the crisis agent architecture.
 *
 * Crisis agents (WarAgent, FamineAgent, DisasterAgent) implement ICrisisAgent
 * and produce CrisisImpact "write tickets" that the CrisisImpactApplicator
 * merges into live game state each tick.
 */

import type { GameRng } from '@/game/SeedSystem';

// ─── Crisis Phase ───────────────────────────────────────────────────────────

/** Lifecycle phase of a crisis instance. */
export type CrisisPhase = 'buildup' | 'peak' | 'aftermath' | 'resolved';

// ─── Crisis Severity ────────────────────────────────────────────────────────

/** Geographic/systemic scope of the crisis. */
export type CrisisSeverity = 'localized' | 'regional' | 'national' | 'existential';

// ─── Crisis Type ────────────────────────────────────────────────────────────

/** High-level crisis category. */
export type CrisisType = 'war' | 'famine' | 'disaster';

// ─── Crisis Impact ──────────────────────────────────────────────────────────

/**
 * A "write ticket" produced by a crisis agent each tick.
 *
 * All slots are optional — a crisis only populates the domains it affects.
 * The CrisisImpactApplicator merges these into game state multiplicatively
 * (for multipliers) or additively (for deltas).
 */
export interface CrisisImpact {
  /** Which crisis produced this impact. */
  crisisId: string;

  /** Economy effects. */
  economy?: {
    /** Multiplier on all production output (1.0 = no change). */
    productionMult?: number;
    /** Absolute food change per tick. */
    foodDelta?: number;
    /** Absolute money change per tick. */
    moneyDelta?: number;
  };

  /** Workforce effects. */
  workforce?: {
    /** Workers to conscript this tick. */
    conscriptionCount?: number;
    /** Workers killed this tick. */
    casualtyCount?: number;
    /** Additive morale modifier (-1 to 1 range). */
    moraleModifier?: number;
  };

  /** Infrastructure effects. */
  infrastructure?: {
    /** Multiplier on building decay rate (1.0 = no change). */
    decayMult?: number;
    /** Grid positions of buildings to destroy this tick. */
    destructionTargets?: Array<{ gridX: number; gridY: number }>;
  };

  /** Political effects. */
  political?: {
    /** Multiplier on KGB aggression (1.0 = no change). */
    kgbAggressionMult?: number;
    /** Multiplier on quota targets (1.0 = no change). */
    quotaMult?: number;
  };

  /** Social effects. */
  social?: {
    /** Multiplier on disease spread rate (1.0 = no change). */
    diseaseMult?: number;
    /** Multiplier on population growth (1.0 = no change). */
    growthMult?: number;
  };

  /** Narrative effects — messages surfaced to the player. */
  narrative?: {
    /** Pravda ticker headlines. */
    pravdaHeadlines?: string[];
    /** Toast notification messages. */
    toastMessages?: Array<{
      text: string;
      severity?: 'warning' | 'critical' | 'evacuation';
    }>;
  };
}

// ─── Crisis Definition ──────────────────────────────────────────────────────

/**
 * Static definition of a crisis — immutable data describing what it is
 * and when it occurs. Agents are configured with one of these.
 */
export interface CrisisDefinition {
  /** Unique identifier (e.g. 'ww2', 'holodomor', 'chernobyl'). */
  id: string;
  /** Crisis category. */
  type: CrisisType;
  /** Human-readable name (e.g. 'Great Patriotic War'). */
  name: string;
  /** Year the crisis begins (buildup phase starts). */
  startYear: number;
  /** Year the crisis ends (aftermath phase concludes). */
  endYear: number;
  /** Geographic/systemic scope. */
  severity: CrisisSeverity;
  /** Parameters at peak intensity — agent-specific, keyed by domain. */
  peakParams: Record<string, number>;
  /** Ticks for the buildup ramp before peak. */
  buildupTicks: number;
  /** Ticks for the aftermath ramp after peak. */
  aftermathTicks: number;
}

// ─── Crisis Context ─────────────────────────────────────────────────────────

/**
 * Per-tick context passed to crisis agents during evaluation.
 * Contains current game state needed to calculate impacts.
 */
export interface CrisisContext {
  /** Current game year. */
  year: number;
  /** Current month (1-12). */
  month: number;
  /** Current total population. */
  population: number;
  /** Current food stockpile. */
  food: number;
  /** Current money (rubles). */
  money: number;
  /** Seeded RNG instance for deterministic outcomes. */
  rng: GameRng;
  /** IDs of other currently active crises (for interaction logic). */
  activeCrises: string[];
}

// ─── Crisis Agent Interface ─────────────────────────────────────────────────

/**
 * Contract for all crisis agents (WarAgent, FamineAgent, DisasterAgent).
 *
 * Lifecycle: configure() → evaluate() each tick → serialize()/restore()
 */
export interface ICrisisAgent {
  /** Configure the agent with a crisis definition. */
  configure(def: CrisisDefinition): void;

  /**
   * Evaluate current tick and return zero or more impact tickets.
   * Returns empty array when the crisis is resolved or not yet started.
   */
  evaluate(ctx: CrisisContext): CrisisImpact[];

  /** Whether this crisis is currently active (buildup, peak, or aftermath). */
  isActive(): boolean;

  /** Current lifecycle phase. */
  getPhase(): CrisisPhase;

  /** Serialize agent state for save persistence. */
  serialize(): CrisisAgentSaveData;

  /** Restore agent state from saved data. */
  restore(data: CrisisAgentSaveData): void;
}

// ─── Serialization ──────────────────────────────────────────────────────────

/** Serialized crisis agent state for save/load. */
export interface CrisisAgentSaveData {
  /** The crisis definition this agent was configured with. */
  definition: CrisisDefinition;
  /** Current phase. */
  phase: CrisisPhase;
  /** Ticks elapsed in the current phase. */
  ticksInPhase: number;
  /** Agent-specific extra state (subclasses extend as needed). */
  extra?: Record<string, unknown>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Create an empty CrisisImpact with just the crisis ID. */
export function emptyCrisisImpact(crisisId: string): CrisisImpact {
  return { crisisId };
}

/** Default (no-op) peak params for convenience. */
export const DEFAULT_PEAK_PARAMS: Readonly<Record<string, number>> = Object.freeze({});
