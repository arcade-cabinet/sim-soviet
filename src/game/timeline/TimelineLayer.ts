/**
 * @module game/timeline/TimelineLayer
 *
 * Reusable abstraction for parallel timeline progression.
 *
 * A TimelineLayer is an independent progression track that runs alongside
 * the main game. Multiple layers stack to create emergent narrative depth:
 *
 *   Historical → eras, governors, crises (1917→1991)
 *   Space     → Sputnik → Dyson swarms (1957→∞)
 *   World     → geopolitics, cycles, deep-future civilizations (1917→∞)
 *   Ecological → climate, resources, geology (2050→∞)
 *
 * Each layer has milestones that activate when conditions are met.
 * Milestones can cross-reference other layers, creating horizontal
 * intersection points where multiple timelines interact simultaneously.
 *
 * Architecture:
 * - Milestones defined in JSON (data-driven, moddable)
 * - Condition evaluation is declarative (same rule engine as era conditions)
 * - Effects feed into the pressure system, cold branches, and world state
 * - Each layer tracks its own activation state (for save/load)
 *
 * The more layers run in parallel, the richer the long game becomes.
 * A space milestone + world crisis + ecological collapse happening
 * simultaneously = emergent stories no single timeline could produce.
 */

import type { PressureDomain } from '@/ai/agents/crisis/pressure/PressureDomains';

// ─── Milestone Condition (declarative, same pattern as era conditions) ──────

/**
 * Declarative condition rule for milestone activation.
 * Evaluated against TimelineContext.
 */
export type MilestoneCondition =
  | { year: { min?: number; max?: number } }
  | { techLevel: { min?: number; max?: number } }
  | { population: { min?: number; max?: number } }
  | { worldState: { key: string; min?: number; max?: number } }
  | { pressure: { domain: PressureDomain; min?: number; max?: number } }
  | { milestone: { timelineId: string; milestoneId: string } }
  | { resource: { key: string; min?: number; max?: number } }
  | { and: MilestoneCondition[] }
  | { or: MilestoneCondition[] }
  | { not: MilestoneCondition };

// ─── Narrative Choice System ─────────────────────────────────────────────────

/**
 * Outcome of a narrative milestone choice.
 * Applied to resources and personnel file after the player resolves.
 */
export interface NarrativeChoiceOutcome {
  /** Toast/announcement text shown after the choice resolves. */
  announcement: string;
  /** Toast severity. */
  severity?: 'warning' | 'critical' | 'evacuation';
  /** Resource changes. Positive = gain, negative = loss. */
  resources?: Partial<{ money: number; food: number; vodka: number; population: number }>;
  /** Black marks added to KGB file. */
  blackMarks?: number;
  /** Commendations added to KGB file. */
  commendations?: number;
  /** Blat (favor network) delta. */
  blat?: number;
  /** Immediate pressure domain changes on this outcome. */
  pressureModifiers?: Partial<Record<PressureDomain, number>>;
}

/**
 * A single player-facing choice in a narrative event.
 * Uses successChance for probabilistic outcomes — some choices are safe,
 * some are gambles (Soviet bureaucracy rarely gives clean options).
 */
export interface NarrativeChoice {
  /** Stable ID (used for auto-resolve and save). */
  id: string;
  /** Short button label: "Quarantine the district". */
  label: string;
  /** Tooltip description: "Seal off the contaminated zone. Workers will be lost." */
  description: string;
  /** 0-1. 1.0 = always succeeds, 0.5 = coin flip, 0.3 = risky. */
  successChance: number;
  onSuccess: NarrativeChoiceOutcome;
  onFailure: NarrativeChoiceOutcome;
}

/**
 * A narrative event fired when a milestone with player choices activates.
 * Presented as a full-screen dispatch the player must respond to.
 */
export interface NarrativeEvent {
  milestoneId: string;
  timelineId: string;
  title: string;
  /** Multi-paragraph prose — the "living story" scene. */
  scene: string;
  /** Pravda headline for the ticker. */
  headline: string;
  choices: NarrativeChoice[];
  /** Which choice ID auto-fires if player ignores (default: first choice). */
  autoResolveChoiceId: string;
  /** Ticks before auto-resolve (default 120 ≈ 10 years). */
  tickLimit: number;
}

// ─── Milestone Effects ──────────────────────────────────────────────────────

/** Effects applied when a milestone activates. */
export interface MilestoneEffects {
  /** Pressure spikes/relief applied to domains. */
  pressureModifiers?: Partial<Record<PressureDomain, number>>;
  /** World state overrides (additive or set). */
  worldStateDeltas?: Record<string, number>;
  /** Resources granted or consumed. */
  resourceDeltas?: Record<string, number>;
  /** Whether this milestone creates a new settlement. */
  newSettlement?: boolean;
  /** Settlement terrain type if creating one. */
  settlementTerrain?: string;
  /** Narrative output. */
  narrative: {
    pravdaHeadline: string;
    toast: string;
    /** Optional longer description for timeline view. */
    description?: string;
    /**
     * Multi-paragraph scene prose for narrative choice events.
     * If present along with `choices`, fires onNarrativeEvent instead of just a toast.
     */
    scene?: string;
    /** Player choices presented when this milestone activates. */
    choices?: NarrativeChoice[];
    /** Auto-resolve choice ID (default: first choice). */
    autoResolveChoiceId?: string;
    /** Ticks before auto-resolve (default 120). */
    tickLimit?: number;
  };
  /** IDs of cold branches this milestone can trigger. */
  triggerBranches?: string[];
  /** Unlocked capabilities (space_launches, dome_construction, etc.) */
  unlocks?: string[];
}

// ─── Milestone ──────────────────────────────────────────────────────────────

/** A single milestone in a timeline layer. */
export interface Milestone {
  /** Unique ID within this timeline. */
  id: string;
  /** Display name. */
  name: string;
  /** Which timeline this belongs to. */
  timelineId: string;
  /** Activation conditions — ALL must be true. */
  conditions: MilestoneCondition;
  /** Number of ticks conditions must be sustained before activation. */
  sustainedTicks: number;
  /** Effects on activation. */
  effects: MilestoneEffects;
  /** Once activated, can't re-trigger. */
  oneShot: boolean;
  /** Optional ordering hint (lower = earlier in progression). */
  order: number;
}

// ─── Timeline Layer State ───────────────────────────────────────────────────

/** Per-milestone tracking state. */
export interface MilestoneTracker {
  /** Ticks conditions have been continuously met. */
  sustainedTicks: number;
}

/** Full state for one timeline layer. */
export interface TimelineLayerState {
  /** ID of this timeline layer. */
  timelineId: string;
  /** Milestones that have been activated. */
  activatedMilestones: Set<string>;
  /** Sustained-tick trackers for pending milestones. */
  trackers: Map<string, MilestoneTracker>;
  /** Cumulative unlocked capabilities across all milestones. */
  unlockedCapabilities: Set<string>;
  /** Year each milestone first activated (milestoneId → calendar year). */
  activatedMilestoneYears: Map<string, number>;
}

// ─── Timeline Context (shared read-only state for evaluation) ───────────────

/** Shared context all timelines evaluate against. */
export interface TimelineContext {
  year: number;
  population: number;
  techLevel: number;
  /** World state numeric values for condition checks. */
  worldState: Record<string, number>;
  /** Pressure domain levels (0-1). */
  pressureLevels: Partial<Record<PressureDomain, number>>;
  /** Resource levels (food, power, population, oxygen, etc). */
  resources: Record<string, number>;
  /** All activated milestones across ALL timelines (for cross-references). */
  allActivatedMilestones: Map<string, Set<string>>;
}

// ─── Evaluation Result ──────────────────────────────────────────────────────

/** Result of evaluating one timeline layer for one tick. */
export interface TimelineTickResult {
  /** Milestones that activated this tick. */
  activated: Milestone[];
  /** Updated layer state. */
  state: TimelineLayerState;
  /** Aggregated effects from all activated milestones. */
  effects: MilestoneEffects[];
}

// ─── Condition Evaluator ────────────────────────────────────────────────────

/**
 * Evaluate a milestone condition against the current context.
 * Returns true if the condition is met.
 */
export function evaluateCondition(condition: MilestoneCondition, ctx: TimelineContext): boolean {
  if ('and' in condition) {
    return condition.and.every((c) => evaluateCondition(c, ctx));
  }
  if ('or' in condition) {
    return condition.or.some((c) => evaluateCondition(c, ctx));
  }
  if ('not' in condition) {
    return !evaluateCondition(condition.not, ctx);
  }
  if ('year' in condition) {
    const { min, max } = condition.year;
    if (min !== undefined && ctx.year < min) return false;
    if (max !== undefined && ctx.year > max) return false;
    return true;
  }
  if ('techLevel' in condition) {
    const { min, max } = condition.techLevel;
    if (min !== undefined && ctx.techLevel < min) return false;
    if (max !== undefined && ctx.techLevel > max) return false;
    return true;
  }
  if ('population' in condition) {
    const { min, max } = condition.population;
    if (min !== undefined && ctx.population < min) return false;
    if (max !== undefined && ctx.population > max) return false;
    return true;
  }
  if ('worldState' in condition) {
    const { key, min, max } = condition.worldState;
    const val = ctx.worldState[key] ?? 0;
    if (min !== undefined && val < min) return false;
    if (max !== undefined && val > max) return false;
    return true;
  }
  if ('pressure' in condition) {
    const { domain, min, max } = condition.pressure;
    const val = ctx.pressureLevels[domain] ?? 0;
    if (min !== undefined && val < min) return false;
    if (max !== undefined && val > max) return false;
    return true;
  }
  if ('milestone' in condition) {
    const { timelineId, milestoneId } = condition.milestone;
    const activated = ctx.allActivatedMilestones.get(timelineId);
    return activated?.has(milestoneId) ?? false;
  }
  if ('resource' in condition) {
    const { key, min, max } = condition.resource;
    const val = ctx.resources[key] ?? 0;
    if (min !== undefined && val < min) return false;
    if (max !== undefined && val > max) return false;
    return true;
  }
  return false;
}

// ─── Layer Evaluation ───────────────────────────────────────────────────────

/**
 * Evaluate all milestones in a timeline layer against current context.
 * Returns activated milestones and updated state.
 */
export function evaluateTimelineLayer(
  milestones: readonly Milestone[],
  state: TimelineLayerState,
  ctx: TimelineContext,
): TimelineTickResult {
  const activated: Milestone[] = [];
  const effects: MilestoneEffects[] = [];

  // Work with copies to avoid mutation during iteration
  const newActivated = new Set(state.activatedMilestones);
  const newTrackers = new Map(state.trackers);
  const newUnlocks = new Set(state.unlockedCapabilities);
  const newActivatedYears = new Map(state.activatedMilestoneYears);

  for (const milestone of milestones) {
    // Skip one-shot milestones already activated
    if (milestone.oneShot && newActivated.has(milestone.id)) continue;

    const conditionsMet = evaluateCondition(milestone.conditions, ctx);

    if (conditionsMet) {
      const tracker = newTrackers.get(milestone.id) ?? { sustainedTicks: 0 };
      tracker.sustainedTicks++;
      newTrackers.set(milestone.id, tracker);

      if (tracker.sustainedTicks >= milestone.sustainedTicks) {
        // Milestone activates!
        activated.push(milestone);
        effects.push(milestone.effects);
        newActivated.add(milestone.id);
        newActivatedYears.set(milestone.id, ctx.year);
        newTrackers.delete(milestone.id);

        // Add unlocked capabilities
        if (milestone.effects.unlocks) {
          for (const unlock of milestone.effects.unlocks) {
            newUnlocks.add(unlock);
          }
        }
      }
    } else {
      // Conditions broken — reset tracker
      newTrackers.delete(milestone.id);
    }
  }

  return {
    activated,
    effects,
    state: {
      timelineId: state.timelineId,
      activatedMilestones: newActivated,
      trackers: newTrackers,
      unlockedCapabilities: newUnlocks,
      activatedMilestoneYears: newActivatedYears,
    },
  };
}

// ─── Factory ────────────────────────────────────────────────────────────────

/** Create a fresh empty layer state. */
export function createLayerState(timelineId: string): TimelineLayerState {
  return {
    timelineId,
    activatedMilestones: new Set(),
    trackers: new Map(),
    unlockedCapabilities: new Set(),
    activatedMilestoneYears: new Map(),
  };
}

// ─── Serialization ──────────────────────────────────────────────────────────

export interface TimelineLayerSaveData {
  timelineId: string;
  activatedMilestones: string[];
  trackers: Array<[string, MilestoneTracker]>;
  unlockedCapabilities: string[];
  activatedMilestoneYears: Record<string, number>;
}

export function serializeLayerState(state: TimelineLayerState): TimelineLayerSaveData {
  return {
    timelineId: state.timelineId,
    activatedMilestones: [...state.activatedMilestones],
    trackers: [...state.trackers.entries()],
    unlockedCapabilities: [...state.unlockedCapabilities],
    activatedMilestoneYears: Object.fromEntries(state.activatedMilestoneYears),
  };
}

export function restoreLayerState(data: TimelineLayerSaveData): TimelineLayerState {
  return {
    timelineId: data.timelineId,
    activatedMilestones: new Set(data.activatedMilestones),
    trackers: new Map(data.trackers),
    unlockedCapabilities: new Set(data.unlockedCapabilities),
    activatedMilestoneYears: new Map(Object.entries(data.activatedMilestoneYears ?? {})),
  };
}

// ─── Multi-Layer Orchestrator ───────────────────────────────────────────────

/** A registered timeline layer with its milestones and state. */
export interface RegisteredTimeline {
  id: string;
  milestones: readonly Milestone[];
  state: TimelineLayerState;
}

/**
 * Evaluate ALL timeline layers in one tick.
 *
 * Cross-referencing works because we build the allActivatedMilestones
 * map from ALL layers' current state before evaluating any layer.
 * This means milestone A in layer X can depend on milestone B in layer Y
 * if B activated in a PREVIOUS tick.
 *
 * Same-tick cross-references don't work (intentionally — avoids order
 * dependency between layers). This is a feature: a space milestone
 * triggered by a world event will fire ONE tick after the world event,
 * creating a realistic causal delay.
 */
export function evaluateAllTimelines(
  timelines: RegisteredTimeline[],
  ctx: Omit<TimelineContext, 'allActivatedMilestones'>,
): {
  results: Map<string, TimelineTickResult>;
  allActivated: Milestone[];
  allEffects: MilestoneEffects[];
} {
  // Build cross-reference map from ALL current state
  const allActivatedMilestones = new Map<string, Set<string>>();
  for (const tl of timelines) {
    allActivatedMilestones.set(tl.id, tl.state.activatedMilestones);
  }

  const fullCtx: TimelineContext = { ...ctx, allActivatedMilestones };
  const results = new Map<string, TimelineTickResult>();
  const allActivated: Milestone[] = [];
  const allEffects: MilestoneEffects[] = [];

  for (const tl of timelines) {
    const result = evaluateTimelineLayer(tl.milestones, tl.state, fullCtx);
    results.set(tl.id, result);
    allActivated.push(...result.activated);
    allEffects.push(...result.effects);

    // Update the timeline's state in-place for next tick
    tl.state = result.state;
  }

  return { results, allActivated, allEffects };
}
