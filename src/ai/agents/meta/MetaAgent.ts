/**
 * @fileoverview MetaAgent -- Yuka Vehicle that wraps achievement tracking,
 * tutorial progression, minigame routing, and directive evaluation.
 *
 * Absorbs AchievementTracker, TutorialSystem, MinigameRouter, and the
 * extracted tick helpers (achievementTick, directiveTick, minigameTick).
 */

import { Vehicle } from 'yuka';
import type { GameRng } from '../../../game/SeedSystem';
import type { AchievementTrackerSaveData } from './AchievementTracker';
import { AchievementTracker } from './AchievementTracker';
import {
  type AchievementContext,
  tickAchievements as tickAchievementsHelper,
  tickTutorial as tickTutorialHelper,
} from './achievementTick';
import { type DirectiveContext, tickDirectives as tickDirectivesHelper } from './directiveTick';
import { MinigameRouter } from './minigames/MinigameRouter';
import type { MinigameRouterSaveData } from './minigames/MinigameTypes';
import {
  checkBuildingTapMinigame as checkBuildingTapMinigameHelper,
  checkEventMinigame as checkEventMinigameHelper,
  isMinigameAvailable as isMinigameAvailableHelper,
  type MinigameContext,
  resolveMinigameChoice as resolveMinigameChoiceHelper,
  tickMinigames as tickMinigamesHelper,
} from './minigameTick';
import type { TutorialSaveData } from './TutorialSystem';
import { TutorialSystem } from './TutorialSystem';

// ─────────────────────────────────────────────────────────
//  SAVE DATA
// ─────────────────────────────────────────────────────────

/** Serialized MetaAgent state for save/load. */
export interface MetaAgentSaveData {
  achievements: AchievementTrackerSaveData;
  tutorial: TutorialSaveData;
  minigames: MinigameRouterSaveData;
}

// ─────────────────────────────────────────────────────────
//  AGENT
// ─────────────────────────────────────────────────────────

/**
 * MetaAgent wraps the achievement, tutorial, minigame, and directive
 * systems under a single Yuka Vehicle for agent-based orchestration.
 */
export class MetaAgent extends Vehicle {
  private achievements: AchievementTracker;
  private tutorial: TutorialSystem;
  private minigameRouter: MinigameRouter;

  constructor(rng?: GameRng) {
    super();
    this.achievements = new AchievementTracker();
    this.tutorial = new TutorialSystem();
    this.minigameRouter = new MinigameRouter(rng);
  }

  // ── Tick delegates ─────────────────────────────────────

  /** Tick achievement tracker -- update stats and check conditions. */
  tickAchievements(ctx: AchievementContext): void {
    tickAchievementsHelper(ctx);
  }

  /** Tick tutorial system -- check milestone conditions. */
  tickTutorial(ctx: AchievementContext): void {
    tickTutorialHelper(ctx);
  }

  /** Tick minigame router -- periodic triggers and auto-resolve. */
  tickMinigames(ctx: MinigameContext): void {
    tickMinigamesHelper(ctx);
  }

  /** Tick directives -- check and advance directive conditions. */
  tickDirectives(ctx: DirectiveContext): void {
    tickDirectivesHelper(ctx);
  }

  // ── Minigame convenience methods ───────────────────────

  /** Resolve a player's minigame choice by choiceId. */
  resolveMinigameChoice(ctx: MinigameContext, choiceId: string): void {
    resolveMinigameChoiceHelper(ctx, choiceId);
  }

  /** Check if a building tap triggers a minigame. */
  checkBuildingTapMinigame(ctx: MinigameContext, defId: string): void {
    checkBuildingTapMinigameHelper(ctx, defId);
  }

  /** Check whether a minigame is available for a building defId. */
  isMinigameAvailable(ctx: MinigameContext, defId: string): boolean {
    return isMinigameAvailableHelper(ctx, defId);
  }

  /** Check if an event triggers a minigame. */
  checkEventMinigame(ctx: MinigameContext, eventId: string): void {
    checkEventMinigameHelper(ctx, eventId);
  }

  // ── Subsystem accessors ────────────────────────────────

  /** Get the AchievementTracker instance. */
  getAchievements(): AchievementTracker {
    return this.achievements;
  }

  /** Get the TutorialSystem instance. */
  getTutorial(): TutorialSystem {
    return this.tutorial;
  }

  /** Get the MinigameRouter instance. */
  getMinigameRouter(): MinigameRouter {
    return this.minigameRouter;
  }

  // ── Serialization ──────────────────────────────────────

  /** Serialize all meta subsystem state. */
  serializeMeta(): MetaAgentSaveData {
    return {
      achievements: this.achievements.serialize(),
      tutorial: this.tutorial.serialize(),
      minigames: this.minigameRouter.serialize(),
    };
  }

  /** Restore meta subsystem state from save data. */
  restoreMeta(data: MetaAgentSaveData, rng?: GameRng): void {
    if (data.achievements) {
      this.achievements = AchievementTracker.deserialize(data.achievements);
    }
    if (data.tutorial) {
      this.tutorial = TutorialSystem.deserialize(data.tutorial);
    }
    if (data.minigames) {
      this.minigameRouter = MinigameRouter.deserialize(data.minigames, rng);
    }
  }
}
