/**
 * BuildingFootprints — Maps building def IDs to sprite names and grid footprints.
 *
 * Backed by the generated buildingDefs.generated.json (via the Zod-validated data layer).
 * The pipeline script (scripts/generate_building_defs.ts) reads the sprite manifest
 * and calculates footprints from model_size via Math.round().
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
 * Resolve the sprite name for a building definition ID.
 *
 * @param defId - The building definition ID to resolve
 * @returns The sprite name matching `defId` if present in BUILDING_DEFS, otherwise an empty string
 */
export function getSpriteForType(defId: string): string {
  return BUILDING_DEFS[defId] ? defId : '';
}

/**
 * Retrieve the grid footprint for a building definition ID.
 *
 * @param defId - The building definition ID to look up
 * @returns The footprint as `{ w, h }` where `w` and `h` are the width and height in grid cells; returns `{ w: 1, h: 1 }` if `defId` is falsy or unknown
 */
export function getFootprint(defId: string): { w: number; h: number } {
  if (!defId || !BUILDING_DEFS[defId]) return { w: 1, h: 1 };
  const fp: Footprint = getFootprintFromDefs(defId);
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