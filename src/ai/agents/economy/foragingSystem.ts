/**
 * @module ai/agents/economy/foragingSystem
 *
 * Survival Foraging System -- when food runs critically low, workers
 * automatically divert from collective labor to forage, hunt, trap, or fish.
 *
 * This costs labor time (they are not working for the collective) and carries
 * KGB risk (politruk notices absent workers). The system creates the game's
 * core tension: enough foraging to survive, not so much that the commissar
 * notices.
 *
 * Historical: During collectivization and wartime, peasants routinely
 * supplemented meager rations through foraging, especially mushroom/berry
 * gathering (a deep Russian tradition). Unauthorized absence from collective
 * work was punishable under the 1940 labor discipline decree.
 *
 * Cannibalism: Historically documented during the 1921-22 famine, 1932-33
 * Holodomor, and 1941-44 Siege of Leningrad. Fires as a dark event when
 * food has been at 0 for 30+ ticks with population > 5.
 */

import { terrainFeatures } from '@/ecs/archetypes';
import foragingConfig from '@/config/economy.json';
import type { GameRng } from '../../../game/SeedSystem';

// ─────────────────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────────────────

/** Methods by which workers can forage for survival food. */
export type ForagingMethod =
  | 'gathering'   // Berries, mushrooms, roots -- always available spring-autumn
  | 'hunting'     // Rabbits, birds -- year-round, winter penalty
  | 'fishing'     // Fish -- spring-autumn only (rivers freeze)
  | 'trapping'    // Snares -- year-round, delayed yield
  | 'stone_soup'; // Desperate: boil anything edible -- minimal food, morale hit

/** Result of a single foraging tick. */
export interface ForagingResult {
  /** Total food gathered this tick from all foragers. */
  foodGathered: number;
  /** Number of workers diverted from collective production. */
  workersForaging: number;
  /** Fractional reduction in collective output (0.0-1.0). */
  productionLoss: number;
  /** Whether a KGB mark was triggered this tick. */
  kgbRisk: number;
  /** Primary foraging method used this tick. */
  method: ForagingMethod;
  /** Whether the cannibalism dark event fired. */
  cannibalismFired: boolean;
  /** Morale penalty from stone_soup or cannibalism (0 if none). */
  moralePenalty: number;
}

/** Persistent state tracked across ticks for delayed-yield trapping. */
export interface ForagingState {
  /** Number of ticks food has been at 0 continuously. */
  starvationTicks: number;
  /** Ticks remaining until active traps yield food. */
  trapDelayRemaining: number;
  /** Number of active trap-setters whose traps are pending. */
  trappersActive: number;
}

// ─────────────────────────────────────────────────────────
//  CONFIG (loaded from economy.json)
// ─────────────────────────────────────────────────────────

const CONFIG = (foragingConfig as Record<string, unknown>).foraging as {
  crisisThreshold: number;
  maxForagingFraction: number;
  kgbNoticeThreshold: number;
  kgbRiskPerTick: number;
  methods: {
    gathering: { foodPerWorker: number; seasonStart: number; seasonEnd: number };
    hunting: { foodPerWorker: number; winterPenalty: number };
    fishing: { foodPerWorker: number; seasonStart: number; seasonEnd: number };
    trapping: { foodPerWorker: number; delayTicks: number };
    stone_soup: { foodPerWorker: number; moralePenalty: number };
  };
  cannibalism: {
    starvationTicksRequired: number;
    minPopulation: number;
    foodYield: number;
    moralePenalty: number;
  };
};

// ─────────────────────────────────────────────────────────
//  TERRAIN QUERIES
// ─────────────────────────────────────────────────────────

/**
 * Checks whether forest terrain features exist on the map.
 * Used to determine if hunting/trapping methods are available.
 */
export function hasForestTiles(): boolean {
  for (const entity of terrainFeatures.entities) {
    if (entity.terrainFeature.featureType === 'forest') return true;
  }
  return false;
}

/**
 * Checks whether river or water terrain features exist on the map.
 * Used to determine if fishing is available.
 */
export function hasWaterTiles(): boolean {
  for (const entity of terrainFeatures.entities) {
    const ft = entity.terrainFeature.featureType;
    if (ft === 'river' || ft === 'water') return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────
//  SEASONAL AVAILABILITY
// ─────────────────────────────────────────────────────────

/**
 * Determines the best available foraging method for the current conditions.
 *
 * Priority order (highest yield first):
 *   1. Trapping (if forest tiles + traps ready)
 *   2. Hunting (if forest tiles)
 *   3. Fishing (if water tiles + in season)
 *   4. Gathering (if in season)
 *   5. Stone soup (always available, last resort)
 *
 * @param month - Current game month (1-12)
 * @param hasForest - Whether the map has forest terrain
 * @param hasWater - Whether the map has river/water terrain
 * @param trapsReady - Whether previously set traps are ready to collect
 * @returns The best available foraging method
 */
export function bestForagingMethod(
  month: number,
  hasForest: boolean,
  hasWater: boolean,
  trapsReady: boolean,
): ForagingMethod {
  const gatheringSeason =
    month >= CONFIG.methods.gathering.seasonStart &&
    month <= CONFIG.methods.gathering.seasonEnd;
  const fishingSeason =
    month >= CONFIG.methods.fishing.seasonStart &&
    month <= CONFIG.methods.fishing.seasonEnd;

  // Priority: trapping (if ready) > hunting > fishing > gathering > stone_soup
  if (hasForest && trapsReady) return 'trapping';
  if (hasForest) return 'hunting';
  if (hasWater && fishingSeason) return 'fishing';
  if (gatheringSeason) return 'gathering';
  return 'stone_soup';
}

/**
 * Returns the food yield per worker for a given method and month.
 *
 * Hunting has a winter penalty (snow cover reduces game).
 * Methods that are out of season return 0.
 *
 * @param method - The foraging method
 * @param month - Current game month (1-12)
 * @returns Food per worker per tick
 */
export function yieldPerWorker(method: ForagingMethod, month: number): number {
  const methods = CONFIG.methods;

  switch (method) {
    case 'gathering': {
      const inSeason =
        month >= methods.gathering.seasonStart &&
        month <= methods.gathering.seasonEnd;
      return inSeason ? methods.gathering.foodPerWorker : 0;
    }
    case 'hunting': {
      // Winter months (Nov-Mar = months 11,12,1,2,3)
      const isWinter = month <= 3 || month >= 11;
      const base = methods.hunting.foodPerWorker;
      return isWinter ? base * methods.hunting.winterPenalty : base;
    }
    case 'fishing': {
      const inSeason =
        month >= methods.fishing.seasonStart &&
        month <= methods.fishing.seasonEnd;
      return inSeason ? methods.fishing.foodPerWorker : 0;
    }
    case 'trapping':
      return methods.trapping.foodPerWorker;
    case 'stone_soup':
      return methods.stone_soup.foodPerWorker;
  }
}

// ─────────────────────────────────────────────────────────
//  STATE MANAGEMENT
// ─────────────────────────────────────────────────────────

/** Creates a fresh foraging state for a new game. */
export function createForagingState(): ForagingState {
  return {
    starvationTicks: 0,
    trapDelayRemaining: 0,
    trappersActive: 0,
  };
}

// ─────────────────────────────────────────────────────────
//  CORE TICK
// ─────────────────────────────────────────────────────────

/**
 * Runs the foraging system for one simulation tick.
 *
 * Called after production and consumption. When food falls below the crisis
 * threshold (food < population * crisisThreshold), a fraction of the workforce
 * automatically switches to foraging. This generates small amounts of food
 * but reduces collective production output and risks KGB attention.
 *
 * @param food - Current food stockpile
 * @param population - Current population count
 * @param month - Current game month (1-12)
 * @param state - Mutable foraging state (starvation counter, trap timers)
 * @param rng - Seeded RNG for deterministic KGB risk rolls
 * @returns ForagingResult with food gathered, workers diverted, etc.
 */
export function foragingTick(
  food: number,
  population: number,
  month: number,
  state: ForagingState,
  rng?: GameRng,
): ForagingResult {
  const result: ForagingResult = {
    foodGathered: 0,
    workersForaging: 0,
    productionLoss: 0,
    kgbRisk: 0,
    method: 'stone_soup',
    cannibalismFired: false,
    moralePenalty: 0,
  };

  if (population <= 0) return result;

  // Track starvation ticks (for cannibalism trigger)
  if (food <= 0) {
    state.starvationTicks++;
  } else {
    state.starvationTicks = 0;
  }

  // Advance trap delay timer
  if (state.trapDelayRemaining > 0) {
    state.trapDelayRemaining--;
  }

  // Check crisis threshold
  const crisisThreshold = population * CONFIG.crisisThreshold;
  if (food >= crisisThreshold) {
    return result;
  }

  // Determine available methods
  const forest = hasForestTiles();
  const water = hasWaterTiles();
  const trapsReady = state.trapDelayRemaining <= 0 && state.trappersActive > 0;

  // Pick best method
  const method = bestForagingMethod(month, forest, water, trapsReady);
  result.method = method;

  // Calculate foraging workforce fraction
  // More desperate = more workers forage (scales with how far below threshold)
  const desperation = Math.min(1, 1 - food / crisisThreshold);
  const foragingFraction = Math.min(
    CONFIG.maxForagingFraction,
    desperation * CONFIG.maxForagingFraction,
  );
  const workersForaging = Math.max(1, Math.floor(population * foragingFraction));
  result.workersForaging = workersForaging;

  // Calculate food yield
  const foodPerWorker = yieldPerWorker(method, month);

  if (method === 'trapping' && trapsReady) {
    // Collect from traps -- uses the previously-set trappers count
    result.foodGathered = state.trappersActive * foodPerWorker;
    state.trappersActive = 0;
  } else if (method === 'trapping') {
    // Setting new traps -- no immediate food, start delay timer
    state.trappersActive = workersForaging;
    state.trapDelayRemaining = CONFIG.methods.trapping.delayTicks;
    result.foodGathered = 0;
  } else {
    result.foodGathered = workersForaging * foodPerWorker;
  }

  // Production loss proportional to workers foraging
  result.productionLoss = workersForaging / population;

  // Stone soup morale penalty
  if (method === 'stone_soup') {
    result.moralePenalty = CONFIG.methods.stone_soup.moralePenalty;
  }

  // KGB risk -- if >threshold% of workforce is foraging, politruk notices
  const foragingRatio = workersForaging / population;
  if (foragingRatio > CONFIG.kgbNoticeThreshold) {
    const roll = rng ? rng.random() : Math.random();
    if (roll < CONFIG.kgbRiskPerTick) {
      result.kgbRisk = 1;
    }
  }

  // Cannibalism check -- extreme desperation
  if (
    state.starvationTicks >= CONFIG.cannibalism.starvationTicksRequired &&
    population > CONFIG.cannibalism.minPopulation
  ) {
    result.cannibalismFired = true;
    result.foodGathered += CONFIG.cannibalism.foodYield;
    result.moralePenalty += CONFIG.cannibalism.moralePenalty;
    // Reset starvation counter so it doesn't fire every tick
    state.starvationTicks = 0;
  }

  return result;
}
