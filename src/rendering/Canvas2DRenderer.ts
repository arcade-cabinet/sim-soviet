/**
 * Canvas2DRenderer — Main rendering orchestrator for the isometric game view.
 *
 * Rendering layers (back-to-front):
 *   0. Ground fill (solid color per season)
 *   1. Grid diamonds (semi-transparent, shown during placement)
 *   2. Building sprites (sorted by depth key = gridX + gridY)
 *   3. Placement preview (green/red ghost)
 *   4. Weather particles (screen-space, added later)
 */

import { getBuildingDef } from '@/data/buildingDefs';
import { buildingsLogic } from '@/ecs/archetypes';
import type { GameGrid } from '@/game/GameGrid';
import type { Building } from '@/game/GameView';
import type { MapSystem } from '@/game/map';
import type { PoliticalEntityStats, PoliticalRole } from '@/game/political';
import { Camera2D } from './Camera2D';
import { FeatureTileRenderer } from './FeatureTileRenderer';
import {
  depthKey,
  drawDiamond,
  GRID_SIZE,
  gridToScreen,
  isInBounds,
  screenToGrid,
  TILE_HEIGHT,
  TILE_WIDTH,
} from './GridMath';
import { GroundTileRenderer } from './GroundTileRenderer';
import { ParticleSystem2D } from './ParticleSystem2D';
import type { SpriteInfo, SpriteLoader } from './SpriteLoader';

export interface PlacementPreview {
  gridX: number;
  gridY: number;
  spriteName: string;
  valid: boolean;
  footprintW: number;
  footprintH: number;
}

export class Canvas2DRenderer {
  public camera: Camera2D;
  public particles: ParticleSystem2D;
  public featureTiles: FeatureTileRenderer;
  public groundTiles: GroundTileRenderer;
  private ctx: CanvasRenderingContext2D;
  private animFrameId = 0;
  private dayProgress = 0.5; // 0=midnight, 0.5=noon, 1=midnight

  /** Currently hovered grid cell (for highlight). */
  public hoverCell: { x: number; y: number } | null = null;

  /** Placement preview (drag-to-place ghost). */
  public placementPreview: PlacementPreview | null = null;

  /** Political entities to render as overlay icons. */
  private politicalEntities: PoliticalEntityStats[] = [];

  constructor(
    private canvas: HTMLCanvasElement,
    private grid: GameGrid,
    private spriteLoader: SpriteLoader
  ) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas2DRenderer: failed to get 2d context');
    this.ctx = ctx;
    this.camera = new Camera2D();
    this.particles = new ParticleSystem2D();
    this.featureTiles = new FeatureTileRenderer();
    this.groundTiles = new GroundTileRenderer();

    // Center camera on grid center
    const center = gridToScreen(GRID_SIZE / 2, GRID_SIZE / 2);
    this.camera.centerOn(center.x, center.y);
  }

  /** Set the season for terrain tile sprites. */
  setSeason(season: string): void {
    this.featureTiles.setSeason(season);
    this.groundTiles.setSeason(season);
  }

  /** Attach a MapSystem for terrain-aware ground rendering. */
  setMapSystem(map: MapSystem): void {
    this.groundTiles.setMapSystem(map);
  }

  /** Preload ground tile sprites (delegates to GroundTileRenderer). */
  async preloadGroundTiles(): Promise<void> {
    return this.groundTiles.preloadTiles();
  }

  /** Set day progress for day/night overlay. 0 = midnight, 0.5 = noon, 1 = midnight. */
  setDayProgress(progress: number): void {
    this.dayProgress = progress;
  }

  /** Update the list of political entities to render as overlay icons. */
  setPoliticalEntities(entities: PoliticalEntityStats[]): void {
    this.politicalEntities = entities;
  }

  /** Start the render loop. Idempotent — cancels any existing loop first. */
  start(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = 0;
    }
    this.resize();
    this.render();
  }

  /** Stop the render loop. */
  stop(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = 0;
    }
    this.particles.dispose();
  }

  /** Handle canvas resize. */
  resize(): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;

    const dpr = window.devicePixelRatio || 1;
    const width = parent.clientWidth;
    const height = parent.clientHeight;

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.camera.resize(width, height);
    this.particles.resize(width, height);

    // Auto-zoom so the grid fills the viewport (no black bars)
    this.fitCameraToGrid();
  }

  /**
   * Auto-zoom the camera so the 30x30 isometric grid fills the viewport.
   * Computes the grid diamond's world-space bounding box and delegates
   * to Camera2D.fitToWorld() which picks the larger of X/Y zoom ratios.
   */
  fitCameraToGrid(): void {
    const top = gridToScreen(0, 0);
    const right = gridToScreen(GRID_SIZE, 0);
    const bottom = gridToScreen(GRID_SIZE, GRID_SIZE);
    const left = gridToScreen(0, GRID_SIZE);

    const worldWidth = right.x - left.x;
    const worldHeight = bottom.y - top.y;

    this.camera.fitToWorld(worldWidth, worldHeight);
  }

  /** Main render frame. */
  private render = (): void => {
    this.animFrameId = requestAnimationFrame(this.render);

    const { ctx } = this;
    const { viewportWidth: vw, viewportHeight: vh } = this.camera;

    // Layer 0: Ground fill (void behind terrain tiles)
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, vw, vh);

    // Apply camera transform for world-space drawing
    this.camera.applyTransform(ctx);

    // Layer 0.5: Terrain-colored ground tiles (if MapSystem attached)
    this.groundTiles.draw(ctx, this.camera);

    // Layer 1: Grid diamonds
    this.drawGrid();

    // Layer 1.5: Terrain features (forests, mountains, rocks)
    this.featureTiles.draw(ctx, this.camera);

    // Layer 2: Buildings (depth-sorted)
    this.drawBuildings();

    // Layer 2.5: Political entity indicators
    this.drawPoliticalEntities();

    // Layer 3: Hover highlight
    if (this.hoverCell && isInBounds(this.hoverCell.x, this.hoverCell.y)) {
      this.drawHighlight(this.hoverCell.x, this.hoverCell.y);
    }

    // Layer 4: Placement preview
    if (this.placementPreview) {
      this.drawPlacementPreview(this.placementPreview);
    }

    this.camera.restoreTransform(ctx);

    // Layer 5: Day/night overlay (screen-space)
    this.drawDayNightOverlay();

    // Layer 6: Screen-space weather particles
    this.particles.update(ctx);
  };

  /** Semi-transparent dark overlay that intensifies at night. */
  private drawDayNightOverlay(): void {
    // dayProgress: 0 = midnight, 0.5 = noon, 1 = midnight
    // Map to a darkness alpha: 0 at noon, ~0.5 at midnight
    const distFromNoon = Math.abs(this.dayProgress - 0.5) * 2; // 0..1
    const alpha = distFromNoon * distFromNoon * 0.45; // quadratic falloff, max 0.45
    if (alpha < 0.01) return;

    const { ctx } = this;
    const { viewportWidth: vw, viewportHeight: vh } = this.camera;
    ctx.fillStyle = `rgba(10, 10, 30, ${alpha})`;
    ctx.fillRect(0, 0, vw, vh);
  }

  private drawGrid(): void {
    const { ctx } = this;

    ctx.strokeStyle = 'rgba(60, 60, 60, 0.5)';
    ctx.lineWidth = 0.5;

    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const screen = gridToScreen(x, y);

        // Frustum cull — skip tiles clearly off-screen
        const camScreen = this.camera.worldToScreen(screen.x, screen.y);
        if (
          camScreen.x < -TILE_WIDTH * 2 ||
          camScreen.x > this.camera.viewportWidth + TILE_WIDTH * 2 ||
          camScreen.y < -TILE_HEIGHT * 2 ||
          camScreen.y > this.camera.viewportHeight + TILE_HEIGHT * 2
        ) {
          continue;
        }

        const cell = this.grid.getCell(x, y);

        // Fill tile
        drawDiamond(ctx, screen.x, screen.y);
        if (cell?.type) {
          ctx.fillStyle = '#333333';
        } else {
          ctx.fillStyle = '#2e2e2e';
        }
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  private drawBuildings(): void {
    // Build array from ECS entities and sort by depth (back-to-front)
    const buildings: Building[] = [];
    for (const entity of buildingsLogic) {
      buildings.push({
        x: entity.position.gridX,
        y: entity.position.gridY,
        defId: entity.building.defId,
        powered: entity.building.powered,
      });
    }
    const sorted = buildings.sort((a, b) => depthKey(a.x, a.y) - depthKey(b.x, b.y));

    for (const building of sorted) {
      const sprite = this.spriteLoader.get(building.defId);
      if (!sprite) {
        // Fallback: draw a colored box for buildings whose sprites aren't loaded
        this.drawFallbackBuilding(building);
        continue;
      }

      this.drawSprite(building.x, building.y, sprite, building.powered);
    }
  }

  /** Draw a building sprite at the given grid position, using anchor-point alignment. */
  private drawSprite(gridX: number, gridY: number, sprite: SpriteInfo, powered: boolean): void {
    const { ctx } = this;
    const screen = gridToScreen(gridX, gridY);

    // The anchor point in the sprite image corresponds to the tile's
    // top-center diamond vertex. Offset by anchor to position correctly.
    // The grid diamond top vertex is at screen.x, screen.y.
    // The anchor in the manifest corresponds to the projected tile *base center*,
    // which in our 2:1 dimetric is at (screen.x, screen.y + TILE_HEIGHT/2).
    const drawX = screen.x - sprite.anchorX;
    const drawY = screen.y + TILE_HEIGHT / 2 - sprite.anchorY;

    if (!powered) {
      ctx.globalAlpha = 0.4 + 0.1 * Math.sin(Date.now() / 500);
    }

    ctx.drawImage(sprite.image, drawX, drawY, sprite.width, sprite.height);

    if (!powered) {
      ctx.globalAlpha = 1;
    }
  }

  /** Role → fallback color + height for buildings whose sprites aren't loaded. */
  private static ROLE_FALLBACK: Record<string, { color: string; height: number }> = {
    power: { color: '#3e2723', height: 40 },
    housing: { color: '#757575', height: 50 },
    agriculture: { color: '#33691e', height: 5 },
    industry: { color: '#5d4037', height: 30 },
    military: { color: '#b71c1c', height: 10 },
    government: { color: '#1a237e', height: 35 },
    culture: { color: '#4a148c', height: 25 },
    infrastructure: { color: '#444444', height: 15 },
    monument: { color: '#bf360c', height: 45 },
    commerce: { color: '#e65100', height: 20 },
    education: { color: '#00695c', height: 25 },
    health: { color: '#c62828', height: 25 },
  };

  /** Fallback colored box for buildings whose sprites aren't loaded. */
  private drawFallbackBuilding(building: Building): void {
    const { ctx } = this;
    const screen = gridToScreen(building.x, building.y);

    const def = getBuildingDef(building.defId);
    const role = def?.role ?? 'infrastructure';
    const fallback = Canvas2DRenderer.ROLE_FALLBACK[role] ?? { color: '#757575', height: 20 };
    const color = fallback.color;
    const height = fallback.height;

    if (!building.powered) {
      ctx.globalAlpha = 0.4;
    }

    const cx = screen.x;
    const cy = screen.y + TILE_HEIGHT / 2;
    const hw = TILE_WIDTH / 4;
    const hh = TILE_HEIGHT / 4;

    // Left face
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx - hw, cy - hh);
    ctx.lineTo(cx - hw, cy - hh - height);
    ctx.lineTo(cx, cy - height);
    ctx.closePath();
    ctx.fill();

    // Right face
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + hw, cy - hh);
    ctx.lineTo(cx + hw, cy - hh - height);
    ctx.lineTo(cx, cy - height);
    ctx.closePath();
    ctx.fill();

    // Top face
    ctx.fillStyle = '#9e9e9e';
    ctx.beginPath();
    ctx.moveTo(cx, cy - height);
    ctx.lineTo(cx - hw, cy - hh - height);
    ctx.lineTo(cx, cy - TILE_HEIGHT / 2 - height);
    ctx.lineTo(cx + hw, cy - hh - height);
    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha = 1;
  }

  /** Role → indicator color for political entity overlays. */
  private static ROLE_COLORS: Record<PoliticalRole, string> = {
    politruk: '#c62828',
    kgb_agent: '#1a237e',
    military_officer: '#2e7d32',
    conscription_officer: '#e65100',
  };

  /** Role → single-letter glyph for the indicator badge. */
  private static ROLE_GLYPHS: Record<PoliticalRole, string> = {
    politruk: 'P',
    kgb_agent: 'K',
    military_officer: 'M',
    conscription_officer: 'C',
  };

  /** Draw small colored indicators at grid positions where political entities are stationed. */
  private drawPoliticalEntities(): void {
    if (this.politicalEntities.length === 0) return;

    const { ctx } = this;
    const BADGE_RADIUS = 8;

    for (const entity of this.politicalEntities) {
      const { gridX, gridY } = entity.stationedAt;
      if (!isInBounds(gridX, gridY)) continue;

      const screen = gridToScreen(gridX, gridY);

      // Frustum cull
      const camScreen = this.camera.worldToScreen(screen.x, screen.y);
      if (
        camScreen.x < -TILE_WIDTH ||
        camScreen.x > this.camera.viewportWidth + TILE_WIDTH ||
        camScreen.y < -TILE_HEIGHT * 3 ||
        camScreen.y > this.camera.viewportHeight + TILE_HEIGHT
      ) {
        continue;
      }

      // Position badge above the tile center, offset by TILE_HEIGHT so it floats above buildings
      const cx = screen.x;
      const cy = screen.y - TILE_HEIGHT * 0.8;

      const color = Canvas2DRenderer.ROLE_COLORS[entity.role] ?? '#757575';
      const glyph = Canvas2DRenderer.ROLE_GLYPHS[entity.role] ?? '?';

      // Outer circle (dark border)
      ctx.beginPath();
      ctx.arc(cx, cy, BADGE_RADIUS + 1, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fill();

      // Inner filled circle
      ctx.beginPath();
      ctx.arc(cx, cy, BADGE_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Letter glyph
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${BADGE_RADIUS}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(glyph, cx, cy);
    }
  }

  private drawHighlight(gridX: number, gridY: number): void {
    const { ctx } = this;
    const screen = gridToScreen(gridX, gridY);

    drawDiamond(ctx, screen.x, screen.y);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fill();
  }

  private drawPlacementPreview(preview: PlacementPreview): void {
    const { ctx } = this;
    const fillColor = preview.valid ? 'rgba(0, 200, 0, 0.3)' : 'rgba(200, 0, 0, 0.3)';

    // Draw overlay diamond on ALL footprint cells
    for (let dx = 0; dx < preview.footprintW; dx++) {
      for (let dy = 0; dy < preview.footprintH; dy++) {
        const cellScreen = gridToScreen(preview.gridX + dx, preview.gridY + dy);
        drawDiamond(ctx, cellScreen.x, cellScreen.y);
        ctx.fillStyle = fillColor;
        ctx.fill();
      }
    }

    // Ghost sprite at origin cell
    const sprite = this.spriteLoader.get(preview.spriteName);
    if (sprite) {
      const screen = gridToScreen(preview.gridX, preview.gridY);
      ctx.globalAlpha = 0.6;
      const drawX = screen.x - sprite.anchorX;
      const drawY = screen.y + TILE_HEIGHT / 2 - sprite.anchorY;
      ctx.drawImage(sprite.image, drawX, drawY, sprite.width, sprite.height);
      ctx.globalAlpha = 1;
    }
  }

  /**
   * Convert a screen-space pointer position to a grid cell.
   * Accounts for camera pan + zoom.
   */
  screenToGridCell(screenX: number, screenY: number): GridPoint | null {
    const world = this.camera.screenToWorld(screenX, screenY);
    const grid = screenToGrid(world.x, world.y);
    const gx = Math.floor(grid.x);
    const gy = Math.floor(grid.y);
    if (!isInBounds(gx, gy)) return null;
    return { x: gx, y: gy };
  }
}

interface GridPoint {
  x: number;
  y: number;
}
