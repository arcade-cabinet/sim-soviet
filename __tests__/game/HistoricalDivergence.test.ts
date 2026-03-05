/**
 * TDD: 1991 historical divergence — onHistoricalEraEnd fires once at year >= 1991
 * in historical mode, doesn't fire in freeform, resolve(true) switches governor,
 * resolve(false) ends the game.
 */

import { world } from '../../src/ecs/world';
import {
  advanceTicks,
  buildBasicSettlement,
  createPlaythroughEngine,
  getResources,
  TICKS_PER_YEAR,
} from '../playthrough/helpers';
import { FreeformGovernor } from '../../src/ai/agents/crisis/FreeformGovernor';

afterEach(() => {
  world.clear();
  jest.restoreAllMocks();
});

describe('Historical 1991 divergence', () => {
  it('fires onHistoricalEraEnd exactly once when historical mode reaches year 1991', () => {
    const { engine, callbacks } = createPlaythroughEngine({
      meta: { date: { year: 1989, month: 1, tick: 0 } },
      resources: { food: 999999, vodka: 999999, money: 999999 },
    });

    let fireCount = 0;
    (callbacks.onHistoricalEraEnd as jest.Mock).mockImplementation((resolve: (c: boolean) => void) => {
      fireCount++;
      resolve(true); // continue — don't block the engine
    });

    buildBasicSettlement({ housing: 2, farms: 1, power: 1 });

    // Advance 5 years: 1989 → 1994 (crosses 1991)
    for (let y = 0; y < 5; y++) {
      getResources().food = 999999;
      advanceTicks(engine, TICKS_PER_YEAR);
    }

    expect(fireCount).toBe(1);
  });

  it('does NOT fire onHistoricalEraEnd in freeform mode', () => {
    const { engine, callbacks } = createPlaythroughEngine({
      meta: { date: { year: 1989, month: 1, tick: 0 } },
      resources: { food: 999999, vodka: 999999, money: 999999 },
    });
    // Override to freeform governor directly
    const { FreeformGovernor: FG } = jest.requireActual('../../src/ai/agents/crisis/FreeformGovernor') as typeof import('../../src/ai/agents/crisis/FreeformGovernor');
    engine.setGovernor(new FG());

    buildBasicSettlement({ housing: 2, farms: 1, power: 1 });

    for (let y = 0; y < 5; y++) {
      getResources().food = 999999;
      advanceTicks(engine, TICKS_PER_YEAR);
    }

    expect(callbacks.onHistoricalEraEnd).not.toHaveBeenCalled();
  });

  it('resolve(true) switches engine to freeform mode', () => {
    const { engine, callbacks } = createPlaythroughEngine({
      meta: { date: { year: 1990, month: 1, tick: 0 } },
      resources: { food: 999999, vodka: 999999, money: 999999 },
    });

    (callbacks.onHistoricalEraEnd as jest.Mock).mockImplementation((resolve: (c: boolean) => void) => {
      resolve(true);
    });

    buildBasicSettlement({ housing: 2, farms: 1, power: 1 });

    for (let y = 0; y < 3; y++) {
      getResources().food = 999999;
      advanceTicks(engine, TICKS_PER_YEAR);
    }

    // After resolve(true), governor should be FreeformGovernor
    const gov = engine.getGovernor();
    expect(gov).toBeInstanceOf(FreeformGovernor);
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

    for (let y = 0; y < 3; y++) {
      getResources().food = 999999;
      advanceTicks(engine, TICKS_PER_YEAR);
    }

    expect(callbacks.onGameOver).toHaveBeenCalledWith(
      false,
      expect.stringContaining('ussr_dissolved'),
    );
  });

  it('auto-resolves as continue (freeform) if onHistoricalEraEnd not handled', () => {
    const { engine, callbacks } = createPlaythroughEngine({
      meta: { date: { year: 1990, month: 1, tick: 0 } },
      resources: { food: 999999, vodka: 999999, money: 999999 },
    });

    // Do NOT mock onHistoricalEraEnd — leave it as undefined
    callbacks.onHistoricalEraEnd = undefined as never;
    callbacks.onAnnualReport = undefined as never;

    buildBasicSettlement({ housing: 2, farms: 1, power: 1 });

    for (let y = 0; y < 3; y++) {
      getResources().food = 999999;
      advanceTicks(engine, TICKS_PER_YEAR);
    }

    // Engine should have switched to freeform (not game over)
    expect(callbacks.onGameOver).not.toHaveBeenCalled();
    expect(engine.getGovernor()).toBeInstanceOf(FreeformGovernor);
  });
});
