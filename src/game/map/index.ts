/**
 * @module game/map
 *
 * Procedural map generation and terrain management for SimSoviet 2000.
 */

export { MapSystem } from './MapSystem';
export type { MapGenerationOptions, MapSize, TerrainCell, TerrainType } from './types';
// Public API — matches original MapSystem.ts exports
export { DEFAULT_MAP_OPTIONS, MAP_SIZES } from './types';
