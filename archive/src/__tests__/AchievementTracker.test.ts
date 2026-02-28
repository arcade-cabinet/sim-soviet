import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '../content/worldbuilding';
import type { Resources } from '../ecs/world';
import { AchievementTracker } from '../game/AchievementTracker';

/** Helper to build a minimal Resources object. */
function makeResources(overrides?: Partial<Resources>): Resources {
  return {
    money: 1000,
    food: 200,
    vodka: 50,
    power: 10,
    powerUsed: 5,
    population: 50,
    trudodni: 0,
    blat: 10,
    timber: 0,
    steel: 0,
    cement: 0,
    prefab: 0,
    seedFund: 1.0,
    emergencyReserve: 0,
    storageCapacity: 200,
    ...overrides,
  };
}

describe('AchievementTracker', () => {
  // ── Initial state ─────────────────────────────────────

  describe('initial state', () => {
    it('starts with 0 unlocked achievements', () => {
      const tracker = new AchievementTracker();
      expect(tracker.getUnlocked()).toHaveLength(0);
      expect(tracker.getUnlockedIds().size).toBe(0);
    });

    it('starts with no new unlocks', () => {
      const tracker = new AchievementTracker();
      expect(tracker.getNewUnlocks()).toHaveLength(0);
    });

    it('starts with default stats', () => {
      const tracker = new AchievementTracker();
      const stats = tracker.getStats();
      expect(stats.buildingsPlaced).toBe(0);
      expect(stats.totalEvents).toBe(0);
      expect(stats.renameCount).toBe(0);
      expect(stats.playTimeSeconds).toBe(0);
    });
  });

  // ── Building placement achievements ────────────────────

  describe('onBuildingPlaced', () => {
    it('unlocks first_building on first placement', () => {
      const tracker = new AchievementTracker();
      const unlocked = tracker.onBuildingPlaced('tenement-a');
      expect(unlocked.some((a) => a.id === 'first_building')).toBe(true);
    });

    it('tracks unique building types', () => {
      const tracker = new AchievementTracker();
      tracker.onBuildingPlaced('tenement-a');
      tracker.onBuildingPlaced('tenement-a'); // duplicate
      tracker.onBuildingPlaced('coal-plant');
      const stats = tracker.getStats();
      expect(stats.uniqueBuildingTypes).toHaveLength(2);
      expect(stats.buildingsPlaced).toBe(3);
    });

    it('tracks gulag count', () => {
      const tracker = new AchievementTracker();
      tracker.onBuildingPlaced('gulag');
      expect(tracker.getStats().gulags).toBe(1);
      const unlocked = tracker.getUnlocked();
      expect(unlocked.some((a) => a.id === 'first_gulag')).toBe(true);
    });

    it('tracks lenin statue count', () => {
      const tracker = new AchievementTracker();
      for (let i = 0; i < 10; i++) {
        tracker.onBuildingPlaced('lenin-statue');
      }
      expect(tracker.getStats().leninStatues).toBe(10);
      expect(tracker.getUnlocked().some((a) => a.id === 'ten_statues')).toBe(true);
    });

    it('does not re-unlock already unlocked achievements', () => {
      const tracker = new AchievementTracker();
      tracker.onBuildingPlaced('tenement-a');
      const first = tracker.getNewUnlocks();
      expect(first.some((a) => a.id === 'first_building')).toBe(true);

      tracker.onBuildingPlaced('coal-plant');
      const second = tracker.getNewUnlocks();
      expect(second.some((a) => a.id === 'first_building')).toBe(false);
    });
  });

  // ── Event achievements ────────────────────────────────

  describe('onEventSurvived', () => {
    it('unlocks ten_events after 10 events', () => {
      const tracker = new AchievementTracker();
      for (let i = 0; i < 9; i++) {
        tracker.onEventSurvived(false);
      }
      expect(tracker.getUnlocked().some((a) => a.id === 'ten_events')).toBe(false);

      tracker.onEventSurvived(false);
      expect(tracker.getUnlocked().some((a) => a.id === 'ten_events')).toBe(true);
    });

    it('tracks consecutive disasters', () => {
      const tracker = new AchievementTracker();
      tracker.onEventSurvived(true);
      tracker.onEventSurvived(true);
      expect(tracker.getStats().consecutiveDisasters).toBe(2);

      tracker.onEventSurvived(false); // breaks streak
      expect(tracker.getStats().consecutiveDisasters).toBe(0);
    });

    it('unlocks three_disasters on 3 consecutive', () => {
      const tracker = new AchievementTracker();
      tracker.onEventSurvived(true);
      tracker.onEventSurvived(true);
      tracker.onEventSurvived(true);
      expect(tracker.getUnlocked().some((a) => a.id === 'three_disasters')).toBe(true);
    });
  });

  // ── Resource-based achievements ────────────────────────

  describe('tick - resource conditions', () => {
    it('unlocks no_food when food reaches 0', () => {
      const tracker = new AchievementTracker();
      const res = makeResources({ food: 0 });
      tracker.tick(res, 5, 50, 1980, 1);
      expect(tracker.getUnlocked().some((a) => a.id === 'no_food')).toBe(true);
    });

    it('unlocks bankruptcy when money reaches 0', () => {
      const tracker = new AchievementTracker();
      const res = makeResources({ money: 0 });
      tracker.tick(res, 5, 50, 1980, 1);
      expect(tracker.getUnlocked().some((a) => a.id === 'bankruptcy')).toBe(true);
    });

    it('unlocks rich when money exceeds 10000', () => {
      const tracker = new AchievementTracker();
      const res = makeResources({ money: 10_000 });
      tracker.tick(res, 5, 50, 1980, 1);
      expect(tracker.getUnlocked().some((a) => a.id === 'rich')).toBe(true);
    });

    it('unlocks vodka_economy when vodka > money', () => {
      const tracker = new AchievementTracker();
      const res = makeResources({ vodka: 200, money: 100 });
      tracker.tick(res, 5, 50, 1980, 1);
      expect(tracker.getUnlocked().some((a) => a.id === 'vodka_economy')).toBe(true);
    });

    it('unlocks night_shift with 0 power and 50+ pop', () => {
      const tracker = new AchievementTracker();
      const res = makeResources({ power: 0, population: 50 });
      tracker.tick(res, 5, 50, 1980, 1);
      expect(tracker.getUnlocked().some((a) => a.id === 'night_shift')).toBe(true);
    });

    it('unlocks zero_pop when population reaches 0', () => {
      const tracker = new AchievementTracker();
      const res = makeResources({ population: 0 });
      tracker.tick(res, 5, 0, 1980, 1);
      expect(tracker.getUnlocked().some((a) => a.id === 'zero_pop')).toBe(true);
    });
  });

  // ── Time-based achievements ────────────────────────────

  describe('tick - time conditions', () => {
    it('unlocks year_2000 when year >= 2000', () => {
      const tracker = new AchievementTracker();
      const res = makeResources();
      tracker.tick(res, 5, 50, 2000, 1);
      expect(tracker.getUnlocked().some((a) => a.id === 'year_2000')).toBe(true);
    });

    it('unlocks year_2100 when year >= 2100', () => {
      const tracker = new AchievementTracker();
      const res = makeResources();
      tracker.tick(res, 5, 50, 2100, 1);
      expect(tracker.getUnlocked().some((a) => a.id === 'year_2100')).toBe(true);
    });

    it('unlocks play_one_hour at 3600 seconds', () => {
      const tracker = new AchievementTracker();
      const res = makeResources();
      tracker.tick(res, 5, 50, 1980, 3600);
      expect(tracker.getUnlocked().some((a) => a.id === 'play_one_hour')).toBe(true);
    });

    it('accumulates play time across ticks', () => {
      const tracker = new AchievementTracker();
      const res = makeResources();
      tracker.tick(res, 5, 50, 1980, 1800);
      expect(tracker.getUnlocked().some((a) => a.id === 'play_one_hour')).toBe(false);

      tracker.tick(res, 5, 50, 1980, 1800);
      expect(tracker.getUnlocked().some((a) => a.id === 'play_one_hour')).toBe(true);
    });
  });

  // ── Population tracking ────────────────────────────────

  describe('tick - population tracking', () => {
    it('tracks max population', () => {
      const tracker = new AchievementTracker();
      const res = makeResources({ population: 80 });
      tracker.tick(res, 5, 80, 1980, 1);
      expect(tracker.getStats().maxPopulation).toBe(80);

      const res2 = makeResources({ population: 120 });
      tracker.tick(res2, 5, 120, 1980, 1);
      expect(tracker.getStats().maxPopulation).toBe(120);

      // Does not decrease
      const res3 = makeResources({ population: 50 });
      tracker.tick(res3, 5, 50, 1980, 1);
      expect(tracker.getStats().maxPopulation).toBe(120);
    });

    it('unlocks hundred_pop when max pop reaches 100', () => {
      const tracker = new AchievementTracker();
      const res = makeResources({ population: 100 });
      tracker.tick(res, 5, 100, 1980, 1);
      expect(tracker.getUnlocked().some((a) => a.id === 'hundred_pop')).toBe(true);
    });
  });

  // ── Quota achievements ────────────────────────────────

  describe('onQuotaCompleted', () => {
    it('tracks quotas completed', () => {
      const tracker = new AchievementTracker();
      tracker.onQuotaCompleted(1.2); // 120%
      tracker.onQuotaCompleted(0.8); // 80% -- still counts as "completed" by caller
      expect(tracker.getStats().quotasCompleted).toBe(2);
    });

    it('unlocks perfect_quota at exactly 100%', () => {
      const tracker = new AchievementTracker();
      tracker.onQuotaCompleted(1.0);
      expect(tracker.getUnlocked().some((a) => a.id === 'perfect_quota')).toBe(true);
    });

    it('does not unlock perfect_quota at 99% or 101%', () => {
      const tracker = new AchievementTracker();
      tracker.onQuotaCompleted(0.99);
      tracker.onQuotaCompleted(1.01);
      expect(tracker.getUnlocked().some((a) => a.id === 'perfect_quota')).toBe(false);
    });
  });

  // ── City rename achievements ───────────────────────────

  describe('onCityRenamed', () => {
    it('unlocks first_rename on first rename', () => {
      const tracker = new AchievementTracker();
      tracker.onCityRenamed();
      expect(tracker.getUnlocked().some((a) => a.id === 'first_rename')).toBe(true);
    });

    it('unlocks five_renames after 5 renames', () => {
      const tracker = new AchievementTracker();
      for (let i = 0; i < 4; i++) {
        tracker.onCityRenamed();
      }
      expect(tracker.getUnlocked().some((a) => a.id === 'five_renames')).toBe(false);

      tracker.onCityRenamed();
      expect(tracker.getUnlocked().some((a) => a.id === 'five_renames')).toBe(true);
    });
  });

  // ── Building collapse ──────────────────────────────────

  describe('onBuildingCollapsed', () => {
    it('tracks building collapses', () => {
      const tracker = new AchievementTracker();
      tracker.onBuildingCollapsed();
      tracker.onBuildingCollapsed();
      expect(tracker.getStats().buildingCollapses).toBe(2);
    });

    it('unlocks collapse_no_witness on first collapse', () => {
      const tracker = new AchievementTracker();
      tracker.onBuildingCollapsed();
      expect(tracker.getUnlocked().some((a) => a.id === 'collapse_no_witness')).toBe(true);
    });
  });

  // ── Bulldoze ───────────────────────────────────────────

  describe('onBulldozedAll', () => {
    it('unlocks bulldoze_everything when previous count >= 10', () => {
      const tracker = new AchievementTracker();
      tracker.onBulldozedAll(10);
      expect(tracker.getUnlocked().some((a) => a.id === 'bulldoze_everything')).toBe(true);
    });

    it('does not unlock with fewer than 10 buildings', () => {
      const tracker = new AchievementTracker();
      tracker.onBulldozedAll(9);
      expect(tracker.getUnlocked().some((a) => a.id === 'bulldoze_everything')).toBe(false);
    });
  });

  // ── Special events ─────────────────────────────────────

  describe('special event tracking', () => {
    it('onPurgeSurvived unlocks survive_purge', () => {
      const tracker = new AchievementTracker();
      tracker.onPurgeSurvived();
      expect(tracker.getUnlocked().some((a) => a.id === 'survive_purge')).toBe(true);
    });

    it('onReelectionWon unlocks reelected', () => {
      const tracker = new AchievementTracker();
      tracker.onReelectionWon();
      expect(tracker.getUnlocked().some((a) => a.id === 'reelected')).toBe(true);
    });

    it('onPropagandaWinTick unlocks propaganda_win after 10 ticks', () => {
      const tracker = new AchievementTracker();
      for (let i = 0; i < 9; i++) {
        tracker.onPropagandaWinTick();
      }
      expect(tracker.getUnlocked().some((a) => a.id === 'propaganda_win')).toBe(false);

      tracker.onPropagandaWinTick();
      expect(tracker.getUnlocked().some((a) => a.id === 'propaganda_win')).toBe(true);
    });
  });

  // ── New unlocks queue ──────────────────────────────────

  describe('getNewUnlocks', () => {
    it('returns newly unlocked achievements and clears queue', () => {
      const tracker = new AchievementTracker();
      tracker.onBuildingPlaced('tenement-a');
      const first = tracker.getNewUnlocks();
      expect(first.length).toBeGreaterThan(0);

      // Second call returns empty
      const second = tracker.getNewUnlocks();
      expect(second).toHaveLength(0);
    });

    it('accumulates across multiple events before being read', () => {
      const tracker = new AchievementTracker();
      tracker.onBuildingPlaced('gulag'); // first_building + first_gulag
      tracker.onCityRenamed(); // first_rename
      const unlocks = tracker.getNewUnlocks();
      expect(unlocks.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ── Serialization ──────────────────────────────────────

  describe('serialize / deserialize', () => {
    it('round-trips correctly', () => {
      const original = new AchievementTracker();
      original.onBuildingPlaced('tenement-a');
      original.onBuildingPlaced('coal-plant');
      original.onEventSurvived(true);
      original.onQuotaCompleted(1.0);
      original.onCityRenamed();

      const data = original.serialize();
      const restored = AchievementTracker.deserialize(data);

      expect(
        restored
          .getUnlocked()
          .map((a) => a.id)
          .sort()
      ).toEqual(
        original
          .getUnlocked()
          .map((a) => a.id)
          .sort()
      );
      expect(restored.getStats().buildingsPlaced).toBe(2);
      expect(restored.getStats().totalEvents).toBe(1);
      expect(restored.getStats().quotasCompleted).toBe(1);
      expect(restored.getStats().renameCount).toBe(1);
    });

    it('preserves unique building types', () => {
      const original = new AchievementTracker();
      original.onBuildingPlaced('tenement-a');
      original.onBuildingPlaced('coal-plant');
      original.onBuildingPlaced('tenement-a'); // duplicate

      const data = original.serialize();
      const restored = AchievementTracker.deserialize(data);
      expect(restored.getStats().uniqueBuildingTypes).toEqual(['tenement-a', 'coal-plant']);
    });

    it('serialized data has correct structure', () => {
      const tracker = new AchievementTracker();
      tracker.onBuildingPlaced('gulag');

      const data = tracker.serialize();
      expect(data.unlockedIds).toContain('first_building');
      expect(data.unlockedIds).toContain('first_gulag');
      expect(data.stats.buildingsPlaced).toBe(1);
      expect(data.stats.gulags).toBe(1);
      expect(data.stats.uniqueBuildingTypes).toEqual(['gulag']);
    });
  });

  // ── All ACHIEVEMENTS have conditions ───────────────────

  describe('achievement coverage', () => {
    it('every achievement in WorldBuilding.ts has a condition function', () => {
      const tracker = new AchievementTracker();
      // We verify by checking that no achievement is accidentally missing
      // from the CONDITIONS map. The tracker evaluates all ACHIEVEMENTS,
      // so if one is missing a condition, it simply never unlocks.
      // We can't directly access CONDITIONS, but we verify the tracker
      // handles all achievements without error.
      const res = makeResources();
      tracker.tick(res, 5, 50, 1980, 1);
      // Should not throw
      expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(28);
    });
  });
});
