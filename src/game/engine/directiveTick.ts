/**
 * Directive tick helper — extracted from old simTick for ECS integration.
 *
 * Checks the current directive condition each tick. When a directive completes:
 *   1. Awards the ruble reward via ECS resource store
 *   2. Fires toast + advisor callbacks for UI feedback
 *   3. Advances directiveIndex on old GameState (read by useGameSnapshot)
 *   4. Notifies React so DirectiveHUD updates
 */

import { getResourceEntity } from '@/ecs/archetypes';
import { DIRECTIVES } from '@/engine/Directives';
import { gameState } from '@/engine/GameState';
import type { SimCallbacks } from '../SimulationEngine';

/** Subset of SimulationEngine state needed by the directive tick. */
export interface DirectiveContext {
  callbacks: SimCallbacks;
}

/**
 * Check the current directive and advance if its condition is met.
 * Called once per SimulationEngine tick.
 */
export function tickDirectives(ctx: DirectiveContext): void {
  const currentDir = DIRECTIVES[gameState.directiveIndex];
  if (!currentDir) return;

  if (currentDir.check()) {
    // Award reward via ECS resource store
    const store = getResourceEntity();
    if (store && currentDir.reward > 0) {
      store.resources.money += currentDir.reward;
    }

    // UI feedback
    ctx.callbacks.onToast(`DIRECTIVE COMPLETE: +${currentDir.reward}\u20BD`);

    // Advance to next directive
    gameState.directiveIndex++;

    const nextDir = DIRECTIVES[gameState.directiveIndex];
    if (nextDir && nextDir.reward > 0) {
      ctx.callbacks.onAdvisor(`New Directive Issued: ${nextDir.text}`);
    }

    // Notify old GameState so useGameSnapshot picks up the new directiveIndex
    gameState.notify();
  }
}
