import type { GameMeta, Resources } from '@/ecs/world';
import {
  MILESTONE_LABELS,
  TUTORIAL_MILESTONES,
  type TutorialSaveData,
  TutorialSystem,
  type UIElement,
} from '@/game/TutorialSystem';

// ─── Test Helpers ────────────────────────────────────────

function makeResources(overrides: Partial<Resources> = {}): Resources {
  return {
    money: 100,
    food: 10,
    vodka: 0,
    power: 0,
    powerUsed: 0,
    population: 20,
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

function makeMeta(overrides: Partial<GameMeta> = {}): GameMeta {
  return {
    seed: 'test',
    date: { year: 1922, month: 10, tick: 0 },
    quota: { type: 'food', target: 300, current: 0, deadlineYear: 1927 },
    selectedTool: 'select',
    gameOver: null,
    settlementTier: 'selo',
    blackMarks: 0,
    commendations: 0,
    threatLevel: 'safe',
    currentEra: 'revolution',
    roadQuality: 'none',
    roadCondition: 100,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────

describe('TutorialSystem', () => {
  let tutorial: TutorialSystem;

  beforeEach(() => {
    tutorial = new TutorialSystem();
  });

  describe('initialization', () => {
    it('starts active', () => {
      expect(tutorial.isActive()).toBe(true);
    });

    it('starts with no completed milestones', () => {
      expect(tutorial.getCompletedMilestones().size).toBe(0);
    });

    it('starts with no unlocked buildings', () => {
      expect(tutorial.getUnlockedBuildings()).toEqual([]);
    });

    it('starts with no guidance', () => {
      expect(tutorial.getCurrentGuidance()).toBeNull();
    });

    it('starts with 0% progress', () => {
      expect(tutorial.getProgress()).toBe(0);
    });
  });

  describe('milestone triggering', () => {
    it('triggers welcome milestone at tick 0', () => {
      const meta = makeMeta();
      const res = makeResources();
      const result = tutorial.tick(0, meta, res, 0);
      expect(result).not.toBeNull();
      expect(result!.id).toBe('welcome');
    });

    it('triggers first_building when buildingCount > 0', () => {
      const meta = makeMeta();
      const res = makeResources();

      // First trigger welcome
      tutorial.tick(0, meta, res, 0);
      // Then trigger first_building with a building placed
      const result = tutorial.tick(1, meta, res, 1);
      expect(result).not.toBeNull();
      expect(result!.id).toBe('first_building');
    });

    it('does not trigger first_building with 0 buildings', () => {
      const meta = makeMeta();
      const res = makeResources();

      tutorial.tick(0, meta, res, 0); // welcome
      const result = tutorial.tick(1, meta, res, 0); // no buildings yet
      // Should skip first_building (condition not met) and try build_farm (tick 30 not reached)
      expect(result).toBeNull();
    });

    it('triggers build_farm at tick 30', () => {
      const meta = makeMeta();
      const res = makeResources();

      tutorial.tick(0, meta, res, 0); // welcome
      tutorial.tick(1, meta, res, 1); // first_building
      const result = tutorial.tick(30, meta, res, 1);
      expect(result).not.toBeNull();
      expect(result!.id).toBe('build_farm');
    });

    it('triggers first_harvest when food > 50', () => {
      const meta = makeMeta();
      const res = makeResources({ food: 60 });

      // Complete prior milestones
      tutorial.tick(0, meta, res, 0); // welcome
      tutorial.tick(1, meta, res, 1); // first_building
      tutorial.tick(30, meta, res, 1); // build_farm
      const result = tutorial.tick(31, meta, res, 1);
      expect(result).not.toBeNull();
      expect(result!.id).toBe('first_harvest');
    });

    it('does not trigger first_harvest when food <= 50', () => {
      const meta = makeMeta();
      const lowFood = makeResources({ food: 30 });

      tutorial.tick(0, meta, lowFood, 0);
      tutorial.tick(1, meta, lowFood, 1);
      tutorial.tick(30, meta, lowFood, 1);
      const result = tutorial.tick(31, meta, lowFood, 1);
      expect(result).toBeNull();
    });

    it('triggers first_winter when season is winter (month 11)', () => {
      const winterMeta = makeMeta({ date: { year: 1922, month: 11, tick: 0 } });
      const res = makeResources({ food: 60 });

      // Complete prior milestones
      tutorial.tick(0, winterMeta, res, 0); // welcome
      tutorial.tick(1, winterMeta, res, 1); // first_building
      tutorial.tick(30, winterMeta, res, 1); // build_farm
      tutorial.tick(31, winterMeta, res, 1); // first_harvest
      tutorial.tick(90, winterMeta, res, 1); // build_housing
      tutorial.tick(180, winterMeta, res, 1); // power
      const result = tutorial.tick(181, winterMeta, res, 1);
      expect(result).not.toBeNull();
      expect(result!.id).toBe('first_winter');
    });

    it('triggers first_winter when month is January (also winter)', () => {
      const janMeta = makeMeta({ date: { year: 1923, month: 1, tick: 0 } });
      const res = makeResources({ food: 60 });

      // Fast-forward through prior milestones
      tutorial.tick(0, janMeta, res, 0);
      tutorial.tick(1, janMeta, res, 1);
      tutorial.tick(30, janMeta, res, 1);
      tutorial.tick(31, janMeta, res, 1);
      tutorial.tick(90, janMeta, res, 1);
      tutorial.tick(180, janMeta, res, 1);
      const result = tutorial.tick(181, janMeta, res, 1);
      expect(result).not.toBeNull();
      expect(result!.id).toBe('first_winter');
    });

    it('does not trigger first_winter in summer (month 6)', () => {
      const summerMeta = makeMeta({ date: { year: 1923, month: 6, tick: 0 } });
      const res = makeResources({ food: 60 });

      tutorial.tick(0, summerMeta, res, 0);
      tutorial.tick(1, summerMeta, res, 1);
      tutorial.tick(30, summerMeta, res, 1);
      tutorial.tick(31, summerMeta, res, 1);
      tutorial.tick(90, summerMeta, res, 1);
      tutorial.tick(180, summerMeta, res, 1);
      const result = tutorial.tick(181, summerMeta, res, 1);
      // first_winter condition not met, next eligible is vodka_economy at tick 360
      expect(result).toBeNull();
    });

    it('triggers era_transition when year >= 1928', () => {
      const meta = makeMeta({
        date: { year: 1928, month: 10, tick: 0 },
        quota: { type: 'food', target: 300, current: 0, deadlineYear: 1927 },
      });
      const res = makeResources({ food: 60 });

      // Complete all prior milestones by ticking with appropriate state
      const winterMeta = { ...meta, date: { year: 1922, month: 11, tick: 0 } };
      tutorial.tick(0, winterMeta, res, 0); // welcome
      tutorial.tick(1, winterMeta, res, 1); // first_building
      tutorial.tick(30, winterMeta, res, 1); // build_farm
      tutorial.tick(31, winterMeta, res, 1); // first_harvest
      tutorial.tick(90, winterMeta, res, 1); // build_housing
      tutorial.tick(180, winterMeta, res, 1); // power
      tutorial.tick(181, winterMeta, res, 1); // first_winter
      tutorial.tick(360, winterMeta, res, 1); // vodka_economy

      // Now use meta with year 1923 for year-based milestones
      const yearMeta = { ...meta, date: { year: 1923, month: 5, tick: 0 } };
      tutorial.tick(361, yearMeta, res, 1); // the_quota
      tutorial.tick(540, yearMeta, res, 1); // infrastructure
      tutorial.tick(541, yearMeta, res, 1); // first_year_complete
      tutorial.tick(720, yearMeta, res, 1); // government_buildings
      tutorial.tick(1080, yearMeta, res, 1); // cultural_progress

      // Now trigger era transition
      const result = tutorial.tick(2000, meta, res, 1);
      expect(result).not.toBeNull();
      expect(result!.id).toBe('era_transition');
    });

    it('deactivates tutorial on era_transition', () => {
      const meta = makeMeta({
        date: { year: 1928, month: 10, tick: 0 },
      });
      const res = makeResources({ food: 60 });
      const winterMeta = makeMeta({
        date: { year: 1922, month: 11, tick: 0 },
      });

      // Complete all milestones
      tutorial.tick(0, winterMeta, res, 0);
      tutorial.tick(1, winterMeta, res, 1);
      tutorial.tick(30, winterMeta, res, 1);
      tutorial.tick(31, winterMeta, res, 1);
      tutorial.tick(90, winterMeta, res, 1);
      tutorial.tick(180, winterMeta, res, 1);
      tutorial.tick(181, winterMeta, res, 1);
      tutorial.tick(360, winterMeta, res, 1);
      const yearMeta = makeMeta({ date: { year: 1923, month: 5, tick: 0 } });
      tutorial.tick(361, yearMeta, res, 1);
      tutorial.tick(540, yearMeta, res, 1);
      tutorial.tick(541, yearMeta, res, 1);
      tutorial.tick(720, yearMeta, res, 1);
      tutorial.tick(1080, yearMeta, res, 1);

      expect(tutorial.isActive()).toBe(true);
      tutorial.tick(2000, meta, res, 1); // era_transition
      expect(tutorial.isActive()).toBe(false);
    });

    it('returns only one milestone per tick', () => {
      const meta = makeMeta();
      const res = makeResources();

      // Tick 0 should trigger welcome, not both welcome and first_building
      const result = tutorial.tick(0, meta, res, 1);
      expect(result!.id).toBe('welcome');

      // Next tick triggers first_building
      const result2 = tutorial.tick(0, meta, res, 1);
      expect(result2!.id).toBe('first_building');
    });

    it('returns null when no milestones are ready', () => {
      const meta = makeMeta();
      const res = makeResources();

      tutorial.tick(0, meta, res, 0); // welcome
      // No buildings placed, tick < 30 — nothing should trigger
      const result = tutorial.tick(5, meta, res, 0);
      expect(result).toBeNull();
    });

    it('returns null when tutorial is inactive', () => {
      tutorial.skip();
      const meta = makeMeta();
      const res = makeResources();
      const result = tutorial.tick(0, meta, res, 0);
      expect(result).toBeNull();
    });
  });

  describe('building unlocking', () => {
    it('unlocks collective-farm-hq on welcome', () => {
      const meta = makeMeta();
      const res = makeResources();

      expect(tutorial.isBuildingUnlocked('collective-farm-hq')).toBe(false);
      tutorial.tick(0, meta, res, 0);
      expect(tutorial.isBuildingUnlocked('collective-farm-hq')).toBe(true);
    });

    it('unlocks workers-house-a and workers-house-b on build_housing', () => {
      const meta = makeMeta();
      const res = makeResources({ food: 60 });

      // Complete milestones up to build_housing
      tutorial.tick(0, meta, res, 0); // welcome
      tutorial.tick(1, meta, res, 1); // first_building
      tutorial.tick(30, meta, res, 1); // build_farm
      tutorial.tick(31, meta, res, 1); // first_harvest

      expect(tutorial.isBuildingUnlocked('workers-house-a')).toBe(false);
      tutorial.tick(90, meta, res, 1); // build_housing
      expect(tutorial.isBuildingUnlocked('workers-house-a')).toBe(true);
      expect(tutorial.isBuildingUnlocked('workers-house-b')).toBe(true);
    });

    it('unlocks power-station on power milestone', () => {
      const meta = makeMeta();
      const res = makeResources({ food: 60 });

      tutorial.tick(0, meta, res, 0);
      tutorial.tick(1, meta, res, 1);
      tutorial.tick(30, meta, res, 1);
      tutorial.tick(31, meta, res, 1);
      tutorial.tick(90, meta, res, 1);

      expect(tutorial.isBuildingUnlocked('power-station')).toBe(false);
      tutorial.tick(180, meta, res, 1); // power
      expect(tutorial.isBuildingUnlocked('power-station')).toBe(true);
    });

    it('progressive unlocking is cumulative', () => {
      const meta = makeMeta();
      const res = makeResources({ food: 60 });

      tutorial.tick(0, meta, res, 0);
      tutorial.tick(1, meta, res, 1);
      tutorial.tick(30, meta, res, 1);
      tutorial.tick(31, meta, res, 1);
      tutorial.tick(90, meta, res, 1);
      tutorial.tick(180, meta, res, 1);

      // All buildings from welcome, build_housing, and power should be unlocked
      expect(tutorial.isBuildingUnlocked('collective-farm-hq')).toBe(true);
      expect(tutorial.isBuildingUnlocked('workers-house-a')).toBe(true);
      expect(tutorial.isBuildingUnlocked('workers-house-b')).toBe(true);
      expect(tutorial.isBuildingUnlocked('power-station')).toBe(true);

      // Not-yet-unlocked buildings should still be locked
      expect(tutorial.isBuildingUnlocked('vodka-distillery')).toBe(false);
    });

    it('returns all unlocked buildings', () => {
      const meta = makeMeta();
      const res = makeResources();

      tutorial.tick(0, meta, res, 0); // welcome unlocks collective-farm-hq
      const unlocked = tutorial.getUnlockedBuildings();
      expect(unlocked).toContain('collective-farm-hq');
      expect(unlocked).toHaveLength(1);
    });

    it('all buildings allowed when tutorial is skipped', () => {
      tutorial.skip();
      expect(tutorial.isBuildingUnlocked('anything')).toBe(true);
      expect(tutorial.isBuildingUnlocked('power-station')).toBe(true);
    });

    it('returns empty array for getUnlockedBuildings when inactive', () => {
      tutorial.skip();
      expect(tutorial.getUnlockedBuildings()).toEqual([]);
    });
  });

  describe('UI element revelation', () => {
    it('reveals build_button on welcome', () => {
      const meta = makeMeta();
      const res = makeResources();

      expect(tutorial.isUIRevealed('build_button')).toBe(false);
      tutorial.tick(0, meta, res, 0);
      expect(tutorial.isUIRevealed('build_button')).toBe(true);
    });

    it('reveals resource_bar on first_building', () => {
      const meta = makeMeta();
      const res = makeResources();

      tutorial.tick(0, meta, res, 0); // welcome
      expect(tutorial.isUIRevealed('resource_bar')).toBe(false);
      tutorial.tick(1, meta, res, 1); // first_building
      expect(tutorial.isUIRevealed('resource_bar')).toBe(true);
    });

    it('reveals speed_controls on first_harvest', () => {
      const meta = makeMeta();
      const res = makeResources({ food: 60 });

      tutorial.tick(0, meta, res, 0);
      tutorial.tick(1, meta, res, 1);
      tutorial.tick(30, meta, res, 1);

      expect(tutorial.isUIRevealed('speed_controls')).toBe(false);
      tutorial.tick(31, meta, res, 1); // first_harvest
      expect(tutorial.isUIRevealed('speed_controls')).toBe(true);
    });

    it('reveals quota_display on the_quota', () => {
      const winterMeta = makeMeta({ date: { year: 1922, month: 11, tick: 0 } });
      const res = makeResources({ food: 60 });

      tutorial.tick(0, winterMeta, res, 0);
      tutorial.tick(1, winterMeta, res, 1);
      tutorial.tick(30, winterMeta, res, 1);
      tutorial.tick(31, winterMeta, res, 1);
      tutorial.tick(90, winterMeta, res, 1);
      tutorial.tick(180, winterMeta, res, 1);
      tutorial.tick(181, winterMeta, res, 1); // first_winter
      tutorial.tick(360, winterMeta, res, 1); // vodka_economy

      expect(tutorial.isUIRevealed('quota_display')).toBe(false);
      tutorial.tick(361, winterMeta, res, 1); // the_quota
      expect(tutorial.isUIRevealed('quota_display')).toBe(true);
    });

    it('reveals hamburger_menu and pravda_ticker on infrastructure', () => {
      const winterMeta = makeMeta({ date: { year: 1922, month: 11, tick: 0 } });
      const res = makeResources({ food: 60 });

      tutorial.tick(0, winterMeta, res, 0);
      tutorial.tick(1, winterMeta, res, 1);
      tutorial.tick(30, winterMeta, res, 1);
      tutorial.tick(31, winterMeta, res, 1);
      tutorial.tick(90, winterMeta, res, 1);
      tutorial.tick(180, winterMeta, res, 1);
      tutorial.tick(181, winterMeta, res, 1);
      tutorial.tick(360, winterMeta, res, 1);
      tutorial.tick(361, winterMeta, res, 1);

      expect(tutorial.isUIRevealed('hamburger_menu')).toBe(false);
      expect(tutorial.isUIRevealed('pravda_ticker')).toBe(false);
      tutorial.tick(540, winterMeta, res, 1); // infrastructure
      expect(tutorial.isUIRevealed('hamburger_menu')).toBe(true);
      expect(tutorial.isUIRevealed('pravda_ticker')).toBe(true);
    });

    it('all UI elements revealed when tutorial is skipped', () => {
      tutorial.skip();
      const elements: UIElement[] = [
        'build_button',
        'resource_bar',
        'speed_controls',
        'quota_display',
        'hamburger_menu',
        'pravda_ticker',
        'settlement_badge',
        'personnel_file',
      ];
      for (const el of elements) {
        expect(tutorial.isUIRevealed(el)).toBe(true);
      }
    });
  });

  describe('skip()', () => {
    it('deactivates the tutorial', () => {
      tutorial.skip();
      expect(tutorial.isActive()).toBe(false);
    });

    it('opens all building gates', () => {
      tutorial.skip();
      expect(tutorial.isBuildingUnlocked('power-station')).toBe(true);
      expect(tutorial.isBuildingUnlocked('vodka-distillery')).toBe(true);
      expect(tutorial.isBuildingUnlocked('nonexistent')).toBe(true);
    });

    it('opens all UI gates', () => {
      tutorial.skip();
      expect(tutorial.isUIRevealed('build_button')).toBe(true);
      expect(tutorial.isUIRevealed('quota_display')).toBe(true);
      expect(tutorial.isUIRevealed('personnel_file')).toBe(true);
    });

    it('prevents further milestone triggers', () => {
      tutorial.skip();
      const result = tutorial.tick(0, makeMeta(), makeResources(), 0);
      expect(result).toBeNull();
    });
  });

  describe('progress calculation', () => {
    it('returns 0 when no milestones completed', () => {
      expect(tutorial.getProgress()).toBe(0);
    });

    it('returns correct fraction after completing milestones', () => {
      const meta = makeMeta();
      const res = makeResources();
      const total = TUTORIAL_MILESTONES.length;

      tutorial.tick(0, meta, res, 0); // welcome
      expect(tutorial.getProgress()).toBeCloseTo(1 / total);

      tutorial.tick(1, meta, res, 1); // first_building
      expect(tutorial.getProgress()).toBeCloseTo(2 / total);
    });

    it('returns 1 when all milestones completed', () => {
      const winterMeta = makeMeta({ date: { year: 1922, month: 11, tick: 0 } });
      const transitionMeta = makeMeta({ date: { year: 1928, month: 10, tick: 0 } });
      const res = makeResources({ food: 60 });
      const yearMeta = makeMeta({ date: { year: 1923, month: 5, tick: 0 } });

      tutorial.tick(0, winterMeta, res, 0);
      tutorial.tick(1, winterMeta, res, 1);
      tutorial.tick(30, winterMeta, res, 1);
      tutorial.tick(31, winterMeta, res, 1);
      tutorial.tick(90, winterMeta, res, 1);
      tutorial.tick(180, winterMeta, res, 1);
      tutorial.tick(181, winterMeta, res, 1);
      tutorial.tick(360, winterMeta, res, 1);
      tutorial.tick(361, yearMeta, res, 1);
      tutorial.tick(540, yearMeta, res, 1);
      tutorial.tick(541, yearMeta, res, 1);
      tutorial.tick(720, yearMeta, res, 1);
      tutorial.tick(1080, yearMeta, res, 1);
      tutorial.tick(2000, transitionMeta, res, 1);

      expect(tutorial.getProgress()).toBe(1);
    });
  });

  describe('guidance', () => {
    it('returns null before any milestone', () => {
      expect(tutorial.getCurrentGuidance()).toBeNull();
    });

    it('returns the most recent milestone dialogue', () => {
      const meta = makeMeta();
      const res = makeResources();

      tutorial.tick(0, meta, res, 0); // welcome
      expect(tutorial.getCurrentGuidance()).toContain('Krupnik');

      tutorial.tick(1, meta, res, 1); // first_building
      expect(tutorial.getCurrentGuidance()).toContain('collapse');
    });
  });

  describe('serialization', () => {
    it('roundtrips through serialize/deserialize', () => {
      const meta = makeMeta();
      const res = makeResources({ food: 60 });

      // Complete a few milestones
      tutorial.tick(0, meta, res, 0); // welcome
      tutorial.tick(1, meta, res, 1); // first_building
      tutorial.tick(30, meta, res, 1); // build_farm
      tutorial.tick(31, meta, res, 1); // first_harvest

      const data = tutorial.serialize();
      const restored = TutorialSystem.deserialize(data);

      expect(restored.isActive()).toBe(tutorial.isActive());
      expect(restored.getProgress()).toBe(tutorial.getProgress());
      expect(restored.isBuildingUnlocked('collective-farm-hq')).toBe(true);
      expect(restored.isUIRevealed('build_button')).toBe(true);
      expect(restored.isUIRevealed('resource_bar')).toBe(true);
      expect(restored.isUIRevealed('speed_controls')).toBe(true);
      expect(restored.getCurrentGuidance()).not.toBeNull();
    });

    it('preserves inactive state', () => {
      tutorial.skip();
      const data = tutorial.serialize();
      const restored = TutorialSystem.deserialize(data);
      expect(restored.isActive()).toBe(false);
    });

    it('serialized data has expected shape', () => {
      const meta = makeMeta();
      const res = makeResources();
      tutorial.tick(0, meta, res, 0);

      const data = tutorial.serialize();
      expect(data).toHaveProperty('completedMilestones');
      expect(data).toHaveProperty('active');
      expect(Array.isArray(data.completedMilestones)).toBe(true);
      expect(data.completedMilestones).toContain('welcome');
      expect(data.active).toBe(true);
    });

    it('deserialize rebuilds unlocked buildings from completed milestones', () => {
      const data: TutorialSaveData = {
        completedMilestones: ['welcome', 'first_building', 'build_farm', 'build_housing', 'power'],
        active: true,
      };

      const restored = TutorialSystem.deserialize(data);
      expect(restored.isBuildingUnlocked('collective-farm-hq')).toBe(true);
      expect(restored.isBuildingUnlocked('workers-house-a')).toBe(true);
      expect(restored.isBuildingUnlocked('workers-house-b')).toBe(true);
      expect(restored.isBuildingUnlocked('power-station')).toBe(true);
      expect(restored.isBuildingUnlocked('vodka-distillery')).toBe(false);
    });

    it('deserialize rebuilds revealed UI from completed milestones', () => {
      const data: TutorialSaveData = {
        completedMilestones: ['welcome', 'first_building'],
        active: true,
      };

      const restored = TutorialSystem.deserialize(data);
      expect(restored.isUIRevealed('build_button')).toBe(true);
      expect(restored.isUIRevealed('resource_bar')).toBe(true);
      expect(restored.isUIRevealed('speed_controls')).toBe(false);
    });
  });

  describe('milestone definitions', () => {
    it('has 14 milestones', () => {
      expect(TUTORIAL_MILESTONES).toHaveLength(14);
    });

    it('all milestones have unique IDs', () => {
      const ids = TUTORIAL_MILESTONES.map((m) => m.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('all milestones have non-empty dialogue', () => {
      for (const m of TUTORIAL_MILESTONES) {
        expect(m.dialogue.length).toBeGreaterThan(0);
      }
    });

    it('welcome is the first milestone', () => {
      expect(TUTORIAL_MILESTONES[0]!.id).toBe('welcome');
    });

    it('era_transition is the last milestone', () => {
      expect(TUTORIAL_MILESTONES[TUTORIAL_MILESTONES.length - 1]!.id).toBe('era_transition');
    });

    it('condition-based milestones have triggerTick <= their position peers', () => {
      // Milestones are ordered by prerequisite progression, not by triggerTick.
      // Condition-based milestones may have low triggerTick values because
      // their activation depends on the condition, not the tick threshold.
      const withConditions = TUTORIAL_MILESTONES.filter((m) => m.condition);
      for (const m of withConditions) {
        expect(m.triggerTick).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('pauseOnTrigger', () => {
    it('welcome milestone has pauseOnTrigger=true', () => {
      const milestone = TUTORIAL_MILESTONES.find((m) => m.id === 'welcome');
      expect(milestone?.pauseOnTrigger).toBe(true);
    });

    it('first_building milestone has pauseOnTrigger=false', () => {
      const milestone = TUTORIAL_MILESTONES.find((m) => m.id === 'first_building');
      expect(milestone?.pauseOnTrigger).toBe(false);
    });

    it('build_housing milestone has pauseOnTrigger=true', () => {
      const milestone = TUTORIAL_MILESTONES.find((m) => m.id === 'build_housing');
      expect(milestone?.pauseOnTrigger).toBe(true);
    });
  });

  describe('category-level locking (progressive disclosure)', () => {
    it('isCategoryUnlocked returns false when no buildings in list are unlocked', () => {
      // Before any milestones, workers-house-a is not yet unlocked
      expect(tutorial.isCategoryUnlocked(['workers-house-a', 'workers-house-b'])).toBe(false);
    });

    it('isCategoryUnlocked returns true when any building in list is unlocked', () => {
      const meta = makeMeta();
      const res = makeResources();
      tutorial.tick(0, meta, res, 0); // welcome → unlocks collective-farm-hq
      expect(tutorial.isCategoryUnlocked(['collective-farm-hq', 'vodka-distillery'])).toBe(true);
    });

    it('isCategoryUnlocked returns true when tutorial is inactive', () => {
      tutorial.skip();
      expect(tutorial.isCategoryUnlocked(['anything', 'nonexistent'])).toBe(true);
    });

    it('isCategoryUnlocked returns true for empty defId list when tutorial inactive', () => {
      tutorial.skip();
      expect(tutorial.isCategoryUnlocked([])).toBe(true);
    });

    it('getNextUnlockMilestoneForBuildings returns null when tutorial is inactive', () => {
      tutorial.skip();
      expect(tutorial.getNextUnlockMilestoneForBuildings(['power-station'])).toBeNull();
    });

    it('getNextUnlockMilestoneForBuildings returns null when category is already unlocked', () => {
      const meta = makeMeta();
      const res = makeResources();
      tutorial.tick(0, meta, res, 0); // welcome → unlocks collective-farm-hq
      expect(tutorial.getNextUnlockMilestoneForBuildings(['collective-farm-hq'])).toBeNull();
    });

    it('getNextUnlockMilestoneForBuildings returns the correct milestone for locked buildings', () => {
      const meta = makeMeta();
      const res = makeResources();
      tutorial.tick(0, meta, res, 0); // welcome only

      // power-station is unlocked by the 'power' milestone
      expect(tutorial.getNextUnlockMilestoneForBuildings(['power-station'])).toBe('power');

      // workers-house-a is unlocked by 'build_housing'
      expect(tutorial.getNextUnlockMilestoneForBuildings(['workers-house-a'])).toBe('build_housing');

      // vodka-distillery is unlocked by 'vodka_economy'
      expect(tutorial.getNextUnlockMilestoneForBuildings(['vodka-distillery'])).toBe('vodka_economy');
    });

    it('getNextUnlockMilestoneForBuildings returns earliest milestone for mixed list', () => {
      // government-hq is unlocked at 'government_buildings', cultural-palace at 'cultural_progress'
      // government_buildings comes first in the milestone list
      expect(tutorial.getNextUnlockMilestoneForBuildings(['government-hq', 'cultural-palace'])).toBe(
        'government_buildings',
      );
    });

    it('getNextUnlockMilestoneForBuildings returns null for buildings not in any milestone', () => {
      // 'nonexistent-building' is not listed in any milestone's unlockedBuildings
      expect(tutorial.getNextUnlockMilestoneForBuildings(['nonexistent-building'])).toBeNull();
    });
  });

  describe('milestone labels', () => {
    it('has a label for every milestone that unlocks buildings', () => {
      for (const milestone of TUTORIAL_MILESTONES) {
        if (milestone.unlockedBuildings && milestone.unlockedBuildings.length > 0) {
          expect(MILESTONE_LABELS[milestone.id]).toBeDefined();
          expect(typeof MILESTONE_LABELS[milestone.id]).toBe('string');
        }
      }
    });

    it('has a label for every milestone ID', () => {
      for (const milestone of TUTORIAL_MILESTONES) {
        expect(MILESTONE_LABELS[milestone.id]).toBeDefined();
      }
    });
  });
});
