/**
 * Reset — clears all module-level singletons so a new game can start fresh.
 *
 * On native platforms there is no window.location.reload(), so when the player
 * finishes a game and returns to the main menu we must manually tear down every
 * singleton that persists across React component lifecycles.
 */

import AudioManager from '../audio/AudioManager';
import SFXManager from '../audio/SFXManager';
import { world } from '../ecs/world';
import { gameState } from '../engine/GameState';
import { clearToast, dismissAdvisor } from '../engine/helpers';
import {
  closeBuildingInspector,
  closeCitizenDossier,
  closeCitizenDossierByIndex,
  closeInspectMenu,
  closePoliticalPanel,
  closeRadialMenu,
  notifyStateChange,
  setAssignmentMode,
  setCursorTooltip,
  setDragState,
  setGameSpeed,
  setInspected,
  setInspectedWorker,
  setPaused,
} from '../stores/gameStore';
import { clearNotificationHistory } from '../ui/NotificationStore';
import { resetThawFreezeState, resetPaperwork } from '../game/political/doctrine';
import { resetBuildingTrudodni } from '../game/TrudodniSystem';
import { resetGameInit } from './GameInit';

/**
 * Resets all module-level singletons so a fresh game can be initialized.
 *
 * Call this when transitioning from the game screen back to the main menu.
 */
export function resetAllSingletons(): void {
  // 1. Stop audio playback and dispose singletons
  AudioManager.getInstance().dispose();
  SFXManager.getInstance().dispose();

  // 2. Clear ECS world (removes all entities from all buckets)
  world.clear();

  // 3. Reset GameState mutable singleton to initial values
  gameState.speed = 1;
  gameState.lastTime = 0;
  gameState.simAccumulator = 0;
  gameState.animTime = 0;
  gameState.tickDuration = 1000;
  gameState.money = 2000;
  gameState.lastIncome = 0;
  gameState.pop = 0;
  gameState.food = 200;
  gameState.vodka = 50;
  gameState.powerGen = 0;
  gameState.powerUsed = 0;
  gameState.waterGen = 0;
  gameState.waterUsed = 0;
  gameState.date = { year: 1917, month: 1, tick: 0 };
  gameState.grid = [];
  gameState.buildings = [];
  gameState.traffic = [];
  gameState.zeppelins = [];
  gameState.floatingTexts = [];
  gameState.train = { active: false, x: -5, y: 12, timer: 0 };
  gameState.meteor = { active: false, struck: false, x: 0, y: 0, z: 1500, tx: 0, ty: 0 };
  gameState.meteorShake = 0;
  gameState.activeLaunch = null;
  gameState.activeLightning = null;
  gameState.currentWeather = 'snow';
  gameState.timeOfDay = 0.5;
  gameState.directiveIndex = 0;
  gameState.activeTab = 'zone';
  gameState.selectedTool = 'none';
  gameState.activeLens = 'default';
  gameState.quota = { type: 'food', target: 500, current: 0, deadlineYear: 1922 };

  // 4. Clear toast/advisor side-channel
  clearToast();
  dismissAdvisor();

  // 5. Clear notification history
  clearNotificationHistory();

  // 6. Reset gameStore singleton state
  setPaused(false);
  setGameSpeed(1);
  setDragState(null);
  setInspected(null);
  setInspectedWorker(null);
  setAssignmentMode(null);
  setCursorTooltip(null);
  closeBuildingInspector();
  closeCitizenDossier();
  closeCitizenDossierByIndex();
  closeRadialMenu();
  closeInspectMenu();
  closePoliticalPanel();

  // 7. Reset doctrine module-level state (thaw/freeze + paperwork)
  resetThawFreezeState();
  resetPaperwork();

  // 8. Reset per-building trudodni tracking
  resetBuildingTrudodni();

  // 9. Reset GameInit module-level state so initGame() can run again
  resetGameInit();

  // 10. Final notification to clear React snapshots
  notifyStateChange();
  gameState.notify();
}
