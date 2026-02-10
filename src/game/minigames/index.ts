/**
 * @fileoverview Barrel file for the minigame system.
 */

export {
  getMinigameDefinition,
  MINIGAME_DEFINITIONS,
} from './definitions';
export { MinigameRouter } from './MinigameRouter';
export type {
  ActiveMinigame,
  MinigameChoice,
  MinigameDefinition,
  MinigameId,
  MinigameOutcome,
  MinigameRouterSaveData,
} from './MinigameTypes';
