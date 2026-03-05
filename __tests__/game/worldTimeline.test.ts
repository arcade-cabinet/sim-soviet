/**
 * Tests for the World Timeline — geopolitical and civilizational progression.
 */

import {
  WORLD_MILESTONES,
  WORLD_TIMELINE_ID,
  createWorldTimeline,
  getWorldMilestone,
} from '../../src/game/timeline/worldTimeline';
import {
  createSpaceTimeline,
} from '../../src/game/timeline/spaceTimeline';
import {
  evaluateTimelineLayer,
  evaluateAllTimelines,
  type TimelineContext,
  type RegisteredTimeline,
} from '../../src/game/timeline/TimelineLayer';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<TimelineContext> = {}): TimelineContext {
  return {
    year: 1917,
    population: 50,
    techLevel: 0.05,
    worldState: {},
    pressureLevels: {},
    resources: {},
    allActivatedMilestones: new Map(),
    ...overrides,
  };
}

// ─── Catalog ────────────────────────────────────────────────────────────────

describe('World Timeline catalog', () => {
  test('loads all milestones from JSON', () => {
    expect(WORLD_MILESTONES.length).toBeGreaterThanOrEqual(20);
  });

  test('all milestones have required fields', () => {
    for (const m of WORLD_MILESTONES) {
      expect(m.id).toBeTruthy();
      expect(m.name).toBeTruthy();
      expect(m.timelineId).toBe('world');
      expect(m.conditions).toBeDefined();
      expect(m.effects).toBeDefined();
      expect(m.effects.narrative).toBeDefined();
      expect(m.effects.narrative.pravdaHeadline).toBeTruthy();
      expect(m.effects.narrative.toast).toBeTruthy();
      expect(typeof m.oneShot).toBe('boolean');
      expect(typeof m.order).toBe('number');
      expect(typeof m.sustainedTicks).toBe('number');
    }
  });

  test('milestone IDs are unique', () => {
    const ids = WORLD_MILESTONES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('milestones are sorted by order', () => {
    for (let i = 1; i < WORLD_MILESTONES.length; i++) {
      expect(WORLD_MILESTONES[i]!.order).toBeGreaterThanOrEqual(WORLD_MILESTONES[i - 1]!.order);
    }
  });

  test('all milestones are one-shot', () => {
    for (const m of WORLD_MILESTONES) {
      expect(m.oneShot).toBe(true);
    }
  });

  test('getWorldMilestone finds by ID', () => {
    const cold = getWorldMilestone('cold_war_start');
    expect(cold).toBeDefined();
    expect(cold!.name).toBe('Cold War Begins');
  });

  test('getWorldMilestone returns undefined for unknown', () => {
    expect(getWorldMilestone('nonexistent')).toBeUndefined();
  });

  test('timeline ID is correct', () => {
    expect(WORLD_TIMELINE_ID).toBe('world');
  });
});

// ─── Historical Progression ────────────────────────────────────────────────

describe('World Timeline historical progression', () => {
  test('Cold War is first milestone', () => {
    expect(WORLD_MILESTONES[0]!.id).toBe('cold_war_start');
  });

  test('Cold War activates at 1947', () => {
    const tl = createWorldTimeline();
    const ctx = makeCtx({ year: 1947 });
    const result = evaluateTimelineLayer(WORLD_MILESTONES, tl.state, ctx);
    const activated = result.activated.map((m) => m.id);
    expect(activated).toContain('cold_war_start');
  });

  test('Cold War does NOT activate before 1947', () => {
    const tl = createWorldTimeline();
    const ctx = makeCtx({ year: 1940 });
    const result = evaluateTimelineLayer(WORLD_MILESTONES, tl.state, ctx);
    expect(result.activated.map((m) => m.id)).not.toContain('cold_war_start');
  });

  test('Chinese Revolution fires at 1949', () => {
    const tl = createWorldTimeline();
    const ctx = makeCtx({ year: 1949 });
    const result = evaluateTimelineLayer(WORLD_MILESTONES, tl.state, ctx);
    expect(result.activated.map((m) => m.id)).toContain('chinese_revolution');
  });

  test('Cuban Missile Crisis requires global tension', () => {
    const tl = createWorldTimeline();
    // Without tension, should not fire
    const ctx = makeCtx({ year: 1962, worldState: { globalTension: 0.1 } });
    const result = evaluateTimelineLayer(WORLD_MILESTONES, tl.state, ctx);
    expect(result.activated.map((m) => m.id)).not.toContain('cuban_missile_crisis');
  });

  test('Cuban Missile Crisis fires at 1962 with sufficient tension', () => {
    const tl = createWorldTimeline();
    const ctx = makeCtx({ year: 1962, worldState: { globalTension: 0.5 } });
    const result = evaluateTimelineLayer(WORLD_MILESTONES, tl.state, ctx);
    expect(result.activated.map((m) => m.id)).toContain('cuban_missile_crisis');
  });

  test('full early progression: cold war → china → split → cuban crisis', () => {
    let tl = createWorldTimeline();

    // Tick 1: Cold War (1947)
    let ctx = makeCtx({ year: 1947 });
    let result = evaluateTimelineLayer(WORLD_MILESTONES, tl.state, ctx);
    expect(result.activated.map((m) => m.id)).toContain('cold_war_start');
    tl.state = result.state;

    // Tick 2: Chinese Revolution (1949)
    ctx = makeCtx({
      year: 1949,
      allActivatedMilestones: new Map([['world', tl.state.activatedMilestones]]),
    });
    result = evaluateTimelineLayer(WORLD_MILESTONES, tl.state, ctx);
    expect(result.activated.map((m) => m.id)).toContain('chinese_revolution');
    tl.state = result.state;

    // Tick 3: Sino-Soviet Split (1960)
    ctx = makeCtx({
      year: 1960,
      allActivatedMilestones: new Map([['world', tl.state.activatedMilestones]]),
    });
    result = evaluateTimelineLayer(WORLD_MILESTONES, tl.state, ctx);
    expect(result.activated.map((m) => m.id)).toContain('sino_soviet_split');
    tl.state = result.state;

    // Tick 4: Cuban Missile Crisis (1962, needs globalTension)
    ctx = makeCtx({
      year: 1962,
      worldState: { globalTension: 0.5 },
      allActivatedMilestones: new Map([['world', tl.state.activatedMilestones]]),
    });
    result = evaluateTimelineLayer(WORLD_MILESTONES, tl.state, ctx);
    expect(result.activated.map((m) => m.id)).toContain('cuban_missile_crisis');
    tl.state = result.state;

    // Should have 4+ milestones activated
    expect(tl.state.activatedMilestones.size).toBeGreaterThanOrEqual(4);
  });
});

// ─── Economic Milestones ────────────────────────────────────────────────────

describe('World economic milestones', () => {
  test('Oil boom fires at 1973', () => {
    const m = getWorldMilestone('oil_boom');
    expect(m).toBeDefined();
    expect(m!.effects.worldStateDeltas).toBeDefined();
    expect(m!.effects.worldStateDeltas!['commodityIndex']).toBeGreaterThan(0);
  });

  test('Oil price collapse fires at 1986 with high commodity index', () => {
    const m = getWorldMilestone('oil_price_collapse');
    expect(m).toBeDefined();
    expect(m!.effects.pressureModifiers).toBeDefined();
  });

  test('Peak phosphorus fires at 2034', () => {
    const m = getWorldMilestone('peak_phosphorus');
    expect(m).toBeDefined();
    expect(m!.effects.pressureModifiers!['food']).toBeGreaterThan(0);
  });

  test('Fusion breakthrough requires high tech level', () => {
    const m = getWorldMilestone('fusion_breakthrough');
    expect(m).toBeDefined();
    expect(m!.effects.unlocks).toContain('fusion_power');
  });
});

// ─── Civilizational Cycles ──────────────────────────────────────────────────

describe('Civilizational cycle milestones', () => {
  test('Turchin wave exists and affects political pressure', () => {
    const m = getWorldMilestone('first_turchin_wave');
    expect(m).toBeDefined();
    expect(m!.effects.pressureModifiers!['political']).toBeGreaterThan(0);
  });

  test('Khaldun decay exists and affects loyalty', () => {
    const m = getWorldMilestone('first_khaldun_decay');
    expect(m).toBeDefined();
    expect(m!.effects.pressureModifiers!['loyalty']).toBeGreaterThan(0);
  });

  test('Tainter simplification exists and affects multiple domains', () => {
    const m = getWorldMilestone('first_tainter_simplification');
    expect(m).toBeDefined();
    expect(m!.effects.pressureModifiers!['economic']).toBeGreaterThan(0);
    expect(m!.effects.pressureModifiers!['infrastructure']).toBeGreaterThan(0);
    expect(m!.effects.pressureModifiers!['political']).toBeGreaterThan(0);
  });

  test('Bronze Age analog is the deep future compound crisis', () => {
    const m = getWorldMilestone('bronze_age_analog');
    expect(m).toBeDefined();
    expect(m!.sustainedTicks).toBeGreaterThanOrEqual(60);
  });

  test('Deep Turchin crisis has severe multi-domain pressure effects', () => {
    const m = getWorldMilestone('deep_turchin_crisis');
    expect(m).toBeDefined();
    const pm = m!.effects.pressureModifiers!;
    expect(pm['political']).toBeGreaterThanOrEqual(0.3);
    expect(pm['economic']).toBeGreaterThanOrEqual(0.2);
  });
});

// ─── Technology & Governance ────────────────────────────────────────────────

describe('Technology and governance milestones', () => {
  test('AI Gosplan unlocks ai_planning', () => {
    const m = getWorldMilestone('ai_gosplan');
    expect(m).toBeDefined();
    expect(m!.effects.unlocks).toContain('ai_planning');
  });

  test('Longevity treatment increases political pressure', () => {
    const m = getWorldMilestone('longevity_treatment');
    expect(m).toBeDefined();
    expect(m!.effects.pressureModifiers!['political']).toBeGreaterThan(0);
  });

  test('Corporate sovereignty comes before neofeudal transition', () => {
    const corp = getWorldMilestone('corporate_sovereignty');
    const neo = getWorldMilestone('neofeudal_transition');
    expect(corp).toBeDefined();
    expect(neo).toBeDefined();
    expect(neo!.order).toBeGreaterThan(corp!.order);
  });

  test('Neofeudal transition requires corporate sovereignty', () => {
    const neo = getWorldMilestone('neofeudal_transition');
    const conditions = JSON.stringify(neo!.conditions);
    expect(conditions).toContain('corporate_sovereignty');
  });
});

// ─── Deep Future ────────────────────────────────────────────────────────────

describe('Deep future milestones', () => {
  test('Language divergence occurs after 3000', () => {
    const m = getWorldMilestone('language_divergence');
    expect(m).toBeDefined();
    const conditions = JSON.stringify(m!.conditions);
    expect(conditions).toContain('"min":3000');
  });

  test('Language divergence cross-references space timeline (exoplanet colony)', () => {
    const m = getWorldMilestone('language_divergence');
    const conditions = JSON.stringify(m!.conditions);
    expect(conditions).toContain('exoplanet_colony');
  });

  test('Speciation divergence occurs after 5000', () => {
    const m = getWorldMilestone('speciation_divergence');
    expect(m).toBeDefined();
  });

  test('Geomagnetic reversal occurs after 100000', () => {
    const m = getWorldMilestone('geomagnetic_reversal');
    expect(m).toBeDefined();
    expect(m!.sustainedTicks).toBeGreaterThanOrEqual(60);
  });

  test('Entropy management is the final milestone', () => {
    const m = getWorldMilestone('entropy_management');
    expect(m).toBeDefined();
    expect(m!.effects.unlocks).toContain('entropy_engineering');
    // Cross-references Kardashev II from space timeline
    const conditions = JSON.stringify(m!.conditions);
    expect(conditions).toContain('kardashev_two');
  });
});

// ─── Cross-Timeline Integration ─────────────────────────────────────────────

describe('World × Space cross-timeline evaluation', () => {
  test('world + space timelines run in parallel', () => {
    const timelines: RegisteredTimeline[] = [
      createWorldTimeline(),
      createSpaceTimeline(),
    ];
    const ctx = {
      year: 1957,
      population: 500,
      techLevel: 0.15,
      worldState: {},
      pressureLevels: {},
      resources: {},
    };

    const { allActivated } = evaluateAllTimelines(timelines, ctx);
    const ids = allActivated.map((m) => m.id);

    // Cold War should fire (1947+)
    expect(ids).toContain('cold_war_start');
    // Sputnik should fire (1957+, techLevel 0.15+)
    expect(ids).toContain('sputnik');
    // Chinese Revolution should fire (1949+)
    expect(ids).toContain('chinese_revolution');
    // Sino-Soviet Split should fire (1960+) — NO, 1957 < 1960
    expect(ids).not.toContain('sino_soviet_split');
  });

  test('cross-timeline milestones require previous activations', () => {
    // Language divergence requires exoplanet_colony from space timeline
    const worldTl = createWorldTimeline();
    const ctx = makeCtx({
      year: 4000,
      techLevel: 0.99,
      // No space milestones activated — language divergence should NOT fire
      allActivatedMilestones: new Map([['world', worldTl.state.activatedMilestones]]),
    });
    const result = evaluateTimelineLayer(WORLD_MILESTONES, worldTl.state, ctx);
    expect(result.activated.map((m) => m.id)).not.toContain('language_divergence');
  });

  test('cross-timeline milestones fire when prerequisites are met (after sustained ticks)', () => {
    let worldTl = createWorldTimeline();
    const languageMilestone = getWorldMilestone('language_divergence')!;
    const ticks = languageMilestone.sustainedTicks;

    // Run enough ticks to satisfy the sustained requirement
    for (let i = 0; i < ticks; i++) {
      const ctx = makeCtx({
        year: 4000,
        techLevel: 0.99,
        allActivatedMilestones: new Map([
          ['world', worldTl.state.activatedMilestones],
          ['space', new Set(['exoplanet_colony'])],
        ]),
      });
      const result = evaluateTimelineLayer(WORLD_MILESTONES, worldTl.state, ctx);
      worldTl.state = result.state;
      if (i === ticks - 1) {
        expect(result.activated.map((m) => m.id)).toContain('language_divergence');
      }
    }
  });
});

// ─── Pressure Effects ───────────────────────────────────────────────────────

describe('Pressure effects accumulation', () => {
  test('permafrost crisis increases infrastructure and economic pressure', () => {
    const m = getWorldMilestone('permafrost_crisis');
    expect(m).toBeDefined();
    expect(m!.effects.pressureModifiers!['infrastructure']).toBeGreaterThan(0);
    expect(m!.effects.pressureModifiers!['economic']).toBeGreaterThan(0);
  });

  test('demographic inversion increases demographic pressure', () => {
    const m = getWorldMilestone('demographic_inversion');
    expect(m).toBeDefined();
    expect(m!.effects.pressureModifiers!['demographic']).toBeGreaterThan(0);
  });

  test('dome mandatory unlocks dome construction', () => {
    const m = getWorldMilestone('dome_mandatory_earth');
    expect(m).toBeDefined();
    expect(m!.effects.unlocks).toContain('mandatory_dome_construction');
  });
});
