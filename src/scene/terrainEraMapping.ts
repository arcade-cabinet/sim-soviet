/**
 * terrainEraMapping — maps game eras to terrain visual states.
 *
 * 8 eras collapse to 6 visual states because some eras share terrain:
 *   State 1: revolution + collectivization → snowy taiga
 *   State 2: industrialization → muddy churned earth
 *   State 3: great_patriotic → scorched ash
 *   State 4: reconstruction + thaw_and_freeze → recovering green
 *   State 5: stagnation → grey concrete dust
 *   State 6: the_eternal → permafrost thaw (orange-red cracked earth)
 */

import type { EraId } from '../game/era/types';

/** Terrain visual state identifier — 6 distinct ground appearances. */
export type TerrainVisualState =
  | 'snowy_taiga'
  | 'muddy_earth'
  | 'scorched_ash'
  | 'recovering_green'
  | 'concrete_dust'
  | 'permafrost_thaw';

/** All 6 terrain visual states in chronological progression order. */
export const TERRAIN_STATE_ORDER: readonly TerrainVisualState[] = [
  'snowy_taiga',
  'muddy_earth',
  'scorched_ash',
  'recovering_green',
  'concrete_dust',
  'permafrost_thaw',
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
      return 'permafrost_thaw';
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
