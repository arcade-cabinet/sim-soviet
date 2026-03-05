/**
 * @fileoverview Tests verifying WorldAgent pressure modifiers flow through
 * governors into PressureSystem.tick().
 *
 * Task #22: WorldAgent.computePressureModifiers() must be called by both
 * HistoricalGovernor and FreeformGovernor, and the returned multipliers
 * must be passed to PressureSystem.tick().
 */

import type { GovernorContext } from '@/ai/agents/crisis/Governor';
import { HistoricalGovernor } from '@/ai/agents/crisis/HistoricalGovernor';
import { FreeformGovernor } from '@/ai/agents/crisis/FreeformGovernor';
import type { PressureDomain, PressureReadContext } from '@/ai/agents/crisis/pressure/PressureDomains';
import { GameRng } from '@/game/SeedSystem';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Minimal PressureReadContext with zero readings. */
function makePressureReadings(): PressureReadContext {
  return {
    food: 0,
    population: 100,
    housing: 0,
    power: 0,
    loyalty: 0,
    morale: 0,
    health: 0,
    infrastructure: 0,
    demographic: 0,
    political: 0,
    economic: 0,
    season: 'summer',
    weather: 'clear',
    climateTrend: 0,
  } as PressureReadContext;
}

/** Build a GovernorContext with optional overrides. */
function makeCtx(overrides?: Partial<GovernorContext>): GovernorContext {
  return {
    year: 1917,
    month: 1,
    population: 100,
    food: 500,
    money: 1000,
    rng: new GameRng('wiring-test'),
    totalTicks: 0,
    eraId: 'revolution',
    ...overrides,
  };
}

/** Create a mock WorldAgent with a spy on computePressureModifiers. */
function makeMockWorldAgent(modifiers: Partial<Record<PressureDomain, number>>) {
  return {
    computePressureModifiers: jest.fn().mockReturnValue(modifiers),
  } as any;
}

// ─── HistoricalGovernor ─────────────────────────────────────────────────────

describe('WorldAgent → HistoricalGovernor → PressureSystem wiring', () => {
  it('passes worldAgent.computePressureModifiers() to PressureSystem.tick()', () => {
    const gov = new HistoricalGovernor();
    const pressureSystem = gov.getPressureSystem();
    const tickSpy = jest.spyOn(pressureSystem, 'tick');

    const worldModifiers: Partial<Record<PressureDomain, number>> = {
      food: 1.8,
      morale: 1.5,
      demographic: 2.0,
    };
    const mockWorld = makeMockWorldAgent(worldModifiers);

    const ctx = makeCtx({
      pressureReadings: makePressureReadings(),
      worldAgent: mockWorld,
    });

    gov.evaluate(ctx);

    // WorldAgent was consulted
    expect(mockWorld.computePressureModifiers).toHaveBeenCalledTimes(1);

    // PressureSystem.tick received the worldModifiers
    expect(tickSpy).toHaveBeenCalledTimes(1);
    expect(tickSpy).toHaveBeenCalledWith(expect.anything(), worldModifiers);
  });

  it('falls back to empty modifiers when no worldAgent is provided', () => {
    const gov = new HistoricalGovernor();
    const pressureSystem = gov.getPressureSystem();
    const tickSpy = jest.spyOn(pressureSystem, 'tick');

    const ctx = makeCtx({
      pressureReadings: makePressureReadings(),
      // worldAgent intentionally omitted
    });

    gov.evaluate(ctx);

    // PressureSystem.tick was called with empty modifiers fallback
    expect(tickSpy).toHaveBeenCalledTimes(1);
    expect(tickSpy).toHaveBeenCalledWith(expect.anything(), {});
  });
});

// ─── FreeformGovernor ───────────────────────────────────────────────────────

describe('WorldAgent → FreeformGovernor → PressureSystem wiring', () => {
  it('passes worldAgent.computePressureModifiers() to PressureSystem.tick()', () => {
    const gov = new FreeformGovernor();
    const pressureSystem = gov.getPressureSystem();
    const tickSpy = jest.spyOn(pressureSystem, 'tick');

    const worldModifiers: Partial<Record<PressureDomain, number>> = {
      political: 1.6,
      economic: 1.3,
      infrastructure: 1.9,
    };
    const mockWorld = makeMockWorldAgent(worldModifiers);

    const ctx = makeCtx({
      pressureReadings: makePressureReadings(),
      worldAgent: mockWorld,
    });

    gov.evaluate(ctx);

    // WorldAgent was consulted
    expect(mockWorld.computePressureModifiers).toHaveBeenCalledTimes(1);

    // PressureSystem.tick received the worldModifiers
    expect(tickSpy).toHaveBeenCalledTimes(1);
    expect(tickSpy).toHaveBeenCalledWith(expect.anything(), worldModifiers);
  });

  it('falls back to empty modifiers when no worldAgent is provided', () => {
    const gov = new FreeformGovernor();
    const pressureSystem = gov.getPressureSystem();
    const tickSpy = jest.spyOn(pressureSystem, 'tick');

    const ctx = makeCtx({
      pressureReadings: makePressureReadings(),
      // worldAgent intentionally omitted
    });

    gov.evaluate(ctx);

    // PressureSystem.tick was called with empty modifiers fallback
    expect(tickSpy).toHaveBeenCalledTimes(1);
    expect(tickSpy).toHaveBeenCalledWith(expect.anything(), {});
  });
});
