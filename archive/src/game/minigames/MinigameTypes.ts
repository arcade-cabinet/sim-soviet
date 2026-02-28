/**
 * @fileoverview Core types for the SimSoviet 2000 minigame system.
 *
 * Minigames are triggered by events, building taps, or periodic timers.
 * Each presents the player with 2-3 impossible choices. Ignoring a
 * minigame always produces a worse outcome than engaging with it.
 */

// ─────────────────────────────────────────────────────────
//  MINIGAME IDS
// ─────────────────────────────────────────────────────────

export type MinigameId =
  | 'the_queue'
  | 'ideology_session'
  | 'the_inspection'
  | 'conscription_selection'
  | 'black_market'
  | 'factory_emergency'
  | 'the_hunt'
  | 'interrogation'
  | 'mining_expedition';

// ─────────────────────────────────────────────────────────
//  OUTCOME
// ─────────────────────────────────────────────────────────

/** The concrete result of a minigame resolution (choice or auto). */
export interface MinigameOutcome {
  /** Resource deltas applied to the global stockpile. */
  resources?: Partial<{ money: number; food: number; vodka: number; population: number }>;
  /** Black marks added to the personnel file. */
  blackMarks?: number;
  /** Commendations added to the personnel file. */
  commendations?: number;
  /** Blat (favor network) gained or lost. */
  blat?: number;
  /** Human-readable announcement text shown as a toast / ticker. */
  announcement: string;
  /** Toast severity for UI coloring. */
  severity?: 'warning' | 'critical' | 'evacuation';
}

// ─────────────────────────────────────────────────────────
//  CHOICE
// ─────────────────────────────────────────────────────────

/** A single player-facing choice within a minigame. */
export interface MinigameChoice {
  /** Stable identifier for this choice (e.g. "fair_distribution"). */
  id: string;
  /** Short button label. */
  label: string;
  /** Longer tooltip / description visible to the player. */
  description: string;
  /** Probability of success when this choice is made (0-1). */
  successChance: number;
  /** Outcome applied on a successful roll. */
  onSuccess: MinigameOutcome;
  /** Outcome applied on a failed roll. */
  onFailure: MinigameOutcome;
}

// ─────────────────────────────────────────────────────────
//  DEFINITION
// ─────────────────────────────────────────────────────────

/** Static definition of a minigame template. */
export interface MinigameDefinition {
  /** Unique minigame identifier. */
  id: MinigameId;
  /** Display name. */
  name: string;
  /** Sardonic flavor text shown when the minigame starts. */
  description: string;
  /** What triggers this minigame. */
  triggerType: 'building_tap' | 'event' | 'periodic';
  /** Context string: building defId, event ID, or periodic qualifier. */
  triggerCondition: string;
  /** Choices the player can make. */
  choices: MinigameChoice[];
  /** Outcome when the player ignores the minigame (always worse). */
  autoResolve: MinigameOutcome;
  /** Ticks before auto-resolve fires (-1 = no time limit). */
  tickLimit: number;
}

// ─────────────────────────────────────────────────────────
//  ACTIVE INSTANCE
// ─────────────────────────────────────────────────────────

/** A minigame that is currently presented to the player. */
export interface ActiveMinigame {
  /** The static definition backing this instance. */
  definition: MinigameDefinition;
  /** Tick at which the minigame was started. */
  startTick: number;
  /** Whether the minigame has been resolved (choice or auto). */
  resolved: boolean;
  /** ID of the choice the player made (undefined if auto-resolved). */
  choiceMade?: string;
  /** The final outcome that was applied. */
  outcome?: MinigameOutcome;
}

// ─────────────────────────────────────────────────────────
//  SERIALIZATION
// ─────────────────────────────────────────────────────────

/** Serialized state for save/load. */
export interface MinigameRouterSaveData {
  activeMinigameId: MinigameId | null;
  activeStartTick: number;
  cooldowns: Record<string, number>;
}
