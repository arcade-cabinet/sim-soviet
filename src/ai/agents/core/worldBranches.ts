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
 */

import type { PressureDomain } from '../crisis/pressure/PressureDomains';
import type { CrisisDefinition } from '../crisis/types';
import type { GovernanceType, SphereId } from './worldCountries';
import type { WorldState } from './WorldAgent';

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

export const COLD_BRANCHES: readonly ColdBranch[] = [
  // ── Geopolitical ──────────────────────────────────────────────────────────

  {
    id: 'wwiii',
    name: 'World War III',
    conditions: {
      worldStateConditions: { globalTension: { min: 0.9 }, borderThreat: { min: 0.8 } },
      yearRange: { min: 1960 },
      sustainedTicks: 6,
    },
    effects: {
      pressureSpikes: { demographic: 0.3, infrastructure: 0.3, food: 0.2, morale: 0.25 },
      crisisDefinition: {
        id: 'wwiii', type: 'war', name: 'World War III', startYear: 0, endYear: 0,
        severity: 'existential', peakParams: { conscriptionRate: 0.2, productionMult: 1.3, bombardmentRate: 0.05, foodDrain: 50, moneyDrain: 80 },
        buildupTicks: 6, aftermathTicks: 36, description: 'Global thermonuclear conflict',
      },
      narrative: { pravdaHeadline: 'WAR! GLOBAL CONFLICT ERUPTS — All citizens report for duty.', toast: 'World War III has begun.' },
    },
    oneShot: true,
  },
  {
    id: 'great_depression_ii',
    name: 'Great Depression II',
    conditions: {
      pressureThresholds: { economic: 0.8 },
      worldStateConditions: { commodityIndex: { max: 0.4 } },
      sustainedTicks: 24,
    },
    effects: {
      pressureSpikes: { economic: 0.25, morale: 0.15, political: 0.1 },
      narrative: { pravdaHeadline: 'CAPITALIST ECONOMIES COLLAPSE — Global trade frozen.', toast: 'Global economic depression.' },
    },
    oneShot: true,
  },
  {
    id: 'eu_dissolution',
    name: 'EU Dissolution',
    conditions: {
      sphereConditions: [{ sphere: 'european', governance: 'democratic' }],
      pressureThresholds: { economic: 0.6 },
      yearRange: { min: 2020 },
      sustainedTicks: 12,
    },
    effects: {
      pressureSpikes: { economic: 0.15 },
      worldStateOverrides: { tradeAccess: 0.3 },
      narrative: { pravdaHeadline: 'EUROPEAN UNION COLLAPSES — Continental fragmentation.', toast: 'The EU has dissolved.' },
    },
    oneShot: true,
  },
  {
    id: 'eurasian_unification',
    name: 'Eurasian Unification',
    conditions: {
      sphereConditions: [
        { sphere: 'european', hostility: { min: 0 } },
        { sphere: 'eurasian', hostility: { min: 0 } },
      ],
      worldStateConditions: { tradeAccess: { min: 0.7 } },
      sustainedTicks: 24,
    },
    effects: {
      pressureSpikes: { economic: -0.1 },
      narrative: { pravdaHeadline: 'EURASIAN ECONOMIC UNION FORMALIZED — New era of cooperation.', toast: 'Eurasian unification.' },
    },
    oneShot: true,
  },
  {
    id: 'pan_asian_hegemony',
    name: 'Pan-Asian Hegemony',
    conditions: {
      sphereConditions: [{ sphere: 'sinosphere', hostility: { min: 0 } }],
      yearRange: { min: 2030 },
      sustainedTicks: 24,
    },
    effects: {
      pressureSpikes: { political: 0.1, economic: 0.1 },
      narrative: { pravdaHeadline: 'SINOSPHERE DECLARES NEW WORLD ORDER — Trade routes realigned.', toast: 'Pan-Asian hegemony emerges.' },
    },
    oneShot: true,
  },

  // ── Corporate/Economic ────────────────────────────────────────────────────

  {
    id: 'corporate_sovereignty',
    name: 'Corporate Sovereignty',
    conditions: {
      yearRange: { min: 2030 },
      sustainedTicks: 12,
    },
    effects: {
      pressureSpikes: { political: 0.15, economic: 0.1, loyalty: 0.1 },
      narrative: { pravdaHeadline: 'CORPORATIONS GRANTED SOVEREIGN POWERS — VOC returns.', toast: 'Corporate sovereignty declared.' },
    },
    oneShot: true,
  },
  {
    id: 'neofeudal_transition',
    name: 'Neofeudal Transition',
    conditions: {
      worldStateConditions: { techLevel: { min: 0.8 } },
      yearRange: { min: 2100 },
      sustainedTicks: 120,
    },
    effects: {
      pressureSpikes: { loyalty: 0.2, morale: 0.2, political: 0.1 },
      narrative: { pravdaHeadline: 'ALGORITHMIC SERFDOM DETECTED — New class structure emerges.', toast: 'Neofeudal transition.' },
    },
    oneShot: true,
  },

  // ── Climate/Geological ────────────────────────────────────────────────────

  {
    id: 'permafrost_collapse',
    name: 'Permafrost Collapse',
    conditions: {
      worldStateConditions: { climateTrend: { min: 0.5 } },
      yearRange: { min: 2050 },
      sustainedTicks: 60,
    },
    effects: {
      pressureSpikes: { infrastructure: 0.3, health: 0.15, food: 0.1 },
      narrative: { pravdaHeadline: 'PERMAFROST THAW ACCELERATING — Infrastructure at severe risk.', toast: 'Permafrost collapse! Ground unstable.' },
    },
    oneShot: true,
  },
  {
    id: 'siberian_exodus',
    name: 'Siberian Exodus',
    conditions: {
      worldStateConditions: { climateTrend: { min: 0.8 } },
      pressureThresholds: { food: 0.9, infrastructure: 0.9 },
      yearRange: { min: 2100 },
      sustainedTicks: 120,
    },
    effects: {
      pressureSpikes: { demographic: 0.3, morale: 0.3, housing: 0.2 },
      narrative: { pravdaHeadline: 'MANDATORY RELOCATION ORDERED — Settlement uninhabitable.', toast: 'Siberian Exodus! Must relocate.' },
      relocation: {
        type: 'climate_exodus',
        targetTerrain: { gravity: 1.0, atmosphere: 'breathable', water: 'rivers', farming: 'soil', construction: 'standard', baseSurvivalCost: 'high' },
      },
      newSettlement: true,
    },
    oneShot: true,
  },
  {
    id: 'nuclear_winter',
    name: 'Nuclear Winter',
    conditions: {
      worldStateConditions: { globalTension: { min: 0.7 } },
      sustainedTicks: 6,
    },
    effects: {
      pressureSpikes: { food: 0.3, health: 0.2, morale: 0.25, demographic: 0.2 },
      narrative: { pravdaHeadline: 'NUCLEAR WINTER DESCENDS — Sunlight blocked for years.', toast: 'Nuclear winter! Crops failing.' },
    },
    oneShot: true,
  },

  // ── Technology/Expansion ──────────────────────────────────────────────────

  {
    id: 'ai_singularity',
    name: 'AI Singularity',
    conditions: {
      worldStateConditions: { techLevel: { min: 0.95 } },
      yearRange: { min: 2040 },
      sustainedTicks: 6,
    },
    effects: {
      pressureSpikes: { economic: 0.2, political: 0.15, loyalty: 0.1 },
      narrative: { pravdaHeadline: 'ARTIFICIAL INTELLIGENCE ACHIEVES SELF-IMPROVEMENT — Labor crisis imminent.', toast: 'AI Singularity!' },
    },
    oneShot: true,
  },
  {
    id: 'lunar_colony_directive',
    name: 'Lunar Colony Directive',
    conditions: {
      worldStateConditions: { techLevel: { min: 0.7 } },
      yearRange: { min: 2030 },
      sustainedTicks: 12,
    },
    effects: {
      pressureSpikes: { economic: 0.15, demographic: 0.1 },
      narrative: { pravdaHeadline: 'MOSCOW ORDERS LUNAR COLONIZATION — Your settlement chosen.', toast: 'Lunar colony directive!' },
      relocation: {
        type: 'colonial_expansion',
        targetTerrain: { gravity: 0.16, atmosphere: 'none', water: 'ice_deposits', farming: 'hydroponics', construction: 'pressurized_domes', baseSurvivalCost: 'extreme' },
      },
      newSettlement: true,
    },
    oneShot: true,
  },
  {
    id: 'mars_colonization',
    name: 'Mars Colonization',
    conditions: {
      worldStateConditions: { techLevel: { min: 0.8 } },
      yearRange: { min: 2060 },
      sustainedTicks: 12,
    },
    effects: {
      pressureSpikes: { economic: 0.2, demographic: 0.15 },
      narrative: { pravdaHeadline: 'MARS COLONY AUTHORIZED — Red planet awaits Soviet settlers.', toast: 'Mars colonization ordered!' },
      relocation: {
        type: 'colonial_expansion',
        targetTerrain: { gravity: 0.38, atmosphere: 'thin_co2', water: 'subsurface', farming: 'greenhouse', construction: 'pressurized_domes', baseSurvivalCost: 'very_high' },
      },
      newSettlement: true,
    },
    oneShot: true,
  },
  {
    id: 'interstellar_ark',
    name: 'Interstellar Ark',
    conditions: {
      worldStateConditions: { techLevel: { min: 0.99 } },
      yearRange: { min: 2200 },
      sustainedTicks: 24,
    },
    effects: {
      pressureSpikes: { demographic: 0.2, morale: 0.1 },
      narrative: { pravdaHeadline: 'INTERSTELLAR ARK LAUNCHED — Generation ship departs for Alpha Centauri.', toast: 'Interstellar colonization!' },
      relocation: {
        type: 'interstellar',
        targetTerrain: { gravity: 1.0, atmosphere: 'variable', water: 'variable', farming: 'variable', construction: 'variable', baseSurvivalCost: 'variable' },
      },
      newSettlement: true,
    },
    oneShot: true,
  },

  // ── Historical/Political ──────────────────────────────────────────────────

  {
    id: 'dekulakization_purge',
    name: 'Dekulakization Purge',
    conditions: {
      pressureThresholds: { political: 0.5 },
      yearRange: { min: 1929, max: 1933 },
      sustainedTicks: 6,
    },
    effects: {
      pressureSpikes: { demographic: 0.2, morale: 0.2, loyalty: 0.15 },
      crisisDefinition: {
        id: 'dekulakization', type: 'political', name: 'Dekulakization Purge', startYear: 0, endYear: 0,
        severity: 'national', peakParams: { kgbAggressionMult: 2.5, moraleHit: -0.5, productionMult: 0.6 },
        buildupTicks: 6, aftermathTicks: 24, description: 'Forced relocation of kulaks',
      },
      narrative: { pravdaHeadline: 'DEKULAKIZATION ORDERED — Unreliable elements to be relocated.', toast: 'Dekulakization! Population loss.' },
      relocation: {
        type: 'forced_transfer',
        targetTerrain: { gravity: 1.0, atmosphere: 'breathable', water: 'rivers', farming: 'soil', construction: 'standard', baseSurvivalCost: 'high' },
      },
      newSettlement: true,
    },
    oneShot: true,
  },
  {
    id: 'ethnic_deportation',
    name: 'Ethnic Deportation',
    conditions: {
      pressureThresholds: { political: 0.6 },
      yearRange: { min: 1935, max: 1950 },
      sustainedTicks: 6,
    },
    effects: {
      pressureSpikes: { loyalty: 0.25, morale: 0.2, demographic: 0.15 },
      narrative: { pravdaHeadline: 'MOSCOW DEPORTS UNRELIABLE ETHNIC GROUP — Severe morale impact.', toast: 'Ethnic deportation ordered!' },
    },
    oneShot: true,
  },
  {
    id: 'virgin_lands_assignment',
    name: 'Virgin Lands Assignment',
    conditions: {
      pressureThresholds: { food: 0.6 },
      yearRange: { min: 1954, max: 1965 },
      sustainedTicks: 12,
    },
    effects: {
      pressureSpikes: { demographic: 0.1, economic: 0.1 },
      narrative: { pravdaHeadline: 'CONGRATULATIONS! You have been assigned to develop VIRGIN LANDS in Kazakhstan.', toast: 'Virgin Lands assignment!' },
      relocation: {
        type: 'forced_transfer',
        targetTerrain: { gravity: 1.0, atmosphere: 'breathable', water: 'rivers', farming: 'soil', construction: 'standard', baseSurvivalCost: 'high' },
      },
      newSettlement: true,
    },
    oneShot: true,
  },
  {
    id: 'moscow_promotion',
    name: 'Moscow Promotion',
    conditions: {
      pressureThresholds: { political: 0 }, // low political pressure (thriving)
      worldStateConditions: { moscowAttention: { min: 0.5 } },
      sustainedTicks: 24,
    },
    effects: {
      pressureSpikes: { economic: 0.1 },
      narrative: { pravdaHeadline: 'PROMOTION! Your excellent service earns you MORE responsibility.', toast: 'Moscow "rewards" you with another settlement.' },
      newSettlement: true,
    },
    oneShot: false, // can trigger multiple times
  },

  // ── Religious/Identity ────────────────────────────────────────────────────

  {
    id: 'islamic_renaissance',
    name: 'Islamic Renaissance',
    conditions: {
      sphereConditions: [{ sphere: 'middle_eastern', governance: 'theocratic' }],
      yearRange: { min: 1970 },
      sustainedTicks: 24,
    },
    effects: {
      pressureSpikes: { political: 0.1, loyalty: 0.1 },
      narrative: { pravdaHeadline: 'ISLAMIC RENAISSANCE SWEEPS MIDDLE EAST — New identity-based sphere.', toast: 'Islamic Renaissance.' },
    },
    oneShot: true,
  },
];

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
