import { buildMilestoneSummary } from '../../src/ui/milestoneSummary';
import type { TimelineLayerSaveData } from '../../src/game/timeline/TimelineLayer';

describe('buildMilestoneSummary', () => {
  const mockLayers: TimelineLayerSaveData[] = [
    {
      timelineId: 'world',
      activatedMilestones: ['cold_war_start', 'oil_shock'],
      activatedMilestoneYears: { cold_war_start: 1947, oil_shock: 1973 },
      trackers: [],
      unlockedCapabilities: [],
    },
    {
      timelineId: 'space',
      activatedMilestones: ['sputnik'],
      activatedMilestoneYears: { sputnik: 1957 },
      trackers: [],
      unlockedCapabilities: [],
    },
  ];

  const mockTimelines = [
    {
      id: 'world',
      milestones: [
        {
          id: 'cold_war_start',
          name: 'Cold War Begins',
          timelineId: 'world',
          order: 10,
          conditions: { and: [] },
          sustainedTicks: 1,
          effects: { narrative: { pravdaHeadline: 'COLD WAR BEGINS', toast: '' } },
          oneShot: true,
        },
        {
          id: 'oil_shock',
          name: 'Oil Shock',
          timelineId: 'world',
          order: 20,
          conditions: { and: [] },
          sustainedTicks: 1,
          effects: { narrative: { pravdaHeadline: 'OIL CRISIS', toast: '' } },
          oneShot: true,
        },
      ],
    },
    {
      id: 'space',
      milestones: [
        {
          id: 'sputnik',
          name: 'Sputnik Launch',
          timelineId: 'space',
          order: 10,
          conditions: { and: [] },
          sustainedTicks: 1,
          effects: { narrative: { pravdaHeadline: 'SPUTNIK ORBITS EARTH', toast: '' } },
          oneShot: true,
        },
      ],
    },
  ];

  it('returns entries sorted by year', () => {
    const entries = buildMilestoneSummary(mockLayers, mockTimelines as any);
    const years = entries.map((e) => e.year);
    expect(years).toEqual([1947, 1957, 1973]);
  });

  it('includes timelineId, milestoneId, name, and headline', () => {
    const entries = buildMilestoneSummary(mockLayers, mockTimelines as any);
    const sputnik = entries.find((e) => e.milestoneId === 'sputnik');
    expect(sputnik).toEqual({
      year: 1957,
      timelineId: 'space',
      milestoneId: 'sputnik',
      name: 'Sputnik Launch',
      headline: 'SPUTNIK ORBITS EARTH',
    });
  });

  it('skips milestones with no activation year recorded', () => {
    const layers: TimelineLayerSaveData[] = [{
      timelineId: 'world',
      activatedMilestones: ['orphan'],
      activatedMilestoneYears: {},
      trackers: [],
      unlockedCapabilities: [],
    }];
    const entries = buildMilestoneSummary(layers, mockTimelines as any);
    expect(entries.find((e) => e.milestoneId === 'orphan')).toBeUndefined();
  });
});
