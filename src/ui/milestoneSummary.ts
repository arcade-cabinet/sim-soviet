/**
 * @module ui/milestoneSummary
 *
 * Pure function: converts serialized timeline state into sorted summary entries
 * for display in MilestoneTimelineScreen.
 */

import type { TimelineLayerSaveData } from '../game/timeline/TimelineLayer';

export interface MilestoneSummaryEntry {
  year: number;
  timelineId: string;
  milestoneId: string;
  name: string;
  headline: string;
}

/** Minimal interface for what we need from registered timelines. */
interface TimelineRef {
  id: string;
  milestones: readonly {
    id: string;
    name: string;
    effects?: { narrative?: { pravdaHeadline?: string } };
  }[];
}

/**
 * Build a chronologically sorted list of all activated milestones.
 * Skips milestones that have no recorded activation year.
 */
export function buildMilestoneSummary(
  layers: TimelineLayerSaveData[],
  registeredTimelines: TimelineRef[],
): MilestoneSummaryEntry[] {
  const entries: MilestoneSummaryEntry[] = [];

  for (const layer of layers) {
    const yearMap: Record<string, number> = layer.activatedMilestoneYears ?? {};
    const timeline = registeredTimelines.find((t) => t.id === layer.timelineId);

    for (const milestoneId of layer.activatedMilestones) {
      const year = yearMap[milestoneId];
      if (year === undefined) continue;

      const def = timeline?.milestones.find((m) => m.id === milestoneId);
      entries.push({
        year,
        timelineId: layer.timelineId,
        milestoneId,
        name: def?.name ?? milestoneId,
        headline: def?.effects?.narrative?.pravdaHeadline ?? '',
      });
    }
  }

  return entries.sort((a, b) => a.year - b.year);
}
