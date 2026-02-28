import { ACHIEVEMENTS } from '../../src/content/worldbuilding';
import { AchievementTracker } from '../../src/game/AchievementTracker';
import { createGameTally, type TallyGameState } from '../../src/game/GameTally';
import { ScoringSystem } from '../../src/game/ScoringSystem';

/** Helper to build a minimal TallyGameState. */
function makeGameState(overrides?: Partial<TallyGameState>): TallyGameState {
  return {
    victory: false,
    reason: 'All citizens have perished.',
    currentYear: 1940,
    startYear: 1922,
    population: 0,
    buildingCount: 5,
    money: 100,
    food: 20,
    vodka: 10,
    blackMarks: 3,
    commendations: 1,
    settlementTier: 'posyolok',
    quotaFailures: 2,
    ...overrides,
  };
}

describe('GameTally', () => {
  // ── createGameTally basic output ───────────────────────

  describe('createGameTally', () => {
    it('returns a complete TallyData object', () => {
      const scoring = new ScoringSystem('worker');
      const achievements = new AchievementTracker();
      const state = makeGameState();

      const tally = createGameTally(scoring, achievements, state);

      expect(tally.verdict).toBeDefined();
      expect(tally.difficulty).toBe('worker');
      expect(tally.scoreBreakdown).toBeDefined();
      expect(typeof tally.finalScore).toBe('number');
      expect(tally.statistics).toBeDefined();
      expect(Array.isArray(tally.medals)).toBe(true);
      expect(Array.isArray(tally.achievements)).toBe(true);
      expect(typeof tally.achievementsUnlocked).toBe('number');
      expect(typeof tally.achievementsTotal).toBe('number');
    });
  });

  // ── Verdict ────────────────────────────────────────────

  describe('verdict', () => {
    it('reflects victory state', () => {
      const scoring = new ScoringSystem();
      const achievements = new AchievementTracker();
      const state = makeGameState({ victory: true, reason: 'You survived!' });

      const tally = createGameTally(scoring, achievements, state);

      expect(tally.verdict.victory).toBe(true);
      expect(tally.verdict.reason).toBe('You survived!');
      expect(tally.verdict.title.length).toBeGreaterThan(0);
      expect(tally.verdict.summary.length).toBeGreaterThan(0);
    });

    it('reflects defeat state', () => {
      const scoring = new ScoringSystem();
      const achievements = new AchievementTracker();
      const state = makeGameState({ victory: false, reason: 'Arrested by KGB.' });

      const tally = createGameTally(scoring, achievements, state);

      expect(tally.verdict.victory).toBe(false);
      expect(tally.verdict.reason).toBe('Arrested by KGB.');
    });

    it('produces deterministic titles from game state', () => {
      const scoring = new ScoringSystem();
      const achievements = new AchievementTracker();
      const state = makeGameState({ victory: true });

      const tally1 = createGameTally(scoring, achievements, state);
      const tally2 = createGameTally(scoring, achievements, state);

      expect(tally1.verdict.title).toBe(tally2.verdict.title);
      expect(tally1.verdict.summary).toBe(tally2.verdict.summary);
    });
  });

  // ── Score integration ──────────────────────────────────

  describe('score integration', () => {
    it('includes score breakdown from ScoringSystem', () => {
      const scoring = new ScoringSystem('tovarish');
      scoring.onQuotaMet();
      scoring.onEraEnd(0, 'Stagnation', 100, 10, 2, 1);

      const achievements = new AchievementTracker();
      const state = makeGameState();

      const tally = createGameTally(scoring, achievements, state);

      // ScoreBreakdown contains per-era details, not flat fields
      expect(tally.scoreBreakdown.eras).toHaveLength(1);
      const era = tally.scoreBreakdown.eras[0]!;
      expect(era.workersAlivePoints).toBe(200); // 100 workers * 2 pts
      expect(era.buildingsStandingPoints).toBe(50); // 10 buildings * 5 pts
      expect(era.quotasMetPoints).toBe(50); // 1 quota * 50 pts
      expect(era.cleanEraBonus).toBe(100); // no investigation
      expect(tally.finalScore).toBe(scoring.getFinalScore());
      expect(tally.difficulty).toBe('tovarish');
    });

    it('final score applies difficulty multiplier', () => {
      const scoring = new ScoringSystem('worker', 'forgiving'); // 0.5x multiplier
      scoring.onEraEnd(0, 'Stagnation', 100, 10, 0, 0);
      const subtotal = scoring.getScoreBreakdown().subtotal;

      const tally = createGameTally(scoring, new AchievementTracker(), makeGameState());

      expect(tally.finalScore).toBe(Math.floor(subtotal * 0.5));
    });
  });

  // ── Statistics ─────────────────────────────────────────

  describe('statistics', () => {
    it('populates from game state and tracker stats', () => {
      const scoring = new ScoringSystem();
      scoring.onQuotaMet();

      const achievements = new AchievementTracker();
      achievements.onBuildingPlaced('tenement-a');
      achievements.onBuildingPlaced('coal-plant');
      achievements.onBuildingCollapsed();
      achievements.onEventSurvived(false);
      achievements.onEventSurvived(true);
      achievements.onCityRenamed();

      const state = makeGameState({
        currentYear: 1950,
        startYear: 1922,
        population: 75,
        buildingCount: 12,
        money: 500,
        food: 100,
        vodka: 80,
        blackMarks: 4,
        commendations: 2,
        settlementTier: 'pgt',
        quotaFailures: 1,
      });

      const tally = createGameTally(scoring, achievements, state);
      const stats = tally.statistics;

      expect(stats.yearReached).toBe(1950);
      expect(stats.yearsPlayed).toBe(28);
      expect(stats.finalPopulation).toBe(75);
      expect(stats.buildingsPlaced).toBe(2);
      expect(stats.finalBuildingCount).toBe(12);
      expect(stats.buildingCollapses).toBe(1);
      expect(stats.uniqueBuildingTypes).toBe(2);
      expect(stats.quotasMet).toBe(1);
      expect(stats.quotasMissed).toBe(1);
      expect(stats.totalEvents).toBe(2);
      expect(stats.totalDisasters).toBe(1);
      expect(stats.renameCount).toBe(1);
      expect(stats.finalMoney).toBe(500);
      expect(stats.finalFood).toBe(100);
      expect(stats.finalVodka).toBe(80);
      expect(stats.blackMarks).toBe(4);
      expect(stats.commendations).toBe(2);
      expect(stats.settlementTier).toBe('pgt');
    });

    it('peakPopulation comes from achievement tracker maxPopulation', () => {
      const scoring = new ScoringSystem();
      const achievements = new AchievementTracker();

      // Simulate ticks with varying population
      achievements.tick(
        {
          money: 100,
          food: 50,
          vodka: 10,
          power: 5,
          powerUsed: 3,
          population: 200,
          trudodni: 0,
          blat: 10,
          timber: 0,
          steel: 0,
          cement: 0,
          prefab: 0,
          seedFund: 1,
          emergencyReserve: 0,
          storageCapacity: 200,
        },
        5,
        200,
        1930,
        1
      );
      achievements.tick(
        {
          money: 100,
          food: 50,
          vodka: 10,
          power: 5,
          powerUsed: 3,
          population: 50,
          trudodni: 0,
          blat: 10,
          timber: 0,
          steel: 0,
          cement: 0,
          prefab: 0,
          seedFund: 1,
          emergencyReserve: 0,
          storageCapacity: 200,
        },
        5,
        50,
        1930,
        1
      );

      const state = makeGameState({ population: 50 });
      const tally = createGameTally(scoring, achievements, state);

      expect(tally.statistics.peakPopulation).toBe(200);
      expect(tally.statistics.finalPopulation).toBe(50);
    });
  });

  // ── Medals ─────────────────────────────────────────────

  describe('medals', () => {
    it('includes awarded medals from ScoringSystem', () => {
      const scoring = new ScoringSystem();
      scoring.awardMedal('red_potato');
      scoring.awardMedal('vodka_diplomat');

      const tally = createGameTally(scoring, new AchievementTracker(), makeGameState());

      expect(tally.medals).toHaveLength(2);
      expect(tally.medals.map((m) => m.id)).toContain('red_potato');
      expect(tally.medals.map((m) => m.id)).toContain('vodka_diplomat');
    });

    it('returns empty array when no medals awarded', () => {
      const scoring = new ScoringSystem();
      const tally = createGameTally(scoring, new AchievementTracker(), makeGameState());
      expect(tally.medals).toHaveLength(0);
    });
  });

  // ── Achievements ───────────────────────────────────────

  describe('achievements', () => {
    it('lists visible achievements with unlock status', () => {
      const achievements = new AchievementTracker();
      achievements.onBuildingPlaced('tenement-a'); // unlocks first_building

      const tally = createGameTally(new ScoringSystem(), achievements, makeGameState());

      const firstBuilding = tally.achievements.find((a) => a.id === 'first_building');
      expect(firstBuilding).toBeDefined();
      expect(firstBuilding!.unlocked).toBe(true);

      // A non-unlocked visible achievement
      const fullGrid = tally.achievements.find((a) => a.id === 'full_grid');
      expect(fullGrid).toBeDefined();
      expect(fullGrid!.unlocked).toBe(false);
    });

    it('hidden achievements only appear when unlocked', () => {
      const achievements = new AchievementTracker();
      const tally = createGameTally(new ScoringSystem(), achievements, makeGameState());

      // zero_pop is hidden -- should not appear when not unlocked
      const zeroPop = tally.achievements.find((a) => a.id === 'zero_pop');
      expect(zeroPop).toBeUndefined();
    });

    it('hidden achievements appear when unlocked', () => {
      const achievements = new AchievementTracker();
      const res = {
        money: 100,
        food: 50,
        vodka: 10,
        power: 5,
        powerUsed: 3,
        population: 0,
        trudodni: 0,
        blat: 10,
        timber: 0,
        steel: 0,
        cement: 0,
        prefab: 0,
        seedFund: 1,
        emergencyReserve: 0,
        storageCapacity: 200,
      };
      achievements.tick(res, 5, 0, 1980, 1);

      const tally = createGameTally(new ScoringSystem(), achievements, makeGameState());

      const zeroPop = tally.achievements.find((a) => a.id === 'zero_pop');
      expect(zeroPop).toBeDefined();
      expect(zeroPop!.unlocked).toBe(true);
      expect(zeroPop!.hidden).toBe(true);
    });

    it('counts unlocked vs total correctly', () => {
      const achievements = new AchievementTracker();
      // Placing a gulag unlocks: first_building, first_gulag, only_gulags
      achievements.onBuildingPlaced('gulag');

      const tally = createGameTally(new ScoringSystem(), achievements, makeGameState());

      expect(tally.achievementsUnlocked).toBe(3);
      expect(tally.achievementsTotal).toBe(ACHIEVEMENTS.length);
    });
  });

  // ── Edge cases ─────────────────────────────────────────

  describe('edge cases', () => {
    it('handles fresh game with no activity', () => {
      const tally = createGameTally(
        new ScoringSystem(),
        new AchievementTracker(),
        makeGameState({ currentYear: 1922, startYear: 1922 })
      );

      expect(tally.finalScore).toBe(0);
      expect(tally.statistics.yearsPlayed).toBe(0);
      expect(tally.statistics.playTimeSeconds).toBe(0);
      expect(tally.medals).toHaveLength(0);
      expect(tally.achievementsUnlocked).toBe(0);
    });

    it('handles maximum difficulty with high scores', () => {
      const scoring = new ScoringSystem('tovarish'); // hardest difficulty
      scoring.onQuotaMet();
      scoring.onEraEnd(5, 'Perestroika', 500, 30, 5, 0);

      const tally = createGameTally(scoring, new AchievementTracker(), makeGameState());

      expect(tally.difficulty).toBe('tovarish');
      expect(tally.finalScore).toBe(scoring.getFinalScore());
      // tovarish + permadeath = 2.0x multiplier, so finalScore > subtotal
      expect(tally.finalScore).toBeGreaterThan(scoring.getScoreBreakdown().subtotal);
    });
  });
});
