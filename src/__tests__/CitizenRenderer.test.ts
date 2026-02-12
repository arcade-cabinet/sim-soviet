import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBuilding, placeNewBuilding } from '@/ecs/factories';
import { world } from '@/ecs/world';
import { GameGrid } from '@/game/GameGrid';
import type { CitizenRenderData } from '@/rendering/Canvas2DRenderer';
import { Canvas2DRenderer } from '@/rendering/Canvas2DRenderer';
import { CharacterSpriteLoader } from '@/rendering/CharacterSpriteLoader';
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
  let mockCharLoader: CharacterSpriteLoader;

  beforeEach(() => {
    ctx = createMockCanvasContext();
    const canvas = createMockCanvas(ctx);
    const grid = new GameGrid();
    const spriteLoader = new SpriteLoader();
    renderer = new Canvas2DRenderer(canvas, grid, spriteLoader);

    // Create and attach a mock character loader
    mockCharLoader = new CharacterSpriteLoader();
    renderer.setCharacterSprites(mockCharLoader);

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
    it('renders citizens when sprites are loaded', () => {
      // Mock sprite loader to return a valid sprite
      vi.spyOn(mockCharLoader, 'get').mockReturnValue({
        image: new Image(),
        sx: 0, sy: 0, sw: 128, sh: 128
      });
      // Mock sprite loader ready state
      Object.defineProperty(mockCharLoader, 'ready', { value: true, configurable: true });

      renderer.setCitizenData([
        { gridX: 15, gridY: 15, citizenClass: 'worker' },
      ]);

      const internal = renderer as unknown as TestableRenderer;
      internal.drawCitizens();

      // Should call drawImage for sprite
      expect(ctx.drawImage).toHaveBeenCalled();
    });

    it('does NOT render citizens when sprites are missing (no fallback)', () => {
      // Mock sprite loader to return undefined (missing sprite)
      vi.spyOn(mockCharLoader, 'get').mockReturnValue(undefined);
      // Mock sprite loader ready state
      Object.defineProperty(mockCharLoader, 'ready', { value: true, configurable: true });

      renderer.setCitizenData([
        { gridX: 15, gridY: 15, citizenClass: 'worker' },
      ]);

      const internal = renderer as unknown as TestableRenderer;
      internal.drawCitizens();

      // Should NOT call arc (fallback dots removed)
      expect(ctx.arc).not.toHaveBeenCalled();
      // Should NOT call drawImage (no sprite)
      expect(ctx.drawImage).not.toHaveBeenCalled();
    });

    it('skips citizens that are out of grid bounds', () => {
      renderer.setCitizenData([
        { gridX: -1, gridY: -1, citizenClass: 'worker' },
        { gridX: 999, gridY: 999, citizenClass: 'farmer' },
      ]);

      const internal = renderer as unknown as TestableRenderer;
      internal.drawCitizens();

      expect(ctx.arc).not.toHaveBeenCalled();
      expect(ctx.drawImage).not.toHaveBeenCalled();
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
