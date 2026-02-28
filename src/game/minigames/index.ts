/**
 * @fileoverview Barrel file for the minigame system.
 */

export {
  getMinigameNameForBuilding,
  resolveBuildingTrigger,
} from './BuildingMinigameMap';
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
export { autoResolveMiningExpedition } from './MiningExpedition';
