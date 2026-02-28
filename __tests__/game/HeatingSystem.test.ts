/**
 * Tests for heating system fuel consumption and penalties.
 *
 * Verifies that:
 * - Fuel is consumed during winter months when heating is operational
 * - No fuel consumed in summer
 * - Pechka tier consumes timber, district/crumbling consume power
 * - Heating failure causes morale penalty
 * - Heating failure causes population attrition
 */

import { HEATING_CONFIGS, EconomySystem, DISTRICT_HEATING_POPULATION } from '../../src/game/economy';
import { HEATING_FAILURE_MORALE_PENALTY } from '../../src/game/workers/constants';
import { applyMorale } from '../../src/game/workers/classes';
import type { CitizenComponent } from '../../src/ecs/world';
import type { WorkerStats } from '../../src/game/workers/types';

describe('Heating fuel consumption', () => {
  it('pechka consumes timber during winter', () => {
    const sys = new EconomySystem('revolution', 'comrade');
    const result = sys.processHeating(50, 1, true); // January, has fuel
    expect(result.fuelConsumed).not.toBeNull();
    expect(result.fuelConsumed!.resource).toBe('timber');
    expect(result.fuelConsumed!.amount).toBe(HEATING_CONFIGS.pechka.consumption.amount);
  });

  it('district consumes power during winter', () => {
    const sys = new EconomySystem('stagnation', 'comrade');
    // Force district tier by processing with enough population
    sys.processHeating(DISTRICT_HEATING_POPULATION, 6, true);
    expect(sys.getHeating().tier).toBe('district');

    const result = sys.processHeating(DISTRICT_HEATING_POPULATION, 12, true); // December
    expect(result.fuelConsumed).not.toBeNull();
    expect(result.fuelConsumed!.resource).toBe('power');
    expect(result.fuelConsumed!.amount).toBe(HEATING_CONFIGS.district.consumption.amount);
  });

  it('no fuel consumed in summer', () => {
    const sys = new EconomySystem('revolution', 'comrade');
    const result = sys.processHeating(50, 7, true); // July
    expect(result.fuelConsumed).toBeNull();
  });

  it('no fuel consumed when heating resource unavailable', () => {
    const sys = new EconomySystem('revolution', 'comrade');
    const result = sys.processHeating(50, 1, false); // January, no fuel
    expect(result.fuelConsumed).toBeNull();
    expect(result.operational).toBe(false);
  });

  it('population at risk when heating fails in winter', () => {
    const sys = new EconomySystem('revolution', 'comrade');
    const result = sys.processHeating(100, 2, false); // February, no fuel
    expect(result.populationAtRisk).toBeGreaterThan(0);
    expect(sys.getHeating().failing).toBe(true);
  });

  it('no population at risk when heating operational in winter', () => {
    const sys = new EconomySystem('revolution', 'comrade');
    const result = sys.processHeating(100, 2, true); // February, has fuel
    expect(result.populationAtRisk).toBe(0);
    expect(result.operational).toBe(true);
  });
});

describe('Heating morale penalty', () => {
  function makeWorker(): { citizen: CitizenComponent; stats: WorkerStats } {
    return {
      citizen: { class: 'worker', happiness: 50, hunger: 0, home: { gridX: 0, gridY: 0 } } as CitizenComponent,
      stats: {
        morale: 80,
        loyalty: 50,
        skill: 50,
        vodkaDependency: 0,
        ticksSinceVodka: 0,
        name: 'Test',
        assignmentDuration: 0,
        assignmentSource: 'auto' as const,
      } as WorkerStats,
    };
  }

  it('heating failure reduces morale by HEATING_FAILURE_MORALE_PENALTY', () => {
    const { citizen: c1, stats: s1 } = makeWorker();
    const { citizen: c2, stats: s2 } = makeWorker();

    applyMorale(c1, s1, 0, false);
    applyMorale(c2, s2, 0, true);

    expect(s1.morale - s2.morale).toBe(HEATING_FAILURE_MORALE_PENALTY);
  });

  it('morale penalty is exactly 30', () => {
    expect(HEATING_FAILURE_MORALE_PENALTY).toBe(30);
  });

  it('morale does not go below 0 with heating penalty', () => {
    const { citizen, stats } = makeWorker();
    stats.morale = 10;
    applyMorale(citizen, stats, 0, true);
    expect(stats.morale).toBeGreaterThanOrEqual(0);
  });
});
