/**
 * BuildingFootprints — Maps game building types to sprite names and grid footprints.
 *
 * Now backed by the generated buildingDefs.generated.json instead of hardcoded data.
 * The pipeline script (scripts/generate_building_defs.ts) reads the sprite manifest
 * and calculates footprints from model_size via Math.round().
 *
 * Legacy API preserved: getSpriteForType() and getFootprint() still work with the
 * old 6-type game keys (power, housing, farm, distillery, gulag, road).
 */

import type { Footprint } from '@/data/buildingDefs';
import { BUILDING_DEFS, getFootprint as getFootprintFromDefs } from '@/data/buildingDefs';

export interface FootprintDef {
  spriteName: string;
  /** Grid width (cells in X). */
  w: number;
  /** Grid height (cells in Y). */
  h: number;
}

/**
 * Maps legacy game type keys to sprite IDs.
 * Used by getSpriteForType() until the toolbar is expanded to 31 building types.
 */
const LEGACY_TYPE_TO_SPRITE: Record<string, string> = {
  power: 'power-station',
  housing: 'apartment-tower-a',
  farm: 'collective-farm-hq',
  distillery: 'vodka-distillery',
  gulag: 'gulag-admin',
};

/** Get the sprite name for a building type. Handles both legacy and sprite IDs. */
export function getSpriteForType(buildingType: string): string {
  // Direct sprite ID?
  if (BUILDING_DEFS[buildingType]) return buildingType;
  // Legacy game type?
  return LEGACY_TYPE_TO_SPRITE[buildingType] ?? '';
}

/** Get the footprint for a building type. Defaults to 1×1 if unknown. */
export function getFootprint(buildingType: string): { w: number; h: number } {
  const spriteId = getSpriteForType(buildingType);
  if (!spriteId) return { w: 1, h: 1 };
  const fp: Footprint = getFootprintFromDefs(spriteId);
  return { w: fp.tilesX, h: fp.tilesY };
}

/**
 * All available building sprites organized by role.
 * Derived from the generated building defs.
 */
export function getSpriteVariants(): Record<string, FootprintDef[]> {
  const variants: Record<string, FootprintDef[]> = {};
  for (const [id, def] of Object.entries(BUILDING_DEFS)) {
    const role = def.role;
    if (!variants[role]) variants[role] = [];
    variants[role].push({
      spriteName: id,
      w: def.footprint.tilesX,
      h: def.footprint.tilesY,
    });
  }
  return variants;
}
