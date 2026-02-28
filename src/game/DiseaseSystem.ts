/**
 * @module game/DiseaseSystem
 *
 * Disease outbreak and recovery system for SimSoviet 2000.
 *
 * Diseases are a constant threat to the settlement. Outbreaks
 * are checked once per month (every 30 ticks), influenced by
 * overcrowding, food shortages, and season. Medical buildings
 * (hospital, polyclinic) reduce spread. Sick citizens produce
 * at 50% efficiency until they recover or die.
 *
 * Disease types:
 *   - Typhus:     High spread, moderate mortality, prevented by clinics
 *   - Cholera:    Moderate spread, high mortality, prevented by clinics
 *   - Influenza:  Very high spread, low mortality, seasonal (winter)
 *   - Scurvy:     No spread (nutritional), low mortality, prevented by food surplus
 *
 * Soviet flavor: all diseases are officially "capitalist sabotage."
 */

import { citizens, getResourceEntity, housing as housingArchetype, operationalBuildings } from '@/ecs/archetypes';
import type { CitizenDisease } from '@/ecs/world';
import { world } from '@/ecs/world';
import { TICKS_PER_MONTH } from '@/game/Chronology';
import type { GameRng } from '@/game/SeedSystem';

// ── Disease Definitions ──────────────────────────────────────────────────────

export type DiseaseType = CitizenDisease['type'];

export interface DiseaseDefinition {
  /** Disease identifier */
  type: DiseaseType;
  /** Display name */
  name: string;
  /** Base probability that a citizen contracts this disease per outbreak check */
  spreadRate: number;
  /** Probability of death when the disease runs its course */
  mortalityRate: number;
  /** How long the disease lasts (in ticks) */
  durationTicks: number;
  /** Building defIds that reduce this disease's spread */
  preventedBy: readonly string[];
  /** Whether this disease is seasonal (winter only) */
  winterOnly: boolean;
  /** Whether this disease is caused by food shortage (not contagious) */
  nutritional: boolean;
}

export const DISEASE_DEFINITIONS: readonly DiseaseDefinition[] = [
  {
    type: 'typhus',
    name: 'Typhus',
    spreadRate: 0.04,
    mortalityRate: 0.15,
    durationTicks: 90, // 3 months
    preventedBy: ['hospital', 'polyclinic'],
    winterOnly: false,
    nutritional: false,
  },
  {
    type: 'cholera',
    name: 'Cholera',
    spreadRate: 0.03,
    mortalityRate: 0.25,
    durationTicks: 60, // 2 months
    preventedBy: ['hospital', 'polyclinic'],
    winterOnly: false,
    nutritional: false,
  },
  {
    type: 'influenza',
    name: 'Influenza',
    spreadRate: 0.08,
    mortalityRate: 0.05,
    durationTicks: 30, // 1 month
    preventedBy: ['hospital', 'polyclinic'],
    winterOnly: true,
    nutritional: false,
  },
  {
    type: 'scurvy',
    name: 'Scurvy',
    spreadRate: 0.06,
    mortalityRate: 0.03,
    durationTicks: 60, // 2 months
    preventedBy: [],
    winterOnly: false,
    nutritional: true,
  },
] as const;

// ── Constants ────────────────────────────────────────────────────────────────

/** Base outbreak chance per citizen per month check (2%). */
const BASE_OUTBREAK_CHANCE = 0.02;

/** Overcrowding multiplier (pop > housing cap). */
const OVERCROWDING_MULT = 2.0;

/** Winter multiplier for all non-nutritional diseases. */
const WINTER_MULT = 1.5;

/** Food shortage threshold below which scurvy risk increases. */
const FOOD_SHORTAGE_THRESHOLD = 0.3;

/** Food shortage multiplier for scurvy. */
const FOOD_SHORTAGE_SCURVY_MULT = 3.0;

/** Reduction factor per operational medical building (multiplicative). */
const CLINIC_REDUCTION_PER_BUILDING = 0.4;

/** Maximum clinic reduction (floor — clinics can't eliminate disease entirely). */
const MAX_CLINIC_REDUCTION = 0.1;

/** Labor efficiency multiplier for sick citizens. */
export const SICK_LABOR_MULT = 0.5;

// ── Module-level RNG (standard pattern) ──────────────────────────────────────

let _rng: GameRng | null = null;

/** Initialize the disease system with a seeded RNG. */
export function initDiseaseSystem(rng: GameRng | null): void {
  _rng = rng;
}

// ── Result type ──────────────────────────────────────────────────────────────

export interface DiseaseTickResult {
  /** Number of new infections this tick */
  newInfections: number;
  /** Number of recoveries this tick */
  recoveries: number;
  /** Number of disease deaths this tick */
  deaths: number;
  /** Citizen entities that died from disease (for WorkerSystem cleanup) */
  deadEntities: import('@/ecs/world').Entity[];
  /** Types of diseases that broke out (for Pravda headlines) */
  outbreakTypes: DiseaseType[];
}

// ── Core Logic ───────────────────────────────────────────────────────────────

/**
 * Returns the number of operational medical buildings by defId.
 */
export function countMedicalBuildings(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entity of operationalBuildings) {
    const defId = entity.building.defId;
    if (defId === 'hospital' || defId === 'polyclinic') {
      if (entity.building.powered) {
        counts.set(defId, (counts.get(defId) ?? 0) + 1);
      }
    }
  }
  return counts;
}

/**
 * Calculate the clinic prevention factor for a given disease.
 * Each powered medical building that prevents this disease reduces
 * the outbreak chance multiplicatively.
 *
 * Returns a multiplier in [MAX_CLINIC_REDUCTION, 1.0].
 */
export function clinicPreventionFactor(disease: DiseaseDefinition, medicalCounts: Map<string, number>): number {
  if (disease.preventedBy.length === 0) return 1.0;

  let totalClinics = 0;
  for (const defId of disease.preventedBy) {
    totalClinics += medicalCounts.get(defId) ?? 0;
  }

  if (totalClinics === 0) return 1.0;

  // Each clinic reduces by CLINIC_REDUCTION_PER_BUILDING multiplicatively
  // e.g. 1 clinic = 0.4, 2 clinics = 0.16, clamped to 0.1 min
  const factor = CLINIC_REDUCTION_PER_BUILDING ** totalClinics;
  return Math.max(MAX_CLINIC_REDUCTION, factor);
}

/**
 * Calculate the outbreak chance modifier for environmental factors.
 */
export function calcOutbreakModifier(
  disease: DiseaseDefinition,
  month: number,
  housingCap: number,
  population: number,
  foodRatio: number,
): number {
  let modifier = 1.0;

  // Winter modifier (Nov-Mar) for non-nutritional diseases
  const isWinter = month >= 11 || month <= 3;
  if (isWinter && !disease.nutritional) {
    modifier *= WINTER_MULT;
  }

  // Skip non-winter months for winter-only diseases
  if (disease.winterOnly && !isWinter) {
    return 0;
  }

  // Overcrowding modifier
  if (housingCap > 0 && population > housingCap) {
    modifier *= OVERCROWDING_MULT;
  }

  // Food shortage → scurvy boost
  if (disease.nutritional && foodRatio < FOOD_SHORTAGE_THRESHOLD) {
    modifier *= FOOD_SHORTAGE_SCURVY_MULT;
  }

  // Food surplus prevents scurvy almost entirely
  if (disease.nutritional && foodRatio >= 0.8) {
    modifier *= 0.1;
  }

  return modifier;
}

/**
 * Process disease progression for all sick citizens.
 * Called every tick. Decrements disease timers and checks for
 * recovery or death when the timer expires.
 */
export function progressDiseases(result: DiseaseTickResult): void {
  const rng = _rng;

  const snapshot = [...citizens];
  for (const entity of snapshot) {
    const disease = entity.citizen.disease;
    if (!disease) continue;

    if (disease.ticksRemaining <= 1) {
      // Disease has run its course — death or recovery check
      const def = DISEASE_DEFINITIONS.find((d) => d.type === disease.type);
      const mortalityRate = def?.mortalityRate ?? 0.1;

      const roll = rng?.random() ?? Math.random();
      if (roll < mortalityRate) {
        // Death — collect for WorkerSystem removal (don't remove here)
        result.deaths++;
        result.deadEntities.push(entity);
        entity.citizen.disease = undefined;
      } else {
        // Recovery
        entity.citizen.disease = undefined;
        result.recoveries++;
      }
    } else {
      disease.ticksRemaining--;
    }
  }
}

/**
 * Check for new disease outbreaks among healthy citizens.
 * Called once per month (every 30 ticks).
 */
export function checkOutbreaks(month: number, result: DiseaseTickResult): void {
  const rng = _rng;
  const store = getResourceEntity();
  if (!store) return;

  const population = store.resources.population;
  if (population <= 0) return;

  // Calculate housing capacity
  let housingCap = 0;
  for (const entity of housingArchetype) {
    if (entity.building.powered) {
      housingCap += entity.building.housingCap;
    }
  }

  // Food ratio (0 = starving, 1 = well-fed)
  const foodRatio = Math.min(1, store.resources.food / Math.max(1, population * 2));

  // Count medical buildings once
  const medicalCounts = countMedicalBuildings();

  // Track which disease types broke out this month
  const outbreakSet = new Set<DiseaseType>();

  // Check each healthy citizen for potential infection
  for (const entity of [...citizens]) {
    if (entity.citizen.disease) continue; // already sick

    for (const diseaseDef of DISEASE_DEFINITIONS) {
      const envModifier = calcOutbreakModifier(diseaseDef, month, housingCap, population, foodRatio);
      if (envModifier === 0) continue;

      const clinicFactor = clinicPreventionFactor(diseaseDef, medicalCounts);
      const chance = BASE_OUTBREAK_CHANCE * diseaseDef.spreadRate * envModifier * clinicFactor;

      const roll = rng?.random() ?? Math.random();
      if (roll < chance) {
        // Infected!
        entity.citizen.disease = {
          type: diseaseDef.type,
          ticksRemaining: diseaseDef.durationTicks,
        };
        result.newInfections++;
        outbreakSet.add(diseaseDef.type);
        break; // A citizen can only catch one disease per check
      }
    }
  }

  result.outbreakTypes = [...outbreakSet];
}

/**
 * Main disease tick — called every simulation tick.
 *
 * - Every tick: progress existing diseases (decrement timers, check deaths)
 * - Monthly (every 30 ticks): check for new outbreaks
 *
 * @param totalTicks Current total tick count from chronology
 * @param month      Current game month (1-12)
 * @returns Result with infection/recovery/death counts
 */
export function diseaseTick(totalTicks: number, month: number): DiseaseTickResult {
  const result: DiseaseTickResult = {
    newInfections: 0,
    recoveries: 0,
    deaths: 0,
    deadEntities: [],
    outbreakTypes: [],
  };

  if (totalTicks <= 0) return result;

  // Progress existing diseases every tick
  progressDiseases(result);

  // Monthly outbreak check
  if (totalTicks % TICKS_PER_MONTH === 0) {
    checkOutbreaks(month, result);
  }

  return result;
}

// ── Pravda Headlines ─────────────────────────────────────────────────────────

/** Soviet-flavored disease headlines for the Pravda ticker. */
export const DISEASE_PRAVDA_HEADLINES: Record<DiseaseType, string[]> = {
  typhus: [
    'CAPITALIST SABOTEURS SPREAD TYPHUS IN GLORIOUS SETTLEMENT',
    'HEROIC DOCTORS BATTLE IMPERIALIST TYPHUS PLOT',
    'TYPHUS OUTBREAK TRACED TO FOREIGN AGENTS — INVESTIGATION ONGOING',
  ],
  cholera: [
    'CHOLERA? MERELY CAPITALIST PROPAGANDA — SITUATION UNDER CONTROL',
    'BOURGEOIS CHOLERA DEFEATED BY SOVIET MEDICINE',
    'MINOR INTESTINAL DIFFICULTIES REPORTED — NO CAUSE FOR ALARM',
  ],
  influenza: [
    'SEASONAL COLD AFFECTS SOME WORKERS — PRODUCTION UNAFFECTED',
    'INFLUENZA IS CAPITALIST WEAKNESS — SOVIET CITIZENS RECOVER FASTER',
    'MILD FLU SEASON PROVES SUPERIORITY OF SOCIALIST HEALTHCARE',
  ],
  scurvy: [
    'VITAMIN DEFICIENCY? IMPOSSIBLE UNDER SOCIALISM — DIET IS ADEQUATE',
    'REPORTS OF SCURVY ARE WESTERN EXAGGERATION — ALL CITIZENS WELL-FED',
    'MINOR NUTRITIONAL ADJUSTMENT NEEDED — COMRADE DIETICIAN CONSULTED',
  ],
};
