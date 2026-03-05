/**
 * ModelMapping — maps game building types + density levels to GLB model names.
 *
 * Also provides tier-based model variant selection: some building defIds
 * have visual variants that change based on settlement tier. For example,
 * workers-house-a (selo) can visually upgrade to workers-house-b (posyolok)
 * without changing the underlying game entity.
 *
 * Era-driven overrides allow different historical eras to use entirely
 * different model sets for the same building type (e.g. space-colony
 * housing in the_eternal era).
 */

import type { SettlementTier } from '../ai/agents/infrastructure/SettlementSystem';

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

// ── Era-based model overrides ────────────────────────────────────────────────

/**
 * Era-keyed overrides for building type → model name.
 *
 * When the game is in a specific era, these override MODEL_MAP entries.
 * Only eras with distinct visual identities need entries here —
 * missing eras fall through to the default MODEL_MAP.
 *
 * Each entry maps BuildingType → [level0, level1, level2] model names,
 * same structure as MODEL_MAP.
 *
 * Placeholder model names (prefixed with era) are used until GLB
 * conversions are complete. The pipeline resolves them through
 * getModelUrl() which returns '' for unknown models, causing
 * BuildingRenderer to skip rendering — graceful degradation.
 */
export const ERA_MODEL_MAP: Readonly<
  Partial<Record<string, Partial<Record<BuildingType, readonly [string, string, string]>>>>
> = {
  the_eternal: {
    housing: ['colony-habitat-a', 'colony-habitat-b', 'colony-habitat-c'],
    factory: ['colony-workshop', 'colony-factory', 'colony-megafactory'],
    distillery: ['colony-synthplant', 'colony-synthplant', 'colony-synthplant'],
    farm: ['colony-hydroponics', 'colony-hydroponics', 'colony-hydroponics'],
    power: ['colony-reactor', 'colony-reactor', 'colony-reactor'],
    nuke: ['colony-fusion', 'colony-fusion', 'colony-fusion'],
    tower: ['colony-antenna', 'colony-antenna', 'colony-antenna'],
    space: ['colony-command', 'colony-command', 'colony-command'],
  },
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
 *
 * @param defId - Building definition ID
 * @param tier - Current settlement tier
 * @returns GLB model name to use for rendering
 */
export function getTierVariant(defId: string, tier: SettlementTier): string {
  return TIER_MODEL_VARIANTS[defId]?.[tier] ?? defId;
}

/**
 * Get the GLB model name for a building type, density level, and era.
 *
 * Resolution order: ERA_MODEL_MAP[era][type] > MODEL_MAP[type] > null.
 * Era overrides only apply when both the era and building type have an
 * entry in ERA_MODEL_MAP.
 *
 * @param type - Building type string (e.g. 'housing', 'factory')
 * @param level - Density level 0-2 (default 0)
 * @param era - Optional era identifier for era-specific model sets
 * @returns GLB model name, or null if the building type is not recognized
 */
export function getModelName(type: string, level: number = 0, era?: string): string | null {
  const clamped = Math.max(0, Math.min(2, Math.floor(level)));

  // Check era-specific override first
  if (era) {
    const eraEntry = ERA_MODEL_MAP[era]?.[type as BuildingType];
    if (eraEntry) return eraEntry[clamped];
  }

  // Fall back to default MODEL_MAP
  const entry = MODEL_MAP[type as BuildingType];
  if (!entry) return null;
  return entry[clamped];
}

/**
 * All known building types.
 */
export const BUILDING_TYPES = Object.keys(MODEL_MAP) as BuildingType[];
