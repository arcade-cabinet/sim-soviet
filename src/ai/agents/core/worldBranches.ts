/**
 * @module ai/agents/core/worldBranches
 *
 * Cold branches — dormant divergence points that exist in the timeline.
 * They activate automatically when pressure conditions match, not on
 * fixed dates, not by dice roll. The game discovers them organically.
 *
 * Each playthrough discovers different branches. The combination creates
 * emergent narrative: "What if the EU dissolved during a corporate
 * sovereignty wave?" vs "What if the Virgin Lands assignment happened
 * right before WWIII?"
 *
 * Branch definitions are stored in src/config/coldBranches.json.
 */

import type { PressureDomain } from '../crisis/pressure/PressureDomains';
import type { CrisisDefinition } from '../crisis/types';
import type { GovernanceType, SphereId } from './worldCountries';
import type { WorldState } from './WorldAgent';
import branchData from '../../../config/coldBranches.json';

// ─── Terrain Profile (for relocation) ────────────────────────────────────────

export interface TerrainProfile {
  gravity: number;
  atmosphere: 'breathable' | 'none' | 'thin_co2' | 'thick_n2_ch4' | 'variable';
  water: 'rivers' | 'ice_deposits' | 'subsurface' | 'methane_lakes' | 'variable';
  farming: 'soil' | 'hydroponics' | 'greenhouse' | 'impossible' | 'variable';
  construction: 'standard' | 'pressurized_domes' | 'variable';
  baseSurvivalCost: 'low' | 'high' | 'very_high' | 'extreme' | 'variable';
}

// ─── Cold Branch ─────────────────────────────────────────────────────────────

export interface ColdBranch {
  id: string;
  name: string;
  /** Activation conditions — ALL must be true simultaneously. */
  conditions: {
    pressureThresholds?: Partial<Record<PressureDomain, number>>;
    worldStateConditions?: Partial<Record<keyof WorldState, { min?: number; max?: number }>>;
    sphereConditions?: Array<{ sphere: SphereId; governance?: GovernanceType; hostility?: { min?: number } }>;
    yearRange?: { min: number; max?: number };
    /** Sustained duration in ticks before activation. */
    sustainedTicks?: number;
  };
  /** What happens when the branch activates. */
  effects: {
    worldStateOverrides?: Partial<Record<string, number>>;
    pressureSpikes?: Partial<Record<PressureDomain, number>>;
    crisisDefinition?: CrisisDefinition;
    narrative: { pravdaHeadline: string; toast: string };
    relocation?: {
      type: 'forced_transfer' | 'climate_exodus' | 'colonial_expansion' | 'interstellar';
      targetTerrain: TerrainProfile;
    };
    newSettlement?: boolean;
  };
  /** Once activated, stays activated (no re-trigger). */
  oneShot: boolean;
}

// ─── Branch Catalog ──────────────────────────────────────────────────────────

export const COLD_BRANCHES: readonly ColdBranch[] = branchData as unknown as readonly ColdBranch[];

// ─── Branch Evaluation Engine ────────────────────────────────────────────────

/** Tracks sustained-tick progress for each branch. */
export interface BranchTracker {
  /** Ticks that conditions have been continuously met. */
  sustainedTicks: number;
}

/**
 * Evaluate all cold branches against current state.
 * Returns branches that have activated this tick.
 */
export function evaluateBranches(
  branches: readonly ColdBranch[],
  activatedBranches: Set<string>,
  trackers: Map<string, BranchTracker>,
  pressureState: Record<PressureDomain, { level: number }>,
  worldState: WorldState,
  year: number,
  spheres: Record<SphereId, { governance: GovernanceType; aggregateHostility: number }>,
): ColdBranch[] {
  const activated: ColdBranch[] = [];

  for (const branch of branches) {
    // Skip one-shot branches that already fired
    if (branch.oneShot && activatedBranches.has(branch.id)) continue;

    const conditionsMet = checkConditions(branch, pressureState, worldState, year, spheres);

    if (conditionsMet) {
      const tracker = trackers.get(branch.id) ?? { sustainedTicks: 0 };
      tracker.sustainedTicks++;
      trackers.set(branch.id, tracker);

      const requiredTicks = branch.conditions.sustainedTicks ?? 1;
      if (tracker.sustainedTicks >= requiredTicks) {
        activated.push(branch);
        activatedBranches.add(branch.id);
        trackers.delete(branch.id);
      }
    } else {
      // Reset tracker if conditions break
      trackers.delete(branch.id);
    }
  }

  return activated;
}

/**
 * Check if ALL conditions for a branch are currently met.
 */
function checkConditions(
  branch: ColdBranch,
  pressureState: Record<PressureDomain, { level: number }>,
  worldState: WorldState,
  year: number,
  spheres: Record<SphereId, { governance: GovernanceType; aggregateHostility: number }>,
): boolean {
  const { conditions } = branch;

  // Year range check
  if (conditions.yearRange) {
    if (year < conditions.yearRange.min) return false;
    if (conditions.yearRange.max !== undefined && year > conditions.yearRange.max) return false;
  }

  // Pressure threshold check (ALL specified domains must meet threshold)
  if (conditions.pressureThresholds) {
    for (const [domain, threshold] of Object.entries(conditions.pressureThresholds)) {
      const gauge = pressureState[domain as PressureDomain];
      if (!gauge || gauge.level < threshold) return false;
    }
  }

  // World state conditions check
  if (conditions.worldStateConditions) {
    for (const [key, range] of Object.entries(conditions.worldStateConditions)) {
      const value = (worldState as any)[key];
      if (typeof value !== 'number') continue;
      if (range.min !== undefined && value < range.min) return false;
      if (range.max !== undefined && value > range.max) return false;
    }
  }

  // Sphere conditions check
  if (conditions.sphereConditions) {
    for (const sc of conditions.sphereConditions) {
      const sphere = spheres[sc.sphere];
      if (!sphere) return false;
      if (sc.governance && sphere.governance !== sc.governance) return false;
      if (sc.hostility?.min !== undefined && sphere.aggregateHostility < sc.hostility.min) return false;
    }
  }

  return true;
}

// ─── Serialization ───────────────────────────────────────────────────────────

export interface BranchSystemSaveData {
  activatedBranches: string[];
  trackers: Array<[string, BranchTracker]>;
}

export function serializeBranchSystem(
  activatedBranches: Set<string>,
  trackers: Map<string, BranchTracker>,
): BranchSystemSaveData {
  return {
    activatedBranches: [...activatedBranches],
    trackers: [...trackers.entries()],
  };
}

export function restoreBranchSystem(data: BranchSystemSaveData): {
  activatedBranches: Set<string>;
  trackers: Map<string, BranchTracker>;
} {
  return {
    activatedBranches: new Set(data.activatedBranches),
    trackers: new Map(data.trackers),
  };
}
