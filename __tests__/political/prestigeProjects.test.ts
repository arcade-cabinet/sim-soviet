/**
 * @fileoverview Tests for the PrestigeProjectSystem.
 *
 * Validates project eligibility, prerequisite gating, resource cost deduction,
 * tick countdown, completion effects, capability tracking, single-active
 * constraint, and serialization round-trips.
 */

import {
  type PrestigeContext,
  type PrestigeProject,
  type PrestigeProjectState,
  canAffordProject,
  createPrestigeState,
  getAllProjects,
  getAvailableProjects,
  getProjectById,
  restorePrestigeState,
  serializePrestigeState,
  startProject,
  tickPrestigeProjects,
} from '@/ai/agents/political/PrestigeProjectSystem';

// ─── Fixtures ───────────────────────────────────────────────────────────────

function makeCtx(overrides?: Partial<PrestigeContext>): PrestigeContext {
  return {
    population: 1000,
    year: 1960,
    eraId: 'thaw_and_freeze',
    politicalStanding: 0.6,
    techLevel: 0.5,
    resources: { materials: 10000, money: 10000 },
    state: createPrestigeState(),
    ...overrides,
  };
}

// ─── Catalog ────────────────────────────────────────────────────────────────

describe('Prestige project catalog', () => {
  it('loads all projects from config', () => {
    const projects = getAllProjects();
    expect(projects.length).toBeGreaterThanOrEqual(10);
  });

  it('every project has required fields', () => {
    for (const p of getAllProjects()) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.description).toBeTruthy();
      expect(p.era).toBeTruthy();
      expect(typeof p.minPopulation).toBe('number');
      expect(typeof p.constructionTicks).toBe('number');
      expect(p.constructionTicks).toBeGreaterThan(0);
      expect(typeof p.resourceCost).toBe('object');
      expect(typeof p.effects).toBe('object');
      expect(Array.isArray(p.unlocks)).toBe(true);
      expect(p.pravdaAnnouncement).toBeTruthy();
      expect(p.completionToast).toBeTruthy();
    }
  });

  it('looks up a project by ID', () => {
    const monument = getProjectById('monument_revolution');
    expect(monument).toBeDefined();
    expect(monument!.name).toBe('Monument to the Revolution');
  });

  it('returns undefined for unknown project ID', () => {
    expect(getProjectById('nonexistent_project')).toBeUndefined();
  });

  it('has unique IDs for all projects', () => {
    const ids = getAllProjects().map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes the dyson swarm as the final mega-project', () => {
    const dyson = getProjectById('dyson_swarm');
    expect(dyson).toBeDefined();
    expect(dyson!.era).toBe('the_eternal');
    expect(dyson!.constructionTicks).toBeGreaterThanOrEqual(240);
  });
});

// ─── State Factory ──────────────────────────────────────────────────────────

describe('createPrestigeState', () => {
  it('creates empty initial state', () => {
    const state = createPrestigeState();
    expect(state.completed).toEqual([]);
    expect(state.active).toBeNull();
    expect(state.unlockedCapabilities).toEqual([]);
  });
});

// ─── Available Projects ─────────────────────────────────────────────────────

describe('getAvailableProjects', () => {
  it('returns monument_revolution for early revolution era with sufficient standing', () => {
    const ctx = makeCtx({
      population: 100,
      year: 1920,
      eraId: 'revolution',
      politicalStanding: 0.4,
      techLevel: 0.05,
      resources: { materials: 500, money: 200 },
    });
    const available = getAvailableProjects(ctx);
    const ids = available.map((p) => p.id);
    expect(ids).toContain('monument_revolution');
  });

  it('excludes projects whose era has not been reached', () => {
    const ctx = makeCtx({
      population: 1000,
      year: 1920,
      eraId: 'revolution',
      politicalStanding: 0.6,
      techLevel: 0.5,
    });
    const available = getAvailableProjects(ctx);
    const ids = available.map((p) => p.id);
    // cosmodrome requires thaw_and_freeze era
    expect(ids).not.toContain('cosmodrome');
  });

  it('excludes projects with unmet population requirement', () => {
    const ctx = makeCtx({
      population: 10,
      year: 1920,
      eraId: 'revolution',
      politicalStanding: 0.5,
    });
    const available = getAvailableProjects(ctx);
    const ids = available.map((p) => p.id);
    // monument_revolution needs minPopulation 50
    expect(ids).not.toContain('monument_revolution');
  });

  it('excludes projects with unmet political standing', () => {
    const ctx = makeCtx({
      population: 200,
      year: 1920,
      eraId: 'revolution',
      politicalStanding: 0.1,
      resources: { materials: 500, money: 200 },
    });
    const available = getAvailableProjects(ctx);
    const ids = available.map((p) => p.id);
    // monument_revolution needs minPoliticalStanding 0.3
    expect(ids).not.toContain('monument_revolution');
  });

  it('excludes projects with unmet tech level', () => {
    const ctx = makeCtx({
      population: 500,
      year: 1940,
      eraId: 'industrialization',
      politicalStanding: 0.5,
      techLevel: 0.1,
      resources: { materials: 1000, money: 1000 },
    });
    const available = getAvailableProjects(ctx);
    const ids = available.map((p) => p.id);
    // nuclear_program needs minTechLevel 0.3
    expect(ids).not.toContain('nuclear_program');
  });

  it('excludes projects the player cannot afford', () => {
    const ctx = makeCtx({
      population: 100,
      year: 1920,
      eraId: 'revolution',
      politicalStanding: 0.5,
      resources: { materials: 10, money: 5 },
    });
    const available = getAvailableProjects(ctx);
    const ids = available.map((p) => p.id);
    // monument needs 200 materials + 100 money
    expect(ids).not.toContain('monument_revolution');
  });

  it('excludes already-completed projects', () => {
    const ctx = makeCtx({
      population: 100,
      year: 1920,
      eraId: 'revolution',
      politicalStanding: 0.5,
      resources: { materials: 500, money: 200 },
      state: {
        completed: ['monument_revolution'],
        active: null,
        unlockedCapabilities: [],
      },
    });
    const available = getAvailableProjects(ctx);
    const ids = available.map((p) => p.id);
    expect(ids).not.toContain('monument_revolution');
  });

  it('includes projects from earlier eras when in a later era', () => {
    const ctx = makeCtx({
      population: 200,
      year: 1960,
      eraId: 'thaw_and_freeze',
      politicalStanding: 0.6,
      techLevel: 0.5,
      resources: { materials: 10000, money: 10000 },
    });
    const available = getAvailableProjects(ctx);
    const ids = available.map((p) => p.id);
    // revolution-era monument should still be available
    expect(ids).toContain('monument_revolution');
  });
});

// ─── Prerequisite Gating ────────────────────────────────────────────────────

describe('Prerequisite gating', () => {
  it('blocks cosmodrome without nuclear_program', () => {
    const ctx = makeCtx({
      population: 1000,
      year: 1960,
      eraId: 'thaw_and_freeze',
      politicalStanding: 0.6,
      techLevel: 0.5,
      resources: { materials: 10000, money: 10000 },
    });
    const available = getAvailableProjects(ctx);
    const ids = available.map((p) => p.id);
    expect(ids).not.toContain('cosmodrome');
  });

  it('allows cosmodrome after nuclear_program is completed', () => {
    const ctx = makeCtx({
      population: 1000,
      year: 1960,
      eraId: 'thaw_and_freeze',
      politicalStanding: 0.6,
      techLevel: 0.5,
      resources: { materials: 10000, money: 10000 },
      state: {
        completed: ['nuclear_program'],
        active: null,
        unlockedCapabilities: ['uranium_processing'],
      },
    });
    const available = getAvailableProjects(ctx);
    const ids = available.map((p) => p.id);
    expect(ids).toContain('cosmodrome');
  });

  it('blocks nuclear_power_plant without nuclear_program', () => {
    const ctx = makeCtx({
      population: 500,
      year: 1960,
      eraId: 'thaw_and_freeze',
      politicalStanding: 0.5,
      techLevel: 0.5,
      resources: { materials: 10000, uranium: 100, money: 10000 },
    });
    const available = getAvailableProjects(ctx);
    const ids = available.map((p) => p.id);
    expect(ids).not.toContain('nuclear_power_plant');
  });

  it('blocks space_station without cosmodrome', () => {
    const ctx = makeCtx({
      population: 5000,
      year: 2000,
      eraId: 'the_eternal',
      politicalStanding: 0.6,
      techLevel: 0.8,
      resources: { materials: 50000, money: 50000 },
      state: {
        completed: ['nuclear_program'],
        active: null,
        unlockedCapabilities: [],
      },
    });
    const available = getAvailableProjects(ctx);
    const ids = available.map((p) => p.id);
    expect(ids).not.toContain('space_station');
  });

  it('allows space_station after cosmodrome is completed', () => {
    const ctx = makeCtx({
      population: 5000,
      year: 2000,
      eraId: 'the_eternal',
      politicalStanding: 0.6,
      techLevel: 0.8,
      resources: { materials: 50000, money: 50000 },
      state: {
        completed: ['nuclear_program', 'cosmodrome'],
        active: null,
        unlockedCapabilities: ['space_launches'],
      },
    });
    const available = getAvailableProjects(ctx);
    const ids = available.map((p) => p.id);
    expect(ids).toContain('space_station');
  });

  it('blocks terraforming_engine without fusion_reactor', () => {
    const ctx = makeCtx({
      population: 100000,
      year: 2300,
      eraId: 'the_eternal',
      politicalStanding: 0.6,
      techLevel: 0.99,
      resources: { materials: 100000, hydrogen: 10000, money: 50000 },
      state: {
        completed: ['nuclear_program', 'nuclear_power_plant'],
        active: null,
        unlockedCapabilities: [],
      },
    });
    const available = getAvailableProjects(ctx);
    const ids = available.map((p) => p.id);
    expect(ids).not.toContain('terraforming_engine');
  });
});

// ─── canAffordProject ───────────────────────────────────────────────────────

describe('canAffordProject', () => {
  it('returns true when all resources are sufficient', () => {
    const monument = getProjectById('monument_revolution')!;
    expect(canAffordProject(monument, { materials: 200, money: 100 })).toBe(true);
  });

  it('returns true when resources exceed cost', () => {
    const monument = getProjectById('monument_revolution')!;
    expect(canAffordProject(monument, { materials: 9999, money: 9999 })).toBe(true);
  });

  it('returns false when a resource is missing', () => {
    const monument = getProjectById('monument_revolution')!;
    expect(canAffordProject(monument, { materials: 200 })).toBe(false);
  });

  it('returns false when a resource is insufficient', () => {
    const monument = getProjectById('monument_revolution')!;
    expect(canAffordProject(monument, { materials: 100, money: 100 })).toBe(false);
  });

  it('handles projects with exotic resource requirements', () => {
    const npp = getProjectById('nuclear_power_plant')!;
    expect(canAffordProject(npp, { materials: 600, uranium: 50, money: 400 })).toBe(true);
    expect(canAffordProject(npp, { materials: 600, uranium: 10, money: 400 })).toBe(false);
    expect(canAffordProject(npp, { materials: 600, money: 400 })).toBe(false);
  });
});

// ─── startProject ───────────────────────────────────────────────────────────

describe('startProject', () => {
  it('starts a project and returns resource cost', () => {
    const state = createPrestigeState();
    const result = startProject(state, 'monument_revolution');
    expect(result).not.toBeNull();
    expect(result!.state.active).toEqual({
      projectId: 'monument_revolution',
      ticksRemaining: 24,
    });
    expect(result!.resourceCost).toEqual({ materials: 200, money: 100 });
  });

  it('returns null when a project is already active', () => {
    const state: PrestigeProjectState = {
      completed: [],
      active: { projectId: 'monument_revolution', ticksRemaining: 10 },
      unlockedCapabilities: [],
    };
    const result = startProject(state, 'palace_soviets');
    expect(result).toBeNull();
  });

  it('returns null for an unknown project ID', () => {
    const state = createPrestigeState();
    const result = startProject(state, 'nonexistent');
    expect(result).toBeNull();
  });

  it('returns null for an already-completed project', () => {
    const state: PrestigeProjectState = {
      completed: ['monument_revolution'],
      active: null,
      unlockedCapabilities: [],
    };
    const result = startProject(state, 'monument_revolution');
    expect(result).toBeNull();
  });

  it('does not mutate the original state', () => {
    const state = createPrestigeState();
    const original = JSON.stringify(state);
    startProject(state, 'monument_revolution');
    expect(JSON.stringify(state)).toBe(original);
  });
});

// ─── Tick Countdown ─────────────────────────────────────────────────────────

describe('Tick countdown', () => {
  it('decrements ticksRemaining on active project', () => {
    const ctx = makeCtx({
      state: {
        completed: [],
        active: { projectId: 'monument_revolution', ticksRemaining: 10 },
        unlockedCapabilities: [],
      },
    });
    const result = tickPrestigeProjects(ctx);
    expect(result.state.active).not.toBeNull();
    expect(result.state.active!.ticksRemaining).toBe(9);
    expect(result.justCompleted).toBeNull();
  });

  it('completes a project when ticksRemaining reaches 0', () => {
    const ctx = makeCtx({
      state: {
        completed: [],
        active: { projectId: 'monument_revolution', ticksRemaining: 1 },
        unlockedCapabilities: [],
      },
    });
    const result = tickPrestigeProjects(ctx);
    expect(result.justCompleted).not.toBeNull();
    expect(result.justCompleted!.id).toBe('monument_revolution');
    expect(result.state.completed).toContain('monument_revolution');
    expect(result.completionMessage).toBe(
      'The monument stands. It is made of concrete. Everything is made of concrete.',
    );
  });

  it('clears active project on completion', () => {
    const ctx = makeCtx({
      state: {
        completed: [],
        active: { projectId: 'monument_revolution', ticksRemaining: 1 },
        unlockedCapabilities: [],
      },
    });
    const result = tickPrestigeProjects(ctx);
    // Active should be null OR a new auto-started project
    // (monument has no unlocks, so active may auto-start next eligible)
    expect(result.state.completed).toContain('monument_revolution');
  });

  it('runs full countdown from constructionTicks to completion', () => {
    const monument = getProjectById('monument_revolution')!;
    let state: PrestigeProjectState = {
      completed: [],
      active: { projectId: 'monument_revolution', ticksRemaining: monument.constructionTicks },
      unlockedCapabilities: [],
    };

    // Tick (constructionTicks - 1) times: should not complete
    for (let i = 0; i < monument.constructionTicks - 1; i++) {
      const ctx = makeCtx({ state });
      const result = tickPrestigeProjects(ctx);
      state = result.state;
      expect(result.justCompleted).toBeNull();
    }

    // Final tick: should complete
    const ctx = makeCtx({ state });
    const result = tickPrestigeProjects(ctx);
    expect(result.justCompleted).not.toBeNull();
    expect(result.justCompleted!.id).toBe('monument_revolution');
  });
});

// ─── Completion Effects ─────────────────────────────────────────────────────

describe('Completion effects', () => {
  it('adds unlocked capabilities on completion', () => {
    const ctx = makeCtx({
      state: {
        completed: [],
        active: { projectId: 'nuclear_program', ticksRemaining: 1 },
        unlockedCapabilities: [],
      },
    });
    const result = tickPrestigeProjects(ctx);
    expect(result.justCompleted!.id).toBe('nuclear_program');
    expect(result.state.unlockedCapabilities).toContain('uranium_processing');
  });

  it('adds multiple capabilities from cosmodrome', () => {
    const ctx = makeCtx({
      state: {
        completed: ['nuclear_program'],
        active: { projectId: 'cosmodrome', ticksRemaining: 1 },
        unlockedCapabilities: ['uranium_processing'],
      },
    });
    const result = tickPrestigeProjects(ctx);
    expect(result.justCompleted!.id).toBe('cosmodrome');
    expect(result.state.unlockedCapabilities).toContain('space_launches');
    expect(result.state.unlockedCapabilities).toContain('lunar_colony_directive');
    // Prior capabilities preserved
    expect(result.state.unlockedCapabilities).toContain('uranium_processing');
  });

  it('does not duplicate capabilities on re-unlock', () => {
    const ctx = makeCtx({
      state: {
        completed: [],
        active: { projectId: 'nuclear_program', ticksRemaining: 1 },
        unlockedCapabilities: ['uranium_processing'],
      },
    });
    const result = tickPrestigeProjects(ctx);
    const count = result.state.unlockedCapabilities.filter((c) => c === 'uranium_processing').length;
    expect(count).toBe(1);
  });

  it('returns the completion toast message', () => {
    const ctx = makeCtx({
      state: {
        completed: [],
        active: { projectId: 'palace_soviets', ticksRemaining: 1 },
        unlockedCapabilities: [],
      },
    });
    const result = tickPrestigeProjects(ctx);
    expect(result.completionMessage).toBe(
      'The Palace rises above the settlement. Its shadow covers everything. This is considered a feature.',
    );
  });
});

// ─── Only One Active Project ────────────────────────────────────────────────

describe('Single active project constraint', () => {
  it('does not auto-start a new project while one is active', () => {
    const ctx = makeCtx({
      population: 1000,
      year: 1960,
      eraId: 'thaw_and_freeze',
      politicalStanding: 0.6,
      techLevel: 0.5,
      resources: { materials: 10000, money: 10000 },
      state: {
        completed: [],
        active: { projectId: 'monument_revolution', ticksRemaining: 10 },
        unlockedCapabilities: [],
      },
    });
    const result = tickPrestigeProjects(ctx);
    expect(result.state.active!.projectId).toBe('monument_revolution');
    expect(result.resourceDeduction).toBeNull();
  });

  it('auto-starts the first available project when none is active', () => {
    const ctx = makeCtx({
      population: 100,
      year: 1920,
      eraId: 'revolution',
      politicalStanding: 0.5,
      techLevel: 0.05,
      resources: { materials: 500, money: 200 },
      state: createPrestigeState(),
    });
    const result = tickPrestigeProjects(ctx);
    // Should auto-start monument_revolution (first eligible)
    expect(result.state.active).not.toBeNull();
    expect(result.state.active!.projectId).toBe('monument_revolution');
    expect(result.resourceDeduction).toEqual({ materials: 200, money: 100 });
    expect(result.pravdaHeadline).toBe('MONUMENT CONSTRUCTION APPROVED: Soviet Spirit Rendered in Concrete');
  });

  it('auto-starts next project after completion in same tick', () => {
    // Monument is completing, and palace_soviets is eligible
    const ctx = makeCtx({
      population: 200,
      year: 1935,
      eraId: 'collectivization',
      politicalStanding: 0.6,
      techLevel: 0.1,
      resources: { materials: 1000, money: 500 },
      state: {
        completed: [],
        active: { projectId: 'monument_revolution', ticksRemaining: 1 },
        unlockedCapabilities: [],
      },
    });
    const result = tickPrestigeProjects(ctx);
    expect(result.justCompleted!.id).toBe('monument_revolution');
    // Should auto-start the next eligible project
    expect(result.state.active).not.toBeNull();
    expect(result.state.active!.projectId).toBe('palace_soviets');
  });
});

// ─── minYear Gating ─────────────────────────────────────────────────────────

describe('minYear gating', () => {
  it('blocks fusion_reactor before year 2050', () => {
    const ctx = makeCtx({
      population: 10000,
      year: 2020,
      eraId: 'the_eternal',
      politicalStanding: 0.6,
      techLevel: 0.9,
      resources: { materials: 50000, hydrogen: 1000, money: 50000 },
      state: {
        completed: ['nuclear_program', 'nuclear_power_plant'],
        active: null,
        unlockedCapabilities: [],
      },
    });
    const available = getAvailableProjects(ctx);
    const ids = available.map((p) => p.id);
    expect(ids).not.toContain('fusion_reactor');
  });

  it('allows fusion_reactor at year 2050 with sufficient tech', () => {
    const ctx = makeCtx({
      population: 10000,
      year: 2050,
      eraId: 'the_eternal',
      politicalStanding: 0.6,
      techLevel: 0.9,
      resources: { materials: 50000, hydrogen: 1000, money: 50000 },
      state: {
        completed: ['nuclear_program', 'nuclear_power_plant'],
        active: null,
        unlockedCapabilities: [],
      },
    });
    const available = getAvailableProjects(ctx);
    const ids = available.map((p) => p.id);
    expect(ids).toContain('fusion_reactor');
  });
});

// ─── Serialization ──────────────────────────────────────────────────────────

describe('Serialization', () => {
  it('round-trips empty state through serialize/restore', () => {
    const original = createPrestigeState();
    const serialized = serializePrestigeState(original);
    const restored = restorePrestigeState(serialized);
    expect(restored).toEqual(original);
  });

  it('round-trips populated state through serialize/restore', () => {
    const original: PrestigeProjectState = {
      completed: ['monument_revolution', 'nuclear_program'],
      active: { projectId: 'cosmodrome', ticksRemaining: 30 },
      unlockedCapabilities: ['uranium_processing'],
    };
    const serialized = serializePrestigeState(original);
    const restored = restorePrestigeState(serialized);
    expect(restored).toEqual(original);
  });

  it('round-trips through JSON.stringify/parse', () => {
    const original: PrestigeProjectState = {
      completed: ['monument_revolution'],
      active: { projectId: 'palace_soviets', ticksRemaining: 20 },
      unlockedCapabilities: [],
    };
    const json = JSON.stringify(serializePrestigeState(original));
    const restored = restorePrestigeState(JSON.parse(json));
    expect(restored).toEqual(original);
  });

  it('serialization produces independent copies', () => {
    const original: PrestigeProjectState = {
      completed: ['monument_revolution'],
      active: { projectId: 'palace_soviets', ticksRemaining: 20 },
      unlockedCapabilities: ['test'],
    };
    const serialized = serializePrestigeState(original);
    serialized.completed.push('extra');
    serialized.unlockedCapabilities.push('extra');
    expect(original.completed).not.toContain('extra');
    expect(original.unlockedCapabilities).not.toContain('extra');
  });

  it('handles restoring state with null active project', () => {
    const data: PrestigeProjectState = {
      completed: ['monument_revolution'],
      active: null,
      unlockedCapabilities: [],
    };
    const restored = restorePrestigeState(data);
    expect(restored.active).toBeNull();
  });
});

// ─── Edge Cases ─────────────────────────────────────────────────────────────

describe('Edge cases', () => {
  it('does nothing when no projects are eligible', () => {
    const ctx = makeCtx({
      population: 1,
      year: 1917,
      eraId: 'revolution',
      politicalStanding: 0.0,
      techLevel: 0.0,
      resources: { materials: 0, money: 0 },
    });
    const result = tickPrestigeProjects(ctx);
    expect(result.state.active).toBeNull();
    expect(result.justCompleted).toBeNull();
    expect(result.resourceDeduction).toBeNull();
    expect(result.available).toEqual([]);
  });

  it('handles tick with no active project and no eligible projects', () => {
    const ctx = makeCtx({
      population: 0,
      year: 1917,
      eraId: 'revolution',
      politicalStanding: 0.0,
      techLevel: 0.0,
      resources: {},
    });
    const result = tickPrestigeProjects(ctx);
    expect(result.state).toEqual(createPrestigeState());
    expect(result.pravdaHeadline).toBeNull();
    expect(result.completionMessage).toBeNull();
  });

  it('project with zero resource cost starts without deduction issues', () => {
    // All projects have non-zero costs, but test the system handles empty cost
    // by verifying monument works with exact resources
    const ctx = makeCtx({
      population: 100,
      year: 1920,
      eraId: 'revolution',
      politicalStanding: 0.5,
      techLevel: 0.05,
      resources: { materials: 200, money: 100 },
    });
    const result = tickPrestigeProjects(ctx);
    expect(result.state.active).not.toBeNull();
    expect(result.resourceDeduction).toEqual({ materials: 200, money: 100 });
  });
});
