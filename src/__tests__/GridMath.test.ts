import { describe, expect, it } from 'vitest';
import {
  depthKey,
  drawDiamond,
  GRID_SIZE,
  gridToScreen,
  isInBounds,
  screenToGrid,
  TILE_HEIGHT,
  TILE_WIDTH,
} from '@/rendering/GridMath';

// ── Constants ──────────────────────────────────────────────────────────────────

describe('GridMath constants', () => {
  it('TILE_WIDTH is 80 (2:1 dimetric, matches PPU)', () => {
    expect(TILE_WIDTH).toBe(80);
  });

  it('TILE_HEIGHT is 40 (half of TILE_WIDTH for 2:1 projection)', () => {
    expect(TILE_HEIGHT).toBe(40);
  });

  it('TILE_WIDTH / TILE_HEIGHT ratio is exactly 2:1', () => {
    expect(TILE_WIDTH / TILE_HEIGHT).toBe(2);
  });

  it('GRID_SIZE is 30', () => {
    expect(GRID_SIZE).toBe(30);
  });
});

// ── gridToScreen ───────────────────────────────────────────────────────────────

describe('gridToScreen', () => {
  it('maps origin (0, 0) to screen (0, 0)', () => {
    const s = gridToScreen(0, 0);
    expect(s.x).toBe(0);
    expect(s.y).toBe(0);
  });

  it('maps (1, 0) correctly — one step right on the grid', () => {
    const s = gridToScreen(1, 0);
    // screenX = (1 - 0) * 40 = 40
    // screenY = (1 + 0) * 20 = 20
    expect(s.x).toBe(TILE_WIDTH / 2);
    expect(s.y).toBe(TILE_HEIGHT / 2);
  });

  it('maps (0, 1) correctly — one step down on the grid', () => {
    const s = gridToScreen(0, 1);
    // screenX = (0 - 1) * 40 = -40
    // screenY = (0 + 1) * 20 = 20
    expect(s.x).toBe(-TILE_WIDTH / 2);
    expect(s.y).toBe(TILE_HEIGHT / 2);
  });

  it('maps (1, 1) — diagonal on the grid goes straight down on screen', () => {
    const s = gridToScreen(1, 1);
    // screenX = (1 - 1) * 40 = 0
    // screenY = (1 + 1) * 20 = 40
    expect(s.x).toBe(0);
    expect(s.y).toBe(TILE_HEIGHT);
  });

  it('maps negative grid coordinates', () => {
    const s = gridToScreen(-1, -1);
    expect(s.x).toBe(0);
    expect(s.y).toBe(-TILE_HEIGHT);
  });

  it('maps mixed positive/negative coordinates', () => {
    const s = gridToScreen(-2, 3);
    // screenX = (-2 - 3) * 40 = -200
    // screenY = (-2 + 3) * 20 = 20
    expect(s.x).toBe(-200);
    expect(s.y).toBe(20);
  });

  it('maps large coordinates without precision loss', () => {
    const s = gridToScreen(1000, 1000);
    expect(s.x).toBe(0);
    expect(s.y).toBe(1000 * TILE_HEIGHT);
  });

  it('maps fractional grid coordinates', () => {
    const s = gridToScreen(0.5, 0.5);
    // screenX = (0.5 - 0.5) * 40 = 0
    // screenY = (0.5 + 0.5) * 20 = 20
    expect(s.x).toBe(0);
    expect(s.y).toBe(TILE_HEIGHT / 2);
  });

  it('maps far corner of grid (GRID_SIZE-1, GRID_SIZE-1)', () => {
    const g = GRID_SIZE - 1;
    const s = gridToScreen(g, g);
    expect(s.x).toBe(0);
    expect(s.y).toBe(g * 2 * (TILE_HEIGHT / 2));
  });

  it('handles asymmetric grid position', () => {
    const s = gridToScreen(5, 3);
    // screenX = (5 - 3) * 40 = 80
    // screenY = (5 + 3) * 20 = 160
    expect(s.x).toBe(80);
    expect(s.y).toBe(160);
  });
});

// ── screenToGrid ───────────────────────────────────────────────────────────────

describe('screenToGrid', () => {
  it('maps screen origin (0, 0) to grid (0, 0)', () => {
    const g = screenToGrid(0, 0);
    expect(g.x).toBe(0);
    expect(g.y).toBe(0);
  });

  it('maps screen point back to (1, 0)', () => {
    const g = screenToGrid(TILE_WIDTH / 2, TILE_HEIGHT / 2);
    expect(g.x).toBeCloseTo(1, 10);
    expect(g.y).toBeCloseTo(0, 10);
  });

  it('maps screen point back to (0, 1)', () => {
    const g = screenToGrid(-TILE_WIDTH / 2, TILE_HEIGHT / 2);
    expect(g.x).toBeCloseTo(0, 10);
    expect(g.y).toBeCloseTo(1, 10);
  });

  it('returns fractional coordinates (caller floors for cell selection)', () => {
    // Point at exact middle of tile (0,0) diamond should give (0.5, 0.5) approximately
    // Tile (0,0) diamond top is at (0,0), mid-height is at (0, TILE_HEIGHT/2)
    const g = screenToGrid(0, TILE_HEIGHT / 2);
    // diff = 0 / 40 = 0, sum = 20 / 20 = 1
    // x = (1 + 0) / 2 = 0.5, y = (1 - 0) / 2 = 0.5
    expect(g.x).toBeCloseTo(0.5, 10);
    expect(g.y).toBeCloseTo(0.5, 10);
  });

  it('maps negative screen coordinates to negative grid coords', () => {
    const g = screenToGrid(0, -TILE_HEIGHT);
    // diff = 0, sum = -40 / 20 = -2
    // x = (-2 + 0) / 2 = -1, y = (-2 - 0) / 2 = -1
    expect(g.x).toBeCloseTo(-1, 10);
    expect(g.y).toBeCloseTo(-1, 10);
  });

  it('handles large screen coordinates', () => {
    const s = gridToScreen(500, 300);
    const g = screenToGrid(s.x, s.y);
    expect(g.x).toBeCloseTo(500, 10);
    expect(g.y).toBeCloseTo(300, 10);
  });
});

// ── Round-trip: gridToScreen → screenToGrid ────────────────────────────────────

describe('gridToScreen → screenToGrid round-trip', () => {
  it('round-trips origin (0, 0)', () => {
    const s = gridToScreen(0, 0);
    const g = screenToGrid(s.x, s.y);
    expect(g.x).toBeCloseTo(0, 10);
    expect(g.y).toBeCloseTo(0, 10);
  });

  it('round-trips (1, 0)', () => {
    const s = gridToScreen(1, 0);
    const g = screenToGrid(s.x, s.y);
    expect(g.x).toBeCloseTo(1, 10);
    expect(g.y).toBeCloseTo(0, 10);
  });

  it('round-trips (0, 1)', () => {
    const s = gridToScreen(0, 1);
    const g = screenToGrid(s.x, s.y);
    expect(g.x).toBeCloseTo(0, 10);
    expect(g.y).toBeCloseTo(1, 10);
  });

  it('round-trips positive integer coordinates', () => {
    for (let gx = 0; gx < 5; gx++) {
      for (let gy = 0; gy < 5; gy++) {
        const s = gridToScreen(gx, gy);
        const g = screenToGrid(s.x, s.y);
        expect(g.x).toBeCloseTo(gx, 10);
        expect(g.y).toBeCloseTo(gy, 10);
      }
    }
  });

  it('round-trips negative coordinates', () => {
    const coords = [
      [-1, -1],
      [-5, -3],
      [-10, 0],
      [0, -10],
    ] as const;
    for (const [gx, gy] of coords) {
      const s = gridToScreen(gx, gy);
      const g = screenToGrid(s.x, s.y);
      expect(g.x).toBeCloseTo(gx, 10);
      expect(g.y).toBeCloseTo(gy, 10);
    }
  });

  it('round-trips mixed positive/negative coordinates', () => {
    const s = gridToScreen(-3, 7);
    const g = screenToGrid(s.x, s.y);
    expect(g.x).toBeCloseTo(-3, 10);
    expect(g.y).toBeCloseTo(7, 10);
  });

  it('round-trips large coordinates', () => {
    const s = gridToScreen(999, 888);
    const g = screenToGrid(s.x, s.y);
    expect(g.x).toBeCloseTo(999, 8);
    expect(g.y).toBeCloseTo(888, 8);
  });

  it('round-trips fractional grid coordinates', () => {
    const s = gridToScreen(2.75, 1.25);
    const g = screenToGrid(s.x, s.y);
    expect(g.x).toBeCloseTo(2.75, 10);
    expect(g.y).toBeCloseTo(1.25, 10);
  });

  it('round-trips all four corners of the grid', () => {
    const corners = [
      [0, 0],
      [GRID_SIZE - 1, 0],
      [0, GRID_SIZE - 1],
      [GRID_SIZE - 1, GRID_SIZE - 1],
    ] as const;
    for (const [gx, gy] of corners) {
      const s = gridToScreen(gx, gy);
      const g = screenToGrid(s.x, s.y);
      expect(g.x).toBeCloseTo(gx, 10);
      expect(g.y).toBeCloseTo(gy, 10);
    }
  });

  it('round-trips tile boundary midpoints', () => {
    // The midpoint between (0,0) and (1,0) at grid (0.5, 0)
    const s = gridToScreen(0.5, 0);
    const g = screenToGrid(s.x, s.y);
    expect(g.x).toBeCloseTo(0.5, 10);
    expect(g.y).toBeCloseTo(0, 10);
  });
});

// ── screenToGrid sub-pixel accuracy ────────────────────────────────────────────

describe('screenToGrid sub-pixel accuracy', () => {
  it('resolves a 1-pixel offset from tile center', () => {
    const s = gridToScreen(5, 5);
    const g = screenToGrid(s.x + 1, s.y);
    // Adding 1px in screen X should shift grid x and y by small fractional amounts
    expect(g.x).toBeGreaterThan(5);
    expect(g.y).toBeLessThan(5);
    // 1px screen offset should produce a grid offset of 1/(TILE_WIDTH/2) = 1/40
    const expectedDiff = 1 / TILE_WIDTH; // 0.0125
    expect(g.x - 5).toBeCloseTo(expectedDiff, 10);
    expect(5 - g.y).toBeCloseTo(expectedDiff, 10);
  });

  it('resolves a 1-pixel Y offset from tile center', () => {
    const s = gridToScreen(5, 5);
    const g = screenToGrid(s.x, s.y + 1);
    // Adding 1px in screen Y should shift both grid x and y up
    const expectedDiff = 1 / TILE_HEIGHT; // 0.025
    expect(g.x - 5).toBeCloseTo(expectedDiff, 10);
    expect(g.y - 5).toBeCloseTo(expectedDiff, 10);
  });

  it('correctly identifies cell when floored (top-left quadrant of diamond)', () => {
    // A screen point slightly to the left of tile (3, 2) top should floor to nearby cell
    const s = gridToScreen(3, 2);
    // offset a tiny bit — should still floor to the same cell
    const g = screenToGrid(s.x + 0.1, s.y + 0.1);
    expect(Math.floor(g.x)).toBe(3);
    expect(Math.floor(g.y)).toBe(2);
  });

  it('flooring just below a tile boundary changes cell', () => {
    // Exactly at grid (3, 2) → screen, then offset by nearly one tile
    const s = gridToScreen(3, 2);
    // Move one full tile in screen X (TILE_WIDTH/2 = 40px) → shifts gridX by +1, gridY by -1
    const g = screenToGrid(s.x + TILE_WIDTH / 2, s.y + TILE_HEIGHT / 2);
    expect(Math.floor(g.x)).toBe(4);
    expect(Math.floor(g.y)).toBe(2);
  });
});

// ── isInBounds ─────────────────────────────────────────────────────────────────

describe('isInBounds', () => {
  it('origin (0, 0) is in bounds', () => {
    expect(isInBounds(0, 0)).toBe(true);
  });

  it('far corner (GRID_SIZE-1, GRID_SIZE-1) is in bounds', () => {
    expect(isInBounds(GRID_SIZE - 1, GRID_SIZE - 1)).toBe(true);
  });

  it('(GRID_SIZE, 0) is out of bounds (exclusive upper limit)', () => {
    expect(isInBounds(GRID_SIZE, 0)).toBe(false);
  });

  it('(0, GRID_SIZE) is out of bounds', () => {
    expect(isInBounds(0, GRID_SIZE)).toBe(false);
  });

  it('(-1, 0) is out of bounds', () => {
    expect(isInBounds(-1, 0)).toBe(false);
  });

  it('(0, -1) is out of bounds', () => {
    expect(isInBounds(0, -1)).toBe(false);
  });

  it('(-1, -1) is out of bounds', () => {
    expect(isInBounds(-1, -1)).toBe(false);
  });

  it('all four edges are valid', () => {
    expect(isInBounds(0, 15)).toBe(true);
    expect(isInBounds(15, 0)).toBe(true);
    expect(isInBounds(GRID_SIZE - 1, 15)).toBe(true);
    expect(isInBounds(15, GRID_SIZE - 1)).toBe(true);
  });

  it('center of grid is in bounds', () => {
    expect(isInBounds(Math.floor(GRID_SIZE / 2), Math.floor(GRID_SIZE / 2))).toBe(true);
  });

  it('large positive coordinates are out of bounds', () => {
    expect(isInBounds(100, 100)).toBe(false);
  });

  it('large negative coordinates are out of bounds', () => {
    expect(isInBounds(-100, -100)).toBe(false);
  });
});

// ── depthKey ───────────────────────────────────────────────────────────────────

describe('depthKey', () => {
  it('origin has depth 0', () => {
    expect(depthKey(0, 0)).toBe(0);
  });

  it('depth increases along both axes', () => {
    expect(depthKey(1, 0)).toBe(1);
    expect(depthKey(0, 1)).toBe(1);
    expect(depthKey(1, 1)).toBe(2);
  });

  it('tiles on the same isometric row have equal depth', () => {
    // Same screenY row: gridX + gridY = constant
    expect(depthKey(3, 2)).toBe(depthKey(2, 3));
    expect(depthKey(5, 0)).toBe(depthKey(0, 5));
    expect(depthKey(4, 1)).toBe(depthKey(1, 4));
  });

  it('tiles closer to camera (lower gridX+gridY) draw first', () => {
    expect(depthKey(0, 0)).toBeLessThan(depthKey(1, 0));
    expect(depthKey(0, 0)).toBeLessThan(depthKey(0, 1));
    expect(depthKey(2, 3)).toBeLessThan(depthKey(3, 3));
  });

  it('handles negative coordinates', () => {
    expect(depthKey(-1, -1)).toBe(-2);
    expect(depthKey(-1, 0)).toBe(-1);
  });

  it('far corner has maximum depth for the grid', () => {
    const maxDepth = depthKey(GRID_SIZE - 1, GRID_SIZE - 1);
    expect(maxDepth).toBe(2 * (GRID_SIZE - 1));
    // Verify all other in-bounds tiles have lower or equal depth
    expect(depthKey(0, 0)).toBeLessThan(maxDepth);
  });
});

// ── drawDiamond ────────────────────────────────────────────────────────────────

describe('drawDiamond', () => {
  // Create a minimal mock canvas context
  function createMockCtx() {
    const calls: { method: string; args: number[] }[] = [];
    return {
      calls,
      beginPath: () => calls.push({ method: 'beginPath', args: [] }),
      moveTo: (x: number, y: number) => calls.push({ method: 'moveTo', args: [x, y] }),
      lineTo: (x: number, y: number) => calls.push({ method: 'lineTo', args: [x, y] }),
      closePath: () => calls.push({ method: 'closePath', args: [] }),
    } as unknown as CanvasRenderingContext2D & { calls: typeof calls };
  }

  it('draws a diamond with default tile size at origin', () => {
    const ctx = createMockCtx();
    drawDiamond(ctx, 0, 0);
    expect(ctx.calls).toEqual([
      { method: 'beginPath', args: [] },
      { method: 'moveTo', args: [0, 0] }, // top
      { method: 'lineTo', args: [40, 20] }, // right
      { method: 'lineTo', args: [0, 40] }, // bottom
      { method: 'lineTo', args: [-40, 20] }, // left
      { method: 'closePath', args: [] },
    ]);
  });

  it('draws a diamond at an offset position', () => {
    const ctx = createMockCtx();
    drawDiamond(ctx, 100, 50);
    expect(ctx.calls).toEqual([
      { method: 'beginPath', args: [] },
      { method: 'moveTo', args: [100, 50] },
      { method: 'lineTo', args: [140, 70] },
      { method: 'lineTo', args: [100, 90] },
      { method: 'lineTo', args: [60, 70] },
      { method: 'closePath', args: [] },
    ]);
  });

  it('draws a diamond with custom width and height', () => {
    const ctx = createMockCtx();
    drawDiamond(ctx, 0, 0, 160, 80);
    expect(ctx.calls).toEqual([
      { method: 'beginPath', args: [] },
      { method: 'moveTo', args: [0, 0] },
      { method: 'lineTo', args: [80, 40] },
      { method: 'lineTo', args: [0, 80] },
      { method: 'lineTo', args: [-80, 40] },
      { method: 'closePath', args: [] },
    ]);
  });

  it('draws four path segments (move + 3 lines + close)', () => {
    const ctx = createMockCtx();
    drawDiamond(ctx, 0, 0);
    const methods = ctx.calls.map((c) => c.method);
    expect(methods).toEqual(['beginPath', 'moveTo', 'lineTo', 'lineTo', 'lineTo', 'closePath']);
  });
});

// ── Projection geometry properties ─────────────────────────────────────────────

describe('projection geometry properties', () => {
  it('adjacent tiles along grid X axis have consistent screen offset', () => {
    const s0 = gridToScreen(0, 0);
    const s1 = gridToScreen(1, 0);
    const s2 = gridToScreen(2, 0);
    // Offset (1,0) → (2,0) should equal (0,0) → (1,0)
    expect(s2.x - s1.x).toBe(s1.x - s0.x);
    expect(s2.y - s1.y).toBe(s1.y - s0.y);
  });

  it('adjacent tiles along grid Y axis have consistent screen offset', () => {
    const s0 = gridToScreen(0, 0);
    const s1 = gridToScreen(0, 1);
    const s2 = gridToScreen(0, 2);
    expect(s2.x - s1.x).toBe(s1.x - s0.x);
    expect(s2.y - s1.y).toBe(s1.y - s0.y);
  });

  it('grid X axis maps to positive screen X and positive screen Y', () => {
    const s = gridToScreen(1, 0);
    expect(s.x).toBeGreaterThan(0);
    expect(s.y).toBeGreaterThan(0);
  });

  it('grid Y axis maps to negative screen X and positive screen Y', () => {
    const s = gridToScreen(0, 1);
    expect(s.x).toBeLessThan(0);
    expect(s.y).toBeGreaterThan(0);
  });

  it('diagonal (equal gridX, gridY) maps to screenX = 0', () => {
    for (let i = 0; i <= 10; i++) {
      expect(gridToScreen(i, i).x).toBe(0);
    }
  });
});
