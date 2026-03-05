/**
 * @module ai/agents/crisis/pressure/PressureDomains
 *
 * Core types for the pressure-valve crisis system.
 *
 * 10 pressure domains map to game subsystems already computed each tick.
 * Each domain is normalized to 0-1 (0 = no stress, 1 = maximum stress).
 * Pressure accumulates via dual-spread model and triggers crises when
 * thresholds are crossed for sustained durations.
 */

// ─── Pressure Domains ────────────────────────────────────────────────────────

/** The 10 pressure domains tracked by the system. */
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

/** All domain keys as a readonly array (iteration order). */
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

/** Full pressure state across all domains. */
export type PressureState = Record<PressureDomain, PressureGauge>;

/** Create a fresh PressureState with all gauges at zero. */
export function createPressureState(): PressureState {
  const state = {} as PressureState;
  for (const domain of PRESSURE_DOMAINS) {
    state[domain] = createGauge();
  }
  return state;
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
}

// ─── Serialization ───────────────────────────────────────────────────────────

/** Serialized pressure state for save/load. */
export interface PressureStateSaveData {
  gauges: Record<PressureDomain, PressureGauge>;
}

/** Serialize a PressureState. */
export function serializePressureState(state: PressureState): PressureStateSaveData {
  return { gauges: { ...state } };
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
