import type { GameMeta, Resources } from '@/ecs/world';
import { ERA_DEFINITIONS, ERA_ORDER, eraIndexForYear } from '@/game/era/definitions';
import { EraSystem } from '@/game/era/EraSystem';
import { getBuildingTierRequirement, tierMeetsRequirement } from '@/game/era/tiers';
import type { EraId } from '@/game/era/types';

/** Build a partial GameMeta for condition tests (only fields the check accesses). */
function stubMeta(overrides: Partial<GameMeta> = {}): GameMeta {
  return {
    seed: '',
    date: { year: 1922, month: 1, tick: 0 },
    quota: { type: 'food', target: 0, current: 0, deadlineYear: 1927 },
    selectedTool: 'none',
    gameOver: null,
    settlementTier: 'selo',
    blackMarks: 0,
    commendations: 0,
    threatLevel: 'safe',
    currentEra: 'war_communism',
    roadQuality: 'none',
    roadCondition: 100,
    ...overrides,
  };
}

/** Build a partial Resources for condition tests (only fields the check accesses). */
function stubResources(overrides: Partial<Resources> = {}): Resources {
  return {
    money: 0,
    food: 0,
    vodka: 0,
    power: 0,
    powerUsed: 0,
    population: 0,
    trudodni: 0,
    blat: 0,
    timber: 0,
    steel: 0,
    cement: 0,
    prefab: 0,
    seedFund: 0,
    emergencyReserve: 0,
    storageCapacity: 0,
    ...overrides,
  };
}

describe('Era Integration', () => {
  let eraSys: EraSystem;

  beforeEach(() => {
    eraSys = new EraSystem(1922);
  });

  // ── Era transitions ──────────────────────────────────────────

  describe('era transitions at correct year boundaries', () => {
    it('starts in war_communism era for year 1922', () => {
      expect(eraSys.getCurrentEraId()).toBe('war_communism');
      expect(eraSys.getCurrentEra().name).toBe('War Communism');
    });

    it('transitions to first_plans at year 1928', () => {
      const newEra = eraSys.checkTransition(1928);
      expect(newEra).not.toBeNull();
      expect(newEra!.id).toBe('first_plans');
      expect(eraSys.getPreviousEraId()).toBe('war_communism');
    });

    it('transitions through all 8 eras in chronological order', () => {
      const expectedTransitions: Array<{ year: number; eraId: EraId }> = [
        { year: 1928, eraId: 'first_plans' },
        { year: 1941, eraId: 'great_patriotic' },
        { year: 1945, eraId: 'reconstruction' },
        { year: 1953, eraId: 'thaw' },
        { year: 1964, eraId: 'stagnation' },
        { year: 1985, eraId: 'perestroika' },
        { year: 1991, eraId: 'eternal_soviet' },
      ];

      for (const { year, eraId } of expectedTransitions) {
        const newEra = eraSys.checkTransition(year);
        expect(newEra).not.toBeNull();
        expect(newEra!.id).toBe(eraId);
      }
    });

    it('does not transition when year stays within same era', () => {
      const result = eraSys.checkTransition(1925);
      expect(result).toBeNull();
      expect(eraSys.getCurrentEraId()).toBe('war_communism');
    });

    it('eternal_soviet has no end year (endYear = -1)', () => {
      const eternal = ERA_DEFINITIONS.eternal_soviet;
      expect(eternal.endYear).toBe(-1);
    });
  });

  // ── Building availability ─────────────────────────────────────

  describe('building availability gates by era', () => {
    it('war_communism unlocks basic buildings', () => {
      const available = eraSys.getAvailableBuildings();
      expect(available).toContain('workers-house-a');
      expect(available).toContain('collective-farm-hq');
      expect(available).toContain('power-station');
      expect(available).not.toContain('factory-office');
      expect(available).not.toContain('kgb-office');
    });

    it('first_plans cumulatively adds buildings', () => {
      eraSys.checkTransition(1928);
      const available = eraSys.getAvailableBuildings();

      // Should have war_communism buildings
      expect(available).toContain('workers-house-a');
      expect(available).toContain('power-station');

      // Plus first_plans buildings
      expect(available).toContain('workers-house-c');
      expect(available).toContain('bread-factory');
      expect(available).toContain('factory-office');
      expect(available).toContain('school');
    });

    it('settlement tier filters buildings correctly', () => {
      // Advance to stagnation to unlock many buildings
      eraSys.checkTransition(1928);
      eraSys.checkTransition(1941);
      eraSys.checkTransition(1945);
      eraSys.checkTransition(1953);
      eraSys.checkTransition(1964);

      // selo tier should exclude higher-tier buildings
      const seloBuildings = eraSys.getAvailableBuildings('selo');
      expect(seloBuildings).toContain('workers-house-a');
      expect(seloBuildings).not.toContain('kgb-office'); // gorod only

      // gorod tier should include everything
      const gorodBuildings = eraSys.getAvailableBuildings('gorod');
      expect(gorodBuildings).toContain('kgb-office');
      expect(gorodBuildings).toContain('apartment-tower-c');
    });

    it('locked buildings are correctly identified', () => {
      // In war_communism, factory-office should be locked
      const locked = eraSys.getLockedBuildings();
      expect(locked).toContain('factory-office');
      expect(locked).toContain('kgb-office');
      expect(locked).not.toContain('power-station');
    });

    it('isBuildingAvailable correctly checks individual buildings', () => {
      expect(eraSys.isBuildingAvailable('power-station')).toBe(true);
      expect(eraSys.isBuildingAvailable('factory-office')).toBe(false);

      eraSys.checkTransition(1928);
      expect(eraSys.isBuildingAvailable('factory-office')).toBe(true);
    });
  });

  // ── Modifier blending during transitions ──────────────────────

  describe('modifier blending during era transitions', () => {
    it('starts blending modifiers on transition', () => {
      eraSys.checkTransition(1928);
      expect(eraSys.isTransitioning()).toBe(true);
    });

    it('completes transition after sufficient ticks', () => {
      eraSys.checkTransition(1928);

      // Tick through 10 transition ticks
      for (let i = 0; i < 10; i++) {
        eraSys.tickTransition();
      }

      expect(eraSys.isTransitioning()).toBe(false);
    });

    it('blended modifiers converge to target era values', () => {
      eraSys.checkTransition(1928);

      // Complete the transition
      for (let i = 0; i < 10; i++) {
        eraSys.tickTransition();
      }

      const modifiers = eraSys.getModifiers();
      const target = ERA_DEFINITIONS.first_plans.modifiers;

      expect(modifiers.productionMult).toBeCloseTo(target.productionMult, 5);
      expect(modifiers.consumptionMult).toBeCloseTo(target.consumptionMult, 5);
      expect(modifiers.decayMult).toBeCloseTo(target.decayMult, 5);
    });
  });

  // ── Doctrine and delivery rates ──────────────────────────────

  describe('era doctrine and delivery rates', () => {
    it('each era has a valid doctrine', () => {
      for (const eraId of ERA_ORDER) {
        const era = ERA_DEFINITIONS[eraId];
        expect(era.doctrine).toBeDefined();
        expect(typeof era.doctrine).toBe('string');
      }
    });

    it('delivery rates match era definitions', () => {
      const wartime = ERA_DEFINITIONS.great_patriotic;
      expect(wartime.deliveryRates.food).toBe(0.7);
      expect(wartime.deliveryRates.vodka).toBe(0.6);

      const thaw = ERA_DEFINITIONS.thaw;
      expect(thaw.deliveryRates.food).toBe(0.3);
      expect(thaw.deliveryRates.vodka).toBe(0.2);
    });

    it('getDoctrine and getDeliveryRates reflect current era', () => {
      expect(eraSys.getDoctrine()).toBe('revolutionary');

      eraSys.checkTransition(1928);
      expect(eraSys.getDoctrine()).toBe('industrialization');

      const rates = eraSys.getDeliveryRates();
      expect(rates.food).toBe(0.5);
    });
  });

  // ── Victory/failure conditions ────────────────────────────────

  describe('victory and failure conditions', () => {
    it('war_communism failure: all citizens starve', () => {
      const era = ERA_DEFINITIONS.war_communism;
      const meta = stubMeta({ settlementTier: 'selo' });

      expect(era.failureCondition).toBeDefined();
      // Population 0 and food 0 => failure
      expect(era.failureCondition!.check(meta, stubResources({ population: 0, food: 0 }))).toBe(
        true
      );
      // Population > 0 => not failure
      expect(era.failureCondition!.check(meta, stubResources({ population: 5, food: 0 }))).toBe(
        false
      );
    });

    it('first_plans victory: posyolok tier with 100+ population', () => {
      const era = ERA_DEFINITIONS.first_plans;
      const meta = stubMeta({ settlementTier: 'posyolok' });

      expect(era.victoryCondition).toBeDefined();
      expect(era.victoryCondition!.check(meta, stubResources({ population: 100 }))).toBe(true);
      expect(era.victoryCondition!.check(meta, stubResources({ population: 50 }))).toBe(false);
    });

    it('great_patriotic victory: survive to 1945 with 25+ population', () => {
      const era = ERA_DEFINITIONS.great_patriotic;
      const meta = stubMeta({ date: { year: 1945, month: 1, tick: 0 } });

      expect(era.victoryCondition!.check(meta, stubResources({ population: 25 }))).toBe(true);
      expect(era.victoryCondition!.check(meta, stubResources({ population: 10 }))).toBe(false);
    });

    it('stagnation failure: 0 power with 200+ population', () => {
      const era = ERA_DEFINITIONS.stagnation;

      expect(
        era.failureCondition!.check(stubMeta(), stubResources({ power: 0, population: 200 }))
      ).toBe(true);
      expect(
        era.failureCondition!.check(stubMeta(), stubResources({ power: 100, population: 200 }))
      ).toBe(false);
    });

    it('perestroika failure: food and vodka both zero', () => {
      const era = ERA_DEFINITIONS.perestroika;

      expect(era.failureCondition!.check(stubMeta(), stubResources({ food: 0, vodka: 0 }))).toBe(
        true
      );
      expect(era.failureCondition!.check(stubMeta(), stubResources({ food: 1, vodka: 0 }))).toBe(
        false
      );
    });
  });

  // ── eraIndexForYear helper ────────────────────────────────────

  describe('eraIndexForYear', () => {
    it('maps years to correct era indices', () => {
      expect(eraIndexForYear(1922)).toBe(0); // war_communism
      expect(eraIndexForYear(1927)).toBe(0); // still war_communism
      expect(eraIndexForYear(1928)).toBe(1); // first_plans
      expect(eraIndexForYear(1941)).toBe(2); // great_patriotic
      expect(eraIndexForYear(2000)).toBe(7); // eternal_soviet
    });
  });

  // ── Settlement tier requirements ──────────────────────────────

  describe('settlement tier building gating', () => {
    it('basic buildings default to selo tier', () => {
      expect(getBuildingTierRequirement('power-station')).toBe('selo');
      expect(getBuildingTierRequirement('workers-house-a')).toBe('selo');
    });

    it('advanced buildings require higher tiers', () => {
      expect(getBuildingTierRequirement('kgb-office')).toBe('gorod');
      expect(getBuildingTierRequirement('hospital')).toBe('pgt');
      expect(getBuildingTierRequirement('factory-office')).toBe('posyolok');
    });

    it('tier comparison works correctly', () => {
      expect(tierMeetsRequirement('gorod', 'selo')).toBe(true);
      expect(tierMeetsRequirement('selo', 'gorod')).toBe(false);
      expect(tierMeetsRequirement('pgt', 'pgt')).toBe(true);
    });
  });

  // ── Serialization ─────────────────────────────────────────────

  describe('serialization', () => {
    it('round-trips era system state correctly', () => {
      eraSys.checkTransition(1945); // advance to reconstruction
      const saved = eraSys.serialize();

      const restored = EraSystem.deserialize(saved);
      expect(restored.getCurrentEraId()).toBe('reconstruction');
      expect(restored.getYear()).toBe(1945);
      expect(restored.getPreviousEraId()).toEqual(eraSys.getPreviousEraId());
    });
  });
});
