import { PressureSystem, TRANSFORMATION_KARDASHEV_THRESHOLD } from '../../../src/ai/agents/crisis/pressure/PressureSystem';
import {
  AMPLIFIED_AT_POST_SCARCITY,
  createGauge,
  createPressureState,
  DOMAIN_REPLACEMENT_MAP,
  POST_SCARCITY_DOMAINS,
  PRESSURE_DOMAINS,
  ZEROED_AT_POST_SCARCITY,
  type PressureDomain,
  type PressureReadContext,
  type PostScarcityDomain,
  createExtendedPressureState,
  serializeExtendedPressureState,
  restoreExtendedPressureState,
} from '../../../src/ai/agents/crisis/pressure/PressureDomains';
import {
  normalizeMeaning,
  normalizeDensity,
  normalizeEntropy,
  normalizeLegacy,
  normalizeEnnui,
  normalizeAllPostScarcityDomains,
} from '../../../src/ai/agents/crisis/pressure/pressureNormalization';
import {
  POST_SCARCITY_MINOR_INCIDENTS,
  POST_SCARCITY_MAJOR_CRISES,
} from '../../../src/ai/agents/crisis/pressure/pressureCrisisMapping';
import { PressureCrisisEngine } from '../../../src/ai/agents/crisis/pressure/PressureCrisisEngine';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<PressureReadContext> = {}): PressureReadContext {
  return {
    foodState: 'stable',
    starvationCounter: 0,
    starvationGraceTicks: 90,
    averageMorale: 50,
    averageLoyalty: 50,
    sabotageCount: 0,
    flightCount: 0,
    population: 1000,
    housingCapacity: 1200,
    suspicionLevel: 0.3,
    blackMarks: 1,
    blat: 5,
    powerShortage: false,
    unpoweredCount: 0,
    totalBuildings: 20,
    averageDurability: 80,
    growthRate: 0.01,
    laborRatio: 0.5,
    sickCount: 10,
    quotaDeficit: 0.1,
    productionTrend: 0.7,
    carryingCapacity: 2000,
    season: 'WINTER',
    weather: 'SNOW',
    ...overrides,
  };
}

// ─── Domain Type Definitions ────────────────────────────────────────────────

describe('PostScarcityDomain type definitions', () => {
  it('has 5 post-scarcity domains', () => {
    expect(POST_SCARCITY_DOMAINS).toHaveLength(5);
  });

  it('defines all expected post-scarcity domains', () => {
    expect(POST_SCARCITY_DOMAINS).toContain('meaning');
    expect(POST_SCARCITY_DOMAINS).toContain('density');
    expect(POST_SCARCITY_DOMAINS).toContain('entropy');
    expect(POST_SCARCITY_DOMAINS).toContain('legacy');
    expect(POST_SCARCITY_DOMAINS).toContain('ennui');
  });

  it('zeroed domains are food, housing, power, economic', () => {
    expect(ZEROED_AT_POST_SCARCITY).toEqual(['food', 'housing', 'power', 'economic']);
  });

  it('amplified domains are political, loyalty', () => {
    expect(AMPLIFIED_AT_POST_SCARCITY).toEqual(['political', 'loyalty']);
  });

  it('replacement map covers all 5 transformations', () => {
    expect(DOMAIN_REPLACEMENT_MAP.size).toBe(5);
    expect(DOMAIN_REPLACEMENT_MAP.get('food')).toBe('meaning');
    expect(DOMAIN_REPLACEMENT_MAP.get('housing')).toBe('density');
    expect(DOMAIN_REPLACEMENT_MAP.get('power')).toBe('entropy');
    expect(DOMAIN_REPLACEMENT_MAP.get('economic')).toBe('legacy');
    expect(DOMAIN_REPLACEMENT_MAP.get('morale')).toBe('ennui');
  });
});

// ─── PressureSystem.transformDomains() ──────────────────────────────────────

describe('PressureSystem.transformDomains', () => {
  it('does not transform below Kardashev threshold', () => {
    const system = new PressureSystem();
    expect(system.transformDomains(0.9)).toBe(false);
    expect(system.isTransformed()).toBe(false);
    expect(system.getPostScarcityState()).toBeNull();
  });

  it('transforms at exactly Kardashev 1.0', () => {
    const system = new PressureSystem();
    expect(system.transformDomains(1.0)).toBe(true);
    expect(system.isTransformed()).toBe(true);
    expect(system.getTransformationKardashev()).toBe(1.0);
  });

  it('transforms at Kardashev above 1.0', () => {
    const system = new PressureSystem();
    expect(system.transformDomains(1.5)).toBe(true);
    expect(system.isTransformed()).toBe(true);
    expect(system.getTransformationKardashev()).toBe(1.5);
  });

  it('is idempotent — second call returns false', () => {
    const system = new PressureSystem();
    expect(system.transformDomains(1.0)).toBe(true);
    expect(system.transformDomains(1.5)).toBe(false);
    // Kardashev stays at original transformation value
    expect(system.getTransformationKardashev()).toBe(1.0);
  });

  it('zeroes food, housing, power, economic gauges', () => {
    const system = new PressureSystem();
    // Build up some pressure first
    const ctx = makeCtx({ foodState: 'starvation', starvationCounter: 100, powerShortage: true });
    system.tick(ctx);
    system.tick(ctx);

    // Verify pressure exists before transform
    expect(system.getLevel('food')).toBeGreaterThan(0);

    system.transformDomains(1.0);

    for (const domain of ZEROED_AT_POST_SCARCITY) {
      expect(system.getLevel(domain)).toBe(0);
    }
  });

  it('preserves political and loyalty (amplified domains)', () => {
    const system = new PressureSystem();
    const ctx = makeCtx({ suspicionLevel: 0.8, blackMarks: 5, averageLoyalty: 20 });
    system.tick(ctx);
    system.tick(ctx);

    const politicalBefore = system.getLevel('political');
    const loyaltyBefore = system.getLevel('loyalty');
    expect(politicalBefore).toBeGreaterThan(0);
    expect(loyaltyBefore).toBeGreaterThan(0);

    system.transformDomains(1.0);

    // Political and loyalty should still have pressure (not zeroed)
    expect(system.getLevel('political')).toBeGreaterThan(0);
    expect(system.getLevel('loyalty')).toBeGreaterThan(0);
  });

  it('initializes post-scarcity gauges', () => {
    const system = new PressureSystem();
    system.transformDomains(1.0);

    const ps = system.getPostScarcityState();
    expect(ps).not.toBeNull();
    for (const domain of POST_SCARCITY_DOMAINS) {
      expect(ps![domain]).toBeDefined();
      expect(ps![domain].level).toBeGreaterThanOrEqual(0);
    }
  });

  it('seeds ennui from morale level', () => {
    const system = new PressureSystem();
    // Build up morale pressure
    const ctx = makeCtx({ averageMorale: 10 }); // low morale = high pressure
    system.tick(ctx);
    system.tick(ctx);
    system.tick(ctx);

    const moraleBefore = system.getLevel('morale');
    expect(moraleBefore).toBeGreaterThan(0);

    system.transformDomains(1.0);

    const ps = system.getPostScarcityState()!;
    expect(ps.ennui.level).toBe(moraleBefore);
  });
});

// ─── Transformed tick behavior ──────────────────────────────────────────────

describe('PressureSystem transformed tick', () => {
  it('keeps zeroed domains at 0 during ticking', () => {
    const system = new PressureSystem();
    system.transformDomains(1.0);

    // Tick with high food pressure context — should NOT affect zeroed food domain
    const ctx = makeCtx({ foodState: 'starvation', starvationCounter: 100 });
    system.tick(ctx);
    system.tick(ctx);
    system.tick(ctx);

    for (const domain of ZEROED_AT_POST_SCARCITY) {
      expect(system.getLevel(domain)).toBe(0);
    }
  });

  it('accumulates post-scarcity domain pressure', () => {
    const system = new PressureSystem();
    system.transformDomains(1.0);

    const ctx = makeCtx({
      purposeFulfillment: 0.1, // very low purpose = high meaning pressure
      populationDensity: 500000, // high density
      stellarMaintenanceBacklog: 0.8, // high backlog
      civilizationalConsensus: 0.1, // no consensus
      ennuiIndex: 0.9, // extreme ennui
      civilizationalVodka: 0.8, // civilization-scale vodka
    });

    // Tick several times to accumulate
    for (let i = 0; i < 10; i++) {
      system.tick(ctx);
    }

    const ps = system.getPostScarcityState()!;
    expect(ps.meaning.level).toBeGreaterThan(0);
    expect(ps.density.level).toBeGreaterThan(0);
    expect(ps.entropy.level).toBeGreaterThan(0);
    expect(ps.legacy.level).toBeGreaterThan(0);
    expect(ps.ennui.level).toBeGreaterThan(0);
  });

  it('persisting domains (infrastructure, demographic, health) still tick', () => {
    const system = new PressureSystem();
    system.transformDomains(1.0);

    const ctx = makeCtx({
      averageDurability: 10, // very low = high infrastructure pressure
      growthRate: -0.1, // negative = demographic pressure
      sickCount: 500, // high sick count
    });

    for (let i = 0; i < 5; i++) {
      system.tick(ctx);
    }

    expect(system.getLevel('infrastructure')).toBeGreaterThan(0);
    expect(system.getLevel('demographic')).toBeGreaterThan(0);
    expect(system.getLevel('health')).toBeGreaterThan(0);
  });

  it('getHighestPressure can return post-scarcity domains', () => {
    const system = new PressureSystem();
    system.transformDomains(1.0);

    // Drive ennui pressure very high
    const ctx = makeCtx({
      ennuiIndex: 1.0,
      civilizationalVodka: 1.0,
      averageMorale: 90, // low classical morale pressure
      averageLoyalty: 90,
      suspicionLevel: 0.0,
      averageDurability: 100,
    });

    for (let i = 0; i < 20; i++) {
      system.tick(ctx);
    }

    const highest = system.getHighestPressure();
    // Ennui should be among the highest since we maxed out ennui inputs
    // and minimized classical inputs
    expect(highest.level).toBeGreaterThan(0);
  });
});

// ─── Post-scarcity normalization functions ──────────────────────────────────

describe('post-scarcity normalization', () => {
  it('normalizeMeaning: low purpose = high pressure', () => {
    const low = normalizeMeaning(makeCtx({ purposeFulfillment: 0.1 }));
    const high = normalizeMeaning(makeCtx({ purposeFulfillment: 0.9 }));
    expect(low).toBeGreaterThan(high);
  });

  it('normalizeMeaning: more factions = more pressure', () => {
    const few = normalizeMeaning(makeCtx({ factionCount: 2 }));
    const many = normalizeMeaning(makeCtx({ factionCount: 15 }));
    expect(many).toBeGreaterThan(few);
  });

  it('normalizeDensity: low density = no pressure', () => {
    expect(normalizeDensity(makeCtx({ populationDensity: 50 }))).toBe(0);
  });

  it('normalizeDensity: high density = high pressure', () => {
    // With max density (1M/km^2) + max undercity + max crime, pressure = 1.0
    // With density only (no undercity/crime), pressure = 0.6 (60% weight)
    const densityOnly = normalizeDensity(makeCtx({ populationDensity: 1000000 }));
    expect(densityOnly).toBeCloseTo(0.6, 1);
    // All components maxed
    const allMax = normalizeDensity(makeCtx({ populationDensity: 1000000, undercityDecay: 1.0, crimeRate: 1.0 }));
    expect(allMax).toBeCloseTo(1.0, 1);
  });

  it('normalizeEntropy: direct mapping from maintenance backlog', () => {
    expect(normalizeEntropy(makeCtx({ stellarMaintenanceBacklog: 0 }))).toBe(0);
    expect(normalizeEntropy(makeCtx({ stellarMaintenanceBacklog: 0.5 }))).toBe(0.5);
    expect(normalizeEntropy(makeCtx({ stellarMaintenanceBacklog: 1.0 }))).toBe(1.0);
  });

  it('normalizeLegacy: low consensus = high pressure', () => {
    const low = normalizeLegacy(makeCtx({ civilizationalConsensus: 0.1 }));
    const high = normalizeLegacy(makeCtx({ civilizationalConsensus: 0.9 }));
    expect(low).toBeGreaterThan(high);
  });

  it('normalizeEnnui: combines ennui index and vodka', () => {
    const sober = normalizeEnnui(makeCtx({ ennuiIndex: 0, civilizationalVodka: 0 }));
    const drunk = normalizeEnnui(makeCtx({ ennuiIndex: 1.0, civilizationalVodka: 1.0 }));
    expect(sober).toBe(0);
    expect(drunk).toBe(1);
  });

  it('normalizeAllPostScarcityDomains returns all 5 domains', () => {
    const readings = normalizeAllPostScarcityDomains(makeCtx());
    expect(Object.keys(readings)).toHaveLength(5);
    for (const domain of POST_SCARCITY_DOMAINS) {
      expect(readings[domain]).toBeGreaterThanOrEqual(0);
      expect(readings[domain]).toBeLessThanOrEqual(1);
    }
  });
});

// ─── Post-scarcity crisis mapping ───────────────────────────────────────────

describe('post-scarcity crisis mapping', () => {
  it('has minor incident templates for all 5 post-scarcity domains', () => {
    for (const domain of POST_SCARCITY_DOMAINS) {
      expect(POST_SCARCITY_MINOR_INCIDENTS[domain]).toBeDefined();
      expect(POST_SCARCITY_MINOR_INCIDENTS[domain].name).toBeTruthy();
      expect(POST_SCARCITY_MINOR_INCIDENTS[domain].impact).toBeDefined();
    }
  });

  it('has major crisis templates for all 5 post-scarcity domains', () => {
    for (const domain of POST_SCARCITY_DOMAINS) {
      expect(POST_SCARCITY_MAJOR_CRISES[domain]).toBeDefined();
      expect(POST_SCARCITY_MAJOR_CRISES[domain].name).toBeTruthy();
      expect(POST_SCARCITY_MAJOR_CRISES[domain].durationYears).toBeGreaterThan(0);
    }
  });

  it('meaning minor is "Existential Malaise"', () => {
    expect(POST_SCARCITY_MINOR_INCIDENTS.meaning.name).toBe('Existential Malaise');
  });

  it('meaning major is "Meaning Crisis"', () => {
    expect(POST_SCARCITY_MAJOR_CRISES.meaning.name).toBe('Meaning Crisis');
  });

  it('entropy major is existential severity (stellar cascade)', () => {
    expect(POST_SCARCITY_MAJOR_CRISES.entropy.baseSeverity).toBe('existential');
  });

  it('ennui major is "Hedonistic Collapse"', () => {
    expect(POST_SCARCITY_MAJOR_CRISES.ennui.name).toBe('Hedonistic Collapse');
  });
});

// ─── PressureCrisisEngine post-scarcity emergence ───────────────────────────

describe('PressureCrisisEngine post-scarcity emergence', () => {
  it('detects post-scarcity minor incidents', () => {
    const engine = new PressureCrisisEngine();
    const system = new PressureSystem();
    system.transformDomains(1.0);

    // Manually set high ennui pressure with sustained warning ticks
    const ps = system.getPostScarcityState()!;
    // We need to use the engine's checkPostScarcityEmergence
    // Build a mock state with high warning ticks
    const mockPS = {
      meaning: { ...createGauge(), level: 0.6, warningTicks: 10, criticalTicks: 0, trend: 0.5, lastRawReading: 0.6 },
      density: createGauge(),
      entropy: createGauge(),
      legacy: createGauge(),
      ennui: createGauge(),
    } as Record<PostScarcityDomain, typeof ps.meaning>;

    const result = engine.checkPostScarcityEmergence(mockPS, 5000, []);
    expect(result.minorImpacts.length).toBeGreaterThan(0);
    expect(result.minorImpacts[0]!.crisisId).toBe('minor-meaning');
  });

  it('detects post-scarcity major crises at critical threshold', () => {
    const engine = new PressureCrisisEngine();

    const mockPS = {
      meaning: createGauge(),
      density: createGauge(),
      entropy: { ...createGauge(), level: 0.85, warningTicks: 20, criticalTicks: 15, trend: 0.8, lastRawReading: 0.85 },
      legacy: createGauge(),
      ennui: createGauge(),
    } as Record<PostScarcityDomain, ReturnType<typeof createGauge>>;

    const result = engine.checkPostScarcityEmergence(mockPS, 20000, []);
    expect(result.majorCrises.length).toBeGreaterThan(0);
    expect(result.majorCrises[0]!.name).toContain('Stellar Cascade Failure');
  });
});

// ─── Serialization ──────────────────────────────────────────────────────────

describe('extended pressure state serialization', () => {
  it('round-trips extended state (pre-transformation)', () => {
    const state = createExtendedPressureState();
    state.classical.food.level = 0.7;
    state.classical.morale.level = 0.3;

    const data = serializeExtendedPressureState(state);
    const restored = restoreExtendedPressureState(data);

    expect(restored.transformed).toBe(false);
    expect(restored.postScarcity).toBeNull();
    expect(restored.classical.food.level).toBe(0.7);
    expect(restored.classical.morale.level).toBe(0.3);
  });

  it('round-trips extended state (post-transformation)', () => {
    const system = new PressureSystem();
    system.transformDomains(1.5);

    // Apply some post-scarcity pressure via spikes on fresh gauges
    system.applySpike('meaning', 0.4);
    system.applySpike('legacy', 0.6);

    const data = system.serialize();
    expect(data.transformed).toBe(true);
    expect(data.transformedAtKardashev).toBe(1.5);
    expect(data.postScarcityGauges).toBeDefined();

    // Restore into a new system
    const system2 = new PressureSystem();
    system2.restore(data);

    expect(system2.isTransformed()).toBe(true);
    expect(system2.getTransformationKardashev()).toBe(1.5);
    expect(system2.getPostScarcityLevel('meaning')).toBeCloseTo(0.4, 1);
    expect(system2.getPostScarcityLevel('legacy')).toBeCloseTo(0.6, 1);
  });

  it('restores legacy save data (no post-scarcity fields)', () => {
    const legacyData = {
      gauges: createPressureState(),
    };
    legacyData.gauges.food.level = 0.5;

    const system = new PressureSystem();
    system.restore(legacyData);

    expect(system.isTransformed()).toBe(false);
    expect(system.getPostScarcityState()).toBeNull();
    expect(system.getLevel('food')).toBe(0.5);
  });
});

// ─── Reset behavior ─────────────────────────────────────────────────────────

describe('PressureSystem reset', () => {
  it('clears transformation state', () => {
    const system = new PressureSystem();
    system.transformDomains(1.0);
    expect(system.isTransformed()).toBe(true);

    system.reset();
    expect(system.isTransformed()).toBe(false);
    expect(system.getPostScarcityState()).toBeNull();
    expect(system.getTransformationKardashev()).toBe(0);
  });
});

// ─── applySpike with post-scarcity domains ──────────────────────────────────

describe('applySpike post-scarcity', () => {
  it('applies spike to post-scarcity domain', () => {
    const system = new PressureSystem();
    system.transformDomains(1.0);

    system.applySpike('meaning', 0.5);
    expect(system.getPostScarcityLevel('meaning')).toBe(0.5);
  });

  it('clamps spike to [0, 1]', () => {
    const system = new PressureSystem();
    system.transformDomains(1.0);

    system.applySpike('entropy', 1.5);
    expect(system.getPostScarcityLevel('entropy')).toBe(1);

    system.applySpike('entropy', -2.0);
    expect(system.getPostScarcityLevel('entropy')).toBe(0);
  });

  it('ignores post-scarcity spike before transformation', () => {
    const system = new PressureSystem();
    system.applySpike('meaning' as PressureDomain, 0.5);
    // Should be a no-op — 'meaning' is not a classical domain
    expect(system.getPostScarcityLevel('meaning')).toBe(0);
  });

  it('still applies spike to classical domains after transformation', () => {
    const system = new PressureSystem();
    system.transformDomains(1.0);
    system.applySpike('political', 0.7);
    expect(system.getLevel('political')).toBe(0.7);
  });
});

// ─── getAnyLevel ────────────────────────────────────────────────────────────

describe('getAnyLevel', () => {
  it('reads classical domains', () => {
    const system = new PressureSystem();
    system.applySpike('food', 0.6);
    expect(system.getAnyLevel('food')).toBe(0.6);
  });

  it('reads post-scarcity domains after transformation', () => {
    const system = new PressureSystem();
    system.transformDomains(1.0);
    system.applySpike('meaning', 0.4);
    expect(system.getAnyLevel('meaning')).toBe(0.4);
  });

  it('returns 0 for post-scarcity domains before transformation', () => {
    const system = new PressureSystem();
    expect(system.getAnyLevel('meaning')).toBe(0);
  });
});
