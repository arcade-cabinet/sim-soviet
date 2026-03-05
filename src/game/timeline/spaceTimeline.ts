/**
 * @module game/timeline/spaceTimeline
 *
 * Soviet Space Program timeline — a parallel progression track from
 * Sputnik (1957) to interstellar colonization.
 *
 * This timeline runs alongside the historical/freeform timeline.
 * In historical mode, milestones fire on real Soviet dates.
 * In freeform mode, they fire when tech thresholds are met.
 * The space program is INEVITABLE — if you survive long enough
 * and meet tech requirements, space happens.
 *
 * Each milestone that creates a new settlement adds another grid
 * with its own agent tree, pressure system, and terrain profile.
 *
 * The timeline is data-driven from spaceTimeline.json.
 * Adding new milestones requires zero TypeScript changes.
 */

import type { Milestone, RegisteredTimeline } from './TimelineLayer';
import { createLayerState } from './TimelineLayer';
import spaceData from '../../config/spaceTimeline.json';

/** The space timeline ID constant. */
export const SPACE_TIMELINE_ID = 'space';

/** All space milestones, loaded from JSON. */
export const SPACE_MILESTONES: readonly Milestone[] = (spaceData.milestones as unknown as Milestone[]).sort(
  (a, b) => a.order - b.order,
);

/** Number of space milestones that create new settlements. */
export const SPACE_SETTLEMENT_MILESTONES = SPACE_MILESTONES.filter((m) => m.effects.newSettlement).length;

/** Create a fresh registered space timeline. */
export function createSpaceTimeline(): RegisteredTimeline {
  return {
    id: SPACE_TIMELINE_ID,
    milestones: SPACE_MILESTONES,
    state: createLayerState(SPACE_TIMELINE_ID),
  };
}

/** Get a space milestone by ID. */
export function getSpaceMilestone(id: string): Milestone | undefined {
  return SPACE_MILESTONES.find((m) => m.id === id);
}

/** Get all space milestones that require a given capability unlock. */
export function getMilestonesDependingOn(capability: string): Milestone[] {
  // A milestone "depends on" a capability if any of its predecessor milestones
  // unlock that capability. Since we use milestone cross-references rather than
  // direct capability checks, this is informational only.
  return SPACE_MILESTONES.filter((m) => {
    const conditions = JSON.stringify(m.conditions);
    return conditions.includes(capability);
  });
}
