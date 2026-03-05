/**
 * Tests for Agent Parameter Matrix wiring.
 *
 * Verifies that each agent reads from its AgentParameterProfile
 * and adjusts behavior for different terrains (Earth vs Lunar vs Venusian).
 */

import {
  PROFILE_EARTH_TEMPERATE,
  PROFILE_LUNAR,
  PROFILE_VENUSIAN,
} from '../../src/game/engine/agentParameterMatrix';

// ─── FoodAgent ──────────────────────────────────────────────────────────────

// Mock ECS archetypes for FoodAgent
const mockProducers: Array<{
  building: {
    defId: string;
    powered: boolean;
    produces: { resource: string; amount: number } | null;
  };
}> = [];
const mockCitizens: Array<{ citizen: { assignment: string | null } }> = [];
const mockDvory: Array<{
  dvor: {
    id: string;
    members: Array<{ age: number; gender: string }>;
    privatePlotSize: number;
    privateLivestock: { cow: number; pig: number; sheep: number; poultry: number };
  };
}> = [];
let mockResources = { food: 0, vodka: 0, population: 10 };

jest.mock('../../src/ecs/archetypes', () => ({
  producers: { [Symbol.iterator]: () => mockProducers[Symbol.iterator]() },
  citizens: { [Symbol.iterator]: () => mockCitizens[Symbol.iterator]() },
  dvory: { [Symbol.iterator]: () => mockDvory[Symbol.iterator]() },
  getResourceEntity: () => ({ resources: mockResources }),
}));

jest.mock('../../src/data/buildingDefs', () => ({
  getBuildingDef: () => ({ stats: { staffCap: 10 } }),
}));

jest.mock('../../src/ecs/factories/demographics', () => ({
  RETIREMENT_AGE: { male: 60, female: 55 },
}));

jest.mock('@/config', () => ({
  economy: {
    consumption: { starvationGraceTicks: 90, maxStarvationDeathsPerTick: 5, foodPerPopDivisor: 10 },
    production: { overstaffingMinContribution: 0.1, grainToVodkaRatio: 2 },
    privatePlots: {
      baseFoodPerHectarePerYear: 100,
      monthsPerYear: 12,
      livestockFood: { cow: 5, pig: 3, sheep: 2, poultry: 1 },
      eraMultiplier: { revolution: 1.0 },
    },
  },
  chronology: {
    hoursPerTick: 8,
    ticksPerDay: 3,
    daysPerMonth: 10,
    monthsPerYear: 12,
    ticksPerMonth: 30,
    ticksPerYear: 360,
    startYear: 1917,
  },
}));

import { FoodAgent } from '../../src/ai/agents/economy/FoodAgent';

describe('FoodAgent profile wiring', () => {
  beforeEach(() => {
    mockResources = { food: 0, vodka: 0, population: 10 };
    mockProducers.length = 0;
    mockCitizens.length = 0;
    mockDvory.length = 0;
  });

  test('earth profile applies farmYieldMultiplier of 1.0 (baseline)', () => {
    const agent = new FoodAgent();
    agent.setProfile(PROFILE_EARTH_TEMPERATE);

    mockProducers.push({
      building: { defId: 'farm', powered: true, produces: { resource: 'food', amount: 100 } },
    });

    agent.produce({ farmModifier: 1.0 });
    expect(mockResources.food).toBe(100);
  });

  test('lunar profile applies farmYieldMultiplier of 0.4', () => {
    const agent = new FoodAgent();
    agent.setProfile(PROFILE_LUNAR);

    mockProducers.push({
      building: { defId: 'farm', powered: true, produces: { resource: 'food', amount: 100 } },
    });

    agent.produce({ farmModifier: 1.0 });
    expect(mockResources.food).toBeCloseTo(40, 1);
  });

  test('venusian profile (impossible farming) produces zero food', () => {
    const agent = new FoodAgent();
    agent.setProfile(PROFILE_VENUSIAN);

    mockProducers.push({
      building: { defId: 'farm', powered: true, produces: { resource: 'food', amount: 100 } },
    });

    agent.produce({ farmModifier: 1.0 });
    expect(mockResources.food).toBe(0);
  });

  test('lunar profile skips private plots (privatePlotsAvailable = false)', () => {
    const agent = new FoodAgent();
    agent.setProfile(PROFILE_LUNAR);

    mockDvory.push({
      dvor: {
        id: 'd1',
        members: [{ age: 30, gender: 'male' }],
        privatePlotSize: 1.0,
        privateLivestock: { cow: 1, pig: 0, sheep: 0, poultry: 0 },
      },
    });

    agent.produce({ eraId: 'revolution', includePrivatePlots: true });
    expect(mockResources.food).toBe(0); // No private plot output
  });

  test('earth profile includes private plot output', () => {
    const agent = new FoodAgent();
    agent.setProfile(PROFILE_EARTH_TEMPERATE);

    mockDvory.push({
      dvor: {
        id: 'd1',
        members: [{ age: 30, gender: 'male' }],
        privatePlotSize: 1.0,
        privateLivestock: { cow: 1, pig: 0, sheep: 0, poultry: 0 },
      },
    });

    agent.produce({ eraId: 'revolution', includePrivatePlots: true });
    // Should produce some food from private plot
    expect(mockResources.food).toBeGreaterThan(0);
  });
});

// ─── WeatherAgent ───────────────────────────────────────────────────────────

// WeatherAgent doesn't need ECS mocks — it's self-contained
import { WeatherAgent, WeatherType } from '../../src/ai/agents/core/WeatherAgent';
import { Season } from '../../src/game/Chronology';
import { GameRng } from '../../src/game/SeedSystem';

describe('WeatherAgent profile wiring', () => {
  test('lunar profile (no weather) makes onDayTick a no-op', () => {
    const agent = new WeatherAgent();
    agent.setProfile(PROFILE_LUNAR);

    const initialWeather = agent.getCurrentWeather();
    const initialDays = agent.getDaysRemaining();

    const rng = new GameRng('test');
    // Tick many times — should never change
    for (let i = 0; i < 20; i++) {
      agent.onDayTick(Season.WINTER, rng);
    }

    expect(agent.getCurrentWeather()).toBe(initialWeather);
    expect(agent.getDaysRemaining()).toBe(initialDays);
  });

  test('lunar profile returns neutral weather profile', () => {
    const agent = new WeatherAgent();
    agent.setProfile(PROFILE_LUNAR);

    const profile = agent.getWeatherProfile();
    expect(profile.label).toBe('Vacuum');
    expect(profile.farmModifier).toBe(1.0);
  });

  test('earth profile allows normal weather rolling', () => {
    const agent = new WeatherAgent();
    agent.setProfile(PROFILE_EARTH_TEMPERATE);

    const rng = new GameRng('test');
    // Force weather change by setting daysRemaining to 0
    agent.onDayTick(Season.WINTER, rng);

    // Should have weather (not vacuum)
    const profile = agent.getWeatherProfile();
    expect(profile.label).not.toBe('Vacuum');
  });
});

// ─── DecayAgent ─────────────────────────────────────────────────────────────

// Mock decaySystem to capture the multiplier passed
let capturedDecayMult = 0;
jest.mock('../../src/ai/agents/infrastructure/decaySystem', () => ({
  decaySystem: (mult: number) => { capturedDecayMult = mult; },
}));

import { DecayAgent } from '../../src/ai/agents/infrastructure/DecayAgent';

describe('DecayAgent profile wiring', () => {
  beforeEach(() => {
    capturedDecayMult = 0;
  });

  test('earth profile passes through base multiplier (1.0 atmospheric + 0.0 radiation)', () => {
    const agent = new DecayAgent();
    agent.setProfile(PROFILE_EARTH_TEMPERATE);

    agent.tickDecay(1.0);
    expect(capturedDecayMult).toBeCloseTo(1.0, 2);
  });

  test('lunar profile: low atmospheric decay (0.1) + radiation bonus (0.3)', () => {
    const agent = new DecayAgent();
    agent.setProfile(PROFILE_LUNAR);

    agent.tickDecay(1.0);
    // 1.0 * 0.1 + 0.3 = 0.4
    expect(capturedDecayMult).toBeCloseTo(0.4, 2);
  });

  test('venusian profile: extreme atmospheric decay (3.0) + no radiation', () => {
    const agent = new DecayAgent();
    agent.setProfile(PROFILE_VENUSIAN);

    agent.tickDecay(1.0);
    // 1.0 * 3.0 + 0.0 = 3.0
    expect(capturedDecayMult).toBeCloseTo(3.0, 2);
  });

  test('no profile passes through base multiplier unchanged', () => {
    const agent = new DecayAgent();

    agent.tickDecay(2.5);
    expect(capturedDecayMult).toBe(2.5);
  });
});

// ─── Profile types test ─────────────────────────────────────────────────────

describe('AgentParameterProfile profiles', () => {
  test('lunar profile has correct construction type', () => {
    expect(PROFILE_LUNAR.constructionType).toBe('pressurized_dome');
  });

  test('earth profile has standard construction', () => {
    expect(PROFILE_EARTH_TEMPERATE.constructionType).toBe('standard');
  });

  test('venusian profile has impossible farming', () => {
    expect(PROFILE_VENUSIAN.farmingMethod).toBe('impossible');
    expect(PROFILE_VENUSIAN.farmYieldMultiplier).toBe(0.0);
  });

  test('lunar profile has no weather', () => {
    expect(PROFILE_LUNAR.hasWeather).toBe(false);
    expect(PROFILE_LUNAR.hasSeasons).toBe(false);
  });

  test('earth profile has weather and seasons', () => {
    expect(PROFILE_EARTH_TEMPERATE.hasWeather).toBe(true);
    expect(PROFILE_EARTH_TEMPERATE.hasSeasons).toBe(true);
  });

  test('lunar radiation health modifier is 2.0', () => {
    expect(PROFILE_LUNAR.radiationHealthModifier).toBe(2.0);
  });

  test('lunar gravity birth rate modifier is 0.5', () => {
    expect(PROFILE_LUNAR.gravityBirthRateModifier).toBe(0.5);
  });
});
