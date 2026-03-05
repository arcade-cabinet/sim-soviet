/**
 * @module game/timeline/worldTimeline
 *
 * Geopolitical and civilizational progression timeline — the external
 * world the Soviet system exists within.
 *
 * This timeline runs alongside the space timeline, creating horizontal
 * intersection points where geopolitics meets space exploration.
 *
 * Near-term: Cold War, oil economics, détente, collapse.
 * Medium-term: permafrost, demographics, AI, fusion.
 * Far-future: Turchin cycles, Khaldun decay, Tainter collapse,
 *   corporate sovereignty, speciation, entropy management.
 *
 * Grounded in academic research (Turchin, Tainter, Diamond, Khaldun)
 * and hard SF (KSR Mars Trilogy, Herbert Dune, Baxter deep time).
 *
 * The timeline is data-driven from worldTimeline.json.
 * Adding new milestones requires zero TypeScript changes.
 */

import type { Milestone, RegisteredTimeline } from './TimelineLayer';
import { createLayerState } from './TimelineLayer';
import worldData from '../../config/worldTimeline.json';

/** The world timeline ID constant. */
export const WORLD_TIMELINE_ID = 'world';

/** All world milestones, loaded from JSON. */
export const WORLD_MILESTONES: readonly Milestone[] = (worldData.milestones as unknown as Milestone[]).sort(
  (a, b) => a.order - b.order,
);

/** Create a fresh registered world timeline. */
export function createWorldTimeline(): RegisteredTimeline {
  return {
    id: WORLD_TIMELINE_ID,
    milestones: WORLD_MILESTONES,
    state: createLayerState(WORLD_TIMELINE_ID),
  };
}

/** Get a world milestone by ID. */
export function getWorldMilestone(id: string): Milestone | undefined {
  return WORLD_MILESTONES.find((m) => m.id === id);
}
