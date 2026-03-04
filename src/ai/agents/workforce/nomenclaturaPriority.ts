/**
 * @fileoverview Nomenclatura priority housing system.
 *
 * Soviet elite (nomenclatura) claim priority housing and can evict
 * lower-priority residents. Priority order (highest to lowest):
 * KGB > military_officer > party_official > government_worker > worker > kolkhoznik.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** Extended citizen class hierarchy for housing priority. */
export type CitizenClass =
  | 'kgb'
  | 'military_officer'
  | 'party_official'
  | 'government_worker'
  | 'worker'
  | 'kolkhoznik';

/** A resident occupying housing. */
export interface HousingResident {
  /** Unique citizen ID */
  id: string;
  /** Citizen class determining priority */
  citizenClass: CitizenClass;
}

/** A housing building with capacity and current residents. */
export interface HousingBuilding {
  /** Building ID */
  id: string;
  /** Maximum number of residents */
  capacity: number;
  /** Current residents */
  residents: HousingResident[];
}

/** Result of a housing claim attempt. */
export interface ClaimResult {
  /** Whether the citizen was successfully housed */
  housed: boolean;
  /** Residents evicted to make room (only if eviction occurred) */
  evicted?: HousingResident[];
  /** Building ID where citizen was placed */
  building?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Priority order from highest to lowest. */
export const PRIORITY_ORDER: readonly CitizenClass[] = [
  'kgb',
  'military_officer',
  'party_official',
  'government_worker',
  'worker',
  'kolkhoznik',
];

/** Priority value by class (higher = more privileged). */
const PRIORITY_MAP: Record<CitizenClass, number> = {
  kgb: 6,
  military_officer: 5,
  party_official: 4,
  government_worker: 3,
  worker: 2,
  kolkhoznik: 1,
};

/** Classes considered nomenclatura (Soviet elite). */
const NOMENCLATURA_CLASSES: ReadonlySet<CitizenClass> = new Set([
  'kgb',
  'military_officer',
  'party_official',
  'government_worker',
]);

// ─── Functions ────────────────────────────────────────────────────────────────

/**
 * Returns the numeric priority for a citizen class.
 * @param citizenClass - The class to look up
 * @returns Priority number (6=highest kgb, 1=lowest kolkhoznik)
 */
export function getCitizenPriority(citizenClass: CitizenClass): number {
  return PRIORITY_MAP[citizenClass];
}

/**
 * Returns whether a citizen class belongs to the nomenclatura (Soviet elite).
 * @param citizenClass - The class to check
 * @returns true for kgb, military_officer, party_official, government_worker
 */
export function isNomenclatura(citizenClass: CitizenClass): boolean {
  return NOMENCLATURA_CLASSES.has(citizenClass);
}

/**
 * Attempts to house a citizen, evicting a lower-priority resident if needed.
 *
 * Rules:
 * - Prefers open slots over eviction
 * - Only evicts residents with strictly lower priority
 * - Evicts the single lowest-priority resident across all buildings
 * - Evicted residents become displaced dvory (handled by motivation system)
 *
 * @param citizen - The citizen seeking housing
 * @param housingBuildings - All housing buildings in the settlement
 * @returns ClaimResult indicating success, evictions, and target building
 */
export function claimHousing(citizen: HousingResident, housingBuildings: HousingBuilding[]): ClaimResult {
  const claimerPriority = getCitizenPriority(citizen.citizenClass);

  // First pass: find a building with an open slot
  for (const building of housingBuildings) {
    if (building.capacity > 0 && building.residents.length < building.capacity) {
      return { housed: true, building: building.id };
    }
  }

  // Second pass: find the lowest-priority resident we can evict
  let lowestResident: HousingResident | null = null;
  let lowestPriority = claimerPriority; // must be strictly lower than claimer
  let targetBuildingId: string | null = null;

  for (const building of housingBuildings) {
    if (building.capacity <= 0) continue;
    for (const resident of building.residents) {
      const resPriority = getCitizenPriority(resident.citizenClass);
      if (resPriority < lowestPriority) {
        lowestPriority = resPriority;
        lowestResident = resident;
        targetBuildingId = building.id;
      }
    }
  }

  if (lowestResident && targetBuildingId) {
    return {
      housed: true,
      building: targetBuildingId,
      evicted: [lowestResident],
    };
  }

  return { housed: false };
}
