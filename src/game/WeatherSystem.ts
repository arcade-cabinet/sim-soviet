/**
 * @module game/WeatherSystem
 *
 * Weather types, per-season probability tables, and weather rolling.
 *
 * Weather is rolled at the start of each new game day using the seeded RNG.
 * Each weather type has gameplay modifiers that affect farm output,
 * snow/rain particle rates, and event frequency.
 */

import { Season } from './Chronology';
import type { GameRng } from './SeedSystem';

// ─────────────────────────────────────────────────────────
//  WEATHER TYPES
// ─────────────────────────────────────────────────────────

export enum WeatherType {
  CLEAR = 'clear',
  OVERCAST = 'overcast',
  SNOW = 'snow',
  BLIZZARD = 'blizzard',
  RAIN = 'rain',
  MUD_STORM = 'mud_storm',
  HEATWAVE = 'heatwave',
  MIRACULOUS_SUN = 'miraculous_sun',
  FOG = 'fog',
}

export interface WeatherProfile {
  readonly type: WeatherType;
  readonly label: string;
  /** Farm output multiplier (stacks with season). */
  readonly farmModifier: number;
  /** Additive snow particle rate modifier. */
  readonly snowRateModifier: number;
  /** Whether rain particles should be emitted. */
  readonly hasRain: boolean;
  /** Event frequency multiplier (higher = more events). */
  readonly eventFrequencyModifier: number;
  /** How many days this weather typically lasts (min). */
  readonly minDuration: number;
  /** How many days this weather typically lasts (max). */
  readonly maxDuration: number;
  /** Short flavor text. */
  readonly description: string;
}

export const WEATHER_PROFILES: Readonly<Record<WeatherType, WeatherProfile>> = {
  [WeatherType.CLEAR]: {
    type: WeatherType.CLEAR,
    label: 'Clear',
    farmModifier: 1.0,
    snowRateModifier: 0,
    hasRain: false,
    eventFrequencyModifier: 1.0,
    minDuration: 1,
    maxDuration: 4,
    description: 'A rare sight. Citizens squint suspiciously at the sky.',
  },
  [WeatherType.OVERCAST]: {
    type: WeatherType.OVERCAST,
    label: 'Overcast',
    farmModifier: 0.9,
    snowRateModifier: 0,
    hasRain: false,
    eventFrequencyModifier: 1.0,
    minDuration: 2,
    maxDuration: 5,
    description: 'The standard Soviet sky. Grey as concrete.',
  },
  [WeatherType.SNOW]: {
    type: WeatherType.SNOW,
    label: 'Snow',
    farmModifier: 0.0,
    snowRateModifier: 50,
    hasRain: false,
    eventFrequencyModifier: 0.8,
    minDuration: 1,
    maxDuration: 3,
    description: 'Snow falls gently. Buildings disappear slowly.',
  },
  [WeatherType.BLIZZARD]: {
    type: WeatherType.BLIZZARD,
    label: 'Blizzard',
    farmModifier: 0.0,
    snowRateModifier: 200,
    hasRain: false,
    eventFrequencyModifier: 1.5,
    minDuration: 1,
    maxDuration: 2,
    description: 'Visibility: zero. Morale: also zero.',
  },
  [WeatherType.RAIN]: {
    type: WeatherType.RAIN,
    label: 'Rain',
    farmModifier: 1.2,
    snowRateModifier: 0,
    hasRain: true,
    eventFrequencyModifier: 0.9,
    minDuration: 1,
    maxDuration: 3,
    description: 'Water falls from above. Crops appreciate it. Citizens do not.',
  },
  [WeatherType.MUD_STORM]: {
    type: WeatherType.MUD_STORM,
    label: 'Mud Storm',
    farmModifier: 0.0,
    snowRateModifier: 0,
    hasRain: true,
    eventFrequencyModifier: 1.3,
    minDuration: 1,
    maxDuration: 2,
    description: 'The road has become the mud. The mud has become the road.',
  },
  [WeatherType.HEATWAVE]: {
    type: WeatherType.HEATWAVE,
    label: 'Heatwave',
    farmModifier: 0.5,
    snowRateModifier: 0,
    hasRain: false,
    eventFrequencyModifier: 1.2,
    minDuration: 2,
    maxDuration: 4,
    description: 'Citizens discover sweat. Crops discover death.',
  },
  [WeatherType.MIRACULOUS_SUN]: {
    type: WeatherType.MIRACULOUS_SUN,
    label: 'Miraculous Sun',
    farmModifier: 2.0,
    snowRateModifier: 0,
    hasRain: false,
    eventFrequencyModifier: 0.5,
    minDuration: 1,
    maxDuration: 3,
    description: 'Perfect weather. Citizens weep. Crops flourish. Something must be wrong.',
  },
  [WeatherType.FOG]: {
    type: WeatherType.FOG,
    label: 'Fog',
    farmModifier: 0.7,
    snowRateModifier: 0,
    hasRain: false,
    eventFrequencyModifier: 1.1,
    minDuration: 1,
    maxDuration: 3,
    description: 'Cannot see neighbor. Cannot see building. Cannot see hope.',
  },
} as const;

// ─────────────────────────────────────────────────────────
//  PER-SEASON PROBABILITY TABLES
// ─────────────────────────────────────────────────────────

/**
 * Each entry is [WeatherType, probability weight].
 * Weights don't need to sum to 1 — they're normalized at roll time.
 */
type WeatherWeights = readonly (readonly [WeatherType, number])[];

const SEASON_WEATHER: Readonly<Record<Season, WeatherWeights>> = {
  [Season.WINTER]: [
    [WeatherType.SNOW, 35],
    [WeatherType.BLIZZARD, 20],
    [WeatherType.OVERCAST, 30],
    [WeatherType.CLEAR, 10],
    [WeatherType.FOG, 5],
  ],
  [Season.RASPUTITSA_SPRING]: [
    [WeatherType.RAIN, 30],
    [WeatherType.MUD_STORM, 25],
    [WeatherType.OVERCAST, 25],
    [WeatherType.FOG, 15],
    [WeatherType.CLEAR, 5],
  ],
  [Season.SHORT_SUMMER]: [
    [WeatherType.CLEAR, 30],
    [WeatherType.OVERCAST, 25],
    [WeatherType.RAIN, 20],
    [WeatherType.MIRACULOUS_SUN, 15],
    [WeatherType.FOG, 10],
  ],
  [Season.GOLDEN_WEEK]: [
    [WeatherType.CLEAR, 35],
    [WeatherType.MIRACULOUS_SUN, 15],
    [WeatherType.OVERCAST, 25],
    [WeatherType.RAIN, 15],
    [WeatherType.HEATWAVE, 10],
  ],
  [Season.STIFLING_HEAT]: [
    [WeatherType.HEATWAVE, 30],
    [WeatherType.CLEAR, 25],
    [WeatherType.OVERCAST, 20],
    [WeatherType.MIRACULOUS_SUN, 10],
    [WeatherType.RAIN, 10],
    [WeatherType.FOG, 5],
  ],
  [Season.EARLY_FROST]: [
    [WeatherType.OVERCAST, 30],
    [WeatherType.SNOW, 20],
    [WeatherType.RAIN, 20],
    [WeatherType.CLEAR, 15],
    [WeatherType.FOG, 15],
  ],
  [Season.RASPUTITSA_AUTUMN]: [
    [WeatherType.RAIN, 30],
    [WeatherType.MUD_STORM, 20],
    [WeatherType.OVERCAST, 25],
    [WeatherType.FOG, 15],
    [WeatherType.SNOW, 10],
  ],
};

// ─────────────────────────────────────────────────────────
//  WEATHER STATE
// ─────────────────────────────────────────────────────────

export interface WeatherState {
  current: WeatherType;
  daysRemaining: number;
}

export function createWeatherState(): WeatherState {
  return {
    current: WeatherType.OVERCAST,
    daysRemaining: 1,
  };
}

// ─────────────────────────────────────────────────────────
//  WEATHER ROLLING
// ─────────────────────────────────────────────────────────

/**
 * Rolls new weather for the given season using the seeded RNG.
 * Returns a WeatherState with type and duration.
 */
export function rollWeather(season: Season, rng: GameRng): WeatherState {
  const weights = SEASON_WEATHER[season];
  const totalWeight = weights.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng.random() * totalWeight;

  let chosen = WeatherType.OVERCAST;
  for (const [type, weight] of weights) {
    roll -= weight;
    if (roll <= 0) {
      chosen = type;
      break;
    }
  }

  const profile = WEATHER_PROFILES[chosen];
  const duration = rng.int(profile.minDuration, profile.maxDuration);

  return { current: chosen, daysRemaining: duration };
}

/**
 * Returns the weather profile for the current weather type.
 */
export function getWeatherProfile(type: WeatherType): WeatherProfile {
  return WEATHER_PROFILES[type];
}
