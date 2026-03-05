/**
 * @module game/engine/agentParameterMatrix
 *
 * Adaptive parameter profiles for the 27-agent system across all worlds.
 * The SAME agents work on Earth, Moon, Mars, Titan, exoplanets — only
 * the parameter profile changes. Each settlement applies its terrain's
 * profile to modify agent behavior.
 *
 * Usage:
 *   const profile = getParameterProfile(settlement.terrain);
 *   // FoodAgent checks profile.farmingMethod, profile.farmYieldMultiplier
 *   // WeatherAgent skips if !profile.hasWeather
 *   // DecayAgent uses profile.atmosphericDecayRate
 */

import type { TerrainProfile } from '../../ai/agents/core/worldBranches';

// ─── Agent Parameter Profile ────────────────────────────────────────────────

export interface AgentParameterProfile {
  /** Profile identifier for debugging/serialization. */
  readonly id: string;

  // ── Food ──
  /** How food is grown (determines production pipeline). */
  readonly farmingMethod: 'soil' | 'hydroponics' | 'greenhouse' | 'impossible';
  /** Multiplier on base farm yield. 1.0 = Earth soil, lower for off-world. */
  readonly farmYieldMultiplier: number;
  /** Whether dvory can maintain private plots (false off-Earth). */
  readonly privatePlotsAvailable: boolean;

  // ── Power ──
  /** Solar panel efficiency relative to Earth. 0.0 = no solar viability. */
  readonly solarEfficiency: number;
  /** Whether nuclear fission reactors can be built. */
  readonly nuclearAvailable: boolean;
  /** Whether fusion reactors are available (late-game tech). */
  readonly fusionAvailable: boolean;

  // ── Weather ──
  /** Whether the world has weather at all (false on Moon — no atmosphere). */
  readonly hasWeather: boolean;
  /** Whether the world has seasonal cycles. */
  readonly hasSeasons: boolean;
  /** Which climate model to use. 'none' skips all weather logic. */
  readonly climateModel: 'earth' | 'mars' | 'titan' | 'none' | 'custom';

  // ── Decay ──
  /** Atmospheric decay rate multiplier. 1.0 = Earth, 0.1 = vacuum, 1.5 = corrosive. */
  readonly atmosphericDecayRate: number;
  /** Extra decay from radiation exposure (no magnetosphere). */
  readonly radiationDecayBonus: number;

  // ── Demographics ──
  /** Birth rate modifier from gravity effects on reproduction. */
  readonly gravityBirthRateModifier: number;
  /** Health modifier from radiation (>1.0 = higher mortality). */
  readonly radiationHealthModifier: number;

  // ── Construction ──
  /** Type of construction required. */
  readonly constructionType: 'standard' | 'pressurized_dome' | 'underground' | 'orbital';
  /** Cost multiplier on all construction. */
  readonly constructionCostMultiplier: number;

  // ── Climate Polarity ──
  /** Warming polarity: 1 = bad (Earth greenhouse), -1 = good (Mars terraforming). */
  readonly warmingPolarity: 1 | -1;
}

// ─── Default Profiles ───────────────────────────────────────────────────────

export const PROFILE_EARTH_TEMPERATE: Readonly<AgentParameterProfile> = Object.freeze({
  id: 'earth_temperate',
  farmingMethod: 'soil',
  farmYieldMultiplier: 1.0,
  privatePlotsAvailable: true,
  solarEfficiency: 1.0,
  nuclearAvailable: true,
  fusionAvailable: false,
  hasWeather: true,
  hasSeasons: true,
  climateModel: 'earth',
  atmosphericDecayRate: 1.0,
  radiationDecayBonus: 0.0,
  gravityBirthRateModifier: 1.0,
  radiationHealthModifier: 1.0,
  constructionType: 'standard',
  constructionCostMultiplier: 1.0,
  warmingPolarity: 1,
});

export const PROFILE_EARTH_ARCTIC: Readonly<AgentParameterProfile> = Object.freeze({
  id: 'earth_arctic',
  farmingMethod: 'greenhouse',
  farmYieldMultiplier: 0.3,
  privatePlotsAvailable: true,
  solarEfficiency: 0.4,
  nuclearAvailable: true,
  fusionAvailable: false,
  hasWeather: true,
  hasSeasons: true,
  climateModel: 'earth',
  atmosphericDecayRate: 1.3,
  radiationDecayBonus: 0.0,
  gravityBirthRateModifier: 1.0,
  radiationHealthModifier: 1.0,
  constructionType: 'standard',
  constructionCostMultiplier: 1.5,
  warmingPolarity: -1, // warming helps arctic settlements
});

export const PROFILE_EARTH_DESERT: Readonly<AgentParameterProfile> = Object.freeze({
  id: 'earth_desert',
  farmingMethod: 'soil',
  farmYieldMultiplier: 0.5,
  privatePlotsAvailable: true,
  solarEfficiency: 1.4,
  nuclearAvailable: true,
  fusionAvailable: false,
  hasWeather: true,
  hasSeasons: true,
  climateModel: 'earth',
  atmosphericDecayRate: 0.8,
  radiationDecayBonus: 0.0,
  gravityBirthRateModifier: 1.0,
  radiationHealthModifier: 1.0,
  constructionType: 'standard',
  constructionCostMultiplier: 1.2,
  warmingPolarity: 1,
});

export const PROFILE_LUNAR: Readonly<AgentParameterProfile> = Object.freeze({
  id: 'lunar',
  farmingMethod: 'hydroponics',
  farmYieldMultiplier: 0.4,
  privatePlotsAvailable: false,
  solarEfficiency: 1.3, // no atmosphere, but 14-day night cycle
  nuclearAvailable: true,
  fusionAvailable: false,
  hasWeather: false,
  hasSeasons: false,
  climateModel: 'none',
  atmosphericDecayRate: 0.1, // vacuum — no weathering, but micrometeorites
  radiationDecayBonus: 0.3, // no magnetosphere
  gravityBirthRateModifier: 0.5,
  radiationHealthModifier: 2.0,
  constructionType: 'pressurized_dome',
  constructionCostMultiplier: 3.0,
  warmingPolarity: 1, // irrelevant (no atmosphere), but keep consistent
});

export const PROFILE_MARTIAN: Readonly<AgentParameterProfile> = Object.freeze({
  id: 'martian',
  farmingMethod: 'greenhouse',
  farmYieldMultiplier: 0.6,
  privatePlotsAvailable: false,
  solarEfficiency: 0.43, // Mars receives ~43% of Earth's solar irradiance
  nuclearAvailable: true,
  fusionAvailable: false,
  hasWeather: true,
  hasSeasons: true,
  climateModel: 'mars',
  atmosphericDecayRate: 0.6, // thin atmosphere, some dust erosion
  radiationDecayBonus: 0.2, // weak magnetosphere
  gravityBirthRateModifier: 0.8,
  radiationHealthModifier: 1.5,
  constructionType: 'pressurized_dome',
  constructionCostMultiplier: 2.0,
  warmingPolarity: -1, // warming = terraforming = GOOD
});

export const PROFILE_VENUSIAN: Readonly<AgentParameterProfile> = Object.freeze({
  id: 'venusian',
  farmingMethod: 'impossible',
  farmYieldMultiplier: 0.0,
  privatePlotsAvailable: false,
  solarEfficiency: 0.1, // thick clouds block most sunlight at surface
  nuclearAvailable: true,
  fusionAvailable: true,
  hasWeather: true,
  hasSeasons: false,
  climateModel: 'custom',
  atmosphericDecayRate: 3.0, // sulfuric acid atmosphere — extremely corrosive
  radiationDecayBonus: 0.0, // thick atmosphere blocks radiation
  gravityBirthRateModifier: 0.9, // 0.91g — close to Earth
  radiationHealthModifier: 1.0,
  constructionType: 'pressurized_dome',
  constructionCostMultiplier: 4.0,
  warmingPolarity: 1, // Venus is already too hot
});

export const PROFILE_TITAN: Readonly<AgentParameterProfile> = Object.freeze({
  id: 'titan',
  farmingMethod: 'impossible',
  farmYieldMultiplier: 0.0,
  privatePlotsAvailable: false,
  solarEfficiency: 0.01, // 10 AU from Sun, thick haze
  nuclearAvailable: true,
  fusionAvailable: true,
  hasWeather: true,
  hasSeasons: true,
  climateModel: 'titan',
  atmosphericDecayRate: 1.5, // methane rain + cryogenic erosion
  radiationDecayBonus: 0.0, // thick atmosphere shields radiation
  gravityBirthRateModifier: 0.4, // 0.14g — severe reproduction issues
  radiationHealthModifier: 1.0,
  constructionType: 'pressurized_dome',
  constructionCostMultiplier: 5.0,
  warmingPolarity: -1, // warming helps (cryogenic world)
});

export const PROFILE_ASTEROID: Readonly<AgentParameterProfile> = Object.freeze({
  id: 'asteroid',
  farmingMethod: 'hydroponics',
  farmYieldMultiplier: 0.3,
  privatePlotsAvailable: false,
  solarEfficiency: 0.5, // varies by distance, assume belt average
  nuclearAvailable: true,
  fusionAvailable: false,
  hasWeather: false,
  hasSeasons: false,
  climateModel: 'none',
  atmosphericDecayRate: 0.05, // near-vacuum, minimal erosion
  radiationDecayBonus: 0.4, // no protection
  gravityBirthRateModifier: 0.3, // microgravity
  radiationHealthModifier: 2.5,
  constructionType: 'underground',
  constructionCostMultiplier: 3.5,
  warmingPolarity: 1,
});

export const PROFILE_ORBITAL: Readonly<AgentParameterProfile> = Object.freeze({
  id: 'orbital',
  farmingMethod: 'hydroponics',
  farmYieldMultiplier: 0.5,
  privatePlotsAvailable: false,
  solarEfficiency: 1.4, // no atmosphere, constant sunlight
  nuclearAvailable: true,
  fusionAvailable: true,
  hasWeather: false,
  hasSeasons: false,
  climateModel: 'none',
  atmosphericDecayRate: 0.05, // vacuum
  radiationDecayBonus: 0.2, // shielded but not perfect
  gravityBirthRateModifier: 0.6, // spin gravity, not perfect
  radiationHealthModifier: 1.3,
  constructionType: 'orbital',
  constructionCostMultiplier: 4.0,
  warmingPolarity: 1,
});

export const PROFILE_EXOPLANET: Readonly<AgentParameterProfile> = Object.freeze({
  id: 'exoplanet',
  farmingMethod: 'greenhouse',
  farmYieldMultiplier: 0.5,
  privatePlotsAvailable: false,
  solarEfficiency: 0.7, // variable star, assume habitable zone
  nuclearAvailable: true,
  fusionAvailable: true,
  hasWeather: true,
  hasSeasons: true,
  climateModel: 'custom',
  atmosphericDecayRate: 1.0,
  radiationDecayBonus: 0.1,
  gravityBirthRateModifier: 0.7,
  radiationHealthModifier: 1.2,
  constructionType: 'pressurized_dome',
  constructionCostMultiplier: 2.5,
  warmingPolarity: 1,
});

// ─── Profile Lookup ─────────────────────────────────────────────────────────

/** All named profiles indexed by id. */
const PROFILE_REGISTRY: ReadonlyMap<string, Readonly<AgentParameterProfile>> = new Map([
  ['earth_temperate', PROFILE_EARTH_TEMPERATE],
  ['earth_arctic', PROFILE_EARTH_ARCTIC],
  ['earth_desert', PROFILE_EARTH_DESERT],
  ['lunar', PROFILE_LUNAR],
  ['martian', PROFILE_MARTIAN],
  ['venusian', PROFILE_VENUSIAN],
  ['titan', PROFILE_TITAN],
  ['asteroid', PROFILE_ASTEROID],
  ['orbital', PROFILE_ORBITAL],
  ['exoplanet', PROFILE_EXOPLANET],
]);

/**
 * Resolve an AgentParameterProfile from a TerrainProfile.
 *
 * Maps terrain characteristics to the best-fit profile:
 *   - atmosphere 'none' + low gravity → lunar or asteroid
 *   - atmosphere 'thin_co2' → martian
 *   - atmosphere 'thick_n2_ch4' → titan
 *   - atmosphere 'variable' → exoplanet
 *   - atmosphere 'breathable' → earth variants (keyed on baseSurvivalCost + farming)
 *
 * Falls back to earth_temperate for unrecognized terrains.
 */
export function getParameterProfile(terrain: TerrainProfile): Readonly<AgentParameterProfile> {
  switch (terrain.atmosphere) {
    case 'none':
      // Vacuum worlds: Moon vs asteroid vs orbital
      if (terrain.construction === 'pressurized_domes') {
        return terrain.gravity > 0.15 ? PROFILE_LUNAR : PROFILE_ASTEROID;
      }
      return PROFILE_ORBITAL;

    case 'thin_co2':
      return PROFILE_MARTIAN;

    case 'thick_n2_ch4':
      return PROFILE_TITAN;

    case 'variable':
      return PROFILE_EXOPLANET;

    case 'breathable':
      // Earth variants
      if (terrain.farming === 'greenhouse' && terrain.baseSurvivalCost === 'very_high') {
        return PROFILE_EARTH_ARCTIC;
      }
      if (terrain.baseSurvivalCost === 'high') {
        return PROFILE_EARTH_DESERT;
      }
      return PROFILE_EARTH_TEMPERATE;
  }
}

/**
 * Get a profile by its string id. Useful for serialization/deserialization.
 * Returns undefined if the id is not recognized.
 */
export function getProfileById(id: string): Readonly<AgentParameterProfile> | undefined {
  return PROFILE_REGISTRY.get(id);
}

/**
 * Get all registered profile ids.
 */
export function getProfileIds(): readonly string[] {
  return [...PROFILE_REGISTRY.keys()];
}
