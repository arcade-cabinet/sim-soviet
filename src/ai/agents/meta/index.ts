/**
 * @fileoverview Barrel exports for the MetaAgent subpackage.
 *
 * Re-exports MetaAgent, AchievementTracker, TutorialSystem, MinigameRouter,
 * and all tick helper functions + types consumed by SimulationEngine.
 */

// ── MetaAgent ────────────────────────────────────────────
export { MetaAgent } from './MetaAgent';
export type { MetaAgentSaveData } from './MetaAgent';

// ── AchievementTracker ───────────────────────────────────
export { AchievementTracker } from './AchievementTracker';
export type { AchievementTrackerSaveData, AchievementStats } from './AchievementTracker';

// ── TutorialSystem ───────────────────────────────────────
export { TutorialSystem, TUTORIAL_MILESTONES, MILESTONE_LABELS, UI_REVEAL_SCHEDULE } from './TutorialSystem';
export type { TutorialSaveData, TutorialMilestone, UIElement } from './TutorialSystem';

// ── MinigameRouter + types ───────────────────────────────
export { MinigameRouter } from './minigames/MinigameRouter';
export type {
  ActiveMinigame,
  MinigameChoice,
  MinigameDefinition,
  MinigameId,
  MinigameOutcome,
  MinigameRouterSaveData,
  InteractiveMinigameType,
} from './minigames/MinigameTypes';
export { getMinigameNameForBuilding, resolveBuildingTrigger } from './minigames/BuildingMinigameMap';
export { getMinigameDefinition, MINIGAME_DEFINITIONS } from './minigames/definitions';
export { autoResolveMiningExpedition } from './minigames/MiningExpedition';

// ── Tick helpers ─────────────────────────────────────────
export { tickAchievements, tickTutorial } from './achievementTick';
export type { AchievementContext } from './achievementTick';
export { tickDirectives } from './directiveTick';
export type { DirectiveContext } from './directiveTick';
export {
  tickMinigames,
  checkBuildingTapMinigame,
  checkEventMinigame,
  isMinigameAvailable,
  resolveMinigameChoice,
  applyMinigameOutcome,
} from './minigameTick';
export type { MinigameContext } from './minigameTick';
