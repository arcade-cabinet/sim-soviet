// Quick diagnostic: trace population year-by-year for a worker run

import { resetStarvationCounter } from '../../src/ai/agents/economy/consumptionSystem';
import { DIFFICULTY_PRESETS } from '../../src/ai/agents/political/ScoringSystem';
import { getResourceEntity } from '../../src/ecs/archetypes';
import { createBuilding, createMetaStore, createResourceStore } from '../../src/ecs/factories';
import { createDvor } from '../../src/ecs/factories/settlementFactories';
import { world } from '../../src/ecs/world';
import { GameGrid } from '../../src/game/GameGrid';
import { GameRng } from '../../src/game/SeedSystem';
import { SimulationEngine } from '../../src/game/SimulationEngine';
import { createMockCallbacks, getDate, getGameOverReason, getResources, isGameOver, TICKS_PER_YEAR } from './helpers';

describe('Population Diagnostic', () => {
  afterEach(() => {
    world.clear();
    jest.restoreAllMocks();
    resetStarvationCounter();
  });

  it('traces pop year-by-year for worker difficulty', () => {
    const seed = 'diag-worker-0';
    const difficulty = 'worker';
    const resMult = DIFFICULTY_PRESETS[difficulty].resourceMultiplier;

    createResourceStore({
      food: Math.round(50000 * resMult),
      vodka: Math.round(10000 * resMult),
      money: Math.round(50000 * resMult),
      timber: Math.round(20000 * resMult),
      steel: Math.round(10000 * resMult),
      cement: Math.round(10000 * resMult),
      population: 0,
    });
    createMetaStore({ date: { year: 1917, month: 10, tick: 0 } });

    // Create mixed-gender dvory
    for (let i = 0; i < 50; i++) {
      const members =
        i % 3 !== 2
          ? [
              { name: `H${i}`, gender: 'male' as const, age: 25 + (i % 10) },
              { name: `W${i}`, gender: 'female' as const, age: 23 + (i % 8) },
            ]
          : [{ name: `S${i}`, gender: 'male' as const, age: 30 }];
      createDvor(`${seed}-dvor-${i}`, `F${i}`, members);
    }

    const grid = new GameGrid();
    const callbacks = createMockCallbacks();
    // Disable interactive callbacks so engine auto-evaluates quotas and minigames
    (callbacks as Record<string, unknown>).onAnnualReport = undefined;
    (callbacks as Record<string, unknown>).onMinigame = undefined;
    const rng = new GameRng(seed);
    const engine = new SimulationEngine(grid, callbacks as never, rng, difficulty, 'rehabilitated');

    // Build settlement
    createBuilding(0, 0, 'power-station');
    createBuilding(2, 0, 'apartment-tower-a');
    createBuilding(4, 0, 'collective-farm-hq');
    createBuilding(6, 0, 'vodka-distillery');
    createBuilding(8, 0, 'warehouse');
    createBuilding(10, 0, 'collective-farm-hq');
    createBuilding(12, 0, 'collective-farm-hq');
    createBuilding(14, 0, 'collective-farm-hq');
    createBuilding(10, 2, 'apartment-tower-a');
    createBuilding(12, 2, 'apartment-tower-b');
    createBuilding(14, 2, 'power-station');
    createBuilding(10, 4, 'vodka-distillery');
    createBuilding(12, 4, 'warehouse');

    let lastYear = 1917;
    const log: string[] = [];

    for (let tick = 0; tick < 200 * TICKS_PER_YEAR; tick++) {
      engine.tick();
      if (isGameOver()) {
        const r = getResources();
        const raion = getResourceEntity()?.resources.raion;
        const pop = raion?.totalPopulation ?? r.population;
        log.push(`GAME OVER at year ${getDate().year}: pop=${pop}, reason=${getGameOverReason()}`);
        break;
      }
      try {
        const d = getDate();
        if (d.year > lastYear) {
          const r = getResources();
          const raion = getResourceEntity()?.resources.raion;
          const pop = raion?.totalPopulation ?? r.population;
          const mode = raion ? 'AGG' : 'ENT';
          if (d.year % 5 === 0 || d.year <= 1925) {
            log.push(`${d.year}: pop=${pop} [${mode}] food=${r.food} vodka=${r.vodka} timber=${r.timber}`);
          }
          lastYear = d.year;
        }
      } catch {
        break;
      }
    }

    console.log('\n=== POPULATION TRACE (Worker) ===');
    for (const line of log) console.log(line);
    console.log('');

    expect(log.length).toBeGreaterThan(0);
  }, 120000);
});
