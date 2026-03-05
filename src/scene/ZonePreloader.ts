/**
 * ZonePreloader — Preloads assets for a specific load zone.
 *
 * Instead of preloading ALL models at startup, this loads only the models
 * needed for the active settlement's load zone. Used by:
 * - Initial game load: preloads the starting Earth zone
 * - Settlement transitions: preloads the target zone during fade-to-black
 *
 * Works alongside ModelPreloader (which still preloads everything for backward compat).
 * ZonePreloader adds HDRI pre-fetch and zone-specific progress tracking.
 */

import { useGLTF } from '@react-three/drei';
import manifest from '../../assets/models/soviet/manifest.json';
import polyhavenManifest from '../../assets/polyhaven-manifest.json';
import { assetUrl } from '../utils/assetPath';
import type { LoadZone } from './loadZones';

/** Progress callback signature. */
export type ZoneLoadProgress = {
  loaded: number;
  total: number;
  name: string;
  phase: 'models' | 'textures' | 'hdri' | 'complete';
};

/**
 * Get the list of model URLs that need to be preloaded for a given load zone.
 * Matches zone.modelRoles against manifest.json roles.
 */
export function getZoneModelUrls(zone: LoadZone): string[] {
  const urls: string[] = [];
  const roles = manifest.roles as Record<string, string[]>;

  for (const rolePrefix of zone.modelRoles) {
    // Check exact role match first
    if (roles[rolePrefix]) {
      for (const modelName of roles[rolePrefix]) {
        const asset = (manifest.assets as Record<string, { file: string }>)[modelName];
        if (asset) {
          urls.push(assetUrl(`assets/${asset.file}`));
        }
      }
    }
    // Also check models whose role starts with the prefix
    for (const [roleName, modelNames] of Object.entries(roles)) {
      if (roleName.startsWith(rolePrefix) && roleName !== rolePrefix) {
        for (const modelName of modelNames) {
          const asset = (manifest.assets as Record<string, { file: string }>)[modelName];
          if (asset) {
            urls.push(assetUrl(`assets/${asset.file}`));
          }
        }
      }
    }
  }

  // Add Poly Haven models mapped to this zone
  for (const entry of polyhavenManifest) {
    if (entry.type === 'model' && entry.localPath) {
      // Poly Haven models are always loaded (small GLBs, useful as props everywhere)
      urls.push(assetUrl(entry.localPath));
    }
  }

  return [...new Set(urls)]; // Deduplicate
}

/**
 * Get the HDRI URL for a load zone.
 */
export function getZoneHdriUrl(zone: LoadZone): string {
  return assetUrl(`assets/hdri/${zone.hdri}`);
}

/**
 * Preload all assets for a load zone using drei's useGLTF.preload.
 * Returns the total count of assets to preload.
 */
export function preloadZone(zone: LoadZone): number {
  const modelUrls = getZoneModelUrls(zone);

  for (const url of modelUrls) {
    useGLTF.preload(url);
  }

  // HDRI preloading is handled by drei's <Environment> component on first render.
  // We just return the count for progress tracking.
  return modelUrls.length + 1; // +1 for HDRI
}

/**
 * Get the total asset count for a zone (for progress bar total).
 */
export function getZoneAssetCount(zone: LoadZone): number {
  return getZoneModelUrls(zone).length + 1; // models + HDRI
}
