/**
 * Camera2D — 2D camera with pan + zoom for the isometric viewport.
 *
 * The camera stores an offset (x, y) and a zoom level.
 * World coordinates are transformed to screen via:
 *   screenX = (worldX - camera.x) * zoom + canvas.width/2
 *   screenY = (worldY - camera.y) * zoom + canvas.height/2
 *
 * The inverse converts screen (pointer) positions back to world space.
 */

export class Camera2D {
  /** World-space center point the camera is looking at. */
  public x = 0;
  public y = 0;

  /** Zoom level. 1.0 = 1:1 pixel mapping. */
  public zoom = 1;

  /** Zoom constraints. */
  public minZoom = 0.3;
  public maxZoom = 3;

  /** World-space pan bounds (default: unconstrained). */
  private boundsMinX = -Infinity;
  private boundsMinY = -Infinity;
  private boundsMaxX = Infinity;
  private boundsMaxY = Infinity;

  /** Viewport dimensions (updated on resize). */
  public viewportWidth = 0;
  public viewportHeight = 0;

  /** Set world-space bounds for camera panning. */
  setBounds(minX: number, minY: number, maxX: number, maxY: number): void {
    this.boundsMinX = minX;
    this.boundsMinY = minY;
    this.boundsMaxX = maxX;
    this.boundsMaxY = maxY;
  }

  /** Clamp camera position to bounds. */
  private clamp(): void {
    this.x = Math.max(this.boundsMinX, Math.min(this.boundsMaxX, this.x));
    this.y = Math.max(this.boundsMinY, Math.min(this.boundsMaxY, this.y));
  }

  /** Update viewport size — call on resize. */
  resize(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }

  /** Convert world coordinates to screen pixel position. */
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: (worldX - this.x) * this.zoom + this.viewportWidth / 2,
      y: (worldY - this.y) * this.zoom + this.viewportHeight / 2,
    };
  }

  /** Convert screen pixel position to world coordinates. */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - this.viewportWidth / 2) / this.zoom + this.x,
      y: (screenY - this.viewportHeight / 2) / this.zoom + this.y,
    };
  }

  /** Pan the camera by a screen-space delta. */
  pan(deltaScreenX: number, deltaScreenY: number): void {
    this.x -= deltaScreenX / this.zoom;
    this.y -= deltaScreenY / this.zoom;
    this.clamp();
  }

  /** Zoom toward/away from a screen-space point (e.g. pinch center or cursor). */
  zoomAt(screenX: number, screenY: number, factor: number): void {
    // World point under the cursor before zoom
    const worldBefore = this.screenToWorld(screenX, screenY);

    // Apply zoom
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor));

    // World point under the cursor after zoom
    const worldAfter = this.screenToWorld(screenX, screenY);

    // Adjust camera so the world point stays under the cursor
    this.x += worldBefore.x - worldAfter.x;
    this.y += worldBefore.y - worldAfter.y;
    this.clamp();
  }

  /** Center the camera on a grid position (using grid→screen math externally). */
  centerOn(worldX: number, worldY: number): void {
    this.x = worldX;
    this.y = worldY;
    this.clamp();
  }

  /**
   * Auto-zoom to fill the viewport with the given world-space rectangle.
   * Uses Math.max of the X/Y scale ratios so the rectangle covers the
   * entire viewport with no black bars (some overflow on one axis is expected).
   */
  fitToWorld(worldWidth: number, worldHeight: number): void {
    if (this.viewportWidth === 0 || this.viewportHeight === 0) return;
    if (worldWidth === 0 || worldHeight === 0) return;

    const zoomX = this.viewportWidth / worldWidth;
    const zoomY = this.viewportHeight / worldHeight;
    this.zoom = Math.max(zoomX, zoomY);
    // Clamp to zoom constraints
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom));
  }

  /**
   * Apply the camera transform to a canvas context.
   * Call before drawing world-space content, and restore() after.
   */
  applyTransform(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.viewportWidth / 2, this.viewportHeight / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x, -this.y);
  }

  /** Restore context after applyTransform(). */
  restoreTransform(ctx: CanvasRenderingContext2D): void {
    ctx.restore();
  }
}
