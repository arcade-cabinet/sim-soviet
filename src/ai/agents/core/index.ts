/**
 * @module ai/agents/core
 *
 * Core simulation agents: time and weather management.
 */
export { ChronologyAgent } from './ChronologyAgent';
export type { TickResult, ChronologyState } from './ChronologyAgent';
export { WeatherAgent } from './WeatherAgent';
export type { WeatherAgentSnapshot } from './WeatherAgent';

// Re-export weather types/constants (canonical location: weather-types.ts)
export {
  WeatherType,
  WEATHER_PROFILES,
  getWeatherProfile,
  createWeatherState,
  rollWeather,
} from './weather-types';
export type { WeatherProfile, WeatherState } from './weather-types';
