import { World } from 'miniplex';
import { collapseEntitiesToBuildings, getPopulationMode } from '../../src/ai/agents/workforce/collectiveTransition';
import type { BuildingComponent, Entity, RaionPool } from '../../src/ecs/world';

/** Helper: create a minimal BuildingComponent with workforce fields zeroed. */
function makeBuilding(defId: string, housingCap = 0): BuildingComponent {
  return {
    defId,
    level: 0,
    powered: true,
    powerReq: 0,
    powerOutput: 0,
    housingCap,
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
  };
}

/** Helper: create a minimal RaionPool for testing. */
function makeRaionPool(): RaionPool {
  return {
    totalPopulation: 300,
    totalHouseholds: 60,
    maleAgeBuckets: new Array(20).fill(0),
    femaleAgeBuckets: new Array(20).fill(0),
    classCounts: {},
    birthsThisYear: 0,
    deathsThisYear: 0,
    totalBirths: 0,
    totalDeaths: 0,
    pregnancyWaves: [0, 0, 0],
    laborForce: 200,
    assignedWorkers: 150,
    idleWorkers: 50,
    avgMorale: 50,
    avgLoyalty: 50,
    avgSkill: 30,
  };
}

describe('getPopulationMode', () => {
  it('returns "entity" when population is below threshold and no raion', () => {
    expect(getPopulationMode(100)).toBe('entity');
    expect(getPopulationMode(0)).toBe('entity');
    expect(getPopulationMode(200)).toBe('entity');
  });

  it('returns "aggregate" when population exceeds threshold', () => {
    expect(getPopulationMode(201)).toBe('aggregate');
    expect(getPopulationMode(500)).toBe('aggregate');
  });

  it('returns "aggregate" when raion is already defined (one-way)', () => {
    const raion = makeRaionPool();
    // Even with low population, once raion exists it stays aggregate
    expect(getPopulationMode(50, raion)).toBe('aggregate');
    expect(getPopulationMode(0, raion)).toBe('aggregate');
  });

  it('returns "aggregate" when raion is defined AND population is high', () => {
    const raion = makeRaionPool();
    expect(getPopulationMode(500, raion)).toBe('aggregate');
  });
});

describe('collapseEntitiesToBuildings', () => {
  let w: World<Entity>;

  beforeEach(() => {
    w = new World<Entity>();
  });

  it('correctly aggregates citizens into building workforce fields', () => {
    // Create a factory building
    const factory = w.add({
      building: makeBuilding('factory-a'),
      position: { gridX: 5, gridY: 5 },
    });

    // Create citizens assigned to factory-a
    w.add({
      citizen: {
        class: 'worker',
        happiness: 60,
        hunger: 20,
        assignment: 'factory-a',
      },
      position: { gridX: 0, gridY: 0 },
    });
    w.add({
      citizen: {
        class: 'worker',
        happiness: 80,
        hunger: 10,
        assignment: 'factory-a',
      },
      position: { gridX: 1, gridY: 0 },
    });

    const raion = collapseEntitiesToBuildings(w);

    // Building should have 2 workers
    expect(factory.building!.workerCount).toBe(2);
    // Average morale: (60+80)/2 = 70
    expect(factory.building!.avgMorale).toBe(70);

    expect(raion).toBeDefined();
  });

  it('correctly handles housing assignment via home grid position', () => {
    // Create a housing building
    const house = w.add({
      building: makeBuilding('house-a', 10),
      position: { gridX: 3, gridY: 4 },
    });

    // Create citizens housed here
    w.add({
      citizen: {
        class: 'worker',
        happiness: 50,
        hunger: 0,
        home: { gridX: 3, gridY: 4 },
      },
      position: { gridX: 0, gridY: 0 },
    });
    w.add({
      citizen: {
        class: 'farmer',
        happiness: 50,
        hunger: 0,
        home: { gridX: 3, gridY: 4 },
      },
      position: { gridX: 1, gridY: 0 },
    });

    collapseEntitiesToBuildings(w);

    expect(house.building!.residentCount).toBe(2);
  });

  it('distributes workers across multiple buildings with same defId', () => {
    const factoryA = w.add({
      building: makeBuilding('factory-a'),
      position: { gridX: 0, gridY: 0 },
    });
    const factoryB = w.add({
      building: makeBuilding('factory-a'),
      position: { gridX: 5, gridY: 5 },
    });

    // Create 4 citizens assigned to factory-a
    for (let i = 0; i < 4; i++) {
      w.add({
        citizen: {
          class: 'worker',
          happiness: 50,
          hunger: 0,
          assignment: 'factory-a',
        },
        position: { gridX: 10 + i, gridY: 0 },
      });
    }

    collapseEntitiesToBuildings(w);

    // Workers should be distributed (round-robin by lowest fill)
    const totalWorkers = factoryA.building!.workerCount + factoryB.building!.workerCount;
    expect(totalWorkers).toBe(4);
    // Each should get 2 (balanced distribution)
    expect(factoryA.building!.workerCount).toBe(2);
    expect(factoryB.building!.workerCount).toBe(2);
  });

  it('correctly builds RaionPool age-sex pyramid from dvor members', () => {
    // Create a dvor with members of different ages and genders
    w.add({
      dvor: {
        id: 'dvor-1',
        members: [
          {
            id: 'm1',
            name: 'Ivan',
            gender: 'male',
            age: 35,
            role: 'head',
            laborCapacity: 1.0,
            trudodniEarned: 0,
            health: 100,
          },
          {
            id: 'm2',
            name: 'Maria',
            gender: 'female',
            age: 32,
            role: 'spouse',
            laborCapacity: 0.9,
            trudodniEarned: 0,
            health: 100,
          },
          {
            id: 'm3',
            name: 'Petya',
            gender: 'male',
            age: 8,
            role: 'child',
            laborCapacity: 0,
            trudodniEarned: 0,
            health: 100,
          },
          {
            id: 'm4',
            name: 'Babushka',
            gender: 'female',
            age: 72,
            role: 'elder',
            laborCapacity: 0.1,
            trudodniEarned: 0,
            health: 80,
          },
        ],
        headOfHousehold: 'm1',
        privatePlotSize: 0.25,
        privateLivestock: { cow: 1, pig: 0, sheep: 0, poultry: 3 },
        joinedTick: 0,
        loyaltyToCollective: 60,
        surname: 'Ivanov',
      },
      isDvor: true,
    });

    const raion = collapseEntitiesToBuildings(w);

    expect(raion.totalPopulation).toBe(4);
    expect(raion.totalHouseholds).toBe(1);

    // Ivan (35) → bucket 7 (35/5=7), male
    expect(raion.maleAgeBuckets[7]).toBe(1);
    // Maria (32) → bucket 6 (32/5=6), female
    expect(raion.femaleAgeBuckets[6]).toBe(1);
    // Petya (8) → bucket 1 (8/5=1), male
    expect(raion.maleAgeBuckets[1]).toBe(1);
    // Babushka (72) → bucket 14 (72/5=14), female
    expect(raion.femaleAgeBuckets[14]).toBe(1);
  });

  it('tracks pregnancy waves correctly', () => {
    w.add({
      dvor: {
        id: 'dvor-preg',
        members: [
          {
            id: 'm1',
            name: 'Head',
            gender: 'male',
            age: 30,
            role: 'head',
            laborCapacity: 1.0,
            trudodniEarned: 0,
            health: 100,
          },
          // Newly conceived (high ticks remaining)
          {
            id: 'm2',
            name: 'Anna',
            gender: 'female',
            age: 25,
            role: 'spouse',
            laborCapacity: 0.7,
            trudodniEarned: 0,
            health: 100,
            pregnant: 80,
          },
          // Mid-term
          {
            id: 'm3',
            name: 'Olga',
            gender: 'female',
            age: 28,
            role: 'worker',
            laborCapacity: 0.6,
            trudodniEarned: 0,
            health: 100,
            pregnant: 45,
          },
          // About to deliver (low ticks remaining)
          {
            id: 'm4',
            name: 'Natasha',
            gender: 'female',
            age: 22,
            role: 'worker',
            laborCapacity: 0.5,
            trudodniEarned: 0,
            health: 100,
            pregnant: 10,
          },
        ],
        headOfHousehold: 'm1',
        privatePlotSize: 0.1,
        privateLivestock: { cow: 0, pig: 0, sheep: 0, poultry: 0 },
        joinedTick: 0,
        loyaltyToCollective: 50,
        surname: 'Petrov',
      },
      isDvor: true,
    });

    const raion = collapseEntitiesToBuildings(w);

    // pregnancyWaves: [delivering, mid-term, newly conceived]
    expect(raion.pregnancyWaves[0]).toBe(1); // Natasha (10 ticks, ratio < 0.33)
    expect(raion.pregnancyWaves[1]).toBe(1); // Olga (45 ticks, 0.33 < ratio < 0.66)
    expect(raion.pregnancyWaves[2]).toBe(1); // Anna (80 ticks, ratio > 0.66)
  });

  it('removes all citizen and dvor entities after collapse', () => {
    // Add a building
    w.add({
      building: makeBuilding('factory-a'),
      position: { gridX: 0, gridY: 0 },
    });

    // Add citizens
    for (let i = 0; i < 5; i++) {
      w.add({
        citizen: {
          class: 'worker',
          happiness: 50,
          hunger: 0,
          assignment: 'factory-a',
        },
        position: { gridX: i + 1, gridY: 0 },
      });
    }

    // Add dvory
    w.add({
      dvor: {
        id: 'dvor-1',
        members: [
          {
            id: 'm1',
            name: 'Ivan',
            gender: 'male',
            age: 30,
            role: 'head',
            laborCapacity: 1.0,
            trudodniEarned: 0,
            health: 100,
          },
        ],
        headOfHousehold: 'm1',
        privatePlotSize: 0,
        privateLivestock: { cow: 0, pig: 0, sheep: 0, poultry: 0 },
        joinedTick: 0,
        loyaltyToCollective: 50,
        surname: 'Ivanov',
      },
      isDvor: true,
    });

    // Verify entities exist before collapse
    expect([...w.with('citizen')].length).toBe(5);
    expect([...w.with('dvor')].length).toBe(1);

    collapseEntitiesToBuildings(w);

    // After collapse, no citizens or dvory remain
    expect([...w.with('citizen')].length).toBe(0);
    expect([...w.with('dvor')].length).toBe(0);

    // Building still exists
    expect([...w.with('building')].length).toBe(1);
  });

  it('weighted average blending produces correct results', () => {
    const factory = w.add({
      building: makeBuilding('factory-a'),
      position: { gridX: 0, gridY: 0 },
    });

    // Citizen 1: happiness 100
    w.add({
      citizen: {
        class: 'worker',
        happiness: 100,
        hunger: 0,
        assignment: 'factory-a',
      },
      position: { gridX: 1, gridY: 0 },
    });

    // Citizen 2: happiness 0
    w.add({
      citizen: {
        class: 'worker',
        happiness: 0,
        hunger: 0,
        assignment: 'factory-a',
      },
      position: { gridX: 2, gridY: 0 },
    });

    // Citizen 3: happiness 50
    w.add({
      citizen: {
        class: 'worker',
        happiness: 50,
        hunger: 0,
        assignment: 'factory-a',
      },
      position: { gridX: 3, gridY: 0 },
    });

    collapseEntitiesToBuildings(w);

    // Average morale should be (100 + 0 + 50) / 3 = 50
    expect(factory.building!.avgMorale).toBe(50);
    expect(factory.building!.workerCount).toBe(3);
    // Default skill/loyalty/vodkaDep for all
    expect(factory.building!.avgSkill).toBe(30);
    expect(factory.building!.avgLoyalty).toBe(50);
    expect(factory.building!.avgVodkaDep).toBe(10);
  });

  it('counts class distribution in raion', () => {
    // Create citizens of different classes
    w.add({
      citizen: { class: 'worker', happiness: 50, hunger: 0 },
      position: { gridX: 0, gridY: 0 },
    });
    w.add({
      citizen: { class: 'worker', happiness: 50, hunger: 0 },
      position: { gridX: 1, gridY: 0 },
    });
    w.add({
      citizen: { class: 'farmer', happiness: 50, hunger: 0 },
      position: { gridX: 2, gridY: 0 },
    });
    w.add({
      citizen: { class: 'engineer', happiness: 50, hunger: 0 },
      position: { gridX: 3, gridY: 0 },
    });

    const raion = collapseEntitiesToBuildings(w);

    expect(raion.classCounts.worker).toBe(2);
    expect(raion.classCounts.farmer).toBe(1);
    expect(raion.classCounts.engineer).toBe(1);
  });

  it('sets household counts on housing buildings from dvor citizens', () => {
    const house = w.add({
      building: makeBuilding('house-a', 20),
      position: { gridX: 5, gridY: 5 },
    });

    // Two citizens from different dvory living in the same house
    w.add({
      citizen: {
        class: 'worker',
        happiness: 50,
        hunger: 0,
        home: { gridX: 5, gridY: 5 },
        dvorId: 'dvor-1',
      },
      position: { gridX: 0, gridY: 0 },
    });
    w.add({
      citizen: {
        class: 'worker',
        happiness: 50,
        hunger: 0,
        home: { gridX: 5, gridY: 5 },
        dvorId: 'dvor-2',
      },
      position: { gridX: 1, gridY: 0 },
    });
    // Another citizen from dvor-1 (same household)
    w.add({
      citizen: {
        class: 'farmer',
        happiness: 50,
        hunger: 0,
        home: { gridX: 5, gridY: 5 },
        dvorId: 'dvor-1',
      },
      position: { gridX: 2, gridY: 0 },
    });

    collapseEntitiesToBuildings(w);

    // 3 residents, but only 2 unique dvorIds
    expect(house.building!.residentCount).toBe(3);
    expect(house.building!.householdCount).toBe(2);
  });

  it('handles empty world gracefully', () => {
    const raion = collapseEntitiesToBuildings(w);

    expect(raion.totalPopulation).toBe(0);
    expect(raion.totalHouseholds).toBe(0);
    expect(raion.laborForce).toBe(0);
    expect(raion.assignedWorkers).toBe(0);
    expect(raion.idleWorkers).toBe(0);
  });

  it('calculates labor force from working-age buckets', () => {
    // Create a dvor with members at various ages
    w.add({
      dvor: {
        id: 'dvor-labor',
        members: [
          // Working age (15-59): buckets 3-11
          {
            id: 'm1',
            name: 'Worker1',
            gender: 'male',
            age: 20,
            role: 'worker',
            laborCapacity: 1.0,
            trudodniEarned: 0,
            health: 100,
          },
          {
            id: 'm2',
            name: 'Worker2',
            gender: 'female',
            age: 40,
            role: 'worker',
            laborCapacity: 1.0,
            trudodniEarned: 0,
            health: 100,
          },
          {
            id: 'm3',
            name: 'Worker3',
            gender: 'male',
            age: 55,
            role: 'worker',
            laborCapacity: 0.8,
            trudodniEarned: 0,
            health: 90,
          },
          // Not working age
          {
            id: 'm4',
            name: 'Child',
            gender: 'male',
            age: 10,
            role: 'child',
            laborCapacity: 0,
            trudodniEarned: 0,
            health: 100,
          },
          {
            id: 'm5',
            name: 'Elder',
            gender: 'female',
            age: 70,
            role: 'elder',
            laborCapacity: 0.1,
            trudodniEarned: 0,
            health: 80,
          },
        ],
        headOfHousehold: 'm1',
        privatePlotSize: 0.2,
        privateLivestock: { cow: 0, pig: 0, sheep: 0, poultry: 0 },
        joinedTick: 0,
        loyaltyToCollective: 50,
        surname: 'Workers',
      },
      isDvor: true,
    });

    const raion = collapseEntitiesToBuildings(w);

    // 3 working-age members (20, 40, 55)
    expect(raion.laborForce).toBe(3);
    // No citizens assigned, so 0 assigned workers
    expect(raion.assignedWorkers).toBe(0);
    expect(raion.idleWorkers).toBe(3);
  });
});
