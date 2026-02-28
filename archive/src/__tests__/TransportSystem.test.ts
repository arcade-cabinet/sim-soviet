import { describe, expect, it, vi } from 'vitest';
import type { Entity } from '@/ecs/world';
import type { SeasonProfile } from '@/game/Chronology';
import { Season } from '@/game/Chronology';
import {
  applyMitigation,
  computeTransportScore,
  deserializeTransport,
  getRasputitsaMitigation,
  ROAD_QUALITY_LABELS,
  RoadQuality,
  scoreToQuality,
  serializeTransport,
  TransportSystem,
} from '@/game/TransportSystem';

// Mock getBuildingDef to return role for known transport buildings
vi.mock('@/data/buildingDefs', () => ({
  getBuildingDef: (defId: string) => {
    const TRANSPORT_IDS = ['dirt-path', 'road-depot', 'train-station', 'motor-pool', 'rail-depot'];
    if (TRANSPORT_IDS.includes(defId)) return { role: 'transport' };
    if (defId === 'coal-plant') return { role: 'power' };
    if (defId === 'kolkhoz') return { role: 'agriculture' };
    return null;
  },
}));

// ── Helpers ──────────────────────────────────────────────────────────────

function makeEntity(defId: string): Entity {
  return {
    building: {
      defId,
      powered: true,
      powerReq: 0,
      powerOutput: 0,
      housingCap: 0,
      pollution: 0,
      fear: 0,
      constructionPhase: 'complete',
    },
    position: { gridX: 0, gridY: 0 },
  };
}

function makeSeason(season: Season, buildCostMultiplier = 1.0): SeasonProfile {
  return {
    season,
    label: season,
    months: [],
    farmMultiplier: 1.0,
    buildCostMultiplier,
    heatCostPerTick: 0,
    snowRate: 0,
    daylightHours: 12,
    description: '',
  };
}

describe('TransportSystem', () => {
  // ══════════════════════════════════════════════════════════════════════
  // Module-level pure functions (preserved from original test suite)
  // ══════════════════════════════════════════════════════════════════════

  describe('scoreToQuality', () => {
    it('maps 0 to NONE', () => {
      expect(scoreToQuality(0)).toBe(RoadQuality.NONE);
    });

    it('maps 1-3 to DIRT', () => {
      expect(scoreToQuality(1)).toBe(RoadQuality.DIRT);
      expect(scoreToQuality(3)).toBe(RoadQuality.DIRT);
    });

    it('maps 4-8 to GRAVEL', () => {
      expect(scoreToQuality(4)).toBe(RoadQuality.GRAVEL);
      expect(scoreToQuality(8)).toBe(RoadQuality.GRAVEL);
    });

    it('maps 9-15 to PAVED', () => {
      expect(scoreToQuality(9)).toBe(RoadQuality.PAVED);
      expect(scoreToQuality(15)).toBe(RoadQuality.PAVED);
    });

    it('maps 16+ to HIGHWAY', () => {
      expect(scoreToQuality(16)).toBe(RoadQuality.HIGHWAY);
      expect(scoreToQuality(100)).toBe(RoadQuality.HIGHWAY);
    });
  });

  // ── Building Scores ───────────────────────────────────────────────────

  describe('computeTransportScore', () => {
    it('scores dirt-path as 1', () => {
      expect(computeTransportScore(['dirt-path'], 'selo', 'war_communism')).toBe(1);
    });

    it('scores road-depot as 3', () => {
      expect(computeTransportScore(['road-depot'], 'selo', 'war_communism')).toBe(3);
    });

    it('scores train-station as 4', () => {
      expect(computeTransportScore(['train-station'], 'selo', 'war_communism')).toBe(4);
    });

    it('scores motor-pool as 4', () => {
      expect(computeTransportScore(['motor-pool'], 'selo', 'war_communism')).toBe(4);
    });

    it('scores rail-depot as 5', () => {
      expect(computeTransportScore(['rail-depot'], 'selo', 'war_communism')).toBe(5);
    });

    it('returns 0 for unknown building IDs', () => {
      expect(computeTransportScore(['unknown-building'], 'selo', 'war_communism')).toBe(0);
    });

    it('sums multiple building scores', () => {
      // dirt-path(1) + road-depot(3) + selo(0) + war_communism(0) = 4
      expect(computeTransportScore(['dirt-path', 'road-depot'], 'selo', 'war_communism')).toBe(4);
    });

    // ── Tier Bonuses ──

    it('applies selo bonus of 0', () => {
      expect(computeTransportScore([], 'selo', 'war_communism')).toBe(0);
    });

    it('applies posyolok bonus of 2', () => {
      expect(computeTransportScore([], 'posyolok', 'war_communism')).toBe(2);
    });

    it('applies pgt bonus of 5', () => {
      expect(computeTransportScore([], 'pgt', 'war_communism')).toBe(5);
    });

    it('applies gorod bonus of 8', () => {
      expect(computeTransportScore([], 'gorod', 'war_communism')).toBe(8);
    });

    // ── Era Bonuses ──

    it('applies thaw era bonus of 5', () => {
      expect(computeTransportScore([], 'selo', 'thaw')).toBe(5);
    });

    it('applies reconstruction era bonus of 3', () => {
      expect(computeTransportScore([], 'selo', 'reconstruction')).toBe(3);
    });

    it('returns 0 bonus for unknown era', () => {
      expect(computeTransportScore([], 'selo', 'unknown_era')).toBe(0);
    });

    it('returns 0 for empty array and selo + war_communism', () => {
      expect(computeTransportScore([], 'selo', 'war_communism')).toBe(0);
    });

    // ── Combined ──

    it('sums buildings + tier + era correctly', () => {
      // rail-depot(5) + motor-pool(4) + gorod(8) + thaw(5) = 22
      expect(computeTransportScore(['rail-depot', 'motor-pool'], 'gorod', 'thaw')).toBe(22);
    });
  });

  // ── Mitigation ────────────────────────────────────────────────────────

  describe('getRasputitsaMitigation', () => {
    it('returns 0 for NONE', () => {
      expect(getRasputitsaMitigation(RoadQuality.NONE)).toBe(0);
    });

    it('returns 0.6 for PAVED', () => {
      expect(getRasputitsaMitigation(RoadQuality.PAVED)).toBe(0.6);
    });

    it('returns 0.85 for HIGHWAY', () => {
      expect(getRasputitsaMitigation(RoadQuality.HIGHWAY)).toBe(0.85);
    });
  });

  describe('applyMitigation', () => {
    it('reduces rasputitsa 1.8 with PAVED to ~1.32', () => {
      expect(applyMitigation(1.8, RoadQuality.PAVED)).toBeCloseTo(1.32, 2);
    });

    it('reduces rasputitsa 1.8 with HIGHWAY to ~1.12', () => {
      expect(applyMitigation(1.8, RoadQuality.HIGHWAY)).toBeCloseTo(1.12, 2);
    });

    it('reduces rasputitsa 1.8 with DIRT to ~1.72', () => {
      expect(applyMitigation(1.8, RoadQuality.DIRT)).toBeCloseTo(1.72, 2);
    });

    it('reduces rasputitsa 1.8 with GRAVEL to ~1.56', () => {
      expect(applyMitigation(1.8, RoadQuality.GRAVEL)).toBeCloseTo(1.56, 2);
    });

    it('does not change rawMult of 1.8 with NONE', () => {
      expect(applyMitigation(1.8, RoadQuality.NONE)).toBeCloseTo(1.8, 2);
    });

    it('returns rawMult unchanged when no penalty (1.0)', () => {
      expect(applyMitigation(1.0, RoadQuality.HIGHWAY)).toBe(1.0);
    });

    it('returns rawMult unchanged when bonus (< 1.0)', () => {
      expect(applyMitigation(0.7, RoadQuality.PAVED)).toBe(0.7);
    });

    it('handles winter 1.5 with GRAVEL', () => {
      // 1.0 + (1.5 - 1.0) * (1.0 - 0.3) = 1.0 + 0.5 * 0.7 = 1.35
      expect(applyMitigation(1.5, RoadQuality.GRAVEL)).toBeCloseTo(1.35, 2);
    });
  });

  // ── Labels ────────────────────────────────────────────────────────────

  describe('ROAD_QUALITY_LABELS', () => {
    it('has labels for all quality levels', () => {
      for (const q of Object.values(RoadQuality)) {
        expect(ROAD_QUALITY_LABELS[q]).toBeDefined();
      }
    });
  });

  // ── Legacy serialization compat ───────────────────────────────────────

  describe('legacy serialization', () => {
    it('round-trips all quality levels', () => {
      for (const q of Object.values(RoadQuality)) {
        const data = serializeTransport(q);
        expect(deserializeTransport(data)).toBe(q);
      }
    });

    it('falls back to NONE for invalid data', () => {
      expect(deserializeTransport({ quality: 'invalid' as RoadQuality })).toBe(RoadQuality.NONE);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // TransportSystem class tests
  // ══════════════════════════════════════════════════════════════════════

  describe('TransportSystem class', () => {
    // ── Lifecycle ──

    describe('lifecycle', () => {
      it('initializes with NONE quality and condition=100', () => {
        const sys = new TransportSystem();
        expect(sys.getQuality()).toBe(RoadQuality.NONE);
        expect(sys.getCondition()).toBe(100);
        expect(sys.getRawScore()).toBe(0);
      });

      it('setEra() updates internal era for next score recalc', () => {
        const sys = new TransportSystem('war_communism');
        // First tick with war_communism (era bonus 0)
        const summer = makeSeason(Season.SHORT_SUMMER);
        sys.tick([], 'selo', 0, summer);
        expect(sys.getRawScore()).toBe(0); // selo(0) + war_communism(0)

        // Change era and force recalc
        sys.setEra('thaw');
        sys.tick([], 'selo', 30, summer);
        expect(sys.getRawScore()).toBe(5); // selo(0) + thaw(5)
      });

      it('setRng() accepts rng without error', () => {
        const sys = new TransportSystem();
        const rng = { random: () => 0.5 } as unknown as import('@/game/SeedSystem').GameRng;
        expect(() => sys.setRng(rng)).not.toThrow();
      });
    });

    // ── Throttled recalculation ──

    describe('throttled recalculation', () => {
      it('recalculates on tick 0 (first tick)', () => {
        const sys = new TransportSystem();
        const summer = makeSeason(Season.SHORT_SUMMER);
        const result = sys.tick([makeEntity('dirt-path')], 'selo', 0, summer);
        expect(result.recalculated).toBe(true);
        expect(sys.getQuality()).toBe(RoadQuality.DIRT);
      });

      it('does NOT recalculate on tick 1-29 (uses cache)', () => {
        const sys = new TransportSystem();
        const summer = makeSeason(Season.SHORT_SUMMER);
        sys.tick([makeEntity('dirt-path')], 'selo', 0, summer);

        // Tick 15 with different entities — should still use cached score
        const result = sys.tick(
          [makeEntity('rail-depot'), makeEntity('motor-pool')],
          'gorod',
          15,
          summer
        );
        expect(result.recalculated).toBe(false);
        // Quality should still be DIRT from the first calc, not HIGHWAY
        expect(sys.getQuality()).toBe(RoadQuality.DIRT);
      });

      it('recalculates on tick 30', () => {
        const sys = new TransportSystem('thaw');
        const summer = makeSeason(Season.SHORT_SUMMER);
        sys.tick([], 'selo', 0, summer); // Score = 5 (thaw)

        const result = sys.tick(
          [makeEntity('rail-depot'), makeEntity('motor-pool')],
          'gorod',
          30,
          summer
        );
        expect(result.recalculated).toBe(true);
        // rail-depot(5) + motor-pool(4) + gorod(8) + thaw(5) = 22 → HIGHWAY
        expect(sys.getQuality()).toBe(RoadQuality.HIGHWAY);
      });
    });

    // ── Condition decay ──

    describe('condition decay', () => {
      it('decays by RASPUTITSA_DECAY during rasputitsa season', () => {
        const sys = new TransportSystem();
        const rasputitsa = makeSeason(Season.RASPUTITSA_SPRING);
        sys.tick([], 'selo', 0, rasputitsa);
        expect(sys.getCondition()).toBeCloseTo(100 - TransportSystem.RASPUTITSA_DECAY, 5);
      });

      it('decays by WINTER_DECAY during winter', () => {
        const sys = new TransportSystem();
        const winter = makeSeason(Season.WINTER);
        sys.tick([], 'selo', 0, winter);
        expect(sys.getCondition()).toBeCloseTo(100 - TransportSystem.WINTER_DECAY, 5);
      });

      it('decays by BASELINE_DECAY during normal season', () => {
        const sys = new TransportSystem();
        const summer = makeSeason(Season.SHORT_SUMMER);
        sys.tick([], 'selo', 0, summer);
        expect(sys.getCondition()).toBeCloseTo(100 - TransportSystem.BASELINE_DECAY, 5);
      });

      it('clamps at 0 (never negative)', () => {
        const sys = new TransportSystem();
        const rasputitsa = makeSeason(Season.RASPUTITSA_SPRING);
        // Run enough ticks to drive condition well below 0
        for (let i = 0; i < 1000; i++) {
          sys.tick([], 'selo', i * 30, rasputitsa, { timber: 0 });
        }
        expect(sys.getCondition()).toBe(0);
      });
    });

    // ── Maintenance ──

    describe('maintenance', () => {
      it('deducts timber when condition < 80', () => {
        const sys = new TransportSystem();
        const rasputitsa = makeSeason(Season.RASPUTITSA_SPRING);
        // Drive condition below 80 first (takes many ticks at 0.15/tick)
        // 100 - 0.15 * n < 80 → n > 133; but maintenance kicks in at < 80
        // Easier: run without timber to drop condition, then test with timber
        for (let i = 0; i < 200; i++) {
          sys.tick([], 'selo', i * 30, rasputitsa, { timber: 0 });
        }
        expect(sys.getCondition()).toBeLessThan(80);

        const resources = { timber: 10 };
        sys.tick([], 'selo', 200 * 30, rasputitsa, resources);
        expect(resources.timber).toBe(10 - TransportSystem.MAINTENANCE_TIMBER_COST);
      });

      it('recovers condition by MAINTENANCE_RECOVERY per tick', () => {
        const sys = new TransportSystem();
        const summer = makeSeason(Season.SHORT_SUMMER);
        // Force condition to 50 via lots of rasputitsa ticks
        const rasputitsa = makeSeason(Season.RASPUTITSA_SPRING);
        for (let i = 0; i < 400; i++) {
          sys.tick([], 'selo', i * 30, rasputitsa, { timber: 0 });
        }
        const condBefore = sys.getCondition();

        // Now tick with timber (condition < 80 so maintenance fires)
        sys.tick([], 'selo', 400 * 30, summer, { timber: 100 });
        // Expected: condBefore - BASELINE_DECAY + MAINTENANCE_RECOVERY
        const expected =
          condBefore - TransportSystem.BASELINE_DECAY + TransportSystem.MAINTENANCE_RECOVERY;
        expect(sys.getCondition()).toBeCloseTo(expected, 3);
      });

      it('does NOT trigger maintenance when condition >= 80', () => {
        const sys = new TransportSystem();
        const summer = makeSeason(Season.SHORT_SUMMER);
        const resources = { timber: 10 };
        // First tick — condition starts at 100, drops to ~99.98
        sys.tick([], 'selo', 0, summer, resources);
        expect(resources.timber).toBe(10); // no timber deducted
      });

      it('does NOT trigger maintenance when timber is 0', () => {
        const sys = new TransportSystem();
        const rasputitsa = makeSeason(Season.RASPUTITSA_SPRING);
        // Drive condition below 80
        for (let i = 0; i < 200; i++) {
          sys.tick([], 'selo', i * 30, rasputitsa, { timber: 0 });
        }
        const condBefore = sys.getCondition();
        const resources = { timber: 0 };
        sys.tick([], 'selo', 200 * 30, rasputitsa, resources);
        // Should only decay, no recovery
        expect(sys.getCondition()).toBeCloseTo(condBefore - TransportSystem.RASPUTITSA_DECAY, 5);
      });
    });

    // ── Condition-based quality downgrade ──

    describe('condition-based quality downgrade', () => {
      it('downgrades quality 1 level when condition < 25', () => {
        const sys = new TransportSystem('thaw');
        const summer = makeSeason(Season.SHORT_SUMMER);
        // First tick to set quality to PAVED (thaw=5 + pgt=5 = 10 → PAVED)
        sys.tick([], 'pgt', 0, summer);
        expect(sys.getQuality()).toBe(RoadQuality.PAVED);

        // Drive condition below 25 but above 10
        // Start: 99.98 (after summer tick). Each rasputitsa tick: -0.15
        // After 530 ticks: 99.98 - 530*0.15 = 99.98 - 79.5 = 20.48
        const rasputitsa = makeSeason(Season.RASPUTITSA_SPRING);
        for (let i = 0; i < 530; i++) {
          sys.tick([], 'pgt', (i + 1) * 30, rasputitsa, { timber: 0 });
        }
        expect(sys.getCondition()).toBeLessThan(25);
        expect(sys.getCondition()).toBeGreaterThanOrEqual(10);

        // Effective quality should be 1 level below PAVED = GRAVEL
        const result = sys.tick([], 'pgt', 531 * 30, rasputitsa, { timber: 0 });
        expect(result.quality).toBe(RoadQuality.GRAVEL);
      });

      it('downgrades quality 2 levels when condition < 10', () => {
        const sys = new TransportSystem('thaw');
        const summer = makeSeason(Season.SHORT_SUMMER);
        sys.tick([], 'pgt', 0, summer); // PAVED

        // Drive condition below 10
        const rasputitsa = makeSeason(Season.RASPUTITSA_SPRING);
        for (let i = 0; i < 700; i++) {
          sys.tick([], 'pgt', (i + 1) * 30, rasputitsa, { timber: 0 });
        }
        expect(sys.getCondition()).toBeLessThan(10);

        const result = sys.tick([], 'pgt', 701 * 30, rasputitsa, { timber: 0 });
        // 2 levels below PAVED(idx=3) → DIRT(idx=1)
        expect(result.quality).toBe(RoadQuality.DIRT);
      });

      it('quality stays at NONE when condition is low and base quality is NONE', () => {
        const sys = new TransportSystem();
        const rasputitsa = makeSeason(Season.RASPUTITSA_SPRING);
        // Drive condition to 0
        for (let i = 0; i < 1000; i++) {
          sys.tick([], 'selo', i * 30, rasputitsa, { timber: 0 });
        }
        const result = sys.tick([], 'selo', 1000 * 30, rasputitsa, { timber: 0 });
        expect(result.quality).toBe(RoadQuality.NONE);
      });
    });

    // ── Encapsulated mitigation ──

    describe('encapsulated seasonBuildMult', () => {
      it('applies mitigation during rasputitsa', () => {
        const sys = new TransportSystem('thaw');
        const rasputitsa = makeSeason(Season.RASPUTITSA_SPRING, 1.8);
        // First tick: thaw(5) + pgt(5) = 10 → PAVED → mitigation 0.6
        const result = sys.tick([], 'pgt', 0, rasputitsa);
        // 1.0 + (1.8 - 1.0) * (1.0 - 0.6) = 1.0 + 0.8 * 0.4 = 1.32
        expect(result.seasonBuildMult).toBeCloseTo(1.32, 2);
      });

      it('returns raw buildCostMultiplier when no penalty', () => {
        const sys = new TransportSystem('thaw');
        const summer = makeSeason(Season.SHORT_SUMMER, 1.0);
        const result = sys.tick([], 'pgt', 0, summer);
        expect(result.seasonBuildMult).toBe(1.0);
      });
    });

    // ── Class tick with entity filtering ──

    describe('entity filtering (migrated from tickTransport)', () => {
      it('returns NONE for empty entities', () => {
        const sys = new TransportSystem();
        const summer = makeSeason(Season.SHORT_SUMMER);
        sys.tick([], 'selo', 0, summer);
        expect(sys.getQuality()).toBe(RoadQuality.NONE);
      });

      it('returns DIRT for single dirt-path in selo', () => {
        const sys = new TransportSystem();
        const summer = makeSeason(Season.SHORT_SUMMER);
        sys.tick([makeEntity('dirt-path')], 'selo', 0, summer);
        expect(sys.getQuality()).toBe(RoadQuality.DIRT);
      });

      it('ignores non-transport buildings', () => {
        const sys = new TransportSystem();
        const summer = makeSeason(Season.SHORT_SUMMER);
        sys.tick([makeEntity('coal-plant')], 'selo', 0, summer);
        expect(sys.getQuality()).toBe(RoadQuality.NONE);
      });

      it('returns GRAVEL for road-depot + posyolok + first_plans', () => {
        const sys = new TransportSystem('first_plans');
        const summer = makeSeason(Season.SHORT_SUMMER);
        // road-depot(3) + posyolok(2) + first_plans(1) = 6 → GRAVEL
        sys.tick([makeEntity('road-depot')], 'posyolok', 0, summer);
        expect(sys.getQuality()).toBe(RoadQuality.GRAVEL);
      });

      it('handles entities without building component', () => {
        const sys = new TransportSystem();
        const summer = makeSeason(Season.SHORT_SUMMER);
        const entity: Entity = { position: { gridX: 0, gridY: 0 } };
        sys.tick([entity], 'selo', 0, summer);
        expect(sys.getQuality()).toBe(RoadQuality.NONE);
      });

      it('reaches HIGHWAY with multiple buildings + gorod + thaw', () => {
        const sys = new TransportSystem('thaw');
        const summer = makeSeason(Season.SHORT_SUMMER);
        // rail-depot(5) + motor-pool(4) + gorod(8) + thaw(5) = 22 → HIGHWAY
        const entities = [makeEntity('rail-depot'), makeEntity('motor-pool')];
        sys.tick(entities, 'gorod', 0, summer);
        expect(sys.getQuality()).toBe(RoadQuality.HIGHWAY);
      });
    });

    // ── Serialization round-trip ──

    describe('serialization', () => {
      it('round-trips quality, condition, rawScore, nextRecalcTick', () => {
        const sys = new TransportSystem('thaw');
        const summer = makeSeason(Season.SHORT_SUMMER);
        sys.tick([makeEntity('rail-depot')], 'gorod', 0, summer);

        const data = sys.serialize();
        const restored = TransportSystem.deserialize(data);

        expect(restored.getQuality()).toBe(sys.getQuality());
        expect(restored.getCondition()).toBeCloseTo(sys.getCondition(), 5);
        expect(restored.getRawScore()).toBe(sys.getRawScore());
      });

      it('backward compat: old { quality: "paved" } save → condition defaults to 100', () => {
        const oldSave = { quality: RoadQuality.PAVED };
        const restored = TransportSystem.deserialize(oldSave);
        expect(restored.getQuality()).toBe(RoadQuality.PAVED);
        expect(restored.getCondition()).toBe(100);
      });

      it('backward compat: invalid quality falls back to NONE', () => {
        const badSave = { quality: 'garbage' as RoadQuality };
        const restored = TransportSystem.deserialize(badSave);
        expect(restored.getQuality()).toBe(RoadQuality.NONE);
      });
    });
  });
});
