/**
 * @module game/map/types
 *
 * Type definitions and configuration constants for the map system.
 */

// ─── Map Size Configuration ─────────────────────────────────────────────────

/** Predefined map size presets. */
export type MapSize = 'small' | 'medium' | 'large';

/** Grid dimensions for each map size preset. */
export const MAP_SIZES: Record<MapSize, number> = {
  small: 20,
  medium: 30,
  large: 50,
};

// ─── Terrain Types ──────────────────────────────────────────────────────────

/** All possible terrain types for a grid cell. */
export type TerrainType = 'grass' | 'forest' | 'marsh' | 'mountain' | 'river' | 'road' | 'foundation' | 'water';

/** Full description of a single terrain cell. */
export interface TerrainCell {
  /** Current terrain type. */
  type: TerrainType;
  /** Elevation offset (0 = flat, 1+ = raised). */
  elevation: number;
  /** Visual feature IDs for rendering (trees, rocks, etc.). */
  features: string[];
  /** Whether buildings can be placed here. Derived from type. */
  buildable: boolean;
  /** Pathfinding cost multiplier (1.0 = normal, Infinity = impassable). */
  movementCost: number;
  /** Timber yield when forest is cleared. Only present for forest cells. */
  timberYield?: number;
}

/** Terrain type → default properties lookup. */
export const TERRAIN_DEFAULTS: Record<TerrainType, { buildable: boolean; movementCost: number; elevation: number }> = {
  grass: { buildable: true, movementCost: 1.0, elevation: 0 },
  forest: { buildable: false, movementCost: 1.3, elevation: 0 },
  marsh: { buildable: true, movementCost: 1.5, elevation: 0 },
  mountain: { buildable: false, movementCost: Infinity, elevation: 2 },
  river: { buildable: false, movementCost: Infinity, elevation: 0 },
  road: { buildable: false, movementCost: 0.7, elevation: 0 },
  foundation: { buildable: false, movementCost: 1.0, elevation: 0 },
  water: { buildable: false, movementCost: Infinity, elevation: 0 },
};

// ─── Generation Options ─────────────────────────────────────────────────────

/** Configuration for procedural map generation. */
export interface MapGenerationOptions {
  /** Map size preset. */
  size: MapSize;
  /** Seed phrase for deterministic generation. */
  seed: string;
  /** Number of rivers to generate (0-2). */
  riverCount: number;
  /** Proportion of tiles that become forest (0.0-0.5). */
  forestDensity: number;
  /** Proportion of tiles that become marsh (0.0-0.2). */
  marshDensity: number;
  /** Proportion of tiles that become mountain (0.0-0.1). */
  mountainDensity: number;
}

/** Sensible defaults for map generation. */
export const DEFAULT_MAP_OPTIONS: MapGenerationOptions = {
  size: 'medium',
  seed: 'glorious-frozen-tractor',
  riverCount: 1,
  forestDensity: 0.15,
  marshDensity: 0.05,
  mountainDensity: 0.05,
};

// ─── Serialization Types ────────────────────────────────────────────────────

export interface SerializedCell {
  t: TerrainType;
  e: number;
  f: string[];
  ty?: number;
}

export interface SerializedMap {
  version: 1;
  size: number;
  options: MapGenerationOptions;
  cells: SerializedCell[][];
}
