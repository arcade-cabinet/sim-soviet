/**
 * @module ai/agents/crisis/ChaosEngine
 *
 * @deprecated Replaced by the three-tier Pressure-Valve Crisis System:
 * - Tier 1: PressureCrisisEngine (sustained pressure → crisis emergence)
 * - Tier 2: ClimateEventSystem (seasonal/weather pattern-driven)
 * - Tier 3: BlackSwanSystem (pure low-probability, no gates)
 * Retained for backward compatibility with old saves that don't have
 * PressureReadContext available.
 *
 * "History repeats itself" — the extrapolation engine for freeform mode.
 *
 * Generates plausible alternate crisis events from parameterized archetypes,
 * seeded by GameRng for deterministic replay. Uses self-referencing feedback
 * rules so crises cascade realistically: war depletes food → famine →
 * blame the leadership → political crisis → military adventure distraction.
 *
 * Four crisis archetypes:
 *   - WarArchetype: border conflicts, liberation wars, proxy wars
 *   - FamineArchetype: harvest failures, supply disruptions
 *   - DisasterArchetype: industrial accidents, environmental crises
 *   - PoliticalCrisisArchetype: purges, reform movements, power struggles
 */

import type { GameRng } from '@/game/SeedSystem';
import type { CrisisDefinition, CrisisSeverity, CrisisType } from './types';

// ─── ChaosState ──────────────────────────────────────────────────────────────

/** Snapshot of game state relevant to crisis generation. */
export interface ChaosState {
  /** Current game year. */
  year: number;
  /** Current total population. */
  population: number;
  /** Current food stockpile. */
  food: number;
  /** Current money (rubles). */
  money: number;
  /** Years since the last war ended. */
  yearsSinceLastWar: number;
  /** Years since the last famine ended. */
  yearsSinceLastFamine: number;
  /** Years since the last disaster ended. */
  yearsSinceLastDisaster: number;
  /** Years since the last political crisis ended. */
  yearsSinceLastPolitical: number;
  /** IDs of currently active crises. */
  activeCrises: string[];
  /** Total number of crises the settlement has experienced. */
  totalCrisesExperienced: number;
  /** Average citizen morale (0-1, optional — defaults to 0.5). */
  morale?: number;
  /** KGB marks / corruption level (optional — defaults to 0). */
  marks?: number;
  /** Current leader tenure in years (optional — defaults to 0). */
  leaderTenure?: number;
  /** Number of industrial buildings (factories, etc.). */
  industrialCount?: number;
}

// ─── CrisisArchetype ─────────────────────────────────────────────────────────

/** A parameterized crisis template that can evaluate trigger conditions and generate crises. */
export interface CrisisArchetype {
  /** Crisis category this archetype generates. */
  type: CrisisType;
  /** Historical frequency weight (higher = more common). */
  baseWeight: number;
  /** Evaluate trigger conditions against current state, return 0-1 score. */
  evaluateTrigger(state: ChaosState): number;
  /** Generate a crisis definition if triggered. */
  generate(state: ChaosState, rng: GameRng): CrisisDefinition;
}

// ─── Name Pools ──────────────────────────────────────────────────────────────

const WAR_ENEMIES = [
  'Finland',
  'Poland',
  'Manchuria',
  'Turkey',
  'Persia',
  'Afghanistan',
  'Korea',
  'Hungary',
  'Czechoslovakia',
  'Georgia',
];

const WAR_PREFIXES = [
  'Border Conflict with',
  "Workers' Liberation of",
  'Proxy War in',
  'Fraternal Intervention in',
  'Defense of',
  'Campaign Against',
];

const FAMINE_REGIONS = [
  'Volga',
  'Ukraine',
  'Kazakhstan',
  'Caucasus',
  'Siberia',
  'Central Asia',
  'Urals',
  'Don Basin',
  'Kuban',
  'Bessarabia',
];

const DISASTER_TYPES = [
  'Industrial Incident',
  'Factory Explosion',
  'Pipeline Rupture',
  'Chemical Spill',
  'Mine Collapse',
  'Dam Failure',
  'Rail Disaster',
  'Power Plant Malfunction',
];

const POLITICAL_ADJECTIVES = [
  'Great',
  'Second',
  'Final',
  'Necessary',
  'Corrective',
  'Preventive',
  'Thorough',
  'Socialist',
  'Democratic',
  'Revolutionary',
];

const POLITICAL_NOUNS = ['Purge', 'Reorganization', 'Cleansing', 'Correction', 'Reform', 'Restructuring'];

// ─── Archetype Implementations ───────────────────────────────────────────────

const warArchetype: CrisisArchetype = {
  type: 'war',
  baseWeight: 0.4,

  evaluateTrigger(state: ChaosState): number {
    let score = 0;

    // Long peace increases war likelihood
    if (state.yearsSinceLastWar > 10) {
      score += 0.3 + Math.min(0.3, (state.yearsSinceLastWar - 10) * 0.03);
    }

    // Large population creates border tension
    if (state.population > 500) {
      score += Math.min(0.2, state.population / 5000);
    }

    // Resource abundance invites military adventure
    if (state.money > 2000) {
      score += Math.min(0.2, (state.money - 2000) / 10000);
    }

    return Math.min(1, score);
  },

  generate(state: ChaosState, rng: GameRng): CrisisDefinition {
    const duration = rng.int(2, 8);
    const severityScore = Math.min(1, state.population / 5000 + state.money / 10000);
    const severity = scoreSeverity(severityScore, rng);

    const enemy = rng.pick(WAR_ENEMIES);
    const prefix = rng.pick(WAR_PREFIXES);
    const name = `${prefix} ${enemy}`;

    const conscriptionRate =
      severity === 'existential' ? 0.15 : severity === 'national' ? 0.1 : severity === 'regional' ? 0.06 : 0.03;

    return {
      id: `war-${state.year}-${rng.id()}`,
      type: 'war',
      name,
      startYear: state.year,
      endYear: state.year + duration,
      severity,
      peakParams: {
        conscriptionRate,
        productionMult: 1.1 + severityScore * 0.2,
        bombardmentRate: 0.01 + severityScore * 0.04,
        foodDrain: 10 + Math.floor(severityScore * 40),
        moneyDrain: 15 + Math.floor(severityScore * 65),
        veteranReturnRate: 0.5 + (1 - severityScore) * 0.2,
      },
      buildupTicks: rng.int(3, 12),
      aftermathTicks: rng.int(6, 24),
      description: `${name} (${state.year}-${state.year + duration})`,
    };
  },
};

const famineArchetype: CrisisArchetype = {
  type: 'famine',
  baseWeight: 0.3,

  evaluateTrigger(state: ChaosState): number {
    let score = 0;

    // Low food reserves — primary trigger
    const monthsOfFood = state.population > 0 ? state.food / (state.population * 0.5) : Infinity;
    if (monthsOfFood < 3) {
      score += 0.4 + Math.min(0.3, (3 - monthsOfFood) * 0.1);
    }

    // Post-war food depletion
    if (state.yearsSinceLastWar <= 2 && state.yearsSinceLastWar > 0) {
      score += 0.2;
    }

    // Population growth outpacing production (proxy: large pop + low food)
    if (state.population > 1000 && monthsOfFood < 6) {
      score += 0.15;
    }

    return Math.min(1, score);
  },

  generate(state: ChaosState, rng: GameRng): CrisisDefinition {
    const duration = rng.int(1, 3);
    const region = rng.pick(FAMINE_REGIONS);
    const nameVariants = [`Great ${region} Famine`, `Harvest Failure of ${state.year}`, `${region} Food Crisis`];
    const name = rng.pick(nameVariants);

    const foodDeficit = state.population > 0 ? Math.max(0, 1 - state.food / (state.population * 1.5)) : 0;
    const severity = scoreSeverity(foodDeficit, rng);

    return {
      id: `famine-${state.year}-${rng.id()}`,
      type: 'famine',
      name,
      startYear: state.year,
      endYear: state.year + duration,
      severity,
      peakParams: {
        foodDrainPerCapita: 0.1 + foodDeficit * 0.5,
        diseaseMult: 1.5 + foodDeficit,
        moraleHit: -(0.3 + foodDeficit * 0.5),
        growthMult: 0.3 - foodDeficit * 0.2,
        productionMult: 0.6 - foodDeficit * 0.3,
      },
      buildupTicks: rng.int(3, 8),
      aftermathTicks: rng.int(6, 18),
      description: `${name} (${state.year}-${state.year + duration})`,
    };
  },
};

const disasterArchetype: CrisisArchetype = {
  type: 'disaster',
  baseWeight: 0.15,

  evaluateTrigger(state: ChaosState): number {
    let score = 0;

    // High industrial density
    const industrial = state.industrialCount ?? 0;
    if (industrial > 5) {
      score += Math.min(0.3, industrial * 0.03);
    }

    // Infrastructure age (proxy: many crises = old settlement)
    if (state.totalCrisesExperienced > 3) {
      score += Math.min(0.2, state.totalCrisesExperienced * 0.03);
    }

    // Base random chance — disasters happen
    score += 0.1;

    return Math.min(1, score);
  },

  generate(state: ChaosState, rng: GameRng): CrisisDefinition {
    const disasterType = rng.pick(DISASTER_TYPES);
    const name = `${disasterType} of ${state.year}`;

    const industrial = state.industrialCount ?? 0;
    const severityScore = Math.min(1, industrial / 20 + state.totalCrisesExperienced / 10);
    const severity = scoreSeverity(severityScore, rng);

    return {
      id: `disaster-${state.year}-${rng.id()}`,
      type: 'disaster',
      name,
      startYear: state.year,
      endYear: state.year + 1,
      severity,
      peakParams: {
        destructionCount: rng.int(1, 5 + Math.floor(severityScore * 10)),
        casualtyCount: rng.int(0, Math.floor(state.population * 0.01 * (1 + severityScore))),
        moneyCost: rng.int(100, 500 + Math.floor(severityScore * 1000)),
        productionMult: 0.8 - severityScore * 0.3,
        diseaseMult: 1.0 + severityScore * 2,
        decayMult: 1.0 + severityScore,
        moralePenalty: -(0.1 + severityScore * 0.4),
        growthMult: 1.0 - severityScore * 0.3,
      },
      buildupTicks: rng.int(1, 4),
      aftermathTicks: rng.int(6, 36),
      description: `${name} — ${severity} severity`,
    };
  },
};

const politicalCrisisArchetype: CrisisArchetype = {
  type: 'political',
  baseWeight: 0.15,

  evaluateTrigger(state: ChaosState): number {
    let score = 0;

    // Long leader tenure
    const tenure = state.leaderTenure ?? 0;
    if (tenure > 10) {
      score += Math.min(0.3, (tenure - 10) * 0.03);
    }

    // Low morale
    const morale = state.morale ?? 0.5;
    if (morale < 0.3) {
      score += 0.3 + (0.3 - morale);
    }

    // High corruption / marks
    const marks = state.marks ?? 0;
    if (marks > 3) {
      score += Math.min(0.2, (marks - 3) * 0.05);
    }

    // Large unrepresented population
    if (state.population > 2000) {
      score += Math.min(0.15, state.population / 20000);
    }

    return Math.min(1, score);
  },

  generate(state: ChaosState, rng: GameRng): CrisisDefinition {
    const adj = rng.pick(POLITICAL_ADJECTIVES);
    const noun = rng.pick(POLITICAL_NOUNS);
    const nameVariants = [`The ${adj} ${noun}`, `Reform Movement of ${state.year}`, `Power Struggle of ${state.year}`];
    const name = rng.pick(nameVariants);

    const morale = state.morale ?? 0.5;
    const severityScore = Math.min(1, 1 - morale + (state.marks ?? 0) / 10);
    const severity = scoreSeverity(severityScore, rng);

    return {
      id: `political-${state.year}-${rng.id()}`,
      type: 'political',
      name,
      startYear: state.year,
      endYear: state.year + rng.int(1, 3),
      severity,
      peakParams: {
        kgbAggressionMult: 1.5 + severityScore,
        quotaMult: 1.0 + severityScore * 0.5,
        moraleHit: -(0.2 + severityScore * 0.3),
        productionMult: 0.7 - severityScore * 0.2,
      },
      buildupTicks: rng.int(2, 6),
      aftermathTicks: rng.int(6, 18),
      description: `${name} — political upheaval`,
    };
  },
};

// ─── Feedback Rules ──────────────────────────────────────────────────────────

/** Feedback boost constants for crisis cascading. */
const FEEDBACK = {
  /** War aftermath → famine trigger boost. */
  WAR_TO_FAMINE: 0.3,
  /** Famine → political crisis trigger boost. */
  FAMINE_TO_POLITICAL: 0.2,
  /** Political crisis → war trigger boost (distraction). */
  POLITICAL_TO_WAR: 0.2,
  /** Long peace → annual war tension accumulation. */
  PEACE_TENSION_PER_YEAR: 0.05,
  /** Recent disaster → political crisis boost (blame the leadership). */
  DISASTER_TO_POLITICAL: 0.1,
} as const;

// ─── Minimum Interval ────────────────────────────────────────────────────────

/** Minimum years between crises of the same type. */
const MIN_INTERVAL_YEARS = 3;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Map a 0-1 severity score to a CrisisSeverity label.
 * Adds slight randomness to avoid deterministic severity thresholds.
 */
function scoreSeverity(score: number, rng: GameRng): CrisisSeverity {
  const jitter = (rng.random() - 0.5) * 0.1;
  const adjusted = Math.max(0, Math.min(1, score + jitter));

  if (adjusted < 0.25) return 'localized';
  if (adjusted < 0.5) return 'regional';
  if (adjusted < 0.75) return 'national';
  return 'existential';
}

/**
 * Map a CrisisType to the corresponding yearsSince field on ChaosState.
 */
function yearsSinceForType(state: ChaosState, type: CrisisType): number {
  switch (type) {
    case 'war':
      return state.yearsSinceLastWar;
    case 'famine':
      return state.yearsSinceLastFamine;
    case 'disaster':
      return state.yearsSinceLastDisaster;
    case 'political':
      return state.yearsSinceLastPolitical;
    default:
      return 10; // New crisis types (climate, black_swan, cold_branch) not tracked by ChaosEngine
  }
}

// ─── ChaosEngine ─────────────────────────────────────────────────────────────

/**
 * Extrapolation engine for freeform (alternate-history) mode.
 *
 * Evaluates all crisis archetypes against current state, applies feedback
 * rules based on recent history, and probabilistically generates new crises
 * using seeded RNG for deterministic replay.
 */
export class ChaosEngine {
  private archetypes: CrisisArchetype[];

  constructor() {
    this.archetypes = [warArchetype, famineArchetype, disasterArchetype, politicalCrisisArchetype];
  }

  /**
   * Evaluate all archetypes against current state.
   * Returns a generated crisis if any archetype triggers, null otherwise.
   *
   * Pure function of fixed-size input: ChaosState contains pre-computed
   * yearsSince counters so no timeline scan is needed.
   *
   * @param state - Current game state snapshot (includes yearsSince counters)
   * @param rng - Seeded RNG for deterministic outcomes
   */
  generateNextCrisis(state: ChaosState, rng: GameRng): CrisisDefinition | null {
    // 1. Score each archetype
    const scores = this.archetypes.map((arch) => ({
      archetype: arch,
      rawScore: arch.evaluateTrigger(state),
    }));

    // 2. Apply feedback rules (pure function of ChaosState)
    const boostedScores = scores.map(({ archetype, rawScore }) => ({
      archetype,
      score: rawScore + this.computeFeedbackBoost(archetype.type, state),
    }));

    // 3. Apply minimum interval filter — zero out types that fired too recently
    const filteredScores = boostedScores.map(({ archetype, score }) => {
      if (yearsSinceForType(state, archetype.type) < MIN_INTERVAL_YEARS) {
        return { archetype, score: 0 };
      }
      // Also suppress if there's an active crisis of this type
      if (state.activeCrises.some((id) => id.startsWith(archetype.type))) {
        return { archetype, score: 0 };
      }
      return { archetype, score };
    });

    // 4. Weight scores: finalWeight = score * baseWeight
    const weights = filteredScores.map(({ archetype, score }) => Math.max(0, score * archetype.baseWeight));

    const totalWeight = weights.reduce((sum, w) => sum + w, 0);

    // If no archetype has any trigger potential, no crisis
    if (totalWeight <= 0) return null;

    // 5. Normalize to probabilities
    const probabilities = weights.map((w) => w / totalWeight);

    // 6. Find the highest-probability archetype
    let _bestIdx = 0;
    let bestProb = probabilities[0]!;
    for (let i = 1; i < probabilities.length; i++) {
      if (probabilities[i]! > bestProb) {
        bestProb = probabilities[i]!;
        _bestIdx = i;
      }
    }

    // 7. Roll against the highest probability — scaled by total weight
    //    Higher total weight = more likely something fires
    const triggerChance = Math.min(0.8, totalWeight);
    const roll = rng.random();

    if (roll >= triggerChance) {
      return null; // No crisis this check
    }

    // 8. Use weighted selection to pick which archetype fires
    const selectedIdx = rng.weightedIndex(weights);
    const selected = filteredScores[selectedIdx]!;

    // 9. Generate the crisis
    return selected.archetype.generate(state, rng);
  }

  /**
   * Compute feedback boost for a given crisis type based on recent history.
   * Implements the self-referencing cascade rules.
   * Pure function of ChaosState — no timeline scan needed.
   */
  private computeFeedbackBoost(type: CrisisType, state: ChaosState): number {
    let boost = 0;

    switch (type) {
      case 'war': {
        // Political crisis → military adventure distraction
        if (state.yearsSinceLastPolitical <= 3 && state.yearsSinceLastPolitical > 0) {
          boost += FEEDBACK.POLITICAL_TO_WAR;
        }
        // Long peace tension accumulation
        if (state.yearsSinceLastWar > 10) {
          boost += (state.yearsSinceLastWar - 10) * FEEDBACK.PEACE_TENSION_PER_YEAR;
        }
        break;
      }

      case 'famine': {
        // War aftermath depletes food
        if (state.yearsSinceLastWar <= 2 && state.yearsSinceLastWar > 0) {
          boost += FEEDBACK.WAR_TO_FAMINE;
        }
        break;
      }

      case 'disaster': {
        // No special feedback — disasters are more random
        break;
      }

      case 'political': {
        // Famine blame assignment
        if (state.yearsSinceLastFamine <= 3 && state.yearsSinceLastFamine > 0) {
          boost += FEEDBACK.FAMINE_TO_POLITICAL;
        }
        // Disaster blame
        if (state.yearsSinceLastDisaster <= 2 && state.yearsSinceLastDisaster > 0) {
          boost += FEEDBACK.DISASTER_TO_POLITICAL;
        }
        break;
      }
    }

    return boost;
  }

  /** Get the archetype definitions (for testing/inspection). */
  getArchetypes(): readonly CrisisArchetype[] {
    return this.archetypes;
  }
}
