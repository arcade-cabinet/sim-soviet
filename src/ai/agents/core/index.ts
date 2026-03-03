/**
 * @module ai/agents/core
 *
 * Core simulation agents: time and weather management.
 */

export type { ChronologyState, TickResult } from './ChronologyAgent';
export { ChronologyAgent } from './ChronologyAgent';
export type { WeatherAgentSnapshot } from './WeatherAgent';
export { WeatherAgent } from './WeatherAgent';
export type { WeatherProfile, WeatherState } from './weather-types';
// Re-export weather types/constants (canonical location: weather-types.ts)
export {
  createWeatherState,
  getWeatherProfile,
  rollWeather,
  WEATHER_PROFILES,
  WeatherType,
} from './weather-types';
