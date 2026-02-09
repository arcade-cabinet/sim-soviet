/**
 * FeatureTileRenderer — Draws decorative hex terrain features (mountains, forests, rivers).
 *
 * Uses the pre-baked hex tile sprites from public/sprites/soviet/tiles/{season}/.
 * These are decorative overlays that sit between the ground and building layers.
 */

import type { Camera2D } from './Camera2D';
import { gridToScreen, TILE_HEIGHT } from './GridMath';

export interface TerrainFeature {
  gridX: number;
  gridY: number;
  /** The base sprite name (e.g. "grass-forest"), without season prefix or extension. */
  spriteName: string;
}

interface TileAnchor {
  anchorX: number;
  anchorY: number;
}

export class FeatureTileRenderer {
  private features: TerrainFeature[] = [];
  private tileCache = new Map<string, HTMLImageElement>();
  private anchorCache = new Map<string, TileAnchor>();
  private season = 'winter';
  private manifestLoaded = false;
  private manifest: Record<string, Record<string, { anchor_x: number; anchor_y: number }>> | null =
    null;

  /** Set the current season (changes which tile sprites are used). */
  setSeason(season: string): void {
    if (this.season === season) return;
    this.season = season;
    // Clear cache — different season = different sprites
    this.tileCache.clear();
    this.anchorCache.clear();
  }

  /** Set the terrain features to render. */
  setFeatures(features: TerrainFeature[]): void {
    this.features = features;
  }

  /** Load the tile manifest for anchor data. */
  async loadManifest(): Promise<void> {
    if (this.manifestLoaded) return;
    try {
      const resp = await fetch(`${import.meta.env.BASE_URL}sprites/soviet/tiles/manifest.json`);
      if (resp.ok) {
        const data = await resp.json();
        this.manifest = data.seasons ?? null;
        this.manifestLoaded = true;
      }
    } catch (err) {
      console.warn('Failed to load terrain manifest:', err);
      this.manifestLoaded = true; // Prevent repeated fetch attempts
      // Fallback to center-based positioning
    }
  }

  /** Preload tile images for the current season. */
  async preload(spriteNames: string[]): Promise<void> {
    await this.loadManifest();
    await Promise.all(spriteNames.map((name) => this.loadTile(name)));
  }

  /**
   * Draw all terrain features. Called in world-space (camera transform applied).
   */
  draw(ctx: CanvasRenderingContext2D, _camera: Camera2D): void {
    for (const feature of this.features) {
      const tile = this.tileCache.get(feature.spriteName);
      if (!tile) continue;

      const screen = gridToScreen(feature.gridX, feature.gridY);
      const anchor = this.anchorCache.get(feature.spriteName);

      let drawX: number;
      let drawY: number;

      if (anchor) {
        // Use manifest anchor — same system as building sprites
        drawX = screen.x - anchor.anchorX;
        drawY = screen.y + TILE_HEIGHT / 2 - anchor.anchorY;
      } else {
        // Fallback: center tile on the grid cell
        drawX = screen.x - tile.width / 2;
        drawY = screen.y + TILE_HEIGHT / 2 - tile.height / 2;
      }

      ctx.drawImage(tile, drawX, drawY);
    }
  }

  private async loadTile(name: string): Promise<void> {
    if (this.tileCache.has(name)) return;

    // Cache anchor from manifest
    if (this.manifest) {
      const seasonData = this.manifest[this.season];
      if (seasonData) {
        const tileData = seasonData[name];
        if (tileData) {
          this.anchorCache.set(name, {
            anchorX: tileData.anchor_x,
            anchorY: tileData.anchor_y,
          });
        }
      }
    }

    const img = new Image();
    const src = `${import.meta.env.BASE_URL}sprites/soviet/tiles/${this.season}/${name}.png`;
    return new Promise((resolve) => {
      img.onload = () => {
        this.tileCache.set(name, img);
        resolve();
      };
      img.onerror = () => resolve(); // Silently skip missing tiles
      img.src = src;
    });
  }
}
