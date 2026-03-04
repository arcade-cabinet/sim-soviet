import { ERA_ORDER } from '../../src/game/era/definitions';
import type { EraId } from '../../src/game/era/types';
import {
  PRESTIGE_PROJECTS,
  getPrestigeProject,
  type PrestigeProject,
} from '../../src/config/prestigeProjects';

describe('PRESTIGE_PROJECTS', () => {
  it('has exactly one project per era', () => {
    const keys = Object.keys(PRESTIGE_PROJECTS);
    expect(keys).toHaveLength(ERA_ORDER.length);
    for (const eraId of ERA_ORDER) {
      expect(PRESTIGE_PROJECTS).toHaveProperty(eraId);
    }
  });

  it('every project has a unique id', () => {
    const ids = Object.values(PRESTIGE_PROJECTS).map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every project has required fields with correct types', () => {
    for (const [eraId, project] of Object.entries(PRESTIGE_PROJECTS)) {
      expect(typeof project.id).toBe('string');
      expect(project.id.length).toBeGreaterThan(0);

      expect(typeof project.name).toBe('string');
      expect(project.name.length).toBeGreaterThan(0);

      expect(project.era).toBe(eraId);

      expect(typeof project.cost.money).toBe('number');
      expect(project.cost.money).toBeGreaterThan(0);

      expect(typeof project.durationYears).toBe('number');
      expect(project.durationYears).toBeGreaterThanOrEqual(1);

      expect(Array.isArray(project.requiredBuildings)).toBe(true);

      expect(typeof project.reward.politicalCapital).toBe('number');
      expect(typeof project.reward.moraleBoost).toBe('number');

      expect(typeof project.failurePenalty.politicalCapitalLoss).toBe('number');
      expect(typeof project.failurePenalty.arrestRisk).toBe('number');
      expect(project.failurePenalty.arrestRisk).toBeGreaterThanOrEqual(0);
      expect(project.failurePenalty.arrestRisk).toBeLessThanOrEqual(1);
    }
  });

  it('projects escalate in cost across eras', () => {
    const costs = ERA_ORDER.map((eraId) => PRESTIGE_PROJECTS[eraId].cost.money);
    for (let i = 1; i < costs.length; i++) {
      expect(costs[i]).toBeGreaterThanOrEqual(costs[i - 1]!);
    }
  });

  it('arrest risk increases for later eras', () => {
    const first = PRESTIGE_PROJECTS[ERA_ORDER[0]!];
    const last = PRESTIGE_PROJECTS[ERA_ORDER[ERA_ORDER.length - 1]!];
    expect(last.failurePenalty.arrestRisk).toBeGreaterThanOrEqual(
      first.failurePenalty.arrestRisk,
    );
  });

  describe('specific era projects', () => {
    it('revolution: Monument to Revolution is cheap and symbolic', () => {
      const p = PRESTIGE_PROJECTS.revolution;
      expect(p.name).toBe('Monument to Revolution');
      expect(p.cost.money).toBeLessThanOrEqual(500);
      expect(p.durationYears).toBeLessThanOrEqual(2);
    });

    it('collectivization: Grain Elevator Complex is moderate', () => {
      const p = PRESTIGE_PROJECTS.collectivization;
      expect(p.name).toBe('Grain Elevator Complex');
      expect(p.requiredBuildings).toContain('collective-farm-hq');
    });

    it('industrialization: Grand Factory Complex is expensive', () => {
      const p = PRESTIGE_PROJECTS.industrialization;
      expect(p.name).toBe('Grand Factory Complex');
      expect(p.cost.money).toBeGreaterThanOrEqual(2000);
    });

    it('great_patriotic: Victory Memorial is moderate and morale-focused', () => {
      const p = PRESTIGE_PROJECTS.great_patriotic;
      expect(p.name).toBe('Victory Memorial');
      expect(p.reward.moraleBoost).toBeGreaterThan(0);
    });

    it('reconstruction: Palace of Soviets is very expensive', () => {
      const p = PRESTIGE_PROJECTS.reconstruction;
      expect(p.name).toBe('Palace of Soviets');
      expect(p.cost.money).toBeGreaterThanOrEqual(5000);
    });

    it('thaw_and_freeze: Cosmodrome is high-tech', () => {
      const p = PRESTIGE_PROJECTS.thaw_and_freeze;
      expect(p.name).toBe('Cosmodrome');
      expect(p.cost.power).toBeGreaterThan(0);
    });

    it('stagnation: Olympic Village is sprawling', () => {
      const p = PRESTIGE_PROJECTS.stagnation;
      expect(p.name).toBe('Olympic Village');
      expect(p.requiredBuildings.length).toBeGreaterThanOrEqual(2);
    });

    it('the_eternal: Space Elevator is absurdly expensive', () => {
      const p = PRESTIGE_PROJECTS.the_eternal;
      expect(p.name).toBe('Space Elevator');
      expect(p.cost.money).toBeGreaterThanOrEqual(50000);
    });
  });
});

describe('getPrestigeProject', () => {
  it('returns the correct project for each era', () => {
    for (const eraId of ERA_ORDER) {
      const project = getPrestigeProject(eraId);
      expect(project).toBe(PRESTIGE_PROJECTS[eraId]);
    }
  });

  it('returns undefined for an invalid era', () => {
    const result = getPrestigeProject('nonexistent' as EraId);
    expect(result).toBeUndefined();
  });
});
