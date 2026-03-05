/**
 * @module game/engine/locationResources
 *
 * Derives environmental resource parameters from celestialBodies.json
 * for any settlement location. Used by CollectiveAgent to decide
 * first-tick building priorities (dome before shelter, hydroponics
 * instead of farm, etc.).
 */

import celestialData from '../../config/celestialBodies.json';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LocationResources {
  /** How water is accessed at this location. */
  waterAccess: 'rivers' | 'ice' | 'subsurface' | 'none';
  /** Soil viability for agriculture. 0 = barren rock/regolith, 1 = Earth temperate. */
  soilValue: number;
  /** Whether the atmosphere supports human respiration without pressurization. */
  atmosphereBreathable: boolean;
  /** Mineral abundance. 0 = scarce, 1 = Earth-normal rich deposits. */
  mineralAbundance: number;
  /** Solar panel efficiency relative to Earth (1.0 = Earth). */
  solarEfficiency: number;
  /** Min/max surface temperature in Celsius. */
  temperatureRange: [min: number, max: number];
}

// ─── Atmosphere Classification ──────────────────────────────────────────────

const BREATHABLE_ATMOSPHERES = new Set(['breathable']);

function isBreathable(atm: string | undefined): boolean {
  return BREATHABLE_ATMOSPHERES.has(atm ?? '');
}

// ─── Water Access Derivation ────────────────────────────────────────────────

function deriveWaterAccess(body: Record<string, any>): LocationResources['waterAccess'] {
  const atm = body.physical?.atmosphere as string | undefined;
  const resources = body.resources as Record<string, any> | undefined;
  const terrain = body.terrain as Record<string, any> | undefined;
  const biomes = (terrain?.biomes ?? []) as string[];

  // Earth-like with rivers/oceans
  if (isBreathable(atm)) {
    if (biomes.includes('ocean') || biomes.includes('temperate') || biomes.includes('tropical')) {
      return 'rivers';
    }
    // Arctic/ice-based
    if (biomes.includes('ice') || biomes.includes('tundra')) {
      return 'ice';
    }
    return 'rivers';
  }

  // Mars: subsurface water confirmed
  if (atm === 'thin_co2') return 'subsurface';

  // Bodies with explicit water ice
  if (resources?.waterIce || resources?.waterTracked) {
    // Lunar ice deposits at poles
    if (biomes.includes('regolith') || biomes.includes('crater')) return 'ice';
    return 'ice';
  }

  // Titan: methane lakes, no water access
  if (atm === 'thick_nitrogen_methane' || biomes.includes('methane_sea')) return 'none';

  // Default: no accessible water
  return 'none';
}

// ─── Soil Value Derivation ──────────────────────────────────────────────────

function deriveSoilValue(body: Record<string, any>): number {
  const gameplay = body.gameplay as Record<string, any> | undefined;
  const farmingMethod = gameplay?.farmingMethod as string | undefined;
  const yieldMul = (gameplay?.farmYieldMultiplier ?? 0) as number;

  switch (farmingMethod) {
    case 'soil':
      return Math.min(1.0, yieldMul);
    case 'greenhouse':
      // Greenhouse implies some marginal soil value
      return Math.min(0.3, yieldMul * 0.5);
    case 'hydroponics':
    case 'impossible':
    default:
      return 0;
  }
}

// ─── Mineral Abundance ──────────────────────────────────────────────────────

function deriveMineralAbundance(body: Record<string, any>): number {
  const resources = body.resources as Record<string, any> | undefined;
  if (!resources) return 0.3; // unknown = sparse

  let score = 0.3; // baseline
  if (resources.abundantMinerals) score = 1.0;
  if (resources.minerals) score = Math.max(score, 0.7);
  if (resources.ironCore || resources.ironOxide) score = Math.max(score, 0.8);
  if (resources.helium3) score = Math.max(score, 0.5);
  if (resources.waterIce) score = Math.max(score, 0.4);
  return score;
}

// ─── Temperature Range ──────────────────────────────────────────────────────

/** Rough surface temperature ranges by body type. */
const TEMP_RANGES: Record<string, [number, number]> = {
  earth: [-40, 45],
  moon: [-173, 127],
  mars: [-125, 20],
  venus: [462, 462],
  mercury: [-180, 430],
  titan: [-179, -179],
  ceres: [-106, -34],
};

function deriveTemperatureRange(bodyKey: string, body: Record<string, any>): [number, number] {
  // Check explicit terraforming phases for current state
  if (bodyKey in TEMP_RANGES) return TEMP_RANGES[bodyKey]!;

  // Gas giants
  if (body.type === 'gas_giant') return [-150, -110];

  // Megastructures in habitable zone
  if (body.type === 'orbital_array' || body.type === 'habitat') return [15, 25];

  // Exoplanet defaults
  return [-20, 40];
}

// ─── Body Lookup ────────────────────────────────────────────────────────────

function findBody(celestialBody: string): Record<string, any> | null {
  const key = celestialBody.toLowerCase();

  // Check planets
  const planets = celestialData.planets as Record<string, any>;
  if (key in planets) return planets[key];

  // Check stellar bodies
  const stellar = celestialData.stellarBodies as Record<string, any>;
  if (key in stellar) return stellar[key];

  // Check megastructures
  const mega = celestialData.megastructures as Record<string, any>;
  if (key in mega) return mega[key];

  // Check exoplanet templates
  const exo = celestialData.exoplanetTemplates as Record<string, any>;
  if (key in exo) return exo[key];

  return null;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Get environmental resource parameters for a celestial body.
 *
 * Reads from celestialBodies.json and derives gameplay-relevant
 * environmental conditions used by CollectiveAgent to prioritize
 * first-tick building placement.
 *
 * @param celestialBody - Key from celestialBodies.json (e.g. 'earth', 'moon', 'mars')
 * @returns LocationResources with derived environmental parameters
 */
export function getLocationResources(celestialBody: string): LocationResources {
  const body = findBody(celestialBody);

  if (!body) {
    // Unknown body: assume hostile off-world defaults
    return {
      waterAccess: 'none',
      soilValue: 0,
      atmosphereBreathable: false,
      mineralAbundance: 0.3,
      solarEfficiency: 0.5,
      temperatureRange: [-50, 50],
    };
  }

  const atm = body.physical?.atmosphere as string | undefined;
  const gameplay = body.gameplay as Record<string, any> | undefined;

  return {
    waterAccess: deriveWaterAccess(body),
    soilValue: deriveSoilValue(body),
    atmosphereBreathable: isBreathable(atm),
    mineralAbundance: deriveMineralAbundance(body),
    solarEfficiency: (gameplay?.solarEfficiency ?? 0.5) as number,
    temperatureRange: deriveTemperatureRange(celestialBody.toLowerCase(), body),
  };
}
