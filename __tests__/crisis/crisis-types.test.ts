/**
 * @fileoverview Tests for crisis agent type contracts.
 *
 * Validates type structure, interface compliance, default values,
 * and the emptyCrisisImpact helper.
 */

import { GameRng } from '@/game/SeedSystem';
import {
  emptyCrisisImpact,
  DEFAULT_PEAK_PARAMS,
} from '@/ai/agents/crisis/types';
import type {
  CrisisImpact,
  CrisisDefinition,
  CrisisContext,
  CrisisPhase,
  CrisisSeverity,
  CrisisType,
  ICrisisAgent,
  CrisisAgentSaveData,
} from '@/ai/agents/crisis/types';

// ─── Fixtures ───────────────────────────────────────────────────────────────

const WW2_DEFINITION: CrisisDefinition = {
  id: 'ww2',
  type: 'war',
  name: 'Great Patriotic War',
  startYear: 1941,
  endYear: 1945,
  severity: 'existential',
  peakParams: { conscriptionRate: 0.15, productionPenalty: 0.6 },
  buildupTicks: 12,
  aftermathTicks: 24,
};

const HOLODOMOR_DEFINITION: CrisisDefinition = {
  id: 'holodomor',
  type: 'famine',
  name: 'Holodomor',
  startYear: 1932,
  endYear: 1933,
  severity: 'national',
  peakParams: { starvationRate: 0.3, foodConfiscation: 0.9 },
  buildupTicks: 8,
  aftermathTicks: 16,
};

const CHERNOBYL_DEFINITION: CrisisDefinition = {
  id: 'chernobyl',
  type: 'disaster',
  name: 'Chernobyl Disaster',
  startYear: 1986,
  endYear: 1987,
  severity: 'regional',
  peakParams: { radiationLevel: 1.0 },
  buildupTicks: 0,
  aftermathTicks: 48,
};

function makeContext(overrides?: Partial<CrisisContext>): CrisisContext {
  return {
    year: 1941,
    month: 6,
    population: 5000,
    food: 1000,
    money: 500,
    rng: new GameRng('test-seed'),
    activeCrises: [],
    ...overrides,
  };
}

// ─── CrisisDefinition ──────────────────────────────────────────────────────

describe('CrisisDefinition', () => {
  it('holds all required fields for a war crisis', () => {
    expect(WW2_DEFINITION.id).toBe('ww2');
    expect(WW2_DEFINITION.type).toBe('war');
    expect(WW2_DEFINITION.name).toBe('Great Patriotic War');
    expect(WW2_DEFINITION.startYear).toBe(1941);
    expect(WW2_DEFINITION.endYear).toBe(1945);
    expect(WW2_DEFINITION.severity).toBe('existential');
    expect(WW2_DEFINITION.buildupTicks).toBe(12);
    expect(WW2_DEFINITION.aftermathTicks).toBe(24);
  });

  it('holds all required fields for a famine crisis', () => {
    expect(HOLODOMOR_DEFINITION.type).toBe('famine');
    expect(HOLODOMOR_DEFINITION.severity).toBe('national');
    expect(HOLODOMOR_DEFINITION.peakParams).toEqual({
      starvationRate: 0.3,
      foodConfiscation: 0.9,
    });
  });

  it('holds all required fields for a disaster crisis', () => {
    expect(CHERNOBYL_DEFINITION.type).toBe('disaster');
    expect(CHERNOBYL_DEFINITION.buildupTicks).toBe(0);
    expect(CHERNOBYL_DEFINITION.aftermathTicks).toBe(48);
  });

  it('supports arbitrary peakParams keys', () => {
    const def: CrisisDefinition = {
      ...WW2_DEFINITION,
      peakParams: { customParam: 42, another: 0.5 },
    };
    expect(def.peakParams['customParam']).toBe(42);
    expect(def.peakParams['another']).toBe(0.5);
  });
});

// ─── CrisisType ─────────────────────────────────────────────────────────────

describe('CrisisType', () => {
  it('accepts all three crisis types', () => {
    const types: CrisisType[] = ['war', 'famine', 'disaster'];
    expect(types).toHaveLength(3);
    expect(types).toContain('war');
    expect(types).toContain('famine');
    expect(types).toContain('disaster');
  });
});

// ─── CrisisSeverity ─────────────────────────────────────────────────────────

describe('CrisisSeverity', () => {
  it('accepts all four severity levels', () => {
    const levels: CrisisSeverity[] = ['localized', 'regional', 'national', 'existential'];
    expect(levels).toHaveLength(4);
  });
});

// ─── CrisisPhase ────────────────────────────────────────────────────────────

describe('CrisisPhase', () => {
  it('covers all four lifecycle phases', () => {
    const phases: CrisisPhase[] = ['buildup', 'peak', 'aftermath', 'resolved'];
    expect(phases).toHaveLength(4);
  });
});

// ─── CrisisContext ──────────────────────────────────────────────────────────

describe('CrisisContext', () => {
  it('contains all required game state fields', () => {
    const ctx = makeContext();
    expect(ctx.year).toBe(1941);
    expect(ctx.month).toBe(6);
    expect(ctx.population).toBe(5000);
    expect(ctx.food).toBe(1000);
    expect(ctx.money).toBe(500);
    expect(ctx.rng).toBeInstanceOf(GameRng);
    expect(ctx.activeCrises).toEqual([]);
  });

  it('accepts active crises from other agents', () => {
    const ctx = makeContext({ activeCrises: ['ww2', 'holodomor'] });
    expect(ctx.activeCrises).toEqual(['ww2', 'holodomor']);
  });

  it('uses seeded RNG for deterministic results', () => {
    const ctx1 = makeContext();
    const ctx2 = makeContext();
    expect(ctx1.rng.random()).toBe(ctx2.rng.random());
  });
});

// ─── CrisisImpact ───────────────────────────────────────────────────────────

describe('CrisisImpact', () => {
  it('requires only crisisId — all slots are optional', () => {
    const impact: CrisisImpact = { crisisId: 'ww2' };
    expect(impact.crisisId).toBe('ww2');
    expect(impact.economy).toBeUndefined();
    expect(impact.workforce).toBeUndefined();
    expect(impact.infrastructure).toBeUndefined();
    expect(impact.political).toBeUndefined();
    expect(impact.social).toBeUndefined();
    expect(impact.narrative).toBeUndefined();
  });

  it('supports economy slot with all fields', () => {
    const impact: CrisisImpact = {
      crisisId: 'ww2',
      economy: { productionMult: 0.6, foodDelta: -50, moneyDelta: -100 },
    };
    expect(impact.economy!.productionMult).toBe(0.6);
    expect(impact.economy!.foodDelta).toBe(-50);
    expect(impact.economy!.moneyDelta).toBe(-100);
  });

  it('supports workforce slot with all fields', () => {
    const impact: CrisisImpact = {
      crisisId: 'ww2',
      workforce: { conscriptionCount: 200, casualtyCount: 10, moraleModifier: -0.3 },
    };
    expect(impact.workforce!.conscriptionCount).toBe(200);
    expect(impact.workforce!.casualtyCount).toBe(10);
    expect(impact.workforce!.moraleModifier).toBe(-0.3);
  });

  it('supports infrastructure slot with destruction targets', () => {
    const targets = [{ gridX: 5, gridY: 10 }, { gridX: 12, gridY: 3 }];
    const impact: CrisisImpact = {
      crisisId: 'ww2',
      infrastructure: { decayMult: 2.0, destructionTargets: targets },
    };
    expect(impact.infrastructure!.decayMult).toBe(2.0);
    expect(impact.infrastructure!.destructionTargets).toHaveLength(2);
    expect(impact.infrastructure!.destructionTargets![0]).toEqual({ gridX: 5, gridY: 10 });
  });

  it('supports political slot', () => {
    const impact: CrisisImpact = {
      crisisId: 'purge',
      political: { kgbAggressionMult: 3.0, quotaMult: 1.5 },
    };
    expect(impact.political!.kgbAggressionMult).toBe(3.0);
    expect(impact.political!.quotaMult).toBe(1.5);
  });

  it('supports social slot', () => {
    const impact: CrisisImpact = {
      crisisId: 'holodomor',
      social: { diseaseMult: 2.0, growthMult: 0.3 },
    };
    expect(impact.social!.diseaseMult).toBe(2.0);
    expect(impact.social!.growthMult).toBe(0.3);
  });

  it('supports narrative slot with headlines and toasts', () => {
    const impact: CrisisImpact = {
      crisisId: 'ww2',
      narrative: {
        pravdaHeadlines: ['FASCIST INVADERS REPELLED AT STALINGRAD'],
        toastMessages: [
          { text: 'Air raid warning!', severity: 'critical' },
          { text: 'Citizens evacuating...' },
        ],
      },
    };
    expect(impact.narrative!.pravdaHeadlines).toHaveLength(1);
    expect(impact.narrative!.toastMessages).toHaveLength(2);
    expect(impact.narrative!.toastMessages![0]!.severity).toBe('critical');
    expect(impact.narrative!.toastMessages![1]!.severity).toBeUndefined();
  });

  it('supports multiple domains in a single impact', () => {
    const impact: CrisisImpact = {
      crisisId: 'ww2',
      economy: { productionMult: 0.7 },
      workforce: { conscriptionCount: 100 },
      political: { quotaMult: 1.5 },
      narrative: { pravdaHeadlines: ['WAR!'] },
    };
    expect(impact.economy).toBeDefined();
    expect(impact.workforce).toBeDefined();
    expect(impact.political).toBeDefined();
    expect(impact.narrative).toBeDefined();
  });
});

// ─── emptyCrisisImpact ─────────────────────────────────────────────────────

describe('emptyCrisisImpact', () => {
  it('creates an impact with only the crisisId set', () => {
    const impact = emptyCrisisImpact('ww2');
    expect(impact.crisisId).toBe('ww2');
    expect(impact.economy).toBeUndefined();
    expect(impact.workforce).toBeUndefined();
    expect(impact.infrastructure).toBeUndefined();
    expect(impact.political).toBeUndefined();
    expect(impact.social).toBeUndefined();
    expect(impact.narrative).toBeUndefined();
  });

  it('returns a distinct object each call', () => {
    const a = emptyCrisisImpact('a');
    const b = emptyCrisisImpact('b');
    expect(a).not.toBe(b);
    expect(a.crisisId).toBe('a');
    expect(b.crisisId).toBe('b');
  });
});

// ─── DEFAULT_PEAK_PARAMS ────────────────────────────────────────────────────

describe('DEFAULT_PEAK_PARAMS', () => {
  it('is an empty frozen object', () => {
    expect(Object.keys(DEFAULT_PEAK_PARAMS)).toHaveLength(0);
    expect(Object.isFrozen(DEFAULT_PEAK_PARAMS)).toBe(true);
  });

  it('silently rejects mutations (frozen)', () => {
    (DEFAULT_PEAK_PARAMS as Record<string, number>)['foo'] = 1;
    // In sloppy mode, assignment silently fails on frozen objects
    expect(DEFAULT_PEAK_PARAMS).not.toHaveProperty('foo');
  });
});

// ─── ICrisisAgent interface compliance ──────────────────────────────────────

describe('ICrisisAgent', () => {
  it('can be implemented as a mock agent', () => {
    const mockAgent: ICrisisAgent = {
      configure: jest.fn(),
      evaluate: jest.fn().mockReturnValue([]),
      isActive: jest.fn().mockReturnValue(false),
      getPhase: jest.fn().mockReturnValue('resolved' as CrisisPhase),
      serialize: jest.fn().mockReturnValue({
        definition: WW2_DEFINITION,
        phase: 'resolved' as CrisisPhase,
        ticksInPhase: 0,
      }),
      restore: jest.fn(),
    };

    // configure
    mockAgent.configure(WW2_DEFINITION);
    expect(mockAgent.configure).toHaveBeenCalledWith(WW2_DEFINITION);

    // evaluate returns empty when resolved
    const ctx = makeContext();
    const impacts = mockAgent.evaluate(ctx);
    expect(impacts).toEqual([]);

    // state queries
    expect(mockAgent.isActive()).toBe(false);
    expect(mockAgent.getPhase()).toBe('resolved');

    // serialize/restore round-trip
    const saved = mockAgent.serialize();
    expect(saved.definition.id).toBe('ww2');
    expect(saved.phase).toBe('resolved');
    mockAgent.restore(saved);
    expect(mockAgent.restore).toHaveBeenCalledWith(saved);
  });

  it('can produce impacts during active phase', () => {
    const warImpact: CrisisImpact = {
      crisisId: 'ww2',
      economy: { productionMult: 0.6 },
      workforce: { conscriptionCount: 150, moraleModifier: -0.2 },
    };

    const mockAgent: ICrisisAgent = {
      configure: jest.fn(),
      evaluate: jest.fn().mockReturnValue([warImpact]),
      isActive: jest.fn().mockReturnValue(true),
      getPhase: jest.fn().mockReturnValue('peak' as CrisisPhase),
      serialize: jest.fn().mockReturnValue({
        definition: WW2_DEFINITION,
        phase: 'peak' as CrisisPhase,
        ticksInPhase: 50,
      }),
      restore: jest.fn(),
    };

    expect(mockAgent.isActive()).toBe(true);
    expect(mockAgent.getPhase()).toBe('peak');

    const impacts = mockAgent.evaluate(makeContext());
    expect(impacts).toHaveLength(1);
    expect(impacts[0]!.crisisId).toBe('ww2');
    expect(impacts[0]!.economy!.productionMult).toBe(0.6);
    expect(impacts[0]!.workforce!.conscriptionCount).toBe(150);
  });
});

// ─── CrisisAgentSaveData ────────────────────────────────────────────────────

describe('CrisisAgentSaveData', () => {
  it('serializes minimum required fields', () => {
    const save: CrisisAgentSaveData = {
      definition: WW2_DEFINITION,
      phase: 'buildup',
      ticksInPhase: 5,
    };
    expect(save.definition.id).toBe('ww2');
    expect(save.phase).toBe('buildup');
    expect(save.ticksInPhase).toBe(5);
    expect(save.extra).toBeUndefined();
  });

  it('supports agent-specific extra state', () => {
    const save: CrisisAgentSaveData = {
      definition: CHERNOBYL_DEFINITION,
      phase: 'aftermath',
      ticksInPhase: 30,
      extra: { radiationDecay: 0.95, evacuatedZones: [3, 7, 12] },
    };
    expect(save.extra!['radiationDecay']).toBe(0.95);
    expect(save.extra!['evacuatedZones']).toEqual([3, 7, 12]);
  });

  it('round-trips through JSON serialization', () => {
    const original: CrisisAgentSaveData = {
      definition: HOLODOMOR_DEFINITION,
      phase: 'peak',
      ticksInPhase: 20,
      extra: { grainConfiscated: 5000 },
    };
    const json = JSON.stringify(original);
    const restored: CrisisAgentSaveData = JSON.parse(json);
    expect(restored).toEqual(original);
  });
});
