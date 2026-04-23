/**
 * @module ai/agents/political/LawEnforcementSystem
 *
 * Settlement law enforcement for the historical campaign.
 *
 * Crime pressure model:
 *   crimeRate = baseCrime * (1 + densityPressure) * (1 - employmentRate)
 *              * (1 - morale/100) * (1 + inequalityIndex) * (1 - judgeCoverage)
 */

import type { EraId } from '../../../game/era/types';

// ─── Law Enforcement Mode ────────────────────────────────────────────────────

/**
 * Which enforcement mode is active. Historical 1.0 keeps the KGB/local militia model.
 */
export type LawEnforcementMode = 'kgb';

/** Map eras to their enforcement mode. */
const ERA_ENFORCEMENT_MODE: Partial<Record<EraId, LawEnforcementMode>> = {
  revolution: 'kgb',
  collectivization: 'kgb',
  industrialization: 'kgb',
  great_patriotic: 'kgb',
  reconstruction: 'kgb',
  thaw_and_freeze: 'kgb',
  stagnation: 'kgb',
};

/** Get the enforcement mode for a given era. */
export function getEnforcementMode(era: EraId): LawEnforcementMode {
  return ERA_ENFORCEMENT_MODE[era] ?? 'kgb';
}

// ─── Sector Block ────────────────────────────────────────────────────────────

/** A sector block — administrative division of the local settlement. */
export interface SectorBlock {
  /** Unique sector identifier. */
  id: string;
  /** Display name (e.g. "Sector 7-G", "Block Sigma-12"). */
  name: string;
  /** Population assigned to this sector. */
  population: number;
  /** Habitable area in km^2. */
  area: number;
  /** Number of judges/enforcers patrolling this sector. */
  judgeCount: number;
  /** Current crime rate (0-1, 0 = no crime, 1 = lawless). */
  crimeRate: number;
  /** District disorder level (0-1, 0 = orderly, 1 = severe local disorder). */
  districtDecay: number;
  /** Local detention capacity. */
  detentionCapacity: number;
  /** Population in local detention or penal labor custody. */
  detainedPopulation: number;
}

/** Create a new sector block with sensible defaults. */
export function createSectorBlock(id: string, name: string, population: number, area: number): SectorBlock {
  return {
    id,
    name,
    population,
    area,
    judgeCount: 0,
    crimeRate: 0,
    districtDecay: 0,
    detentionCapacity: 0,
    detainedPopulation: 0,
  };
}

// ─── Crime Rate Computation ──────────────────────────────────────────────────

/** Inputs for the crime rate model. */
export interface CrimeRateContext {
  /** Base crime level for the era (0-1). */
  baseCrime: number;
  /** Local crowding pressure (0-1), derived from settlement population and capacity. */
  densityPressure: number;
  /** Employment rate (0-1, fraction of working-age pop that is employed). */
  employmentRate: number;
  /** Average morale (0-100). */
  morale: number;
  /** Inequality index (0-1, 0 = egalitarian, 1 = extreme inequality). */
  inequalityIndex: number;
  /** Judge coverage (0-1, fraction of population covered by enforcers). */
  judgeCoverage: number;
}

/** Base crime levels by enforcement mode. */
export const BASE_CRIME_BY_MODE: Record<LawEnforcementMode, number> = {
  kgb: 0.05,
};

/**
 * Compute crime rate for a sector or settlement.
 *
 * Formula:
 *   crimeRate = baseCrime * (1 + densityPressure)
 *             * (1 - employmentRate)
 *             * (1 - morale / 100)
 *             * (1 + inequalityIndex)
 *             * (1 - judgeCoverage)
 *
 * Clamped to [0, 1].
 */
export function computeCrimeRate(ctx: CrimeRateContext): number {
  const raw =
    ctx.baseCrime *
    (1 + ctx.densityPressure) *
    (1 - Math.min(1, Math.max(0, ctx.employmentRate))) *
    (1 - Math.min(100, Math.max(0, ctx.morale)) / 100) *
    (1 + Math.min(1, Math.max(0, ctx.inequalityIndex))) *
    (1 - Math.min(1, Math.max(0, ctx.judgeCoverage)));

  return Math.min(1, Math.max(0, raw));
}

// ─── Judge Coverage ──────────────────────────────────────────────────────────

/** Judges required per 10,000 population for full coverage. */
export const JUDGES_PER_10K = 5;

/**
 * Compute judge coverage ratio (0-1) from judge count and population.
 * Full coverage = JUDGES_PER_10K per 10,000 people.
 */
export function computeJudgeCoverage(judgeCount: number, population: number): number {
  if (population <= 0) return 1;
  const required = (population / 10_000) * JUDGES_PER_10K;
  if (required <= 0) return 1;
  return Math.min(1, judgeCount / required);
}

// ─── District Disorder ───────────────────────────────────────────────────────

/** District disorder rates per tick by enforcement mode. */
export const DISTRICT_DECAY_RATE: Record<LawEnforcementMode, number> = {
  kgb: 0,
};

/** Crime amplifier from district disorder (multiplicative). */
export const DISTRICT_CRIME_AMPLIFIER = 0.5;

/**
 * Compute local district disorder progression for one tick.
 *
 * Disorder rises when:
 *   - Population density is high (density pressure > 0.3)
 *   - Infrastructure pressure is non-zero (buildings aging)
 *   - Enforcement mode supports it
 *
 * @param currentDecay - Current disorder level (0-1)
 * @param mode - Current enforcement mode
 * @param densityPressure - Population density pressure (0-1)
 * @param infrastructurePressure - Infrastructure decay pressure (0-1)
 * @param judgePresence - Whether judges are patrolling this sector (reduces decay rate)
 * @returns New disorder level (0-1)
 */
export function tickDistrictDecay(
  currentDecay: number,
  mode: LawEnforcementMode,
  densityPressure: number,
  infrastructurePressure: number,
  judgePresence: boolean,
): number {
  const baseRate = DISTRICT_DECAY_RATE[mode];
  if (baseRate === 0) return currentDecay;

  // Decay accelerates with density and infrastructure pressure
  const densityFactor = densityPressure > 0.3 ? (densityPressure - 0.3) / 0.7 : 0;
  const infraFactor = infrastructurePressure * 0.5;
  const growth = baseRate * (1 + densityFactor + infraFactor);

  // Judge presence reduces decay growth by 40%
  const modifiedGrowth = judgePresence ? growth * 0.6 : growth;

  // Small natural recovery (maintenance crews)
  const recovery = 0.0002;

  const newDecay = currentDecay + modifiedGrowth - recovery;
  return Math.min(1, Math.max(0, newDecay));
}

// ─── Detention And Penal Labor ───────────────────────────────────────────────

/** Local detention capacity per facility. */
export const DETENTION_CAPACITY = 500;

/** Labor output per detained worker (as fraction of free worker). */
export const PENAL_LABOR_EFFICIENCY = 0.4;

/** Monthly detention mortality rate (fraction of detainees). */
export const DETENTION_MORTALITY_RATE = 0.002;

/**
 * Compute how many people should be detained this tick.
 * Based on crime rate and judge activity.
 *
 * @param crimeRate - Sector crime rate (0-1)
 * @param population - Sector population
 * @param judgeCoverage - Judge coverage ratio (0-1)
 * @returns Number of new detentions
 */
export function computeDetentions(crimeRate: number, population: number, judgeCoverage: number): number {
  if (crimeRate <= 0 || judgeCoverage <= 0) return 0;
  // Sentencing rate: proportional to crime * judge activity
  const sentencingRate = crimeRate * judgeCoverage * 0.001; // 0.1% of crime * coverage
  return Math.floor(population * sentencingRate);
}

/**
 * Compute labor output from detained population.
 * @param detainedPopulation - Total detainees assigned to penal labor
 * @returns Equivalent free-worker labor units
 */
export function computePenalLabor(detainedPopulation: number): number {
  return detainedPopulation * PENAL_LABOR_EFFICIENCY;
}

// ─── Sector Subdivision ──────────────────────────────────────────────────────

/** Population thresholds for sector subdivision. */
export const SECTOR_SUBDIVISION_THRESHOLD = 1_000_000; // 1M per sector max

/**
 * Compute how many sectors a population requires.
 * @param population - Total population
 * @param mode - Current enforcement mode
 * @returns Required number of sectors
 */
export function computeRequiredSectors(population: number, mode: LawEnforcementMode): number {
  void population;
  void mode;
  return 1;
}

/**
 * Generate sector names in Soviet bureaucratic style.
 * @param count - Number of sectors to name
 * @param mode - Enforcement mode (affects naming convention)
 * @returns Array of sector names
 */
export function generateSectorNames(count: number, mode: LawEnforcementMode): string[] {
  const names: string[] = [];
  void mode;
  const prefix = 'District';
  for (let i = 0; i < count; i++) {
    const letter = String.fromCharCode(65 + (i % 26)); // A-Z
    const number = Math.floor(i / 26) + 1;
    names.push(`${prefix} ${letter}-${number}`);
  }
  return names;
}

// ─── Law Enforcement State ───────────────────────────────────────────────────

/** Full law enforcement state — serializable for save/load. */
export interface LawEnforcementState {
  /** Current enforcement mode. */
  mode: LawEnforcementMode;
  /** Administrative sectors for local crime pressure. */
  sectors: SectorBlock[];
  /** Aggregate crime rate across all sectors (0-1). */
  aggregateCrimeRate: number;
  /** Total judges/enforcers across all sectors. */
  totalJudges: number;
  /** Total detained population across all sectors. */
  totalDetainedPopulation: number;
  /** Total penal labor output (equivalent free workers). */
  totalPenalLabor: number;
}

/** Create initial law enforcement state. */
export function createLawEnforcementState(mode: LawEnforcementMode = 'kgb'): LawEnforcementState {
  return {
    mode,
    sectors: [],
    aggregateCrimeRate: 0,
    totalJudges: 0,
    totalDetainedPopulation: 0,
    totalPenalLabor: 0,
  };
}

// ─── Tick Function ───────────────────────────────────────────────────────────

/** Context needed to tick the law enforcement system. */
export interface LawEnforcementTickContext {
  /** Current era. */
  era: EraId;
  /** Total population. */
  population: number;
  /** Habitable area in km^2. */
  habitableArea: number;
  /** Employment rate (0-1). */
  employmentRate: number;
  /** Average morale (0-100). */
  morale: number;
  /** Inequality index (0-1). */
  inequalityIndex: number;
  /** Density pressure from PressureSystem (0-1). */
  densityPressure: number;
  /** Infrastructure pressure from PressureSystem (0-1). */
  infrastructurePressure: number;
}

/**
 * Tick the law enforcement system once.
 *
 * Handles:
 * - Mode transition based on era
 * - Sector subdivision when population exceeds thresholds
 * - Per-sector crime rate computation
 * - District disorder progression
 * - Detention pressure
 * - Aggregate stats
 *
 * @returns Updated state (new object, does not mutate input)
 */
export function tickLawEnforcement(state: LawEnforcementState, ctx: LawEnforcementTickContext): LawEnforcementState {
  const newMode = getEnforcementMode(ctx.era);

  // Determine sector count
  const requiredSectors = computeRequiredSectors(ctx.population, newMode);
  let sectors = state.sectors;

  // Reallocate sectors if mode changed or count changed
  if (newMode !== state.mode || sectors.length !== requiredSectors) {
    const names = generateSectorNames(requiredSectors, newMode);
    const popPerSector = Math.floor(ctx.population / requiredSectors);
    const areaPerSector = ctx.habitableArea / requiredSectors;

    sectors = names.map((name, i) => {
      // Preserve existing sector data where possible
      const existing = state.sectors[i];
      if (existing) {
        return {
          ...existing,
          name,
          population: popPerSector,
          area: areaPerSector,
        };
      }
      return createSectorBlock(`sector-${i}`, name, popPerSector, areaPerSector);
    });
  } else {
    // Redistribute population evenly across existing sectors
    const popPerSector = Math.floor(ctx.population / sectors.length);
    sectors = sectors.map((s) => ({ ...s, population: popPerSector }));
  }

  // Auto-assign judges based on population.
  // Judges are recruited at 60% of the ideal rate (full coverage = JUDGES_PER_10K per 10K).
  // The deficit creates endemic crime that the chairman cannot fully eliminate —
  // bureaucratic underfunding is the antagonist.
  const idealJudges = Math.floor((ctx.population / 10_000) * JUDGES_PER_10K);
  const totalJudgePool = Math.floor(idealJudges * 0.6);
  const judgesPerSector = sectors.length > 0 ? Math.floor(totalJudgePool / sectors.length) : 0;

  const baseCrime = BASE_CRIME_BY_MODE[newMode];

  // Tick each sector
  let totalCrime = 0;
  let totalDetained = 0;

  const tickedSectors = sectors.map((sector) => {
    const sectorCopy = { ...sector, judgeCount: judgesPerSector };

    // Judge coverage
    const coverage = computeJudgeCoverage(sectorCopy.judgeCount, sectorCopy.population);

    // District disorder
    const newDecay = tickDistrictDecay(
      sectorCopy.districtDecay,
      newMode,
      ctx.densityPressure,
      ctx.infrastructurePressure,
      coverage > 0.5,
    );
    sectorCopy.districtDecay = newDecay;

    // Crime rate amplified by district disorder
    const rawCrime = computeCrimeRate({
      baseCrime,
      densityPressure: ctx.densityPressure,
      employmentRate: ctx.employmentRate,
      morale: ctx.morale,
      inequalityIndex: ctx.inequalityIndex,
      judgeCoverage: coverage,
    });
    sectorCopy.crimeRate = Math.min(1, rawCrime * (1 + newDecay * DISTRICT_CRIME_AMPLIFIER));

    totalCrime += sectorCopy.crimeRate;
    totalDetained += sectorCopy.detainedPopulation;
    return sectorCopy;
  });

  const aggregateCrimeRate = tickedSectors.length > 0 ? totalCrime / tickedSectors.length : 0;
  const totalPenalLabor = computePenalLabor(totalDetained);

  return {
    mode: newMode,
    sectors: tickedSectors,
    aggregateCrimeRate,
    totalJudges: totalJudgePool,
    totalDetainedPopulation: totalDetained,
    totalPenalLabor,
  };
}

// ─── Serialization ───────────────────────────────────────────────────────────

/** Serialized law enforcement state for save/load. */
export interface LawEnforcementSaveData {
  mode: LawEnforcementMode;
  sectors: Partial<SectorBlock>[];
  aggregateCrimeRate: number;
  totalJudges: number;
  totalDetainedPopulation: number;
}

/** Serialize law enforcement state. */
export function serializeLawEnforcement(state: LawEnforcementState): LawEnforcementSaveData {
  return {
    mode: state.mode,
    sectors: state.sectors.map((s) => ({ ...s })),
    aggregateCrimeRate: state.aggregateCrimeRate,
    totalJudges: state.totalJudges,
    totalDetainedPopulation: state.totalDetainedPopulation,
  };
}

/** Restore law enforcement state from save data. */
export function restoreLawEnforcement(data: LawEnforcementSaveData): LawEnforcementState {
  const totalDetainedPopulation = finiteNonNegative(data.totalDetainedPopulation);
  return {
    mode: data.mode,
    sectors: data.sectors.map(restoreSectorBlock),
    aggregateCrimeRate: clamp01(data.aggregateCrimeRate),
    totalJudges: finiteNonNegative(data.totalJudges),
    totalDetainedPopulation,
    totalPenalLabor: computePenalLabor(totalDetainedPopulation),
  };
}

function restoreSectorBlock(data: Partial<SectorBlock>): SectorBlock {
  return {
    id: data.id ?? 'sector-0',
    name: data.name ?? 'District A-1',
    population: finiteNonNegative(data.population ?? 0),
    area: Math.max(1, finiteNonNegative(data.area ?? 1)),
    judgeCount: finiteNonNegative(data.judgeCount ?? 0),
    crimeRate: clamp01(data.crimeRate ?? 0),
    districtDecay: clamp01(data.districtDecay ?? 0),
    detentionCapacity: finiteNonNegative(data.detentionCapacity ?? 0),
    detainedPopulation: finiteNonNegative(data.detainedPopulation ?? 0),
  };
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
