/**
 * @fileoverview MinigameRouter -- manages active minigames, trigger checks,
 * choice resolution, cooldowns, and auto-resolve on timeout.
 *
 * Only one minigame can be active at a time. Cooldowns prevent the same
 * minigame from re-triggering too quickly.
 */

import type { GameRng } from '../SeedSystem';
import { getMinigameDefinition, MINIGAME_DEFINITIONS } from './definitions';
import type {
  ActiveMinigame,
  MinigameDefinition,
  MinigameId,
  MinigameOutcome,
  MinigameRouterSaveData,
} from './MinigameTypes';
import { autoResolveMiningExpedition } from './MiningExpedition';

// ─────────────────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────────────────

/** Default cooldown in ticks after a minigame resolves before it can trigger again. */
const DEFAULT_COOLDOWN = 60;

/** Minimum population required for periodic queue minigame. */
const QUEUE_POPULATION_THRESHOLD = 30;

/** Module-level RNG reference, set by constructor. */
let _rng: GameRng | null = null;

// ─────────────────────────────────────────────────────────
//  ROUTER
// ─────────────────────────────────────────────────────────

export class MinigameRouter {
  private active: ActiveMinigame | null = null;
  private cooldowns: Map<MinigameId, number> = new Map();

  constructor(rng?: GameRng) {
    if (rng) _rng = rng;
  }

  // ── Trigger checking ─────────────────────────────────

  /**
   * Check whether a minigame should trigger for the given context.
   * Returns the matching definition, or null if nothing should trigger.
   */
  checkTrigger(
    trigger: 'building_tap' | 'event' | 'periodic',
    context: {
      buildingDefId?: string;
      eventId?: string;
      totalTicks: number;
      population: number;
    }
  ): MinigameDefinition | null {
    if (this.active) return null; // only one at a time

    for (const def of MINIGAME_DEFINITIONS) {
      if (def.triggerType !== trigger) continue;
      if (this.isOnCooldown(def.id, context.totalTicks)) continue;

      if (this.matchesTrigger(def, trigger, context)) {
        return def;
      }
    }

    return null;
  }

  // ── Lifecycle ────────────────────────────────────────

  /** Start a minigame instance. Returns the active minigame. */
  startMinigame(definition: MinigameDefinition, startTick: number): ActiveMinigame {
    this.active = {
      definition,
      startTick,
      resolved: false,
    };
    return this.active;
  }

  /** Resolve a minigame by player choice. Returns the outcome. */
  resolveChoice(choiceId: string): MinigameOutcome {
    if (!this.active || this.active.resolved) {
      return { announcement: 'No active minigame.' };
    }

    const choice = this.active.definition.choices.find((c) => c.id === choiceId);
    if (!choice) {
      return { announcement: 'Invalid choice.' };
    }

    const roll = _rng?.random() ?? Math.random();
    const success = roll < choice.successChance;
    const outcome = success ? choice.onSuccess : choice.onFailure;

    this.active.resolved = true;
    this.active.choiceMade = choiceId;
    this.active.outcome = outcome;

    // Set cooldown
    this.cooldowns.set(this.active.definition.id, this.active.startTick + DEFAULT_COOLDOWN);

    return outcome;
  }

  /** Force auto-resolve (player ignored or time expired). */
  autoResolve(): MinigameOutcome {
    if (!this.active || this.active.resolved) {
      return { announcement: 'No active minigame.' };
    }

    const outcome = this.dynamicAutoResolve(this.active.definition);
    this.active.resolved = true;
    this.active.outcome = outcome;

    // Set cooldown
    this.cooldowns.set(this.active.definition.id, this.active.startTick + DEFAULT_COOLDOWN);

    return outcome;
  }

  /** Called each simulation tick. Auto-resolves if time limit exceeded. */
  tick(totalTicks: number): MinigameOutcome | null {
    if (!this.active || this.active.resolved) return null;

    const { definition, startTick } = this.active;
    if (definition.tickLimit < 0) return null; // no time limit

    if (totalTicks - startTick >= definition.tickLimit) {
      return this.autoResolve();
    }

    return null;
  }

  // ── Queries ──────────────────────────────────────────

  /** Whether a minigame is currently active (resolved or not). */
  isActive(): boolean {
    return this.active !== null && !this.active.resolved;
  }

  /** Get the current active minigame for UI rendering. */
  getActive(): ActiveMinigame | null {
    return this.active;
  }

  /** Clear the resolved minigame so a new one can trigger. */
  clearResolved(): void {
    if (this.active?.resolved) {
      this.active = null;
    }
  }

  // ── Serialization ────────────────────────────────────

  /** Serialize router state for save/load. */
  serialize(): MinigameRouterSaveData {
    const cooldownRecord: Record<string, number> = {};
    for (const [id, tick] of this.cooldowns) {
      cooldownRecord[id] = tick;
    }

    return {
      activeMinigameId: this.active && !this.active.resolved ? this.active.definition.id : null,
      activeStartTick: this.active?.startTick ?? 0,
      cooldowns: cooldownRecord,
    };
  }

  /** Restore router state from save data. */
  static deserialize(data: MinigameRouterSaveData, rng?: GameRng): MinigameRouter {
    const router = new MinigameRouter(rng);

    // Restore cooldowns
    for (const [id, tick] of Object.entries(data.cooldowns)) {
      router.cooldowns.set(id as MinigameId, tick);
    }

    // Restore active minigame
    if (data.activeMinigameId) {
      const def = getMinigameDefinition(data.activeMinigameId);
      if (def) {
        router.startMinigame(def, data.activeStartTick);
      }
    }

    return router;
  }

  // ── Private helpers ──────────────────────────────────

  private isOnCooldown(id: MinigameId, currentTick: number): boolean {
    const cooldownUntil = this.cooldowns.get(id);
    if (cooldownUntil === undefined) return false;
    return currentTick < cooldownUntil;
  }

  private matchesTrigger(
    def: MinigameDefinition,
    trigger: 'building_tap' | 'event' | 'periodic',
    context: {
      buildingDefId?: string;
      eventId?: string;
      totalTicks: number;
      population: number;
    }
  ): boolean {
    switch (trigger) {
      case 'building_tap':
        return def.triggerCondition === context.buildingDefId;

      case 'event':
        return def.triggerCondition === context.eventId;

      case 'periodic':
        return this.checkPeriodicCondition(def, context);

      default:
        return false;
    }
  }

  private checkPeriodicCondition(
    def: MinigameDefinition,
    context: { totalTicks: number; population: number }
  ): boolean {
    switch (def.triggerCondition) {
      case 'population_60':
        // The Queue: every 60 ticks when population is high enough
        return context.population >= QUEUE_POPULATION_THRESHOLD && context.totalTicks % 60 === 0;

      case 'inspection_180':
        // The Inspection: every 180 ticks
        return context.totalTicks % 180 === 0 && context.totalTicks > 0;

      default:
        return false;
    }
  }

  /**
   * Resolve auto-resolve outcome for a minigame definition.
   * Most minigames use the static `definition.autoResolve` outcome.
   * The mining expedition uses RNG-driven dynamic resolution.
   */
  private dynamicAutoResolve(definition: MinigameDefinition): MinigameOutcome {
    if (definition.id === 'mining_expedition' && _rng) {
      return autoResolveMiningExpedition(_rng);
    }
    return definition.autoResolve;
  }
}
