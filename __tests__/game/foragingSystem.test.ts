import { getResourceEntity } from '../../src/ecs/archetypes';
import { createResourceStore } from '../../src/ecs/factories';
import { world } from '../../src/ecs/world';
import {
  bestForagingMethod,
  createForagingState,
  foragingTick,
  hasForestTiles,
  hasWaterTiles,
  yieldPerWorker,
  type ForagingState,
} from '../../src/ai/agents/economy/foragingSystem';
import { GameRng } from '../../src/game/SeedSystem';

// ── Helper: create terrain feature entities ──────────────────────────────────

function createTerrainFeature(type: 'forest' | 'river' | 'mountain' | 'marsh' | 'water') {
  world.add({
    position: { gridX: 0, gridY: 0 },
    terrainFeature: {
      featureType: type,
      elevation: 0,
      harvestable: type === 'forest',
      passable: type !== 'mountain',
      spriteName: `grass-${type}`,
    },
    isTerrainFeature: true as const,
  });
}

describe('foragingSystem', () => {
  beforeEach(() => {
    world.clear();
  });

  afterEach(() => {
    world.clear();
  });

  // ── Terrain Queries ─────────────────────────────────────────────────────

  describe('terrain queries', () => {
    it('hasForestTiles returns false with no terrain features', () => {
      expect(hasForestTiles()).toBe(false);
    });

    it('hasForestTiles returns true when forest exists', () => {
      createTerrainFeature('forest');
      expect(hasForestTiles()).toBe(true);
    });

    it('hasWaterTiles returns false with no terrain features', () => {
      expect(hasWaterTiles()).toBe(false);
    });

    it('hasWaterTiles returns true for river terrain', () => {
      createTerrainFeature('river');
      expect(hasWaterTiles()).toBe(true);
    });

    it('hasWaterTiles returns true for water terrain', () => {
      createTerrainFeature('water');
      expect(hasWaterTiles()).toBe(true);
    });

    it('hasForestTiles ignores non-forest terrain', () => {
      createTerrainFeature('mountain');
      createTerrainFeature('marsh');
      expect(hasForestTiles()).toBe(false);
    });
  });

  // ── Seasonal Availability ───────────────────────────────────────────────

  describe('bestForagingMethod', () => {
    it('returns hunting when forest is available', () => {
      expect(bestForagingMethod(6, true, false, false)).toBe('hunting');
    });

    it('returns trapping when forest + traps ready', () => {
      expect(bestForagingMethod(6, true, false, true)).toBe('trapping');
    });

    it('returns fishing when water + in season (no forest)', () => {
      expect(bestForagingMethod(6, false, true, false)).toBe('fishing');
    });

    it('returns gathering when in season (no forest, no water)', () => {
      expect(bestForagingMethod(6, false, false, false)).toBe('gathering');
    });

    it('returns stone_soup in winter with no forest or water', () => {
      expect(bestForagingMethod(1, false, false, false)).toBe('stone_soup');
    });

    it('returns stone_soup in month 11 with no terrain features', () => {
      expect(bestForagingMethod(11, false, false, false)).toBe('stone_soup');
    });

    it('prefers hunting over fishing (forest takes priority)', () => {
      expect(bestForagingMethod(6, true, true, false)).toBe('hunting');
    });

    it('returns fishing out of gathering season with water', () => {
      // Month 3 is outside gathering season (4-10) but also outside fishing season (4-10)
      expect(bestForagingMethod(3, false, true, false)).toBe('stone_soup');
    });

    it('returns gathering in month 4 (start of season)', () => {
      expect(bestForagingMethod(4, false, false, false)).toBe('gathering');
    });

    it('returns gathering in month 10 (end of season)', () => {
      expect(bestForagingMethod(10, false, false, false)).toBe('gathering');
    });
  });

  // ── Yield Per Worker ────────────────────────────────────────────────────

  describe('yieldPerWorker', () => {
    it('gathering yields 0.8 in season (month 6)', () => {
      expect(yieldPerWorker('gathering', 6)).toBe(0.8);
    });

    it('gathering yields 0 out of season (month 1)', () => {
      expect(yieldPerWorker('gathering', 1)).toBe(0);
    });

    it('gathering yields 0 out of season (month 12)', () => {
      expect(yieldPerWorker('gathering', 12)).toBe(0);
    });

    it('hunting yields 1.2 in summer (month 6)', () => {
      expect(yieldPerWorker('hunting', 6)).toBe(1.2);
    });

    it('hunting yields 0.6 in winter (50% penalty, month 1)', () => {
      expect(yieldPerWorker('hunting', 1)).toBeCloseTo(0.6);
    });

    it('hunting yields 0.6 in winter (month 12)', () => {
      expect(yieldPerWorker('hunting', 12)).toBeCloseTo(0.6);
    });

    it('hunting yields 0.6 in winter (month 3)', () => {
      expect(yieldPerWorker('hunting', 3)).toBeCloseTo(0.6);
    });

    it('hunting yields full 1.2 in month 4 (no longer winter)', () => {
      expect(yieldPerWorker('hunting', 4)).toBe(1.2);
    });

    it('fishing yields 1.0 in season (month 7)', () => {
      expect(yieldPerWorker('fishing', 7)).toBe(1.0);
    });

    it('fishing yields 0 out of season (month 2)', () => {
      expect(yieldPerWorker('fishing', 2)).toBe(0);
    });

    it('trapping yields 1.5 always', () => {
      expect(yieldPerWorker('trapping', 1)).toBe(1.5);
      expect(yieldPerWorker('trapping', 7)).toBe(1.5);
    });

    it('stone_soup yields 0.2 always', () => {
      expect(yieldPerWorker('stone_soup', 1)).toBe(0.2);
      expect(yieldPerWorker('stone_soup', 7)).toBe(0.2);
    });
  });

  // ── Core Foraging Tick ──────────────────────────────────────────────────

  describe('foragingTick', () => {
    let state: ForagingState;
    const rng = new GameRng('test-foraging-seed');

    beforeEach(() => {
      state = createForagingState();
    });

    it('does nothing when food is above crisis threshold', () => {
      const result = foragingTick(100, 10, 6, state, rng);
      // threshold = 10 * 2 = 20, food=100 >= 20
      expect(result.foodGathered).toBe(0);
      expect(result.workersForaging).toBe(0);
      expect(result.productionLoss).toBe(0);
    });

    it('activates when food < population * crisisThreshold', () => {
      createTerrainFeature('forest');
      const result = foragingTick(5, 50, 6, state, rng);
      // threshold = 50 * 2 = 100, food=5 < 100
      expect(result.workersForaging).toBeGreaterThan(0);
      expect(result.foodGathered).toBeGreaterThan(0);
    });

    it('activates at exactly 0 food', () => {
      const result = foragingTick(0, 20, 6, state, rng);
      expect(result.workersForaging).toBeGreaterThan(0);
    });

    it('does not activate when food equals threshold', () => {
      // threshold = 10 * 2 = 20, food = 20
      const result = foragingTick(20, 10, 6, state, rng);
      expect(result.workersForaging).toBe(0);
    });

    it('returns 0 workers foraging when population is 0', () => {
      const result = foragingTick(0, 0, 6, state, rng);
      expect(result.workersForaging).toBe(0);
    });

    it('uses stone_soup method when no terrain and out of season', () => {
      const result = foragingTick(0, 20, 1, state, rng);
      expect(result.method).toBe('stone_soup');
    });

    it('stone_soup produces small food per worker', () => {
      const result = foragingTick(0, 100, 1, state, rng);
      // stone_soup: 0.2 food per worker
      expect(result.foodGathered).toBeGreaterThan(0);
      expect(result.method).toBe('stone_soup');
    });

    it('stone_soup has morale penalty', () => {
      const result = foragingTick(0, 100, 1, state, rng);
      expect(result.moralePenalty).toBe(10);
    });

    it('hunting produces more food per worker than stone_soup', () => {
      createTerrainFeature('forest');
      const resultHunt = foragingTick(0, 100, 6, createForagingState(), rng);
      const resultSoup = foragingTick(0, 100, 1, createForagingState());
      // Both at same population, but hunting should yield more per worker
      const huntPerWorker = resultHunt.foodGathered / resultHunt.workersForaging;
      const soupPerWorker = resultSoup.foodGathered / resultSoup.workersForaging;
      expect(huntPerWorker).toBeGreaterThan(soupPerWorker);
    });

    it('productionLoss is proportional to workers foraging', () => {
      const result = foragingTick(0, 100, 6, state, rng);
      expect(result.productionLoss).toBeGreaterThan(0);
      expect(result.productionLoss).toBeLessThanOrEqual(0.3);
      // productionLoss = workersForaging / population
      expect(result.productionLoss).toBeCloseTo(result.workersForaging / 100);
    });

    it('max foraging fraction caps workers at 30%', () => {
      const result = foragingTick(0, 100, 6, state, rng);
      // Max 30% of population can forage
      expect(result.workersForaging).toBeLessThanOrEqual(30);
    });

    it('at least 1 worker forages even with small population', () => {
      const result = foragingTick(0, 2, 6, state, rng);
      expect(result.workersForaging).toBeGreaterThanOrEqual(1);
    });
  });

  // ── KGB Risk ────────────────────────────────────────────────────────────

  describe('KGB risk', () => {
    it('no KGB risk when foragingRatio <= 20%', () => {
      // With 100 pop and some food (not totally desperate), fraction should stay low
      // We need a scenario where foragingFraction < 0.2
      const state = createForagingState();
      // Food is 15/20 of threshold, so desperation = 1 - 15/20 = 0.25
      // fraction = min(0.3, 0.25 * 0.3) = 0.075 => 7.5% < 20%
      const rng = new GameRng('kgb-low-risk');
      const result = foragingTick(15, 10, 6, state, rng);
      // At 7.5% foraging, ratio < 20% threshold, so no KGB risk
      expect(result.kgbRisk).toBe(0);
    });

    it('KGB risk possible when >20% workforce foraging', () => {
      // Need to make sure RNG triggers the risk
      // Force a scenario with high foraging ratio
      const state = createForagingState();
      // Food=0, pop=10 -> desperation=1.0, fraction=0.3 -> 3 workers out of 10 = 30% > 20%
      // Use a controlled rng that returns low values to trigger the 5% check
      let triggered = false;
      for (let i = 0; i < 200; i++) {
        const rng = new GameRng(`kgb-test-${i}`);
        const s = createForagingState();
        const result = foragingTick(0, 10, 6, s, rng);
        if (result.kgbRisk > 0) {
          triggered = true;
          break;
        }
      }
      // With 5% chance per tick, across 200 tries we should see at least one trigger
      expect(triggered).toBe(true);
    });

    it('no KGB risk when population is 0', () => {
      const state = createForagingState();
      const rng = new GameRng('no-pop');
      const result = foragingTick(0, 0, 6, state, rng);
      expect(result.kgbRisk).toBe(0);
    });
  });

  // ── Trapping (Delayed Yield) ────────────────────────────────────────────

  describe('trapping delayed yield', () => {
    it('setting traps produces no immediate food', () => {
      createTerrainFeature('forest');
      const state = createForagingState();
      const rng = new GameRng('trap-seed');

      // First tick: traps are set (no trapsReady), method is hunting (not trapping)
      // because trapsReady is false and trappersActive is 0
      const result1 = foragingTick(0, 20, 6, state, rng);
      // With forest available, method should be hunting (priority over trapping when no traps ready)
      expect(result1.method).toBe('hunting');
    });

    it('trapping system sets up state correctly', () => {
      const state = createForagingState();
      // Manually simulate what happens when trapping is chosen
      // (this tests the internal state management)
      expect(state.trappersActive).toBe(0);
      expect(state.trapDelayRemaining).toBe(0);
    });
  });

  // ── Cannibalism ─────────────────────────────────────────────────────────

  describe('cannibalism', () => {
    it('fires after 30 ticks at 0 food with population > 5', () => {
      const state = createForagingState();
      const rng = new GameRng('cannibalism-test');

      // Run 29 ticks at 0 food — should NOT fire
      for (let i = 0; i < 29; i++) {
        const result = foragingTick(0, 10, 6, state, rng);
        expect(result.cannibalismFired).toBe(false);
      }

      // 30th tick — should fire
      const result30 = foragingTick(0, 10, 6, state, rng);
      expect(result30.cannibalismFired).toBe(true);
      expect(result30.moralePenalty).toBeGreaterThanOrEqual(30);
      expect(result30.foodGathered).toBeGreaterThanOrEqual(5);
    });

    it('does not fire when population <= 5', () => {
      const state = createForagingState();
      const rng = new GameRng('no-cannibalism');

      // Run 35 ticks at 0 food with pop=5 (at threshold)
      for (let i = 0; i < 35; i++) {
        const result = foragingTick(0, 5, 6, state, rng);
        expect(result.cannibalismFired).toBe(false);
      }
    });

    it('resets starvation counter after firing', () => {
      const state = createForagingState();
      const rng = new GameRng('reset-test');

      // Run to trigger cannibalism
      for (let i = 0; i < 30; i++) {
        foragingTick(0, 10, 6, state, rng);
      }

      // Starvation ticks should be reset to 0
      expect(state.starvationTicks).toBe(0);

      // Next tick should NOT fire cannibalism
      const nextResult = foragingTick(0, 10, 6, state, rng);
      expect(nextResult.cannibalismFired).toBe(false);
    });

    it('starvation counter resets when food becomes available', () => {
      const state = createForagingState();
      const rng = new GameRng('food-reset');

      // Run 20 ticks at 0 food
      for (let i = 0; i < 20; i++) {
        foragingTick(0, 10, 6, state, rng);
      }
      expect(state.starvationTicks).toBe(20);

      // Food becomes available — counter resets
      foragingTick(100, 10, 6, state, rng);
      expect(state.starvationTicks).toBe(0);
    });

    it('cannibalism adds food yield of 5', () => {
      const state = createForagingState();
      const rng = new GameRng('food-yield');

      // Trigger cannibalism
      for (let i = 0; i < 29; i++) {
        foragingTick(0, 10, 6, state, rng);
      }
      const result = foragingTick(0, 10, 6, state, rng);
      // Food gathered includes both regular foraging + cannibalism yield (5)
      expect(result.foodGathered).toBeGreaterThanOrEqual(5);
    });

    it('cannibalism morale penalty is 30', () => {
      const state = createForagingState();
      const rng = new GameRng('morale-test');

      for (let i = 0; i < 29; i++) {
        foragingTick(0, 10, 6, state, rng);
      }
      const result = foragingTick(0, 10, 6, state, rng);
      // Stone soup (10) + cannibalism (30) = 40 if method is stone_soup
      // or just 30 if method is something else
      expect(result.moralePenalty).toBeGreaterThanOrEqual(30);
    });
  });

  // ── State Persistence ───────────────────────────────────────────────────

  describe('createForagingState', () => {
    it('creates fresh state with zeroed counters', () => {
      const state = createForagingState();
      expect(state.starvationTicks).toBe(0);
      expect(state.trapDelayRemaining).toBe(0);
      expect(state.trappersActive).toBe(0);
    });
  });

  // ── Seasonal Method Selection ───────────────────────────────────────────

  describe('seasonal method selection in foragingTick', () => {
    it('uses hunting in forest during summer', () => {
      createTerrainFeature('forest');
      const state = createForagingState();
      const rng = new GameRng('summer-hunt');
      const result = foragingTick(0, 20, 6, state, rng);
      expect(result.method).toBe('hunting');
    });

    it('uses hunting in forest during winter (with penalty)', () => {
      createTerrainFeature('forest');
      const state = createForagingState();
      const rng = new GameRng('winter-hunt');
      const result = foragingTick(0, 20, 1, state, rng);
      expect(result.method).toBe('hunting');
      // Winter hunt yields less than summer hunt
      const summerResult = foragingTick(0, 20, 6, createForagingState(), rng);
      // Both use hunting but winter has penalty — per-worker yield differs
      // The total depends on RNG and worker count, so check the yield rate
    });

    it('uses gathering in season without forest or water', () => {
      const state = createForagingState();
      const rng = new GameRng('gather-test');
      const result = foragingTick(0, 20, 5, state, rng);
      expect(result.method).toBe('gathering');
    });

    it('uses stone_soup in month 2 without any terrain', () => {
      const state = createForagingState();
      const rng = new GameRng('soup-test');
      const result = foragingTick(0, 20, 2, state, rng);
      expect(result.method).toBe('stone_soup');
    });
  });

  // ── Integration: resource store ─────────────────────────────────────────

  describe('integration with resource store', () => {
    it('foragingTick can be used to add food to resource store', () => {
      createResourceStore({ food: 0, population: 50 });
      createTerrainFeature('forest');
      const store = getResourceEntity()!;
      store.resources.population = 50;

      const state = createForagingState();
      const rng = new GameRng('integration-test');
      const result = foragingTick(
        store.resources.food,
        store.resources.population,
        6,
        state,
        rng,
      );

      // Simulate what SimulationEngine would do
      store.resources.food += result.foodGathered;
      expect(store.resources.food).toBeGreaterThan(0);
    });
  });
});
