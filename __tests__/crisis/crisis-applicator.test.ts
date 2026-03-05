/**
 * @fileoverview Tests for CrisisImpactApplicator.
 *
 * Validates each impact slot in isolation, combined impacts,
 * resource floor clamping, worker system interactions,
 * building destruction, narrative callbacks, and neutral defaults.
 */

import { type ApplicatorDeps, applyCrisisImpacts } from '@/ai/agents/crisis/CrisisImpactApplicator';
import type { CrisisImpact } from '@/ai/agents/crisis/types';
import { clearCrisisVFX, getActiveVFX } from '@/stores/gameStore';

// ─── Test Helpers ──────────────────────────────────────────────────────────

function makeDeps(overrides?: Partial<ApplicatorDeps>): ApplicatorDeps {
  return {
    resources: { food: 1000, money: 500, vodka: 200, population: 100 },
    callbacks: {
      onPravda: jest.fn(),
      onToast: jest.fn(),
    },
    workerSystem: {
      removeWorkersByCountMaleFirst: jest.fn().mockImplementation((count: number) => count),
      spawnInflowDvor: jest.fn(),
    },
    kgbAgent: {
      addMark: jest.fn(),
    },
    buildings: [
      { gridX: 0, gridY: 0, type: 'farm' },
      { gridX: 1, gridY: 1, type: 'factory' },
      { gridX: 2, gridY: 2, type: 'housing' },
      { gridX: 3, gridY: 3, type: 'barracks' },
    ],
    rng: {
      int: jest.fn().mockImplementation((min: number, _max: number) => min),
      random: jest.fn().mockReturnValue(0.5),
    },
    totalTicks: 100,
    ...overrides,
  };
}

// ─── Empty Impacts ─────────────────────────────────────────────────────────

describe('applyCrisisImpacts — empty impacts', () => {
  it('returns neutral result when impacts array is empty', () => {
    const deps = makeDeps();
    const result = applyCrisisImpacts([], deps);

    expect(result.productionMult).toBe(1.0);
    expect(result.decayMult).toBe(1.0);
    expect(result.growthMult).toBe(1.0);
    expect(result.diseaseMult).toBe(1.0);
    expect(result.kgbAggressionMult).toBe(1.0);
    expect(result.quotaMult).toBe(1.0);
    expect(result.destroyedBuildings).toEqual([]);
    expect(result.workersLost).toBe(0);
    expect(result.workersGained).toBe(0);
  });

  it('does not call any callbacks with empty impacts', () => {
    const deps = makeDeps();
    applyCrisisImpacts([], deps);

    expect(deps.callbacks.onPravda).not.toHaveBeenCalled();
    expect(deps.callbacks.onToast).not.toHaveBeenCalled();
    expect(deps.workerSystem!.removeWorkersByCountMaleFirst).not.toHaveBeenCalled();
    expect(deps.workerSystem!.spawnInflowDvor).not.toHaveBeenCalled();
  });

  it('returns neutral result for impact with no slots', () => {
    const deps = makeDeps();
    const result = applyCrisisImpacts([{ crisisId: 'noop' }], deps);

    expect(result.productionMult).toBe(1.0);
    expect(result.decayMult).toBe(1.0);
    expect(result.workersLost).toBe(0);
    expect(result.workersGained).toBe(0);
  });
});

// ─── Economy Slot ──────────────────────────────────────────────────────────

describe('applyCrisisImpacts — economy', () => {
  it('applies foodDelta to resources', () => {
    const deps = makeDeps();
    const impact: CrisisImpact = {
      crisisId: 'famine',
      economy: { foodDelta: -200 },
    };

    applyCrisisImpacts([impact], deps);
    expect(deps.resources.food).toBe(800);
  });

  it('applies moneyDelta to resources', () => {
    const deps = makeDeps();
    const impact: CrisisImpact = {
      crisisId: 'war',
      economy: { moneyDelta: -300 },
    };

    applyCrisisImpacts([impact], deps);
    expect(deps.resources.money).toBe(200);
  });

  it('collects productionMult for return', () => {
    const deps = makeDeps();
    const impact: CrisisImpact = {
      crisisId: 'war',
      economy: { productionMult: 0.7 },
    };

    const result = applyCrisisImpacts([impact], deps);
    expect(result.productionMult).toBe(0.7);
  });

  it('clamps food to zero (never negative)', () => {
    const deps = makeDeps();
    deps.resources.food = 50;
    const impact: CrisisImpact = {
      crisisId: 'famine',
      economy: { foodDelta: -200 },
    };

    applyCrisisImpacts([impact], deps);
    expect(deps.resources.food).toBe(0);
  });

  it('clamps money to zero (never negative)', () => {
    const deps = makeDeps();
    deps.resources.money = 100;
    const impact: CrisisImpact = {
      crisisId: 'war',
      economy: { moneyDelta: -500 },
    };

    applyCrisisImpacts([impact], deps);
    expect(deps.resources.money).toBe(0);
  });

  it('applies positive food deltas', () => {
    const deps = makeDeps();
    const impact: CrisisImpact = {
      crisisId: 'relief',
      economy: { foodDelta: 100 },
    };

    applyCrisisImpacts([impact], deps);
    expect(deps.resources.food).toBe(1100);
  });
});

// ─── Workforce Slot ────────────────────────────────────────────────────────

describe('applyCrisisImpacts — workforce', () => {
  it('calls removeWorkersByCountMaleFirst for conscription', () => {
    const deps = makeDeps();
    const impact: CrisisImpact = {
      crisisId: 'ww2',
      workforce: { conscriptionCount: 50 },
    };

    const result = applyCrisisImpacts([impact], deps);
    expect(deps.workerSystem!.removeWorkersByCountMaleFirst).toHaveBeenCalledWith(50, 'crisis_conscription');
    expect(result.workersLost).toBe(50);
  });

  it('calls spawnInflowDvor for negative conscription (veteran return)', () => {
    const deps = makeDeps();
    const impact: CrisisImpact = {
      crisisId: 'ww2_aftermath',
      workforce: { conscriptionCount: -20 },
    };

    const result = applyCrisisImpacts([impact], deps);
    expect(deps.workerSystem!.spawnInflowDvor).toHaveBeenCalledWith(20, 'veteran_return');
    expect(result.workersGained).toBe(20);
    expect(deps.workerSystem!.removeWorkersByCountMaleFirst).not.toHaveBeenCalled();
  });

  it('calls removeWorkersByCountMaleFirst for casualties', () => {
    const deps = makeDeps();
    const impact: CrisisImpact = {
      crisisId: 'ww2',
      workforce: { casualtyCount: 10 },
    };

    const result = applyCrisisImpacts([impact], deps);
    expect(deps.workerSystem!.removeWorkersByCountMaleFirst).toHaveBeenCalledWith(10, 'crisis_casualty');
    expect(result.workersLost).toBe(10);
  });

  it('sums conscription and casualties in workersLost', () => {
    const deps = makeDeps();
    const impact: CrisisImpact = {
      crisisId: 'ww2',
      workforce: { conscriptionCount: 30, casualtyCount: 5 },
    };

    const result = applyCrisisImpacts([impact], deps);
    expect(result.workersLost).toBe(35);
  });

  it('skips workforce effects when workerSystem is undefined', () => {
    const deps = makeDeps({ workerSystem: undefined });
    const impact: CrisisImpact = {
      crisisId: 'ww2',
      workforce: { conscriptionCount: 50, casualtyCount: 10 },
    };

    const result = applyCrisisImpacts([impact], deps);
    expect(result.workersLost).toBe(0);
    expect(result.workersGained).toBe(0);
  });

  it('does not call workerSystem for zero conscription', () => {
    const deps = makeDeps();
    const impact: CrisisImpact = {
      crisisId: 'peacetime',
      workforce: { conscriptionCount: 0 },
    };

    applyCrisisImpacts([impact], deps);
    expect(deps.workerSystem!.removeWorkersByCountMaleFirst).not.toHaveBeenCalled();
    expect(deps.workerSystem!.spawnInflowDvor).not.toHaveBeenCalled();
  });
});

// ─── Infrastructure Slot ───────────────────────────────────────────────────

describe('applyCrisisImpacts — infrastructure', () => {
  it('collects decayMult for return', () => {
    const deps = makeDeps();
    const impact: CrisisImpact = {
      crisisId: 'war',
      infrastructure: { decayMult: 2.0 },
    };

    const result = applyCrisisImpacts([impact], deps);
    expect(result.decayMult).toBe(2.0);
  });

  it('returns destruction targets from the impact', () => {
    const deps = makeDeps();
    const impact: CrisisImpact = {
      crisisId: 'bombing',
      infrastructure: {
        destructionTargets: [
          { gridX: 1, gridY: 1 },
          { gridX: 3, gridY: 3 },
        ],
      },
    };

    const result = applyCrisisImpacts([impact], deps);
    expect(result.destroyedBuildings).toHaveLength(2);
    expect(result.destroyedBuildings).toContainEqual({ gridX: 1, gridY: 1 });
    expect(result.destroyedBuildings).toContainEqual({ gridX: 3, gridY: 3 });
  });

  it('handles empty destructionTargets array', () => {
    const deps = makeDeps();
    const impact: CrisisImpact = {
      crisisId: 'minor',
      infrastructure: { destructionTargets: [] },
    };

    const result = applyCrisisImpacts([impact], deps);
    expect(result.destroyedBuildings).toEqual([]);
  });
});

// ─── Political Slot ────────────────────────────────────────────────────────

describe('applyCrisisImpacts — political', () => {
  it('collects kgbAggressionMult for return', () => {
    const deps = makeDeps();
    const impact: CrisisImpact = {
      crisisId: 'purge',
      political: { kgbAggressionMult: 3.0 },
    };

    const result = applyCrisisImpacts([impact], deps);
    expect(result.kgbAggressionMult).toBe(3.0);
  });

  it('collects quotaMult for return', () => {
    const deps = makeDeps();
    const impact: CrisisImpact = {
      crisisId: 'five_year_plan',
      political: { quotaMult: 1.5 },
    };

    const result = applyCrisisImpacts([impact], deps);
    expect(result.quotaMult).toBe(1.5);
  });
});

// ─── Social Slot ───────────────────────────────────────────────────────────

describe('applyCrisisImpacts — social', () => {
  it('collects diseaseMult for return', () => {
    const deps = makeDeps();
    const impact: CrisisImpact = {
      crisisId: 'typhus',
      social: { diseaseMult: 2.5 },
    };

    const result = applyCrisisImpacts([impact], deps);
    expect(result.diseaseMult).toBe(2.5);
  });

  it('collects growthMult for return', () => {
    const deps = makeDeps();
    const impact: CrisisImpact = {
      crisisId: 'famine',
      social: { growthMult: 0.3 },
    };

    const result = applyCrisisImpacts([impact], deps);
    expect(result.growthMult).toBe(0.3);
  });
});

// ─── Narrative Slot ────────────────────────────────────────────────────────

describe('applyCrisisImpacts — narrative', () => {
  it('fires onPravda for each headline', () => {
    const deps = makeDeps();
    const impact: CrisisImpact = {
      crisisId: 'ww2',
      narrative: {
        pravdaHeadlines: ['FASCIST INVADERS REPELLED AT STALINGRAD', 'RED ARMY ADVANCES ON ALL FRONTS'],
      },
    };

    applyCrisisImpacts([impact], deps);
    expect(deps.callbacks.onPravda).toHaveBeenCalledTimes(2);
    expect(deps.callbacks.onPravda).toHaveBeenCalledWith('FASCIST INVADERS REPELLED AT STALINGRAD');
    expect(deps.callbacks.onPravda).toHaveBeenCalledWith('RED ARMY ADVANCES ON ALL FRONTS');
  });

  it('fires onToast for each toast message with severity', () => {
    const deps = makeDeps();
    const impact: CrisisImpact = {
      crisisId: 'bombing',
      narrative: {
        toastMessages: [
          { text: 'Air raid warning!', severity: 'critical' },
          { text: 'Citizens evacuating...' },
          { text: 'Shelter immediately!', severity: 'evacuation' },
        ],
      },
    };

    applyCrisisImpacts([impact], deps);
    expect(deps.callbacks.onToast).toHaveBeenCalledTimes(3);
    expect(deps.callbacks.onToast).toHaveBeenCalledWith('Air raid warning!', 'critical');
    expect(deps.callbacks.onToast).toHaveBeenCalledWith('Citizens evacuating...', undefined);
    expect(deps.callbacks.onToast).toHaveBeenCalledWith('Shelter immediately!', 'evacuation');
  });

  it('handles empty pravda and toast arrays', () => {
    const deps = makeDeps();
    const impact: CrisisImpact = {
      crisisId: 'quiet',
      narrative: { pravdaHeadlines: [], toastMessages: [] },
    };

    applyCrisisImpacts([impact], deps);
    expect(deps.callbacks.onPravda).not.toHaveBeenCalled();
    expect(deps.callbacks.onToast).not.toHaveBeenCalled();
  });
});

// ─── Combined Impacts ──────────────────────────────────────────────────────

describe('applyCrisisImpacts — combined impacts', () => {
  it('multiplies multipliers from multiple impacts', () => {
    const deps = makeDeps();
    const impacts: CrisisImpact[] = [
      {
        crisisId: 'ww2',
        economy: { productionMult: 0.7 },
        infrastructure: { decayMult: 1.5 },
        political: { kgbAggressionMult: 2.0, quotaMult: 1.3 },
        social: { diseaseMult: 1.5, growthMult: 0.8 },
      },
      {
        crisisId: 'famine',
        economy: { productionMult: 0.8 },
        infrastructure: { decayMult: 1.2 },
        political: { kgbAggressionMult: 1.5, quotaMult: 1.2 },
        social: { diseaseMult: 2.0, growthMult: 0.5 },
      },
    ];

    const result = applyCrisisImpacts(impacts, deps);

    expect(result.productionMult).toBeCloseTo(0.56, 5); // 0.7 * 0.8
    expect(result.decayMult).toBeCloseTo(1.8, 5); // 1.5 * 1.2
    expect(result.kgbAggressionMult).toBeCloseTo(3.0, 5); // 2.0 * 1.5
    expect(result.quotaMult).toBeCloseTo(1.56, 5); // 1.3 * 1.2
    expect(result.diseaseMult).toBeCloseTo(3.0, 5); // 1.5 * 2.0
    expect(result.growthMult).toBeCloseTo(0.4, 5); // 0.8 * 0.5
  });

  it('sums food and money deltas from multiple impacts', () => {
    const deps = makeDeps();
    const impacts: CrisisImpact[] = [
      { crisisId: 'ww2', economy: { foodDelta: -100, moneyDelta: -50 } },
      { crisisId: 'famine', economy: { foodDelta: -200, moneyDelta: -100 } },
    ];

    applyCrisisImpacts(impacts, deps);
    // First impact: food 1000-100=900, money 500-50=450
    // Second impact: food 900-200=700, money 450-100=350
    expect(deps.resources.food).toBe(700);
    expect(deps.resources.money).toBe(350);
  });

  it('sums workers lost from multiple impacts', () => {
    const deps = makeDeps();
    const impacts: CrisisImpact[] = [
      { crisisId: 'ww2', workforce: { conscriptionCount: 30, casualtyCount: 5 } },
      { crisisId: 'epidemic', workforce: { casualtyCount: 10 } },
    ];

    const result = applyCrisisImpacts(impacts, deps);
    expect(result.workersLost).toBe(45); // 30 + 5 + 10
  });

  it('accumulates destroyed buildings from multiple impacts', () => {
    const deps = makeDeps();
    const impacts: CrisisImpact[] = [
      {
        crisisId: 'bombing',
        infrastructure: { destructionTargets: [{ gridX: 0, gridY: 0 }] },
      },
      {
        crisisId: 'shelling',
        infrastructure: {
          destructionTargets: [
            { gridX: 2, gridY: 2 },
            { gridX: 3, gridY: 3 },
          ],
        },
      },
    ];

    const result = applyCrisisImpacts(impacts, deps);
    expect(result.destroyedBuildings).toHaveLength(3);
  });

  it('fires all narrative callbacks from multiple impacts', () => {
    const deps = makeDeps();
    const impacts: CrisisImpact[] = [
      {
        crisisId: 'ww2',
        narrative: {
          pravdaHeadlines: ['VICTORY AT STALINGRAD'],
          toastMessages: [{ text: 'Major victory!' }],
        },
      },
      {
        crisisId: 'famine',
        narrative: {
          pravdaHeadlines: ['HARVEST BELOW EXPECTATIONS'],
          toastMessages: [{ text: 'Food shortage!', severity: 'warning' }],
        },
      },
    ];

    applyCrisisImpacts(impacts, deps);
    expect(deps.callbacks.onPravda).toHaveBeenCalledTimes(2);
    expect(deps.callbacks.onToast).toHaveBeenCalledTimes(2);
  });

  it('handles simultaneous conscription and veteran return from different impacts', () => {
    const deps = makeDeps();
    const impacts: CrisisImpact[] = [
      { crisisId: 'ww2', workforce: { conscriptionCount: 50 } },
      { crisisId: 'ww2_aftermath', workforce: { conscriptionCount: -10 } },
    ];

    const result = applyCrisisImpacts(impacts, deps);
    expect(deps.workerSystem!.removeWorkersByCountMaleFirst).toHaveBeenCalledWith(50, 'crisis_conscription');
    expect(deps.workerSystem!.spawnInflowDvor).toHaveBeenCalledWith(10, 'veteran_return');
    expect(result.workersLost).toBe(50);
    expect(result.workersGained).toBe(10);
  });
});

// ─── Resource Floor Clamping ───────────────────────────────────────────────

describe('applyCrisisImpacts — resource floor clamping', () => {
  it('clamps food to zero across multiple impacts', () => {
    const deps = makeDeps();
    deps.resources.food = 150;
    const impacts: CrisisImpact[] = [
      { crisisId: 'famine1', economy: { foodDelta: -100 } },
      { crisisId: 'famine2', economy: { foodDelta: -200 } },
    ];

    applyCrisisImpacts(impacts, deps);
    // First: 150-100=50, Second: max(0, 50-200)=0
    expect(deps.resources.food).toBe(0);
  });

  it('clamps money to zero across multiple impacts', () => {
    const deps = makeDeps();
    deps.resources.money = 75;
    const impacts: CrisisImpact[] = [
      { crisisId: 'war1', economy: { moneyDelta: -50 } },
      { crisisId: 'war2', economy: { moneyDelta: -50 } },
    ];

    applyCrisisImpacts(impacts, deps);
    // First: 75-50=25, Second: max(0, 25-50)=0
    expect(deps.resources.money).toBe(0);
  });

  it('does not clamp positive deltas', () => {
    const deps = makeDeps();
    const impact: CrisisImpact = {
      crisisId: 'lend_lease',
      economy: { foodDelta: 500, moneyDelta: 300 },
    };

    applyCrisisImpacts([impact], deps);
    expect(deps.resources.food).toBe(1500);
    expect(deps.resources.money).toBe(800);
  });
});

// ─── Full Multi-Domain Impact ──────────────────────────────────────────────

describe('applyCrisisImpacts — full multi-domain impact', () => {
  it('processes all six domains in a single impact', () => {
    const deps = makeDeps();
    const impact: CrisisImpact = {
      crisisId: 'ww2',
      economy: { productionMult: 0.6, foodDelta: -100, moneyDelta: -50 },
      workforce: { conscriptionCount: 30, casualtyCount: 5 },
      infrastructure: {
        decayMult: 2.0,
        destructionTargets: [{ gridX: 1, gridY: 1 }],
      },
      political: { kgbAggressionMult: 2.5, quotaMult: 1.5 },
      social: { diseaseMult: 1.5, growthMult: 0.6 },
      narrative: {
        pravdaHeadlines: ['GREAT PATRIOTIC WAR BEGINS'],
        toastMessages: [{ text: 'Enemy at the gates!', severity: 'critical' }],
      },
    };

    const result = applyCrisisImpacts([impact], deps);

    // Economy
    expect(deps.resources.food).toBe(900);
    expect(deps.resources.money).toBe(450);
    expect(result.productionMult).toBe(0.6);

    // Workforce
    expect(result.workersLost).toBe(35);

    // Infrastructure
    expect(result.decayMult).toBe(2.0);
    expect(result.destroyedBuildings).toHaveLength(1);

    // Political
    expect(result.kgbAggressionMult).toBe(2.5);
    expect(result.quotaMult).toBe(1.5);

    // Social
    expect(result.diseaseMult).toBe(1.5);
    expect(result.growthMult).toBe(0.6);

    // Narrative
    expect(deps.callbacks.onPravda).toHaveBeenCalledWith('GREAT PATRIOTIC WAR BEGINS');
    expect(deps.callbacks.onToast).toHaveBeenCalledWith('Enemy at the gates!', 'critical');
  });
});

// ─── Visual Slot ──────────────────────────────────────────────────────────

describe('applyCrisisImpacts — visual effects', () => {
  beforeEach(() => {
    clearCrisisVFX();
  });

  afterEach(() => {
    clearCrisisVFX();
  });

  it('pushes meteor_flash VFX for visual impact', () => {
    const deps = makeDeps();
    const impact: CrisisImpact = {
      crisisId: 'disaster',
      visual: { effectType: 'meteor_flash', intensity: 1.0, duration: 2 },
    };

    applyCrisisImpacts([impact], deps);

    const vfx = getActiveVFX();
    expect(vfx).toHaveLength(1);
    expect(vfx[0].type).toBe('meteor_flash');
    expect(vfx[0].intensity).toBe(1.0);
    expect(vfx[0].duration).toBe(2);
  });

  it('pushes nuclear_haze VFX for radiation disasters', () => {
    const deps = makeDeps();
    const impact: CrisisImpact = {
      crisisId: 'chernobyl',
      visual: { effectType: 'nuclear_haze', intensity: 0.8, duration: 60 },
    };

    applyCrisisImpacts([impact], deps);

    const vfx = getActiveVFX();
    expect(vfx).toHaveLength(1);
    expect(vfx[0].type).toBe('nuclear_haze');
    expect(vfx[0].intensity).toBe(0.8);
    expect(vfx[0].duration).toBe(60);
  });

  it('pushes famine_desat VFX for famine crises', () => {
    const deps = makeDeps();
    const impact: CrisisImpact = {
      crisisId: 'holodomor',
      visual: { effectType: 'famine_desat', intensity: 0.85, duration: 30 },
    };

    applyCrisisImpacts([impact], deps);

    const vfx = getActiveVFX();
    expect(vfx).toHaveLength(1);
    expect(vfx[0].type).toBe('famine_desat');
    expect(vfx[0].intensity).toBe(0.85);
  });

  it('uses default duration when not specified', () => {
    const deps = makeDeps();
    const impact: CrisisImpact = {
      crisisId: 'test',
      visual: { effectType: 'meteor_flash' },
    };

    applyCrisisImpacts([impact], deps);

    const vfx = getActiveVFX();
    expect(vfx).toHaveLength(1);
    expect(vfx[0].duration).toBe(2); // Default for meteor_flash
  });

  it('uses default intensity when not specified', () => {
    const deps = makeDeps();
    const impact: CrisisImpact = {
      crisisId: 'test',
      visual: { effectType: 'nuclear_haze' },
    };

    applyCrisisImpacts([impact], deps);

    const vfx = getActiveVFX();
    expect(vfx).toHaveLength(1);
    expect(vfx[0].intensity).toBe(1.0); // Default intensity
    expect(vfx[0].duration).toBe(60); // Default for nuclear_haze
  });

  it('does not push VFX when visual slot is absent', () => {
    const deps = makeDeps();
    const impact: CrisisImpact = {
      crisisId: 'noop',
      economy: { productionMult: 0.9 },
    };

    applyCrisisImpacts([impact], deps);

    const vfx = getActiveVFX();
    expect(vfx).toHaveLength(0);
  });

  it('deduplicates VFX by type (restart on re-push)', () => {
    const deps = makeDeps();
    const impact1: CrisisImpact = {
      crisisId: 'disaster1',
      visual: { effectType: 'meteor_flash', intensity: 0.5, duration: 2 },
    };
    const impact2: CrisisImpact = {
      crisisId: 'disaster2',
      visual: { effectType: 'meteor_flash', intensity: 1.0, duration: 3 },
    };

    applyCrisisImpacts([impact1, impact2], deps);

    const vfx = getActiveVFX();
    expect(vfx).toHaveLength(1);
    expect(vfx[0].intensity).toBe(1.0); // Second impact replaces first
    expect(vfx[0].duration).toBe(3);
  });
});
