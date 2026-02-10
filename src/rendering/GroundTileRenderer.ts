/**
 * GroundTileRenderer — Draws terrain base tiles using hex sprite images.
 *
 * Uses an offscreen canvas cache that is rebuilt only when the season changes
 * or the MapSystem is (re)set. The cache is blitted as a single drawImage()
 * call per frame instead of 900 individual diamond fills.
 *
 * TerrainType -> base tile sprite mapping:
 *   grass/forest -> grass.png
 *   marsh/river/water -> water.png
 *   mountain -> stone.png
 *   road/foundation -> dirt.png
 */

import type { MapSystem, TerrainType } from '@/game/map';
import type { Camera2D } from './Camera2D';
import { gridToScreen, TILE_HEIGHT, TILE_WIDTH } from './GridMath';

/** Feature overlay sprite names (used by FeatureTileRenderer). */
export const TERRAIN_SPRITE_MAP: Partial<Record<TerrainType, string>> = {
  forest: 'grass-forest',
  mountain: 'stone-mountain',
  river: 'water',
  marsh: 'grass-hill',
  road: 'path-straight',
  water: 'water',
};

/** TerrainType -> base tile sprite filename (without extension). */
const BASE_TILE_MAP: Record<TerrainType, string> = {
  grass: 'grass',
  forest: 'grass',
  marsh: 'water',
  mountain: 'stone',
  river: 'water',
  road: 'dirt',
  foundation: 'dirt',
  water: 'water',
};

/** The 5 unique base tile sprite names. */
const BASE_TILE_NAMES = ['grass', 'dirt', 'stone', 'sand', 'water'] as const;

interface TileAnchor {
  anchorX: number;
  anchorY: number;
}

interface TileManifestEntry {
  anchor_x: number;
  anchor_y: number;
}

type SeasonManifest = Record<string, TileManifestEntry>;

export class GroundTileRenderer {
  private season = 'winter';
  private mapSystem: MapSystem | null = null;

  /** Offscreen canvas for cached ground rendering. */
  private offscreen: OffscreenCanvas | HTMLCanvasElement | null = null;
  private offscreenCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;

  /** World-space origin of the offscreen canvas. */
  private originX = 0;
  private originY = 0;

  /** Offscreen canvas dimensions. */
  private cacheWidth = 0;
  private cacheHeight = 0;

  /** Set true when offscreen cache needs rebuilding. */
  private dirty = true;

  /** Loaded base tile images keyed by sprite name. */
  private tileImages = new Map<string, HTMLImageElement>();

  /** Anchor data per sprite name for the current season. */
  private anchors = new Map<string, TileAnchor>();

  /** Parsed manifest data: season -> tile name -> anchor. */
  private manifest: Record<string, SeasonManifest> | null = null;
  private manifestLoaded = false;

  /** Set the MapSystem to read terrain data from. */
  setMapSystem(map: MapSystem): void {
    this.mapSystem = map;
    this.dirty = true;
  }

  /** Update the season (triggers cache rebuild + sprite reload). */
  setSeason(season: string): void {
    if (this.season === season) return;
    this.season = season;
    this.dirty = true;
    // Anchors depend on season, clear them
    this.anchors.clear();
    this.updateAnchorsFromManifest();
  }

  /** Load the tile manifest and preload the 5 base tile images for the current season. */
  async preloadTiles(): Promise<void> {
    await this.loadManifest();
    this.updateAnchorsFromManifest();
    await Promise.all(BASE_TILE_NAMES.map((name) => this.loadImage(name)));
    this.dirty = true;
  }

  /**
   * Draw the cached ground tiles. Called in world-space (camera transform already applied).
   *
   * If the cache is dirty, rebuilds it first.
   */
  draw(ctx: CanvasRenderingContext2D, _camera: Camera2D): void {
    if (!this.mapSystem) return;

    if (this.dirty) {
      this.rebuildCache();
    }

    if (this.offscreen) {
      ctx.drawImage(this.offscreen as HTMLCanvasElement, this.originX, this.originY);
    }
  }

  /**
   * Get the list of hex tile sprite names needed for the current map.
   * Used to feed into FeatureTileRenderer.preload() for terrain overlays.
   */
  getTerrainSpriteNames(): string[] {
    if (!this.mapSystem) return [];

    const names = new Set<string>();
    const size = this.mapSystem.getSize();
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const cell = this.mapSystem.getCell(x, y);
        if (cell) {
          const spriteName = TERRAIN_SPRITE_MAP[cell.type];
          if (spriteName) names.add(spriteName);
        }
      }
    }
    return [...names];
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /** Load the tile manifest JSON for anchor data. */
  private async loadManifest(): Promise<void> {
    if (this.manifestLoaded) return;
    try {
      const resp = await fetch(`${import.meta.env.BASE_URL}sprites/soviet/tiles/manifest.json`);
      if (resp.ok) {
        const data = await resp.json();
        this.manifest = data.seasons ?? null;
        this.manifestLoaded = true;
      }
    } catch (err) {
      console.warn('GroundTileRenderer: failed to load tile manifest:', err);
      this.manifestLoaded = true; // Prevent repeated attempts
    }
  }

  /** Extract anchor data from manifest for the current season. */
  private updateAnchorsFromManifest(): void {
    this.anchors.clear();
    if (!this.manifest) return;

    const seasonData = this.manifest[this.season];
    if (!seasonData) return;

    for (const name of BASE_TILE_NAMES) {
      const entry = seasonData[name];
      if (entry) {
        this.anchors.set(name, {
          anchorX: entry.anchor_x,
          anchorY: entry.anchor_y,
        });
      }
    }
  }

  /** Load a single base tile image. */
  private async loadImage(name: string): Promise<void> {
    if (this.tileImages.has(name)) return;

    const img = new Image();
    const src = `${import.meta.env.BASE_URL}sprites/soviet/tiles/${this.season}/${name}.png`;
    return new Promise((resolve) => {
      img.onload = () => {
        this.tileImages.set(name, img);
        resolve();
      };
      img.onerror = () => resolve(); // Silently skip missing tiles
      img.src = src;
    });
  }

  /** Compute offscreen canvas bounds from grid dimensions. */
  private computeBounds(gridSize: number): {
    originX: number;
    originY: number;
    width: number;
    height: number;
  } {
    // Compute the bounding box of all grid cell screen positions.
    // For a grid of size N, the extremes are at the corners:
    //   top:    gridToScreen(0, 0)
    //   right:  gridToScreen(N-1, 0)
    //   bottom: gridToScreen(N-1, N-1)
    //   left:   gridToScreen(0, N-1)
    const topLeft = gridToScreen(0, 0);
    const topRight = gridToScreen(gridSize - 1, 0);
    const bottomRight = gridToScreen(gridSize - 1, gridSize - 1);
    const bottomLeft = gridToScreen(0, gridSize - 1);

    // Screen positions are the top vertex of each diamond tile.
    // The tile extends TILE_WIDTH/2 left and right, and TILE_HEIGHT down.
    const minX = bottomLeft.x - TILE_WIDTH / 2;
    const maxX = topRight.x + TILE_WIDTH / 2;
    const minY = topLeft.y;
    const maxY = bottomRight.y + TILE_HEIGHT;

    // Add padding for tile sprite overhang (sprites may be larger than the diamond)
    const padX = TILE_WIDTH;
    const padY = TILE_HEIGHT * 2;

    return {
      originX: minX - padX,
      originY: minY - padY,
      width: Math.ceil(maxX - minX + padX * 2),
      height: Math.ceil(maxY - minY + padY * 2),
    };
  }

  /** Rebuild the offscreen canvas cache from current terrain data. */
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: cache rebuild requires iterating grid cells with multiple rendering branches
  private rebuildCache(): void {
    const map = this.mapSystem;
    if (!map) return;

    const size = map.getSize();
    const bounds = this.computeBounds(size);

    this.originX = bounds.originX;
    this.originY = bounds.originY;
    this.cacheWidth = bounds.width;
    this.cacheHeight = bounds.height;

    // Create or resize offscreen canvas
    if (
      !this.offscreen ||
      (this.offscreen as HTMLCanvasElement).width !== this.cacheWidth ||
      (this.offscreen as HTMLCanvasElement).height !== this.cacheHeight
    ) {
      if (typeof OffscreenCanvas !== 'undefined') {
        this.offscreen = new OffscreenCanvas(this.cacheWidth, this.cacheHeight);
        this.offscreenCtx = this.offscreen.getContext('2d');
      } else {
        const canvas = document.createElement('canvas');
        canvas.width = this.cacheWidth;
        canvas.height = this.cacheHeight;
        this.offscreen = canvas;
        this.offscreenCtx = canvas.getContext('2d');
      }
    }

    // Mark clean before drawing — the rebuild was attempted regardless of context
    this.dirty = false;

    const ctx = this.offscreenCtx;
    if (!ctx) return;

    // Clear the offscreen canvas
    ctx.clearRect(0, 0, this.cacheWidth, this.cacheHeight);

    // Draw each grid cell's base tile sprite
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const cell = map.getCell(x, y);
        const terrainType = cell?.type ?? 'grass';
        const spriteName = BASE_TILE_MAP[terrainType];
        const img = this.tileImages.get(spriteName);
        if (!img) continue;

        const screen = gridToScreen(x, y);
        const anchor = this.anchors.get(spriteName);

        let drawX: number;
        let drawY: number;

        if (anchor) {
          // Position using manifest anchor (same system as building sprites)
          drawX = screen.x - anchor.anchorX - this.originX;
          drawY = screen.y + TILE_HEIGHT / 2 - anchor.anchorY - this.originY;
        } else {
          // Fallback: center the tile image on the grid cell
          drawX = screen.x - img.width / 2 - this.originX;
          drawY = screen.y + TILE_HEIGHT / 2 - img.height / 2 - this.originY;
        }

        ctx.drawImage(img, drawX, drawY);
      }
    }
  }
}
