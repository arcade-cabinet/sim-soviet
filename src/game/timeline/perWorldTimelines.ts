/**
 * @module game/timeline/perWorldTimelines
 *
 * Dynamic per-world timeline registry.
 *
 * When the Space Timeline fires a settlement-creating milestone,
 * the corresponding per-world timeline is discovered and registered.
 * Each world has its own progression track with 10-15 milestones
 * specific to that environment.
 *
 * The player DISCOVERS timelines by colonizing new worlds.
 * The more worlds colonized, the more parallel timelines run,
 * the richer the emergent narrative becomes.
 *
 * Architecture:
 * - Each per-world timeline is a standard RegisteredTimeline
 * - Loaded from JSON (data-driven, moddable)
 * - Registered dynamically when trigger milestone activates
 * - Evaluated alongside space + world timelines every tick
 * - Cross-references other timelines for rich interaction
 *
 * Trigger mapping:
 *   permanent_lunar_base  → lunar timeline
 *   mars_colony           → mars timeline
 *   venus_cloud_colony    → venus timeline
 *   ganymede_colony       → jupiter timeline
 *   ceres_mining_station  → belt timeline
 *   titan_colony          → titan timeline
 *   generation_ship       → generation ship timeline
 *   exoplanet_colony      → exoplanet timeline
 */

import type { Milestone, RegisteredTimeline } from './TimelineLayer';
import { createLayerState } from './TimelineLayer';

// Lazy-load JSON to avoid circular imports and keep bundle small
// until timelines are actually discovered
import lunarData from '../../config/lunarTimeline.json';
import marsData from '../../config/marsTimeline.json';
import venusData from '../../config/venusTimeline.json';
import jupiterData from '../../config/jupiterTimeline.json';
import beltData from '../../config/beltTimeline.json';
import titanData from '../../config/titanTimeline.json';
import generationShipData from '../../config/generationShipTimeline.json';
import exoplanetData from '../../config/exoplanetTimeline.json';

// ─── Timeline Definitions ────────────────────────────────────────────────────

interface PerWorldTimelineDef {
  /** Space milestone that triggers this timeline's discovery. */
  triggerMilestoneId: string;
  /** Timeline ID. */
  timelineId: string;
  /** JSON data source. */
  data: { timelineId: string; milestones: unknown[] };
}

const PER_WORLD_DEFS: PerWorldTimelineDef[] = [
  { triggerMilestoneId: 'permanent_lunar_base', timelineId: 'lunar', data: lunarData },
  { triggerMilestoneId: 'mars_colony', timelineId: 'mars', data: marsData },
  { triggerMilestoneId: 'venus_cloud_colony', timelineId: 'venus', data: venusData },
  { triggerMilestoneId: 'ganymede_colony', timelineId: 'jupiter', data: jupiterData },
  { triggerMilestoneId: 'ceres_mining_station', timelineId: 'belt', data: beltData },
  { triggerMilestoneId: 'titan_colony', timelineId: 'titan', data: titanData },
  { triggerMilestoneId: 'generation_ship', timelineId: 'generation_ship', data: generationShipData },
  { triggerMilestoneId: 'exoplanet_colony', timelineId: 'exoplanet', data: exoplanetData },
];

// ─── Registry ────────────────────────────────────────────────────────────────

/** All per-world timeline definitions (for enumeration). */
export const ALL_PER_WORLD_DEFS = PER_WORLD_DEFS;

/** Total number of per-world timelines. */
export const PER_WORLD_TIMELINE_COUNT = PER_WORLD_DEFS.length;

/**
 * Get the trigger milestone ID → timeline ID mapping.
 * Used by the tick loop to check if a newly activated space milestone
 * should spawn a new per-world timeline.
 */
export function getTriggerMapping(): Map<string, string> {
  return new Map(PER_WORLD_DEFS.map((d) => [d.triggerMilestoneId, d.timelineId]));
}

/**
 * Create a registered timeline for a specific world.
 * Called when the trigger space milestone activates.
 */
export function createPerWorldTimeline(timelineId: string): RegisteredTimeline | undefined {
  const def = PER_WORLD_DEFS.find((d) => d.timelineId === timelineId);
  if (!def) return undefined;

  const milestones = (def.data.milestones as unknown as Milestone[]).sort(
    (a, b) => a.order - b.order,
  );

  return {
    id: def.timelineId,
    milestones,
    state: createLayerState(def.timelineId),
  };
}

/**
 * Check which per-world timelines should be created based on
 * newly activated space milestones.
 *
 * @param newlyActivatedSpaceMilestones - IDs of space milestones activated this tick
 * @param alreadyRegisteredTimelines - IDs of timelines already registered
 * @returns Array of newly created RegisteredTimeline objects
 */
export function discoverNewTimelines(
  newlyActivatedSpaceMilestones: string[],
  alreadyRegisteredTimelines: Set<string>,
): RegisteredTimeline[] {
  const mapping = getTriggerMapping();
  const discovered: RegisteredTimeline[] = [];

  for (const milestoneId of newlyActivatedSpaceMilestones) {
    const timelineId = mapping.get(milestoneId);
    if (timelineId && !alreadyRegisteredTimelines.has(timelineId)) {
      const tl = createPerWorldTimeline(timelineId);
      if (tl) {
        discovered.push(tl);
      }
    }
  }

  return discovered;
}

/**
 * Get all per-world timeline IDs that should exist given the current
 * set of activated space milestones.
 * Used for save/load to reconstruct the timeline registry.
 */
export function getExpectedTimelines(activatedSpaceMilestones: Set<string>): string[] {
  const mapping = getTriggerMapping();
  const expected: string[] = [];

  for (const [milestoneId, timelineId] of mapping) {
    if (activatedSpaceMilestones.has(milestoneId)) {
      expected.push(timelineId);
    }
  }

  return expected;
}

/** Get milestone data for a per-world timeline (for tests/inspection). */
export function getPerWorldMilestones(timelineId: string): readonly Milestone[] {
  const def = PER_WORLD_DEFS.find((d) => d.timelineId === timelineId);
  if (!def) return [];
  return (def.data.milestones as unknown as Milestone[]).sort((a, b) => a.order - b.order);
}
