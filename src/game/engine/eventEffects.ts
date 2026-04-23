/**
 * eventEffects — apply GameEvent resource effects to the ECS store.
 *
 * Extracted from SimulationEngine so the constructor's politburoEventHandler
 * can reference it without inlining the logic.
 */

import type { GameEvent } from '../../ai/agents/narrative/events';
import type { WorkerSystem } from '../../ai/agents/workforce/WorkerSystem';
import { getResourceEntity } from '../../ecs/archetypes';

/**
 * Apply a GameEvent's resource effects to the ECS resource store.
 * Population changes go through WorkerSystem (spawn/remove workers).
 */
export function applyEventEffects(event: GameEvent, workerSystem: WorkerSystem): void {
  const store = getResourceEntity();
  if (!store) return;
  const r = store.resources;
  const fx = event.effects;
  if (fx.money) r.money = Math.max(0, r.money + fx.money);
  if (fx.food) r.food = Math.max(0, r.food + fx.food);
  if (fx.vodka) r.vodka = Math.max(0, r.vodka + fx.vodka);
  if (fx.pop) {
    if (fx.pop > 0) {
      workerSystem.spawnInflowDvor(fx.pop, 'event');
    } else {
      workerSystem.removeWorkersByCount(-fx.pop, 'event');
    }
  }
  if (fx.power) r.power = Math.max(0, r.power + fx.power);
}
