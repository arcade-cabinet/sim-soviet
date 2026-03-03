/**
 * @fileoverview Barrel exports for the MetaAgent subpackage.
 *
 * Re-exports MetaAgent, AchievementTracker, TutorialSystem, MinigameRouter,
 * and all tick helper functions + types consumed by SimulationEngine.
 */

export type { AchievementStats, AchievementTrackerSaveData } from './AchievementTracker';
// ── AchievementTracker ───────────────────────────────────
export { AchievementTracker } from './AchievementTracker';
export type { AchievementContext } from './achievementTick';
// ── Tick helpers ─────────────────────────────────────────
export { tickAchievements, tickTutorial } from './achievementTick';
export type { DirectiveContext } from './directiveTick';
export { tickDirectives } from './directiveTick';
export type { MetaAgentSaveData } from './MetaAgent';
// ── MetaAgent ────────────────────────────────────────────
export { MetaAgent } from './MetaAgent';
export { getMinigameNameForBuilding, resolveBuildingTrigger } from './minigames/BuildingMinigameMap';
export { getMinigameDefinition, MINIGAME_DEFINITIONS } from './minigames/definitions';
// ── MinigameRouter + types ───────────────────────────────
export { MinigameRouter } from './minigames/MinigameRouter';
export type {
  ActiveMinigame,
  InteractiveMinigameType,
  MinigameChoice,
  MinigameDefinition,
  MinigameId,
  MinigameOutcome,
  MinigameRouterSaveData,
} from './minigames/MinigameTypes';
export { autoResolveMiningExpedition } from './minigames/MiningExpedition';
export type { MinigameContext } from './minigameTick';
export {
  applyMinigameOutcome,
  checkBuildingTapMinigame,
  checkEventMinigame,
  isMinigameAvailable,
  resolveMinigameChoice,
  tickMinigames,
} from './minigameTick';
export type { TutorialMilestone, TutorialSaveData, UIElement } from './TutorialSystem';
// ── TutorialSystem ───────────────────────────────────────
export { MILESTONE_LABELS, TUTORIAL_MILESTONES, TutorialSystem, UI_REVEAL_SCHEDULE } from './TutorialSystem';
