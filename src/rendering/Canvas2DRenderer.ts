import { CharacterSpriteLoader } from './CharacterSpriteLoader';

interface Grid {
  width: number;
  height: number;
  cells: Array<{ type: string; spriteVariant?: string }>;
}

interface Position {
  x: number;
  y: number;
}

interface RenderableEntity {
  position?: Position;
  citizen?: { age: number; gender: string };
  worker?: { job: string };
  dvor?: any;
}

/**
 * Canvas2DRenderer
 *
 * Handles rendering the game world to a 2D canvas.
 * Optimized for performance by batching draw calls where possible.
 */
export class Canvas2DRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;

  // Camera state
  private cameraX = 0;
  private cameraY = 0;
  private zoom = 1;
  private targetCameraX = 0;
  private targetCameraY = 0;
  private targetZoom = 1;

  // Assets
  private tileImages: Map<string, HTMLImageElement> = new Map();
  private characterSprites: CharacterSpriteLoader;

  // Grid constants
  private static readonly TILE_SIZE = 64; // Pixels per grid cell
  private static readonly SPRITE_RENDER_SIZE = 96; // Render size for characters
  private static readonly CAMERA_LERP = 0.1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false }); // alpha: false for performance
    if (!ctx) throw new Error('Could not get 2D context');
    this.ctx = ctx;

    this.width = canvas.width;
    this.height = canvas.height;

    this.characterSprites = CharacterSpriteLoader.getInstance();

    this.resize(canvas.clientWidth, canvas.clientHeight);
    this.loadAssets();
  }

  private loadAssets() {
    // Load terrain tiles
    const terrains = [
      'grass_1', 'grass_2', 'grass_3',
      'forest_1', 'forest_2',
      'hill_1',
      'mountain_1', 'mountain_2',
      'water_1', 'water_deep_1'
    ];

    terrains.forEach(t => {
      const img = new Image();
      img.src = `/sprites/terrain/${t}.png`;
      this.tileImages.set(t, img);
    });
  }

  public resize(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;
    // Disable smoothing for pixel art look
    this.ctx.imageSmoothingEnabled = false;
  }

  public setCamera(x: number, y: number, zoom: number) {
    this.targetCameraX = x;
    this.targetCameraY = y;
    this.targetZoom = Math.max(0.25, Math.min(4, zoom));
  }

  public update(dt: number) {
    const lerp = Canvas2DRenderer.CAMERA_LERP;
    this.cameraX += (this.targetCameraX - this.cameraX) * lerp;
    this.cameraY += (this.targetCameraY - this.cameraY) * lerp;
    this.zoom += (this.targetZoom - this.zoom) * lerp;
  }

  public render(
    grid: Grid,
    citizens: RenderableEntity[],
    dvory: RenderableEntity[]
  ) {
    const { ctx, width, height, zoom, cameraX, cameraY } = this;
    const TILE = Canvas2DRenderer.TILE_SIZE;

    // Clear screen
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    ctx.save();

    // Apply camera transform
    ctx.translate(width / 2, height / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-cameraX * TILE, -cameraY * TILE);

    // Calculate visible range to cull (Frustum culling)
    const viewportWidthWorld = width / zoom;
    const viewportHeightWorld = height / zoom;
    const minX = Math.floor(cameraX - viewportWidthWorld / 2 / TILE) - 1;
    const maxX = Math.ceil(cameraX + viewportWidthWorld / 2 / TILE) + 1;
    const minY = Math.floor(cameraY - viewportHeightWorld / 2 / TILE) - 1;
    const maxY = Math.ceil(cameraY + viewportHeightWorld / 2 / TILE) + 1;

    // Clamp to grid bounds
    const startX = Math.max(0, minX);
    const endX = Math.min(grid.width, maxX);
    const startY = Math.max(0, minY);
    const endY = Math.min(grid.height, maxY);

    this.renderTerrain(ctx, grid, startX, endX, startY, endY, TILE);
    this.renderStructures(ctx, dvory, startX, endX, startY, endY, TILE);
    this.renderCitizens(ctx, citizens, startX, endX, startY, endY, TILE);

    ctx.restore();
  }

  private renderTerrain(
    ctx: CanvasRenderingContext2D,
    grid: Grid,
    startX: number, endX: number,
    startY: number, endY: number,
    tileSize: number
  ) {
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const cell = grid.cells[y * grid.width + x];
        if (!cell) continue;

        const spriteName = cell.spriteVariant || 'grass_1';
        const img = this.tileImages.get(spriteName);

        if (img && img.complete) {
          ctx.drawImage(img, x * tileSize, y * tileSize, tileSize, tileSize);
        } else {
          ctx.fillStyle = this.getTerrainColor(cell.type);
          ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
        }
      }
    }
  }

  private renderStructures(
    ctx: CanvasRenderingContext2D,
    structures: RenderableEntity[],
    startX: number, endX: number,
    startY: number, endY: number,
    tileSize: number
  ) {
    for (const structure of structures) {
      if (!structure.position) continue;
      const { x, y } = structure.position;

      if (x < startX || x > endX || y < startY || y > endY) continue;

      // Draw Structure Base
      ctx.fillStyle = '#5D4037';
      ctx.fillRect(x * tileSize + 4, y * tileSize + 4, tileSize - 8, tileSize - 8);

      // Roof/Details
      ctx.fillStyle = '#3E2723';
      ctx.beginPath();
      ctx.moveTo(x * tileSize + 4, y * tileSize + 4);
      ctx.lineTo(x * tileSize + tileSize / 2, y * tileSize - 8);
      ctx.lineTo(x * tileSize + tileSize - 4, y * tileSize + 4);
      ctx.fill();
    }
  }

  private renderCitizens(
    ctx: CanvasRenderingContext2D,
    citizens: RenderableEntity[],
    startX: number, endX: number,
    startY: number, endY: number,
    tileSize: number
  ) {
    const useSprites = this.characterSprites?.ready === true;
    const spriteSize = Canvas2DRenderer.SPRITE_RENDER_SIZE;
    const DOT_RADIUS = 4;
    const now = Date.now();

    for (const citizen of citizens) {
      if (!citizen.position) continue;
      const { x, y } = citizen.position;

      if (x < startX - 1 || x > endX || y < startY - 1 || y > endY) continue;

      if (useSprites) {
        this.renderCitizenSprite(ctx, citizen, x, y, tileSize, spriteSize, now);
      } else {
        this.drawCitizenDot(ctx, x, y, DOT_RADIUS, tileSize);
      }
    }
  }

  private renderCitizenSprite(
    ctx: CanvasRenderingContext2D,
    citizen: RenderableEntity,
    x: number, y: number,
    tileSize: number,
    spriteSize: number,
    now: number
  ) {
    const citizenClass = citizen.worker ? 'worker' : ((citizen.citizen?.age ?? 20) < 18 ? 'child' : 'elder');
    const action = 'idle';
    const frame = Math.floor(now / 100);

    const sprite = this.characterSprites.get(citizenClass, action, frame, 0);

    if (sprite) {
      const screenX = x * tileSize;
      const screenY = y * tileSize;

      ctx.drawImage(
        sprite.image,
        sprite.sx, sprite.sy, sprite.sw, sprite.sh,
        screenX - spriteSize / 2 + tileSize / 2,
        screenY - spriteSize + tileSize / 2 + 8, // Offset to align feet
        spriteSize,
        spriteSize
      );
    } else {
      this.drawCitizenDot(ctx, x, y, 4, tileSize);
    }
  }

  private drawCitizenDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, tile: number) {
    ctx.fillStyle = '#FF0000';
    ctx.beginPath();
    ctx.arc(x * tile + tile / 2, y * tile + tile / 2, r, 0, Math.PI * 2);
    ctx.fill();
  }

  private getTerrainColor(type: string): string {
    switch (type) {
      case 'grass': return '#4CAF50';
      case 'grass-forest': return '#2E7D32';
      case 'grass-hill': return '#8BC34A';
      case 'water': return '#2196F3';
      case 'water-deep': return '#0D47A1';
      case 'mountain': return '#9E9E9E';
      default: return '#000000';
    }
  }
}
