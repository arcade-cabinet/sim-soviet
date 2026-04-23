/**
 * Integration test: displacement cascade
 *
 * End-to-end: government demands military building → displacement system
 * demolishes lowest-priority building → dvory ejected → motivation system
 * pathfinds to nearest housing → dvory absorbed → population preserved.
 *
 * Also covers nomenclatura priority eviction and the full pipeline
 * from displacement through motivation to nomenclatura re-housing.
 */

import { cascadeDisplacement, findDisplaceable } from '@/ai/agents/infrastructure/displacementSystem';
import { type DvorState, evaluateNeeds, type HousingEntry, tickMotivation } from '@/ai/agents/workforce/dvorMotivation';
import {
  claimHousing,
  type HousingBuilding,
  type HousingResident,
  isNomenclatura,
} from '@/ai/agents/workforce/nomenclaturaPriority';
import { getDemolitionPriority, isProtected } from '@/config/protectedClasses';
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

  it('military building displaces housing, residents become displaced dvory and find new housing', () => {
    // Settlement: housing block at (2,2) + a second housing at (8,8) with capacity
    addBuilding('apartment-tower-a', 2, 2, {
      housingCap: 10,
      residentCount: 8,
      householdCount: 4,
    });
    const fallback = addBuilding('apartment-tower-a', 8, 8, {
      housingCap: 20,
      residentCount: 5,
      householdCount: 2,
    });

    // Military demand displaces the first housing block (both are priority 2, first found wins)
    const buildings = world.with('position', 'building').entities.slice();
    const result = cascadeDisplacement('military', buildings);

    expect(result.success).toBe(true);
    expect(result.demolished!.demolishedDefId).toBe('apartment-tower-a');
    expect(result.demolished!.ejectedResidents).toBe(8);
    expect(result.demolished!.ejectedHouseholds).toBe(4);

    // Ejected residents become displaced dvory at the demolished building's tile
    const dvory: DvorState[] = [];
    for (let i = 0; i < result.demolished!.ejectedHouseholds; i++) {
      dvory.push(makeDisplacedDvor(`evicted-${i}`, 2, 2, 2));
    }

    // Build housing entries from surviving buildings
    const housingEntries: HousingEntry[] = world
      .with('position', 'building')
      .entities.filter((e) => e.building!.housingCap > 0)
      .map((e) => ({ position: e.position!, building: e.building! }));

    // All displaced dvory should move toward fallback housing
    for (const dvor of dvory) {
      const tick = tickMotivation(dvor, housingEntries);
      expect(tick.action).toBe('move');
      expect(tick.target).toEqual({ gridX: 8, gridY: 8 });
    }

    // Simulate arrival and absorption
    const arrivedDvory = dvory.map((d) => ({
      ...d,
      position: { gridX: 8, gridY: 7 }, // within ARRIVAL_DISTANCE
    }));
    for (const dvor of arrivedDvory) {
      const tick = tickMotivation(dvor, housingEntries);
      expect(tick.action).toBe('absorb');
      fallback.building!.residentCount += dvor.householdSize;
    }

    // Fallback absorbed everyone: original 5 + 4 households * 2 members each
    expect(fallback.building!.residentCount).toBe(5 + 4 * 2);
  });

  it('nomenclatura claims priority housing, commoner evicted and pathfinds elsewhere', () => {
    // Two housing buildings, both at capacity with commoners
    const housingBuildings: HousingBuilding[] = [
      {
        id: 'block-a',
        capacity: 2,
        residents: [
          { id: 'w1', citizenClass: 'worker' },
          { id: 'w2', citizenClass: 'kolkhoznik' },
        ],
      },
      {
        id: 'block-b',
        capacity: 2,
        residents: [
          { id: 'w3', citizenClass: 'worker' },
          { id: 'w4', citizenClass: 'worker' },
        ],
      },
    ];

    // KGB officer arrives — nomenclatura, highest priority
    const kgbOfficer: HousingResident = { id: 'kgb-1', citizenClass: 'kgb' };
    expect(isNomenclatura(kgbOfficer.citizenClass)).toBe(true);

    const claim = claimHousing(kgbOfficer, housingBuildings);

    // KGB officer housed, kolkhoznik evicted (lowest priority = 1)
    expect(claim.housed).toBe(true);
    expect(claim.evicted).toHaveLength(1);
    expect(claim.evicted![0].citizenClass).toBe('kolkhoznik');
    expect(claim.evicted![0].id).toBe('w2');

    // Evicted kolkhoznik becomes a displaced dvor seeking shelter
    const evictedDvor = makeDisplacedDvor('w2-dvor', 0, 0, 1);
    expect(evaluateNeeds(evictedDvor)).toBe('shelter');

    // Add ECS housing buildings for motivation pathfinding
    addBuilding('apartment-tower-a', 0, 0, { housingCap: 2, residentCount: 2 });
    addBuilding('apartment-tower-a', 5, 5, { housingCap: 4, residentCount: 2 });

    const housingEntries: HousingEntry[] = world
      .with('position', 'building')
      .entities.filter((e) => e.building!.housingCap > 0)
      .map((e) => ({ position: e.position!, building: e.building! }));

    // Evicted dvor pathfinds to the building with remaining capacity
    const tick = tickMotivation(evictedDvor, housingEntries);
    expect(tick.action).toBe('move');
    expect(tick.target).toEqual({ gridX: 5, gridY: 5 });
  });

  it('no displaceable building exists — cascade returns null (demand queued)', () => {
    // Settlement with only protected buildings
    addBuilding('government-hq', 0, 0);
    addBuilding('barracks', 1, 0);
    addBuilding('militia-post', 2, 0);

    // Verify all are protected
    expect(isProtected('government')).toBe(true);
    expect(isProtected('military')).toBe(true);
    expect(getDemolitionPriority('government')).toBe(Infinity);
    expect(getDemolitionPriority('military')).toBe(Infinity);

    const buildings = world.with('position', 'building').entities.slice();
    const result = cascadeDisplacement('military', buildings);

    // No building can be displaced — demand would be queued
    expect(result.success).toBe(false);
    expect(result.demolished).toBeUndefined();

    // All buildings remain intact
    expect(world.with('position', 'building').entities).toHaveLength(3);
  });

  it('full pipeline: displacement → motivation → nomenclatura priority → everyone re-housed', () => {
    // Step 1: Settlement with farm, 2 housing blocks, and a government HQ
    addBuilding('farm-collective', 0, 0, {
      workerCount: 3,
      residentCount: 6,
      householdCount: 3,
    });
    const _housingA = addBuilding('apartment-tower-a', 4, 0, {
      housingCap: 10,
      residentCount: 8,
      householdCount: 4,
    });
    const _housingB = addBuilding('apartment-tower-a', 8, 0, {
      housingCap: 10,
      residentCount: 3,
      householdCount: 1,
    });
    addBuilding('government-hq', 10, 10);

    // Step 2: Military demand triggers displacement cascade
    const buildings = world.with('position', 'building').entities.slice();
    const cascade = cascadeDisplacement('military', buildings);

    expect(cascade.success).toBe(true);
    expect(cascade.demolished!.demolishedDefId).toBe('farm-collective');
    expect(cascade.demolished!.ejectedResidents).toBe(6);

    // Step 3: Ejected farm workers become displaced dvory
    const displacedDvory = Array.from({ length: 3 }, (_, i) => makeDisplacedDvor(`farm-dvor-${i}`, 0, 0, 2));

    // All have shelter as their dominant need
    for (const dvor of displacedDvory) {
      expect(evaluateNeeds(dvor)).toBe('shelter');
    }

    // Step 4: Motivation system pathfinds toward nearest housing with capacity
    const housingEntries: HousingEntry[] = world
      .with('position', 'building')
      .entities.filter((e) => e.building!.housingCap > 0)
      .map((e) => ({ position: e.position!, building: e.building! }));

    // housingA has 2 slots (cap 10, residents 8), housingB has 7 slots (cap 10, residents 3)
    // Nearest to (0,0) is housingA at (4,0)
    for (const dvor of displacedDvory) {
      const tick = tickMotivation(dvor, housingEntries);
      expect(tick.action).toBe('move');
      expect(tick.target).toEqual({ gridX: 4, gridY: 0 });
    }

    // Step 5: Party official arrives seeking housing via nomenclatura priority
    const nomenclaturaHousing: HousingBuilding[] = [
      {
        id: 'block-a',
        capacity: 10,
        residents: Array.from({ length: 10 }, (_, i) => ({
          id: `worker-a-${i}`,
          citizenClass: 'worker' as const,
        })),
      },
      {
        id: 'block-b',
        capacity: 10,
        residents: Array.from({ length: 3 }, (_, i) => ({
          id: `worker-b-${i}`,
          citizenClass: 'worker' as const,
        })),
      },
    ];

    const partyOfficial: HousingResident = { id: 'official-1', citizenClass: 'party_official' };
    expect(isNomenclatura(partyOfficial.citizenClass)).toBe(true);

    // Block-B has open slots, so official takes open slot (no eviction needed)
    const claim = claimHousing(partyOfficial, nomenclaturaHousing);
    expect(claim.housed).toBe(true);
    expect(claim.building).toBe('block-b');
    expect(claim.evicted).toBeUndefined();

    // Step 6: Fill all housing and try another official — forces eviction
    const fullHousing: HousingBuilding[] = [
      {
        id: 'block-a',
        capacity: 10,
        residents: Array.from({ length: 10 }, (_, i) => ({
          id: `worker-a-${i}`,
          citizenClass: 'worker' as const,
        })),
      },
      {
        id: 'block-b',
        capacity: 10,
        residents: Array.from({ length: 10 }, (_, i) => ({
          id: `kolkhoz-b-${i}`,
          citizenClass: 'kolkhoznik' as const,
        })),
      },
    ];

    const militaryOfficer: HousingResident = { id: 'officer-1', citizenClass: 'military_officer' };
    const eviction = claimHousing(militaryOfficer, fullHousing);

    expect(eviction.housed).toBe(true);
    expect(eviction.evicted).toHaveLength(1);
    // Kolkhoznik evicted (priority 1, lower than worker priority 2)
    expect(eviction.evicted![0].citizenClass).toBe('kolkhoznik');

    // Step 7: Evicted kolkhoznik pathfinds to remaining housing
    const evictedDvor = makeDisplacedDvor('kolkhoz-evicted', 8, 0, 1);
    expect(evaluateNeeds(evictedDvor)).toBe('shelter');

    // housingB at (8,0) still has capacity in the ECS world
    const finalHousingEntries: HousingEntry[] = world
      .with('position', 'building')
      .entities.filter((e) => e.building!.housingCap > 0)
      .map((e) => ({ position: e.position!, building: e.building! }));

    const evictedTick = tickMotivation(evictedDvor, finalHousingEntries);
    // Already at (8,0), adjacent to housingB at (8,0) → absorb
    expect(evictedTick.action).toBe('absorb');
    expect(evictedTick.target).toEqual({ gridX: 8, gridY: 0 });

    // Step 8: Verify end state — farm removed, 2 housing blocks + gov HQ remain
    expect(world.with('position', 'building').entities).toHaveLength(3);

    // Government HQ untouched (protected)
    const govBuildings = world
      .with('position', 'building')
      .entities.filter((e) => e.building!.defId === 'government-hq');
    expect(govBuildings).toHaveLength(1);
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
