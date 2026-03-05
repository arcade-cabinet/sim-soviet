/**
 * @module ai/agents/core/sphereDynamics
 *
 * Empire lifecycle engine: Khaldun + Turchin overlapping cycles,
 * sphere split/merge probability, corporate emergence, governance drift.
 *
 * Two overlapping cycle theories drive sphere behavior:
 *
 * **Ibn Khaldun cycle** (~120 years / 3 generations):
 *   founding (strong asabiyyah) → consolidation → luxury/decay → collapse
 *
 * **Turchin structural-demographic cycle** (~200-300 years):
 *   expansion → peak → stagflation → elite overproduction → crisis → rebirth
 *
 * When both cycles trough simultaneously → sphere collapse (split).
 * When a sphere is in expansion with high asabiyyah → sphere merge.
 */

import type { GameRng } from '@/game/SeedSystem';
import type { GovernanceType, GovernanceTransition, SphereId } from './worldCountries';
import { GOVERNANCE_TRANSITIONS } from './worldCountries';

// ─── Sphere ──────────────────────────────────────────────────────────────────

/** Sphere of influence — aggregated from countries. */
export interface Sphere {
  id: SphereId;
  /** Aggregate hostility toward Russia (0-1). */
  aggregateHostility: number;
  /** Aggregate trade relationship (0-1). */
  aggregateTrade: number;
  /** Aggregate military strength (0-1). */
  aggregateMilitary: number;
  /** Current governance model. */
  governance: GovernanceType;
  /** Ibn Khaldun cycle: 0-1 within ~120yr cycle. 0=founding vigor, 1=decadent collapse. */
  khaldunPhase: number;
  /** Turchin structural-demographic: 0-1 within ~250yr cycle. */
  turchinPhase: number;
  /** Corporate GDP as fraction of total sphere GDP (0-1). */
  corporateShare: number;
  /** Religious movement intensity (0=secular, 1=fundamentalist). */
  religiousIntensity: number;
}

// ─── Cycle Constants ─────────────────────────────────────────────────────────

/** Khaldun cycle length in years (~120 years / 3 generations). */
export const KHALDUN_CYCLE_YEARS = 120;

/** Turchin cycle length in years (~250 years). */
export const TURCHIN_CYCLE_YEARS = 250;

/** Annual phase increment for Khaldun cycle. */
export const KHALDUN_INCREMENT = 1 / KHALDUN_CYCLE_YEARS;

/** Annual phase increment for Turchin cycle. */
export const TURCHIN_INCREMENT = 1 / TURCHIN_CYCLE_YEARS;

// ─── Cycle Advancement ───────────────────────────────────────────────────────

/**
 * Advance both cycles for one year. Cycles wrap around at 1.0.
 * Returns a new Sphere with updated phases.
 */
export function advanceCycles(sphere: Sphere): Sphere {
  return {
    ...sphere,
    khaldunPhase: (sphere.khaldunPhase + KHALDUN_INCREMENT) % 1.0,
    turchinPhase: (sphere.turchinPhase + TURCHIN_INCREMENT) % 1.0,
  };
}

// ─── Split/Merge Probability ─────────────────────────────────────────────────

/**
 * Compute probability of sphere splitting (fragmentation) this year.
 *
 * Increases with: governance mismatch (high khaldun decay),
 * economic inequality (high turchin crisis), identity pressure.
 *
 * Historical examples: Roman Empire (East/West 395), Mongol Empire,
 * Ottoman collapse, USSR dissolution.
 */
export function computeSplitProbability(sphere: Sphere): number {
  let p = 0;

  // Khaldun decay phase (0.6-1.0 = decadent) → up to +0.03
  if (sphere.khaldunPhase > 0.6) {
    p += (sphere.khaldunPhase - 0.6) * 0.075; // max +0.03
  }

  // Turchin crisis phase (0.6-1.0) → up to +0.03
  if (sphere.turchinPhase > 0.6) {
    p += (sphere.turchinPhase - 0.6) * 0.075; // max +0.03
  }

  // Both cycles in decay simultaneously → multiplicative boost
  if (sphere.khaldunPhase > 0.7 && sphere.turchinPhase > 0.7) {
    p *= 2.0;
  }

  // Religious intensity amplifies fragmentation
  if (sphere.religiousIntensity > 0.5) {
    p *= 1.0 + sphere.religiousIntensity * 0.5;
  }

  return Math.min(0.15, p); // cap at 15% per year
}

/**
 * Compute probability of this sphere absorbing a weakened neighbor.
 *
 * Historical pattern: empires form through CONQUEST, not voluntary union.
 * Requires high asabiyyah (founding vigor) and military dominance.
 */
export function computeMergeProbability(sphere: Sphere, targetSphere: Sphere): number {
  let p = 0;

  // Attacker in founding vigor (low khaldun) → up to +0.02
  if (sphere.khaldunPhase < 0.3) {
    p += (0.3 - sphere.khaldunPhase) * 0.067; // max +0.02
  }

  // Target in decay → easier to absorb
  if (targetSphere.khaldunPhase > 0.7) {
    p += (targetSphere.khaldunPhase - 0.7) * 0.033;
  }

  // Military dominance required
  const militaryRatio = sphere.aggregateMilitary / Math.max(0.01, targetSphere.aggregateMilitary);
  if (militaryRatio > 1.5) {
    p *= Math.min(3.0, militaryRatio - 0.5);
  } else {
    p *= 0.1; // very unlikely without military dominance
  }

  // Trade interdependence helps
  p *= 1.0 + sphere.aggregateTrade * 0.3;

  return Math.min(0.05, p); // cap at 5% per year
}

// ─── Corporate Emergence ─────────────────────────────────────────────────────

/**
 * Advance corporate share based on sphere conditions.
 * Corporate share grows when oligarchic governance + high tech.
 * VOC precedent: corporations HAVE been sovereign before.
 */
export function advanceCorporateShare(sphere: Sphere, techLevel: number): number {
  let delta = 0;

  // Base growth in oligarchic/corporate governance
  if (sphere.governance === 'oligarchic' || sphere.governance === 'corporate') {
    delta += 0.005;
  }

  // Tech accelerates corporate growth
  delta += techLevel * 0.002;

  // Democratic governance slows corporate growth (regulation)
  if (sphere.governance === 'democratic') {
    delta -= 0.002;
  }

  // Communist governance suppresses corporate growth
  if (sphere.governance === 'communist') {
    delta = -0.01;
  }

  return Math.max(0, Math.min(1, sphere.corporateShare + delta));
}

// ─── Governance Drift ────────────────────────────────────────────────────────

/**
 * Check for governance transition this year.
 * Returns the new governance type, or the current one if no transition.
 */
export function checkGovernanceTransition(sphere: Sphere, rng: GameRng): GovernanceType {
  const applicable = GOVERNANCE_TRANSITIONS.filter((t) => t.from === sphere.governance);
  if (applicable.length === 0) return sphere.governance;

  for (const transition of applicable) {
    const p = computeTransitionProbability(sphere, transition);
    if (p > 0 && rng.random() < p) {
      return transition.to;
    }
  }

  return sphere.governance;
}

/**
 * Compute the effective probability of a specific governance transition.
 */
export function computeTransitionProbability(sphere: Sphere, transition: GovernanceTransition): number {
  let p = transition.baseProbability;
  const cond = transition.conditions;

  // Turchin phase condition
  if (cond.turchinRange) {
    if (sphere.turchinPhase >= cond.turchinRange.min && sphere.turchinPhase <= cond.turchinRange.max) {
      p *= 2.0; // conditions met → double probability
    } else {
      p *= 0.2; // conditions not met → suppress
    }
  }

  // Khaldun phase condition
  if (cond.khaldunRange) {
    if (sphere.khaldunPhase >= cond.khaldunRange.min && sphere.khaldunPhase <= cond.khaldunRange.max) {
      p *= 2.0;
    } else {
      p *= 0.2;
    }
  }

  // Corporate share condition
  if (cond.minCorporateShare !== undefined) {
    if (sphere.corporateShare >= cond.minCorporateShare) {
      p *= 2.0;
    } else {
      p *= 0.1; // very unlikely without sufficient corporate power
    }
  }

  // Religious intensity condition
  if (cond.minReligiousIntensity !== undefined) {
    if (sphere.religiousIntensity >= cond.minReligiousIntensity) {
      p *= 2.0;
    } else {
      p *= 0.1;
    }
  }

  return Math.min(0.15, p);
}

// ─── Religious Dynamics ──────────────────────────────────────────────────────

/**
 * Advance religious intensity based on sphere conditions.
 * Religious movements intensify during identity crises and economic dislocation.
 */
export function advanceReligiousIntensity(sphere: Sphere): number {
  let delta = 0;

  // Economic crisis (high turchin) triggers identity seeking
  if (sphere.turchinPhase > 0.6) {
    delta += (sphere.turchinPhase - 0.6) * 0.02;
  }

  // Khaldun decay erodes secular institutions
  if (sphere.khaldunPhase > 0.7) {
    delta += (sphere.khaldunPhase - 0.7) * 0.01;
  }

  // Theocratic governance reinforces intensity
  if (sphere.governance === 'theocratic') {
    delta += 0.005;
  }

  // Secular governance slowly reduces intensity
  if (sphere.governance === 'democratic' || sphere.governance === 'technocratic') {
    delta -= 0.003;
  }

  // Natural slow decay toward baseline
  delta -= 0.001;

  return Math.max(0, Math.min(1, sphere.religiousIntensity + delta));
}

// ─── Sphere Factory ──────────────────────────────────────────────────────────

/** Create the initial spheres for 1917. */
export function createInitialSpheres(): Record<SphereId, Sphere> {
  return {
    european: {
      id: 'european',
      aggregateHostility: 0.55,
      aggregateTrade: 0.35,
      aggregateMilitary: 0.7,
      governance: 'democratic',
      khaldunPhase: 0.6, // late-cycle (WWI = civilizational exhaustion)
      turchinPhase: 0.65, // nearing crisis
      corporateShare: 0.1,
      religiousIntensity: 0.2,
    },
    sinosphere: {
      id: 'sinosphere',
      aggregateHostility: 0.4,
      aggregateTrade: 0.25,
      aggregateMilitary: 0.5,
      governance: 'authoritarian',
      khaldunPhase: 0.8, // Qing collapse
      turchinPhase: 0.7, // deep crisis
      corporateShare: 0.05,
      religiousIntensity: 0.15,
    },
    western: {
      id: 'western',
      aggregateHostility: 0.35,
      aggregateTrade: 0.3,
      aggregateMilitary: 0.5,
      governance: 'democratic',
      khaldunPhase: 0.3, // young vigor (US ascendance)
      turchinPhase: 0.3, // expansion phase
      corporateShare: 0.15,
      religiousIntensity: 0.3,
    },
    middle_eastern: {
      id: 'middle_eastern',
      aggregateHostility: 0.5,
      aggregateTrade: 0.2,
      aggregateMilitary: 0.4,
      governance: 'authoritarian',
      khaldunPhase: 0.9, // Ottoman collapse imminent
      turchinPhase: 0.8, // deep crisis
      corporateShare: 0.02,
      religiousIntensity: 0.5,
    },
    eurasian: {
      id: 'eurasian',
      aggregateHostility: 0.6,
      aggregateTrade: 0.2,
      aggregateMilitary: 0.3,
      governance: 'authoritarian',
      khaldunPhase: 0.5,
      turchinPhase: 0.5,
      corporateShare: 0.03,
      religiousIntensity: 0.25,
    },
    corporate: {
      id: 'corporate',
      aggregateHostility: 0.1,
      aggregateTrade: 0.6,
      aggregateMilitary: 0.0,
      governance: 'corporate',
      khaldunPhase: 0.0, // doesn't exist yet in 1917
      turchinPhase: 0.0,
      corporateShare: 1.0, // by definition
      religiousIntensity: 0.0,
    },
  };
}

// ─── Full Sphere Tick ────────────────────────────────────────────────────────

/**
 * Advance a single sphere by one year.
 * Updates cycles, corporate share, religious intensity, and governance.
 */
export function tickSphere(sphere: Sphere, techLevel: number, rng: GameRng): Sphere {
  let s = advanceCycles(sphere);
  s = { ...s, corporateShare: advanceCorporateShare(s, techLevel) };
  s = { ...s, religiousIntensity: advanceReligiousIntensity(s) };
  s = { ...s, governance: checkGovernanceTransition(s, rng) };
  return s;
}
