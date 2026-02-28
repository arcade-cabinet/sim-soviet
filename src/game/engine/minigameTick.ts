/**
 * Minigame tick helpers — extracted from SimulationEngine.
 *
 * Handles periodic minigame triggers, building-tap triggers, event triggers,
 * choice resolution, and outcome application (resources + marks).
 */

import { getResourceEntity } from '@/ecs/archetypes';
import type { ChronologySystem } from '../ChronologySystem';
import { resolveBuildingTrigger } from '../minigames/BuildingMinigameMap';
import type { MinigameRouter } from '../minigames/MinigameRouter';
import type { MinigameOutcome } from '../minigames/MinigameTypes';
import type { PersonnelFile } from '../PersonnelFile';
import type { SimCallbacks } from '../SimulationEngine';

/** Subset of SimulationEngine state needed by minigame helpers. */
export interface MinigameContext {
  chronology: ChronologySystem;
  minigameRouter: MinigameRouter;
  personnelFile: PersonnelFile;
  callbacks: SimCallbacks;
}

/**
 * Tick minigame router -- check periodic triggers and auto-resolve timeouts.
 * Only runs when the UI callback is registered.
 */
export function tickMinigames(ctx: MinigameContext): void {
  if (!ctx.callbacks.onMinigame) return;

  const totalTicks = ctx.chronology.getDate().totalTicks;
  const population = getResourceEntity()?.resources.population ?? 0;

  // Check periodic triggers (only when no active minigame)
  if (!ctx.minigameRouter.isActive()) {
    const def = ctx.minigameRouter.checkTrigger('periodic', { totalTicks, population });
    if (def) {
      const active = ctx.minigameRouter.startMinigame(def, totalTicks);
      ctx.callbacks.onMinigame(active, (id) => resolveMinigameChoice(ctx, id));
    }
  }

  // Auto-resolve if time limit expired
  const autoOutcome = ctx.minigameRouter.tick(totalTicks);
  if (autoOutcome) {
    applyMinigameOutcome(ctx, autoOutcome);
    ctx.minigameRouter.clearResolved();
  }
}

/**
 * Called by CanvasGestureManager (via callback) when a building is tapped.
 * Checks if the building defId triggers a minigame.
 *
 * Uses BuildingMinigameMap to resolve building defIds to abstract trigger
 * conditions (e.g. 'factory-office' → 'factory_tap').
 */
export function checkBuildingTapMinigame(ctx: MinigameContext, buildingDefId: string): void {
  const totalTicks = ctx.chronology.getDate().totalTicks;
  const population = getResourceEntity()?.resources.population ?? 0;
  const resolvedId = resolveBuildingTrigger(buildingDefId);
  const def = ctx.minigameRouter.checkTrigger('building_tap', {
    buildingDefId: resolvedId,
    totalTicks,
    population,
  });
  if (def) {
    const active = ctx.minigameRouter.startMinigame(def, totalTicks);
    ctx.callbacks.onMinigame?.(active, (id) => resolveMinigameChoice(ctx, id));
  }
}

/**
 * Check whether a minigame is currently available for a given building defId.
 * Returns true if there is a matching definition and it is not on cooldown.
 * Used by the RadialInspectMenu to show/hide the Special Action button.
 */
export function isMinigameAvailable(ctx: MinigameContext, buildingDefId: string): boolean {
  if (ctx.minigameRouter.isActive()) return false;
  const totalTicks = ctx.chronology.getDate().totalTicks;
  const population = getResourceEntity()?.resources.population ?? 0;
  const resolvedId = resolveBuildingTrigger(buildingDefId);
  const def = ctx.minigameRouter.checkTrigger('building_tap', {
    buildingDefId: resolvedId,
    totalTicks,
    population,
  });
  return def !== null;
}

/**
 * Called after EventSystem fires an event -- check if the event triggers a minigame.
 */
export function checkEventMinigame(ctx: MinigameContext, eventId: string): void {
  const totalTicks = ctx.chronology.getDate().totalTicks;
  const population = getResourceEntity()?.resources.population ?? 0;
  const def = ctx.minigameRouter.checkTrigger('event', { eventId, totalTicks, population });
  if (def) {
    const active = ctx.minigameRouter.startMinigame(def, totalTicks);
    ctx.callbacks.onMinigame?.(active, (id) => resolveMinigameChoice(ctx, id));
  }
}

/**
 * Called by UI when the player makes a minigame choice.
 * Applies the outcome and clears the resolved state.
 */
export function resolveMinigameChoice(ctx: MinigameContext, choiceId: string): void {
  const outcome = ctx.minigameRouter.resolveChoice(choiceId);
  applyMinigameOutcome(ctx, outcome);
  ctx.minigameRouter.clearResolved();
}

/**
 * Applies a MinigameOutcome's effects: resource deltas, marks, commendations, toast.
 */
export function applyMinigameOutcome(ctx: MinigameContext, outcome: MinigameOutcome): void {
  const totalTicks = ctx.chronology.getDate().totalTicks;

  applyMinigameResources(outcome);
  applyMinigameMarks(ctx, outcome, totalTicks);

  // Emit UI notification
  if (outcome.announcement) {
    ctx.callbacks.onToast(outcome.announcement, outcome.severity);
  }
}

function applyMinigameResources(outcome: MinigameOutcome): void {
  const store = getResourceEntity();
  const res = outcome.resources;
  if (!store || !res) return;
  const r = store.resources;
  if (res.money) r.money = Math.max(0, r.money + res.money);
  if (res.food) r.food = Math.max(0, r.food + res.food);
  if (res.vodka) r.vodka = Math.max(0, r.vodka + res.vodka);
  if (res.population) r.population = Math.max(0, r.population + res.population);
}

function applyMinigameMarks(
  ctx: MinigameContext,
  outcome: MinigameOutcome,
  totalTicks: number
): void {
  const marks = outcome.blackMarks ?? 0;
  for (let i = 0; i < marks; i++) {
    ctx.personnelFile.addMark('black_market', totalTicks, outcome.announcement);
  }
  const commendations = outcome.commendations ?? 0;
  for (let i = 0; i < commendations; i++) {
    ctx.personnelFile.addCommendation('inspection_passed', totalTicks, outcome.announcement);
  }
}
