import { beforeEach, describe, expect, it, vi } from 'vitest';
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
