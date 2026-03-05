/**
 * Load Zones — Asset classification by celestial body and era.
 *
 * Groups models, textures, and HDRIs into "load zones" so the loading screen
 * knows WHICH assets to preload based on which settlement is being loaded.
 *
 * Used by:
 * - LoadingScreen: initial game load (loads Earth zone)
 * - SettlementTransitionOverlay: loads target zone during settlement switch
 * - ModelPreloader: preloads GLBs for the active zone
 *
 * Workflow:
 * 1. getLoadZone(celestialBody, subEra) → LoadZone
 * 2. LoadZone.models → GLB names to preload from manifest
 * 3. LoadZone.hdri → HDRI filename for environment map
 * 4. LoadZone.terrain → terrain texture set name
 * 5. LoadZone.shader → procedural shader component name (if any)
 */

export type CelestialBody = 'earth' | 'moon' | 'mars' | 'titan' | 'orbital' | 'dyson' | 'exoplanet';
export type SubEra = 'revolution' | 'collectivization' | 'industrialization' | 'great_patriotic'
  | 'reconstruction' | 'thaw_and_freeze' | 'stagnation'
  | 'post_soviet' | 'planetary' | 'solar_engineering' | 'type_one'
  | 'deconstruction' | 'dyson_swarm' | 'megaearth' | 'type_two_peak';

export interface LoadZone {
  /** Unique zone identifier. */
  id: string;
  /** Display name for loading screen. */
  name: string;
  /** GLB model role prefixes to preload (matched against manifest.json roles). */
  modelRoles: string[];
  /** HDRI filename for environment IBL. */
  hdri: string;
  /** Terrain texture directory name (under assets/textures/terrain/). */
  terrainTexture: string;
  /** Procedural sky/environment shader component name, if any. */
  shader?: 'DysonSphereBackdrop' | 'MarsAtmosphere' | 'ONeillInterior';
  /** Mars terraforming progress for MarsAtmosphere shader (0=red, 0.5=green, 1.0=blue). */
  marsPhase?: number;
  /** Loading screen flavor text. */
  flavorText: string;
}

/** All defined load zones, keyed by zone ID. */
const LOAD_ZONES: Record<string, LoadZone> = {
  // ── Earth Historical ───────────────────────────────────────────────────
  earth_winter: {
    id: 'earth_winter',
    name: 'Soviet Settlement',
    modelRoles: ['housing', 'industry', 'agriculture', 'government', 'military', 'infrastructure'],
    hdri: 'snowy_field_1k.hdr',
    terrainTexture: 'Snow003',
    flavorText: 'The Party has assigned you to this settlement. Do not disappoint.',
  },
  earth_warm: {
    id: 'earth_warm',
    name: 'Post-Soviet Settlement',
    modelRoles: ['housing', 'industry', 'agriculture', 'government', 'infrastructure'],
    hdri: 'autumn_field_puresky_1k.hdr',
    terrainTexture: 'Grass001',
    flavorText: 'The Union persists. The permafrost does not.',
  },
  earth_industrial: {
    id: 'earth_industrial',
    name: 'Industrial Complex',
    modelRoles: ['housing', 'industry', 'infrastructure', 'industrial'],
    hdri: 'abandoned_tank_farm_04_1k.hdr',
    terrainTexture: 'Concrete034',
    flavorText: 'The factories never sleep. Neither should you.',
  },

  // ── Moon ────────────────────────────────────────────────────────────────
  moon: {
    id: 'moon',
    name: 'Lunar Colony',
    modelRoles: ['colony_housing', 'colony_industry', 'colony_power', 'colony_dome'],
    hdri: 'dikhololo_night_1k.hdr',
    terrainTexture: 'Ground031',
    flavorText: 'One small step for the Soviet Union. One giant leap for bureaucracy.',
  },

  // ── Mars (3 phases) ────────────────────────────────────────────────────
  mars_red: {
    id: 'mars_red',
    name: 'Red Mars Colony',
    modelRoles: ['colony_housing', 'colony_industry', 'colony_power', 'colony_agriculture', 'colony_dome'],
    hdri: 'clarens_night_02_1k.hdr',
    terrainTexture: 'Ground039',
    shader: 'MarsAtmosphere',
    marsPhase: 0,
    flavorText: 'Comrade, welcome to Mars. The dust is red. The bureaucracy is eternal.',
  },
  mars_green: {
    id: 'mars_green',
    name: 'Green Mars',
    modelRoles: ['colony_housing', 'colony_industry', 'colony_power', 'colony_agriculture'],
    hdri: 'autumn_field_puresky_1k.hdr',
    terrainTexture: 'Moss002',
    shader: 'MarsAtmosphere',
    marsPhase: 0.5,
    flavorText: 'The moss grows. The committees multiply faster.',
  },
  mars_blue: {
    id: 'mars_blue',
    name: 'Blue Mars',
    modelRoles: ['colony_housing', 'colony_industry', 'colony_power', 'colony_agriculture'],
    hdri: 'belfast_sunset_puresky_1k.hdr',
    terrainTexture: 'aerial_beach_01',
    shader: 'MarsAtmosphere',
    marsPhase: 1.0,
    flavorText: 'Oceans on Mars. The vodka ration remains unchanged.',
  },

  // ── Titan ──────────────────────────────────────────────────────────────
  titan: {
    id: 'titan',
    name: 'Titan Methane Colony',
    modelRoles: ['colony_housing', 'colony_industry', 'colony_power', 'colony_dome'],
    hdri: 'dikhololo_night_1k.hdr',
    terrainTexture: 'Ice002',
    flavorText: 'The methane lakes are beautiful. The supply lines are not.',
  },

  // ── Venus ──────────────────────────────────────────────────────────────
  venus: {
    id: 'venus',
    name: 'Venus Cloud Colony',
    modelRoles: ['colony_housing', 'colony_industry', 'colony_power'],
    hdri: 'belfast_sunset_puresky_1k.hdr',
    terrainTexture: 'rock_ground_02',
    flavorText: 'Floating above sulfuric acid. The Party floats above accountability.',
  },

  // ── Orbital / O\'Neill ──────────────────────────────────────────────────
  orbital: {
    id: 'orbital',
    name: "O'Neill Cylinder Habitat",
    modelRoles: ['colony_housing', 'colony_industry', 'colony_power', 'colony_comms', 'space_module'],
    hdri: 'kloppenheim_02_puresky_1k.hdr',
    terrainTexture: 'Metal038',
    shader: 'ONeillInterior',
    flavorText: 'The world curves above you. The hierarchy does not.',
  },

  // ── Dyson Swarm ────────────────────────────────────────────────────────
  dyson: {
    id: 'dyson',
    name: 'Dyson Swarm Platform',
    modelRoles: ['colony_housing', 'colony_industry', 'colony_power', 'colony_government', 'space_module'],
    hdri: 'kloppenheim_02_puresky_1k.hdr',
    terrainTexture: 'Metal038',
    shader: 'DysonSphereBackdrop',
    flavorText: 'You have captured a star. The paperwork is astronomical.',
  },

  // ── Exoplanet ──────────────────────────────────────────────────────────
  exoplanet: {
    id: 'exoplanet',
    name: 'Exoplanet Colony',
    modelRoles: ['colony_housing', 'colony_industry', 'colony_power', 'colony_dome'],
    hdri: 'kloppenheim_02_puresky_1k.hdr',
    terrainTexture: 'sand_01',
    flavorText: 'Light-years from Moscow. The mandates still arrive on schedule.',
  },

  // ── MegaEarth / Undercity ──────────────────────────────────────────────
  megaearth: {
    id: 'megaearth',
    name: 'MegaEarth Sector',
    modelRoles: ['colony_housing', 'colony_industry', 'colony_government', 'colony_power'],
    hdri: 'cobblestone_street_night_1k.hdr',
    terrainTexture: 'Metal038',
    flavorText: '50 billion souls. One committee. Infinite forms to fill.',
  },
};

/**
 * Get the load zone for a given celestial body and sub-era.
 * Returns the most specific match available.
 */
export function getLoadZone(celestialBody: string, subEra?: string, marsPhase?: number): LoadZone {
  // Direct body matches
  if (celestialBody === 'moon') return LOAD_ZONES.moon;
  if (celestialBody === 'titan') return LOAD_ZONES.titan;
  if (celestialBody === 'exoplanet') return LOAD_ZONES.exoplanet;

  // Mars phases
  if (celestialBody === 'mars') {
    if (marsPhase !== undefined) {
      if (marsPhase >= 0.7) return LOAD_ZONES.mars_blue;
      if (marsPhase >= 0.3) return LOAD_ZONES.mars_green;
    }
    return LOAD_ZONES.mars_red;
  }

  // Orbital/Dyson
  if (celestialBody === 'orbital') return LOAD_ZONES.orbital;
  if (celestialBody === 'dyson') return LOAD_ZONES.dyson;

  // Earth — varies by sub-era
  if (subEra) {
    const warmEras = ['post_soviet', 'planetary'];
    const industrialEras = ['solar_engineering', 'type_one'];
    const megaEras = ['deconstruction', 'dyson_swarm', 'megaearth', 'type_two_peak'];

    if (megaEras.includes(subEra)) return LOAD_ZONES.megaearth;
    if (industrialEras.includes(subEra)) return LOAD_ZONES.earth_industrial;
    if (warmEras.includes(subEra)) return LOAD_ZONES.earth_warm;
  }

  return LOAD_ZONES.earth_winter;
}

/** Get all defined load zones (for preloading manifests). */
export function getAllLoadZones(): LoadZone[] {
  return Object.values(LOAD_ZONES);
}

/** Get a load zone by ID. */
export function getLoadZoneById(id: string): LoadZone | undefined {
  return LOAD_ZONES[id];
}

/** Get all unique HDRI filenames needed across all zones. */
export function getAllRequiredHDRIs(): string[] {
  return [...new Set(Object.values(LOAD_ZONES).map((z) => z.hdri))];
}

/** Get all unique terrain texture names needed across all zones. */
export function getAllRequiredTerrains(): string[] {
  return [...new Set(Object.values(LOAD_ZONES).map((z) => z.terrainTexture))];
}
