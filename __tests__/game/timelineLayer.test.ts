/**
 * Tests for TimelineLayer — the reusable abstraction for parallel timelines.
 */

import {
  evaluateCondition,
  evaluateTimelineLayer,
  evaluateAllTimelines,
  createLayerState,
  serializeLayerState,
  restoreLayerState,
  type Milestone,
  type TimelineContext,
  type TimelineLayerState,
  type RegisteredTimeline,
} from '../../src/game/timeline/TimelineLayer';

// ─── Test Helpers ────────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<TimelineContext> = {}): TimelineContext {
  return {
    year: 1960,
    population: 500,
    techLevel: 0.3,
    worldState: {},
    pressureLevels: {},
    resources: {},
    allActivatedMilestones: new Map(),
    ...overrides,
  };
}

function makeMilestone(overrides: Partial<Milestone> = {}): Milestone {
  return {
    id: 'test_milestone',
    name: 'Test Milestone',
    timelineId: 'test',
    conditions: { year: { min: 1950 } },
    sustainedTicks: 1,
    effects: {
      narrative: { pravdaHeadline: 'TEST', toast: 'Test toast' },
    },
    oneShot: true,
    order: 0,
    ...overrides,
  };
}

// ─── Condition Evaluator ────────────────────────────────────────────────────

describe('evaluateCondition', () => {
  test('year min', () => {
    const ctx = makeCtx({ year: 1960 });
    expect(evaluateCondition({ year: { min: 1957 } }, ctx)).toBe(true);
    expect(evaluateCondition({ year: { min: 1970 } }, ctx)).toBe(false);
  });

  test('year max', () => {
    const ctx = makeCtx({ year: 1960 });
    expect(evaluateCondition({ year: { max: 1970 } }, ctx)).toBe(true);
    expect(evaluateCondition({ year: { max: 1955 } }, ctx)).toBe(false);
  });

  test('year range (min + max)', () => {
    const ctx = makeCtx({ year: 1960 });
    expect(evaluateCondition({ year: { min: 1950, max: 1970 } }, ctx)).toBe(true);
    expect(evaluateCondition({ year: { min: 1965, max: 1970 } }, ctx)).toBe(false);
  });

  test('techLevel', () => {
    const ctx = makeCtx({ techLevel: 0.5 });
    expect(evaluateCondition({ techLevel: { min: 0.3 } }, ctx)).toBe(true);
    expect(evaluateCondition({ techLevel: { min: 0.7 } }, ctx)).toBe(false);
  });

  test('population', () => {
    const ctx = makeCtx({ population: 10000 });
    expect(evaluateCondition({ population: { min: 5000 } }, ctx)).toBe(true);
    expect(evaluateCondition({ population: { min: 50000 } }, ctx)).toBe(false);
  });

  test('worldState', () => {
    const ctx = makeCtx({ worldState: { globalTension: 0.8 } });
    expect(evaluateCondition({ worldState: { key: 'globalTension', min: 0.5 } }, ctx)).toBe(true);
    expect(evaluateCondition({ worldState: { key: 'globalTension', min: 0.9 } }, ctx)).toBe(false);
  });

  test('worldState missing key defaults to 0', () => {
    const ctx = makeCtx({ worldState: {} });
    expect(evaluateCondition({ worldState: { key: 'missing', min: 0.1 } }, ctx)).toBe(false);
    expect(evaluateCondition({ worldState: { key: 'missing', max: 0.5 } }, ctx)).toBe(true);
  });

  test('pressure domain', () => {
    const ctx = makeCtx({ pressureLevels: { food: 0.7 } });
    expect(evaluateCondition({ pressure: { domain: 'food', min: 0.5 } }, ctx)).toBe(true);
    expect(evaluateCondition({ pressure: { domain: 'food', min: 0.9 } }, ctx)).toBe(false);
  });

  test('pressure missing domain defaults to 0', () => {
    const ctx = makeCtx({ pressureLevels: {} });
    expect(evaluateCondition({ pressure: { domain: 'morale', min: 0.1 } }, ctx)).toBe(false);
  });

  test('milestone cross-reference (activated)', () => {
    const activated = new Map([['space', new Set(['sputnik'])]]);
    const ctx = makeCtx({ allActivatedMilestones: activated });
    expect(evaluateCondition({ milestone: { timelineId: 'space', milestoneId: 'sputnik' } }, ctx)).toBe(true);
  });

  test('milestone cross-reference (not activated)', () => {
    const ctx = makeCtx({ allActivatedMilestones: new Map() });
    expect(evaluateCondition({ milestone: { timelineId: 'space', milestoneId: 'sputnik' } }, ctx)).toBe(false);
  });

  test('milestone cross-reference (wrong timeline)', () => {
    const activated = new Map([['world', new Set(['sputnik'])]]);
    const ctx = makeCtx({ allActivatedMilestones: activated });
    expect(evaluateCondition({ milestone: { timelineId: 'space', milestoneId: 'sputnik' } }, ctx)).toBe(false);
  });

  test('resource condition', () => {
    const ctx = makeCtx({ resources: { uranium: 100 } });
    expect(evaluateCondition({ resource: { key: 'uranium', min: 50 } }, ctx)).toBe(true);
    expect(evaluateCondition({ resource: { key: 'uranium', min: 200 } }, ctx)).toBe(false);
  });

  test('and — all must pass', () => {
    const ctx = makeCtx({ year: 1960, techLevel: 0.5 });
    expect(
      evaluateCondition({ and: [{ year: { min: 1957 } }, { techLevel: { min: 0.3 } }] }, ctx),
    ).toBe(true);
    expect(
      evaluateCondition({ and: [{ year: { min: 1957 } }, { techLevel: { min: 0.9 } }] }, ctx),
    ).toBe(false);
  });

  test('or — any must pass', () => {
    const ctx = makeCtx({ year: 1960, techLevel: 0.1 });
    expect(
      evaluateCondition({ or: [{ year: { min: 2000 } }, { techLevel: { min: 0.05 } }] }, ctx),
    ).toBe(true);
    expect(
      evaluateCondition({ or: [{ year: { min: 2000 } }, { techLevel: { min: 0.5 } }] }, ctx),
    ).toBe(false);
  });

  test('not — inverts', () => {
    const ctx = makeCtx({ year: 1960 });
    expect(evaluateCondition({ not: { year: { min: 2000 } } }, ctx)).toBe(true);
    expect(evaluateCondition({ not: { year: { min: 1950 } } }, ctx)).toBe(false);
  });

  test('nested and/or/not', () => {
    const ctx = makeCtx({ year: 1960, techLevel: 0.5, population: 1000 });
    const condition = {
      and: [
        { year: { min: 1957 } },
        { or: [{ techLevel: { min: 0.9 } }, { population: { min: 500 } }] },
        { not: { worldState: { key: 'globalTension', min: 0.95 } } },
      ],
    };
    expect(evaluateCondition(condition, ctx)).toBe(true);
  });
});

// ─── Layer Evaluation ───────────────────────────────────────────────────────

describe('evaluateTimelineLayer', () => {
  test('activates milestone when conditions met', () => {
    const milestone = makeMilestone({ conditions: { year: { min: 1957 } } });
    const state = createLayerState('test');
    const ctx = makeCtx({ year: 1960 });

    const result = evaluateTimelineLayer([milestone], state, ctx);
    expect(result.activated).toHaveLength(1);
    expect(result.activated[0]!.id).toBe('test_milestone');
    expect(result.state.activatedMilestones.has('test_milestone')).toBe(true);
  });

  test('does not activate if conditions not met', () => {
    const milestone = makeMilestone({ conditions: { year: { min: 2000 } } });
    const state = createLayerState('test');
    const ctx = makeCtx({ year: 1960 });

    const result = evaluateTimelineLayer([milestone], state, ctx);
    expect(result.activated).toHaveLength(0);
  });

  test('one-shot milestone does not re-trigger', () => {
    const milestone = makeMilestone({ oneShot: true });
    const state = createLayerState('test');
    state.activatedMilestones.add('test_milestone');
    const ctx = makeCtx({ year: 1960 });

    const result = evaluateTimelineLayer([milestone], state, ctx);
    expect(result.activated).toHaveLength(0);
  });

  test('sustained ticks — requires multiple ticks', () => {
    const milestone = makeMilestone({ sustainedTicks: 3 });
    const state = createLayerState('test');
    const ctx = makeCtx({ year: 1960 });

    // Tick 1: not yet
    const r1 = evaluateTimelineLayer([milestone], state, ctx);
    expect(r1.activated).toHaveLength(0);
    expect(r1.state.trackers.get('test_milestone')?.sustainedTicks).toBe(1);

    // Tick 2: not yet
    const r2 = evaluateTimelineLayer([milestone], r1.state, ctx);
    expect(r2.activated).toHaveLength(0);
    expect(r2.state.trackers.get('test_milestone')?.sustainedTicks).toBe(2);

    // Tick 3: activates!
    const r3 = evaluateTimelineLayer([milestone], r2.state, ctx);
    expect(r3.activated).toHaveLength(1);
    expect(r3.state.trackers.has('test_milestone')).toBe(false); // cleaned up
  });

  test('sustained ticks resets if conditions break', () => {
    const milestone = makeMilestone({
      conditions: { year: { min: 1960 } },
      sustainedTicks: 3,
    });
    const state = createLayerState('test');

    // 2 ticks with conditions met
    const r1 = evaluateTimelineLayer([milestone], state, makeCtx({ year: 1960 }));
    const r2 = evaluateTimelineLayer([milestone], r1.state, makeCtx({ year: 1960 }));
    expect(r2.state.trackers.get('test_milestone')?.sustainedTicks).toBe(2);

    // Conditions break (year too early)
    const r3 = evaluateTimelineLayer([milestone], r2.state, makeCtx({ year: 1950 }));
    expect(r3.state.trackers.has('test_milestone')).toBe(false); // reset

    // Start over
    const r4 = evaluateTimelineLayer([milestone], r3.state, makeCtx({ year: 1960 }));
    expect(r4.state.trackers.get('test_milestone')?.sustainedTicks).toBe(1);
  });

  test('collects effects from activated milestones', () => {
    const milestone = makeMilestone({
      effects: {
        pressureModifiers: { food: 0.3, morale: 0.2 },
        unlocks: ['space_launches'],
        narrative: { pravdaHeadline: 'LAUNCH', toast: 'Rockets go up' },
      },
    });
    const state = createLayerState('test');
    const ctx = makeCtx({ year: 1960 });

    const result = evaluateTimelineLayer([milestone], state, ctx);
    expect(result.effects).toHaveLength(1);
    expect(result.effects[0]!.pressureModifiers).toEqual({ food: 0.3, morale: 0.2 });
  });

  test('unlocked capabilities accumulate', () => {
    const m1 = makeMilestone({
      id: 'a',
      conditions: { year: { min: 1957 } },
      effects: {
        unlocks: ['rockets'],
        narrative: { pravdaHeadline: 'A', toast: 'A' },
      },
    });
    const m2 = makeMilestone({
      id: 'b',
      conditions: { year: { min: 1957 } },
      effects: {
        unlocks: ['satellites', 'telemetry'],
        narrative: { pravdaHeadline: 'B', toast: 'B' },
      },
    });
    const state = createLayerState('test');
    const ctx = makeCtx({ year: 1960 });

    const result = evaluateTimelineLayer([m1, m2], state, ctx);
    expect(result.state.unlockedCapabilities).toEqual(new Set(['rockets', 'satellites', 'telemetry']));
  });

  test('multiple milestones activate in same tick', () => {
    const m1 = makeMilestone({ id: 'a', conditions: { year: { min: 1950 } } });
    const m2 = makeMilestone({ id: 'b', conditions: { year: { min: 1955 } } });
    const m3 = makeMilestone({ id: 'c', conditions: { year: { min: 2000 } } });
    const state = createLayerState('test');
    const ctx = makeCtx({ year: 1960 });

    const result = evaluateTimelineLayer([m1, m2, m3], state, ctx);
    expect(result.activated).toHaveLength(2);
    expect(result.state.activatedMilestones).toEqual(new Set(['a', 'b']));
  });
});

// ─── Cross-Timeline Evaluation ──────────────────────────────────────────────

describe('evaluateAllTimelines', () => {
  test('evaluates multiple timelines independently', () => {
    const spaceMs = makeMilestone({
      id: 'sputnik',
      timelineId: 'space',
      conditions: { year: { min: 1957 } },
    });
    const worldMs = makeMilestone({
      id: 'cold_war',
      timelineId: 'world',
      conditions: { year: { min: 1947 } },
    });

    const timelines: RegisteredTimeline[] = [
      { id: 'space', milestones: [spaceMs], state: createLayerState('space') },
      { id: 'world', milestones: [worldMs], state: createLayerState('world') },
    ];
    const ctx = { year: 1960, population: 500, techLevel: 0.3, worldState: {}, pressureLevels: {}, resources: {} };

    const { allActivated } = evaluateAllTimelines(timelines, ctx);
    expect(allActivated).toHaveLength(2);
    expect(allActivated.map((m) => m.id).sort()).toEqual(['cold_war', 'sputnik']);
  });

  test('cross-reference: milestone requires another timeline milestone (previous tick)', () => {
    // Space milestone requires world milestone to be already activated
    const worldMs = makeMilestone({
      id: 'cold_war',
      timelineId: 'world',
      conditions: { year: { min: 1947 } },
    });
    const spaceMs = makeMilestone({
      id: 'space_race',
      timelineId: 'space',
      conditions: {
        and: [
          { year: { min: 1957 } },
          { milestone: { timelineId: 'world', milestoneId: 'cold_war' } },
        ],
      },
    });

    const spaceState = createLayerState('space');
    const worldState = createLayerState('world');
    const timelines: RegisteredTimeline[] = [
      { id: 'space', milestones: [spaceMs], state: spaceState },
      { id: 'world', milestones: [worldMs], state: worldState },
    ];
    const ctx = { year: 1960, population: 500, techLevel: 0.3, worldState: {}, pressureLevels: {}, resources: {} };

    // Tick 1: world activates, space doesn't (because cold_war wasn't in state yet)
    const r1 = evaluateAllTimelines(timelines, ctx);
    expect(r1.allActivated.map((m) => m.id)).toEqual(['cold_war']);

    // Tick 2: NOW space can see cold_war in the state
    const r2 = evaluateAllTimelines(timelines, ctx);
    expect(r2.allActivated.map((m) => m.id)).toEqual(['space_race']);
  });

  test('same-tick cross-reference does NOT work (by design)', () => {
    // Both milestones require each other — neither should activate
    const msA = makeMilestone({
      id: 'a',
      timelineId: 'alpha',
      conditions: { milestone: { timelineId: 'beta', milestoneId: 'b' } },
    });
    const msB = makeMilestone({
      id: 'b',
      timelineId: 'beta',
      conditions: { milestone: { timelineId: 'alpha', milestoneId: 'a' } },
    });

    const timelines: RegisteredTimeline[] = [
      { id: 'alpha', milestones: [msA], state: createLayerState('alpha') },
      { id: 'beta', milestones: [msB], state: createLayerState('beta') },
    ];
    const ctx = { year: 2000, population: 500, techLevel: 0.5, worldState: {}, pressureLevels: {}, resources: {} };

    const { allActivated } = evaluateAllTimelines(timelines, ctx);
    expect(allActivated).toHaveLength(0);
  });

  test('effects collected from all timelines', () => {
    const ms1 = makeMilestone({
      id: 'a',
      timelineId: 'space',
      effects: {
        pressureModifiers: { food: 0.1 },
        narrative: { pravdaHeadline: 'A', toast: 'A' },
      },
    });
    const ms2 = makeMilestone({
      id: 'b',
      timelineId: 'world',
      effects: {
        pressureModifiers: { morale: 0.3 },
        narrative: { pravdaHeadline: 'B', toast: 'B' },
      },
    });

    const timelines: RegisteredTimeline[] = [
      { id: 'space', milestones: [ms1], state: createLayerState('space') },
      { id: 'world', milestones: [ms2], state: createLayerState('world') },
    ];
    const ctx = { year: 1960, population: 500, techLevel: 0.3, worldState: {}, pressureLevels: {}, resources: {} };

    const { allEffects } = evaluateAllTimelines(timelines, ctx);
    expect(allEffects).toHaveLength(2);
  });
});

// ─── Serialization ──────────────────────────────────────────────────────────

describe('serialization', () => {
  test('round-trip preserves state', () => {
    const state: TimelineLayerState = {
      timelineId: 'space',
      activatedMilestones: new Set(['sputnik', 'gagarin']),
      trackers: new Map([['vostok', { sustainedTicks: 3 }]]),
      unlockedCapabilities: new Set(['rockets', 'orbital']),
      activatedMilestoneYears: new Map([['sputnik', 1957], ['gagarin', 1961]]),
    };

    const serialized = serializeLayerState(state);
    const restored = restoreLayerState(serialized);

    expect(restored.timelineId).toBe('space');
    expect(restored.activatedMilestones).toEqual(new Set(['sputnik', 'gagarin']));
    expect(restored.trackers).toEqual(new Map([['vostok', { sustainedTicks: 3 }]]));
    expect(restored.unlockedCapabilities).toEqual(new Set(['rockets', 'orbital']));
    expect(restored.activatedMilestoneYears).toEqual(new Map([['sputnik', 1957], ['gagarin', 1961]]));
  });

  test('serialized form is JSON-safe', () => {
    const state = createLayerState('test');
    state.activatedMilestones.add('a');
    state.trackers.set('b', { sustainedTicks: 5 });
    state.unlockedCapabilities.add('c');

    const serialized = serializeLayerState(state);
    const json = JSON.stringify(serialized);
    const parsed = JSON.parse(json);
    const restored = restoreLayerState(parsed);

    expect(restored.activatedMilestones.has('a')).toBe(true);
    expect(restored.trackers.get('b')?.sustainedTicks).toBe(5);
    expect(restored.unlockedCapabilities.has('c')).toBe(true);
  });

  test('empty state serializes cleanly', () => {
    const state = createLayerState('empty');
    const serialized = serializeLayerState(state);

    expect(serialized.timelineId).toBe('empty');
    expect(serialized.activatedMilestones).toEqual([]);
    expect(serialized.trackers).toEqual([]);
    expect(serialized.unlockedCapabilities).toEqual([]);
  });
});
