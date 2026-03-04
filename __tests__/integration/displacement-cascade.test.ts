/**
 * Integration test: displacement cascade
 *
 * End-to-end: government demands military building → displacement system
 * demolishes lowest-priority building → dvory ejected → motivation system
 * pathfinds to nearest housing → dvory absorbed → population preserved.
 */

import { cascadeDisplacement, findDisplaceable } from '@/ai/agents/infrastructure/displacementSystem';
import { type DvorState, type HousingEntry, tickMotivation } from '@/ai/agents/workforce/dvorMotivation';
import type { BuildingComponent, Entity } from '@/ecs/world';
import { world } from '@/ecs/world';

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function addBuilding(defId: string, gridX: number, gridY: number, extra?: Partial<BuildingComponent>): Entity {
  const entity: Entity = {
    position: { gridX, gridY },
    building: makeBuildingComponent({ defId, ...extra }),
    isBuilding: true,
  };
  return world.add(entity);
}

function makeDisplacedDvor(id: string, gridX: number, gridY: number, householdSize: number): DvorState {
  return {
    dvorId: id,
    position: { gridX, gridY },
    isDisplaced: true,
    householdSize,
    foodLevel: 1.0,
    shelterLevel: 0.0, // homeless — triggers shelter need
  };
}

// ── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  world.clear();
});

afterEach(() => {
  world.clear();
});

// ── Full Cascade Integration ─────────────────────────────────────────────────

describe('displacement cascade end-to-end', () => {
  it('government demand demolishes farm, dvory find housing, population preserved', () => {
    // Step 1: Set up settlement
    const farm = addBuilding('farm-collective', 0, 0, { workerCount: 5 });
    const housing = addBuilding('apartment-tower-a', 3, 0, {
      housingCap: 50,
      residentCount: 20,
      householdCount: 5,
    });
    addBuilding('government-hq', 5, 5);

    // Track initial population
    const initialResidents = housing.building!.residentCount;
    const farmWorkers = farm.building!.workerCount;

    // Step 2: Government demands new military building — need to clear a tile
    // Military has priority Infinity, so it can displace anything below it
    const buildings = world.with('position', 'building').entities.slice();
    const result = cascadeDisplacement('military', buildings);

    // Step 3: Farm demolished (priority 1, lowest in settlement)
    expect(result.success).toBe(true);
    expect(result.demolished!.demolishedDefId).toBe('farm-collective');
    expect(result.demolished!.freedTile).toEqual({ gridX: 0, gridY: 0 });

    // Step 4: Create displaced dvory from the demolished farm's workers
    const displacedDvory: DvorState[] = [];
    for (let i = 0; i < farmWorkers; i++) {
      displacedDvory.push(makeDisplacedDvor(`dvor-${i}`, 0, 0, 3));
    }

    // Step 5: Dvory use motivation system to pathfind to housing
    const housingEntries: HousingEntry[] = world
      .with('position', 'building')
      .entities.filter((e) => e.building!.housingCap > 0)
      .map((e) => ({
        position: e.position!,
        building: e.building!,
      }));

    const results = displacedDvory.map((dvor) => tickMotivation(dvor, housingEntries));

    // All displaced dvory should try to move toward housing (not adjacent, so "move")
    for (const res of results) {
      expect(res.action).toBe('move');
      expect(res.target).toEqual({ gridX: 3, gridY: 0 });
    }

    // Step 6: Simulate arrival — dvory now adjacent to housing
    const arrivedDvory = displacedDvory.map((d) => ({
      ...d,
      position: { gridX: 3, gridY: 1 }, // within ARRIVAL_DISTANCE of (3,0)
    }));

    const absorptions = arrivedDvory.map((dvor) => tickMotivation(dvor, housingEntries));

    // All should absorb
    for (const res of absorptions) {
      expect(res.action).toBe('absorb');
      expect(res.target).toEqual({ gridX: 3, gridY: 0 });
    }

    // Step 7: Simulate absorption — increment housing resident count
    for (const dvor of arrivedDvory) {
      housing.building!.residentCount += dvor.householdSize;
      housing.building!.householdCount += 1;
    }

    // Verify: population preserved (original residents + absorbed dvory members)
    const expectedResidents = initialResidents + farmWorkers * 3;
    expect(housing.building!.residentCount).toBe(expectedResidents);
    expect(housing.building!.householdCount).toBe(5 + farmWorkers);

    // Verify: government HQ untouched
    const govEntities = world
      .with('position', 'building')
      .entities.filter((e) => e.building!.defId === 'government-hq');
    expect(govEntities).toHaveLength(1);
  });

  it('protected buildings are never displaced regardless of demand', () => {
    addBuilding('government-hq', 0, 0);
    addBuilding('barracks', 1, 0);

    const buildings = world.with('position', 'building').entities.slice();

    // Even military demand cannot displace government or military
    const result = cascadeDisplacement('military', buildings);
    expect(result.success).toBe(false);

    // All buildings remain
    expect(world.with('position', 'building').entities).toHaveLength(2);
  });

  it('housing displaced before industry when power_water demands space', () => {
    addBuilding('apartment-tower-a', 0, 0, { housingCap: 20, residentCount: 10, householdCount: 3 });
    addBuilding('warehouse', 1, 0); // industry = priority 3

    const buildings = world.with('position', 'building').entities.slice();
    // power_water = priority 4 — both housing (2) and industry (3) are below
    const target = findDisplaceable(buildings, 'power_water');

    // Housing (priority 2) is lower than industry (3), so housing displaced first
    expect(target!.building!.defId).toBe('apartment-tower-a');
  });

  it('displaced dvory wait when no housing has capacity', () => {
    const dvor = makeDisplacedDvor('homeless-dvor', 5, 5, 4);

    // No housing at all
    const result = tickMotivation(dvor, []);
    expect(result.action).toBe('wait');
    expect(result.target).toBeUndefined();
  });

  it('displacement frees correct tile for new construction', () => {
    addBuilding('farm-collective', 7, 9);

    const buildings = world.with('position', 'building').entities.slice();
    const result = cascadeDisplacement('military', buildings);

    expect(result.success).toBe(true);
    expect(result.demolished!.freedTile).toEqual({ gridX: 7, gridY: 9 });

    // Tile is truly free — no building entity at that position
    const remaining = world
      .with('position', 'building')
      .entities.filter((e) => e.position!.gridX === 7 && e.position!.gridY === 9);
    expect(remaining).toHaveLength(0);
  });

  it('cascade respects protection class hierarchy across mixed settlement', () => {
    // Full settlement with mixed building types
    addBuilding('government-hq', 0, 0); // government = Infinity (protected)
    addBuilding('barracks', 1, 0); // military = Infinity (protected)
    addBuilding('power-station', 2, 0); // power_water = 4
    addBuilding('warehouse', 3, 0); // industry = 3
    addBuilding('apartment-tower-a', 4, 0); // housing = 2
    addBuilding('farm-collective', 5, 0); // farms = 1

    const buildings = world.with('position', 'building').entities.slice();

    // Military demand (Infinity) — should pick farm (lowest at 1)
    const r1 = cascadeDisplacement('military', buildings);
    expect(r1.success).toBe(true);
    expect(r1.demolished!.demolishedDefId).toBe('farm-collective');

    // After farm demolished, next cascade picks housing (2)
    const buildings2 = world.with('position', 'building').entities.slice();
    const r2 = cascadeDisplacement('military', buildings2);
    expect(r2.success).toBe(true);
    expect(r2.demolished!.demolishedDefId).toBe('apartment-tower-a');

    // Next: industry (3)
    const buildings3 = world.with('position', 'building').entities.slice();
    const r3 = cascadeDisplacement('military', buildings3);
    expect(r3.success).toBe(true);
    expect(r3.demolished!.demolishedDefId).toBe('warehouse');

    // Next: power_water (4)
    const buildings4 = world.with('position', 'building').entities.slice();
    const r4 = cascadeDisplacement('military', buildings4);
    expect(r4.success).toBe(true);
    expect(r4.demolished!.demolishedDefId).toBe('power-station');

    // Only protected buildings remain — next cascade fails
    const buildings5 = world.with('position', 'building').entities.slice();
    const r5 = cascadeDisplacement('military', buildings5);
    expect(r5.success).toBe(false);

    // 2 protected buildings remain
    expect(world.with('position', 'building').entities).toHaveLength(2);
  });
});
