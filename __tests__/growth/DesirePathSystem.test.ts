/**
 * Tests for the desire-path road formation system.
 *
 * Roads form from repeated worker movement patterns:
 * - Traffic accumulates on cells between home and work
 * - High-traffic cells become dirt paths, then gravel, then paved
 * - Traffic decays over time to prevent stale paths
 */

import {
  createTrafficGrid,
  recordCommute,
  decayTraffic,
  extractDesirePaths,
  ROAD_THRESHOLDS,
  TRAFFIC_DECAY_RATE,
  serializeTrafficGrid,
  restoreTrafficGrid,
} from '../../src/growth/DesirePathSystem';

describe('DesirePathSystem', () => {
  describe('recordCommute', () => {
    it('records traffic on cells between source and destination', () => {
      const grid = createTrafficGrid();
      recordCommute(grid, 0, 0, 3, 0);

      // Cells (1,0), (2,0), (3,0) should have traffic=1
      expect(grid.cells.get('1,0')).toBe(1);
      expect(grid.cells.get('2,0')).toBe(1);
      expect(grid.cells.get('3,0')).toBe(1);
      // Source cell (0,0) should NOT have traffic
      expect(grid.cells.has('0,0')).toBe(false);
    });

    it('records traffic on both horizontal and vertical segments', () => {
      const grid = createTrafficGrid();
      recordCommute(grid, 0, 0, 2, 2);

      // Horizontal: (1,0), (2,0)
      expect(grid.cells.get('1,0')).toBe(1);
      expect(grid.cells.get('2,0')).toBe(1);
      // Vertical: (2,1), (2,2)
      expect(grid.cells.get('2,1')).toBe(1);
      expect(grid.cells.get('2,2')).toBe(1);
    });

    it('accumulates traffic from multiple commutes', () => {
      const grid = createTrafficGrid();
      recordCommute(grid, 0, 0, 3, 0);
      recordCommute(grid, 0, 0, 3, 0);
      recordCommute(grid, 0, 0, 3, 0);

      expect(grid.cells.get('1,0')).toBe(3);
      expect(grid.cells.get('2,0')).toBe(3);
    });

    it('handles same source and destination (no movement)', () => {
      const grid = createTrafficGrid();
      recordCommute(grid, 5, 5, 5, 5);
      expect(grid.cells.size).toBe(0);
    });

    it('handles negative direction movement', () => {
      const grid = createTrafficGrid();
      recordCommute(grid, 3, 3, 1, 1);

      // Horizontal: (2,3), (1,3)
      expect(grid.cells.get('2,3')).toBe(1);
      expect(grid.cells.get('1,3')).toBe(1);
      // Vertical: (1,2), (1,1)
      expect(grid.cells.get('1,2')).toBe(1);
      expect(grid.cells.get('1,1')).toBe(1);
    });
  });

  describe('decayTraffic', () => {
    it('reduces traffic by the decay rate', () => {
      const grid = createTrafficGrid();
      grid.cells.set('5,5', 100);

      decayTraffic(grid);

      expect(grid.cells.get('5,5')).toBeCloseTo(100 * TRAFFIC_DECAY_RATE);
    });

    it('removes cells that decay below 1', () => {
      const grid = createTrafficGrid();
      grid.cells.set('5,5', 0.5);

      decayTraffic(grid);

      expect(grid.cells.has('5,5')).toBe(false);
    });

    it('preserves cells above threshold after decay', () => {
      const grid = createTrafficGrid();
      grid.cells.set('5,5', 1000);

      decayTraffic(grid);

      expect(grid.cells.has('5,5')).toBe(true);
      expect(grid.cells.get('5,5')!).toBeGreaterThan(0);
    });
  });

  describe('extractDesirePaths', () => {
    it('returns no roads when traffic is below threshold', () => {
      const grid = createTrafficGrid();
      grid.cells.set('5,5', ROAD_THRESHOLDS.dirt - 1);

      const roads = extractDesirePaths(grid, new Set());
      expect(roads).toHaveLength(0);
    });

    it('returns dirt path at dirt threshold', () => {
      const grid = createTrafficGrid();
      grid.cells.set('5,5', ROAD_THRESHOLDS.dirt);

      const roads = extractDesirePaths(grid, new Set());
      expect(roads).toHaveLength(1);
      expect(roads[0]!.tier).toBe(1);
      expect(roads[0]!.gridX).toBe(5);
      expect(roads[0]!.gridY).toBe(5);
    });

    it('returns gravel at gravel threshold', () => {
      const grid = createTrafficGrid();
      grid.cells.set('5,5', ROAD_THRESHOLDS.gravel);

      const roads = extractDesirePaths(grid, new Set());
      expect(roads).toHaveLength(1);
      expect(roads[0]!.tier).toBe(2);
    });

    it('returns paved at paved threshold', () => {
      const grid = createTrafficGrid();
      grid.cells.set('5,5', ROAD_THRESHOLDS.paved);

      const roads = extractDesirePaths(grid, new Set());
      expect(roads).toHaveLength(1);
      expect(roads[0]!.tier).toBe(3);
    });

    it('skips occupied cells (buildings)', () => {
      const grid = createTrafficGrid();
      grid.cells.set('5,5', ROAD_THRESHOLDS.dirt + 10);

      const occupied = new Set(['5,5']);
      const roads = extractDesirePaths(grid, occupied);
      expect(roads).toHaveLength(0);
    });

    it('returns multiple roads from different cells', () => {
      const grid = createTrafficGrid();
      grid.cells.set('1,1', ROAD_THRESHOLDS.dirt);
      grid.cells.set('2,2', ROAD_THRESHOLDS.gravel);
      grid.cells.set('3,3', ROAD_THRESHOLDS.paved);

      const roads = extractDesirePaths(grid, new Set());
      expect(roads).toHaveLength(3);
      const tiers = roads.map((r) => r.tier).sort();
      expect(tiers).toEqual([1, 2, 3]);
    });
  });

  describe('full lifecycle', () => {
    it('forms a dirt path from repeated commutes', () => {
      const grid = createTrafficGrid();
      // 50 commutes along the same path should form dirt
      for (let i = 0; i < ROAD_THRESHOLDS.dirt; i++) {
        recordCommute(grid, 0, 5, 5, 5);
      }

      const roads = extractDesirePaths(grid, new Set());
      // Cells (1,5)...(5,5) should all be at least dirt paths
      expect(roads.length).toBeGreaterThanOrEqual(1);
      for (const road of roads) {
        expect(road.tier).toBeGreaterThanOrEqual(1);
      }
    });

    it('traffic decays over many ticks', () => {
      const grid = createTrafficGrid();
      grid.cells.set('5,5', 100);

      // Decay 1000 times
      for (let i = 0; i < 1000; i++) {
        decayTraffic(grid);
      }

      // Should be very small or removed
      const remaining = grid.cells.get('5,5') ?? 0;
      expect(remaining).toBeLessThan(1);
    });
  });

  describe('serialization', () => {
    it('round-trips through serialize/restore', () => {
      const grid = createTrafficGrid();
      grid.cells.set('1,1', 100);
      grid.cells.set('5,5', 200);

      const saved = serializeTrafficGrid(grid);
      const restored = restoreTrafficGrid(saved);

      expect(restored.cells.get('1,1')).toBe(100);
      expect(restored.cells.get('5,5')).toBe(200);
      expect(restored.cells.size).toBe(2);
    });
  });
});
