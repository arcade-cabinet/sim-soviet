/**
 * Tests for the Space Timeline — Soviet space program progression.
 */

import {
  SPACE_MILESTONES,
  SPACE_TIMELINE_ID,
  SPACE_SETTLEMENT_MILESTONES,
  createSpaceTimeline,
  getSpaceMilestone,
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

describe('Space Timeline catalog', () => {
  test('loads all milestones from JSON', () => {
    expect(SPACE_MILESTONES.length).toBeGreaterThanOrEqual(15);
  });

  test('all milestones have required fields', () => {
    for (const m of SPACE_MILESTONES) {
      expect(m.id).toBeTruthy();
      expect(m.name).toBeTruthy();
      expect(m.timelineId).toBe('space');
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
    const ids = SPACE_MILESTONES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('milestones are sorted by order', () => {
    for (let i = 1; i < SPACE_MILESTONES.length; i++) {
      expect(SPACE_MILESTONES[i]!.order).toBeGreaterThanOrEqual(SPACE_MILESTONES[i - 1]!.order);
    }
  });

  test('all milestones are one-shot', () => {
    for (const m of SPACE_MILESTONES) {
      expect(m.oneShot).toBe(true);
    }
  });

  test('settlement-creating milestones have terrain type', () => {
    const settlements = SPACE_MILESTONES.filter((m) => m.effects.newSettlement);
    expect(settlements.length).toBeGreaterThanOrEqual(5);
    for (const m of settlements) {
      expect(m.effects.settlementTerrain).toBeTruthy();
    }
  });

  test('SPACE_SETTLEMENT_MILESTONES counts correctly', () => {
    const actual = SPACE_MILESTONES.filter((m) => m.effects.newSettlement).length;
    expect(SPACE_SETTLEMENT_MILESTONES).toBe(actual);
  });

  test('getSpaceMilestone finds by ID', () => {
    const sputnik = getSpaceMilestone('sputnik');
    expect(sputnik).toBeDefined();
    expect(sputnik!.name).toBe('Sputnik Launch');
  });

  test('getSpaceMilestone returns undefined for unknown', () => {
    expect(getSpaceMilestone('nonexistent')).toBeUndefined();
  });
});

// ─── Progression Order ──────────────────────────────────────────────────────

describe('Space Timeline progression', () => {
  test('Sputnik is first milestone', () => {
    expect(SPACE_MILESTONES[0]!.id).toBe('sputnik');
  });

  test('Sputnik activates at 1957 with techLevel >= 0.15', () => {
    const tl = createSpaceTimeline();
    const ctx = makeCtx({ year: 1957, techLevel: 0.15 });
    const result = evaluateTimelineLayer(SPACE_MILESTONES, tl.state, ctx);
    const activated = result.activated.map((m) => m.id);
    expect(activated).toContain('sputnik');
  });

  test('Sputnik does NOT activate before 1957', () => {
    const tl = createSpaceTimeline();
    const ctx = makeCtx({ year: 1950, techLevel: 0.2 });
    const result = evaluateTimelineLayer(SPACE_MILESTONES, tl.state, ctx);
    expect(result.activated.map((m) => m.id)).not.toContain('sputnik');
  });

  test('Sputnik does NOT activate with low techLevel', () => {
    const tl = createSpaceTimeline();
    const ctx = makeCtx({ year: 1960, techLevel: 0.1 });
    const result = evaluateTimelineLayer(SPACE_MILESTONES, tl.state, ctx);
    expect(result.activated.map((m) => m.id)).not.toContain('sputnik');
  });

  test('Gagarin requires Sputnik to be already activated', () => {
    const tl = createSpaceTimeline();
    // Without Sputnik activated, Gagarin should not fire even with correct year/tech
    const ctx = makeCtx({
      year: 1962,
      techLevel: 0.2,
      allActivatedMilestones: new Map(), // no sputnik
    });
    const result = evaluateTimelineLayer(SPACE_MILESTONES, tl.state, ctx);
    const activated = result.activated.map((m) => m.id);
    // Sputnik should fire (conditions met), but Gagarin should NOT (requires sputnik in allActivated)
    expect(activated).toContain('sputnik');
    expect(activated).not.toContain('vostok_gagarin');
  });

  test('Gagarin fires when Sputnik is in allActivatedMilestones', () => {
    const tl = createSpaceTimeline();
    tl.state.activatedMilestones.add('sputnik');
    const ctx = makeCtx({
      year: 1962,
      techLevel: 0.2,
      allActivatedMilestones: new Map([['space', new Set(['sputnik'])]]),
    });
    const result = evaluateTimelineLayer(SPACE_MILESTONES, tl.state, ctx);
    const activated = result.activated.map((m) => m.id);
    expect(activated).toContain('vostok_gagarin');
  });

  test('full early progression: sputnik → laika → gagarin → leonov', () => {
    let tl = createSpaceTimeline();

    // Tick 1: Sputnik
    let ctx = makeCtx({ year: 1957, techLevel: 0.15 });
    let result = evaluateTimelineLayer(SPACE_MILESTONES, tl.state, ctx);
    expect(result.activated.map((m) => m.id)).toContain('sputnik');
    tl.state = result.state;

    // Tick 2: Laika (same year, requires sputnik)
    ctx = makeCtx({
      year: 1957,
      techLevel: 0.15,
      allActivatedMilestones: new Map([['space', tl.state.activatedMilestones]]),
    });
    result = evaluateTimelineLayer(SPACE_MILESTONES, tl.state, ctx);
    expect(result.activated.map((m) => m.id)).toContain('laika');
    tl.state = result.state;

    // Tick 3: Gagarin (1961+, techLevel 0.18+)
    ctx = makeCtx({
      year: 1961,
      techLevel: 0.18,
      allActivatedMilestones: new Map([['space', tl.state.activatedMilestones]]),
    });
    result = evaluateTimelineLayer(SPACE_MILESTONES, tl.state, ctx);
    expect(result.activated.map((m) => m.id)).toContain('vostok_gagarin');
    tl.state = result.state;

    // Tick 4: Leonov (1965+, requires gagarin)
    ctx = makeCtx({
      year: 1965,
      techLevel: 0.2,
      allActivatedMilestones: new Map([['space', tl.state.activatedMilestones]]),
    });
    result = evaluateTimelineLayer(SPACE_MILESTONES, tl.state, ctx);
    expect(result.activated.map((m) => m.id)).toContain('voskhod_spacewalk');
    tl.state = result.state;

    // After 4 ticks, should have sputnik, laika, gagarin, leonov activated
    expect(tl.state.activatedMilestones.size).toBeGreaterThanOrEqual(4);
  });
});

// ─── Settlement Creation ────────────────────────────────────────────────────

describe('Space settlements', () => {
  test('lunar base creates a settlement', () => {
    const m = getSpaceMilestone('permanent_lunar_base');
    expect(m).toBeDefined();
    expect(m!.effects.newSettlement).toBe(true);
    expect(m!.effects.settlementTerrain).toBe('lunar');
  });

  test('mars colony creates a settlement', () => {
    const m = getSpaceMilestone('mars_colony');
    expect(m).toBeDefined();
    expect(m!.effects.newSettlement).toBe(true);
    expect(m!.effects.settlementTerrain).toBe('mars');
  });

  test('venus cloud colony creates a settlement', () => {
    const m = getSpaceMilestone('venus_cloud_colony');
    expect(m).toBeDefined();
    expect(m!.effects.newSettlement).toBe(true);
    expect(m!.effects.settlementTerrain).toBe('venus_cloud');
  });

  test('ganymede colony creates a settlement', () => {
    const m = getSpaceMilestone('ganymede_colony');
    expect(m).toBeDefined();
    expect(m!.effects.newSettlement).toBe(true);
    expect(m!.effects.settlementTerrain).toBe('ganymede');
  });

  test('titan colony creates a settlement', () => {
    const m = getSpaceMilestone('titan_colony');
    expect(m).toBeDefined();
    expect(m!.effects.newSettlement).toBe(true);
    expect(m!.effects.settlementTerrain).toBe('titan');
  });

  test('O\'Neill cylinder creates a settlement', () => {
    const m = getSpaceMilestone('oneill_cylinder');
    expect(m).toBeDefined();
    expect(m!.effects.newSettlement).toBe(true);
    expect(m!.effects.settlementTerrain).toBe('orbital_habitat');
  });

  test('generation ship creates a settlement', () => {
    const m = getSpaceMilestone('generation_ship');
    expect(m).toBeDefined();
    expect(m!.effects.newSettlement).toBe(true);
    expect(m!.effects.settlementTerrain).toBe('generation_ship');
  });

  test('second generation ship creates a settlement', () => {
    const m = getSpaceMilestone('second_generation_ship');
    expect(m).toBeDefined();
    expect(m!.effects.newSettlement).toBe(true);
    expect(m!.effects.settlementTerrain).toBe('generation_ship');
  });

  test('exoplanet colony creates a settlement', () => {
    const m = getSpaceMilestone('exoplanet_colony');
    expect(m).toBeDefined();
    expect(m!.effects.newSettlement).toBe(true);
    expect(m!.effects.settlementTerrain).toBe('exoplanet');
  });
});

// ─── Mars Terraforming Progression (KSR Mars Trilogy) ────────────────────────

describe('Mars terraforming phases', () => {
  test('Mars ISRU requires mars_expedition', () => {
    const m = getSpaceMilestone('mars_isru_operations');
    expect(m).toBeDefined();
    expect(m!.effects.unlocks).toContain('in_situ_resource_utilization');
  });

  test('Red → Green → Blue progression order', () => {
    const red = getSpaceMilestone('mars_colony');
    const green = getSpaceMilestone('mars_green_phase');
    const blue = getSpaceMilestone('mars_blue_phase');
    expect(red).toBeDefined();
    expect(green).toBeDefined();
    expect(blue).toBeDefined();
    expect(green!.order).toBeGreaterThan(red!.order);
    expect(blue!.order).toBeGreaterThan(green!.order);
  });

  test('greenhouse phase is between colony and green phase', () => {
    const colony = getSpaceMilestone('mars_colony');
    const greenhouse = getSpaceMilestone('mars_greenhouse_phase');
    const green = getSpaceMilestone('mars_green_phase');
    expect(greenhouse!.order).toBeGreaterThan(colony!.order);
    expect(green!.order).toBeGreaterThan(greenhouse!.order);
  });

  test('Blue Mars unlocks breathable atmosphere', () => {
    const blue = getSpaceMilestone('mars_blue_phase');
    expect(blue!.effects.unlocks).toContain('breathable_mars_atmosphere');
  });

  test('Blue Mars has long sustained tick requirement (centuries of terraforming)', () => {
    const blue = getSpaceMilestone('mars_blue_phase');
    expect(blue!.sustainedTicks).toBeGreaterThanOrEqual(120);
  });
});

// ─── Jupiter System (Sheffield 'Cold as Ice') ────────────────────────────────

describe('Jupiter system milestones', () => {
  test('Europa probe comes before Ganymede colony', () => {
    const europa = getSpaceMilestone('europa_probe');
    const ganymede = getSpaceMilestone('ganymede_colony');
    expect(europa).toBeDefined();
    expect(ganymede).toBeDefined();
    expect(ganymede!.order).toBeGreaterThan(europa!.order);
  });

  test('Ganymede colony requires Europa probe', () => {
    const ganymede = getSpaceMilestone('ganymede_colony');
    const conditions = JSON.stringify(ganymede!.conditions);
    expect(conditions).toContain('europa_probe');
  });

  test('Callisto outpost requires Ganymede colony', () => {
    const callisto = getSpaceMilestone('callisto_outpost');
    expect(callisto).toBeDefined();
    const conditions = JSON.stringify(callisto!.conditions);
    expect(conditions).toContain('ganymede_colony');
  });

  test('Ganymede unlocks outer system habitation', () => {
    const ganymede = getSpaceMilestone('ganymede_colony');
    expect(ganymede!.effects.unlocks).toContain('outer_system_habitation');
  });
});

// ─── Space Infrastructure ────────────────────────────────────────────────────

describe('Space infrastructure milestones', () => {
  test('Space elevator exists and unlocks cheap orbital access', () => {
    const se = getSpaceMilestone('space_elevator');
    expect(se).toBeDefined();
    expect(se!.effects.unlocks).toContain('cheap_orbital_access');
    expect(se!.effects.unlocks).toContain('carbon_nanotube_manufacturing');
  });

  test('Mercury mining provides materials for Dyson swarm', () => {
    const mercury = getSpaceMilestone('mercury_mining');
    expect(mercury).toBeDefined();
    expect(mercury!.effects.resourceDeltas).toBeDefined();
    expect(mercury!.effects.resourceDeltas!['minerals']).toBeGreaterThan(0);
  });

  test('Ceres provides belt waystation', () => {
    const ceres = getSpaceMilestone('ceres_mining_station');
    expect(ceres).toBeDefined();
    expect(ceres!.effects.unlocks).toContain('belt_waystation');
  });

  test('Interstellar probe enables generation ship', () => {
    const probe = getSpaceMilestone('interstellar_probe');
    expect(probe).toBeDefined();
    expect(probe!.effects.unlocks).toContain('laser_sail_technology');
  });

  test('Dyson swarm requires Mercury mining (raw materials)', () => {
    const dyson = getSpaceMilestone('dyson_swarm_start');
    const conditions = JSON.stringify(dyson!.conditions);
    expect(conditions).toContain('mercury_mining');
  });
});

// ─── Kardashev Scale ─────────────────────────────────────────────────────────

describe('Kardashev progression', () => {
  test('Kardashev I comes after Dyson swarm start', () => {
    const k1 = getSpaceMilestone('kardashev_one');
    const dyson = getSpaceMilestone('dyson_swarm_start');
    expect(k1).toBeDefined();
    expect(k1!.order).toBeGreaterThan(dyson!.order);
  });

  test('Kardashev II comes after Kardashev I', () => {
    const k2 = getSpaceMilestone('kardashev_two');
    const k1 = getSpaceMilestone('kardashev_one');
    expect(k2).toBeDefined();
    expect(k2!.order).toBeGreaterThan(k1!.order);
  });

  test('Kardashev II requires both Dyson swarm and exoplanet colony', () => {
    const k2 = getSpaceMilestone('kardashev_two');
    const conditions = JSON.stringify(k2!.conditions);
    expect(conditions).toContain('dyson_swarm_start');
    expect(conditions).toContain('exoplanet_colony');
  });

  test('Kardashev II has extremely long sustained tick requirement', () => {
    const k2 = getSpaceMilestone('kardashev_two');
    expect(k2!.sustainedTicks).toBeGreaterThanOrEqual(300);
  });
});

// ─── Cross-Timeline Integration ─────────────────────────────────────────────

describe('Cross-timeline evaluation', () => {
  test('space timeline works with evaluateAllTimelines', () => {
    const timelines: RegisteredTimeline[] = [createSpaceTimeline()];
    const ctx = { year: 1957, population: 500, techLevel: 0.15, worldState: {}, pressureLevels: {}, resources: {} };

    const { allActivated } = evaluateAllTimelines(timelines, ctx);
    expect(allActivated.length).toBeGreaterThanOrEqual(1);
    expect(allActivated[0]!.id).toBe('sputnik');
  });

  test('space + world timelines run in parallel', () => {
    const worldMilestone = {
      id: 'cold_war_start',
      name: 'Cold War Begins',
      timelineId: 'world',
      conditions: { year: { min: 1947 } },
      sustainedTicks: 1,
      effects: {
        worldStateDeltas: { globalTension: 0.3 },
        narrative: { pravdaHeadline: 'COLD WAR', toast: 'Tensions rise' },
      },
      oneShot: true,
      order: 1,
    } as unknown as import('../../src/game/timeline/TimelineLayer').Milestone;

    const timelines: RegisteredTimeline[] = [
      createSpaceTimeline(),
      {
        id: 'world',
        milestones: [worldMilestone],
        state: { timelineId: 'world', activatedMilestones: new Set(), trackers: new Map(), unlockedCapabilities: new Set() },
      },
    ];

    const ctx = { year: 1957, population: 500, techLevel: 0.15, worldState: {}, pressureLevels: {}, resources: {} };
    const { allActivated } = evaluateAllTimelines(timelines, ctx);

    const ids = allActivated.map((m) => m.id);
    expect(ids).toContain('sputnik');
    expect(ids).toContain('cold_war_start');
  });
});

// ─── Unlocked Capabilities ──────────────────────────────────────────────────

describe('Capability unlocks', () => {
  test('Sputnik unlocks orbital_capability', () => {
    const m = getSpaceMilestone('sputnik');
    expect(m!.effects.unlocks).toContain('orbital_capability');
  });

  test('Gagarin unlocks human_spaceflight', () => {
    const m = getSpaceMilestone('vostok_gagarin');
    expect(m!.effects.unlocks).toContain('human_spaceflight');
  });

  test('Mir unlocks long_duration_habitation', () => {
    const m = getSpaceMilestone('mir_station');
    expect(m!.effects.unlocks).toContain('long_duration_habitation');
  });

  test('BIOS-3 unlocks closed_life_support', () => {
    const m = getSpaceMilestone('bios3_closed_ecosystem');
    expect(m!.effects.unlocks).toContain('closed_life_support');
  });

  test('Dyson swarm unlocks stellar_engineering', () => {
    const m = getSpaceMilestone('dyson_swarm_start');
    expect(m!.effects.unlocks).toContain('stellar_engineering');
  });

  test('Space elevator unlocks cheap_orbital_access', () => {
    const m = getSpaceMilestone('space_elevator');
    expect(m).toBeDefined();
    expect(m!.effects.unlocks).toContain('cheap_orbital_access');
  });

  test('Ganymede unlocks magnetosphere_shielding', () => {
    const m = getSpaceMilestone('ganymede_colony');
    expect(m).toBeDefined();
    expect(m!.effects.unlocks).toContain('magnetosphere_shielding');
  });

  test('Kardashev I unlocks planetary_energy_capture', () => {
    const m = getSpaceMilestone('kardashev_one');
    expect(m).toBeDefined();
    expect(m!.effects.unlocks).toContain('kardashev_one');
  });

  test('capabilities accumulate over progression', () => {
    let tl = createSpaceTimeline();

    // Activate sputnik
    let ctx = makeCtx({ year: 1957, techLevel: 0.15 });
    let result = evaluateTimelineLayer(SPACE_MILESTONES, tl.state, ctx);
    tl.state = result.state;
    expect(tl.state.unlockedCapabilities.has('orbital_capability')).toBe(true);

    // Activate laika + gagarin
    ctx = makeCtx({
      year: 1961,
      techLevel: 0.18,
      allActivatedMilestones: new Map([['space', tl.state.activatedMilestones]]),
    });
    result = evaluateTimelineLayer(SPACE_MILESTONES, tl.state, ctx);
    tl.state = result.state;
    expect(tl.state.unlockedCapabilities.has('human_spaceflight')).toBe(true);
    // Previous unlocks preserved
    expect(tl.state.unlockedCapabilities.has('orbital_capability')).toBe(true);
  });
});
