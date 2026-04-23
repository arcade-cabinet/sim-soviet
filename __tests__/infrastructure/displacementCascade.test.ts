/**
 * Integration test: displacement cascade.
 *
 * Full scenario: government building needs space → housing demolished →
 * dvory ejected → find new housing with capacity → residents absorbed.
 *
 * Tests the end-to-end flow of cascadeDisplacement + resident rehousing.
 */

import { cascadeDisplacement, type DisplacementResult } from '@/ai/agents/infrastructure/displacementSystem';
import { classifyBuilding } from '@/config/buildingClassification';
import { housing } from '@/ecs/archetypes';
import type { BuildingComponent, DvorComponent, Entity } from '@/ecs/world';
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
    avgMorale: 50,
    avgSkill: 50,
    avgLoyalty: 50,
    avgVodkaDep: 10,
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

function addHousing(
  defId: string,
  gridX: number,
  gridY: number,
  residents: number,
  households: number,
  housingCap: number,
): Entity {
  return addBuilding(defId, gridX, gridY, {
    housingCap,
    residentCount: residents,
    householdCount: households,
  });
}

function addDvor(id: string, surname: string, memberCount: number): Entity {
  const members = Array.from({ length: memberCount }, (_, i) => ({
    id: `${id}-m${i}`,
    name: `${surname} Member ${i}`,
    gender: (i % 2 === 0 ? 'male' : 'female') as 'male' | 'female',
    age: 20 + i * 5,
    role: i === 0 ? ('head' as const) : ('worker' as const),
    laborCapacity: 1.0,
    trudodniEarned: 0,
    health: 100,
  }));

  const dvor: DvorComponent = {
    id,
    members,
    headOfHousehold: members[0]!.id,
    privatePlotSize: 0.15,
    privateLivestock: { cow: 1, pig: 0, sheep: 0, poultry: 2 },
    joinedTick: 0,
    loyaltyToCollective: 60,
    surname,
  };

  return world.add({ dvor, isDvor: true });
}

/**
 * Simulates the post-displacement resident absorption:
 * finds housing with spare capacity and moves ejected residents there.
 * Returns the number of residents successfully relocated.
 */
function relocateEjectedResidents(displaced: DisplacementResult): number {
  let remaining = displaced.ejectedResidents;
  let remainingHouseholds = displaced.ejectedHouseholds;

  for (const h of housing.entities) {
    if (remaining <= 0) break;

    const spare = h.building.housingCap - h.building.residentCount;
    if (spare <= 0) continue;

    const toAbsorb = Math.min(remaining, spare);
    // Proportional households
    const householdsToAbsorb = remaining > 0 ? Math.ceil((toAbsorb / remaining) * remainingHouseholds) : 0;

    h.building.residentCount += toAbsorb;
    h.building.householdCount += householdsToAbsorb;
    remaining -= toAbsorb;
    remainingHouseholds -= householdsToAbsorb;
  }

  return displaced.ejectedResidents - remaining;
}

// ── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  world.clear();
});

afterEach(() => {
  world.clear();
});

// ── Integration: Full Cascade ────────────────────────────────────────────────

describe('displacement cascade integration', () => {
  it('government building displaces farm and frees tile for protected building', () => {
    // Setup: a farm (priority 1, lowest) + housing with residents + government HQ
    addBuilding('farm-collective', 2, 2); // farms = priority 1
    const receivingHousing = addHousing('workers-house-a', 5, 5, 10, 3, 50);
    addBuilding('government-hq', 0, 0);

    const buildings = world.with('position', 'building').entities.slice();

    // Government needs space — cascade should demolish farm (lowest priority)
    const result = cascadeDisplacement('government', buildings);

    expect(result.success).toBe(true);
    expect(result.demolished).toBeDefined();
    expect(result.demolished!.demolishedDefId).toBe('farm-collective');
    expect(result.demolished!.ejectedResidents).toBe(0);
    expect(result.demolished!.freedTile).toEqual({ gridX: 2, gridY: 2 });

    // Verify the farm is gone
    const remainingBuildings = world.with('position', 'building').entities;
    const defIds = remainingBuildings.map((e) => e.building.defId);
    expect(defIds).not.toContain('farm-collective');
    expect(defIds).toContain('government-hq');
    expect(defIds).toContain('workers-house-a');

    // Housing should be unchanged since no residents were ejected
    expect(receivingHousing.building.residentCount).toBe(10);
  });

  it('housing displacement ejects residents who relocate to spare capacity', () => {
    // Only housing buildings (same priority), government demands space
    const _targetHousing = addHousing('apartment-tower-a', 2, 2, 20, 5, 30);
    const _receivingHousing = addHousing('workers-house-a', 5, 5, 10, 3, 50);

    const buildings = world.with('position', 'building').entities.slice();
    const result = cascadeDisplacement('government', buildings);

    expect(result.success).toBe(true);
    expect(result.demolished).toBeDefined();

    // One of the two housing buildings should be demolished (both are priority 2)
    const demolishedId = result.demolished!.demolishedDefId;
    expect(['apartment-tower-a', 'workers-house-a']).toContain(demolishedId);

    // Find whichever housing survived
    const remaining = world.with('position', 'building').entities;
    expect(remaining.length).toBe(1);
    const survivor = remaining[0]!;

    // Relocate ejected residents into the surviving housing
    const relocated = relocateEjectedResidents(result.demolished!);
    expect(relocated).toBe(result.demolished!.ejectedResidents);

    // Population should be conserved
    expect(survivor.building.residentCount).toBe(30); // 10+20 or 20+10
  });

  it('cascade fails gracefully when only protected buildings exist', () => {
    addBuilding('government-hq', 0, 0);
    addBuilding('barracks', 1, 1);
    addBuilding('militia-post', 2, 2);

    const buildings = world.with('position', 'building').entities.slice();
    const result = cascadeDisplacement('government', buildings);

    expect(result.success).toBe(false);
    expect(result.demolished).toBeUndefined();

    // All buildings should remain
    expect(world.with('position', 'building').entities.length).toBe(3);
  });

  it('farms are demolished before housing when both exist', () => {
    addBuilding('farm-collective', 0, 0); // farms = priority 1
    addHousing('apartment-tower-a', 1, 1, 15, 4, 30); // housing = priority 2
    addBuilding('warehouse', 2, 2); // industry = priority 3

    const buildings = world.with('position', 'building').entities.slice();
    const result = cascadeDisplacement('government', buildings);

    expect(result.success).toBe(true);
    expect(result.demolished!.demolishedDefId).toBe('farm-collective');
    expect(result.demolished!.ejectedResidents).toBe(0); // farms have no residents
  });

  it('partial rehousing when receiving housing has limited capacity', () => {
    // Housing to demolish: 30 residents
    addHousing('apartment-tower-a', 0, 0, 30, 8, 40);

    // Two receiving buildings with limited spare capacity
    const house1 = addHousing('workers-house-a', 3, 3, 15, 4, 25); // 10 spare
    const house2 = addHousing('workers-house-b', 6, 6, 10, 3, 22); // 12 spare

    const buildings = world.with('position', 'building').entities.slice();
    const result = cascadeDisplacement('government', buildings);

    expect(result.success).toBe(true);
    expect(result.demolished!.ejectedResidents).toBe(30);

    const relocated = relocateEjectedResidents(result.demolished!);

    // Only 22 spare slots total (10 + 12), so 8 remain homeless
    expect(relocated).toBe(22);
    expect(house1.building.residentCount).toBe(25); // 15 + 10 = full
    expect(house2.building.residentCount).toBe(22); // 10 + 12 = full
  });

  it('dvory entities survive displacement (only building entity removed)', () => {
    // Create dvory that "live" in the target housing
    const _dvor1 = addDvor('d1', 'Ivanov', 3);
    const _dvor2 = addDvor('d2', 'Petrov', 4);

    // Housing building with these households
    addHousing('apartment-tower-a', 2, 2, 7, 2, 20);
    addHousing('workers-house-a', 5, 5, 0, 0, 20); // empty, ready to absorb

    const buildings = world.with('position', 'building').entities.slice();
    const result = cascadeDisplacement('government', buildings);

    expect(result.success).toBe(true);
    expect(result.demolished!.ejectedResidents).toBe(7);
    expect(result.demolished!.ejectedHouseholds).toBe(2);

    // Dvory entities should still exist in the ECS world — only the building was removed
    const allDvory = world.with('dvor', 'isDvor').entities;
    expect(allDvory.length).toBe(2);
    expect(allDvory.some((e) => e.dvor.id === 'd1')).toBe(true);
    expect(allDvory.some((e) => e.dvor.id === 'd2')).toBe(true);

    // Verify dvor members are intact
    const d1 = allDvory.find((e) => e.dvor.id === 'd1')!;
    expect(d1.dvor.members.length).toBe(3);
    expect(d1.dvor.surname).toBe('Ivanov');
  });

  it('zero-resident building displacement needs no rehousing', () => {
    // Farm (priority 1, lowest) has no residents — should be demolished first
    addBuilding('farm-collective', 1, 1);
    const housingEntity = addHousing('workers-house-a', 4, 4, 5, 2, 20);

    const buildings = world.with('position', 'building').entities.slice();
    const result = cascadeDisplacement('government', buildings);

    expect(result.success).toBe(true);
    expect(result.demolished!.demolishedDefId).toBe('farm-collective');
    expect(result.demolished!.ejectedResidents).toBe(0);

    const relocated = relocateEjectedResidents(result.demolished!);
    expect(relocated).toBe(0);

    // Housing building should be unchanged
    expect(housingEntity.building.residentCount).toBe(5);
  });

  it('military displacement cascades through priority order', () => {
    // Military (Infinity) should be able to displace anything non-protected
    const _farm = addBuilding('farm-collective', 0, 0); // priority 1
    addHousing('apartment-tower-a', 1, 1, 10, 3, 20); // priority 2
    addBuilding('warehouse', 2, 2); // priority 3
    addBuilding('power-station', 3, 3); // priority 4

    const buildings = world.with('position', 'building').entities.slice();
    const result = cascadeDisplacement('military', buildings);

    expect(result.success).toBe(true);
    // Should pick the lowest priority: farm (1)
    expect(result.demolished!.demolishedDefId).toBe('farm-collective');
  });

  it('building protection class lookup is consistent with displacement priorities', () => {
    // Verify the classification matches what displacement expects
    expect(classifyBuilding('government-hq')).toBe('government');
    expect(classifyBuilding('barracks')).toBe('military');
    expect(classifyBuilding('apartment-tower-a')).toBe('housing');
    expect(classifyBuilding('farm-collective')).toBe('farms');
    expect(classifyBuilding('warehouse')).toBe('industry');
    expect(classifyBuilding('power-station')).toBe('power_water');
  });

  it('sequential cascades free multiple tiles', () => {
    addBuilding('farm-collective', 0, 0); // priority 1
    addHousing('apartment-tower-a', 1, 1, 5, 2, 10); // priority 2
    addBuilding('warehouse', 2, 2); // priority 3

    // First cascade: demolishes farm (lowest priority)
    let buildings = world.with('position', 'building').entities.slice();
    const result1 = cascadeDisplacement('government', buildings);
    expect(result1.success).toBe(true);
    expect(result1.demolished!.demolishedDefId).toBe('farm-collective');

    // Second cascade: demolishes housing (next lowest)
    buildings = world.with('position', 'building').entities.slice();
    const result2 = cascadeDisplacement('government', buildings);
    expect(result2.success).toBe(true);
    expect(result2.demolished!.demolishedDefId).toBe('apartment-tower-a');
    expect(result2.demolished!.ejectedResidents).toBe(5);

    // Third cascade: demolishes warehouse
    buildings = world.with('position', 'building').entities.slice();
    const result3 = cascadeDisplacement('government', buildings);
    expect(result3.success).toBe(true);
    expect(result3.demolished!.demolishedDefId).toBe('warehouse');

    // No more buildings to demolish
    buildings = world.with('position', 'building').entities.slice();
    const result4 = cascadeDisplacement('government', buildings);
    expect(result4.success).toBe(false);
  });

  it('complete flow: demolish → eject → absorb → verify population', () => {
    // Setup a small settlement
    const _hq = addBuilding('government-hq', 5, 5);
    const oldHousing = addHousing('apartment-tower-a', 3, 3, 40, 10, 50);
    const newHousing1 = addHousing('workers-house-a', 7, 7, 20, 5, 50);
    const newHousing2 = addHousing('workers-house-b', 8, 8, 10, 3, 50);

    // Create dvory for the old housing
    for (let i = 0; i < 10; i++) {
      addDvor(`d${i}`, `Family${i}`, 4);
    }

    // Track total population before displacement
    const totalPopBefore =
      oldHousing.building.residentCount + newHousing1.building.residentCount + newHousing2.building.residentCount;
    expect(totalPopBefore).toBe(70); // 40 + 20 + 10

    // Cascade: government needs the old housing's tile
    const buildings = world.with('position', 'building').entities.slice();
    const result = cascadeDisplacement('government', buildings);

    expect(result.success).toBe(true);
    expect(result.demolished!.demolishedDefId).toBe('apartment-tower-a');

    // Relocate ejected residents
    const relocated = relocateEjectedResidents(result.demolished!);
    expect(relocated).toBe(40); // All 40 should fit (30 + 40 spare capacity)

    // Verify total population is conserved across remaining housing
    const totalPopAfter = newHousing1.building.residentCount + newHousing2.building.residentCount;
    expect(totalPopAfter).toBe(70); // 70 = 20+10 original + 40 relocated

    // Verify dvory still exist
    const allDvory = world.with('dvor', 'isDvor').entities;
    expect(allDvory.length).toBe(10);

    // Government HQ should be untouched
    expect(world.with('position', 'building').entities.some((e) => e.building.defId === 'government-hq')).toBe(true);
  });
});
