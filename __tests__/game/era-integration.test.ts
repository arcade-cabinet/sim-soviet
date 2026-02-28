import type { GameMeta, Resources } from '@/ecs/world';
import { ERA_DEFINITIONS, ERA_ORDER, eraIndexForYear } from '@/game/era/definitions';
import { EraSystem } from '@/game/era/EraSystem';
import { getBuildingTierRequirement, tierMeetsRequirement } from '@/game/era/tiers';
import type { EraId } from '@/game/era/types';

/** Build a partial GameMeta for condition tests (only fields the check accesses). */
function stubMeta(overrides: Partial<GameMeta> = {}): GameMeta {
  return {
    seed: '',
    date: { year: 1917, month: 1, tick: 0 },
    quota: { type: 'food', target: 0, current: 0, deadlineYear: 1922 },
    selectedTool: 'none',
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
    eraSys = new EraSystem(1917);
  });

  // ── Era transitions ──────────────────────────────────────────

  describe('era transitions at correct year boundaries', () => {
    it('starts in revolution era for year 1917', () => {
      expect(eraSys.getCurrentEraId()).toBe('revolution');
      expect(eraSys.getCurrentEra().name).toBe('Revolution');
    });

    it('transitions to collectivization at year 1922', () => {
      const newEra = eraSys.checkTransition(1922);
      expect(newEra).not.toBeNull();
      expect(newEra!.id).toBe('collectivization');
      expect(eraSys.getPreviousEraId()).toBe('revolution');
    });

    it('transitions through all 8 eras in chronological order', () => {
      const expectedTransitions: Array<{ year: number; eraId: EraId }> = [
        { year: 1922, eraId: 'collectivization' },
        { year: 1932, eraId: 'industrialization' },
        { year: 1941, eraId: 'great_patriotic' },
        { year: 1945, eraId: 'reconstruction' },
        { year: 1956, eraId: 'thaw_and_freeze' },
        { year: 1982, eraId: 'stagnation' },
        { year: 2000, eraId: 'the_eternal' },
      ];

      for (const { year, eraId } of expectedTransitions) {
        const newEra = eraSys.checkTransition(year);
        expect(newEra).not.toBeNull();
        expect(newEra!.id).toBe(eraId);
      }
    });

    it('does not transition when year stays within same era', () => {
      const result = eraSys.checkTransition(1920);
      expect(result).toBeNull();
      expect(eraSys.getCurrentEraId()).toBe('revolution');
    });

    it('the_eternal has no end year (endYear = -1)', () => {
      const eternal = ERA_DEFINITIONS.the_eternal;
      expect(eternal.endYear).toBe(-1);
    });
  });

  // ── Building availability ─────────────────────────────────────

  describe('building availability gates by era', () => {
    it('revolution unlocks basic buildings', () => {
      const available = eraSys.getAvailableBuildings();
      expect(available).toContain('workers-house-a');
      expect(available).toContain('collective-farm-hq');
      expect(available).not.toContain('power-station'); // industrialization
      expect(available).not.toContain('factory-office');
      expect(available).not.toContain('kgb-office');
    });

    it('collectivization cumulatively adds buildings', () => {
      eraSys.checkTransition(1922);
      const available = eraSys.getAvailableBuildings();

      // Should have revolution buildings
      expect(available).toContain('workers-house-a');

      // Plus collectivization buildings
      expect(available).toContain('workers-house-c');
      expect(available).toContain('bread-factory');
      expect(available).toContain('school');

      // But not industrialization buildings
      expect(available).not.toContain('factory-office');
      expect(available).not.toContain('power-station');
    });

    it('settlement tier filters buildings correctly', () => {
      // Advance to thaw_and_freeze to unlock many buildings
      eraSys.checkTransition(1922);
      eraSys.checkTransition(1932);
      eraSys.checkTransition(1941);
      eraSys.checkTransition(1945);
      eraSys.checkTransition(1956);

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
      // In revolution, factory-office should be locked
      const locked = eraSys.getLockedBuildings();
      expect(locked).toContain('factory-office');
      expect(locked).toContain('kgb-office');
      expect(locked).toContain('power-station'); // now in industrialization
    });

    it('isBuildingAvailable correctly checks individual buildings', () => {
      expect(eraSys.isBuildingAvailable('workers-house-a')).toBe(true);
      expect(eraSys.isBuildingAvailable('factory-office')).toBe(false);

      eraSys.checkTransition(1932); // industrialization
      expect(eraSys.isBuildingAvailable('factory-office')).toBe(true);
    });
  });

  // ── Modifier blending during transitions ──────────────────────

  describe('modifier blending during era transitions', () => {
    it('starts blending modifiers on transition', () => {
      eraSys.checkTransition(1922);
      expect(eraSys.isTransitioning()).toBe(true);
    });

    it('completes transition after sufficient ticks', () => {
      eraSys.checkTransition(1922);

      // Tick through 10 transition ticks
      for (let i = 0; i < 10; i++) {
        eraSys.tickTransition();
      }

      expect(eraSys.isTransitioning()).toBe(false);
    });

    it('blended modifiers converge to target era values', () => {
      eraSys.checkTransition(1922);

      // Complete the transition
      for (let i = 0; i < 10; i++) {
        eraSys.tickTransition();
      }

      const modifiers = eraSys.getModifiers();
      const target = ERA_DEFINITIONS.collectivization.modifiers;

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

      const thaw = ERA_DEFINITIONS.thaw_and_freeze;
      expect(thaw.deliveryRates.food).toBe(0.3);
      expect(thaw.deliveryRates.vodka).toBe(0.2);
    });

    it('getDoctrine and getDeliveryRates reflect current era', () => {
      expect(eraSys.getDoctrine()).toBe('revolutionary');

      eraSys.checkTransition(1922);
      expect(eraSys.getDoctrine()).toBe('industrialization');

      const rates = eraSys.getDeliveryRates();
      expect(rates.food).toBe(0.5);
    });
  });

  // ── Victory/failure conditions ────────────────────────────────

  describe('victory and failure conditions', () => {
    it('revolution failure: all citizens starve', () => {
      const era = ERA_DEFINITIONS.revolution;
      const meta = stubMeta({ settlementTier: 'selo' });

      expect(era.failureCondition).toBeDefined();
      // Population 0 and food 0 => failure
      expect(era.failureCondition!.check(meta, stubResources({ population: 0, food: 0 }))).toBe(true);
      // Population > 0 => not failure
      expect(era.failureCondition!.check(meta, stubResources({ population: 5, food: 0 }))).toBe(false);
    });

    it('collectivization victory: posyolok tier with 100+ population', () => {
      const era = ERA_DEFINITIONS.collectivization;
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

      expect(era.failureCondition!.check(stubMeta(), stubResources({ power: 0, population: 200 }))).toBe(true);
      expect(era.failureCondition!.check(stubMeta(), stubResources({ power: 100, population: 200 }))).toBe(false);
    });
  });

  // ── eraIndexForYear helper ────────────────────────────────────

  describe('eraIndexForYear', () => {
    it('maps years to correct era indices', () => {
      expect(eraIndexForYear(1917)).toBe(0); // revolution
      expect(eraIndexForYear(1921)).toBe(0); // still revolution
      expect(eraIndexForYear(1922)).toBe(1); // collectivization
      expect(eraIndexForYear(1941)).toBe(3); // great_patriotic
      expect(eraIndexForYear(2000)).toBe(7); // the_eternal
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
