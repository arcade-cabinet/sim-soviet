/**
 * GridMath — Pure isometric projection functions.
 *
 * 2:1 dimetric projection (SimCity 2000 style):
 *   screenX = (gridX - gridY) * TILE_WIDTH/2
 *   screenY = (gridX + gridY) * TILE_HEIGHT/2
 *
 * The tile diamond is TILE_WIDTH wide × TILE_HEIGHT tall.
 * Sprite PPU = 80 → one grid cell = 80px wide, 40px tall on screen.
 */

export const TILE_WIDTH = 80;
export const TILE_HEIGHT = 40;
export const GRID_SIZE = 30;

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface GridPoint {
  x: number;
  y: number;
}

/** Convert grid coordinates to screen pixel position (top of the diamond). */
export function gridToScreen(gridX: number, gridY: number): ScreenPoint {
  return {
    x: (gridX - gridY) * (TILE_WIDTH / 2),
    y: (gridX + gridY) * (TILE_HEIGHT / 2),
  };
}

/**
 * Convert screen pixel position to fractional grid coordinates.
 * Caller should Math.floor() for cell selection.
 */
export function screenToGrid(screenX: number, screenY: number): GridPoint {
  // Inverse of the iso transform:
  //   screenX = (gx - gy) * TW/2  →  gx - gy = screenX / (TW/2)
  //   screenY = (gx + gy) * TH/2  →  gx + gy = screenY / (TH/2)
  // Solving: gx = (sum + diff) / 2,  gy = (sum - diff) / 2
  const diff = screenX / (TILE_WIDTH / 2);
  const sum = screenY / (TILE_HEIGHT / 2);
  return {
    x: (sum + diff) / 2,
    y: (sum - diff) / 2,
  };
}

/** Check if a grid coordinate is within bounds. */
export function isInBounds(gridX: number, gridY: number): boolean {
  return gridX >= 0 && gridY >= 0 && gridX < GRID_SIZE && gridY < GRID_SIZE;
}

/**
 * Draw an isometric diamond path on a canvas context.
 * The diamond's top vertex is at (cx, cy).
 */
export function drawDiamond(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  width: number = TILE_WIDTH,
  height: number = TILE_HEIGHT
): void {
  const hw = width / 2;
  const hh = height / 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + hw, cy + hh);
  ctx.lineTo(cx, cy + height);
  ctx.lineTo(cx - hw, cy + hh);
  ctx.closePath();
}

/** Depth sort key for back-to-front rendering. Higher values draw later (on top). */
export function depthKey(gridX: number, gridY: number): number {
  return gridX + gridY;
}
