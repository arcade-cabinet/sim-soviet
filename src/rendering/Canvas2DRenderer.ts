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
import { isColorBlindMode } from '@/stores/gameStore';
import { Camera2D } from './Camera2D';
import type { CharacterSpriteLoader } from './CharacterSpriteLoader';
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

/** Data needed to render a single citizen on the map. */
export interface CitizenRenderData {
  gridX: number;
  gridY: number;
  citizenClass: string;
  /** Pre-computed dot color from CitizenRenderSlot (falls back to class lookup). */
  dotColor?: string;
  /** Gender for future sprite variant selection. */
  gender?: 'male' | 'female';
  /** Age category for future sprite size/posture selection. */
  ageCategory?: 'child' | 'adolescent' | 'adult' | 'elder';
}

/** Citizen class → fill color for the indicator dot (fallback when no renderSlot). */
const CITIZEN_CLASS_COLORS: Record<string, string> = {
  worker: '#8D6E63',
  party_official: '#C62828',
  engineer: '#1565C0',
  farmer: '#2E7D32',
  soldier: '#4E342E',
  prisoner: '#616161',
};

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

  /** Citizen entities to render as small dots near buildings. */
  private citizenData: CitizenRenderData[] = [];

  /** Character sprite loader for rendering citizens as sprites instead of dots. */
  private characterSprites: CharacterSpriteLoader | null = null;

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

  /** Update the list of citizens to render as small indicator dots. */
  setCitizenData(data: CitizenRenderData[]): void {
    this.citizenData = data;
  }

  /** Set the character sprite loader for rendering citizens as sprites. */
  setCharacterSprites(loader: CharacterSpriteLoader): void {
    this.characterSprites = loader;
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

    // Layer 2.3: Citizen indicator dots
    this.drawCitizens();

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
        constructionPhase: entity.building.constructionPhase as Building['constructionPhase'],
        constructionProgress: entity.building.constructionProgress,
      });
    }
    const sorted = buildings.sort((a, b) => depthKey(a.x, a.y) - depthKey(b.x, b.y));

    for (const building of sorted) {
      const sprite = this.spriteLoader.get(building.defId);
      if (!sprite) {
        // Fallback: draw a colored box for buildings whose sprites aren't loaded
        this.drawFallbackBuilding(building);
      } else {
        this.drawSprite(building.x, building.y, sprite, building.powered);
      }

      // Draw construction progress bar overlay for non-complete buildings
      if (building.constructionPhase && building.constructionPhase !== 'complete') {
        this.drawConstructionProgress(building);
      }
    }
  }

  /** Draw a construction progress bar at the base of a building. */
  private drawConstructionProgress(building: Building): void {
    const { ctx } = this;
    const screen = gridToScreen(building.x, building.y);

    const barWidth = TILE_WIDTH * 0.7;
    const barHeight = 4;
    const barX = screen.x - barWidth / 2;
    const barY = screen.y + TILE_HEIGHT / 2 + 2;

    const progress = building.constructionProgress ?? 0;

    // Background (dark grey)
    ctx.fillStyle = '#333333';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // Fill (amber for foundation, red for building phase)
    ctx.fillStyle = building.constructionPhase === 'foundation' ? '#FF8F00' : '#C62828';
    ctx.fillRect(barX, barY, barWidth * progress, barHeight);
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

  /** Draw a color-blind accessibility shape outline around a citizen dot. */
  private drawColorBlindShape(
    ctx: CanvasRenderingContext2D,
    citizenClass: string,
    cx: number,
    cy: number,
    r: number
  ): void {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;

    switch (citizenClass) {
      case 'worker':
      case 'farmer':
        // Circle outline
        ctx.beginPath();
        ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'party_official':
        // Square outline
        ctx.strokeRect(cx - r - 2, cy - r - 2, (r + 2) * 2, (r + 2) * 2);
        break;
      case 'engineer':
        // Diamond outline
        ctx.beginPath();
        ctx.moveTo(cx, cy - r - 3);
        ctx.lineTo(cx + r + 3, cy);
        ctx.lineTo(cx, cy + r + 3);
        ctx.lineTo(cx - r - 3, cy);
        ctx.closePath();
        ctx.stroke();
        break;
      case 'soldier':
        // Triangle outline
        ctx.beginPath();
        ctx.moveTo(cx, cy - r - 3);
        ctx.lineTo(cx + r + 3, cy + r + 2);
        ctx.lineTo(cx - r - 3, cy + r + 2);
        ctx.closePath();
        ctx.stroke();
        break;
      case 'prisoner':
        // X shape
        ctx.beginPath();
        ctx.moveTo(cx - r - 2, cy - r - 2);
        ctx.lineTo(cx + r + 2, cy + r + 2);
        ctx.moveTo(cx + r + 2, cy - r - 2);
        ctx.lineTo(cx - r - 2, cy + r + 2);
        ctx.stroke();
        break;
    }
  }

  /** Render size for character sprites (pixels in world-space). */
  private static readonly SPRITE_RENDER_SIZE = 20;

  /** Draw citizens as sprites (with dot fallback when sprites aren't loaded). */
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: sprite vs dot fallback with frustum cull + jitter
  private drawCitizens(): void {
    if (this.citizenData.length === 0) return;

    const { ctx } = this;
    const DOT_RADIUS = 4;
    const cbMode = isColorBlindMode();
    const useSprites = this.characterSprites?.ready === true;
    const spriteSize = Canvas2DRenderer.SPRITE_RENDER_SIZE;

    // Group citizens by grid cell to apply deterministic jitter
    const cellGroups = new Map<string, CitizenRenderData[]>();
    for (const c of this.citizenData) {
      const key = `${c.gridX},${c.gridY}`;
      let group = cellGroups.get(key);
      if (!group) {
        group = [];
        cellGroups.set(key, group);
      }
      group.push(c);
    }

    for (const [, group] of cellGroups) {
      const { gridX, gridY } = group[0]!;
      if (!isInBounds(gridX, gridY)) continue;

      const screen = gridToScreen(gridX, gridY);

      // Frustum cull
      const camScreen = this.camera.worldToScreen(screen.x, screen.y);
      if (
        camScreen.x < -TILE_WIDTH ||
        camScreen.x > this.camera.viewportWidth + TILE_WIDTH ||
        camScreen.y < -TILE_HEIGHT * 2 ||
        camScreen.y > this.camera.viewportHeight + TILE_HEIGHT
      ) {
        continue;
      }

      // Base position: near bottom of tile
      const baseCx = screen.x;
      const baseCy = screen.y + TILE_HEIGHT / 4;
      // Jitter spacing adapts to sprite vs dot mode
      const spacing = useSprites ? spriteSize * 1.1 : DOT_RADIUS * 2.5;

      for (let i = 0; i < group.length; i++) {
        const citizen = group[i]!;
        // Deterministic jitter: spread citizens in a row, wrapping after 5 per row
        const col = i % 5;
        const row = Math.floor(i / 5);
        const offsetX = (col - 2) * spacing;
        const offsetY = row * spacing;

        const cx = baseCx + offsetX;
        const cy = baseCy + offsetY;

        // Try sprite rendering first
        if (useSprites) {
          const sprite = this.characterSprites!.get(
            citizen.citizenClass,
            citizen.gender,
            citizen.ageCategory
          );
          if (sprite) {
            // Draw the idle frame (top-left cell of sprite sheet)
            // anchored at feet (bottom-center of the destination rect)
            ctx.drawImage(
              sprite.image,
              sprite.sx,
              sprite.sy,
              sprite.sw,
              sprite.sh,
              cx - spriteSize / 2,
              cy - spriteSize,
              spriteSize,
              spriteSize
            );
            continue;
          }
        }

        // Fallback: colored dot
        const color = citizen.dotColor ?? CITIZEN_CLASS_COLORS[citizen.citizenClass] ?? '#757575';

        // Dark border
        ctx.beginPath();
        ctx.arc(cx, cy, DOT_RADIUS + 1, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fill();

        // Colored fill
        ctx.beginPath();
        ctx.arc(cx, cy, DOT_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Color-blind shape overlay
        if (cbMode) {
          this.drawColorBlindShape(ctx, citizen.citizenClass, cx, cy, DOT_RADIUS);
        }
      }
    }
  }

  /** Role → indicator color for political entity overlays. */
  private static ROLE_COLORS: Record<PoliticalRole, string> = {
    politruk: '#c62828',
    kgb_agent: '#1a237e',
    military_officer: '#2e7d32',
    conscription_officer: '#e65100',
  };

  /** Badge radius for political entity icons. */
  private static BADGE_RADIUS = 12;

  /** Role → icon shape type. */
  private static ROLE_ICON: Record<PoliticalRole, 'star' | 'shield' | 'chevron' | 'warning'> = {
    politruk: 'star',
    kgb_agent: 'shield',
    military_officer: 'chevron',
    conscription_officer: 'warning',
  };

  /** Draw a 5-pointed star path centered at (cx, cy) with outer radius r. */
  private drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
    const inner = r * 0.4;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const radius = i % 2 === 0 ? r : inner;
      const angle = -Math.PI / 2 + (Math.PI / 5) * i;
      const px = cx + Math.cos(angle) * radius;
      const py = cy + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  /** Draw a shield (rounded downward-pointing shape) centered at (cx, cy) with size r. */
  private drawShield(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(cx - r, cy - r * 0.7);
    ctx.lineTo(cx + r, cy - r * 0.7);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
  }

  /** Draw an upward chevron (arrow-up) centered at (cx, cy) with size r. */
  private drawChevron(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
    const hw = r * 0.8;
    const thick = r * 0.35;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + hw, cy);
    ctx.lineTo(cx + hw - thick, cy);
    ctx.lineTo(cx, cy - r + thick * 1.5);
    ctx.lineTo(cx - hw + thick, cy);
    ctx.lineTo(cx - hw, cy);
    ctx.closePath();
  }

  /** Draw an exclamation mark inside a triangle centered at (cx, cy) with size r. */
  private drawWarning(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
    // Triangle fill (caller already set fillStyle to role color)
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy + r * 0.7);
    ctx.lineTo(cx - r, cy + r * 0.7);
    ctx.closePath();
    ctx.fill();
    // Exclamation mark in dark color
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(cx - r * 0.12, cy - r * 0.5, r * 0.24, r * 0.6);
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.35, r * 0.14, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Draw the role-specific icon inside a badge circle. */
  private drawRoleIcon(
    ctx: CanvasRenderingContext2D,
    iconType: string,
    cx: number,
    cy: number,
    iconR: number
  ): void {
    ctx.fillStyle = '#ffffff';
    if (iconType === 'warning') {
      this.drawWarning(ctx, cx, cy, iconR);
      return;
    }
    if (iconType === 'star') this.drawStar(ctx, cx, cy, iconR);
    else if (iconType === 'shield') this.drawShield(ctx, cx, cy, iconR);
    else if (iconType === 'chevron') this.drawChevron(ctx, cx, cy, iconR);
    ctx.fill();
  }

  /** Draw a single political entity badge at (cx, cy) with connecting line and optional label. */
  private drawPoliticalBadge(
    entity: PoliticalEntityStats,
    cx: number,
    cy: number,
    tileCenterX: number,
    tileCenterY: number,
    pulseAlpha: number,
    zoom: number
  ): void {
    const { ctx } = this;
    const R = Canvas2DRenderer.BADGE_RADIUS;
    const color = Canvas2DRenderer.ROLE_COLORS[entity.role] ?? '#757575';
    const iconType = Canvas2DRenderer.ROLE_ICON[entity.role] ?? 'star';

    // Connecting line from badge down to tile center
    ctx.beginPath();
    ctx.moveTo(cx, cy + R);
    ctx.lineTo(tileCenterX, tileCenterY);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Influence radius glow (only when zoomed in close)
    if (zoom > 1.2) {
      ctx.beginPath();
      ctx.arc(tileCenterX, tileCenterY, TILE_WIDTH * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.05;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Apply pulse animation
    ctx.globalAlpha = pulseAlpha;

    // Outer circle (dark border)
    ctx.beginPath();
    ctx.arc(cx, cy, R + 1.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fill();

    // Inner filled circle
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Role-specific icon
    this.drawRoleIcon(ctx, iconType, cx, cy, R * 0.55);

    ctx.globalAlpha = 1;

    // Name label below badge (only when zoomed in enough)
    if (zoom > 0.8) {
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.lineWidth = 2.5;
      ctx.strokeText(entity.name, cx, cy + R + 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(entity.name, cx, cy + R + 3);
    }
  }

  /** Group political entities by grid cell key. */
  private groupEntitiesByCell(): Map<string, PoliticalEntityStats[]> {
    const cellGroups = new Map<string, PoliticalEntityStats[]>();
    for (const entity of this.politicalEntities) {
      const key = `${entity.stationedAt.gridX},${entity.stationedAt.gridY}`;
      const group = cellGroups.get(key);
      if (group) group.push(entity);
      else cellGroups.set(key, [entity]);
    }
    return cellGroups;
  }

  /** Draw political entity badges with role-specific icons, labels, and connecting lines. */
  private drawPoliticalEntities(): void {
    if (this.politicalEntities.length === 0) return;

    const zoom = this.camera.zoom;
    const pulseAlpha = 0.85 + 0.15 * Math.sin(Date.now() / 800);
    const cellGroups = this.groupEntitiesByCell();

    for (const group of cellGroups.values()) {
      const { gridX, gridY } = group[0]!.stationedAt;
      if (!isInBounds(gridX, gridY)) continue;

      const screen = gridToScreen(gridX, gridY);

      // Frustum cull
      const camScreen = this.camera.worldToScreen(screen.x, screen.y);
      if (
        camScreen.x < -TILE_WIDTH * 2 ||
        camScreen.x > this.camera.viewportWidth + TILE_WIDTH * 2 ||
        camScreen.y < -TILE_HEIGHT * 4 ||
        camScreen.y > this.camera.viewportHeight + TILE_HEIGHT
      ) {
        continue;
      }

      const tileCenterX = screen.x;
      const tileCenterY = screen.y + TILE_HEIGHT / 2;

      for (let i = 0; i < group.length; i++) {
        const entity = group[i]!;
        const offsetX = group.length > 1 ? (i - (group.length - 1) / 2) * 20 : 0;
        const cx = screen.x + offsetX;
        const cy = screen.y - TILE_HEIGHT * 0.8;
        this.drawPoliticalBadge(entity, cx, cy, tileCenterX, tileCenterY, pulseAlpha, zoom);
      }
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
