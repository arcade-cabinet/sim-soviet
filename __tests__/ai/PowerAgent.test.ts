/**
 * Tests for PowerAgent — power distribution orchestrator.
 *
 * Uses a minimal ECS world stub so tests run without a full game init.
 * The world module is mocked to inject controlled building entities.
 */

import type { PowerAgentState } from '../../src/ai/agents/infrastructure/PowerAgent';
import { PowerAgent } from '../../src/ai/agents/infrastructure/PowerAgent';
import { MSG } from '../../src/ai/telegrams';

// ---------------------------------------------------------------------------
// ECS world mock
// ---------------------------------------------------------------------------

/** Minimal building entity shape mirroring BuildingComponent for tests. */
interface MockBuilding {
  defId: string;
  powered: boolean;
  powerReq: number;
  powerOutput: number;
  housingCap: number;
  produces?: { resource: 'food' | 'vodka'; amount: number };
  pollution: number;
  fear: number;
  level: number;
}

interface MockEntity {
  position: { gridX: number; gridY: number };
  building: MockBuilding;
}

/** Mutable shared state for the world mock. */
const mockWorldState: {
  entities: MockEntity[];
  reindexCalls: MockEntity[];
  resources: { power: number; powerUsed: number };
} = {
  entities: [],
  reindexCalls: [],
  resources: { power: 0, powerUsed: 0 },
};

// Mock ecs/archetypes so PowerAgent reads from our controlled entity list
jest.mock('../../src/ecs/archetypes', () => ({
  buildingsLogic: {
    [Symbol.iterator]: () => mockWorldState.entities[Symbol.iterator](),
  },
  getResourceEntity: () => ({
    resources: mockWorldState.resources,
  }),
}));

// Mock ecs/world so world.reindex() is observable
jest.mock('../../src/ecs/world', () => ({
  world: {
    reindex: (entity: MockEntity) => {
      mockWorldState.reindexCalls.push(entity);
    },
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGenerator(powerOutput: number, defId = 'power-plant'): MockEntity {
  return {
    position: { gridX: 0, gridY: 0 },
    building: {
      defId,
      powered: false,
      powerReq: 0,
      powerOutput,
      housingCap: 0,
      pollution: 0,
      fear: 0,
      level: 0,
    },
  };
}

function makeConsumer(opts: {
  defId?: string;
  powerReq: number;
  housingCap?: number;
  produces?: { resource: 'food' | 'vodka'; amount: number };
  powered?: boolean;
}): MockEntity {
  return {
    position: { gridX: 0, gridY: 0 },
    building: {
      defId: opts.defId ?? 'generic-building',
      powered: opts.powered ?? false,
      powerReq: opts.powerReq,
      powerOutput: 0,
      housingCap: opts.housingCap ?? 0,
      produces: opts.produces,
      pollution: 0,
      fear: 0,
      level: 0,
    },
  };
}

function makeFarm(powerReq: number): MockEntity {
  return makeConsumer({
    defId: 'zone-farm',
    powerReq,
    produces: { resource: 'food', amount: 50 },
  });
}

function makeHousing(powerReq: number): MockEntity {
  return makeConsumer({ defId: 'zone-housing', powerReq, housingCap: 50 });
}

function makeIndustry(powerReq: number): MockEntity {
  return makeConsumer({ defId: 'factory', powerReq });
}

function resetWorld(entities: MockEntity[] = []): void {
  mockWorldState.entities = entities;
  mockWorldState.reindexCalls = [];
  mockWorldState.resources = { power: 0, powerUsed: 0 };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PowerAgent', () => {
  beforeEach(() => {
    resetWorld();
  });

  // ── Instantiation ──────────────────────────────────────────────────────────

  it('can be instantiated with name PowerAgent', () => {
    const agent = new PowerAgent();
    expect(agent.name).toBe('PowerAgent');
  });

  it('exposes MSG constants for POWER_SHORTAGE and BUILDING_UNPOWERED', () => {
    expect(PowerAgent.MSG.POWER_SHORTAGE).toBe(MSG.POWER_SHORTAGE);
    expect(PowerAgent.MSG.BUILDING_UNPOWERED).toBe(MSG.BUILDING_UNPOWERED);
  });

  // ── Total power calculation ────────────────────────────────────────────────

  it('calculates total power from generators', () => {
    resetWorld([makeGenerator(100), makeGenerator(50)]);
    const agent = new PowerAgent();
    agent.distributePower();
    expect(agent.getTotalPower()).toBe(150);
    expect(mockWorldState.resources.power).toBe(150);
  });

  it('returns 0 total power with no generators', () => {
    resetWorld([makeIndustry(20)]);
    const agent = new PowerAgent();
    agent.distributePower();
    expect(agent.getTotalPower()).toBe(0);
  });

  // ── Distribution to consumers ──────────────────────────────────────────────

  it('powers all consumers when supply exceeds demand', () => {
    const farm = makeFarm(10);
    const housing = makeHousing(20);
    const industry = makeIndustry(30);
    resetWorld([makeGenerator(100), farm, housing, industry]);

    const agent = new PowerAgent();
    agent.distributePower();

    expect(farm.building.powered).toBe(true);
    expect(housing.building.powered).toBe(true);
    expect(industry.building.powered).toBe(true);
    expect(agent.getPowerUsed()).toBe(60);
    expect(agent.isInShortage()).toBe(false);
  });

  it('marks all buildings unpowered when there are no generators', () => {
    const industry = makeIndustry(20);
    resetWorld([industry]);

    const agent = new PowerAgent();
    agent.distributePower();

    expect(industry.building.powered).toBe(false);
    expect(agent.isInShortage()).toBe(true);
  });

  it('powers zero-requirement buildings regardless of shortage', () => {
    const noReq = makeConsumer({ defId: 'road', powerReq: 0 });
    resetWorld([noReq]); // no generator

    const agent = new PowerAgent();
    agent.distributePower();

    expect(noReq.building.powered).toBe(true);
  });

  // ── Shortage detection ─────────────────────────────────────────────────────

  it('detects shortage when demand exceeds supply', () => {
    resetWorld([makeGenerator(10), makeIndustry(50)]);
    const agent = new PowerAgent();
    agent.distributePower();
    expect(agent.isInShortage()).toBe(true);
    expect(agent.getUnpoweredCount()).toBe(1);
  });

  it('reports no shortage when supply equals demand exactly', () => {
    resetWorld([makeGenerator(30), makeIndustry(30)]);
    const agent = new PowerAgent();
    agent.distributePower();
    expect(agent.isInShortage()).toBe(false);
    expect(agent.getUnpoweredCount()).toBe(0);
  });

  it('emits POWER_SHORTAGE callback when demand exceeds supply', () => {
    resetWorld([makeGenerator(10), makeIndustry(50)]);

    let capturedDeficit = -1;
    const agent = new PowerAgent();
    agent.onShortage((deficit) => {
      capturedDeficit = deficit;
    });
    agent.distributePower();

    expect(capturedDeficit).toBeGreaterThan(0);
  });

  it('does not emit POWER_SHORTAGE callback when supply is sufficient', () => {
    resetWorld([makeGenerator(100), makeIndustry(50)]);

    let called = false;
    const agent = new PowerAgent();
    agent.onShortage(() => {
      called = true;
    });
    agent.distributePower();

    expect(called).toBe(false);
  });

  // ── Priority-based allocation during shortages ─────────────────────────────

  it('prioritises farms over housing and industry during shortage', () => {
    const farm = makeFarm(30);
    const housing = makeHousing(30);
    const industry = makeIndustry(30);
    resetWorld([makeGenerator(30), farm, housing, industry]);

    const agent = new PowerAgent();
    agent.distributePower();

    expect(farm.building.powered).toBe(true);
    expect(housing.building.powered).toBe(false);
    expect(industry.building.powered).toBe(false);
    expect(agent.getUnpoweredCount()).toBe(2);
  });

  it('prioritises housing over industry during shortage', () => {
    const housing = makeHousing(30);
    const industry = makeIndustry(30);
    resetWorld([makeGenerator(30), housing, industry]);

    const agent = new PowerAgent();
    agent.distributePower();

    expect(housing.building.powered).toBe(true);
    expect(industry.building.powered).toBe(false);
    expect(agent.getUnpoweredCount()).toBe(1);
  });

  it('serves farm + housing before industry with exact supply', () => {
    const farm = makeFarm(20);
    const housing = makeHousing(20);
    const industry = makeIndustry(20);
    resetWorld([makeGenerator(40), farm, housing, industry]);

    const agent = new PowerAgent();
    agent.distributePower();

    expect(farm.building.powered).toBe(true);
    expect(housing.building.powered).toBe(true);
    expect(industry.building.powered).toBe(false);
    expect(agent.getPowerUsed()).toBe(40);
  });

  // ── Telegram emission — BUILDING_UNPOWERED ─────────────────────────────────

  it('emits BUILDING_UNPOWERED callback for each unpowered building', () => {
    const industry1 = makeIndustry(40);
    industry1.building.defId = 'steel-mill';
    const industry2 = makeIndustry(40);
    industry2.building.defId = 'factory-b';
    resetWorld([makeGenerator(10), industry1, industry2]);

    const unpoweredIds: string[] = [];
    const agent = new PowerAgent();
    agent.onUnpowered((id) => unpoweredIds.push(id));
    agent.distributePower();

    expect(unpoweredIds).toContain('steel-mill');
    expect(unpoweredIds).toContain('factory-b');
  });

  it('does not emit BUILDING_UNPOWERED when all buildings are powered', () => {
    resetWorld([makeGenerator(100), makeIndustry(20)]);

    const unpoweredIds: string[] = [];
    const agent = new PowerAgent();
    agent.onUnpowered((id) => unpoweredIds.push(id));
    agent.distributePower();

    expect(unpoweredIds).toHaveLength(0);
  });

  // ── Reindexing ─────────────────────────────────────────────────────────────

  it('calls world.reindex when power state changes', () => {
    const industry = makeIndustry(50);
    industry.building.powered = true; // was powered
    resetWorld([makeGenerator(10), industry]);

    const agent = new PowerAgent();
    agent.distributePower();

    expect(industry.building.powered).toBe(false);
    expect(mockWorldState.reindexCalls).toContain(industry);
  });

  it('does not call world.reindex when power state is unchanged', () => {
    const industry = makeIndustry(20);
    industry.building.powered = false; // already unpowered, generator too small
    resetWorld([makeGenerator(10), industry]);

    const agent = new PowerAgent();
    agent.distributePower();

    // industry stays unpowered — no state change → no reindex for industry
    const reindexedIndustry = mockWorldState.reindexCalls.filter((e) => e === industry);
    expect(reindexedIndustry).toHaveLength(0);
  });

  // ── Power balance ──────────────────────────────────────────────────────────

  it('reports positive balance when supply exceeds consumption', () => {
    resetWorld([makeGenerator(100), makeIndustry(30)]);
    const agent = new PowerAgent();
    agent.distributePower();
    expect(agent.getPowerBalance()).toBe(70);
  });

  it('reports 0 balance when supply equals consumption', () => {
    resetWorld([makeGenerator(30), makeIndustry(30)]);
    const agent = new PowerAgent();
    agent.distributePower();
    expect(agent.getPowerBalance()).toBe(0);
  });

  // ── Yuka update() ─────────────────────────────────────────────────────────

  it('update() runs distribution and returns this for chaining', () => {
    resetWorld([makeGenerator(50), makeIndustry(20)]);
    const agent = new PowerAgent();
    const returned = agent.distributePower();
    expect(returned).toBe(agent);
    expect(agent.getTotalPower()).toBe(50);
    expect(agent.getPowerUsed()).toBe(20);
  });

  // ── Serialization round-trip ───────────────────────────────────────────────

  it('serialises and deserialises state correctly', () => {
    resetWorld([makeGenerator(80), makeFarm(10), makeHousing(20), makeIndustry(60)]);

    const agent = new PowerAgent();
    agent.distributePower();

    const saved: PowerAgentState = agent.toJSON();
    expect(saved.totalPower).toBe(80);
    expect(saved.inShortage).toBe(true);
    expect(saved.unpoweredCount).toBeGreaterThan(0);
    expect(typeof saved.powerUsed).toBe('number');

    const agent2 = new PowerAgent();
    agent2.fromJSON(saved);
    expect(agent2.getTotalPower()).toBe(saved.totalPower);
    expect(agent2.getPowerUsed()).toBe(saved.powerUsed);
    expect(agent2.isInShortage()).toBe(saved.inShortage);
    expect(agent2.getUnpoweredCount()).toBe(saved.unpoweredCount);
    expect(agent2.getPowerBalance()).toBe(agent.getPowerBalance());
  });

  it('restores a no-shortage state correctly', () => {
    resetWorld([makeGenerator(100), makeIndustry(30)]);

    const agent = new PowerAgent();
    agent.distributePower();

    const saved = agent.toJSON();
    expect(saved.inShortage).toBe(false);

    const agent2 = new PowerAgent();
    agent2.fromJSON(saved);
    expect(agent2.isInShortage()).toBe(false);
    expect(agent2.getUnpoweredCount()).toBe(0);
  });
});
