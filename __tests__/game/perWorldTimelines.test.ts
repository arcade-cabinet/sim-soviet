/**
 * Tests for the per-world timeline registry — dynamic timeline discovery
 * when space milestones colonize new worlds.
 */

import {
  getTriggerMapping,
  createPerWorldTimeline,
  discoverNewTimelines,
  getExpectedTimelines,
  getPerWorldMilestones,
  ALL_PER_WORLD_DEFS,
  PER_WORLD_TIMELINE_COUNT,
} from '../../src/game/timeline/perWorldTimelines';

// ─── Constants ──────────────────────────────────────────────────────────────

const EXPECTED_TIMELINES = [
  { triggerId: 'permanent_lunar_base', timelineId: 'lunar' },
  { triggerId: 'mars_colony', timelineId: 'mars' },
  { triggerId: 'venus_cloud_colony', timelineId: 'venus' },
  { triggerId: 'ganymede_colony', timelineId: 'jupiter' },
  { triggerId: 'ceres_mining_station', timelineId: 'belt' },
  { triggerId: 'titan_colony', timelineId: 'titan' },
  { triggerId: 'generation_ship', timelineId: 'generation_ship' },
  { triggerId: 'exoplanet_colony', timelineId: 'exoplanet' },
];

// ─── Registry Metadata ─────────────────────────────────────────────────────

describe('Per-world timeline registry', () => {
  test('has exactly 8 per-world definitions', () => {
    expect(PER_WORLD_TIMELINE_COUNT).toBe(8);
    expect(ALL_PER_WORLD_DEFS).toHaveLength(8);
  });
});

// ─── getTriggerMapping ──────────────────────────────────────────────────────

describe('getTriggerMapping', () => {
  test('returns a Map with all 8 trigger entries', () => {
    const mapping = getTriggerMapping();
    expect(mapping.size).toBe(8);
  });

  test.each(EXPECTED_TIMELINES)(
    'maps $triggerId → $timelineId',
    ({ triggerId, timelineId }) => {
      const mapping = getTriggerMapping();
      expect(mapping.get(triggerId)).toBe(timelineId);
    },
  );
});

// ─── createPerWorldTimeline ─────────────────────────────────────────────────

describe('createPerWorldTimeline', () => {
  test.each(EXPECTED_TIMELINES)(
    'creates valid RegisteredTimeline for $timelineId',
    ({ timelineId }) => {
      const tl = createPerWorldTimeline(timelineId);
      expect(tl).toBeDefined();
      expect(tl!.id).toBe(timelineId);
      expect(tl!.milestones.length).toBeGreaterThan(0);
      expect(tl!.state.timelineId).toBe(timelineId);
      expect(tl!.state.activatedMilestones.size).toBe(0);
      expect(tl!.state.trackers.size).toBe(0);
      expect(tl!.state.unlockedCapabilities.size).toBe(0);
    },
  );

  test('returns undefined for unknown timeline ID', () => {
    expect(createPerWorldTimeline('nonexistent')).toBeUndefined();
    expect(createPerWorldTimeline('')).toBeUndefined();
  });
});

// ─── discoverNewTimelines ───────────────────────────────────────────────────

describe('discoverNewTimelines', () => {
  test('discovers correct timeline when a single space milestone activates', () => {
    const discovered = discoverNewTimelines(
      ['permanent_lunar_base'],
      new Set(),
    );
    expect(discovered).toHaveLength(1);
    expect(discovered[0]!.id).toBe('lunar');
  });

  test('discovers multiple timelines from multiple space milestones', () => {
    const discovered = discoverNewTimelines(
      ['permanent_lunar_base', 'mars_colony', 'titan_colony'],
      new Set(),
    );
    expect(discovered).toHaveLength(3);
    const ids = discovered.map((t) => t.id).sort();
    expect(ids).toEqual(['lunar', 'mars', 'titan']);
  });

  test('skips already-registered timelines', () => {
    const alreadyRegistered = new Set(['lunar', 'mars']);
    const discovered = discoverNewTimelines(
      ['permanent_lunar_base', 'mars_colony', 'venus_cloud_colony'],
      alreadyRegistered,
    );
    expect(discovered).toHaveLength(1);
    expect(discovered[0]!.id).toBe('venus');
  });

  test('returns empty array when all triggered timelines are already registered', () => {
    const alreadyRegistered = new Set(['lunar']);
    const discovered = discoverNewTimelines(
      ['permanent_lunar_base'],
      alreadyRegistered,
    );
    expect(discovered).toHaveLength(0);
  });

  test('returns empty array when no space milestones match', () => {
    const discovered = discoverNewTimelines(
      ['sputnik_launch', 'vostok_1'],
      new Set(),
    );
    expect(discovered).toHaveLength(0);
  });

  test('returns empty array when given empty milestone list', () => {
    const discovered = discoverNewTimelines([], new Set());
    expect(discovered).toHaveLength(0);
  });

  test('discovers all 8 timelines when all triggers fire at once', () => {
    const allTriggers = EXPECTED_TIMELINES.map((t) => t.triggerId);
    const discovered = discoverNewTimelines(allTriggers, new Set());
    expect(discovered).toHaveLength(8);
    const ids = new Set(discovered.map((t) => t.id));
    for (const { timelineId } of EXPECTED_TIMELINES) {
      expect(ids.has(timelineId)).toBe(true);
    }
  });
});

// ─── getExpectedTimelines ───────────────────────────────────────────────────

describe('getExpectedTimelines', () => {
  test('returns correct timelines for activated space milestones', () => {
    const activated = new Set(['permanent_lunar_base', 'mars_colony']);
    const expected = getExpectedTimelines(activated);
    expect(expected.sort()).toEqual(['lunar', 'mars']);
  });

  test('returns empty array when no matching milestones', () => {
    const activated = new Set(['sputnik_launch', 'vostok_1']);
    const expected = getExpectedTimelines(activated);
    expect(expected).toHaveLength(0);
  });

  test('returns all 8 when all triggers are activated', () => {
    const activated = new Set(EXPECTED_TIMELINES.map((t) => t.triggerId));
    const expected = getExpectedTimelines(activated);
    expect(expected.sort()).toEqual(
      EXPECTED_TIMELINES.map((t) => t.timelineId).sort(),
    );
  });

  test('returns empty array for empty input set', () => {
    const expected = getExpectedTimelines(new Set());
    expect(expected).toHaveLength(0);
  });
});

// ─── Per-world milestone data integrity ─────────────────────────────────────

describe('Per-world milestone data integrity', () => {
  test.each(EXPECTED_TIMELINES)(
    '$timelineId milestones are sorted by order',
    ({ timelineId }) => {
      const milestones = getPerWorldMilestones(timelineId);
      expect(milestones.length).toBeGreaterThan(0);
      for (let i = 1; i < milestones.length; i++) {
        expect(milestones[i]!.order).toBeGreaterThanOrEqual(
          milestones[i - 1]!.order,
        );
      }
    },
  );

  test.each(EXPECTED_TIMELINES)(
    '$timelineId milestone IDs are unique within timeline',
    ({ timelineId }) => {
      const milestones = getPerWorldMilestones(timelineId);
      const ids = milestones.map((m) => m.id);
      expect(new Set(ids).size).toBe(ids.length);
    },
  );

  test.each(EXPECTED_TIMELINES)(
    '$timelineId milestones all reference correct timelineId',
    ({ timelineId }) => {
      const milestones = getPerWorldMilestones(timelineId);
      for (const m of milestones) {
        expect(m.timelineId).toBe(timelineId);
      }
    },
  );

  test.each(EXPECTED_TIMELINES)(
    '$timelineId milestones all have required fields',
    ({ timelineId }) => {
      const milestones = getPerWorldMilestones(timelineId);
      for (const m of milestones) {
        expect(m.id).toBeTruthy();
        expect(m.name).toBeTruthy();
        expect(m.conditions).toBeDefined();
        expect(m.effects).toBeDefined();
        expect(m.effects.narrative).toBeDefined();
        expect(m.effects.narrative.pravdaHeadline).toBeTruthy();
        expect(m.effects.narrative.toast).toBeTruthy();
        expect(typeof m.oneShot).toBe('boolean');
        expect(typeof m.order).toBe('number');
        expect(typeof m.sustainedTicks).toBe('number');
      }
    },
  );

  test.each(EXPECTED_TIMELINES)(
    '$timelineId milestones are all one-shot',
    ({ timelineId }) => {
      const milestones = getPerWorldMilestones(timelineId);
      for (const m of milestones) {
        expect(m.oneShot).toBe(true);
      }
    },
  );

  test('getPerWorldMilestones returns empty for unknown timeline', () => {
    expect(getPerWorldMilestones('nonexistent')).toHaveLength(0);
  });
});

// ─── Milestone counts per world ─────────────────────────────────────────────

describe('Milestone counts', () => {
  const expectedCounts: Record<string, number> = {
    lunar: 12,
    mars: 15,
    venus: 10,
    jupiter: 12,
    belt: 10,
    titan: 10,
    generation_ship: 12,
    exoplanet: 10,
  };

  test.each(Object.entries(expectedCounts))(
    '%s has %i milestones',
    (timelineId, count) => {
      const milestones = getPerWorldMilestones(timelineId);
      expect(milestones).toHaveLength(count);
    },
  );

  test('total milestones across all worlds is 91', () => {
    const total = EXPECTED_TIMELINES.reduce(
      (sum, { timelineId }) => sum + getPerWorldMilestones(timelineId).length,
      0,
    );
    expect(total).toBe(91);
  });
});
