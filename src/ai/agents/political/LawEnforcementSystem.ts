/**
 * @module ai/agents/political/LawEnforcementSystem
 *
 * MegaCity law enforcement — era-based evolution from KGB to Judge Corps.
 *
 * Evolution timeline:
 *   1917-1991:  KGB + politruks (suspicion, marks, blat) — handled by KGBAgent
 *   1991-2500:  Security Services (same mechanics, less ideological)
 *   2500-10000: Sector Judges (crime rate per sector, patrol coverage)
 *   10000+:     Megacity Arbiters (undercity, iso-cubes)
 *
 * Sector Blocks:
 *   MegaEarth is divided into administrative sectors (scaling like
 *   dvory -> buildings -> arcologies -> sectors). Each sector has a
 *   crime rate, judge coverage, and undercity decay level.
 *
 * Undercity:
 *   Below arcology layers, abandoned infrastructure becomes criminal territory.
 *   As arcologies build upward, lower levels decay — emergent undercity formation.
 *
 * Iso-Cubes:
 *   Megacity gulag system. Solves overcrowding AND provides forced labor.
 *   Like gulags but at civilizational scale — iso-cubes are the megacity answer
 *   to population management.
 *
 * Crime Rate Model:
 *   crimeRate = baseCrime * (1 + densityPressure) * (1 - employmentRate)
 *              * (1 - morale/100) * (1 + inequalityIndex) * (1 - judgeCoverage)
 */

import type { EraId } from '../../../game/era/types';

// ─── Law Enforcement Mode ────────────────────────────────────────────────────

/**
 * Which enforcement mode is active — determines what mechanics apply.
 * Transitions based on current era.
 */
export type LawEnforcementMode = 'kgb' | 'security_services' | 'sector_judges' | 'megacity_arbiters';

/** Map eras to their enforcement mode. */
const ERA_ENFORCEMENT_MODE: Partial<Record<EraId, LawEnforcementMode>> = {
  revolution: 'kgb',
  collectivization: 'kgb',
  industrialization: 'kgb',
  great_patriotic: 'kgb',
  reconstruction: 'kgb',
  thaw_and_freeze: 'kgb',
  stagnation: 'kgb',
  the_eternal: 'kgb',
  post_soviet: 'security_services',
  planetary: 'security_services',
  solar_engineering: 'sector_judges',
  type_one: 'sector_judges',
  deconstruction: 'megacity_arbiters',
  dyson_swarm: 'megacity_arbiters',
  megaearth: 'megacity_arbiters',
  type_two_peak: 'megacity_arbiters',
};

/** Get the enforcement mode for a given era. */
export function getEnforcementMode(era: EraId): LawEnforcementMode {
  return ERA_ENFORCEMENT_MODE[era] ?? 'kgb';
}

// ─── Sector Block ────────────────────────────────────────────────────────────

/** A sector block — administrative division of a megacity. */
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
  /** Undercity decay level (0-1, 0 = pristine, 1 = fully decayed). */
  undercityDecay: number;
  /** Number of iso-cubes in this sector. */
  isoCubeCount: number;
  /** Population in iso-cubes (detained). */
  isoCubePopulation: number;
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
    undercityDecay: 0,
    isoCubeCount: 0,
    isoCubePopulation: 0,
  };
}

// ─── Crime Rate Computation ──────────────────────────────────────────────────

/** Inputs for the crime rate model. */
export interface CrimeRateContext {
  /** Base crime level for the era (0-1). */
  baseCrime: number;
  /** Population density pressure (0-1, from PressureDomains.density). */
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
  kgb: 0.05,               // low — KGB suppression through terror
  security_services: 0.08,  // slightly higher — less ideological control
  sector_judges: 0.12,      // higher — massive populations, complex governance
  megacity_arbiters: 0.15,  // highest — billions in megastructures
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

// ─── Undercity Decay ─────────────────────────────────────────────────────────

/** Undercity decay rates per tick by enforcement mode. */
export const UNDERCITY_DECAY_RATE: Record<LawEnforcementMode, number> = {
  kgb: 0,                    // no undercity in pre-megacity eras
  security_services: 0,       // still no meaningful undercity
  sector_judges: 0.001,       // early undercity formation
  megacity_arbiters: 0.003,   // rapid undercity expansion
};

/** Crime amplifier from undercity decay (multiplicative). */
export const UNDERCITY_CRIME_AMPLIFIER = 0.5;

/**
 * Compute undercity decay progression for one tick.
 *
 * Undercity forms when:
 *   - Population density is high (density pressure > 0.3)
 *   - Infrastructure pressure is non-zero (buildings aging)
 *   - Enforcement mode supports it
 *
 * @param currentDecay - Current undercity decay level (0-1)
 * @param mode - Current enforcement mode
 * @param densityPressure - Population density pressure (0-1)
 * @param infrastructurePressure - Infrastructure decay pressure (0-1)
 * @param judgePresence - Whether judges are patrolling this sector (reduces decay rate)
 * @returns New undercity decay level (0-1)
 */
export function tickUndercityDecay(
  currentDecay: number,
  mode: LawEnforcementMode,
  densityPressure: number,
  infrastructurePressure: number,
  judgePresence: boolean,
): number {
  const baseRate = UNDERCITY_DECAY_RATE[mode];
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

// ─── Iso-Cube System ─────────────────────────────────────────────────────────

/** Iso-cube capacity per cube. */
export const ISO_CUBE_CAPACITY = 500;

/** Labor output per iso-cube prisoner (as fraction of free worker). */
export const ISO_CUBE_LABOR_EFFICIENCY = 0.4;

/** Monthly mortality rate in iso-cubes (fraction of inmates). */
export const ISO_CUBE_MORTALITY_RATE = 0.002;

/**
 * Compute how many should be sentenced to iso-cubes this tick.
 * Based on crime rate and judge activity.
 *
 * @param crimeRate - Sector crime rate (0-1)
 * @param population - Sector population
 * @param judgeCoverage - Judge coverage ratio (0-1)
 * @returns Number of new iso-cube sentences
 */
export function computeIsoCubeSentences(crimeRate: number, population: number, judgeCoverage: number): number {
  if (crimeRate <= 0 || judgeCoverage <= 0) return 0;
  // Sentencing rate: proportional to crime * judge activity
  const sentencingRate = crimeRate * judgeCoverage * 0.001; // 0.1% of crime * coverage
  return Math.floor(population * sentencingRate);
}

/**
 * Compute labor output from iso-cube population.
 * @param isoCubePopulation - Total prisoners in iso-cubes
 * @returns Equivalent free-worker labor units
 */
export function computeIsoCubeLabor(isoCubePopulation: number): number {
  return isoCubePopulation * ISO_CUBE_LABOR_EFFICIENCY;
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
  if (mode === 'kgb' || mode === 'security_services') return 1; // no sector subdivision
  return Math.max(1, Math.ceil(population / SECTOR_SUBDIVISION_THRESHOLD));
}

/**
 * Generate sector names in Soviet bureaucratic style.
 * @param count - Number of sectors to name
 * @param mode - Enforcement mode (affects naming convention)
 * @returns Array of sector names
 */
export function generateSectorNames(count: number, mode: LawEnforcementMode): string[] {
  const names: string[] = [];
  const prefix = mode === 'sector_judges' ? 'Sector' : 'Block';
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
  /** Administrative sectors (empty array in kgb/security_services mode). */
  sectors: SectorBlock[];
  /** Aggregate crime rate across all sectors (0-1). */
  aggregateCrimeRate: number;
  /** Total judges/enforcers across all sectors. */
  totalJudges: number;
  /** Total iso-cube population across all sectors. */
  totalIsoCubePopulation: number;
  /** Total iso-cube labor output (equivalent free workers). */
  totalIsoCubeLabor: number;
}

/** Create initial law enforcement state. */
export function createLawEnforcementState(mode: LawEnforcementMode = 'kgb'): LawEnforcementState {
  return {
    mode,
    sectors: [],
    aggregateCrimeRate: 0,
    totalJudges: 0,
    totalIsoCubePopulation: 0,
    totalIsoCubeLabor: 0,
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
 * - Undercity decay progression
 * - Iso-cube sentencing
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
  let totalIsoCubePop = 0;

  const tickedSectors = sectors.map((sector) => {
    const sectorCopy = { ...sector, judgeCount: judgesPerSector };

    // Judge coverage
    const coverage = computeJudgeCoverage(sectorCopy.judgeCount, sectorCopy.population);

    // Undercity decay
    const newDecay = tickUndercityDecay(
      sectorCopy.undercityDecay,
      newMode,
      ctx.densityPressure,
      ctx.infrastructurePressure,
      coverage > 0.5,
    );
    sectorCopy.undercityDecay = newDecay;

    // Crime rate (amplified by undercity)
    const rawCrime = computeCrimeRate({
      baseCrime,
      densityPressure: ctx.densityPressure,
      employmentRate: ctx.employmentRate,
      morale: ctx.morale,
      inequalityIndex: ctx.inequalityIndex,
      judgeCoverage: coverage,
    });
    sectorCopy.crimeRate = Math.min(1, rawCrime * (1 + newDecay * UNDERCITY_CRIME_AMPLIFIER));

    // Iso-cube sentencing (only in judge/arbiter modes)
    if (newMode === 'sector_judges' || newMode === 'megacity_arbiters') {
      const newSentences = computeIsoCubeSentences(sectorCopy.crimeRate, sectorCopy.population, coverage);
      sectorCopy.isoCubePopulation += newSentences;

      // Iso-cube mortality
      const deaths = Math.floor(sectorCopy.isoCubePopulation * ISO_CUBE_MORTALITY_RATE);
      sectorCopy.isoCubePopulation = Math.max(0, sectorCopy.isoCubePopulation - deaths);

      // Cap at iso-cube capacity
      const totalCapacity = sectorCopy.isoCubeCount * ISO_CUBE_CAPACITY;
      if (sectorCopy.isoCubePopulation > totalCapacity && totalCapacity > 0) {
        sectorCopy.isoCubePopulation = totalCapacity;
      }

      // Auto-build iso-cubes when at capacity (one per tick)
      if (totalCapacity > 0 && sectorCopy.isoCubePopulation >= totalCapacity * 0.9) {
        sectorCopy.isoCubeCount++;
      } else if (sectorCopy.isoCubeCount === 0 && sectorCopy.crimeRate > 0.1) {
        // First iso-cube when crime rate exceeds 10%
        sectorCopy.isoCubeCount = 1;
      }
    }

    totalCrime += sectorCopy.crimeRate;
    totalIsoCubePop += sectorCopy.isoCubePopulation;
    return sectorCopy;
  });

  const aggregateCrimeRate = tickedSectors.length > 0 ? totalCrime / tickedSectors.length : 0;
  const totalIsoCubeLabor = computeIsoCubeLabor(totalIsoCubePop);

  return {
    mode: newMode,
    sectors: tickedSectors,
    aggregateCrimeRate,
    totalJudges: totalJudgePool,
    totalIsoCubePopulation: totalIsoCubePop,
    totalIsoCubeLabor,
  };
}

// ─── Serialization ───────────────────────────────────────────────────────────

/** Serialized law enforcement state for save/load. */
export interface LawEnforcementSaveData {
  mode: LawEnforcementMode;
  sectors: SectorBlock[];
  aggregateCrimeRate: number;
  totalJudges: number;
  totalIsoCubePopulation: number;
}

/** Serialize law enforcement state. */
export function serializeLawEnforcement(state: LawEnforcementState): LawEnforcementSaveData {
  return {
    mode: state.mode,
    sectors: state.sectors.map((s) => ({ ...s })),
    aggregateCrimeRate: state.aggregateCrimeRate,
    totalJudges: state.totalJudges,
    totalIsoCubePopulation: state.totalIsoCubePopulation,
  };
}

/** Restore law enforcement state from save data. */
export function restoreLawEnforcement(data: LawEnforcementSaveData): LawEnforcementState {
  return {
    mode: data.mode,
    sectors: data.sectors.map((s) => ({ ...s })),
    aggregateCrimeRate: data.aggregateCrimeRate,
    totalJudges: data.totalJudges,
    totalIsoCubePopulation: data.totalIsoCubePopulation,
    totalIsoCubeLabor: computeIsoCubeLabor(data.totalIsoCubePopulation),
  };
}
