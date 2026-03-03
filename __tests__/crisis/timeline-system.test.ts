/**
 * @fileoverview Tests for TimelineSystem — in-memory timeline manager.
 *
 * Validates event recording, querying with filters, causal chain traversal,
 * divergence point tracking, serialization round-trip, and clear/reset.
 */

import {
  TimelineSystem,
} from '@/ai/agents/crisis/TimelineSystem';
import type {
  TimelineEvent,
  DivergencePoint,
  TimelineFilter,
} from '@/ai/agents/crisis/TimelineSystem';

// ─── Fixtures ───────────────────────────────────────────────────────────────

const WW2_EVENT: TimelineEvent = {
  eventId: 'ww2',
  crisisType: 'war',
  name: 'Great Patriotic War',
  startYear: 1941,
  endYear: 1945,
  isHistorical: true,
  parameters: { conscriptionRate: 0.15 },
  recordedTick: 100,
};

const HOLODOMOR_EVENT: TimelineEvent = {
  eventId: 'holodomor',
  crisisType: 'famine',
  name: 'Holodomor',
  startYear: 1932,
  endYear: 1933,
  isHistorical: true,
  parameters: { foodReduction: 0.8 },
  recordedTick: 50,
};

const CHERNOBYL_EVENT: TimelineEvent = {
  eventId: 'chernobyl',
  crisisType: 'disaster',
  name: 'Chernobyl Disaster',
  startYear: 1986,
  endYear: 1987,
  isHistorical: true,
  recordedTick: 300,
};

const GREAT_PURGE_EVENT: TimelineEvent = {
  eventId: 'great-purge',
  crisisType: 'political',
  name: 'Great Purge',
  startYear: 1936,
  endYear: 1938,
  isHistorical: true,
  recordedTick: 75,
};

const ALT_WAR_EVENT: TimelineEvent = {
  eventId: 'alt-war-1',
  crisisType: 'war',
  name: 'Alternate Border Conflict',
  startYear: 1950,
  endYear: 1953,
  isHistorical: false,
  parentEventId: 'ww2',
  divergenceDecision: 'Refused armistice',
  recordedTick: 200,
};

const ALT_FAMINE_EVENT: TimelineEvent = {
  eventId: 'alt-famine-1',
  crisisType: 'famine',
  name: 'Post-War Crop Failure',
  startYear: 1954,
  endYear: 1955,
  isHistorical: false,
  parentEventId: 'alt-war-1',
  recordedTick: 250,
};

const SAMPLE_DIVERGENCE: DivergencePoint = {
  year: 1948,
  month: 6,
  historicalContext: 'Berlin Blockade begins',
  playerChoice: 'Negotiated early settlement',
  stateSnapshot: { population: 5000, food: 300 },
  divergenceTick: 180,
};

const SECOND_DIVERGENCE: DivergencePoint = {
  year: 1962,
  month: 10,
  historicalContext: 'Cuban Missile Crisis',
  playerChoice: 'Backed down immediately',
  divergenceTick: 400,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function seedTimeline(ts: TimelineSystem): void {
  ts.recordEvent(WW2_EVENT);
  ts.recordEvent(HOLODOMOR_EVENT);
  ts.recordEvent(CHERNOBYL_EVENT);
  ts.recordEvent(GREAT_PURGE_EVENT);
  ts.recordEvent(ALT_WAR_EVENT);
  ts.recordEvent(ALT_FAMINE_EVENT);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('TimelineSystem', () => {
  let ts: TimelineSystem;

  beforeEach(() => {
    ts = new TimelineSystem();
  });

  // ─── Record & retrieve ──────────────────────────────────────────────────

  describe('recordEvent / getAllEvents', () => {
    it('starts with no events', () => {
      expect(ts.getAllEvents()).toEqual([]);
    });

    it('records and retrieves a single event', () => {
      ts.recordEvent(WW2_EVENT);
      const all = ts.getAllEvents();
      expect(all).toHaveLength(1);
      expect(all[0]).toEqual(WW2_EVENT);
    });

    it('records multiple events in order', () => {
      seedTimeline(ts);
      const all = ts.getAllEvents();
      expect(all).toHaveLength(6);
      expect(all[0]!.eventId).toBe('ww2');
      expect(all[5]!.eventId).toBe('alt-famine-1');
    });

    it('returns a copy — mutating the result does not affect internal state', () => {
      ts.recordEvent(WW2_EVENT);
      const all = ts.getAllEvents();
      all.pop();
      expect(ts.getAllEvents()).toHaveLength(1);
    });
  });

  // ─── Filter: crisisType ─────────────────────────────────────────────────

  describe('queryEvents — crisisType filter', () => {
    beforeEach(() => seedTimeline(ts));

    it('filters by war', () => {
      const wars = ts.queryEvents({ crisisType: 'war' });
      expect(wars).toHaveLength(2);
      expect(wars.map((e) => e.eventId)).toEqual(['ww2', 'alt-war-1']);
    });

    it('filters by famine', () => {
      const famines = ts.queryEvents({ crisisType: 'famine' });
      expect(famines).toHaveLength(2);
      expect(famines.map((e) => e.eventId)).toEqual(['holodomor', 'alt-famine-1']);
    });

    it('filters by disaster', () => {
      const disasters = ts.queryEvents({ crisisType: 'disaster' });
      expect(disasters).toHaveLength(1);
      expect(disasters[0]!.eventId).toBe('chernobyl');
    });

    it('filters by political', () => {
      const political = ts.queryEvents({ crisisType: 'political' });
      expect(political).toHaveLength(1);
      expect(political[0]!.eventId).toBe('great-purge');
    });
  });

  // ─── Filter: yearRange ──────────────────────────────────────────────────

  describe('queryEvents — yearRange filter', () => {
    beforeEach(() => seedTimeline(ts));

    it('finds events overlapping a year range', () => {
      const events = ts.queryEvents({ yearRange: { start: 1940, end: 1950 } });
      const ids = events.map((e) => e.eventId);
      expect(ids).toContain('ww2'); // 1941-1945 overlaps
      expect(ids).toContain('alt-war-1'); // 1950-1953 overlaps at 1950
      expect(ids).not.toContain('holodomor'); // 1932-1933 too early
    });

    it('returns events that start within the range', () => {
      const events = ts.queryEvents({ yearRange: { start: 1985, end: 1990 } });
      expect(events.map((e) => e.eventId)).toContain('chernobyl');
    });

    it('returns events that end within the range', () => {
      const events = ts.queryEvents({ yearRange: { start: 1930, end: 1932 } });
      expect(events.map((e) => e.eventId)).toContain('holodomor');
    });

    it('returns events that fully contain the range', () => {
      const events = ts.queryEvents({ yearRange: { start: 1942, end: 1943 } });
      expect(events.map((e) => e.eventId)).toContain('ww2');
    });

    it('excludes events outside the range', () => {
      const events = ts.queryEvents({ yearRange: { start: 1960, end: 1970 } });
      expect(events).toHaveLength(0);
    });
  });

  // ─── Filter: isHistorical ──────────────────────────────────────────────

  describe('queryEvents — isHistorical filter', () => {
    beforeEach(() => seedTimeline(ts));

    it('filters for historical events only', () => {
      const hist = ts.queryEvents({ isHistorical: true });
      expect(hist).toHaveLength(4);
      expect(hist.every((e) => e.isHistorical)).toBe(true);
    });

    it('filters for non-historical events only', () => {
      const nonHist = ts.queryEvents({ isHistorical: false });
      expect(nonHist).toHaveLength(2);
      expect(nonHist.every((e) => !e.isHistorical)).toBe(true);
    });
  });

  // ─── Filter: parentEventId ─────────────────────────────────────────────

  describe('queryEvents — parentEventId filter', () => {
    beforeEach(() => seedTimeline(ts));

    it('finds events with a specific parent', () => {
      const children = ts.queryEvents({ parentEventId: 'ww2' });
      expect(children).toHaveLength(1);
      expect(children[0]!.eventId).toBe('alt-war-1');
    });

    it('returns empty for non-existent parent', () => {
      expect(ts.queryEvents({ parentEventId: 'nonexistent' })).toHaveLength(0);
    });
  });

  // ─── Combined filters (AND logic) ──────────────────────────────────────

  describe('queryEvents — combined filters (AND)', () => {
    beforeEach(() => seedTimeline(ts));

    it('crisisType + isHistorical', () => {
      const histWars = ts.queryEvents({ crisisType: 'war', isHistorical: true });
      expect(histWars).toHaveLength(1);
      expect(histWars[0]!.eventId).toBe('ww2');
    });

    it('crisisType + yearRange', () => {
      const events = ts.queryEvents({
        crisisType: 'famine',
        yearRange: { start: 1950, end: 1960 },
      });
      expect(events).toHaveLength(1);
      expect(events[0]!.eventId).toBe('alt-famine-1');
    });

    it('isHistorical + yearRange', () => {
      const events = ts.queryEvents({
        isHistorical: false,
        yearRange: { start: 1950, end: 1960 },
      });
      expect(events).toHaveLength(2);
      const ids = events.map((e) => e.eventId);
      expect(ids).toContain('alt-war-1');
      expect(ids).toContain('alt-famine-1');
    });

    it('all four filters combined', () => {
      const events = ts.queryEvents({
        crisisType: 'war',
        yearRange: { start: 1940, end: 1960 },
        isHistorical: false,
        parentEventId: 'ww2',
      });
      expect(events).toHaveLength(1);
      expect(events[0]!.eventId).toBe('alt-war-1');
    });

    it('combined filters that match nothing', () => {
      const events = ts.queryEvents({
        crisisType: 'disaster',
        isHistorical: false,
      });
      expect(events).toHaveLength(0);
    });
  });

  // ─── Empty filter ─────────────────────────────────────────────────────

  describe('queryEvents — empty filter', () => {
    it('returns all events when filter is empty', () => {
      seedTimeline(ts);
      expect(ts.queryEvents({})).toHaveLength(6);
    });
  });

  // ─── Causal chain ─────────────────────────────────────────────────────

  describe('getCausalChain', () => {
    beforeEach(() => seedTimeline(ts));

    it('returns single event when no parent', () => {
      const chain = ts.getCausalChain('ww2');
      expect(chain).toHaveLength(1);
      expect(chain[0]!.eventId).toBe('ww2');
    });

    it('follows parent links to build chain (root → leaf)', () => {
      const chain = ts.getCausalChain('alt-famine-1');
      expect(chain).toHaveLength(3);
      expect(chain[0]!.eventId).toBe('ww2');
      expect(chain[1]!.eventId).toBe('alt-war-1');
      expect(chain[2]!.eventId).toBe('alt-famine-1');
    });

    it('follows single parent link', () => {
      const chain = ts.getCausalChain('alt-war-1');
      expect(chain).toHaveLength(2);
      expect(chain[0]!.eventId).toBe('ww2');
      expect(chain[1]!.eventId).toBe('alt-war-1');
    });

    it('returns empty array for non-existent eventId', () => {
      expect(ts.getCausalChain('nonexistent')).toEqual([]);
    });
  });

  // ─── Divergent history ────────────────────────────────────────────────

  describe('getDivergentHistory', () => {
    it('returns empty when no events', () => {
      expect(ts.getDivergentHistory()).toEqual([]);
    });

    it('returns only non-historical events', () => {
      seedTimeline(ts);
      const divergent = ts.getDivergentHistory();
      expect(divergent).toHaveLength(2);
      expect(divergent.every((e) => !e.isHistorical)).toBe(true);
      expect(divergent.map((e) => e.eventId)).toEqual(['alt-war-1', 'alt-famine-1']);
    });

    it('returns empty when all events are historical', () => {
      ts.recordEvent(WW2_EVENT);
      ts.recordEvent(HOLODOMOR_EVENT);
      expect(ts.getDivergentHistory()).toHaveLength(0);
    });
  });

  // ─── Divergence points ────────────────────────────────────────────────

  describe('recordDivergence / getDivergencePoints', () => {
    it('starts with no divergence points', () => {
      expect(ts.getDivergencePoints()).toEqual([]);
    });

    it('records and retrieves a divergence point', () => {
      ts.recordDivergence(SAMPLE_DIVERGENCE);
      const points = ts.getDivergencePoints();
      expect(points).toHaveLength(1);
      expect(points[0]).toEqual(SAMPLE_DIVERGENCE);
    });

    it('records multiple divergence points in order', () => {
      ts.recordDivergence(SAMPLE_DIVERGENCE);
      ts.recordDivergence(SECOND_DIVERGENCE);
      const points = ts.getDivergencePoints();
      expect(points).toHaveLength(2);
      expect(points[0]!.year).toBe(1948);
      expect(points[1]!.year).toBe(1962);
    });

    it('returns a copy — mutating the result does not affect internal state', () => {
      ts.recordDivergence(SAMPLE_DIVERGENCE);
      const points = ts.getDivergencePoints();
      points.pop();
      expect(ts.getDivergencePoints()).toHaveLength(1);
    });
  });

  // ─── Serialization round-trip ─────────────────────────────────────────

  describe('serialize / restore', () => {
    it('round-trips events and divergence points', () => {
      seedTimeline(ts);
      ts.recordDivergence(SAMPLE_DIVERGENCE);
      ts.recordDivergence(SECOND_DIVERGENCE);

      const saved = ts.serialize();
      const restored = new TimelineSystem();
      restored.restore(saved);

      expect(restored.getAllEvents()).toEqual(ts.getAllEvents());
      expect(restored.getDivergencePoints()).toEqual(ts.getDivergencePoints());
    });

    it('serialize returns copies — mutations do not affect timeline', () => {
      ts.recordEvent(WW2_EVENT);
      const saved = ts.serialize();
      saved.events.pop();
      expect(ts.getAllEvents()).toHaveLength(1);
    });

    it('restore replaces existing data', () => {
      ts.recordEvent(WW2_EVENT);
      ts.recordDivergence(SAMPLE_DIVERGENCE);

      const newTs = new TimelineSystem();
      newTs.recordEvent(CHERNOBYL_EVENT);

      const saved = newTs.serialize();
      ts.restore(saved);

      expect(ts.getAllEvents()).toHaveLength(1);
      expect(ts.getAllEvents()[0]!.eventId).toBe('chernobyl');
      expect(ts.getDivergencePoints()).toHaveLength(0);
    });

    it('restore creates copies — mutations to saved data do not affect timeline', () => {
      const data = {
        events: [WW2_EVENT],
        divergencePoints: [SAMPLE_DIVERGENCE],
      };
      ts.restore(data);
      data.events.pop();
      data.divergencePoints.pop();
      expect(ts.getAllEvents()).toHaveLength(1);
      expect(ts.getDivergencePoints()).toHaveLength(1);
    });
  });

  // ─── Clear ────────────────────────────────────────────────────────────

  describe('clear', () => {
    it('removes all events and divergence points', () => {
      seedTimeline(ts);
      ts.recordDivergence(SAMPLE_DIVERGENCE);

      ts.clear();

      expect(ts.getAllEvents()).toEqual([]);
      expect(ts.getDivergencePoints()).toEqual([]);
      expect(ts.getDivergentHistory()).toEqual([]);
    });

    it('allows recording new data after clear', () => {
      ts.recordEvent(WW2_EVENT);
      ts.clear();
      ts.recordEvent(CHERNOBYL_EVENT);

      expect(ts.getAllEvents()).toHaveLength(1);
      expect(ts.getAllEvents()[0]!.eventId).toBe('chernobyl');
    });
  });
});
