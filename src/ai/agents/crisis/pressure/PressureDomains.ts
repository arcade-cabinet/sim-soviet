/**
 * @module ai/agents/crisis/pressure/PressureDomains
 *
 * Core types for the historical pressure-valve crisis system.
 *
 * Ten classical pressure domains map to settlement subsystems already computed
 * each tick. Pressure accumulates via the dual-spread model and triggers crises
 * when thresholds are crossed for sustained durations.
 */

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

export interface PressureGauge {
  level: number;
  trend: number;
  warningTicks: number;
  criticalTicks: number;
  lastRawReading: number;
}

export function createGauge(): PressureGauge {
  return {
    level: 0,
    trend: 0,
    warningTicks: 0,
    criticalTicks: 0,
    lastRawReading: 0,
  };
}

export type PressureState = Record<PressureDomain, PressureGauge>;

export function createPressureState(): PressureState {
  const state = {} as PressureState;
  for (const domain of PRESSURE_DOMAINS) {
    state[domain] = createGauge();
  }
  return state;
}

export interface PressureReadContext {
  foodState: 'surplus' | 'stable' | 'rationing' | 'starvation';
  starvationCounter: number;
  starvationGraceTicks: number;
  averageMorale: number;
  averageLoyalty: number;
  sabotageCount: number;
  flightCount: number;
  population: number;
  housingCapacity: number;
  suspicionLevel: number;
  blackMarks: number;
  blat: number;
  powerShortage: boolean;
  unpoweredCount: number;
  totalBuildings: number;
  averageDurability: number;
  growthRate: number;
  laborRatio: number;
  sickCount: number;
  quotaDeficit: number;
  productionTrend: number;
  carryingCapacity: number;
  season: string;
  weather: string;
  climateTrend?: number;
  worldState?: Record<string, unknown>;
  spheres?: Record<string, { governance: string; aggregateHostility: number }>;
  crimeRate?: number;
  judgeCoverage?: number;
  districtDecay?: number;
}

export interface PressureStateSaveData {
  gauges: Record<PressureDomain, PressureGauge>;
}

export function serializePressureState(state: PressureState): PressureStateSaveData {
  return { gauges: { ...state } };
}

export function restorePressureState(data: PressureStateSaveData): PressureState {
  const state = createPressureState();
  for (const domain of PRESSURE_DOMAINS) {
    if (data.gauges[domain]) {
      state[domain] = { ...data.gauges[domain] };
    }
  }
  return state;
}
