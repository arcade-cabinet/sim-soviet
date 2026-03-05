/**
 * terrainEraMapping — maps game eras to terrain visual states.
 *
 * 8 eras collapse to 6 visual states because some eras share terrain:
 *   State 1: revolution + collectivization → snowy taiga
 *   State 2: industrialization → muddy churned earth
 *   State 3: great_patriotic → scorched ash
 *   State 4: reconstruction + thaw_and_freeze → recovering green
 *   State 5: stagnation → grey concrete dust (AsphaltDamageSet001 decay overlay)
 *   State 6: the_eternal → permafrost thaw (orange-red cracked earth)
 *
 * Decay overlay textures (AmbientCG packs):
 *   - AsphaltDamageSet001: cracked pavement overlay for stagnation
 *   - AsphaltDamageSet002: heavier damage for post-collapse events
 *   - Foliage001: dead winter ground vegetation for early eras
 *   - Ground054: cratered/pockmarked bomb damage for great_patriotic
 *   - Concrete022: weathered cracked concrete for stagnation
 */

import type { EraId } from '../game/era/types';

/** Terrain visual state identifier — 6 distinct ground appearances. */
export type TerrainVisualState =
  | 'snowy_taiga'
  | 'muddy_earth'
  | 'scorched_ash'
  | 'recovering_green'
  | 'concrete_dust'
  | 'permafrost_thaw'
  | 'warm_grassland'
  | 'industrial_metal'
  | 'dyson_plate';

/** All 9 terrain visual states in chronological progression order. */
export const TERRAIN_STATE_ORDER: readonly TerrainVisualState[] = [
  'snowy_taiga',
  'muddy_earth',
  'scorched_ash',
  'recovering_green',
  'concrete_dust',
  'permafrost_thaw',
  'warm_grassland',
  'industrial_metal',
  'dyson_plate',
] as const;

/**
 * Map an EraId to its terrain visual state.
 * @param era - The current game era
 * @returns The terrain visual state for that era
 */
export function eraToTerrainState(era: EraId): TerrainVisualState {
  switch (era) {
    case 'revolution':
    case 'collectivization':
      return 'snowy_taiga';
    case 'industrialization':
      return 'muddy_earth';
    case 'great_patriotic':
      return 'scorched_ash';
    case 'reconstruction':
    case 'thaw_and_freeze':
      return 'recovering_green';
    case 'stagnation':
      return 'concrete_dust';
    case 'the_eternal':
    case 'post_soviet':
      return 'permafrost_thaw';
    case 'planetary':
      return 'warm_grassland';
    case 'solar_engineering':
    case 'type_one':
      return 'industrial_metal';
    case 'deconstruction':
    case 'dyson_swarm':
    case 'megaearth':
    case 'type_two_peak':
      return 'dyson_plate';
  }
}

/**
 * Ground material color tint per terrain state.
 * Applied as MeshStandardMaterial.color to shift texture hue.
 */
export const TERRAIN_STATE_COLORS: Record<TerrainVisualState, string> = {
  snowy_taiga: '#e6ebf2', // cold white
  muddy_earth: '#8a7a62', // brown-grey mud
  scorched_ash: '#4a4040', // dark ash grey
  recovering_green: '#7a9966', // muted green recovery
  concrete_dust: '#9a9590', // grey-brown industrial
  permafrost_thaw: '#c45a30', // orange-red cracked earth
  warm_grassland: '#8aaa66', // warm green (post-permafrost recovery)
  industrial_metal: '#707880', // blue-gray steel
  dyson_plate: '#505560', // dark gunmetal (Dyson swarm panel)
};

/**
 * Hill color per terrain state.
 */
export const TERRAIN_HILL_COLORS: Record<TerrainVisualState, string> = {
  snowy_taiga: '#d1d6e0',
  muddy_earth: '#6b5e4a',
  scorched_ash: '#3a3535',
  recovering_green: '#526b38',
  concrete_dust: '#6b6560',
  permafrost_thaw: '#8a4a25',
  warm_grassland: '#4a7030', // verdant green hills
  industrial_metal: '#555a62', // steel-gray structures
  dyson_plate: '#3a3e45', // dark metal horizon
};

/**
 * Texture file prefix per terrain state (maps to assets/textures/terrain/).
 * Each state has Color, NormalGL, and Roughness JPG files.
 */
export const TERRAIN_TEXTURE_PREFIX: Record<TerrainVisualState, string> = {
  snowy_taiga: 'Snow003',
  muddy_earth: 'Ground007',
  scorched_ash: 'Ground042',
  recovering_green: 'Ground003',
  concrete_dust: 'Concrete034',
  permafrost_thaw: 'Lava004',
  warm_grassland: 'Grass001',
  industrial_metal: 'metal_plate',
  dyson_plate: 'Metal038',
};

/**
 * Get texture filenames for a terrain visual state.
 * @param state - The terrain visual state
 * @returns Object with color, normal, roughness file paths (relative to assets/)
 */
export function getTerrainTextureFiles(state: TerrainVisualState): {
  color: string;
  normal: string;
  roughness: string;
} {
  const prefix = TERRAIN_TEXTURE_PREFIX[state];
  const dir = `assets/textures/terrain/${prefix}`;
  return {
    color: `${dir}/${prefix}_1K-JPG_Color.jpg`,
    normal: `${dir}/${prefix}_1K-JPG_NormalGL.jpg`,
    roughness: `${dir}/${prefix}_1K-JPG_Roughness.jpg`,
  };
}

/**
 * Get the numeric index of a terrain visual state (0-5) for interpolation.
 */
export function terrainStateIndex(state: TerrainVisualState): number {
  return TERRAIN_STATE_ORDER.indexOf(state);
}

// ── Decay overlay textures (AmbientCG ATLAS packs) ─────────────────────────

/** Decay overlay identifier for terrain damage effects. */
export type DecayOverlayId =
  | 'cracked_pavement'
  | 'heavy_damage'
  | 'dead_foliage'
  | 'bomb_craters'
  | 'weathered_concrete';

/** Configuration for a decay overlay texture layer. */
export interface DecayOverlayConfig {
  /** AmbientCG pack prefix (directory + file prefix). */
  prefix: string;
  /** Base directory under assets/textures/terrain/. */
  dir: string;
  /** Opacity of the overlay (0-1). */
  opacity: number;
  /** Optional emissive tint color (hex). Applied to damage textures for scorch effects. */
  emissiveTint?: string;
  /** Emissive intensity (0-1). */
  emissiveIntensity?: number;
}

/**
 * Decay overlay textures — layered on top of the base terrain state.
 * Used for stagnation-era cracking, post-collapse scorching, and dead vegetation.
 */
export const DECAY_OVERLAYS: Record<DecayOverlayId, DecayOverlayConfig> = {
  cracked_pavement: {
    prefix: 'AsphaltDamageSet001',
    dir: 'AsphaltDamageSet001',
    opacity: 0.6,
  },
  heavy_damage: {
    prefix: 'AsphaltDamageSet002',
    dir: 'AsphaltDamageSet002',
    opacity: 0.75,
    emissiveTint: '#c45a30',
    emissiveIntensity: 0.3,
  },
  dead_foliage: {
    prefix: 'Foliage001',
    dir: 'Foliage001',
    opacity: 0.5,
  },
  bomb_craters: {
    prefix: 'Ground054',
    dir: 'decay/Ground054',
    opacity: 0.65,
    emissiveTint: '#2a1a0a',
    emissiveIntensity: 0.15,
  },
  weathered_concrete: {
    prefix: 'Concrete022',
    dir: 'decay/Concrete022',
    opacity: 0.5,
  },
};

/**
 * Which decay overlays apply to each terrain visual state (if any).
 * Overlays are rendered as additional transparent texture planes on top of the base.
 */
export const TERRAIN_DECAY_OVERLAYS: Partial<Record<TerrainVisualState, DecayOverlayId[]>> = {
  snowy_taiga: ['dead_foliage'],
  scorched_ash: ['bomb_craters'],
  concrete_dust: ['weathered_concrete', 'cracked_pavement'],
  permafrost_thaw: ['heavy_damage'],
};

/**
 * Get texture file paths for a decay overlay.
 * @param overlay - The decay overlay configuration
 * @returns Object with color, normal, roughness file paths (relative to assets/)
 */
export function getDecayOverlayFiles(overlay: DecayOverlayConfig): {
  color: string;
  normal: string;
  roughness: string;
} {
  const { prefix, dir } = overlay;
  const base = `assets/textures/terrain/${dir}`;
  return {
    color: `${base}/${prefix}_1K-JPG_Color.jpg`,
    normal: `${base}/${prefix}_1K-JPG_NormalGL.jpg`,
    roughness: `${base}/${prefix}_1K-JPG_Roughness.jpg`,
  };
}

/**
 * Collect all texture paths that should be preloaded for a given terrain visual state.
 * Includes base textures + any decay overlays.
 */
export function getAllTexturePathsForState(state: TerrainVisualState): string[] {
  const base = getTerrainTextureFiles(state);
  const paths = [base.color, base.normal, base.roughness];

  const overlayIds = TERRAIN_DECAY_OVERLAYS[state];
  if (overlayIds) {
    for (const id of overlayIds) {
      const overlay = DECAY_OVERLAYS[id];
      const files = getDecayOverlayFiles(overlay);
      paths.push(files.color, files.normal, files.roughness);
    }
  }

  return paths;
}
