/**
 * GroundRenderer — Draws the ground fill layer per season.
 *
 * For now, uses solid colors per season. Future: PBR tiled textures from AmbientCG.
 * Draws under the grid diamonds as layer 0.
 */

import { drawDiamond, GRID_SIZE, gridToScreen, TILE_HEIGHT, TILE_WIDTH } from './GridMath';

/** Season → ground fill color for each tile. */
const SEASON_GROUND: Record<string, string> = {
  winter: '#d8d8d8',
  'early-spring': '#6b5b4f',
  mud: '#5a4a3a',
  spring: '#4a6a3a',
  summer: '#3a5a2a',
  'golden-autumn': '#6a5a2a',
  autumn: '#5a4a3a',
  default: '#2e2e2e',
};

export class GroundRenderer {
  private season = 'default';

  setSeason(season: string): void {
    this.season = season;
  }

  /**
   * Draw the ground layer. Called in world-space (camera transform already applied).
   * Draws filled diamonds slightly larger than the tile to avoid subpixel gaps.
   */
  draw(ctx: CanvasRenderingContext2D): void {
    const color = SEASON_GROUND[this.season] ?? SEASON_GROUND.default!;
    ctx.fillStyle = color;

    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const screen = gridToScreen(x, y);
        // Slightly oversized diamond to prevent seam gaps
        drawDiamond(ctx, screen.x, screen.y, TILE_WIDTH + 1, TILE_HEIGHT + 0.5);
        ctx.fill();
      }
    }
  }
}
