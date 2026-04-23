/**
 * Contamination zone system — Chernobyl-style nuclear/industrial/chemical contamination.
 * Zones spread over time and decay with source-type-specific half-lives.
 * All pure functions, no ECS or DB dependencies.
 */

export type ContaminationSourceType = 'nuclear' | 'industrial' | 'chemical';

export interface ContaminationZone {
  centerX: number;
  centerY: number;
  radius: number;
  intensity: number; // 0-1
  sourceType: ContaminationSourceType;
  yearCreated: number;
}

/** Half-life in years by source type. */
const HALF_LIFE: Record<ContaminationSourceType, number> = {
  nuclear: 30,
  industrial: 10,
  chemical: 5,
};

/** Maximum radius a contamination zone can reach. */
const MAX_RADIUS = 20;

/** Radius growth rate in tiles per year. */
const SPREAD_RATE = 0.5;

/** Contamination level threshold for habitability. */
const HABITABLE_THRESHOLD = 0.3;

/**
 * Create a new contamination zone.
 * @param centerX - X coordinate of the zone center
 * @param centerY - Y coordinate of the zone center
 * @param radius - Initial radius in tiles
 * @param intensity - Initial intensity (clamped to 0-1)
 * @param sourceType - Type of contamination source
 * @param yearCreated - Year the contamination event occurred
 */
export function createContaminationZone(
  centerX: number,
  centerY: number,
  radius: number,
  intensity: number,
  sourceType: ContaminationSourceType,
  yearCreated: number,
): ContaminationZone {
  return {
    centerX,
    centerY,
    radius: Math.max(0, radius),
    intensity: Math.max(0, Math.min(1, intensity)),
    sourceType,
    yearCreated,
  };
}

/**
 * Spread contamination — radius grows by 0.5 tiles/year until max.
 * @param zone - The contamination zone
 * @param currentYear - Current simulation year
 * @returns Updated zone with expanded radius
 */
export function spreadContamination(zone: ContaminationZone, currentYear: number): ContaminationZone {
  const elapsed = currentYear - zone.yearCreated;
  if (elapsed <= 0) return { ...zone };
  const newRadius = Math.min(MAX_RADIUS, zone.radius + elapsed * SPREAD_RATE);
  return { ...zone, radius: newRadius };
}

/**
 * Decay contamination intensity using half-life model.
 * Nuclear: 30yr, Industrial: 10yr, Chemical: 5yr.
 * @param zone - The contamination zone
 * @param currentYear - Current simulation year
 * @returns Updated zone with decayed intensity
 */
export function decayContamination(zone: ContaminationZone, currentYear: number): ContaminationZone {
  const elapsed = currentYear - zone.yearCreated;
  if (elapsed <= 0) return { ...zone };
  const halfLife = HALF_LIFE[zone.sourceType];
  const decayedIntensity = zone.intensity * 0.5 ** (elapsed / halfLife);
  return { ...zone, intensity: decayedIntensity };
}

/**
 * Get total contamination level at a point from all zones.
 * Uses inverse-square distance falloff within each zone's radius.
 * @param x - X coordinate to query
 * @param y - Y coordinate to query
 * @param zones - All active contamination zones
 * @returns Contamination level (0-1), capped at 1.0
 */
export function getContaminationAt(x: number, y: number, zones: ContaminationZone[]): number {
  let total = 0;
  for (const zone of zones) {
    const dx = x - zone.centerX;
    const dy = y - zone.centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist >= zone.radius) continue;
    // Inverse-square falloff: full intensity at center, zero at edge
    const normalized = dist / zone.radius; // 0 at center, 1 at edge
    const falloff = 1 / (1 + (normalized / (1 - normalized + 1e-9)) ** 2);
    total += zone.intensity * falloff;
  }
  return Math.min(1, total);
}

/**
 * Check if a contamination level is habitable.
 * @param contaminationLevel - Contamination level (0-1)
 * @returns true if level < 0.3
 */
export function isHabitable(contaminationLevel: number): boolean {
  return contaminationLevel < HABITABLE_THRESHOLD;
}
