/**
 * Season and weather utilities.
 * Faithful port of poc.html lines 408-423.
 */

import { gameState, type WeatherType } from './GameState';

export function getSeason(month: number): string {
  if (month === 12 || month <= 3) return 'WINTER';
  if (month >= 4 && month <= 5) return 'MUD (SPRING)';
  if (month >= 6 && month <= 9) return 'SUMMER';
  return 'AUTUMN';
}

export function getSeasonColor(season: string): string {
  if (season === 'WINTER') return '#eceff1';
  if (season === 'MUD (SPRING)') return '#4e342e';
  if (season === 'SUMMER') return '#33691e';
  return '#5d4037';
}

export function updateWeatherSystem(season: string): void {
  if (season === 'WINTER') {
    gameState.currentWeather = 'snow';
  } else if (season === 'MUD (SPRING)') {
    gameState.currentWeather = Math.random() > 0.4 ? 'rain' : 'clear';
  } else {
    const r = Math.random();
    if (r < 0.3) gameState.currentWeather = 'storm';
    else if (r < 0.6) gameState.currentWeather = 'rain';
    else gameState.currentWeather = 'clear';
  }
}
