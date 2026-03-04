// __tests__/economy/buildingTick.test.ts
import {
  type BuildingTickContext,
  type BuildingTickInput,
  tickBuilding,
} from '../../src/ai/agents/economy/buildingTick';

describe('tickBuilding', () => {
  const baseBuilding: BuildingTickInput = {
    defId: 'collective-farm-hq',
    workerCount: 10,
    avgSkill: 60,
    avgMorale: 70,
    avgLoyalty: 50,
    powered: true,
    baseRate: 5,
    tileFertility: 80,
  };

  const baseCtx: BuildingTickContext = {
    weather: 'clear',
    season: 'summer',
    activeCrisisModifier: 1.0,
  };

  it('computes positive output for a working farm', () => {
    const result = tickBuilding(baseBuilding, baseCtx);
    expect(result.netOutput).toBeGreaterThan(0);
  });

  it('zero workers means zero output', () => {
    const result = tickBuilding({ ...baseBuilding, workerCount: 0 }, baseCtx);
    expect(result.netOutput).toBe(0);
  });

  it('unpowered building produces nothing', () => {
    const result = tickBuilding({ ...baseBuilding, powered: false }, baseCtx);
    expect(result.netOutput).toBe(0);
  });

  it('crisis modifier reduces output', () => {
    const normal = tickBuilding(baseBuilding, baseCtx);
    const crisis = tickBuilding(baseBuilding, { ...baseCtx, activeCrisisModifier: 0.5 });
    expect(crisis.netOutput).toBeLessThan(normal.netOutput);
  });

  it('winter reduces farm output', () => {
    const summer = tickBuilding(baseBuilding, baseCtx);
    const winter = tickBuilding(baseBuilding, { ...baseCtx, season: 'winter' });
    expect(winter.netOutput).toBeLessThan(summer.netOutput);
  });

  it('pure function: no mutation of inputs', () => {
    const building = { ...baseBuilding };
    const ctx = { ...baseCtx };
    tickBuilding(building, ctx);
    expect(building).toEqual(baseBuilding);
    expect(ctx).toEqual(baseCtx);
  });
});
