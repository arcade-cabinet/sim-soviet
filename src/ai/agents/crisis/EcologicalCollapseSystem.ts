/**
 * @module ai/agents/crisis/EcologicalCollapseSystem
 *
 * Evaluates which ecological collapse events from ecology.json are active
 * based on the current year and world state. Events activate at their
 * startYear and remain active permanently (accumulating degradation).
 *
 * Pure function system (NOT a Yuka agent). Called from phaseChronology
 * or Governor each tick to compute pressure modifiers, resource tracking
 * flags, and production multipliers from long-term ecological collapse.
 *
 * The ecological collapse timeline spans from 2050 (permafrost thaw) to
 * 100,000+ years (magnetic field weakening), modeling the slow heat death
 * of Earth's habitability as the Soviet Union endures eternally.
 */

import type { PressureDomain } from './pressure/PressureDomains';
import ecologyData from '@/config/ecology.json';

// ─── Ecology Config ─────────────────────────────────────────────────────────

const COLLAPSE = ecologyData.ecologicalCollapse;

// ─── Context & Result Types ─────────────────────────────────────────────────

/**
 * Input context for ecological collapse evaluation.
 * Assembled from existing agent APIs — no new computation required.
 */
export interface EcologicalCollapseContext {
  /** Current game year. */
  year: number;
  /** Climate trend from WorldAgent (-1 to +1). */
  climateTrend: number;
  /** Current total population. */
  population: number;
  /** Terrain statistics from terrain tick results. */
  terrainStats: {
    /** Average permafrost level across tiles (0-1, 0 = fully thawed). */
    avgPermafrost: number;
    /** Average pollution level across tiles (0-1). */
    avgPollution: number;
    /** Average soil fertility across tiles (0-100). */
    avgSoilFertility: number;
  };
}

/**
 * Output result of ecological collapse evaluation.
 * Provides pressure modifiers and gameplay flags for downstream systems.
 */
export interface EcologicalCollapseResult {
  /** Active collapse events (event keys from ecology.json). */
  activeEvents: string[];
  /** Pressure modifiers to apply (additive to raw pressure readings). */
  pressureModifiers: Partial<Record<PressureDomain, number>>;
  /** Whether domes are now required for survival. */
  domesRequired: boolean;
  /** Whether oxygen tracking should be enabled on Earth. */
  oxygenTrackingRequired: boolean;
  /** Whether water tracking should be enabled on Earth. */
  waterTrackingRequired: boolean;
  /** Production multiplier for food (soil exhaustion). Starts at 1.0. */
  foodProductionMult: number;
  /** Infrastructure damage rate from permafrost thaw. */
  infrastructureDamageRate: number;
}

// ─── Default Result ─────────────────────────────────────────────────────────

/** Create a clean result with no active events. */
function createDefaultResult(): EcologicalCollapseResult {
  return {
    activeEvents: [],
    pressureModifiers: {},
    domesRequired: false,
    oxygenTrackingRequired: false,
    waterTrackingRequired: false,
    foodProductionMult: 1.0,
    infrastructureDamageRate: 0,
  };
}

// ─── Pressure Modifier Helpers ──────────────────────────────────────────────

/** Add a value to a pressure domain in the modifiers record. */
function addPressure(
  mods: Partial<Record<PressureDomain, number>>,
  domain: PressureDomain,
  amount: number,
): void {
  mods[domain] = (mods[domain] ?? 0) + amount;
}

// ─── Core Evaluation ────────────────────────────────────────────────────────

/**
 * Evaluate which ecological collapse events are active and compute
 * their combined effects on the settlement.
 *
 * Events activate at their startYear and remain permanently active.
 * Effects stack additively for pressure modifiers and multiplicatively
 * for production multipliers.
 *
 * @param ctx - Current ecological context
 * @returns Combined collapse effects
 */
export function evaluateEcologicalCollapse(ctx: EcologicalCollapseContext): EcologicalCollapseResult {
  const result = createDefaultResult();
  const { year, climateTrend, terrainStats } = ctx;

  // ── Permafrost Thaw (2050+) ───────────────────────────────────────────────
  if (year >= COLLAPSE.permafrostThaw.startYear) {
    result.activeEvents.push('permafrostThaw');
    // Infrastructure damage proportional to permafrost thaw (lower avgPermafrost = more thawed)
    const thawFactor = 1 - terrainStats.avgPermafrost;
    result.infrastructureDamageRate = COLLAPSE.permafrostThaw.infrastructureDamageRate * thawFactor;
    // Pressure: infrastructure from thaw, health from disease outbreak chance
    addPressure(result.pressureModifiers, 'infrastructure', 0.1 * thawFactor);
    addPressure(result.pressureModifiers, 'health', COLLAPSE.permafrostThaw.diseaseOutbreakChance * 10);
  }

  // ── Ozone Depletion (2100+) ───────────────────────────────────────────────
  if (year >= COLLAPSE.ozoneDepletion.startYear) {
    result.activeEvents.push('ozoneDepletion');
    result.domesRequired = COLLAPSE.ozoneDepletion.domesRequired;
    // Health pressure from UV radiation
    addPressure(result.pressureModifiers, 'health', 0.15 * COLLAPSE.ozoneDepletion.healthPressureMult);
    // Food production reduced by farming efficiency drop
    result.foodProductionMult *= (1 - COLLAPSE.ozoneDepletion.farmingEfficiencyDrop);
  }

  // ── Atmospheric Toxicity (2200+) ──────────────────────────────────────────
  if (year >= COLLAPSE.atmosphericToxicity.startYear) {
    result.activeEvents.push('atmosphericToxicity');
    result.oxygenTrackingRequired = COLLAPSE.atmosphericToxicity.oxygenTrackingEnabled;
    // Health pressure scaled by pollution level
    const pollutionFactor = Math.max(0.3, terrainStats.avgPollution);
    addPressure(result.pressureModifiers, 'health', 0.2 * pollutionFactor);
    addPressure(result.pressureModifiers, 'demographic', COLLAPSE.atmosphericToxicity.outdoorSurvivalPenalty);
  }

  // ── Soil Exhaustion (2500+) ───────────────────────────────────────────────
  if (year >= COLLAPSE.soilExhaustion.startYear) {
    result.activeEvents.push('soilExhaustion');
    // Halve food production
    result.foodProductionMult *= (1 - COLLAPSE.soilExhaustion.foodProductionDrop);
    // Food pressure inversely proportional to remaining soil fertility
    const fertilityDeficit = 1 - (terrainStats.avgSoilFertility / 100);
    addPressure(result.pressureModifiers, 'food', 0.2 * fertilityDeficit);
  }

  // ── Water Table Collapse (3000+) ──────────────────────────────────────────
  if (year >= COLLAPSE.waterTableCollapse.startYear) {
    result.activeEvents.push('waterTableCollapse');
    result.waterTrackingRequired = COLLAPSE.waterTableCollapse.waterTrackingOnEarth;
    // Food and health pressure from water scarcity
    addPressure(result.pressureModifiers, 'food', 0.15);
    addPressure(result.pressureModifiers, 'health', 0.1);
  }

  // ── Solar Luminosity Increase (5000+) ─────────────────────────────────────
  if (year >= COLLAPSE.solarLuminosityIncrease.startYear) {
    result.activeEvents.push('solarLuminosityIncrease');
    // Climate pressure accelerates with centuries elapsed
    const centuriesActive = (year - COLLAPSE.solarLuminosityIncrease.startYear) / 100;
    const temperatureRise = centuriesActive * COLLAPSE.solarLuminosityIncrease.temperatureRisePerCentury;
    // Amplify climate-related pressure across food and infrastructure
    addPressure(result.pressureModifiers, 'food', 0.05 * Math.min(1, temperatureRise));
    addPressure(result.pressureModifiers, 'infrastructure', 0.05 * Math.min(1, temperatureRise));
    // Accelerate other effects proportionally to warming
    if (climateTrend > 0) {
      addPressure(result.pressureModifiers, 'health', 0.03 * Math.min(1, temperatureRise));
    }
  }

  // ── Mini Ice Age Cycle (10000+) ───────────────────────────────────────────
  if (year >= COLLAPSE.miniIceAgeCycle.startYear) {
    result.activeEvents.push('miniIceAgeCycle');
    // Cyclical temperature effect
    const cyclePosition = ((year - COLLAPSE.miniIceAgeCycle.startYear) % COLLAPSE.miniIceAgeCycle.cycleLengthYears)
      / COLLAPSE.miniIceAgeCycle.cycleLengthYears;
    // Sinusoidal cycle: peak cold at cyclePosition = 0.5
    const coldIntensity = Math.sin(cyclePosition * Math.PI);
    const temperatureDrop = Math.abs(COLLAPSE.miniIceAgeCycle.temperatureDropAtPeak) * coldIntensity;
    // Food and infrastructure pressure during cold peaks
    addPressure(result.pressureModifiers, 'food', 0.15 * (temperatureDrop / 3));
    addPressure(result.pressureModifiers, 'infrastructure', 0.1 * (temperatureDrop / 3));
  }

  // ── Continental Drift (50000+) ────────────────────────────────────────────
  if (year >= COLLAPSE.continentalDrift.startYear) {
    result.activeEvents.push('continentalDrift');
    // Earthquake-driven infrastructure damage
    const earthquakeMult = COLLAPSE.continentalDrift.earthquakeFrequencyMult;
    addPressure(result.pressureModifiers, 'infrastructure', 0.1 * (earthquakeMult - 1));
  }

  // ── Magnetic Field Weakening (100000+) ────────────────────────────────────
  if (year >= COLLAPSE.magneticFieldWeakening.startYear) {
    result.activeEvents.push('magneticFieldWeakening');
    // Radiation exposure triples
    const radiationMult = COLLAPSE.magneticFieldWeakening.radiationExposureMult;
    addPressure(result.pressureModifiers, 'health', 0.25 * (radiationMult / 3));
    addPressure(result.pressureModifiers, 'demographic', 0.15 * (radiationMult / 3));
    // Domes required for radiation shielding (in addition to ozone)
    result.domesRequired = true;
  }

  return result;
}
