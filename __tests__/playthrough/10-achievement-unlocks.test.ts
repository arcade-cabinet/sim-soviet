import { world } from '../../src/ecs/world';
import { createBuilding } from '../../src/ecs/factories';
import { getResourceEntity } from '../../src/ecs/archetypes';
import {
  createPlaythroughEngine,
  advanceTicks,
  getResources,
  buildBasicSettlement,
} from './helpers';

describe('Playthrough: Achievement Unlocks', () => {
  afterEach(() => {
    world.clear();
    jest.restoreAllMocks();
  });

  // ── Scenario 1: first_building achievement ────────────────────────────────

  it('first_building achievement fires after placing a building', () => {
    const { engine } = createPlaythroughEngine();

    // Place a building entity in the ECS world
    createBuilding(0, 0, 'power-station');

    // Notify the achievement tracker that a building was placed.
    // In the live game, this would be called by the UI bridge; in tests we call it directly.
    // onBuildingPlaced returns newly unlocked achievements synchronously.
    const unlocked = engine.getAchievements().onBuildingPlaced('power-station');

    // The first_building achievement should have been returned
    expect(unlocked.length).toBeGreaterThanOrEqual(1);
    expect(unlocked.some((a) => a.id === 'first_building')).toBe(true);

    // Verify it's tracked as unlocked
    expect(engine.getAchievements().getUnlockedIds().has('first_building')).toBe(true);

    // Verify stats were updated
    expect(engine.getAchievements().getStats().buildingsPlaced).toBe(1);
  });

  // ── Scenario 2: hundred_pop achievement via direct resource manipulation ──

  it('hundred_pop achievement fires when population reaches 100', () => {
    const { engine, callbacks } = createPlaythroughEngine({
      resources: { population: 99, food: 9999, vodka: 9999, money: 9999 },
    });

    // Place power and housing to support population
    buildBasicSettlement({ power: 1, housing: 2, farms: 1 });

    // Advance enough ticks for population growth (ticks at multiples of 10
    // evaluate achievements; population grows slowly from sim tick).
    // We'll advance many ticks, but if growth is too slow, manually bump population.
    advanceTicks(engine, 100);

    const res = getResources();
    if (res.population < 100) {
      // Growth was insufficient; set population directly and tick again
      res.population = 100;
      advanceTicks(engine, 10);
    }

    expect(callbacks.onAchievement).toHaveBeenCalled();
    const calls = callbacks.onAchievement.mock.calls;
    const achievementNames = calls.map((c: unknown[]) => c[0]);
    expect(achievementNames).toContain('Strength in Numbers');

    expect(engine.getAchievements().getUnlockedIds().has('hundred_pop')).toBe(true);
  });

  // ── Scenario 3a: no_food (famine) achievement ─────────────────────────────

  it('no_food achievement fires when food reaches 0', () => {
    const { engine, callbacks } = createPlaythroughEngine({
      resources: { food: 0, population: 10, money: 500 },
    });

    // Advance 10 ticks so achievement evaluation runs
    advanceTicks(engine, 10);

    expect(callbacks.onAchievement).toHaveBeenCalled();
    const calls = callbacks.onAchievement.mock.calls;
    const achievementNames = calls.map((c: unknown[]) => c[0]);
    expect(achievementNames).toContain('Intermittent Fasting Pioneer');

    expect(engine.getAchievements().getUnlockedIds().has('no_food')).toBe(true);
  });

  // ── Scenario 3b: max_vodka achievement ────────────────────────────────────

  it('max_vodka achievement fires when vodka reaches 1000', () => {
    const { engine, callbacks } = createPlaythroughEngine({
      // Start above 1000 to account for consumption before the first achievement check
      // (tickAchievements runs at totalTicks % 10 === 0). Set money > vodka to avoid vodka_economy.
      resources: { vodka: 1100, food: 500, money: 5000, population: 10 },
    });

    // Advance 10 ticks so tickAchievements evaluates (runs at totalTicks % 10 === 0).
    // The tick() method updates maxVodka from the resources snapshot, so
    // even if vodka is consumed during ticks, maxVodka should capture the peak.
    advanceTicks(engine, 10);

    // max_vodka checks stats.maxVodka >= 1000, which is set during tick()
    // from the live resources. Verify it was tracked:
    const stats = engine.getAchievements().getStats();
    expect(stats.maxVodka).toBeGreaterThanOrEqual(1000);

    expect(engine.getAchievements().getUnlockedIds().has('max_vodka')).toBe(true);

    // The engine callback fires achievements discovered during tick()
    expect(callbacks.onAchievement).toHaveBeenCalled();
    const calls = callbacks.onAchievement.mock.calls;
    const achievementNames = calls.map((c: unknown[]) => c[0]);
    expect(achievementNames).toContain('Spirit of the Revolution');
  });

  // ── Scenario 3c: bankruptcy achievement ───────────────────────────────────

  it('bankruptcy achievement fires when money reaches 0', () => {
    const { engine, callbacks } = createPlaythroughEngine({
      resources: { money: 0, food: 500, population: 10 },
    });

    // Advance 10 ticks so achievement evaluation runs
    advanceTicks(engine, 10);

    expect(callbacks.onAchievement).toHaveBeenCalled();
    const calls = callbacks.onAchievement.mock.calls;
    const achievementNames = calls.map((c: unknown[]) => c[0]);
    expect(achievementNames).toContain('Socialist Arithmetic');

    expect(engine.getAchievements().getUnlockedIds().has('bankruptcy')).toBe(true);
  });

  // ── Scenario 4: Achievement persists through serialize/restore ────────────

  it('achievement persists through serialize and restore', () => {
    const { engine, callbacks } = createPlaythroughEngine();

    // Trigger first_building achievement
    createBuilding(0, 0, 'power-station');
    engine.getAchievements().onBuildingPlaced('power-station');
    advanceTicks(engine, 10);

    // Verify it unlocked
    expect(engine.getAchievements().getUnlockedIds().has('first_building')).toBe(true);

    // Serialize subsystem state
    const saveData = engine.serializeSubsystems();

    // Create a fresh engine
    const { engine: engine2 } = createPlaythroughEngine();
    expect(engine2.getAchievements().getUnlockedIds().has('first_building')).toBe(false);

    // Restore from save data
    engine2.restoreSubsystems(saveData);

    // Verify achievement is still unlocked after restore
    expect(engine2.getAchievements().getUnlockedIds().has('first_building')).toBe(true);

    // Verify stats were also restored
    const stats = engine2.getAchievements().getStats();
    expect(stats.buildingsPlaced).toBeGreaterThanOrEqual(1);
  });
});
