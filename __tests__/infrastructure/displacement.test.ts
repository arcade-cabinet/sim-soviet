import {
  cascadeDisplacement,
  executeDisplacement,
  findDisplaceable,
} from '@/ai/agents/infrastructure/displacementSystem';
import type { BuildingComponent, Entity } from '@/ecs/world';
import { world } from '@/ecs/world';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal building component with defaults. */
function makeBuildingComponent(overrides: Partial<BuildingComponent> & { defId: string }): BuildingComponent {
  return {
    level: 0,
    powered: false,
    powerReq: 0,
    powerOutput: 0,
    housingCap: 0,
    pollution: 0,
    fear: 0,
    workerCount: 0,
    residentCount: 0,
    avgMorale: 0,
    avgSkill: 0,
    avgLoyalty: 0,
    avgVodkaDep: 0,
    trudodniAccrued: 0,
    householdCount: 0,
    ...overrides,
  };
}

/** Add a building entity to the ECS world. */
function addBuilding(defId: string, gridX: number, gridY: number, extra?: Partial<BuildingComponent>): Entity {
  const entity: Entity = {
    position: { gridX, gridY },
    building: makeBuildingComponent({ defId, ...extra }),
    isBuilding: true,
  };
  return world.add(entity);
}

// ── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  world.clear();
});

afterEach(() => {
  world.clear();
});

// ── findDisplaceable ─────────────────────────────────────────────────────────

describe('findDisplaceable', () => {
  it('returns the lowest-priority building below the demand class', () => {
    const farm = addBuilding('farm-collective', 0, 0); // farms = priority 1
    addBuilding('apartment-tower-a', 1, 0); // housing = priority 2
    addBuilding('warehouse', 2, 0); // industry = priority 3

    // Demand class is 'power_water' (priority 4) — farms (1) is lowest, demolished first
    const result = findDisplaceable(
      [farm, ...world.with('position', 'building').entities.filter((e) => e !== farm)],
      'power_water',
    );
    expect(result).toBe(farm);
  });

  it('returns null when no building is below the demand class', () => {
    addBuilding('warehouse', 0, 0); // industry = priority 3

    const buildings = world.with('position', 'building').entities.slice();
    const result = findDisplaceable(buildings, 'industry');
    expect(result).toBeNull();
  });

  it('never returns a protected building (government/military)', () => {
    addBuilding('government-hq', 0, 0); // government = Infinity
    addBuilding('barracks', 1, 0); // military = Infinity

    const buildings = world.with('position', 'building').entities.slice();
    const result = findDisplaceable(buildings, 'power_water');
    expect(result).toBeNull();
  });

  it('picks the lowest priority when multiple candidates exist', () => {
    const farm = addBuilding('farm-collective', 0, 0); // farms = 1
    addBuilding('apartment-tower-a', 1, 0); // housing = 2
    addBuilding('warehouse', 2, 0); // industry = 3

    const buildings = world.with('position', 'building').entities.slice();
    const result = findDisplaceable(buildings, 'power_water');
    expect(result).toBe(farm);
  });

  it('returns null for an empty building list', () => {
    const result = findDisplaceable([], 'industry');
    expect(result).toBeNull();
  });

  it('skips buildings under construction', () => {
    addBuilding('farm-collective', 0, 0, { constructionPhase: 'foundation' });
    const house = addBuilding('apartment-tower-a', 1, 0); // housing = 2, operational

    const buildings = world.with('position', 'building').entities.slice();
    const result = findDisplaceable(buildings, 'power_water');
    expect(result).toBe(house);
  });
});

// ── executeDisplacement ──────────────────────────────────────────────────────

describe('executeDisplacement', () => {
  it('removes the building entity from the world', () => {
    const farm = addBuilding('farm-collective', 3, 4);
    expect(world.with('position', 'building').entities).toContain(farm);

    executeDisplacement(farm);
    expect(world.with('position', 'building').entities).not.toContain(farm);
  });

  it('returns freed tile coordinates', () => {
    const farm = addBuilding('farm-collective', 5, 7);
    const result = executeDisplacement(farm);
    expect(result.freedTile).toEqual({ gridX: 5, gridY: 7 });
  });

  it('returns ejected resident count from housing buildings', () => {
    const house = addBuilding('apartment-tower-a', 0, 0, {
      housingCap: 50,
      residentCount: 30,
      householdCount: 8,
    });
    const result = executeDisplacement(house);
    expect(result.ejectedResidents).toBe(30);
    expect(result.ejectedHouseholds).toBe(8);
  });

  it('returns zero residents for non-housing buildings', () => {
    const warehouse = addBuilding('warehouse', 0, 0);
    const result = executeDisplacement(warehouse);
    expect(result.ejectedResidents).toBe(0);
    expect(result.ejectedHouseholds).toBe(0);
  });

  it('returns the defId of the demolished building', () => {
    const farm = addBuilding('farm-collective', 2, 3);
    const result = executeDisplacement(farm);
    expect(result.demolishedDefId).toBe('farm-collective');
  });
});

// ── cascadeDisplacement ──────────────────────────────────────────────────────

describe('cascadeDisplacement', () => {
  it('demolishes the lowest-priority building and returns cascade result', () => {
    addBuilding('farm-collective', 0, 0); // farms = 1
    addBuilding('apartment-tower-a', 1, 0); // housing = 2

    const buildings = world.with('position', 'building').entities.slice();
    const result = cascadeDisplacement('power_water', buildings);

    expect(result.success).toBe(true);
    expect(result.demolished).toBeDefined();
    expect(result.demolished!.demolishedDefId).toBe('farm-collective');
    expect(result.demolished!.freedTile).toEqual({ gridX: 0, gridY: 0 });
  });

  it('returns success=false when nothing can be displaced', () => {
    addBuilding('government-hq', 0, 0);
    addBuilding('barracks', 1, 0);

    const buildings = world.with('position', 'building').entities.slice();
    const result = cascadeDisplacement('power_water', buildings);

    expect(result.success).toBe(false);
    expect(result.demolished).toBeUndefined();
  });

  it('does not demolish buildings of equal or higher priority', () => {
    addBuilding('warehouse', 0, 0); // industry = 3
    addBuilding('power-station', 1, 0); // power_water = 4

    const buildings = world.with('position', 'building').entities.slice();
    // demand is industry (3) — warehouse is also 3, should NOT be displaced
    const result = cascadeDisplacement('industry', buildings);
    expect(result.success).toBe(false);
  });

  it('accumulates displaced residents from housing demolitions', () => {
    addBuilding('apartment-tower-a', 0, 0, {
      housingCap: 50,
      residentCount: 25,
      householdCount: 6,
    });

    const buildings = world.with('position', 'building').entities.slice();
    const result = cascadeDisplacement('power_water', buildings);

    expect(result.success).toBe(true);
    expect(result.demolished!.ejectedResidents).toBe(25);
    expect(result.demolished!.ejectedHouseholds).toBe(6);
  });

  it('only demolishes one building per cascade call', () => {
    addBuilding('farm-collective', 0, 0);
    addBuilding('farm-collective', 1, 0);

    const buildings = world.with('position', 'building').entities.slice();
    const initialCount = buildings.length;

    cascadeDisplacement('power_water', buildings);

    // One farm demolished, one remains
    const remaining = world.with('position', 'building').entities;
    expect(remaining.length).toBe(initialCount - 1);
  });
});
