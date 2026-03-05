/**
 * @module ai/agents/crisis/pressure/PressureDomains
 *
 * Core types for the pressure-valve crisis system.
 *
 * 10 classical pressure domains map to game subsystems already computed each tick.
 * Each domain is normalized to 0-1 (0 = no stress, 1 = maximum stress).
 * Pressure accumulates via dual-spread model and triggers crises when
 * thresholds are crossed for sustained durations.
 *
 * At post-scarcity (Kardashev >= 1.0, techLevel > 0.95), classical domains
 * transform: food/housing/power/economic are ZEROED (infinite supply) and
 * replaced by 5 post-scarcity domains that represent civilizational-scale
 * pressures: meaning, density, entropy, legacy, ennui.
 */

// ─── Classical Pressure Domains ─────────────────────────────────────────────

/** The 10 classical pressure domains tracked by the system. */
export type PressureDomain =
  | 'food'
  | 'morale'
  | 'loyalty'
  | 'housing'
  | 'political'
  | 'power'
  | 'infrastructure'
  | 'demographic'
  | 'health'
  | 'economic';

/** All classical domain keys as a readonly array (iteration order). */
export const PRESSURE_DOMAINS: readonly PressureDomain[] = [
  'food',
  'morale',
  'loyalty',
  'housing',
  'political',
  'power',
  'infrastructure',
  'demographic',
  'health',
  'economic',
] as const;

// ─── Post-Scarcity Domains ──────────────────────────────────────────────────

/** 5 post-scarcity domains that replace zeroed classical domains. */
export type PostScarcityDomain =
  | 'meaning'   // replaces food — purpose crisis (why eat when nothing matters?)
  | 'density'   // replaces housing — megacity population pressure
  | 'entropy'   // replaces power — stellar-scale maintenance bureaucracy
  | 'legacy'    // replaces economic — civilizational direction pressure
  | 'ennui';    // transforms morale — existential boredom at civilization scale

/** All post-scarcity domain keys. */
export const POST_SCARCITY_DOMAINS: readonly PostScarcityDomain[] = [
  'meaning',
  'density',
  'entropy',
  'legacy',
  'ennui',
] as const;

/** Any domain — classical or post-scarcity. */
export type AnyPressureDomain = PressureDomain | PostScarcityDomain;

/** All domain keys (classical + post-scarcity). */
export const ALL_PRESSURE_DOMAINS: readonly AnyPressureDomain[] = [
  ...PRESSURE_DOMAINS,
  ...POST_SCARCITY_DOMAINS,
] as const;

/**
 * Which classical domains are ZEROED at post-scarcity (infinite supply).
 * These become inert — their gauges freeze at 0.
 */
export const ZEROED_AT_POST_SCARCITY: readonly PressureDomain[] = [
  'food',
  'housing',
  'power',
  'economic',
] as const;

/**
 * Which classical domains are AMPLIFIED at post-scarcity.
 * Power never goes away — Turchin cycles at cosmic scale.
 */
export const AMPLIFIED_AT_POST_SCARCITY: readonly PressureDomain[] = [
  'political',
  'loyalty',
] as const;

/**
 * Mapping: which post-scarcity domain replaces which classical domain.
 * morale is TRANSFORMED (not zeroed) into ennui.
 */
export const DOMAIN_REPLACEMENT_MAP: ReadonlyMap<PressureDomain, PostScarcityDomain> = new Map([
  ['food', 'meaning'],
  ['housing', 'density'],
  ['power', 'entropy'],
  ['economic', 'legacy'],
  ['morale', 'ennui'],
]);

// ─── Pressure Gauge ──────────────────────────────────────────────────────────

/** Per-domain pressure state. */
export interface PressureGauge {
  /** Current accumulated pressure level (0-1). */
  level: number;
  /** Exponential moving average of the raw reading (0-1). */
  trend: number;
  /** Consecutive ticks at or above warning threshold. */
  warningTicks: number;
  /** Consecutive ticks at or above critical threshold. */
  criticalTicks: number;
  /** Last raw reading before accumulation (for venting calculation). */
  lastRawReading: number;
}

/** Create a fresh gauge at zero pressure. */
export function createGauge(): PressureGauge {
  return {
    level: 0,
    trend: 0,
    warningTicks: 0,
    criticalTicks: 0,
    lastRawReading: 0,
  };
}

// ─── Pressure State ──────────────────────────────────────────────────────────

/** Full pressure state across classical domains. */
export type PressureState = Record<PressureDomain, PressureGauge>;

/** Post-scarcity pressure state (5 additional gauges). */
export type PostScarcityPressureState = Record<PostScarcityDomain, PressureGauge>;

/**
 * Extended pressure state that includes both classical and post-scarcity domains.
 * The post-scarcity gauges are only active after domain transformation.
 */
export interface ExtendedPressureState {
  /** Classical 10-domain gauges (always present). */
  classical: PressureState;
  /** Post-scarcity 5-domain gauges (null before transformation). */
  postScarcity: PostScarcityPressureState | null;
  /** Whether domain transformation has occurred. */
  transformed: boolean;
  /** Kardashev level at which transformation occurred (for serialization). */
  transformedAtKardashev: number;
}

/** Create a fresh PressureState with all gauges at zero. */
export function createPressureState(): PressureState {
  const state = {} as PressureState;
  for (const domain of PRESSURE_DOMAINS) {
    state[domain] = createGauge();
  }
  return state;
}

/** Create a fresh PostScarcityPressureState with all gauges at zero. */
export function createPostScarcityPressureState(): PostScarcityPressureState {
  const state = {} as PostScarcityPressureState;
  for (const domain of POST_SCARCITY_DOMAINS) {
    state[domain] = createGauge();
  }
  return state;
}

/** Create a fresh ExtendedPressureState (pre-transformation). */
export function createExtendedPressureState(): ExtendedPressureState {
  return {
    classical: createPressureState(),
    postScarcity: null,
    transformed: false,
    transformedAtKardashev: 0,
  };
}

// ─── Pressure Read Context ───────────────────────────────────────────────────

/**
 * Snapshot of game state metrics needed to compute raw pressure readings.
 * Assembled once per tick from existing agent APIs — no new computation.
 */
export interface PressureReadContext {
  // ── Food domain ──
  /** FoodAgent state: 'surplus' | 'stable' | 'rationing' | 'starvation' */
  foodState: 'surplus' | 'stable' | 'rationing' | 'starvation';
  /** Starvation counter (ticks in starvation, 0 if not starving). */
  starvationCounter: number;
  /** Starvation grace ticks before deaths begin. */
  starvationGraceTicks: number;

  // ── Morale domain ──
  /** Average worker morale (0-100 scale). */
  averageMorale: number;

  // ── Loyalty domain ──
  /** Average loyalty (0-100 scale). */
  averageLoyalty: number;
  /** Sabotage events this period. */
  sabotageCount: number;
  /** Flight (defection) events this period. */
  flightCount: number;

  // ── Housing domain ──
  /** Current total population. */
  population: number;
  /** Total housing capacity (resident slots across all housing buildings). */
  housingCapacity: number;

  // ── Political domain ──
  /** KGB suspicion level (0-1). */
  suspicionLevel: number;
  /** Black marks in personnel file. */
  blackMarks: number;
  /** Blat (informal favors) accumulated. */
  blat: number;

  // ── Power domain ──
  /** Whether power grid is in shortage. */
  powerShortage: boolean;
  /** Number of unpowered buildings. */
  unpoweredCount: number;
  /** Total number of buildings. */
  totalBuildings: number;

  // ── Infrastructure domain ──
  /** Average building durability (0-100). */
  averageDurability: number;

  // ── Demographic domain ──
  /** Population growth rate (absolute, can be negative). */
  growthRate: number;
  /** Labor force ratio: working-age / total population (0-1). */
  laborRatio: number;

  // ── Health domain ──
  /** Number of currently sick/infected citizens. */
  sickCount: number;

  // ── Economic domain ──
  /** Quota deficit: 0 = met, 1 = completely missed (clamped 0-1). */
  quotaDeficit: number;
  /** Production trend: 0-1 (1 = growing or stable, 0 = declining). */
  productionTrend: number;

  // ── Carrying Capacity (drives expansion pressure) ──
  /**
   * Settlement carrying capacity — the mathematical population ceiling.
   * min(housingCapacity, foodCapacity, waterCapacity, oxygenCapacity, powerCapacity, terrainLimit).
   * When population > 0.85 * K, demographic pressure builds automatically.
   * When population > 0.95 * K, expansion becomes inevitable.
   */
  carryingCapacity: number;

  // ── Environmental context (for climate events + cold branches) ──
  /** Current season enum value. */
  season: string;
  /** Current weather type. */
  weather: string;
  /** Climate trend from WorldAgent (-1 to +1). */
  climateTrend?: number;
  /** World state from WorldAgent (for cold branch evaluation). */
  worldState?: Record<string, unknown>;
  /** Sphere data from WorldAgent (for cold branch evaluation). */
  spheres?: Record<string, { governance: string; aggregateHostility: number }>;

  // ── MegaCity Law Enforcement context ──

  /** Aggregate crime rate from LawEnforcementSystem (0-1). */
  crimeRate?: number;
  /** Judge coverage ratio from LawEnforcementSystem (0-1). */
  judgeCoverage?: number;
  /** Undercity decay level (0-1, average across sectors). */
  undercityDecay?: number;

  // ── Post-Scarcity context (only populated after domain transformation) ──

  /** Purpose fulfillment index (0=total nihilism, 1=fully engaged). Only meaningful post-scarcity. */
  purposeFulfillment?: number;
  /** Faction count — number of identity factions competing for direction. */
  factionCount?: number;
  /** Population density (people per habitable km^2). */
  populationDensity?: number;
  /** Stellar maintenance backlog (0=perfect, 1=critical — Dyson swarm neglect). */
  stellarMaintenanceBacklog?: number;
  /** Civilizational consensus (0=total disagreement on direction, 1=unified). */
  civilizationalConsensus?: number;
  /** Ennui index: existential boredom (0=engaged, 1=total ennui). Replaces morale. */
  ennuiIndex?: number;
  /** Vodka-equivalent consumption at civilizational scale (0=sober, 1=hedonistic collapse). */
  civilizationalVodka?: number;
}

// ─── Serialization ───────────────────────────────────────────────────────────

/** Serialized pressure state for save/load. */
export interface PressureStateSaveData {
  gauges: Record<PressureDomain, PressureGauge>;
}

/** Extended serialized state (includes post-scarcity domains). */
export interface ExtendedPressureStateSaveData {
  gauges: Record<PressureDomain, PressureGauge>;
  postScarcityGauges?: Record<PostScarcityDomain, PressureGauge>;
  transformed?: boolean;
  transformedAtKardashev?: number;
}

/** Serialize a PressureState. */
export function serializePressureState(state: PressureState): PressureStateSaveData {
  return { gauges: { ...state } };
}

/** Serialize an ExtendedPressureState. */
export function serializeExtendedPressureState(state: ExtendedPressureState): ExtendedPressureStateSaveData {
  const data: ExtendedPressureStateSaveData = {
    gauges: { ...state.classical },
    transformed: state.transformed,
    transformedAtKardashev: state.transformedAtKardashev,
  };
  if (state.postScarcity) {
    data.postScarcityGauges = { ...state.postScarcity };
  }
  return data;
}

/** Restore a PressureState from saved data. */
export function restorePressureState(data: PressureStateSaveData): PressureState {
  const state = createPressureState();
  for (const domain of PRESSURE_DOMAINS) {
    if (data.gauges[domain]) {
      state[domain] = { ...data.gauges[domain] };
    }
  }
  return state;
}

/** Restore an ExtendedPressureState from saved data. */
export function restoreExtendedPressureState(data: ExtendedPressureStateSaveData): ExtendedPressureState {
  const state = createExtendedPressureState();
  for (const domain of PRESSURE_DOMAINS) {
    if (data.gauges[domain]) {
      state.classical[domain] = { ...data.gauges[domain] };
    }
  }
  state.transformed = data.transformed ?? false;
  state.transformedAtKardashev = data.transformedAtKardashev ?? 0;
  if (data.postScarcityGauges) {
    state.postScarcity = createPostScarcityPressureState();
    for (const domain of POST_SCARCITY_DOMAINS) {
      if (data.postScarcityGauges[domain]) {
        state.postScarcity[domain] = { ...data.postScarcityGauges[domain] };
      }
    }
  }
  return state;
}
