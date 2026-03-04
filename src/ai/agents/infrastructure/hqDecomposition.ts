/**
 * @module ai/agents/infrastructure/hqDecomposition
 *
 * Multi-function HQ decomposition system.
 *
 * The settlement starts with a single government-hq that hosts all civic
 * functions (administration, storage, clinic, school, militia, canteen).
 * As population grows, functions split off into dedicated buildings —
 * mirroring how real Soviet settlements organically developed from a
 * single sel'sovet office into a proper settlement with dedicated services.
 *
 * Administration always stays in the HQ — it IS the HQ.
 */

/**
 * Functions that the settlement HQ can host.
 * Administration is permanent; all others can split off.
 */
export type HQFunction =
  | 'administration'
  | 'storage'
  | 'clinic'
  | 'canteen'
  | 'school'
  | 'militia_post';

/** Population thresholds at which functions split off from the HQ. */
export const HQ_FUNCTION_THRESHOLDS: Record<string, number> = {
  storage: 30,
  clinic: 50,
  canteen: 75,
  school: 100,
  militia_post: 150,
};

/** Ordered list of splittable functions by ascending population threshold. */
const SPLIT_ORDER: HQFunction[] = [
  'storage',
  'clinic',
  'canteen',
  'school',
  'militia_post',
];

/** Maps HQ function names to the building defId that replaces them. */
const FUNCTION_TO_BUILDING: Record<string, string> = {
  storage: 'warehouse',
  clinic: 'polyclinic',
  canteen: 'bread-factory',
  school: 'school',
  militia_post: 'guard-post',
};

/** Input representing the HQ building's current state. */
export interface HQBuilding {
  defId: string;
  functions: HQFunction[];
  gridX: number;
  gridY: number;
}

/** Result of a decomposition attempt. */
export interface DecompositionResult {
  success: boolean;
  removedFunction: HQFunction;
  remainingFunctions: HQFunction[];
  newBuildingDefId: string;
}

/**
 * Get all functions an HQ can host.
 * Returns a fresh array to prevent external mutation.
 */
export function getHQFunctions(): HQFunction[] {
  return [
    'administration',
    'storage',
    'clinic',
    'canteen',
    'school',
    'militia_post',
  ];
}

/**
 * Check which HQ functions are ready to split off based on population.
 *
 * Only returns functions that are:
 * 1. Still hosted by the HQ (present in currentFunctions)
 * 2. Above their population threshold (strict >)
 * 3. Not administration (permanent)
 *
 * Results are ordered by ascending threshold.
 *
 * @param population - Current settlement population
 * @param currentFunctions - Functions still hosted by the HQ
 * @returns Function names ready to split off
 */
export function checkDecompositionTriggers(
  population: number,
  currentFunctions: HQFunction[],
): HQFunction[] {
  const hosted = new Set(currentFunctions);
  return SPLIT_ORDER.filter(
    (fn) => hosted.has(fn) && population > HQ_FUNCTION_THRESHOLDS[fn],
  );
}

/**
 * Decompose a function out of the HQ into a dedicated building.
 *
 * Does NOT mutate the input — returns new arrays. The caller is responsible
 * for updating the HQ entity and spawning the new building in ECS.
 *
 * @param hqBuilding - Current HQ state
 * @param functionName - Function to split off
 * @returns DecompositionResult with the new building defId
 */
export function decomposeFunction(
  hqBuilding: HQBuilding,
  functionName: HQFunction,
): DecompositionResult {
  const remaining = [...hqBuilding.functions];

  // Administration cannot be decomposed — it IS the HQ
  if (functionName === 'administration') {
    return {
      success: false,
      removedFunction: functionName,
      remainingFunctions: remaining,
      newBuildingDefId: '',
    };
  }

  const idx = remaining.indexOf(functionName);
  if (idx === -1) {
    return {
      success: false,
      removedFunction: functionName,
      remainingFunctions: remaining,
      newBuildingDefId: '',
    };
  }

  remaining.splice(idx, 1);

  return {
    success: true,
    removedFunction: functionName,
    remainingFunctions: remaining,
    newBuildingDefId: FUNCTION_TO_BUILDING[functionName] ?? '',
  };
}
