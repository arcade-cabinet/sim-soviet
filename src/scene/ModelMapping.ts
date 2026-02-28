/**
 * ModelMapping — maps game building types + density levels to GLB model names.
 *
 * Also provides tier-based model variant selection: some building defIds
 * have visual variants that change based on settlement tier. For example,
 * workers-house-a (selo) can visually upgrade to workers-house-b (posyolok)
 * without changing the underlying game entity.
 */

import type { SettlementTier } from '../game/SettlementSystem';

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

// ── Tier-based model variant overrides ──────────────────────────────────────

/**
 * Maps a building defId to a different GLB model based on settlement tier.
 *
 * Only building types with multiple visual variants are listed here.
 * Buildings not in this map always render their own defId model.
 *
 * Housing progression:
 *   - selo:     Small wooden houses (workers-house-a)
 *   - posyolok: Larger houses (workers-house-b/c)
 *   - pgt:      Low-rise towers (apartment-tower-a/b)
 *   - gorod:    Full apartment blocks (apartment-tower-c/d)
 */
export const TIER_MODEL_VARIANTS: Readonly<Partial<Record<string, Record<SettlementTier, string>>>> = {
  // Small houses upgrade to larger houses, then apartment towers
  'workers-house-a': {
    selo: 'workers-house-a',
    posyolok: 'workers-house-b',
    pgt: 'workers-house-b',
    gorod: 'workers-house-c',
  },
  'workers-house-b': {
    selo: 'workers-house-b',
    posyolok: 'workers-house-b',
    pgt: 'workers-house-c',
    gorod: 'workers-house-c',
  },
  // Apartment towers get taller/more elaborate at higher tiers
  'apartment-tower-a': {
    selo: 'apartment-tower-a',
    posyolok: 'apartment-tower-a',
    pgt: 'apartment-tower-b',
    gorod: 'apartment-tower-c',
  },
  'apartment-tower-b': {
    selo: 'apartment-tower-a',
    posyolok: 'apartment-tower-b',
    pgt: 'apartment-tower-c',
    gorod: 'apartment-tower-d',
  },
  'apartment-tower-c': {
    selo: 'apartment-tower-b',
    posyolok: 'apartment-tower-c',
    pgt: 'apartment-tower-c',
    gorod: 'apartment-tower-d',
  },
};

/**
 * Get the visual model variant for a building defId at the given tier.
 * Returns the defId itself if no tier variant exists.
 */
export function getTierVariant(defId: string, tier: SettlementTier): string {
  return TIER_MODEL_VARIANTS[defId]?.[tier] ?? defId;
}

/**
 * Get the GLB model name for a building type and density level.
 * Returns null if the building type is not recognized.
 */
export function getModelName(type: string, level: number = 0): string | null {
  const entry = MODEL_MAP[type as BuildingType];
  if (!entry) return null;
  const clamped = Math.max(0, Math.min(2, Math.floor(level)));
  return entry[clamped];
}

/**
 * All known building types.
 */
export const BUILDING_TYPES = Object.keys(MODEL_MAP) as BuildingType[];
