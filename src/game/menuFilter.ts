/**
 * Mandate-Only Building Menu Filter
 *
 * Per the GDD: "The player does NOT choose which buildings to build
 * (the 5-Year Plan mandates them)."
 *
 * This module restricts the build menu to only mandated and
 * demand-requested buildings that are available in the current era.
 */

export interface MenuBuildingFilter {
  /** Building defIds from unfulfilled mandates. */
  mandatedDefIds: string[];
  /** Building defIds from worker demands. */
  demandedDefIds: string[];
  /** All building defIds available in the current era (for validation). */
  eraAvailableDefIds: string[];
}

/**
 * Returns the deduplicated list of building defIds that should appear
 * in the build menu. A building is included only if it is both
 * requested (by mandate OR demand) AND available in the current era.
 */
export function filterBuildingsForMenu(filter: MenuBuildingFilter): string[] {
  const eraSet = new Set(filter.eraAvailableDefIds);
  const result = new Set<string>();

  for (const defId of filter.mandatedDefIds) {
    if (eraSet.has(defId)) result.add(defId);
  }
  for (const defId of filter.demandedDefIds) {
    if (eraSet.has(defId)) result.add(defId);
  }

  return [...result];
}
