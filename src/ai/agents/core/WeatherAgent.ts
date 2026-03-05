/**
 * @fileoverview WeatherAgent — Yuka agent that manages weather state.
 *
 * Absorbs rolling logic and profile modifiers from WeatherSystem.
 * On each game day tick, decrements the remaining duration of the
 * current weather and rolls a new weather type when it expires.
 */

import { Vehicle } from 'yuka';
import { Season } from '../../../game/Chronology';
import type { GameRng } from '../../../game/SeedSystem';
import type { AgentParameterProfile } from '../../../game/engine/agentParameterMatrix';
import { WEATHER_PROFILES, type WeatherProfile, WeatherType } from './weather-types';

export type { WeatherProfile, WeatherState } from './weather-types';
// Re-export weather types for consumers
export { getWeatherProfile, WEATHER_PROFILES, WeatherType } from './weather-types';

// ─────────────────────────────────────────────────────────
//  PER-SEASON PROBABILITY TABLES
// ─────────────────────────────────────────────────────────

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
//  SERIALIZATION
// ─────────────────────────────────────────────────────────

/** Serializable snapshot of WeatherAgent state. */
export interface WeatherAgentSnapshot {
  currentWeather: WeatherType;
  daysRemaining: number;
}

// ─────────────────────────────────────────────────────────
//  WEATHER AGENT
// ─────────────────────────────────────────────────────────

/**
 * Yuka Vehicle agent that owns weather state.
 *
 * Call `onDayTick(season, rng)` once per game day to advance the
 * weather simulation. Use `getWeatherProfile()` to read current
 * modifiers for farm output, construction speed, worker speed, etc.
 */
/** Neutral weather profile returned on worlds with no atmosphere. */
const NEUTRAL_WEATHER: WeatherProfile = Object.freeze({
  ...WEATHER_PROFILES[WeatherType.CLEAR],
  label: 'Vacuum',
  minDuration: 999,
  maxDuration: 999,
  description: 'No atmosphere — no weather.',
});

export class WeatherAgent extends Vehicle {
  private currentWeather: WeatherType = WeatherType.OVERCAST;
  private daysRemaining: number = 1;

  /** Active terrain profile — controls whether weather/seasons exist. */
  private profile: Readonly<AgentParameterProfile> | null = null;

  constructor() {
    super();
    this.name = 'WeatherAgent';
  }

  /**
   * Set the active agent parameter profile.
   * If !hasWeather, all ticks return neutral weather. If !hasSeasons, seasonal transitions are skipped.
   */
  setProfile(profile: Readonly<AgentParameterProfile>): void {
    this.profile = profile;
  }

  // ─────────────────────────────────────────────────────
  //  CORE TICK
  // ─────────────────────────────────────────────────────

  /**
   * Advance weather by one game day.
   * Decrements daysRemaining; rolls new weather when it reaches 0.
   * If the active profile has no weather, this is a no-op.
   *
   * @param season - Current game season (determines probability weights)
   * @param rng - Seeded RNG for deterministic rolls
   */
  onDayTick(season: Season, rng: GameRng): void {
    // Profile-aware: no atmosphere means no weather
    if (this.profile && !this.profile.hasWeather) return;

    this.daysRemaining -= 1;
    if (this.daysRemaining <= 0) {
      this.rollWeather(season, rng);
    }
  }

  // ─────────────────────────────────────────────────────
  //  WEATHER ROLLING
  // ─────────────────────────────────────────────────────

  /**
   * Roll a new weather type for the given season using the seeded RNG.
   * Sets currentWeather and a new daysRemaining from the profile's duration range.
   *
   * @param season - Current game season
   * @param rng - Seeded RNG
   */
  rollWeather(season: Season, rng: GameRng): void {
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
    this.currentWeather = chosen;
    this.daysRemaining = rng.int(profile.minDuration, profile.maxDuration);
  }

  // ─────────────────────────────────────────────────────
  //  ACCESSORS
  // ─────────────────────────────────────────────────────

  /** Current active weather type. */
  getCurrentWeather(): WeatherType {
    return this.currentWeather;
  }

  /** Days remaining until the next weather roll. */
  getDaysRemaining(): number {
    return this.daysRemaining;
  }

  /**
   * Returns the full gameplay profile for the current weather type.
   * Downstream systems (farms, construction, workers, particles) read from this.
   * Returns neutral weather on worlds with no atmosphere.
   */
  getWeatherProfile(): WeatherProfile {
    if (this.profile && !this.profile.hasWeather) return NEUTRAL_WEATHER;
    return WEATHER_PROFILES[this.currentWeather];
  }

  // ─────────────────────────────────────────────────────
  //  SERIALIZATION
  // ─────────────────────────────────────────────────────

  /** Serialize agent state for save/load. */
  serialize(): WeatherAgentSnapshot {
    return {
      currentWeather: this.currentWeather,
      daysRemaining: this.daysRemaining,
    };
  }

  /**
   * Restore agent state from a snapshot.
   *
   * @param snapshot - Previously serialized WeatherAgentSnapshot
   */
  restore(snapshot: WeatherAgentSnapshot): void {
    this.currentWeather = snapshot.currentWeather;
    this.daysRemaining = snapshot.daysRemaining;
  }
}
