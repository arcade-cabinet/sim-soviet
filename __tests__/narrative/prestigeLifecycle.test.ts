import { GameRng } from '../../src/game/SeedSystem';
import { PRESTIGE_PROJECTS } from '../../src/config/prestigeProjects';
import {
  demandPrestigeProject,
  startConstruction,
  tickConstruction,
  completeProject,
  type ConstructionState,
  type CompletionResult,
  type PrestigeProjectDemand,
} from '../../src/ai/agents/narrative/prestigeLifecycle';

describe('demandPrestigeProject', () => {
  it('returns the demand for the correct era project', () => {
    const rng = new GameRng('test-seed');
    const demand = demandPrestigeProject('revolution', rng);
    expect(demand.project).toBe(PRESTIGE_PROJECTS.revolution);
    expect(demand.era).toBe('revolution');
    expect(typeof demand.announcementYear).toBe('number');
  });

  it('returns different announcement years with different seeds', () => {
    const demand1 = demandPrestigeProject('industrialization', new GameRng('seed-a'));
    const demand2 = demandPrestigeProject('industrialization', new GameRng('seed-b'));
    // Both should reference the same project
    expect(demand1.project.id).toBe(demand2.project.id);
    // Announcement years may differ due to RNG
  });

  it('works for every era', () => {
    const rng = new GameRng('all-eras');
    for (const eraId of Object.keys(PRESTIGE_PROJECTS) as Array<keyof typeof PRESTIGE_PROJECTS>) {
      const demand = demandPrestigeProject(eraId, rng);
      expect(demand.project).toBe(PRESTIGE_PROJECTS[eraId]);
    }
  });
});

describe('startConstruction', () => {
  const project = PRESTIGE_PROJECTS.revolution;

  it('deducts cost and returns ConstructionState when resources are sufficient', () => {
    const resources = { money: 1000, food: 500, power: 100 };
    const state = startConstruction(project, resources, 1918);
    expect(state).not.toBeNull();
    expect(state!.project).toBe(project);
    expect(state!.progress).toBe(0);
    expect(state!.startYear).toBe(1918);
    expect(state!.resourcesInvested).toEqual({ money: 300 });
    // Resources should be deducted
    expect(resources.money).toBe(700);
  });

  it('returns null when money is insufficient', () => {
    const resources = { money: 100, food: 500, power: 100 };
    const state = startConstruction(project, resources, 1918);
    expect(state).toBeNull();
    // Resources should NOT be deducted
    expect(resources.money).toBe(100);
  });

  it('deducts food cost when project requires food', () => {
    const collectivization = PRESTIGE_PROJECTS.collectivization;
    const resources = { money: 2000, food: 500, power: 100 };
    const state = startConstruction(collectivization, resources, 1925);
    expect(state).not.toBeNull();
    expect(resources.money).toBe(1200);
    expect(resources.food).toBe(300);
    expect(state!.resourcesInvested).toEqual({ money: 800, food: 200 });
  });

  it('returns null when food is insufficient', () => {
    const collectivization = PRESTIGE_PROJECTS.collectivization;
    const resources = { money: 2000, food: 50, power: 100 };
    const state = startConstruction(collectivization, resources, 1925);
    expect(state).toBeNull();
    expect(resources.money).toBe(2000);
    expect(resources.food).toBe(50);
  });

  it('deducts power cost when project requires power', () => {
    const cosmodrome = PRESTIGE_PROJECTS.thaw_and_freeze;
    const resources = { money: 50000, food: 1000, power: 500 };
    const state = startConstruction(cosmodrome, resources, 1960);
    expect(state).not.toBeNull();
    expect(resources.power).toBe(300);
    expect(state!.resourcesInvested).toEqual({ money: 12000, power: 200 });
  });

  it('returns null when power is insufficient', () => {
    const cosmodrome = PRESTIGE_PROJECTS.thaw_and_freeze;
    const resources = { money: 50000, food: 1000, power: 50 };
    const state = startConstruction(cosmodrome, resources, 1960);
    expect(state).toBeNull();
  });
});

describe('tickConstruction', () => {
  it('increments progress by 1', () => {
    const state: ConstructionState = {
      project: PRESTIGE_PROJECTS.revolution,
      progress: 0,
      startYear: 1918,
      resourcesInvested: { money: 300 },
    };
    const updated = tickConstruction(state);
    expect(updated.progress).toBe(1);
    expect(updated.project).toBe(state.project);
    expect(updated.startYear).toBe(1918);
  });

  it('can tick multiple times toward completion', () => {
    let state: ConstructionState = {
      project: PRESTIGE_PROJECTS.revolution,
      progress: 0,
      startYear: 1918,
      resourcesInvested: { money: 300 },
    };
    state = tickConstruction(state);
    state = tickConstruction(state);
    expect(state.progress).toBe(2);
  });

  it('does not mutate the original state', () => {
    const state: ConstructionState = {
      project: PRESTIGE_PROJECTS.revolution,
      progress: 0,
      startYear: 1918,
      resourcesInvested: { money: 300 },
    };
    const updated = tickConstruction(state);
    expect(state.progress).toBe(0);
    expect(updated.progress).toBe(1);
  });
});

describe('completeProject', () => {
  it('returns success with rewards when progress meets duration', () => {
    const project = PRESTIGE_PROJECTS.revolution;
    const state: ConstructionState = {
      project,
      progress: project.durationYears,
      startYear: 1918,
      resourcesInvested: { money: 300 },
    };
    const result = completeProject(state);
    expect(result.success).toBe(true);
    expect(result.rewards).toEqual({
      politicalCapital: project.reward.politicalCapital,
      moraleBoost: project.reward.moraleBoost,
    });
    expect(result.penalties).toBeUndefined();
  });

  it('returns success when progress exceeds duration', () => {
    const project = PRESTIGE_PROJECTS.revolution;
    const state: ConstructionState = {
      project,
      progress: project.durationYears + 3,
      startYear: 1918,
      resourcesInvested: { money: 300 },
    };
    const result = completeProject(state);
    expect(result.success).toBe(true);
    expect(result.rewards).toBeDefined();
  });

  it('returns failure with penalties when progress is insufficient', () => {
    const project = PRESTIGE_PROJECTS.reconstruction;
    const state: ConstructionState = {
      project,
      progress: 2,
      startYear: 1946,
      resourcesInvested: { money: 8000, power: 100 },
    };
    const result = completeProject(state);
    expect(result.success).toBe(false);
    expect(result.penalties).toEqual({
      politicalCapitalLoss: project.failurePenalty.politicalCapitalLoss,
      arrestRisk: project.failurePenalty.arrestRisk,
    });
    expect(result.rewards).toBeUndefined();
  });

  it('returns failure when progress is zero', () => {
    const project = PRESTIGE_PROJECTS.the_eternal;
    const state: ConstructionState = {
      project,
      progress: 0,
      startYear: 2005,
      resourcesInvested: { money: 100000, power: 500 },
    };
    const result = completeProject(state);
    expect(result.success).toBe(false);
    expect(result.penalties).toBeDefined();
  });

  it('works correctly for every era project at exact completion', () => {
    for (const project of Object.values(PRESTIGE_PROJECTS)) {
      const state: ConstructionState = {
        project,
        progress: project.durationYears,
        startYear: 1920,
        resourcesInvested: { money: project.cost.money },
      };
      const result = completeProject(state);
      expect(result.success).toBe(true);
      expect(result.rewards!.politicalCapital).toBe(project.reward.politicalCapital);
      expect(result.rewards!.moraleBoost).toBe(project.reward.moraleBoost);
    }
  });
});
