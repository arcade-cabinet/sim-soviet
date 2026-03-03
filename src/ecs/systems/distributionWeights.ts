/**
 * @module ecs/systems/distributionWeights
 *
 * Dual-Layer Distribution Model: Uniform + Weighted.
 *
 * The Soviet system CLAIMED equal distribution. Reality was biased by role,
 * affiliation, and bureaucratic weight. This module models that tension with
 * two computational layers:
 *
 * Layer 1 (Uniform): Bulk aggregate math. food_per_capita = available_food / population.
 * This is what the raikom report shows. This is what the quota system measures against.
 *
 * Layer 2 (Weighted Bias): A hidden weight table that skews actual distribution
 * by role. Applied as multipliers on per-capita shares.
 *
 * The gap between them IS the game's tension.
 */

import { citizens, dvory } from '@/ecs/archetypes';
import { economy } from '@/config';
import type { PoliticalRole } from '@/ai/agents/political/types';

/** Food consumed per citizen per tick = 1 / FOOD_DIVISOR. Matches consumptionSystem. */
const FOOD_DIVISOR = economy.consumption.foodPerPopDivisor;
/** Vodka consumed per citizen per tick = 1 / VODKA_DIVISOR. */
const VODKA_DIVISOR = 20;

// ─── Distribution Weight Config ─────────────────────────────────────────────

/** Weight multipliers for resource distribution by role bucket. */
export const DISTRIBUTION_WEIGHTS = {
  kgb: 2.0, // Nobody refuses the KGB
  military: 1.5, // Armed and hungry
  politruk: 1.5, // Party eats well
  party: 1.2, // Connections
  worker: 1.0, // Normal share
  dependent: 0.7, // Children, elderly
  prisoner: 0.3, // Gulag rations
} as const;

/** Fraction of total consumption by privileged roles that triggers resentment. */
export const RESENTMENT_THRESHOLD = 0.15;

/** Morale penalty per tick when resentment is active. */
export const RESENTMENT_MORALE_PENALTY = 2;

// ─── Role Bucket Types ──────────────────────────────────────────────────────

/** A distribution role bucket: how many people in this role, and their weight. */
export interface RoleBucket {
  role: keyof typeof DISTRIBUTION_WEIGHTS;
  count: number;
  weight: number;
}

/** Result of the weighted distribution calculation. */
export interface DistributionResult {
  /** The "official" uniform food need (what the raikom report shows). */
  uniformFoodNeed: number;
  /** The actual weighted food need (what really happens). */
  weightedFoodNeed: number;
  /** The "official" uniform vodka need. */
  uniformVodkaNeed: number;
  /** The actual weighted vodka need. */
  weightedVodkaNeed: number;
  /** Whether the resentment threshold is exceeded. */
  resentmentActive: boolean;
  /** Fraction of consumption going to privileged roles (kgb, military, politruk, party). */
  privilegedFraction: number;
  /** The role buckets used for the calculation. */
  buckets: RoleBucket[];
}

// ─── Population Bucket Computation ──────────────────────────────────────────

/**
 * Maps citizen classes from the ECS world to distribution role keys.
 * Citizens are classified by their social class, dvor member role, or
 * political role assignment.
 */
const CITIZEN_CLASS_TO_ROLE: Record<string, keyof typeof DISTRIBUTION_WEIGHTS> = {
  worker: 'worker',
  engineer: 'worker', // Engineers are skilled workers
  farmer: 'worker', // Farmers are agricultural workers
  party_official: 'party',
  soldier: 'military',
  prisoner: 'prisoner',
};

/**
 * Dvor member roles that count as dependents in distribution math.
 * Working-age adults (head, spouse, worker) are handled by citizen class lookup.
 * Non-working members (elder, adolescent, child, infant) receive reduced rations.
 */
const DEPENDENT_MEMBER_ROLES = new Set(['elder', 'adolescent', 'child', 'infant']);

/**
 * Compute population role buckets from the ECS world state.
 *
 * Counts citizens by class and maps them to distribution roles.
 * Political entities (politruks, KGB agents, military officers) are counted
 * from the entity scaling config based on settlement tier, since they are
 * not regular citizens but assigned officials who consume from the settlement.
 *
 * @param population - Total population count
 * @param politicalCounts - Optional counts of political entities by role
 * @returns Array of role buckets with counts and weights
 */
export function computeRoleBuckets(
  population: number,
  politicalCounts?: Partial<Record<PoliticalRole, number>>,
): RoleBucket[] {
  if (population <= 0) return [];

  // Count citizens by class from ECS entities
  const classCounts: Record<string, number> = {};
  for (const entity of citizens) {
    const cls = entity.citizen.class;
    classCounts[cls] = (classCounts[cls] ?? 0) + 1;
  }

  // Count dependents from dvory member roles
  let dependentCount = 0;
  for (const dvorEntity of dvory) {
    for (const member of dvorEntity.dvor.members) {
      if (DEPENDENT_MEMBER_ROLES.has(member.role)) {
        dependentCount++;
      }
    }
  }

  // Build initial role counts from citizen classes
  const roleCounts: Record<keyof typeof DISTRIBUTION_WEIGHTS, number> = {
    kgb: 0,
    military: 0,
    politruk: 0,
    party: 0,
    worker: 0,
    dependent: 0,
    prisoner: 0,
  };

  // Map citizen classes to distribution roles
  for (const [cls, count] of Object.entries(classCounts)) {
    const role = CITIZEN_CLASS_TO_ROLE[cls] ?? 'worker';
    roleCounts[role] += count;
  }

  // Add dependents from dvory
  roleCounts.dependent += dependentCount;

  // If no citizen entities exist (aggregate mode or early game), distribute
  // the entire population as workers before adding political overlays
  const totalFromEntities = Object.values(roleCounts).reduce((a, b) => a + b, 0);
  if (totalFromEntities === 0 && population > 0) {
    roleCounts.worker = population;
  }

  // Add political entity counts (these are officials assigned to the settlement,
  // consuming resources but tracked separately from regular citizens)
  if (politicalCounts) {
    roleCounts.politruk += politicalCounts.politruk ?? 0;
    roleCounts.kgb += politicalCounts.kgb_agent ?? 0;
    roleCounts.military += (politicalCounts.military_officer ?? 0) + (politicalCounts.conscription_officer ?? 0);
  }

  // Build bucket array, filtering out zero-count buckets
  const buckets: RoleBucket[] = [];
  for (const [role, count] of Object.entries(roleCounts)) {
    if (count > 0) {
      buckets.push({
        role: role as keyof typeof DISTRIBUTION_WEIGHTS,
        count,
        weight: DISTRIBUTION_WEIGHTS[role as keyof typeof DISTRIBUTION_WEIGHTS],
      });
    }
  }

  return buckets;
}

// ─── Distribution Calculation ───────────────────────────────────────────────

/**
 * Compute dual-layer distribution for food and vodka consumption.
 *
 * Layer 1 (Uniform): Standard per-capita consumption as if distribution were equal.
 * Layer 2 (Weighted): Actual consumption accounting for role-based bias.
 *
 * The weighted consumption is always >= uniform consumption because privileged
 * roles consume more than their "fair share", increasing total demand.
 *
 * @param population - Total population
 * @param consumptionMult - Era/difficulty consumption multiplier
 * @param buckets - Pre-computed role buckets (or empty for uniform-only)
 * @returns Distribution result with both uniform and weighted consumption
 */
export function computeDistribution(
  population: number,
  consumptionMult: number,
  buckets: RoleBucket[],
): DistributionResult {
  if (population <= 0 || buckets.length === 0) {
    return {
      uniformFoodNeed: 0,
      weightedFoodNeed: 0,
      uniformVodkaNeed: 0,
      weightedVodkaNeed: 0,
      resentmentActive: false,
      privilegedFraction: 0,
      buckets: [],
    };
  }

  // Layer 1: Uniform — the "official" consumption
  const uniformFoodNeed = Math.ceil((population / FOOD_DIVISOR) * consumptionMult);
  const uniformVodkaNeed = Math.ceil((population / VODKA_DIVISOR) * consumptionMult);

  // Layer 2: Weighted — the reality
  // totalWeightedPop = sum(bucket_count * bucket_weight)
  let totalWeightedPop = 0;
  let privilegedWeightedPop = 0;
  const privilegedRoles = new Set<keyof typeof DISTRIBUTION_WEIGHTS>(['kgb', 'military', 'politruk', 'party']);

  for (const bucket of buckets) {
    const contribution = bucket.count * bucket.weight;
    totalWeightedPop += contribution;
    if (privilegedRoles.has(bucket.role)) {
      privilegedWeightedPop += contribution;
    }
  }

  // Weighted consumption uses the same base formula but with weighted population
  const weightedFoodNeed = Math.ceil((totalWeightedPop / FOOD_DIVISOR) * consumptionMult);
  const weightedVodkaNeed = Math.ceil((totalWeightedPop / VODKA_DIVISOR) * consumptionMult);

  // Resentment check: does the privileged fraction exceed the threshold?
  const totalConsumption = totalWeightedPop > 0 ? totalWeightedPop : 1;
  const privilegedFraction = privilegedWeightedPop / totalConsumption;
  const resentmentActive = privilegedFraction > RESENTMENT_THRESHOLD;

  return {
    uniformFoodNeed,
    weightedFoodNeed,
    uniformVodkaNeed,
    weightedVodkaNeed,
    resentmentActive,
    privilegedFraction,
    buckets,
  };
}
