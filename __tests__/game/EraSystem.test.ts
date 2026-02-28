import {
  BUILDING_TIER_REQUIREMENTS,
  ERA_DEFINITIONS,
  ERA_ORDER,
  type EraId,
  type EraModifiers,
  EraSystem,
  getBuildingTierRequirement,
  SETTLEMENT_TIER_ORDER,
  tierMeetsRequirement,
} from '@/game/era';
import { ALL_BUILDING_IDS } from '@/game/era/definitions';
import { ERA_SPECIFIC_EVENTS } from '@/game/events/templates/era_specific';

// ─────────────────────────────────────────────────────────
//  Era Definition Integrity
// ─────────────────────────────────────────────────────────

describe('ERA_DEFINITIONS', () => {
  it('defines exactly 8 eras', () => {
    expect(Object.keys(ERA_DEFINITIONS)).toHaveLength(8);
    expect(ERA_ORDER).toHaveLength(8);
  });

  it('ERA_ORDER matches ERA_DEFINITIONS keys', () => {
    for (const eraId of ERA_ORDER) {
      expect(ERA_DEFINITIONS[eraId]).toBeDefined();
    }
  });

  it('eras are in chronological order by startYear', () => {
    for (let i = 1; i < ERA_ORDER.length; i++) {
      const prev = ERA_DEFINITIONS[ERA_ORDER[i - 1]!];
      const curr = ERA_DEFINITIONS[ERA_ORDER[i]!];
      expect(curr.startYear).toBeGreaterThanOrEqual(prev.startYear);
    }
  });

  it('each era has contiguous year ranges (start matches previous end)', () => {
    for (let i = 1; i < ERA_ORDER.length; i++) {
      const prev = ERA_DEFINITIONS[ERA_ORDER[i - 1]!];
      const curr = ERA_DEFINITIONS[ERA_ORDER[i]!];
      if (prev.endYear !== -1) {
        expect(curr.startYear).toBe(prev.endYear);
      }
    }
  });

  it('only eternal_soviet has endYear === -1', () => {
    for (const eraId of ERA_ORDER) {
      const def = ERA_DEFINITIONS[eraId];
      if (eraId === 'eternal_soviet') {
        expect(def.endYear).toBe(-1);
      } else {
        expect(def.endYear).toBeGreaterThan(def.startYear);
      }
    }
  });

  it('every era has a non-empty introTitle and introText', () => {
    for (const eraId of ERA_ORDER) {
      const def = ERA_DEFINITIONS[eraId];
      expect(def.introTitle.length).toBeGreaterThan(0);
      expect(def.introText.length).toBeGreaterThan(0);
      expect(def.briefingFlavor.length).toBeGreaterThan(0);
    }
  });

  it('every era has a valid doctrine', () => {
    const validDoctrines = [
      'revolutionary',
      'industrialization',
      'wartime',
      'reconstruction',
      'thaw',
      'freeze',
      'stagnation',
      'eternal',
    ];
    for (const eraId of ERA_ORDER) {
      const def = ERA_DEFINITIONS[eraId];
      expect(validDoctrines).toContain(def.doctrine);
    }
  });
});

// ─────────────────────────────────────────────────────────
//  Modifier Reasonableness
// ─────────────────────────────────────────────────────────

describe('ERA modifiers', () => {
  const modifierKeys: (keyof EraModifiers)[] = [
    'productionMult',
    'consumptionMult',
    'decayMult',
    'populationGrowthMult',
    'eventFrequencyMult',
    'corruptionMult',
  ];

  it('all modifiers are positive numbers', () => {
    for (const eraId of ERA_ORDER) {
      const mods = ERA_DEFINITIONS[eraId].modifiers;
      for (const key of modifierKeys) {
        expect(mods[key]).toBeGreaterThan(0);
      }
    }
  });

  it('all modifiers are within reasonable range (0.1 to 3.0)', () => {
    for (const eraId of ERA_ORDER) {
      const mods = ERA_DEFINITIONS[eraId].modifiers;
      for (const key of modifierKeys) {
        expect(mods[key]).toBeGreaterThanOrEqual(0.1);
        expect(mods[key]).toBeLessThanOrEqual(3.0);
      }
    }
  });

  it('delivery rates are between 0 and 1', () => {
    for (const eraId of ERA_ORDER) {
      const { deliveryRates } = ERA_DEFINITIONS[eraId];
      expect(deliveryRates.food).toBeGreaterThanOrEqual(0);
      expect(deliveryRates.food).toBeLessThanOrEqual(1);
      expect(deliveryRates.vodka).toBeGreaterThanOrEqual(0);
      expect(deliveryRates.vodka).toBeLessThanOrEqual(1);
      expect(deliveryRates.money).toBeGreaterThanOrEqual(0);
      expect(deliveryRates.money).toBeLessThanOrEqual(1);
    }
  });

  it('quota escalation is >= 1.0', () => {
    for (const eraId of ERA_ORDER) {
      expect(ERA_DEFINITIONS[eraId].quotaEscalation).toBeGreaterThanOrEqual(1.0);
    }
  });

  it('wartime era has highest delivery rates', () => {
    const wartime = ERA_DEFINITIONS.great_patriotic;
    for (const eraId of ERA_ORDER) {
      if (eraId === 'great_patriotic') continue;
      const other = ERA_DEFINITIONS[eraId];
      expect(wartime.deliveryRates.food).toBeGreaterThanOrEqual(other.deliveryRates.food);
    }
  });

  it('thaw era has most favorable modifiers (highest pop growth, lowest decay)', () => {
    const thaw = ERA_DEFINITIONS.thaw;
    expect(thaw.modifiers.populationGrowthMult).toBe(1.5);
    expect(thaw.modifiers.decayMult).toBe(0.7);
    expect(thaw.modifiers.consumptionMult).toBe(0.8);
  });
});

// ─────────────────────────────────────────────────────────
//  Building Availability
// ─────────────────────────────────────────────────────────

describe('Building availability', () => {
  it('all 35 buildings are assigned to exactly one era', () => {
    const allUnlocked: string[] = [];
    for (const eraId of ERA_ORDER) {
      allUnlocked.push(...ERA_DEFINITIONS[eraId].unlockedBuildings);
    }

    // No duplicates
    const unique = new Set(allUnlocked);
    expect(unique.size).toBe(allUnlocked.length);

    // All 35 covered
    expect(allUnlocked).toHaveLength(35);
  });

  it('war_communism unlocks basic infrastructure', () => {
    const unlocked = ERA_DEFINITIONS.war_communism.unlockedBuildings;
    expect(unlocked).toContain('workers-house-a');
    expect(unlocked).toContain('collective-farm-hq');
    expect(unlocked).toContain('power-station');
  });

  it('gulag unlocks during great_patriotic war', () => {
    expect(ERA_DEFINITIONS.great_patriotic.unlockedBuildings).toContain('gulag-admin');
  });

  it('vodka-distillery unlocks during stagnation', () => {
    expect(ERA_DEFINITIONS.stagnation.unlockedBuildings).toContain('vodka-distillery');
  });

  it('perestroika unlocks no new buildings', () => {
    expect(ERA_DEFINITIONS.perestroika.unlockedBuildings).toHaveLength(0);
  });

  it('apartment-tower-d unlocks in eternal_soviet', () => {
    expect(ERA_DEFINITIONS.eternal_soviet.unlockedBuildings).toContain('apartment-tower-d');
  });
});

// ─────────────────────────────────────────────────────────
//  EraSystem Class
// ─────────────────────────────────────────────────────────

describe('EraSystem', () => {
  it('defaults to 1922 (war_communism)', () => {
    const sys = new EraSystem();
    expect(sys.getCurrentEraId()).toBe('war_communism');
    expect(sys.getYear()).toBe(1922);
  });

  it('accepts a custom start year', () => {
    const sys = new EraSystem(1965);
    expect(sys.getCurrentEraId()).toBe('stagnation');
  });

  it('returns correct era for each year boundary', () => {
    const yearToEra: [number, EraId][] = [
      [1922, 'war_communism'],
      [1927, 'war_communism'],
      [1928, 'first_plans'],
      [1940, 'first_plans'],
      [1941, 'great_patriotic'],
      [1944, 'great_patriotic'],
      [1945, 'reconstruction'],
      [1952, 'reconstruction'],
      [1953, 'thaw'],
      [1963, 'thaw'],
      [1964, 'stagnation'],
      [1984, 'stagnation'],
      [1985, 'perestroika'],
      [1990, 'perestroika'],
      [1991, 'eternal_soviet'],
      [2000, 'eternal_soviet'],
      [2100, 'eternal_soviet'],
    ];

    for (const [year, expectedEra] of yearToEra) {
      const sys = new EraSystem(year);
      expect(sys.getCurrentEraId()).toBe(expectedEra);
    }
  });
});

// ─────────────────────────────────────────────────────────
//  Era Transitions
// ─────────────────────────────────────────────────────────

describe('Era transitions', () => {
  it('checkTransition returns new era when crossing boundary', () => {
    const sys = new EraSystem(1927);
    expect(sys.getCurrentEraId()).toBe('war_communism');

    const newEra = sys.checkTransition(1928);
    expect(newEra).not.toBeNull();
    expect(newEra!.id).toBe('first_plans');
    expect(sys.getCurrentEraId()).toBe('first_plans');
  });

  it('checkTransition returns null when staying in same era', () => {
    const sys = new EraSystem(1930);
    const result = sys.checkTransition(1935);
    expect(result).toBeNull();
    expect(sys.getCurrentEraId()).toBe('first_plans');
  });

  it('tracks previous era after transition', () => {
    const sys = new EraSystem(1927);
    expect(sys.getPreviousEraId()).toBeNull();

    sys.checkTransition(1928);
    expect(sys.getPreviousEraId()).toBe('war_communism');

    sys.checkTransition(1941);
    expect(sys.getPreviousEraId()).toBe('first_plans');
  });

  it('transitions through all eras sequentially', () => {
    const sys = new EraSystem(1922);
    const transitionYears = [1928, 1941, 1945, 1953, 1964, 1985, 1991];
    const expectedEras: EraId[] = [
      'first_plans',
      'great_patriotic',
      'reconstruction',
      'thaw',
      'stagnation',
      'perestroika',
      'eternal_soviet',
    ];

    for (let i = 0; i < transitionYears.length; i++) {
      const newEra = sys.checkTransition(transitionYears[i]!);
      expect(newEra).not.toBeNull();
      expect(newEra!.id).toBe(expectedEras[i]);
    }
  });

  it('handles skipping eras (jumping from 1922 to 1991)', () => {
    const sys = new EraSystem(1922);
    const newEra = sys.checkTransition(1991);
    expect(newEra).not.toBeNull();
    expect(newEra!.id).toBe('eternal_soviet');
    expect(sys.getPreviousEraId()).toBe('war_communism');
  });
});

// ─────────────────────────────────────────────────────────
//  Building Availability via EraSystem
// ─────────────────────────────────────────────────────────

describe('EraSystem.getAvailableBuildings', () => {
  it('war_communism has only its 9 buildings', () => {
    const sys = new EraSystem(1922);
    const available = sys.getAvailableBuildings();
    expect(available).toHaveLength(9);
    expect(available).toContain('workers-house-a');
    expect(available).toContain('power-station');
  });

  it('first_plans accumulates war_communism + its own', () => {
    const sys = new EraSystem(1930);
    const available = sys.getAvailableBuildings();
    // 9 (war_communism) + 8 (first_plans) = 17
    expect(available).toHaveLength(17);
    expect(available).toContain('workers-house-a'); // from war_communism
    expect(available).toContain('bread-factory'); // from first_plans
  });

  it('eternal_soviet has all 35 buildings', () => {
    const sys = new EraSystem(2000);
    const available = sys.getAvailableBuildings();
    expect(available).toHaveLength(35);
  });

  it('getLockedBuildings returns complement', () => {
    const sys = new EraSystem(1922);
    const available = sys.getAvailableBuildings();
    const locked = sys.getLockedBuildings();
    expect(available.length + locked.length).toBe(35);

    // No overlap
    const lockedSet = new Set(locked);
    for (const id of available) {
      expect(lockedSet.has(id)).toBe(false);
    }
  });

  it('isBuildingAvailable returns correct results', () => {
    const sys = new EraSystem(1930);
    expect(sys.isBuildingAvailable('workers-house-a')).toBe(true);
    expect(sys.isBuildingAvailable('bread-factory')).toBe(true);
    expect(sys.isBuildingAvailable('apartment-tower-d')).toBe(false);
    expect(sys.isBuildingAvailable('vodka-distillery')).toBe(false);
  });

  it('getBuildingUnlockEra returns the correct era', () => {
    const sys = new EraSystem();
    expect(sys.getBuildingUnlockEra('gulag-admin')?.id).toBe('great_patriotic');
    expect(sys.getBuildingUnlockEra('vodka-distillery')?.id).toBe('stagnation');
    expect(sys.getBuildingUnlockEra('apartment-tower-d')?.id).toBe('eternal_soviet');
    expect(sys.getBuildingUnlockEra('nonexistent')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────
//  Settlement Tier Gating
// ─────────────────────────────────────────────────────────

describe('Settlement tier gating', () => {
  it('getAvailableBuildings without tier returns all era-unlocked (backward compat)', () => {
    const sys = new EraSystem(2000);
    const all = sys.getAvailableBuildings();
    expect(all).toHaveLength(35);
  });

  it('getAvailableBuildings with selo returns only selo-tier buildings', () => {
    const sys = new EraSystem(2000); // all eras unlocked
    const seloBuildings = sys.getAvailableBuildings('selo');

    // selo-tier buildings are those NOT listed in BUILDING_TIER_REQUIREMENTS
    for (const defId of seloBuildings) {
      expect(getBuildingTierRequirement(defId)).toBe('selo');
    }

    // Should not contain any posyolok/pgt/gorod buildings
    expect(seloBuildings).not.toContain('bread-factory');
    expect(seloBuildings).not.toContain('hospital');
    expect(seloBuildings).not.toContain('kgb-office');

    // Should contain selo basics
    expect(seloBuildings).toContain('workers-house-a');
    expect(seloBuildings).toContain('collective-farm-hq');
    expect(seloBuildings).toContain('power-station');
  });

  it('getAvailableBuildings with posyolok includes selo + posyolok buildings', () => {
    const sys = new EraSystem(2000);
    const buildings = sys.getAvailableBuildings('posyolok');

    // Should contain selo basics
    expect(buildings).toContain('workers-house-a');
    expect(buildings).toContain('power-station');

    // Should contain posyolok buildings
    expect(buildings).toContain('bread-factory');
    expect(buildings).toContain('school');
    expect(buildings).toContain('warehouse');

    // Should NOT contain pgt/gorod buildings
    expect(buildings).not.toContain('hospital');
    expect(buildings).not.toContain('kgb-office');
  });

  it('getAvailableBuildings with gorod returns all buildings', () => {
    const sys = new EraSystem(2000);
    const all = sys.getAvailableBuildings();
    const gorod = sys.getAvailableBuildings('gorod');
    expect(gorod).toHaveLength(all.length);
  });

  it('tier gating still respects era gating', () => {
    // war_communism era (1922) only has 9 buildings
    const sys = new EraSystem(1922);
    const gorod = sys.getAvailableBuildings('gorod');

    // Even with gorod tier, can only see war_communism buildings
    expect(gorod).toHaveLength(9);
    expect(gorod).toContain('workers-house-a');
    expect(gorod).not.toContain('bread-factory'); // first_plans era
  });

  it('SETTLEMENT_TIER_ORDER has correct progression', () => {
    expect(SETTLEMENT_TIER_ORDER).toEqual(['selo', 'posyolok', 'pgt', 'gorod']);
  });

  it('getBuildingTierRequirement returns selo for unlisted buildings', () => {
    expect(getBuildingTierRequirement('workers-house-a')).toBe('selo');
    expect(getBuildingTierRequirement('nonexistent')).toBe('selo');
  });

  it('getBuildingTierRequirement returns correct tiers for listed buildings', () => {
    expect(getBuildingTierRequirement('bread-factory')).toBe('posyolok');
    expect(getBuildingTierRequirement('hospital')).toBe('pgt');
    expect(getBuildingTierRequirement('kgb-office')).toBe('gorod');
  });

  it('tierMeetsRequirement is correct', () => {
    expect(tierMeetsRequirement('selo', 'selo')).toBe(true);
    expect(tierMeetsRequirement('selo', 'posyolok')).toBe(false);
    expect(tierMeetsRequirement('posyolok', 'selo')).toBe(true);
    expect(tierMeetsRequirement('posyolok', 'posyolok')).toBe(true);
    expect(tierMeetsRequirement('posyolok', 'pgt')).toBe(false);
    expect(tierMeetsRequirement('gorod', 'selo')).toBe(true);
    expect(tierMeetsRequirement('gorod', 'gorod')).toBe(true);
  });

  it('every building in BUILDING_TIER_REQUIREMENTS exists in ALL_BUILDING_IDS', () => {
    const allIds = new Set(ALL_BUILDING_IDS);
    for (const defId of Object.keys(BUILDING_TIER_REQUIREMENTS)) {
      expect(allIds.has(defId)).toBe(true);
    }
  });

  it('pgt tier includes all posyolok buildings plus pgt buildings', () => {
    const sys = new EraSystem(2000);
    const posyolokBuildings = sys.getAvailableBuildings('posyolok');
    const pgtBuildings = sys.getAvailableBuildings('pgt');

    // pgt should be a superset of posyolok
    for (const defId of posyolokBuildings) {
      expect(pgtBuildings).toContain(defId);
    }

    // pgt should have more buildings than posyolok
    expect(pgtBuildings.length).toBeGreaterThan(posyolokBuildings.length);
  });
});

// ─────────────────────────────────────────────────────────
//  Modifiers & Doctrine
// ─────────────────────────────────────────────────────────

describe('EraSystem getters', () => {
  it('getModifiers returns a copy (not a reference)', () => {
    const sys = new EraSystem(1922);
    const mods1 = sys.getModifiers();
    const mods2 = sys.getModifiers();
    expect(mods1).toEqual(mods2);
    expect(mods1).not.toBe(mods2);
  });

  it('getDoctrine matches the era definition', () => {
    const sys = new EraSystem(1941);
    expect(sys.getDoctrine()).toBe('wartime');
  });

  it('getDeliveryRates returns a copy', () => {
    const sys = new EraSystem(1965);
    const rates = sys.getDeliveryRates();
    expect(rates).toEqual({ food: 0.45, vodka: 0.4, money: 0.5 });
    rates.food = 999;
    expect(sys.getDeliveryRates().food).toBe(0.45);
  });

  it('getQuotaEscalation varies by era', () => {
    expect(new EraSystem(1922).getQuotaEscalation()).toBe(1.0);
    expect(new EraSystem(1930).getQuotaEscalation()).toBe(1.3);
    expect(new EraSystem(1942).getQuotaEscalation()).toBe(1.5);
  });
});

// ─────────────────────────────────────────────────────────
//  Victory / Failure Conditions
// ─────────────────────────────────────────────────────────

describe('Era conditions', () => {
  const makeMeta = (overrides: Partial<import('@/ecs/world').GameMeta> = {}) =>
    ({
      seed: 'test',
      date: { year: 1930, month: 1, tick: 0 },
      quota: { type: 'food', target: 100, current: 50, deadlineYear: 1935 },
      selectedTool: 'none',
      gameOver: null,
      settlementTier: 'selo' as const,
      blackMarks: 0,
      commendations: 0,
      threatLevel: 'safe',
      currentEra: 'war_communism',
      roadQuality: 'none',
      roadCondition: 100,
      ...overrides,
    }) satisfies import('@/ecs/world').GameMeta;

  const makeResources = (overrides: Partial<import('@/ecs/world').Resources> = {}) =>
    ({
      money: 500,
      food: 100,
      vodka: 50,
      power: 30,
      powerUsed: 10,
      population: 100,
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
    }) satisfies import('@/ecs/world').Resources;

  it('war_communism failure: zero pop + zero food', () => {
    const cond = ERA_DEFINITIONS.war_communism.failureCondition!;
    expect(cond.check(makeMeta(), makeResources({ population: 0, food: 0 }))).toBe(true);
    expect(cond.check(makeMeta(), makeResources({ population: 0, food: 10 }))).toBe(false);
    expect(cond.check(makeMeta(), makeResources({ population: 10, food: 0 }))).toBe(false);
  });

  it('first_plans victory: non-selo with 100+ pop', () => {
    const cond = ERA_DEFINITIONS.first_plans.victoryCondition!;
    expect(cond.check(makeMeta({ settlementTier: 'posyolok' }), makeResources({ population: 100 }))).toBe(true);
    expect(cond.check(makeMeta({ settlementTier: 'selo' }), makeResources({ population: 200 }))).toBe(false);
    expect(cond.check(makeMeta({ settlementTier: 'posyolok' }), makeResources({ population: 50 }))).toBe(false);
  });

  it('great_patriotic victory: year >= 1945 with 25+ pop', () => {
    const cond = ERA_DEFINITIONS.great_patriotic.victoryCondition!;
    expect(cond.check(makeMeta({ date: { year: 1945, month: 1, tick: 0 } }), makeResources({ population: 25 }))).toBe(
      true,
    );
    expect(cond.check(makeMeta({ date: { year: 1944, month: 12, tick: 0 } }), makeResources({ population: 100 }))).toBe(
      false,
    );
  });

  it('thaw victory: 300+ pop with positive food and vodka', () => {
    const cond = ERA_DEFINITIONS.thaw.victoryCondition!;
    expect(cond.check(makeMeta(), makeResources({ population: 300, food: 1, vodka: 1 }))).toBe(true);
    expect(cond.check(makeMeta(), makeResources({ population: 300, food: 0, vodka: 1 }))).toBe(false);
  });

  it('stagnation failure: 0 power with 200+ pop', () => {
    const cond = ERA_DEFINITIONS.stagnation.failureCondition!;
    expect(cond.check(makeMeta(), makeResources({ power: 0, population: 200 }))).toBe(true);
    expect(cond.check(makeMeta(), makeResources({ power: 10, population: 200 }))).toBe(false);
  });

  it('perestroika failure: both food and vodka at zero', () => {
    const cond = ERA_DEFINITIONS.perestroika.failureCondition!;
    expect(cond.check(makeMeta(), makeResources({ food: 0, vodka: 0 }))).toBe(true);
    expect(cond.check(makeMeta(), makeResources({ food: 1, vodka: 0 }))).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────
//  Serialization Roundtrip
// ─────────────────────────────────────────────────────────

describe('Serialization', () => {
  it('serialize/deserialize preserves state', () => {
    const sys = new EraSystem(1927);
    sys.checkTransition(1928);
    sys.checkTransition(1941);

    const data = sys.serialize();
    const restored = EraSystem.deserialize(data);

    expect(restored.getCurrentEraId()).toBe(sys.getCurrentEraId());
    expect(restored.getYear()).toBe(sys.getYear());
    expect(restored.getPreviousEraId()).toBe(sys.getPreviousEraId());
  });

  it('serialized data is plain JSON', () => {
    const sys = new EraSystem(1965);
    sys.checkTransition(1985);

    const data = sys.serialize();
    const json = JSON.stringify(data);
    const parsed = JSON.parse(json);
    const restored = EraSystem.deserialize(parsed);

    expect(restored.getCurrentEraId()).toBe('perestroika');
    expect(restored.getPreviousEraId()).toBe('stagnation');
  });

  it('deserialize with no previous era', () => {
    const sys = new EraSystem(1922);
    const data = sys.serialize();
    const restored = EraSystem.deserialize(data);
    expect(restored.getPreviousEraId()).toBeNull();
    expect(restored.getCurrentEraId()).toBe('war_communism');
  });

  it('serializes transitionTicksRemaining', () => {
    const sys = new EraSystem(1927);
    sys.checkTransition(1928); // triggers transition with 10 ticks remaining
    const data = sys.serialize();
    expect(data.transitionTicksRemaining).toBe(10);

    const restored = EraSystem.deserialize(data);
    expect(restored.isTransitioning()).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────
//  Gradual Modifier Transition
// ─────────────────────────────────────────────────────────

describe('Gradual modifier transition', () => {
  it('transition starts after checkTransition detects era change', () => {
    const sys = new EraSystem(1927);
    expect(sys.isTransitioning()).toBe(false);

    sys.checkTransition(1928);
    expect(sys.isTransitioning()).toBe(true);
  });

  it('transition does not start when staying in same era', () => {
    const sys = new EraSystem(1930);
    sys.checkTransition(1935);
    expect(sys.isTransitioning()).toBe(false);
  });

  it('modifiers blend linearly during transition (t=0 returns old, t=1 returns new)', () => {
    const sys = new EraSystem(1927);
    const oldMods = sys.getModifiers(); // war_communism modifiers

    sys.checkTransition(1928); // transition to first_plans
    const newMods = ERA_DEFINITIONS.first_plans.modifiers;

    // At tick 0 of transition (just started), t = 0, should be mostly old
    const blended = sys.getModifiers();
    // t = 1 - 10/10 = 0, so should equal old modifiers
    expect(blended.productionMult).toBeCloseTo(oldMods.productionMult, 5);

    // Tick 5 times to reach midpoint
    for (let i = 0; i < 5; i++) sys.tickTransition();

    const midMods = sys.getModifiers();
    // t = 1 - 5/10 = 0.5, should be midpoint
    const expectedMid = (oldMods.productionMult + newMods.productionMult) / 2;
    expect(midMods.productionMult).toBeCloseTo(expectedMid, 5);

    // Tick remaining 5 ticks to complete
    for (let i = 0; i < 5; i++) sys.tickTransition();

    expect(sys.isTransitioning()).toBe(false);
    const finalMods = sys.getModifiers();
    expect(finalMods.productionMult).toBeCloseTo(newMods.productionMult, 5);
  });

  it('tickTransition returns true while transitioning, false when done', () => {
    const sys = new EraSystem(1927);
    sys.checkTransition(1928);

    for (let i = 0; i < 9; i++) {
      expect(sys.tickTransition()).toBe(true);
    }
    // Last tick
    expect(sys.tickTransition()).toBe(true);
    // Now done
    expect(sys.tickTransition()).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────
//  Construction Method Progression
// ─────────────────────────────────────────────────────────

describe('Construction method progression', () => {
  it('every era has a valid construction method', () => {
    const validMethods = ['manual', 'mechanized', 'industrial', 'decaying'];
    for (const eraId of ERA_ORDER) {
      expect(validMethods).toContain(ERA_DEFINITIONS[eraId].constructionMethod);
    }
  });

  it('every era has a positive construction time multiplier', () => {
    for (const eraId of ERA_ORDER) {
      expect(ERA_DEFINITIONS[eraId].constructionTimeMult).toBeGreaterThan(0);
    }
  });

  it('manual eras have 2.0x time', () => {
    expect(ERA_DEFINITIONS.war_communism.constructionTimeMult).toBe(2.0);
    expect(ERA_DEFINITIONS.first_plans.constructionTimeMult).toBe(2.0);
  });

  it('mechanized eras have 1.0x time', () => {
    expect(ERA_DEFINITIONS.great_patriotic.constructionTimeMult).toBe(1.0);
    expect(ERA_DEFINITIONS.reconstruction.constructionTimeMult).toBe(1.0);
  });

  it('industrial eras have 0.6x time (fastest)', () => {
    expect(ERA_DEFINITIONS.thaw.constructionTimeMult).toBe(0.6);
    expect(ERA_DEFINITIONS.stagnation.constructionTimeMult).toBe(0.6);
  });

  it('decaying eras have 1.5x time', () => {
    expect(ERA_DEFINITIONS.perestroika.constructionTimeMult).toBe(1.5);
    expect(ERA_DEFINITIONS.eternal_soviet.constructionTimeMult).toBe(1.5);
  });

  it('EraSystem exposes construction method and multiplier', () => {
    const sys = new EraSystem(1922);
    expect(sys.getConstructionMethod()).toBe('manual');
    expect(sys.getConstructionTimeMult()).toBe(2.0);

    sys.checkTransition(1953);
    expect(sys.getConstructionMethod()).toBe('industrial');
    expect(sys.getConstructionTimeMult()).toBe(0.6);
  });
});

// ─────────────────────────────────────────────────────────
//  Checkpoint System
// ─────────────────────────────────────────────────────────

describe('Era checkpoint system', () => {
  it('saveCheckpoint stores a checkpoint for the current era', () => {
    const sys = new EraSystem(1922);
    expect(sys.hasCheckpoint('war_communism')).toBe(false);

    sys.saveCheckpoint('{"test": true}');
    expect(sys.hasCheckpoint('war_communism')).toBe(true);
  });

  it('getCheckpoint returns the saved checkpoint', () => {
    const sys = new EraSystem(1930);
    const snapshot = '{"resources": {"food": 100}}';
    sys.saveCheckpoint(snapshot);

    const cp = sys.getCheckpoint('first_plans');
    expect(cp).not.toBeNull();
    expect(cp!.eraId).toBe('first_plans');
    expect(cp!.year).toBe(1930);
    expect(cp!.snapshot).toBe(snapshot);
  });

  it('getCheckpoint returns null for unsaved era', () => {
    const sys = new EraSystem(1922);
    expect(sys.getCheckpoint('thaw')).toBeNull();
  });

  it('getAllCheckpoints returns all saved checkpoints', () => {
    const sys = new EraSystem(1922);
    sys.saveCheckpoint('snap1');

    sys.checkTransition(1928);
    sys.saveCheckpoint('snap2');

    const all = sys.getAllCheckpoints();
    expect(all.size).toBe(2);
    expect(all.has('war_communism')).toBe(true);
    expect(all.has('first_plans')).toBe(true);
  });

  it('checkpoints overwrite for the same era', () => {
    const sys = new EraSystem(1922);
    sys.saveCheckpoint('old');
    sys.saveCheckpoint('new');

    const cp = sys.getCheckpoint('war_communism');
    expect(cp!.snapshot).toBe('new');
  });
});

// ─────────────────────────────────────────────────────────
//  Era-Specific Event Templates
// ─────────────────────────────────────────────────────────

describe('Era-specific event templates', () => {
  it('all era-specific events have eraFilter set', () => {
    for (const event of ERA_SPECIFIC_EVENTS) {
      expect(event.eraFilter).toBeDefined();
      expect(event.eraFilter!.length).toBeGreaterThan(0);
    }
  });

  it('all eraFilter values reference valid era IDs', () => {
    const validEraIds = new Set(ERA_ORDER);
    for (const event of ERA_SPECIFIC_EVENTS) {
      for (const eraId of event.eraFilter!) {
        expect(validEraIds.has(eraId as EraId)).toBe(true);
      }
    }
  });

  it('every era has at least one era-specific event', () => {
    const erasCovered = new Set<string>();
    for (const event of ERA_SPECIFIC_EVENTS) {
      for (const eraId of event.eraFilter!) {
        erasCovered.add(eraId);
      }
    }
    for (const eraId of ERA_ORDER) {
      expect(erasCovered.has(eraId)).toBe(true);
    }
  });

  it('all event IDs are unique', () => {
    const ids = ERA_SPECIFIC_EVENTS.map((e) => e.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('all events have required fields', () => {
    for (const event of ERA_SPECIFIC_EVENTS) {
      expect(event.id).toBeTruthy();
      expect(event.title).toBeTruthy();
      expect(event.description).toBeTruthy();
      expect(event.pravdaHeadline).toBeTruthy();
      expect(event.category).toBeTruthy();
      expect(event.severity).toBeTruthy();
      expect(event.effects).toBeDefined();
    }
  });

  it('events for specific eras match expected themes', () => {
    const warCommEvents = ERA_SPECIFIC_EVENTS.filter((e) => e.eraFilter!.includes('war_communism'));
    expect(warCommEvents.length).toBeGreaterThanOrEqual(2);
    expect(warCommEvents.some((e) => e.id === 'bandit_raid')).toBe(true);

    const firstPlansEvents = ERA_SPECIFIC_EVENTS.filter((e) => e.eraFilter!.includes('first_plans'));
    expect(firstPlansEvents.some((e) => e.id === 'kulak_purge')).toBe(true);
    expect(firstPlansEvents.some((e) => e.id === 'great_terror_wave')).toBe(true);

    const warEvents = ERA_SPECIFIC_EVENTS.filter((e) => e.eraFilter!.includes('great_patriotic'));
    expect(warEvents.some((e) => e.id === 'conscription_wave')).toBe(true);

    const thawEvents = ERA_SPECIFIC_EVENTS.filter((e) => e.eraFilter!.includes('thaw'));
    expect(thawEvents.some((e) => e.id === 'private_gardens_allowed')).toBe(true);

    const stagnationEvents = ERA_SPECIFIC_EVENTS.filter((e) => e.eraFilter!.includes('stagnation'));
    expect(stagnationEvents.some((e) => e.id === 'vodka_economy_boom')).toBe(true);

    const eternalEvents = ERA_SPECIFIC_EVENTS.filter((e) => e.eraFilter!.includes('eternal_soviet'));
    expect(eternalEvents.some((e) => e.id === 'bureaucratic_singularity_approach')).toBe(true);
  });
});
