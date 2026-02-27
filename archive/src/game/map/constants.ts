/**
 * @module game/map/constants
 *
 * Visual feature arrays and spatial constants for map generation.
 */

/** Cardinal direction offsets for BFS neighbor expansion. */
export const CARDINAL_DIRS: readonly [number, number][] = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
];

export const FOREST_FEATURES = ['pine-tree', 'birch-tree', 'spruce-tree', 'fallen-log'];
export const MOUNTAIN_FEATURES = ['rock-outcrop', 'boulder', 'cliff-face', 'snow-peak'];
export const MARSH_FEATURES = ['reeds', 'puddle', 'dead-tree', 'moss-patch'];
