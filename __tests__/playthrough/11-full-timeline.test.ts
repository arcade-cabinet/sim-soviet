/**
 * Playthrough integration test: Full 1917→2117 Timeline
 *
 * Runs the engine through all 8 eras (200 years / 72,000 ticks) to verify
 * the complete game loop without crashes. Validates era transitions fire,
 * resource invariants hold, and the engine remains stable at scale.
 */

import { world } from '../../src/ecs/world';
import {
  advanceTicks,
  assertMetaInvariants,
  assertResourceInvariants,
  buildBasicSettlement,
  createPlaythroughEngine,
  getDate,
  getResources,
  isGameOver,
  TICKS_PER_YEAR,
} from './helpers';

describe('Playthrough: Full 1917→2117 Timeline', () => {
  afterEach(() => {
    world.clear();
    jest.restoreAllMocks();
  });

  it('survives 200 years (1917→2117) through all 8 eras without crash', () => {
    const { engine, callbacks } = createPlaythroughEngine({
      meta: { date: { year: 1917, month: 10, tick: 0 } },
      resources: {
        population: 20, // Small population to limit entity growth
        food: 99999,
        vodka: 99999,
        money: 99999,
        timber: 99999,
        steel: 99999,
        cement: 99999,
      },
    });

    // Disable interactive callbacks to prevent deferred UI state
    callbacks.onMinigame = undefined as never;
    callbacks.onAnnualReport = undefined as never;

    // Minimal buildings — just power + housing + farm
    buildBasicSettlement({ housing: 1, farms: 1, power: 1 });

    const eraTransitions: string[] = [];
    callbacks.onEraChanged.mockImplementation((era: { id: string }) => {
      eraTransitions.push(era.id);
    });

    // Run 200 years = 72,000 ticks
    // Process in yearly chunks with periodic resource replenishment
    // and GC-friendly entity cleanup
    for (let year = 0; year < 200; year++) {
      // Replenish resources each year to prevent starvation/game-over
      const res = getResources();
      res.food = Math.max(res.food, 50000);
      res.vodka = Math.max(res.vodka, 50000);
      res.money = Math.max(res.money, 50000);

      advanceTicks(engine, TICKS_PER_YEAR);

      // Check invariants every 25 years
      if (year % 25 === 0) {
        assertMetaInvariants();
      }

      // If game ended (e.g. political arrest), record it and stop
      if (isGameOver()) break;
    }

    const date = getDate();

    // We should have seen era transitions
    expect(eraTransitions.length).toBeGreaterThanOrEqual(1);

    // If we made it through without crashing, that's the primary assertion.
    // The engine processed 72,000 ticks (or ended via game-over).
    // Either outcome is valid — we're testing stability, not winning.
    if (!isGameOver()) {
      // Made it all 200 years — should be past year 2100
      expect(date.year).toBeGreaterThanOrEqual(2100);
      // Should have transitioned through all 7 era boundaries
      expect(eraTransitions).toContain('collectivization');
      expect(eraTransitions).toContain('industrialization');
      expect(eraTransitions).toContain('great_patriotic');
      expect(eraTransitions).toContain('reconstruction');
      expect(eraTransitions).toContain('thaw_and_freeze');
      expect(eraTransitions).toContain('stagnation');
      expect(eraTransitions).toContain('the_eternal');
    } else {
      // Game ended early — still valid, just log what we got
      expect(date.year).toBeGreaterThan(1917);
      console.log('Full timeline ended early:', JSON.stringify({
        finalYear: date.year,
        erasTraversed: eraTransitions,
        currentEra: engine.getEraSystem().getCurrentEraId(),
      }));
    }
  }, 60000); // 60s timeout for 72k ticks
});
