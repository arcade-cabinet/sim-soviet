/**
 * Asset path helper — resolves correct base URL for static assets.
 *
 * In development (Metro dev server), assets are served from the root.
 * In production (GitHub Pages), they need the /sim-soviet/ prefix
 * matching Expo's experiments.baseUrl.
 */

const BASE_URL =
  process.env.NODE_ENV === 'production'
    ? '/sim-soviet'
    : '';

/** Resolve a path like "assets/models/foo.glb" or "/assets/hdri/bar.hdr" */
export function assetUrl(path: string): string {
  // Strip leading slash if present for consistency
  const clean = path.startsWith('/') ? path.slice(1) : path;
  return `${BASE_URL}/${clean}`;
}
