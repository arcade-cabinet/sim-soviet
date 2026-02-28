/**
 * Asset path helper — resolves correct base URL for static assets.
 *
 * Web:
 *   In development (Metro dev server), assets are served from the root.
 *   In production (GitHub Pages), they need the /sim-soviet/ prefix
 *   matching Expo's experiments.baseUrl.
 *
 * Native:
 *   Assets are bundled via Expo's asset system. Paths are relative
 *   (no base URL prefix needed).
 */

import { Platform } from 'react-native';

const BASE_URL = Platform.OS === 'web'
  ? (process.env.NODE_ENV === 'production' ? '/sim-soviet' : '')
  : '';

/** Resolve a path like "assets/models/foo.glb" or "/assets/hdri/bar.hdr" */
export function assetUrl(path: string): string {
  // Strip leading slash if present for consistency
  const clean = path.startsWith('/') ? path.slice(1) : path;
  if (Platform.OS === 'web') {
    return `${BASE_URL}/${clean}`;
  }
  // Native: assets are bundled via Expo's asset system
  return clean;
}
