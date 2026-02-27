/**
 * Achievement and tutorial tick helpers -- extracted from SimulationEngine.
 *
 * Handles periodic achievement condition checks and tutorial milestone
 * evaluation during Era 1.
 */

import { buildingsLogic, getMetaEntity, getResourceEntity } from '@/ecs/archetypes';
import type { AchievementTracker } from '../AchievementTracker';
import type { ChronologySystem } from '../ChronologySystem';
import type { SimCallbacks } from '../SimulationEngine';
import type { TutorialSystem } from '../TutorialSystem';

/** Subset of SimulationEngine state needed by achievement/tutorial helpers. */
export interface AchievementContext {
  chronology: ChronologySystem;
  achievements: AchievementTracker;
  tutorial: TutorialSystem;
  callbacks: SimCallbacks;
}

/**
 * Tick the achievement tracker -- update running stats and check conditions.
 * Achievement checks run every 10 ticks (not every tick) to limit overhead.
 */
export function tickAchievements(ctx: AchievementContext): void {
  const totalTicks = ctx.chronology.getDate().totalTicks;
  if (totalTicks % 10 !== 0) return;

  const res = getResourceEntity();
  const date = ctx.chronology.getDate();
  const population = res?.resources.population ?? 0;

  const newUnlocks = ctx.achievements.tick(
    res?.resources ?? null,
    buildingsLogic.entities.length,
    population,
    date.year,
    10 / 30 // ~0.33 seconds per 10 ticks at 30 ticks/second
  );

  for (const ach of newUnlocks) {
    ctx.callbacks.onToast(`ACHIEVEMENT: ${ach.name}`, 'warning');
    ctx.callbacks.onAchievement?.(ach.name, ach.description);
  }
}

/**
 * Tick the tutorial system -- check milestone conditions each cycle.
 * When a milestone triggers, fire advisor callback with Krupnik dialogue.
 */
export function tickTutorial(ctx: AchievementContext): void {
  if (!ctx.tutorial.isActive()) return;

  const meta = getMetaEntity();
  const res = getResourceEntity();
  if (!meta || !res) return;

  const totalTicks = ctx.chronology.getDate().totalTicks;
  const milestone = ctx.tutorial.tick(
    totalTicks,
    meta.gameMeta,
    res.resources,
    buildingsLogic.entities.length
  );

  if (milestone) {
    // Fire advisor callback with Krupnik's dialogue
    ctx.callbacks.onAdvisor(milestone.dialogue);
    ctx.callbacks.onTutorialMilestone?.(milestone);

    // If milestone pauses simulation, the UI layer handles that via the callback
  }
}
