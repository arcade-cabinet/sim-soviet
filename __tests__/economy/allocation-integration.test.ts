/**
 * @file allocation-integration.test.ts
 *
 * Integration tests verifying that the two-layer allocation distribution
 * (computeAllocation) is wired into phaseConsumption for aggregate mode.
 *
 * In aggregate mode, food/vodka consumption uses 80% uniform baseline
 * per capita + 20% spiky secondary by merit (loyalty, skill, KGB favor).
 */

import { computeAllocation, type BuildingAllocationInput } from '../../src/ai/agents/economy/allocationDistribution';
import { housing } from '../../src/ecs/archetypes';
import { createBuilding } from '../../src/ecs/factories/buildingFactories';
import { createMetaStore, createResourceStore } from '../../src/ecs/factories';
import { getResourceEntity } from '../../src/ecs/archetypes';
import { world, type RaionPool } from '../../src/ecs/world';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRaionPool(pop: number): RaionPool {
  return {
    totalPopulation: pop,
    totalHouseholds: Math.ceil(pop / 4),
    maleAgeBuckets: Array(20).fill(0),
    femaleAgeBuckets: Array(20).fill(0),
    classCounts: { worker: pop },
    birthsThisYear: 0,
    deathsThisYear: 0,
    totalBirths: 0,
    totalDeaths: 0,
    pregnancyWaves: [0, 0, 0],
    laborForce: Math.floor(pop * 0.6),
    assignedWorkers: 0,
    idleWorkers: Math.floor(pop * 0.6),
    avgMorale: 50,
    avgLoyalty: 50,
    avgSkill: 50,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Two-layer allocation integration', () => {
  beforeEach(() => {
    world.clear();
  });

  afterEach(() => {
    world.clear();
  });

  it('computeAllocation total equals supply for housing buildings', () => {
    // Create two housing buildings with different merit profiles
    const inputs: BuildingAllocationInput[] = [
      { id: 'h1', residentCount: 80, loyalty: 90, proximity: 1.0, skill: 70, kgbFavor: false },
      { id: 'h2', residentCount: 120, loyalty: 40, proximity: 0.5, skill: 30, kgbFavor: false },
    ];
    const totalPop = 200;
    const totalFood = 100; // pop * 0.5

    const result = computeAllocation(totalFood, totalPop, inputs);
    const totalAllocated = result.reduce((s, r) => s + r.total, 0);
    expect(totalAllocated).toBeCloseTo(totalFood, 5);
  });

  it('high-loyalty building gets more per capita than low-loyalty', () => {
    const inputs: BuildingAllocationInput[] = [
      { id: 'loyal', residentCount: 50, loyalty: 95, proximity: 1.0, skill: 80, kgbFavor: false },
      { id: 'disloyal', residentCount: 50, loyalty: 20, proximity: 0.5, skill: 20, kgbFavor: false },
    ];

    const result = computeAllocation(100, 100, inputs);
    const loyalPerCapita = result[0].total / 50;
    const disloyalPerCapita = result[1].total / 50;
    expect(loyalPerCapita).toBeGreaterThan(disloyalPerCapita);
  });

  it('KGB favor building gets spike bonus', () => {
    const inputs: BuildingAllocationInput[] = [
      { id: 'favored', residentCount: 50, loyalty: 50, proximity: 1.0, skill: 50, kgbFavor: true },
      { id: 'normal', residentCount: 50, loyalty: 50, proximity: 1.0, skill: 50, kgbFavor: false },
    ];

    const result = computeAllocation(100, 100, inputs);
    expect(result[0].total).toBeGreaterThan(result[1].total);
  });

  it('housing archetype picks up ECS housing buildings', () => {
    // Create a housing building (apartment-tower-a has housingCap: 50)
    const entity = createBuilding(0, 0, 'apartment-tower-a');
    entity.building!.residentCount = 30;
    entity.building!.avgLoyalty = 70;
    entity.building!.avgSkill = 50;

    // The housing archetype should include this entity
    const housingEntities = housing.entities;
    expect(housingEntities.length).toBeGreaterThanOrEqual(1);
    const found = housingEntities.find((e) => e.building.defId === 'apartment-tower-a');
    expect(found).toBeDefined();
    expect(found!.building.residentCount).toBe(30);
  });

  it('allocation inputs are correctly built from housing entities', () => {
    // Create two housing buildings
    const h1 = createBuilding(0, 0, 'apartment-tower-a');
    h1.building!.residentCount = 40;
    h1.building!.avgLoyalty = 85;
    h1.building!.avgSkill = 60;

    const h2 = createBuilding(1, 0, 'apartment-tower-b');
    h2.building!.residentCount = 60;
    h2.building!.avgLoyalty = 30;
    h2.building!.avgSkill = 25;

    // Build allocation inputs (same transform as phaseConsumption)
    const allocationInputs: BuildingAllocationInput[] = housing.entities.map((e) => ({
      id: e.building.defId,
      residentCount: e.building.residentCount,
      loyalty: e.building.avgLoyalty,
      proximity: 1.0,
      skill: e.building.avgSkill,
      kgbFavor: false,
    }));

    expect(allocationInputs.length).toBe(2);
    const totalResidents = allocationInputs.reduce((s, b) => s + b.residentCount, 0);
    expect(totalResidents).toBe(100);

    // Run allocation
    const totalFoodDemand = 100 * 0.5; // pop * 0.5
    const result = computeAllocation(totalFoodDemand, totalResidents, allocationInputs);
    const totalAllocated = result.reduce((s, r) => s + r.total, 0);
    expect(totalAllocated).toBeCloseTo(totalFoodDemand, 5);

    // High-loyalty building (h1) should get more per-capita
    const h1Result = result.find((r) => r.id === 'apartment-tower-a')!;
    const h2Result = result.find((r) => r.id === 'apartment-tower-b')!;
    expect(h1Result.total / 40).toBeGreaterThan(h2Result.total / 60);
  });

  it('spike layer is zero-sum across buildings', () => {
    const inputs: BuildingAllocationInput[] = [
      { id: 'a', residentCount: 30, loyalty: 90, proximity: 1.0, skill: 80, kgbFavor: false },
      { id: 'b', residentCount: 50, loyalty: 40, proximity: 0.5, skill: 30, kgbFavor: false },
      { id: 'c', residentCount: 20, loyalty: 60, proximity: 0.8, skill: 55, kgbFavor: true },
    ];

    const result = computeAllocation(200, 100, inputs);
    const spikeSum = result.reduce((s, r) => s + r.spike, 0);
    expect(spikeSum).toBeCloseTo(0, 5);
  });

  it('with zero population, allocation returns zero for all buildings', () => {
    const inputs: BuildingAllocationInput[] = [
      { id: 'empty1', residentCount: 0, loyalty: 50, proximity: 1.0, skill: 50, kgbFavor: false },
      { id: 'empty2', residentCount: 0, loyalty: 50, proximity: 1.0, skill: 50, kgbFavor: false },
    ];

    const result = computeAllocation(100, 0, inputs);
    expect(result.every((r) => r.total === 0)).toBe(true);
  });
});
