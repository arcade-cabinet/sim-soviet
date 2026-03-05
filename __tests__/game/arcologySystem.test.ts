import { World } from 'miniplex';
import type { Entity } from '../../src/ecs/world';
import {
  type Arcology,
  type ArcologySystemContext,
  evaluateArcologies,
} from '../../src/game/arcology/ArcologySystem';

// ── Helpers ──────────────────────────────────────────────────

/** Minimal building defaults for test entities. */
function makeBuilding(
  defId: string,
  overrides: Partial<Entity['building']> = {},
): NonNullable<Entity['building']> {
  return {
    defId,
    level: 0,
    powered: true,
    powerReq: 0,
    powerOutput: 0,
    housingCap: 0,
    pollution: 0,
    fear: 0,
    workerCount: 0,
    residentCount: 0,
    avgMorale: 50,
    avgSkill: 50,
    avgLoyalty: 50,
    avgVodkaDep: 0,
    trudodniAccrued: 0,
    householdCount: 0,
    ...overrides,
  };
}

/** Add a building entity to the world at the given grid position. */
function addBuilding(
  world: World<Entity>,
  defId: string,
  gridX: number,
  gridY: number,
  overrides: Partial<Entity['building']> = {},
): Entity {
  return world.add({
    position: { gridX, gridY },
    building: makeBuilding(defId, overrides),
    isBuilding: true,
  });
}

/** Create a fresh context for testing. */
function makeContext(
  world: World<Entity>,
  population: number,
  arcologies: Arcology[] = [],
): ArcologySystemContext {
  return { world, population, arcologies };
}

// ── Tests ────────────────────────────────────────────────────

describe('ArcologySystem', () => {
  let world: World<Entity>;

  beforeEach(() => {
    world = new World<Entity>();
  });

  // ── Population gating ──────────────────────────────────────

  describe('population gating', () => {
    it('returns empty result when population is below threshold', () => {
      addBuilding(world, 'workers-house-a', 0, 0);
      addBuilding(world, 'workers-house-a', 1, 0);
      addBuilding(world, 'workers-house-a', 2, 0);

      const result = evaluateArcologies(makeContext(world, 49999));

      expect(result.arcologies).toHaveLength(0);
      expect(result.newMerges).toHaveLength(0);
      expect(result.arcologyPopulation).toBe(0);
      expect(result.domeThresholdReached).toBe(false);
    });

    it('detects arcologies when population meets threshold', () => {
      addBuilding(world, 'workers-house-a', 0, 0);
      addBuilding(world, 'workers-house-a', 1, 0);
      addBuilding(world, 'workers-house-a', 2, 0);

      const result = evaluateArcologies(makeContext(world, 50000));

      expect(result.arcologies).toHaveLength(1);
    });
  });

  // ── Flood fill detection ───────────────────────────────────

  describe('flood fill connected components', () => {
    it('finds a horizontal chain of 3 buildings', () => {
      addBuilding(world, 'workers-house-a', 5, 5);
      addBuilding(world, 'workers-house-b', 6, 5);
      addBuilding(world, 'workers-house-c', 7, 5);

      const result = evaluateArcologies(makeContext(world, 100000));

      expect(result.arcologies).toHaveLength(1);
      expect(result.arcologies[0].componentEntityIds).toHaveLength(3);
      expect(result.arcologies[0].mergeGroup).toBe('residential');
    });

    it('finds a vertical chain of 3 buildings', () => {
      addBuilding(world, 'factory-office', 3, 3);
      addBuilding(world, 'bread-factory', 3, 4);
      addBuilding(world, 'vodka-distillery', 3, 5);

      const result = evaluateArcologies(makeContext(world, 100000));

      expect(result.arcologies).toHaveLength(1);
      expect(result.arcologies[0].mergeGroup).toBe('industrial');
    });

    it('finds L-shaped connected components', () => {
      //  X
      //  X X
      addBuilding(world, 'warehouse', 0, 0);
      addBuilding(world, 'rail-depot', 0, 1);
      addBuilding(world, 'road-depot', 1, 1);

      const result = evaluateArcologies(makeContext(world, 100000));

      expect(result.arcologies).toHaveLength(1);
      expect(result.arcologies[0].componentEntityIds).toHaveLength(3);
      expect(result.arcologies[0].mergeGroup).toBe('logistics');
    });

    it('finds two separate connected components in different locations', () => {
      // Group 1: residential cluster at (0,0)
      addBuilding(world, 'workers-house-a', 0, 0);
      addBuilding(world, 'workers-house-a', 1, 0);
      addBuilding(world, 'workers-house-a', 2, 0);

      // Group 2: residential cluster at (10,10) — far away
      addBuilding(world, 'workers-house-b', 10, 10);
      addBuilding(world, 'workers-house-b', 11, 10);
      addBuilding(world, 'workers-house-b', 12, 10);

      const result = evaluateArcologies(makeContext(world, 100000));

      expect(result.arcologies).toHaveLength(2);
      expect(result.arcologies.every((a) => a.mergeGroup === 'residential')).toBe(true);
    });

    it('correctly computes center of mass', () => {
      addBuilding(world, 'workers-house-a', 0, 0);
      addBuilding(world, 'workers-house-a', 1, 0);
      addBuilding(world, 'workers-house-a', 2, 0);

      const result = evaluateArcologies(makeContext(world, 100000));

      expect(result.arcologies[0].center.x).toBe(1);
      expect(result.arcologies[0].center.y).toBe(0);
    });

    it('populates footprint with all occupied grid cells', () => {
      addBuilding(world, 'school', 4, 4);
      addBuilding(world, 'hospital', 5, 4);
      addBuilding(world, 'polyclinic', 6, 4);

      const result = evaluateArcologies(makeContext(world, 100000));
      const footprint = result.arcologies[0].footprint;

      expect(footprint).toHaveLength(3);
      const keys = footprint.map((f) => `${f.x},${f.y}`).sort();
      expect(keys).toEqual(['4,4', '5,4', '6,4']);
    });
  });

  // ── Merge group isolation ──────────────────────────────────

  describe('merge group isolation', () => {
    it('does not merge buildings from different groups', () => {
      // Residential next to industrial — should NOT merge
      addBuilding(world, 'workers-house-a', 0, 0);
      addBuilding(world, 'workers-house-a', 1, 0);
      addBuilding(world, 'factory-office', 2, 0);

      const result = evaluateArcologies(makeContext(world, 100000));

      // Neither group has 3 buildings, so no arcologies
      expect(result.arcologies).toHaveLength(0);
    });

    it('forms separate arcologies for adjacent but different groups', () => {
      // 3 residential in a row
      addBuilding(world, 'workers-house-a', 0, 0);
      addBuilding(world, 'workers-house-a', 1, 0);
      addBuilding(world, 'workers-house-a', 2, 0);

      // 3 industrial in a row, adjacent to residential
      addBuilding(world, 'factory-office', 0, 1);
      addBuilding(world, 'bread-factory', 1, 1);
      addBuilding(world, 'vodka-distillery', 2, 1);

      const result = evaluateArcologies(makeContext(world, 100000));

      expect(result.arcologies).toHaveLength(2);
      const groups = result.arcologies.map((a) => a.mergeGroup).sort();
      expect(groups).toEqual(['industrial', 'residential']);
    });
  });

  // ── Production bonus ───────────────────────────────────────

  describe('production bonus', () => {
    it('computes 1.05 for 3 buildings (5% for 1 extra beyond 2)', () => {
      addBuilding(world, 'workers-house-a', 0, 0);
      addBuilding(world, 'workers-house-a', 1, 0);
      addBuilding(world, 'workers-house-a', 2, 0);

      const result = evaluateArcologies(makeContext(world, 100000));

      expect(result.arcologies[0].productionBonus).toBeCloseTo(1.05);
    });

    it('computes 1.15 for 5 buildings', () => {
      for (let i = 0; i < 5; i++) {
        addBuilding(world, 'workers-house-a', i, 0);
      }

      const result = evaluateArcologies(makeContext(world, 100000));

      expect(result.arcologies[0].productionBonus).toBeCloseTo(1.15);
    });

    it('caps production bonus at 1.50 for many buildings', () => {
      // 15 buildings: (15-2)*0.05 = 0.65, capped to 0.50 => bonus = 1.50
      for (let i = 0; i < 15; i++) {
        addBuilding(world, 'workers-house-a', i, 0);
      }

      const result = evaluateArcologies(makeContext(world, 100000));

      expect(result.arcologies[0].productionBonus).toBeCloseTo(1.50);
    });
  });

  // ── Containment ratio ──────────────────────────────────────

  describe('containment ratio', () => {
    it('computes 0.15 for 3 buildings', () => {
      addBuilding(world, 'workers-house-a', 0, 0);
      addBuilding(world, 'workers-house-a', 1, 0);
      addBuilding(world, 'workers-house-a', 2, 0);

      const result = evaluateArcologies(makeContext(world, 100000));

      expect(result.arcologies[0].containment).toBeCloseTo(0.15);
    });

    it('computes 0.50 for 10 buildings', () => {
      for (let i = 0; i < 10; i++) {
        addBuilding(world, 'workers-house-a', i, 0);
      }

      const result = evaluateArcologies(makeContext(world, 100000));

      expect(result.arcologies[0].containment).toBeCloseTo(0.50);
    });

    it('caps containment at 1.0 for 20+ buildings', () => {
      for (let i = 0; i < 25; i++) {
        addBuilding(world, 'workers-house-a', i, 0);
      }

      const result = evaluateArcologies(makeContext(world, 100000));

      expect(result.arcologies[0].containment).toBe(1.0);
    });
  });

  // ── Dome threshold ─────────────────────────────────────────

  describe('dome threshold', () => {
    it('domeThresholdReached is false when population < domeStart', () => {
      // 20 buildings = containment 1.0, but pop below 500k
      for (let i = 0; i < 20; i++) {
        addBuilding(world, 'workers-house-a', i, 0);
      }

      const result = evaluateArcologies(makeContext(world, 100000));

      expect(result.domeThresholdReached).toBe(false);
    });

    it('domeThresholdReached is false when containment < 0.8', () => {
      // 3 buildings = containment 0.15, pop above 500k
      addBuilding(world, 'workers-house-a', 0, 0);
      addBuilding(world, 'workers-house-a', 1, 0);
      addBuilding(world, 'workers-house-a', 2, 0);

      const result = evaluateArcologies(makeContext(world, 600000));

      expect(result.domeThresholdReached).toBe(false);
    });

    it('domeThresholdReached is true when pop >= domeStart AND containment >= 0.8', () => {
      // 16 buildings = containment 0.80, pop 500k+
      for (let i = 0; i < 16; i++) {
        addBuilding(world, 'workers-house-a', i, 0);
      }

      const result = evaluateArcologies(makeContext(world, 500000));

      expect(result.domeThresholdReached).toBe(true);
    });
  });

  // ── Existing arcology preservation ─────────────────────────

  describe('existing arcology preservation', () => {
    it('preserves dome assignment from existing arcologies', () => {
      addBuilding(world, 'workers-house-a', 0, 0);
      addBuilding(world, 'workers-house-a', 1, 0);
      addBuilding(world, 'workers-house-a', 2, 0);

      // First evaluation — no dome
      const result1 = evaluateArcologies(makeContext(world, 100000));
      expect(result1.arcologies[0].hasDome).toBe(false);

      // Mark the dome as assigned
      result1.arcologies[0].hasDome = true;

      // Second evaluation — dome should persist
      const result2 = evaluateArcologies(makeContext(world, 100000, result1.arcologies));
      expect(result2.arcologies[0].hasDome).toBe(true);
    });

    it('identifies new merges that did not exist previously', () => {
      addBuilding(world, 'workers-house-a', 0, 0);
      addBuilding(world, 'workers-house-a', 1, 0);
      addBuilding(world, 'workers-house-a', 2, 0);

      // First evaluation — all are new merges
      const result1 = evaluateArcologies(makeContext(world, 100000));
      expect(result1.newMerges).toHaveLength(1);

      // Second evaluation — no new merges (same buildings)
      const result2 = evaluateArcologies(makeContext(world, 100000, result1.arcologies));
      expect(result2.newMerges).toHaveLength(0);
    });

    it('reports new arcology when additional buildings form a new cluster', () => {
      addBuilding(world, 'workers-house-a', 0, 0);
      addBuilding(world, 'workers-house-a', 1, 0);
      addBuilding(world, 'workers-house-a', 2, 0);

      const result1 = evaluateArcologies(makeContext(world, 100000));
      expect(result1.arcologies).toHaveLength(1);

      // Add a new cluster far away
      addBuilding(world, 'factory-office', 20, 20);
      addBuilding(world, 'bread-factory', 21, 20);
      addBuilding(world, 'vodka-distillery', 22, 20);

      const result2 = evaluateArcologies(makeContext(world, 100000, result1.arcologies));
      expect(result2.arcologies).toHaveLength(2);
      expect(result2.newMerges).toHaveLength(1);
      expect(result2.newMerges[0].mergeGroup).toBe('industrial');
    });
  });

  // ── Edge cases ─────────────────────────────────────────────

  describe('edge cases', () => {
    it('single building does not form an arcology', () => {
      addBuilding(world, 'workers-house-a', 5, 5);

      const result = evaluateArcologies(makeContext(world, 100000));

      expect(result.arcologies).toHaveLength(0);
    });

    it('two adjacent buildings do not form an arcology', () => {
      addBuilding(world, 'workers-house-a', 5, 5);
      addBuilding(world, 'workers-house-a', 6, 5);

      const result = evaluateArcologies(makeContext(world, 100000));

      expect(result.arcologies).toHaveLength(0);
    });

    it('diagonal buildings do NOT merge (orthogonal only)', () => {
      addBuilding(world, 'workers-house-a', 0, 0);
      addBuilding(world, 'workers-house-a', 1, 1);
      addBuilding(world, 'workers-house-a', 2, 2);

      const result = evaluateArcologies(makeContext(world, 100000));

      expect(result.arcologies).toHaveLength(0);
    });

    it('buildings under construction are excluded from merging', () => {
      addBuilding(world, 'workers-house-a', 0, 0);
      addBuilding(world, 'workers-house-a', 1, 0);
      addBuilding(world, 'workers-house-a', 2, 0, {
        constructionPhase: 'foundation',
      });

      const result = evaluateArcologies(makeContext(world, 100000));

      // Only 2 complete buildings — not enough
      expect(result.arcologies).toHaveLength(0);
    });

    it('buildings with constructionPhase = complete are included', () => {
      addBuilding(world, 'workers-house-a', 0, 0, {
        constructionPhase: 'complete',
      });
      addBuilding(world, 'workers-house-a', 1, 0);
      addBuilding(world, 'workers-house-a', 2, 0);

      const result = evaluateArcologies(makeContext(world, 100000));

      expect(result.arcologies).toHaveLength(1);
    });

    it('buildings not in any merge group are ignored', () => {
      addBuilding(world, 'unknown-building', 0, 0);
      addBuilding(world, 'unknown-building', 1, 0);
      addBuilding(world, 'unknown-building', 2, 0);

      const result = evaluateArcologies(makeContext(world, 100000));

      expect(result.arcologies).toHaveLength(0);
    });

    it('population and worker counts aggregate from building components', () => {
      addBuilding(world, 'workers-house-a', 0, 0, {
        residentCount: 100,
        workerCount: 50,
      });
      addBuilding(world, 'workers-house-a', 1, 0, {
        residentCount: 200,
        workerCount: 80,
      });
      addBuilding(world, 'workers-house-a', 2, 0, {
        residentCount: 150,
        workerCount: 60,
      });

      const result = evaluateArcologies(makeContext(world, 100000));

      expect(result.arcologies[0].population).toBe(450);
      expect(result.arcologies[0].workers).toBe(190);
      expect(result.arcologyPopulation).toBe(450);
    });

    it('dome radius increases with footprint spread', () => {
      // Compact cluster
      addBuilding(world, 'workers-house-a', 0, 0);
      addBuilding(world, 'workers-house-a', 1, 0);
      addBuilding(world, 'workers-house-a', 2, 0);

      const compact = evaluateArcologies(makeContext(world, 100000));

      // Spread cluster
      const world2 = new World<Entity>();
      addBuilding(world2, 'workers-house-a', 0, 0);
      addBuilding(world2, 'workers-house-a', 1, 0);
      addBuilding(world2, 'workers-house-a', 2, 0);
      addBuilding(world2, 'workers-house-a', 3, 0);
      addBuilding(world2, 'workers-house-a', 4, 0);

      const spread = evaluateArcologies(makeContext(world2, 100000));

      expect(spread.arcologies[0].domeRadius).toBeGreaterThan(
        compact.arcologies[0].domeRadius,
      );
    });

    it('deterministic arcology IDs based on position', () => {
      addBuilding(world, 'workers-house-a', 0, 0);
      addBuilding(world, 'workers-house-a', 1, 0);
      addBuilding(world, 'workers-house-a', 2, 0);

      const result1 = evaluateArcologies(makeContext(world, 100000));
      const result2 = evaluateArcologies(makeContext(world, 100000));

      expect(result1.arcologies[0].id).toBe(result2.arcologies[0].id);
    });
  });
});
