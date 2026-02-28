/**
 * ModelMapping — maps game building types + density levels to GLB model names.
 */

type BuildingType =
  | 'housing'
  | 'factory'
  | 'distillery'
  | 'farm'
  | 'power'
  | 'nuke'
  | 'gulag'
  | 'tower'
  | 'pump'
  | 'station'
  | 'mast'
  | 'space';

/** Level-indexed model names. Index = density level (0, 1, 2). */
const MODEL_MAP: Record<BuildingType, readonly [string, string, string]> = {
  housing: ['workers-house-a', 'apartment-tower-a', 'apartment-tower-c'],
  factory: ['warehouse', 'factory-office', 'bread-factory'],
  distillery: ['vodka-distillery', 'vodka-distillery', 'vodka-distillery'],
  farm: ['collective-farm-hq', 'collective-farm-hq', 'collective-farm-hq'],
  power: ['power-station', 'power-station', 'power-station'],
  nuke: ['cooling-tower', 'cooling-tower', 'cooling-tower'],
  gulag: ['gulag-admin', 'gulag-admin', 'gulag-admin'],
  tower: ['radio-station', 'radio-station', 'radio-station'],
  pump: ['concrete-block', 'concrete-block', 'concrete-block'],
  station: ['train-station', 'train-station', 'train-station'],
  mast: ['guard-post', 'guard-post', 'guard-post'],
  space: ['government-hq', 'government-hq', 'government-hq'],
};

/**
 * Get the GLB model name for a building type and density level.
 * Returns null if the building type is not recognized.
 */
export function getModelName(
  type: string,
  level: number = 0,
): string | null {
  const entry = MODEL_MAP[type as BuildingType];
  if (!entry) return null;
  const clamped = Math.max(0, Math.min(2, Math.floor(level)));
  return entry[clamped];
}

/**
 * All known building types.
 */
export const BUILDING_TYPES = Object.keys(MODEL_MAP) as BuildingType[];
