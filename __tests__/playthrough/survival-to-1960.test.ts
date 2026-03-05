/**
 * Playthrough integration test: ChairmanAgent autonomous survival 1917-1960
 *
 * Verifies that the ChairmanAgent (Yuka autopilot) can keep the settlement
 * alive autonomously from 1917 to 1960 (43 years) without manual intervention.
 *
 * The settlement gets generous starting resources (standard Soviet allotment)
 * and a robust infrastructure. The ChairmanAgent handles all decisions:
 * collective focus, minigames, annual reports, bribes.
 */

import { resetStarvationCounter } from '../../src/ai/agents/economy/consumptionSystem';
import { getResourceEntity } from '../../src/ecs/archetypes';
import { createBuilding } from '../../src/ecs/factories';
import { world } from '../../src/ecs/world';
import type { SimulationEngine } from '../../src/game/SimulationEngine';
import {
  buildFullEconomy,
  createPlaythroughEngine,
  getBuildingCount,
  getDate,
  getGameOverReason,
  getResources,
  isGameOver,
  TICKS_PER_YEAR,
} from './helpers';

afterEach(() => {
  world.clear();
  resetStarvationCounter();
  jest.restoreAllMocks();
});

/** Capture a yearly log line for diagnostics. */
function logYear(engine: SimulationEngine): string {
  const date = getDate();
  const res = getResources();
  const raion = getResourceEntity()?.resources.raion;
  const pop = raion?.totalPopulation ?? res.population;
  const era = engine.getPoliticalAgent().getCurrentEraId();
  const marks = engine.getKGBAgent().getBlackMarks();
  const buildings = getBuildingCount();
  return `  ${date.year} | pop=${String(pop).padStart(6)} | food=${String(Math.round(res.food)).padStart(7)} | vodka=${String(Math.round(res.vodka)).padStart(6)} | era=${era.padEnd(18)} | marks=${marks} | bldgs=${buildings}`;
}

/**
 * Build a robust starting settlement — enough to survive the early decades.
 * 4 farms, 3 housing, 2 power, distillery, warehouse.
 */
function buildRobustSettlement(): void {
  buildFullEconomy(); // power + housing + farm + distillery + warehouse
  // Additional farms — food is the primary bottleneck
  createBuilding(10, 0, 'collective-farm-hq');
  createBuilding(12, 0, 'collective-farm-hq');
  createBuilding(14, 0, 'collective-farm-hq');
  // Extra housing
  createBuilding(10, 2, 'apartment-tower-a');
  createBuilding(12, 2, 'apartment-tower-b');
  // Second power station
  createBuilding(14, 2, 'power-station');
  // Second distillery + warehouse
  createBuilding(10, 4, 'vodka-distillery');
  createBuilding(12, 4, 'warehouse');
}

describe('ChairmanAgent autonomous survival', () => {
  it('survives 1917 to 1960 without manual intervention', () => {
    const { engine } = createPlaythroughEngine({
      meta: { date: { year: 1917, month: 10, tick: 0 } },
      resources: {
        population: 50,
        food: 50000,
        vodka: 10000,
        money: 50000,
        timber: 20000,
        steel: 10000,
        cement: 10000,
      },
      consequence: 'rehabilitated',
      deterministicRandom: false,
    });

    buildRobustSettlement();
    engine.enableAutopilot();

    const startYear = getDate().year;
    const targetYear = 1960;
    const maxTicks = (targetYear - startYear + 5) * TICKS_PER_YEAR; // budget with margin

    const yearLogs: string[] = [];
    let lastLogYear = startYear;
    let totalTicks = 0;
    let gameOverFired = false;
    let deathYear = 0;
    let deathReason = '';

    // Capture initial state
    yearLogs.push(logYear(engine));

    while (totalTicks < maxTicks) {
      engine.tick();
      totalTicks++;

      if (isGameOver() && !gameOverFired) {
        gameOverFired = true;
        deathYear = getDate().year;
        deathReason = getGameOverReason() ?? 'unknown';
        yearLogs.push(logYear(engine));
        break;
      }

      const currentYear = getDate().year;
      if (currentYear !== lastLogYear) {
        yearLogs.push(logYear(engine));
        lastLogYear = currentYear;
        if (currentYear >= targetYear) break;
      }
    }

    // Print diagnostic log
    console.log('\n  === ChairmanAgent Survival Audit (1917-1960) ===');
    console.log('  Year | Pop    | Food    | Vodka  | Era                | Marks | Bldgs');
    console.log('  -----+--------+---------+--------+--------------------+-------+------');
    for (const line of yearLogs) {
      console.log(line);
    }

    if (gameOverFired) {
      console.log(`\n  DIED in ${deathYear}: ${deathReason}`);
    } else {
      console.log(`\n  SURVIVED to ${getDate().year}`);
    }

    // Assertions
    const finalYear = getDate().year;
    expect(gameOverFired).toBe(false);
    expect(finalYear).toBeGreaterThanOrEqual(1960);
  }, 60000); // 60s timeout for 43 game-years
});
