import {
  GOROD_MIN_DISTINCT_ROLES,
  type SettlementMetrics,
  SettlementSystem,
  TIER_DEFINITIONS,
  TIER_ORDER,
} from '../../src/game/SettlementSystem';

// ── Helpers ──────────────────────────────────────────────────

function makeMetrics(overrides: Partial<SettlementMetrics> = {}): SettlementMetrics {
  return {
    population: 0,
    buildings: [],
    totalWorkers: 0,
    nonAgriculturalWorkers: 0,
    ...overrides,
  };
}

/** Metrics that satisfy posyolok upgrade requirements. */
function posyolokMetrics(): SettlementMetrics {
  return makeMetrics({
    population: 60,
    buildings: [{ defId: 'factory-a', role: 'industry' }],
    totalWorkers: 60,
    nonAgriculturalWorkers: 60,
  });
}

/** Metrics that satisfy PGT upgrade requirements. */
function pgtMetrics(): SettlementMetrics {
  return makeMetrics({
    population: 200,
    buildings: [
      { defId: 'factory-a', role: 'industry' },
      { defId: 'school-a', role: 'education' },
      { defId: 'clinic-a', role: 'medical' },
      { defId: 'farm-a', role: 'agriculture' },
    ],
    totalWorkers: 200,
    nonAgriculturalWorkers: 150, // 75%
  });
}

/** Metrics that satisfy gorod upgrade requirements. */
function gorodMetrics(): SettlementMetrics {
  return makeMetrics({
    population: 500,
    buildings: [
      { defId: 'factory-a', role: 'industry' },
      { defId: 'school-a', role: 'education' },
      { defId: 'clinic-a', role: 'medical' },
      { defId: 'apartment-a', role: 'housing' },
      { defId: 'monument-a', role: 'culture' },
      { defId: 'power-plant-a', role: 'power' },
    ],
    totalWorkers: 500,
    nonAgriculturalWorkers: 450, // 90%
  });
}

// ─────────────────────────────────────────────────────────────

describe('SettlementSystem', () => {
  // ── 1. Starts at selo tier ──────────────────────────────

  it('starts at selo tier by default', () => {
    const system = new SettlementSystem();
    expect(system.getCurrentTier()).toBe('selo');
  });

  it('starts at specified initial tier', () => {
    const system = new SettlementSystem('pgt');
    expect(system.getCurrentTier()).toBe('pgt');
  });

  // ── 2. Meets posyolok thresholds for 30 ticks → upgrades ──

  it('upgrades from selo to posyolok after 30 qualifying ticks', () => {
    const system = new SettlementSystem();
    const metrics = posyolokMetrics();
    let event = null;

    for (let i = 0; i < 30; i++) {
      event = system.tick(metrics);
    }

    expect(event).not.toBeNull();
    expect(event!.type).toBe('upgrade');
    expect(event!.fromTier).toBe('selo');
    expect(event!.toTier).toBe('posyolok');
    expect(system.getCurrentTier()).toBe('posyolok');
  });

  // ── 3. Thresholds met for 29 ticks then broken → no upgrade ──

  it('resets upgrade counter when thresholds are broken before reaching target', () => {
    const system = new SettlementSystem();
    const goodMetrics = posyolokMetrics();
    const badMetrics = makeMetrics({ population: 10 });

    // 29 qualifying ticks
    for (let i = 0; i < 29; i++) {
      system.tick(goodMetrics);
    }

    // Break the threshold
    system.tick(badMetrics);

    // Counter should have reset — 1 more qualifying tick shouldn't upgrade
    const event = system.tick(goodMetrics);
    expect(event).toBeNull();
    expect(system.getCurrentTier()).toBe('selo');
  });

  // ── 4. Population drops below current tier for 60 ticks → downgrades ──

  it('downgrades when population drops below threshold for 60 ticks', () => {
    const system = new SettlementSystem('posyolok');
    const lowPop = makeMetrics({ population: 20 });
    let event = null;

    for (let i = 0; i < 60; i++) {
      event = system.tick(lowPop);
    }

    expect(event).not.toBeNull();
    expect(event!.type).toBe('downgrade');
    expect(event!.fromTier).toBe('posyolok');
    expect(event!.toTier).toBe('selo');
    expect(system.getCurrentTier()).toBe('selo');
  });

  // ── 5. Population recovers before 60 ticks → no downgrade ──

  it('resets downgrade counter when population recovers', () => {
    const system = new SettlementSystem('posyolok');
    const lowPop = makeMetrics({ population: 20 });
    const goodPop = makeMetrics({ population: 60 });

    // 59 ticks below threshold
    for (let i = 0; i < 59; i++) {
      system.tick(lowPop);
    }

    // Population recovers
    system.tick(goodPop);

    // One more low tick shouldn't downgrade (counter was reset)
    const event = system.tick(lowPop);
    expect(event).toBeNull();
    expect(system.getCurrentTier()).toBe('posyolok');
  });

  // ── 6. Can't skip tiers ──────────────────────────────────

  it('cannot skip tiers — must go through each in order', () => {
    const system = new SettlementSystem();
    // Even with gorod-level metrics, should upgrade to posyolok first
    const metrics = gorodMetrics();

    for (let i = 0; i < 30; i++) {
      system.tick(metrics);
    }

    // Should be posyolok, not pgt or gorod
    expect(system.getCurrentTier()).toBe('posyolok');
  });

  // ── 7. Upgrade event has correct fromTier and toTier ────

  it('upgrade event contains correct tier transition info', () => {
    const system = new SettlementSystem('posyolok');
    const metrics = pgtMetrics();
    let event = null;

    for (let i = 0; i < 30; i++) {
      event = system.tick(metrics);
    }

    expect(event).not.toBeNull();
    expect(event!.type).toBe('upgrade');
    expect(event!.fromTier).toBe('posyolok');
    expect(event!.toTier).toBe('pgt');
    expect(event!.title).toBeTruthy();
    expect(event!.description).toBeTruthy();
  });

  // ── 8. Downgrade event has correct fromTier and toTier ──

  it('downgrade event contains correct tier transition info', () => {
    const system = new SettlementSystem('pgt');
    const lowPop = makeMetrics({ population: 50 });
    let event = null;

    for (let i = 0; i < 60; i++) {
      event = system.tick(lowPop);
    }

    expect(event).not.toBeNull();
    expect(event!.type).toBe('downgrade');
    expect(event!.fromTier).toBe('pgt');
    expect(event!.toTier).toBe('posyolok');
  });

  // ── 9. getProgress() returns correct ratios ─────────────

  describe('getProgress()', () => {
    it('returns 0/0 for a new system at selo', () => {
      const system = new SettlementSystem();
      const progress = system.getProgress();
      expect(progress.toUpgrade).toBe(0);
      expect(progress.toDowngrade).toBe(0);
    });

    it('returns correct upgrade progress ratio', () => {
      const system = new SettlementSystem();
      const metrics = posyolokMetrics();

      for (let i = 0; i < 15; i++) {
        system.tick(metrics);
      }

      const progress = system.getProgress();
      expect(progress.toUpgrade).toBeCloseTo(0.5); // 15/30
    });

    it('returns correct downgrade progress ratio', () => {
      const system = new SettlementSystem('posyolok');
      const lowPop = makeMetrics({ population: 20 });

      for (let i = 0; i < 30; i++) {
        system.tick(lowPop);
      }

      const progress = system.getProgress();
      expect(progress.toDowngrade).toBeCloseTo(0.5); // 30/60
    });
  });

  // ── 10. serialize/deserialize round-trip ─────────────────

  it('serialize/deserialize round-trips correctly', () => {
    const system = new SettlementSystem('pgt');
    const metrics = gorodMetrics();

    // Build up some counter state
    for (let i = 0; i < 10; i++) {
      system.tick(metrics);
    }

    const saved = system.serialize();
    const restored = SettlementSystem.deserialize(saved);

    expect(restored.getCurrentTier()).toBe('pgt');
    expect(restored.getProgress().toUpgrade).toBeCloseTo(10 / 30);
    expect(restored.serialize()).toEqual(saved);
  });

  // ── 11. gorod cannot upgrade further ─────────────────────

  it('gorod cannot upgrade further', () => {
    const system = new SettlementSystem('gorod');
    const metrics = gorodMetrics();

    for (let i = 0; i < 100; i++) {
      const event = system.tick(metrics);
      expect(event).toBeNull();
    }

    expect(system.getCurrentTier()).toBe('gorod');
    expect(system.getProgress().toUpgrade).toBe(0);
  });

  // ── 12. selo cannot downgrade further ────────────────────

  it('selo cannot downgrade further', () => {
    const system = new SettlementSystem();
    const emptyMetrics = makeMetrics();

    for (let i = 0; i < 100; i++) {
      const event = system.tick(emptyMetrics);
      expect(event).toBeNull();
    }

    expect(system.getCurrentTier()).toBe('selo');
    expect(system.getProgress().toDowngrade).toBe(0);
  });

  // ── Building role requirements ───────────────────────────

  describe('building role requirements', () => {
    it('posyolok requires at least one industry building', () => {
      const system = new SettlementSystem();
      const noIndustry = makeMetrics({
        population: 60,
        buildings: [{ defId: 'farm-a', role: 'agriculture' }],
        totalWorkers: 60,
        nonAgriculturalWorkers: 0,
      });

      for (let i = 0; i < 30; i++) {
        system.tick(noIndustry);
      }

      expect(system.getCurrentTier()).toBe('selo');
    });

    it('pgt requires both education and medical buildings', () => {
      const system = new SettlementSystem('posyolok');
      const onlyEducation = makeMetrics({
        population: 200,
        buildings: [
          { defId: 'school-a', role: 'education' },
          { defId: 'factory-a', role: 'industry' },
        ],
        totalWorkers: 200,
        nonAgriculturalWorkers: 200,
      });

      for (let i = 0; i < 30; i++) {
        system.tick(onlyEducation);
      }

      expect(system.getCurrentTier()).toBe('posyolok');
    });

    it('gorod requires 5+ distinct building roles', () => {
      const system = new SettlementSystem('pgt');
      const fewRoles = makeMetrics({
        population: 500,
        buildings: [
          { defId: 'factory-a', role: 'industry' },
          { defId: 'school-a', role: 'education' },
          { defId: 'clinic-a', role: 'medical' },
          // Only 3 distinct roles — not enough
        ],
        totalWorkers: 500,
        nonAgriculturalWorkers: 450,
      });

      for (let i = 0; i < 30; i++) {
        system.tick(fewRoles);
      }

      expect(system.getCurrentTier()).toBe('pgt');
    });
  });

  // ── Non-agricultural percentage ──────────────────────────

  describe('non-agricultural percentage', () => {
    it('pgt requires >= 50% non-agricultural workers', () => {
      const system = new SettlementSystem('posyolok');
      const lowNonAgri = makeMetrics({
        population: 200,
        buildings: [
          { defId: 'school-a', role: 'education' },
          { defId: 'clinic-a', role: 'medical' },
          { defId: 'farm-a', role: 'agriculture' },
        ],
        totalWorkers: 200,
        nonAgriculturalWorkers: 80, // 40% — below 50%
      });

      for (let i = 0; i < 30; i++) {
        system.tick(lowNonAgri);
      }

      expect(system.getCurrentTier()).toBe('posyolok');
    });

    it('handles zero total workers gracefully', () => {
      const system = new SettlementSystem('posyolok');
      const noWorkers = makeMetrics({
        population: 200,
        buildings: [
          { defId: 'school-a', role: 'education' },
          { defId: 'clinic-a', role: 'medical' },
        ],
        totalWorkers: 0,
        nonAgriculturalWorkers: 0,
      });

      // Should not crash, and nonAgriPercent check should fail (0% < 50%)
      for (let i = 0; i < 30; i++) {
        system.tick(noWorkers);
      }

      expect(system.getCurrentTier()).toBe('posyolok');
    });
  });

  // ── Tier definitions ─────────────────────────────────────

  describe('tier definitions', () => {
    it('exposes correct tier definition for current tier', () => {
      const system = new SettlementSystem('posyolok');
      const def = system.getTierDefinition();

      expect(def.tier).toBe('posyolok');
      expect(def.russian).toBe(
        '\u0440\u0430\u0431\u043e\u0447\u0438\u0439 \u043f\u043e\u0441\u0451\u043b\u043e\u043a'
      );
      expect(def.populationReq).toBe(50);
    });

    it('has 4 tiers in order', () => {
      expect(TIER_ORDER).toEqual(['selo', 'posyolok', 'pgt', 'gorod']);
      expect(TIER_ORDER).toHaveLength(4);
    });

    it('all tiers have valid definitions', () => {
      for (const tier of TIER_ORDER) {
        const def = TIER_DEFINITIONS[tier];
        expect(def.tier).toBe(tier);
        expect(def.russian.length).toBeGreaterThan(0);
        expect(def.title.length).toBeGreaterThan(0);
        expect(def.populationReq).toBeGreaterThanOrEqual(0);
        expect(def.nonAgriPercent).toBeGreaterThanOrEqual(0);
        expect(def.nonAgriPercent).toBeLessThanOrEqual(100);
      }
    });

    it('GOROD_MIN_DISTINCT_ROLES is 5', () => {
      expect(GOROD_MIN_DISTINCT_ROLES).toBe(5);
    });
  });

  // ── Flavor text ──────────────────────────────────────────

  describe('flavor text', () => {
    it('upgrade events have Soviet-themed title and description', () => {
      const system = new SettlementSystem();
      const metrics = posyolokMetrics();
      let event = null;

      for (let i = 0; i < 30; i++) {
        event = system.tick(metrics);
      }

      expect(event!.title.length).toBeGreaterThan(0);
      expect(event!.description.length).toBeGreaterThan(0);
      expect(event!.description).toContain('Presidium');
    });

    it('downgrade events have Soviet-themed title and description', () => {
      const system = new SettlementSystem('posyolok');
      const lowPop = makeMetrics({ population: 20 });
      let event = null;

      for (let i = 0; i < 60; i++) {
        event = system.tick(lowPop);
      }

      expect(event!.title.length).toBeGreaterThan(0);
      expect(event!.description.length).toBeGreaterThan(0);
      expect(event!.description).toContain('reclassified');
    });
  });

  // ── Full progression ─────────────────────────────────────

  describe('full progression', () => {
    it('can progress through all tiers in sequence', () => {
      const system = new SettlementSystem();

      // selo → posyolok
      for (let i = 0; i < 30; i++) {
        system.tick(posyolokMetrics());
      }
      expect(system.getCurrentTier()).toBe('posyolok');

      // posyolok → pgt
      for (let i = 0; i < 30; i++) {
        system.tick(pgtMetrics());
      }
      expect(system.getCurrentTier()).toBe('pgt');

      // pgt → gorod
      for (let i = 0; i < 30; i++) {
        system.tick(gorodMetrics());
      }
      expect(system.getCurrentTier()).toBe('gorod');
    });

    it('counters reset after tier change', () => {
      const system = new SettlementSystem();

      // Upgrade to posyolok
      for (let i = 0; i < 30; i++) {
        system.tick(posyolokMetrics());
      }
      expect(system.getCurrentTier()).toBe('posyolok');

      // Progress should be reset
      const progress = system.getProgress();
      expect(progress.toUpgrade).toBe(0);
      expect(progress.toDowngrade).toBe(0);
    });
  });
});
