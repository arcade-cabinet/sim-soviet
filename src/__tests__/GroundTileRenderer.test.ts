import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MapSystem, TerrainCell, TerrainType } from '@/game/map';
import { gridToScreen, TILE_HEIGHT, TILE_WIDTH } from '@/rendering/GridMath';
import { GroundTileRenderer, TERRAIN_SPRITE_MAP } from '@/rendering/GroundTileRenderer';

// ── Mock helpers ────────────────────────────────────────────────────────────

/** Create a minimal MapSystem mock that returns a grid of the given size. */
function createMockMapSystem(
  size: number,
  cellOverrides?: Map<string, Partial<TerrainCell>>
): MapSystem {
  return {
    getSize: () => size,
    getCell: (x: number, y: number) => {
      if (x < 0 || x >= size || y < 0 || y >= size) return null;
      const key = `${x},${y}`;
      const overrides = cellOverrides?.get(key);
      return {
        type: 'grass' as TerrainType,
        elevation: 1,
        features: [],
        buildable: true,
        movementCost: 1,
        ...overrides,
      };
    },
  } as unknown as MapSystem;
}

// biome-ignore lint/suspicious/noExplicitAny: test helper to access private internals
type TestableRenderer = Record<string, any>;

// ── Tests ───────────────────────────────────────────────────────────────────

describe('GroundTileRenderer', () => {
  let renderer: GroundTileRenderer;

  beforeEach(() => {
    renderer = new GroundTileRenderer();
  });

  describe('dirty flag', () => {
    it('starts dirty', () => {
      // Access the private dirty flag for testing
      expect((renderer as unknown as TestableRenderer).dirty).toBe(true);
    });

    it('is set when setMapSystem is called', () => {
      // Clear the dirty flag first
      (renderer as unknown as TestableRenderer).dirty = false;

      const map = createMockMapSystem(5);
      renderer.setMapSystem(map);

      expect((renderer as unknown as TestableRenderer).dirty).toBe(true);
    });

    it('is set when setSeason changes the season', () => {
      // Start with a known season
      renderer.setSeason('summer');
      (renderer as unknown as TestableRenderer).dirty = false;

      renderer.setSeason('winter');
      expect((renderer as unknown as TestableRenderer).dirty).toBe(true);
    });

    it('is NOT set when setSeason is called with the same season', () => {
      renderer.setSeason('summer');
      (renderer as unknown as TestableRenderer).dirty = false;

      renderer.setSeason('summer');
      expect((renderer as unknown as TestableRenderer).dirty).toBe(false);
    });
  });

  describe('TerrainType -> base tile sprite mapping', () => {
    const ALL_TERRAIN_TYPES: TerrainType[] = [
      'grass',
      'forest',
      'marsh',
      'mountain',
      'river',
      'road',
      'foundation',
      'water',
    ];

    it('maps every TerrainType to a base tile sprite name', () => {
      // The BASE_TILE_MAP is private — we verify indirectly via getTerrainSpriteNames
      // and by checking the class handles all types without errors.
      // We can verify the mapping is complete by checking it's a Record<TerrainType, string>.
      // Access the private constant via module scope is not possible, so test through behavior.
      const cellOverrides = new Map<string, Partial<TerrainCell>>();
      let idx = 0;
      for (const type of ALL_TERRAIN_TYPES) {
        const x = idx % 10;
        const y = Math.floor(idx / 10);
        cellOverrides.set(`${x},${y}`, { type });
        idx++;
      }

      const map = createMockMapSystem(10, cellOverrides);
      renderer.setMapSystem(map);

      // draw() should not throw even with all terrain types present
      const ctx = createMockContext();
      const camera = createMockCamera();
      expect(() => renderer.draw(ctx, camera)).not.toThrow();
    });

    it('maps grass and forest to the same base sprite (grass)', () => {
      // Both grass and forest use 'grass.png' as the ground tile.
      // We verify this by checking neither produces a feature sprite for the ground.
      // The TERRAIN_SPRITE_MAP (for features) should NOT have 'grass' but SHOULD have 'forest'.
      expect(TERRAIN_SPRITE_MAP.grass).toBeUndefined();
      expect(TERRAIN_SPRITE_MAP.forest).toBe('grass-forest');
    });
  });

  describe('TERRAIN_SPRITE_MAP export', () => {
    it('provides feature overlay mappings for non-base terrain types', () => {
      expect(TERRAIN_SPRITE_MAP.forest).toBe('grass-forest');
      expect(TERRAIN_SPRITE_MAP.mountain).toBe('stone-mountain');
      expect(TERRAIN_SPRITE_MAP.river).toBe('water');
      expect(TERRAIN_SPRITE_MAP.marsh).toBe('grass-hill');
      expect(TERRAIN_SPRITE_MAP.road).toBe('path-straight');
      expect(TERRAIN_SPRITE_MAP.water).toBe('water');
    });
  });

  describe('offscreen canvas creation', () => {
    it('creates offscreen canvas with correct dimensions for a small grid', () => {
      const gridSize = 5;
      const map = createMockMapSystem(gridSize);
      renderer.setMapSystem(map);

      // Trigger cache rebuild via draw()
      const ctx = createMockContext();
      const camera = createMockCamera();
      renderer.draw(ctx, camera);

      // Verify offscreen was created
      const offscreen = (renderer as unknown as TestableRenderer).offscreen;
      expect(offscreen).not.toBeNull();

      // Verify dimensions are reasonable (should cover the grid bounding box + padding)
      const topLeft = gridToScreen(0, 0);
      const topRight = gridToScreen(gridSize - 1, 0);
      const bottomRight = gridToScreen(gridSize - 1, gridSize - 1);
      const bottomLeft = gridToScreen(0, gridSize - 1);

      const minX = bottomLeft.x - TILE_WIDTH / 2;
      const maxX = topRight.x + TILE_WIDTH / 2;
      const minY = topLeft.y;
      const maxY = bottomRight.y + TILE_HEIGHT;

      const expectedWidth = Math.ceil(maxX - minX + TILE_WIDTH * 2);
      const expectedHeight = Math.ceil(maxY - minY + TILE_HEIGHT * 4);

      expect(offscreen.width).toBe(expectedWidth);
      expect(offscreen.height).toBe(expectedHeight);
    });

    it('creates offscreen canvas for default GRID_SIZE=30', () => {
      const map = createMockMapSystem(30);
      renderer.setMapSystem(map);

      const ctx = createMockContext();
      const camera = createMockCamera();
      renderer.draw(ctx, camera);

      const offscreen = (renderer as unknown as TestableRenderer).offscreen;
      expect(offscreen).not.toBeNull();
      // For 30x30 grid: width should be ~2400+padding, height ~1200+padding
      expect(offscreen.width).toBeGreaterThan(2000);
      expect(offscreen.height).toBeGreaterThan(1000);
    });
  });

  describe('draw()', () => {
    it('does nothing when no MapSystem is set', () => {
      const ctx = createMockContext();
      const camera = createMockCamera();

      renderer.draw(ctx, camera);

      expect(ctx.drawImage).not.toHaveBeenCalled();
    });

    it('calls drawImage on the main context to blit the offscreen cache', () => {
      const map = createMockMapSystem(5);
      renderer.setMapSystem(map);

      const ctx = createMockContext();
      const camera = createMockCamera();

      renderer.draw(ctx, camera);

      // Should blit the offscreen canvas to the main context
      expect(ctx.drawImage).toHaveBeenCalledTimes(1);
    });

    it('does not rebuild cache on subsequent draws when not dirty', () => {
      const map = createMockMapSystem(3);
      renderer.setMapSystem(map);

      const ctx = createMockContext();
      const camera = createMockCamera();

      // First draw triggers rebuild
      renderer.draw(ctx, camera);
      expect((renderer as unknown as TestableRenderer).dirty).toBe(false);

      // Second draw should still call drawImage but not rebuild
      const offscreenBefore = (renderer as unknown as TestableRenderer).offscreen;
      renderer.draw(ctx, camera);
      const offscreenAfter = (renderer as unknown as TestableRenderer).offscreen;

      // Same offscreen object reused
      expect(offscreenAfter).toBe(offscreenBefore);
    });
  });

  describe('getTerrainSpriteNames()', () => {
    it('returns empty array when no MapSystem is set', () => {
      expect(renderer.getTerrainSpriteNames()).toEqual([]);
    });

    it('returns unique feature sprite names for the map', () => {
      const cellOverrides = new Map<string, Partial<TerrainCell>>();
      cellOverrides.set('0,0', { type: 'forest' });
      cellOverrides.set('1,0', { type: 'forest' });
      cellOverrides.set('0,1', { type: 'mountain' });
      cellOverrides.set('1,1', { type: 'river' });

      const map = createMockMapSystem(3, cellOverrides);
      renderer.setMapSystem(map);

      const names = renderer.getTerrainSpriteNames();
      expect(names).toContain('grass-forest');
      expect(names).toContain('stone-mountain');
      expect(names).toContain('water');
      // No duplicates
      expect(new Set(names).size).toBe(names.length);
    });

    it('does not include grass (no feature overlay for plain grass)', () => {
      const map = createMockMapSystem(3); // all grass by default
      renderer.setMapSystem(map);

      const names = renderer.getTerrainSpriteNames();
      expect(names).toEqual([]);
    });
  });

  describe('season changes', () => {
    it('clears anchors when season changes', () => {
      renderer.setSeason('summer');
      // Manually set some anchors
      (renderer as unknown as TestableRenderer).anchors.set('grass', { anchorX: 77, anchorY: 58 });

      renderer.setSeason('winter');
      expect((renderer as unknown as TestableRenderer).anchors.size).toBe(0);
    });
  });
});

// ── Test utilities ──────────────────────────────────────────────────────────

function createMockContext(): CanvasRenderingContext2D {
  return {
    drawImage: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: '',
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    setTransform: vi.fn(),
    canvas: { width: 800, height: 600 },
  } as unknown as CanvasRenderingContext2D;
}

function createMockCamera() {
  return {
    viewportWidth: 800,
    viewportHeight: 600,
    worldToScreen: (x: number, y: number) => ({ x, y }),
    zoom: 1,
    x: 0,
    y: 0,
  } as unknown as import('@/rendering/Camera2D').Camera2D;
}
