import { GRID_SIZE } from '@/config';
import { underConstruction } from '@/ecs/archetypes';
import { createBuilding, createGrid, createMetaStore, createResourceStore } from '@/ecs/factories';
import { world } from '@/ecs/world';
import { CollectivePlanner } from '@/game/CollectivePlanner';
import { createPlanMandateState } from '@/game/PlanMandates';
import { GameRng } from '@/game/SeedSystem';
import { autoPlaceBuilding } from '@/game/workers/autoBuilder';
import { detectConstructionDemands } from '@/game/workers/demandSystem';

describe('Collective Autonomy Integration', () => {
  let planner: CollectivePlanner;
  let rng: GameRng;

  beforeEach(() => {
    world.clear();
    createGrid(GRID_SIZE);
    createResourceStore({ food: 50, population: 30, timber: 500, steel: 100, cement: 50 });
    createMetaStore();
    // Use power-station as seed building (powerReq: 0) so it doesn't
    // trigger spurious power demands in the "no demands" test case.
    createBuilding(15, 15, 'power-station');
    planner = new CollectivePlanner();
    rng = new GameRng('test-collective');
  });

  afterEach(() => {
    world.clear();
  });

  it('full pipeline: low food → demand → planner → auto-place farm', () => {
    const demands = detectConstructionDemands(30, 100, { food: 50, vodka: 0, power: 0 });
    expect(demands.some((d) => d.category === 'food_production')).toBe(true);

    const queue = planner.generateQueue(null, demands);
    expect(queue.length).toBeGreaterThan(0);

    const firstRequest = queue[0]!;
    const entity = autoPlaceBuilding(firstRequest.defId, rng);
    expect(entity).not.toBeNull();
    expect(entity!.building.constructionPhase).toBe('foundation');
    expect(underConstruction.entities.length).toBeGreaterThanOrEqual(1);
  });

  it('mandate-driven: unfulfilled mandate triggers auto-placement', () => {
    const mandateState = createPlanMandateState([{ defId: 'power-station', required: 1, label: 'Power Station' }]);

    const queue = planner.generateQueue(mandateState, []);
    expect(queue.length).toBe(1);

    const entity = autoPlaceBuilding(queue[0]!.defId, rng);
    expect(entity).not.toBeNull();
    expect(entity!.building.defId).toBe('power-station');
  });

  it('does not auto-place when queue is empty (all fulfilled, no demands)', () => {
    const mandateState = createPlanMandateState([{ defId: 'power-station', required: 1, label: 'Power Station' }]);
    mandateState.mandates[0]!.fulfilled = 1;

    const demands = detectConstructionDemands(30, 100, { food: 500, vodka: 50, power: 100 });
    expect(demands.length).toBe(0);

    const queue = planner.generateQueue(mandateState, demands);
    expect(queue.length).toBe(0);
  });
});
