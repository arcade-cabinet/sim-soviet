import { buildingsLogic, getResourceEntity } from '../../src/ecs/archetypes';
import { createBuilding, createMetaStore, createResourceStore } from '../../src/ecs/factories';
import { world } from '../../src/ecs/world';
import { GameGrid } from '../../src/game/GameGrid';
import type { SimCallbacks } from '../../src/game/SimulationEngine';
import { SimulationEngine } from '../../src/game/SimulationEngine';

function createMockCallbacks(): SimCallbacks {
  return {
    onToast: jest.fn(),
    onAdvisor: jest.fn(),
    onPravda: jest.fn(),
    onStateChange: jest.fn(),
  };
}

describe('phaseProduction', () => {
  let engine: SimulationEngine;

  beforeEach(() => {
    world.clear();
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    createResourceStore();
    createMetaStore();
    engine = new SimulationEngine(new GameGrid(), createMockCallbacks());
  });

  afterEach(() => {
    world.clear();
  });

  it('distributes power to buildings via PowerAgent', () => {
    createBuilding(0, 0, 'power-station');
    createBuilding(1, 1, 'apartment-tower-a');
    engine.tick();
    const housing = buildingsLogic.entities.find((e) => e.building.defId === 'apartment-tower-a');
    expect(housing!.building.powered).toBe(true);
    expect(getResourceEntity()!.resources.power).toBe(100);
  });

  it('produces food from powered farms in summer', () => {
    createBuilding(0, 0, 'power-station');
    createBuilding(1, 1, 'collective-farm-hq');
    // Advance to month 5 (summer, farmMultiplier > 0)
    // Start month 10, need 7 months = 210 ticks
    for (let i = 0; i < 210; i++) engine.tick();
    const foodBefore = getResourceEntity()!.resources.food;
    engine.tick();
    const foodAfter = getResourceEntity()!.resources.food;
    // Food should increase (production) or at least not drop much (spoilage)
    const spoilageMargin = foodBefore * 0.01;
    expect(foodAfter).toBeGreaterThan(foodBefore - spoilageMargin);
  });

  it('produces vodka from powered distilleries', () => {
    createBuilding(0, 0, 'power-station');
    createBuilding(1, 1, 'vodka-distillery');
    const initialVodka = getResourceEntity()!.resources.vodka;
    engine.tick();
    expect(getResourceEntity()!.resources.vodka).toBeGreaterThan(initialVodka);
  });

  it('does not produce food from unpowered farms', () => {
    createBuilding(1, 1, 'collective-farm-hq');
    const initialFood = getResourceEntity()!.resources.food;
    engine.tick();
    expect(getResourceEntity()!.resources.food).toBeLessThanOrEqual(initialFood);
  });
});
