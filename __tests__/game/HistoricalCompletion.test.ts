/**
 * TDD: 1991 historical campaign completion — onHistoricalEraEnd fires once
 * at year >= 1991. resolve(true) continues the same grounded settlement;
 * resolve(false) ends the campaign.
 */

import { HistoricalGovernor } from '../../src/ai/agents/crisis/HistoricalGovernor';
import { world } from '../../src/ecs/world';
import {
  advanceTicks,
  buildBasicSettlement,
  createPlaythroughEngine,
  getResources,
  TICKS_PER_MONTH,
  TICKS_PER_YEAR,
} from '../playthrough/helpers';

afterEach(() => {
  world.clear();
  jest.restoreAllMocks();
});

describe('Historical 1991 campaign completion', () => {
  it('fires onHistoricalEraEnd exactly once when historical mode reaches year 1991', () => {
    const { engine, callbacks } = createPlaythroughEngine({
      meta: { date: { year: 1990, month: 10, tick: 0 } },
      resources: { food: 999999, vodka: 999999, money: 999999 },
    });

    let fireCount = 0;
    (callbacks.onHistoricalEraEnd as jest.Mock).mockImplementation((resolve: (c: boolean) => void) => {
      fireCount++;
      resolve(true); // continue — don't block the engine
    });

    buildBasicSettlement({ housing: 2, farms: 1, power: 1 });

    getResources().food = 999999;
    advanceTicks(engine, TICKS_PER_MONTH * 4);
    advanceTicks(engine, TICKS_PER_YEAR);

    expect(fireCount).toBe(1);
  });

  it('resolve(true) keeps the historical governor and continues post-campaign once', () => {
    const { engine, callbacks } = createPlaythroughEngine({
      meta: { date: { year: 1990, month: 1, tick: 0 } },
      resources: { food: 999999, vodka: 999999, money: 999999 },
    });
    const governor = new HistoricalGovernor();
    engine.setGovernor(governor);

    (callbacks.onHistoricalEraEnd as jest.Mock).mockImplementation((resolve: (c: boolean) => void) => {
      resolve(true);
    });

    buildBasicSettlement({ housing: 2, farms: 1, power: 1 });

    getResources().food = 999999;
    advanceTicks(engine, TICKS_PER_MONTH * 4);
    advanceTicks(engine, TICKS_PER_YEAR);

    expect(callbacks.onHistoricalEraEnd).toHaveBeenCalledTimes(1);
    expect(engine.getGovernor()).toBe(governor);
  });

  it('resolve(false) triggers game over with reason ussr_dissolved', () => {
    const { engine, callbacks } = createPlaythroughEngine({
      meta: { date: { year: 1990, month: 1, tick: 0 } },
      resources: { food: 999999, vodka: 999999, money: 999999 },
    });

    (callbacks.onHistoricalEraEnd as jest.Mock).mockImplementation((resolve: (c: boolean) => void) => {
      resolve(false);
    });
    callbacks.onAnnualReport = undefined as never;

    buildBasicSettlement({ housing: 2, farms: 1, power: 1 });

    getResources().food = 999999;
    advanceTicks(engine, TICKS_PER_MONTH * 4);

    expect(callbacks.onGameOver).toHaveBeenCalledWith(false, expect.stringContaining('ussr_dissolved'));
  });

  it('auto-resolves as grounded continuation if onHistoricalEraEnd is not handled', () => {
    const { engine, callbacks } = createPlaythroughEngine({
      meta: { date: { year: 1990, month: 1, tick: 0 } },
      resources: { food: 999999, vodka: 999999, money: 999999 },
    });

    // Do NOT mock onHistoricalEraEnd — leave it as undefined
    callbacks.onHistoricalEraEnd = undefined as never;
    callbacks.onAnnualReport = undefined as never;

    buildBasicSettlement({ housing: 2, farms: 1, power: 1 });

    getResources().food = 999999;
    advanceTicks(engine, TICKS_PER_MONTH * 4);

    expect(callbacks.onGameOver).not.toHaveBeenCalled();
  });

  it('grounded continuation resets overdue campaign quota failure pressure', () => {
    const { engine, callbacks } = createPlaythroughEngine({
      meta: { date: { year: 1990, month: 10, tick: 0 } },
      resources: { food: 100, vodka: 0, money: 999999 },
    });

    const quota = engine.getQuota() as { target: number; current: number; deadlineYear: number };
    quota.target = 100;
    quota.current = 0;
    quota.deadlineYear = 1977;
    (engine as unknown as { consecutiveQuotaFailures: number }).consecutiveQuotaFailures = 7;

    (callbacks.onHistoricalEraEnd as jest.Mock).mockImplementation((resolve: (c: boolean) => void) => {
      resolve(true);
    });
    callbacks.onAnnualReport = undefined as never;

    buildBasicSettlement({ housing: 2, farms: 1, power: 1 });

    advanceTicks(engine, TICKS_PER_MONTH * 4);

    expect(callbacks.onHistoricalEraEnd).toHaveBeenCalledTimes(1);
    expect(callbacks.onGameOver).not.toHaveBeenCalled();
    expect((engine as unknown as { consecutiveQuotaFailures: number }).consecutiveQuotaFailures).toBe(0);
    expect(engine.getQuota().deadlineYear).toBeGreaterThanOrEqual(1996);
  });
});
