/**
 * Viewport spatial query — pure math functions for camera-based building visibility.
 * No Three.js imports; operates on axis-aligned bounding boxes and 2D grid positions.
 */

export interface VisibleBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface BuildingPosition {
  id: string;
  x: number;
  z: number;
}

export interface LoadSet {
  toLoad: string[];
  toUnload: string[];
}

/**
 * Compute an axis-aligned bounding box from camera position and view distance.
 * @param cameraX - Camera X position in world space
 * @param cameraZ - Camera Z position in world space
 * @param viewDistance - Half the visible range (camera height dependent)
 */
export function getVisibleBounds(
  cameraX: number,
  cameraZ: number,
  viewDistance: number,
): VisibleBounds {
  return {
    minX: cameraX - viewDistance,
    maxX: cameraX + viewDistance,
    minZ: cameraZ - viewDistance,
    maxZ: cameraZ + viewDistance,
  };
}

/**
 * Filter buildings to those within the given bounds (inclusive).
 * @param bounds - Axis-aligned bounding box
 * @param buildings - Array of building positions with IDs
 * @returns IDs of buildings within bounds
 */
export function queryVisibleBuildings(
  bounds: VisibleBounds,
  buildings: BuildingPosition[],
): string[] {
  const result: string[] = [];
  for (const b of buildings) {
    if (
      b.x >= bounds.minX &&
      b.x <= bounds.maxX &&
      b.z >= bounds.minZ &&
      b.z <= bounds.maxZ
    ) {
      result.push(b.id);
    }
  }
  return result;
}

/**
 * Compute incremental load/unload diff between newly visible and currently loaded buildings.
 * @param newVisible - IDs of buildings now visible
 * @param currentLoaded - IDs of buildings currently loaded
 * @returns Objects to load (in newVisible but not currentLoaded) and unload (in currentLoaded but not newVisible)
 */
export function getLoadSet(
  newVisible: string[],
  currentLoaded: string[],
): LoadSet {
  const visibleSet = new Set(newVisible);
  const loadedSet = new Set(currentLoaded);

  const toLoad: string[] = [];
  for (const id of newVisible) {
    if (!loadedSet.has(id)) {
      toLoad.push(id);
    }
  }

  const toUnload: string[] = [];
  for (const id of currentLoaded) {
    if (!visibleSet.has(id)) {
      toUnload.push(id);
    }
  }

  return { toLoad, toUnload };
}
