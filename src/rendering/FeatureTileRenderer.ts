/**
 * FeatureTileRenderer — Draws decorative hex terrain features (mountains, forests, rivers).
 *
 * Uses the pre-baked hex tile sprites from public/sprites/soviet/tiles/{season}/.
 * These are decorative overlays that sit between the ground and building layers.
 *
 * For the initial implementation, features are not placed — this is a placeholder
 * for future terrain generation that populates the map edges with forests/mountains.
 */

import type { Camera2D } from './Camera2D';
import { gridToScreen, TILE_HEIGHT } from './GridMath';

export interface TerrainFeature {
  gridX: number;
  gridY: number;
  spriteName: string;
}

export class FeatureTileRenderer {
  private features: TerrainFeature[] = [];
  private tileCache = new Map<string, HTMLImageElement>();
  private season = 'winter';

  /** Set the current season (changes which tile sprites are used). */
  setSeason(season: string): void {
    this.season = season;
    // Clear cache — different season = different sprites
    this.tileCache.clear();
  }

  /** Set the terrain features to render. */
  setFeatures(features: TerrainFeature[]): void {
    this.features = features;
  }

  /** Preload tile images for the current season. */
  async preload(spriteNames: string[]): Promise<void> {
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
      // Center the hex tile on the grid cell
      const drawX = screen.x - tile.width / 2;
      const drawY = screen.y + TILE_HEIGHT / 2 - tile.height / 2;
      ctx.drawImage(tile, drawX, drawY);
    }
  }

  private async loadTile(name: string): Promise<void> {
    if (this.tileCache.has(name)) return;
    const img = new Image();
    const src = `/sprites/soviet/tiles/${this.season}/${name}.png`;
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
