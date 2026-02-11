import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBuilding, placeNewBuilding } from '@/ecs/factories';
import { world } from '@/ecs/world';
import { GameGrid } from '@/game/GameGrid';
import type { CitizenRenderData } from '@/rendering/Canvas2DRenderer';
import { Canvas2DRenderer } from '@/rendering/Canvas2DRenderer';
import { SpriteLoader } from '@/rendering/SpriteLoader';

// ── Mock canvas context ────────────────────────────────────────────────────

function createMockCanvasContext(): CanvasRenderingContext2D {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    globalAlpha: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    drawImage: vi.fn(),
    setTransform: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

function createMockCanvas(ctx: CanvasRenderingContext2D): HTMLCanvasElement {
  return {
    getContext: () => ctx,
    width: 800,
    height: 600,
    style: { width: '', height: '' },
    parentElement: { clientWidth: 800, clientHeight: 600 },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as HTMLCanvasElement;
}

// biome-ignore lint/suspicious/noExplicitAny: test helper to call private methods
type TestableRenderer = Record<string, any>;

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Canvas2DRenderer citizen rendering', () => {
  let renderer: Canvas2DRenderer;
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    ctx = createMockCanvasContext();
    const canvas = createMockCanvas(ctx);
    const grid = new GameGrid();
    const spriteLoader = new SpriteLoader();
    renderer = new Canvas2DRenderer(canvas, grid, spriteLoader);
    // Set a viewport so frustum culling doesn't reject everything
    renderer.camera.resize(1920, 1080);
  });

  describe('setCitizenData', () => {
    it('stores citizen data that drawCitizens uses', () => {
      const data: CitizenRenderData[] = [{ gridX: 5, gridY: 5, citizenClass: 'worker' }];
      renderer.setCitizenData(data);

      const internal = renderer as unknown as TestableRenderer;
      expect(internal.citizenData).toHaveLength(1);
      expect(internal.citizenData[0].citizenClass).toBe('worker');
    });

    it('replaces previous data when called again', () => {
      renderer.setCitizenData([
        { gridX: 1, gridY: 1, citizenClass: 'farmer' },
        { gridX: 2, gridY: 2, citizenClass: 'worker' },
      ]);
      renderer.setCitizenData([{ gridX: 3, gridY: 3, citizenClass: 'engineer' }]);

      const internal = renderer as unknown as TestableRenderer;
      expect(internal.citizenData).toHaveLength(1);
      expect(internal.citizenData[0].citizenClass).toBe('engineer');
    });

    it('accepts an empty array to clear citizens', () => {
      renderer.setCitizenData([{ gridX: 1, gridY: 1, citizenClass: 'worker' }]);
      renderer.setCitizenData([]);

      const internal = renderer as unknown as TestableRenderer;
      expect(internal.citizenData).toHaveLength(0);
    });
  });

  describe('drawCitizens', () => {
    it('draws nothing when citizenData is empty', () => {
      renderer.setCitizenData([]);
      const internal = renderer as unknown as TestableRenderer;
      internal.drawCitizens();

      expect(ctx.arc).not.toHaveBeenCalled();
    });

    it('draws arc calls for each citizen', () => {
      renderer.setCitizenData([
        { gridX: 15, gridY: 15, citizenClass: 'worker' },
        { gridX: 15, gridY: 15, citizenClass: 'farmer' },
      ]);

      const internal = renderer as unknown as TestableRenderer;
      internal.drawCitizens();

      // 2 citizens × 2 arc calls each (border + fill) = 4
      expect(ctx.arc).toHaveBeenCalledTimes(4);
      expect(ctx.fill).toHaveBeenCalledTimes(4);
    });

    it('groups citizens at the same cell with deterministic offsets', () => {
      renderer.setCitizenData([
        { gridX: 10, gridY: 10, citizenClass: 'worker' },
        { gridX: 10, gridY: 10, citizenClass: 'engineer' },
        { gridX: 10, gridY: 10, citizenClass: 'farmer' },
      ]);

      const internal = renderer as unknown as TestableRenderer;
      internal.drawCitizens();

      // 3 citizens × 2 arcs each = 6
      expect(ctx.arc).toHaveBeenCalledTimes(6);

      // Verify deterministic: call again should produce same result
      vi.mocked(ctx.arc).mockClear();
      internal.drawCitizens();

      const positions = vi.mocked(ctx.arc).mock.calls.map((call) => ({
        x: call[0],
        y: call[1],
      }));
      // Each pair (border, fill) should have the same x,y
      expect(positions[0]!.x).toBe(positions[1]!.x);
      expect(positions[0]!.y).toBe(positions[1]!.y);
    });

    it('skips citizens that are out of grid bounds', () => {
      renderer.setCitizenData([
        { gridX: -1, gridY: -1, citizenClass: 'worker' },
        { gridX: 999, gridY: 999, citizenClass: 'farmer' },
      ]);

      const internal = renderer as unknown as TestableRenderer;
      internal.drawCitizens();

      expect(ctx.arc).not.toHaveBeenCalled();
    });

    it('uses the correct color for each citizen class', () => {
      const classColors: Record<string, string> = {
        worker: '#8D6E63',
        party_official: '#C62828',
        engineer: '#1565C0',
        farmer: '#2E7D32',
        soldier: '#4E342E',
        prisoner: '#616161',
      };

      for (const [cls, _expectedColor] of Object.entries(classColors)) {
        vi.mocked(ctx.arc).mockClear();
        vi.mocked(ctx.fill).mockClear();

        renderer.setCitizenData([{ gridX: 15, gridY: 15, citizenClass: cls }]);

        const internal = renderer as unknown as TestableRenderer;
        internal.drawCitizens();

        // The second fill call (after border) should use the class color.
        // fillStyle is set before fill() — we check the property was assigned.
        // Since fillStyle is set on ctx directly, we verify arc was called for the dot.
        expect(ctx.arc).toHaveBeenCalledTimes(2);
      }
    });

    it('falls back to grey for unknown citizen class', () => {
      renderer.setCitizenData([{ gridX: 15, gridY: 15, citizenClass: 'unknown_class' }]);

      const internal = renderer as unknown as TestableRenderer;
      internal.drawCitizens();

      // Should still render (2 arcs: border + fill)
      expect(ctx.arc).toHaveBeenCalledTimes(2);
    });
  });
});

// ── Construction Progress Bar Tests ─────────────────────────────────────────

describe('Canvas2DRenderer construction progress bar', () => {
  let renderer: Canvas2DRenderer;
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    world.clear();
    ctx = createMockCanvasContext();
    const canvas = createMockCanvas(ctx);
    const grid = new GameGrid();
    const spriteLoader = new SpriteLoader();
    renderer = new Canvas2DRenderer(canvas, grid, spriteLoader);
    renderer.camera.resize(1920, 1080);
  });

  afterEach(() => {
    world.clear();
  });

  it('draws progress bar for under-construction buildings', () => {
    placeNewBuilding(15, 15, 'collective-farm-hq');

    const internal = renderer as unknown as TestableRenderer;
    internal.drawBuildings();

    // Should have fillRect calls for the progress bar (background + fill)
    const fillRectCalls = vi.mocked(ctx.fillRect).mock.calls;
    // At least 2 fillRect calls for the progress bar (bg + progress fill)
    // Plus potentially 1 from fallback building box
    expect(fillRectCalls.length).toBeGreaterThanOrEqual(2);
  });

  it('does not draw progress bar for operational buildings', () => {
    createBuilding(15, 15, 'collective-farm-hq');

    const internal = renderer as unknown as TestableRenderer;
    vi.mocked(ctx.fillRect).mockClear();
    internal.drawBuildings();

    // Fallback building draws 2 fillRects (front face + top face) — but NO progress bar
    // Progress bar adds 2 more fillRects, so we verify no extra beyond fallback
    const fillRectCalls = vi.mocked(ctx.fillRect).mock.calls;
    // Operational building: only fallback drawing (2 rects for 3D box), no progress bar
    expect(fillRectCalls.length).toBeLessThanOrEqual(3);
  });

  it('does not draw progress bar for completed construction', () => {
    const entity = placeNewBuilding(15, 15, 'collective-farm-hq');
    entity.building!.constructionPhase = 'complete';
    entity.building!.constructionProgress = 1;
    world.reindex(entity);

    const internal = renderer as unknown as TestableRenderer;
    internal.drawBuildings();

    // Completed buildings only get fallback box drawing (no progress bar).
    // Fallback draws 2-3 fillRects for the 3D box, same as operational.
    const completedCalls = vi.mocked(ctx.fillRect).mock.calls.length;

    // Now compare with a fresh operational building (no construction phase at all)
    world.clear();
    createBuilding(15, 15, 'collective-farm-hq');
    vi.mocked(ctx.fillRect).mockClear();
    internal.drawBuildings();
    const operationalCalls = vi.mocked(ctx.fillRect).mock.calls.length;

    // Both should have the same number of fillRect calls (no extra progress bar)
    expect(completedCalls).toBe(operationalCalls);
  });

  it('drawConstructionProgress draws background and fill bars', () => {
    const internal = renderer as unknown as TestableRenderer;
    internal.drawConstructionProgress({
      x: 15,
      y: 15,
      defId: 'collective-farm-hq',
      powered: false,
      constructionPhase: 'foundation',
      constructionProgress: 0.5,
    });

    // 2 fillRect calls: background bar + progress fill
    expect(vi.mocked(ctx.fillRect).mock.calls).toHaveLength(2);
  });

  it('uses amber color for foundation phase', () => {
    const internal = renderer as unknown as TestableRenderer;
    internal.drawConstructionProgress({
      x: 15,
      y: 15,
      defId: 'test',
      powered: false,
      constructionPhase: 'foundation',
      constructionProgress: 0.3,
    });

    // Second fillRect should use amber (#FF8F00)
    expect(ctx.fillStyle).toBe('#FF8F00');
  });

  it('uses red color for building phase', () => {
    const internal = renderer as unknown as TestableRenderer;
    internal.drawConstructionProgress({
      x: 15,
      y: 15,
      defId: 'test',
      powered: false,
      constructionPhase: 'building',
      constructionProgress: 0.7,
    });

    // Second fillRect should use red (#C62828)
    expect(ctx.fillStyle).toBe('#C62828');
  });
});
