/**
 * Type stubs for FeatureTileRenderer — used by TerrainGenerator.
 * The Canvas 2D renderer is replaced by BabylonJS 3D rendering.
 */

export interface TerrainFeature {
  gridX: number;
  gridY: number;
  /** The base sprite name (e.g. "grass-forest"), without season prefix or extension. */
  spriteName: string;
}
