/**
 * Per-building tick — pure function.
 *
 * O(1) per building. No entity scanning. No history lookup.
 * nextState = f(currentState, context)
 */

export interface BuildingTickInput {
  defId: string;
  workerCount: number;
  avgSkill: number;     // 0-100
  avgMorale: number;    // 0-100
  avgLoyalty: number;   // 0-100
  powered: boolean;
  baseRate: number;
  tileFertility: number; // 0-100
}

export interface BuildingTickContext {
  weather: string;
  season: string;
  activeCrisisModifier: number; // 1.0 = no crisis, 0.5 = halved
}

export interface BuildingTickResult {
  netOutput: number;
}

const SEASON_MODIFIERS: Record<string, number> = {
  spring: 0.8,
  summer: 1.0,
  autumn: 0.9,
  winter: 0.3,
};

const WEATHER_MODIFIERS: Record<string, number> = {
  clear: 1.0,
  cloudy: 0.95,
  rain: 0.8,
  storm: 0.5,
  snow: 0.6,
  blizzard: 0.3,
};

/**
 * Compute one tick of building output. Pure function.
 */
export function tickBuilding(building: BuildingTickInput, ctx: BuildingTickContext): BuildingTickResult {
  if (building.workerCount <= 0 || !building.powered) {
    return { netOutput: 0 };
  }

  const effectiveWorkers = building.workerCount * (building.avgSkill / 100);
  const moraleFactor = 0.5 + 0.5 * (building.avgMorale / 100);
  const weatherFactor = WEATHER_MODIFIERS[ctx.weather] ?? 1.0;
  const seasonFactor = SEASON_MODIFIERS[ctx.season] ?? 1.0;
  const terrainFactor = building.tileFertility / 100;

  const netOutput =
    building.baseRate *
    effectiveWorkers *
    moraleFactor *
    weatherFactor *
    seasonFactor *
    ctx.activeCrisisModifier *
    terrainFactor;

  return { netOutput };
}
