/**
 * AchievementTracker -- wires the 28 achievements from WorldBuilding.ts
 * to live game state, tracking progress and unlocking conditions.
 *
 * Each tick and discrete event updates internal stats. When an achievement
 * condition is newly satisfied, it is added to the unlock queue for the
 * UI to consume via `getNewUnlocks()`.
 */

import { ACHIEVEMENTS, type Achievement } from '@/content/worldbuilding';
import type { Resources } from '@/ecs/world';

// ─────────────────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────────────────

/** Cumulative stats that drive achievement conditions. */
export interface AchievementStats {
  buildingsPlaced: number;
  totalEvents: number;
  totalDisasters: number;
  consecutiveDisasters: number;
  renameCount: number;
  playTimeSeconds: number;
  maxPopulation: number;
  maxVodka: number;
  maxMoney: number;
  quotasCompleted: number;
  quotasCompletedExactly: number;
  buildingCollapses: number;
  gulags: number;
  leninStatues: number;
  uniqueBuildingTypes: string[];
  currentYear: number;
  peakBuildingCount: number;
  bulldozedFrom: number;
  survivedPurge: boolean;
  wonReelection: boolean;
  /** Number of ticks with all indicators negative while Pravda positive */
  propagandaWinTicks: number;
}

/** Serialisable snapshot for save/load. */
export interface AchievementTrackerSaveData {
  unlockedIds: string[];
  stats: AchievementStats;
}

// ─────────────────────────────────────────────────────────
//  HELPER: default stats
// ─────────────────────────────────────────────────────────

function defaultStats(): AchievementStats {
  return {
    buildingsPlaced: 0,
    totalEvents: 0,
    totalDisasters: 0,
    consecutiveDisasters: 0,
    renameCount: 0,
    playTimeSeconds: 0,
    maxPopulation: 0,
    maxVodka: 0,
    maxMoney: 0,
    quotasCompleted: 0,
    quotasCompletedExactly: 0,
    buildingCollapses: 0,
    gulags: 0,
    leninStatues: 0,
    uniqueBuildingTypes: [],
    currentYear: 1922,
    peakBuildingCount: 0,
    bulldozedFrom: 0,
    survivedPurge: false,
    wonReelection: false,
    propagandaWinTicks: 0,
  };
}

// ─────────────────────────────────────────────────────────
//  ACHIEVEMENT ID → CONDITION MAP
// ─────────────────────────────────────────────────────────

/** Total unique building types available in the game. */
const TOTAL_BUILDING_TYPES = 16;

/** Grid size squared -- total cells. */
const TOTAL_GRID_CELLS = 900; // 30x30

type ConditionFn = (stats: AchievementStats, res: Resources | null) => boolean;

const CONDITIONS: Record<string, ConditionFn> = {
  first_building: (s) => s.buildingsPlaced >= 1,
  late_quota: (s) => s.quotasCompleted >= 1, // tracked via onQuotaCompleted with >100%
  collapse_no_witness: (s) => s.buildingCollapses >= 1, // simplified: any collapse counts
  full_grid: (s) => s.peakBuildingCount >= TOTAL_GRID_CELLS,
  ten_statues: (s) => s.leninStatues >= 10,
  no_food: (_s, r) => r != null && r.food <= 0,
  max_vodka: (s) => s.maxVodka >= 1000,
  first_gulag: (s) => s.gulags >= 1,
  hundred_pop: (s) => s.maxPopulation >= 100,
  zero_pop: (_s, r) => r != null && r.population <= 0,
  ten_events: (s) => s.totalEvents >= 10,
  fifty_events: (s) => s.totalEvents >= 50,
  bankruptcy: (_s, r) => r != null && r.money <= 0,
  rich: (s) => s.maxMoney >= 10_000,
  first_rename: (s) => s.renameCount >= 1,
  five_renames: (s) => s.renameCount >= 5,
  all_buildings: (s) => s.uniqueBuildingTypes.length >= TOTAL_BUILDING_TYPES,
  night_shift: (_s, r) => r != null && r.power <= 0 && r.population >= 50,
  year_2000: (s) => s.currentYear >= 2000,
  year_2100: (s) => s.currentYear >= 2100,
  no_buildings_high_pop: (s, r) => r != null && r.population >= 50 && s.peakBuildingCount === 0,
  bulldoze_everything: (s) => s.bulldozedFrom >= 10,
  three_disasters: (s) => s.consecutiveDisasters >= 3,
  propaganda_win: (s) => s.propagandaWinTicks >= 10,
  play_one_hour: (s) => s.playTimeSeconds >= 3600,
  play_five_hours: (s) => s.playTimeSeconds >= 18_000,
  vodka_economy: (_s, r) => r != null && r.vodka > r.money,
  only_gulags: (s) =>
    s.gulags >= 1 && s.uniqueBuildingTypes.length === 1 && s.uniqueBuildingTypes[0] === 'gulag',
  perfect_quota: (s) => s.quotasCompletedExactly >= 1,
  survive_purge: (s) => s.survivedPurge,
  reelected: (s) => s.wonReelection,
};

// ─────────────────────────────────────────────────────────
//  TRACKER
// ─────────────────────────────────────────────────────────

export class AchievementTracker {
  private unlockedIds: Set<string>;
  private stats: AchievementStats;
  private newUnlocks: Achievement[] = [];

  constructor() {
    this.unlockedIds = new Set();
    this.stats = defaultStats();
  }

  /** Evaluate all condition functions and unlock matching achievements. */
  private evaluate(resources: Resources | null): Achievement[] {
    const justUnlocked: Achievement[] = [];
    for (const ach of ACHIEVEMENTS) {
      if (this.unlockedIds.has(ach.id)) continue;
      const fn = CONDITIONS[ach.id];
      if (fn?.(this.stats, resources)) {
        this.unlockedIds.add(ach.id);
        justUnlocked.push(ach);
      }
    }
    if (justUnlocked.length > 0) {
      this.newUnlocks.push(...justUnlocked);
    }
    return justUnlocked;
  }

  /**
   * Called each simulation tick.
   * Updates time-based stats and re-evaluates conditions.
   */
  tick(
    resources: Resources | null,
    buildingCount: number,
    population: number,
    currentYear: number,
    deltaSeconds: number
  ): Achievement[] {
    this.stats.currentYear = currentYear;
    this.stats.playTimeSeconds += deltaSeconds;

    if (population > this.stats.maxPopulation) {
      this.stats.maxPopulation = population;
    }
    if (resources) {
      if (resources.vodka > this.stats.maxVodka) {
        this.stats.maxVodka = resources.vodka;
      }
      if (resources.money > this.stats.maxMoney) {
        this.stats.maxMoney = resources.money;
      }
    }
    if (buildingCount > this.stats.peakBuildingCount) {
      this.stats.peakBuildingCount = buildingCount;
    }

    return this.evaluate(resources);
  }

  /**
   * Called when a building is placed on the grid.
   * Tracks unique types, gulag/lenin statue counts.
   */
  onBuildingPlaced(defId: string): Achievement[] {
    this.stats.buildingsPlaced += 1;

    if (!this.stats.uniqueBuildingTypes.includes(defId)) {
      this.stats.uniqueBuildingTypes.push(defId);
    }

    // Track special building subtypes
    if (defId.includes('gulag')) {
      this.stats.gulags += 1;
    }
    if (defId.includes('lenin') || defId.includes('statue')) {
      this.stats.leninStatues += 1;
    }

    return this.evaluate(null);
  }

  /** Called when a building collapses. */
  onBuildingCollapsed(): Achievement[] {
    this.stats.buildingCollapses += 1;
    return this.evaluate(null);
  }

  /** Called when a random event is survived. */
  onEventSurvived(isDisaster: boolean): Achievement[] {
    this.stats.totalEvents += 1;
    if (isDisaster) {
      this.stats.totalDisasters += 1;
      this.stats.consecutiveDisasters += 1;
    } else {
      this.stats.consecutiveDisasters = 0;
    }
    return this.evaluate(null);
  }

  /**
   * Called when a quota is completed.
   * @param percentComplete - 1.0 = exactly 100%, >1.0 = exceeded
   */
  onQuotaCompleted(percentComplete: number): Achievement[] {
    this.stats.quotasCompleted += 1;
    if (Math.abs(percentComplete - 1.0) < 0.001) {
      this.stats.quotasCompletedExactly += 1;
    }
    return this.evaluate(null);
  }

  /** Called when the city is renamed. */
  onCityRenamed(): Achievement[] {
    this.stats.renameCount += 1;
    return this.evaluate(null);
  }

  /** Called when all buildings are bulldozed. */
  onBulldozedAll(previousCount: number): Achievement[] {
    if (previousCount >= 10) {
      this.stats.bulldozedFrom = previousCount;
    }
    return this.evaluate(null);
  }

  /** Called when a purge event is survived. */
  onPurgeSurvived(): Achievement[] {
    this.stats.survivedPurge = true;
    return this.evaluate(null);
  }

  /** Called when the player wins a re-election event. */
  onReelectionWon(): Achievement[] {
    this.stats.wonReelection = true;
    return this.evaluate(null);
  }

  /** Track a tick where Pravda is positive but indicators are negative. */
  onPropagandaWinTick(): Achievement[] {
    this.stats.propagandaWinTicks += 1;
    return this.evaluate(null);
  }

  /**
   * Returns achievements unlocked since the last call, then clears the queue.
   * Use this to drive toast / modal notifications.
   */
  getNewUnlocks(): Achievement[] {
    const result = [...this.newUnlocks];
    this.newUnlocks = [];
    return result;
  }

  /** Get all unlocked achievement objects. */
  getUnlocked(): Achievement[] {
    return ACHIEVEMENTS.filter((a) => this.unlockedIds.has(a.id));
  }

  /** Get the set of unlocked IDs. */
  getUnlockedIds(): ReadonlySet<string> {
    return this.unlockedIds;
  }

  /** Get current stats (read-only copy). */
  getStats(): Readonly<AchievementStats> {
    return { ...this.stats, uniqueBuildingTypes: [...this.stats.uniqueBuildingTypes] };
  }

  /** Serialize for save/load. */
  serialize(): AchievementTrackerSaveData {
    return {
      unlockedIds: [...this.unlockedIds],
      stats: {
        ...this.stats,
        uniqueBuildingTypes: [...this.stats.uniqueBuildingTypes],
      },
    };
  }

  /** Restore from save data. */
  static deserialize(data: AchievementTrackerSaveData): AchievementTracker {
    const tracker = new AchievementTracker();
    tracker.unlockedIds = new Set(data.unlockedIds);
    tracker.stats = {
      ...data.stats,
      uniqueBuildingTypes: [...data.stats.uniqueBuildingTypes],
    };
    return tracker;
  }
}
