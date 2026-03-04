/**
 * @module ai/agents/crisis/CrisisImpactApplicator
 *
 * Pure function that applies CrisisImpact arrays (produced by crisis agents)
 * to game state. This is the single controlled "write access" mechanism for
 * crisis effects.
 *
 * Merge semantics:
 *   - Multipliers are combined multiplicatively (default 1.0)
 *   - Deltas are summed additively
 *   - Narrative callbacks fire for each impact
 */

import type { CrisisImpact } from './types';

// ─── Dependencies Interface ────────────────────────────────────────────────

/** External systems the applicator needs write access to. */
export interface ApplicatorDeps {
  resources: {
    food: number;
    money: number;
    vodka: number;
    population: number;
  };
  callbacks: {
    onPravda: (msg: string) => void;
    onToast: (msg: string, severity?: 'warning' | 'critical' | 'evacuation') => void;
  };
  workerSystem?: {
    removeWorkersByCountMaleFirst: (count: number, reason: string) => number;
    spawnInflowDvor: (count: number, reason: string) => void;
  };
  kgbAgent?: {
    addMark: (reason: string, tick: number, description: string) => void;
  };
  buildings?: Array<{ gridX: number; gridY: number; type: string }>;
  rng: { int: (min: number, max: number) => number; random: () => number };
  totalTicks: number;
}

// ─── Result Interface ──────────────────────────────────────────────────────

/** Merged output of applying all crisis impacts for a tick. */
export interface ApplicatorResult {
  /** Merged multiplier for production output. */
  productionMult: number;
  /** Merged multiplier for building decay rate. */
  decayMult: number;
  /** Merged multiplier for population growth. */
  growthMult: number;
  /** Merged multiplier for disease spread. */
  diseaseMult: number;
  /** Merged multiplier for KGB aggression. */
  kgbAggressionMult: number;
  /** Merged multiplier for quota targets. */
  quotaMult: number;
  /** Buildings targeted for destruction (positions). */
  destroyedBuildings: Array<{ gridX: number; gridY: number }>;
  /** Total workers conscripted/killed this tick. */
  workersLost: number;
  /** Total workers returned this tick. */
  workersGained: number;
}

// ─── Neutral Result ────────────────────────────────────────────────────────

/** A result with no effects — all multipliers 1.0, all counts 0. */
function neutralResult(): ApplicatorResult {
  return {
    productionMult: 1.0,
    decayMult: 1.0,
    growthMult: 1.0,
    diseaseMult: 1.0,
    kgbAggressionMult: 1.0,
    quotaMult: 1.0,
    destroyedBuildings: [],
    workersLost: 0,
    workersGained: 0,
  };
}

// ─── Main Function ─────────────────────────────────────────────────────────

/**
 * Apply an array of CrisisImpacts to game state.
 *
 * @param impacts - Impact tickets produced by crisis agents this tick
 * @param deps - External system dependencies (resources, callbacks, etc.)
 * @returns Merged result with multipliers for caller to apply to subsystems
 */
export function applyCrisisImpacts(impacts: CrisisImpact[], deps: ApplicatorDeps): ApplicatorResult {
  const result = neutralResult();

  for (const impact of impacts) {
    applyEconomy(impact, deps, result);
    applyWorkforce(impact, deps, result);
    applyInfrastructure(impact, deps, result);
    applyPolitical(impact, result);
    applySocial(impact, result);
    applyNarrative(impact, deps);
  }

  return result;
}

// ─── Per-Domain Applicators ────────────────────────────────────────────────

function applyEconomy(impact: CrisisImpact, deps: ApplicatorDeps, result: ApplicatorResult): void {
  const eco = impact.economy;
  if (!eco) return;

  if (eco.foodDelta !== undefined) {
    deps.resources.food = Math.max(0, deps.resources.food + eco.foodDelta);
  }
  if (eco.moneyDelta !== undefined) {
    deps.resources.money = Math.max(0, deps.resources.money + eco.moneyDelta);
  }
  if (eco.productionMult !== undefined) {
    result.productionMult *= eco.productionMult;
  }
}

function applyWorkforce(impact: CrisisImpact, deps: ApplicatorDeps, result: ApplicatorResult): void {
  const wf = impact.workforce;
  if (!wf) return;

  if (wf.conscriptionCount !== undefined && wf.conscriptionCount !== 0 && deps.workerSystem) {
    if (wf.conscriptionCount > 0) {
      const removed = deps.workerSystem.removeWorkersByCountMaleFirst(wf.conscriptionCount, 'crisis_conscription');
      result.workersLost += removed;
    } else {
      // Negative conscription = veteran returns
      deps.workerSystem.spawnInflowDvor(-wf.conscriptionCount, 'veteran_return');
      result.workersGained += -wf.conscriptionCount;
    }
  }

  if (wf.casualtyCount !== undefined && wf.casualtyCount > 0 && deps.workerSystem) {
    const removed = deps.workerSystem.removeWorkersByCountMaleFirst(wf.casualtyCount, 'crisis_casualty');
    result.workersLost += removed;
  }
}

function applyInfrastructure(impact: CrisisImpact, _deps: ApplicatorDeps, result: ApplicatorResult): void {
  const infra = impact.infrastructure;
  if (!infra) return;

  if (infra.decayMult !== undefined) {
    result.decayMult *= infra.decayMult;
  }

  if (infra.destructionTargets && infra.destructionTargets.length > 0) {
    for (const target of infra.destructionTargets) {
      result.destroyedBuildings.push({ gridX: target.gridX, gridY: target.gridY });
    }
  }
}

function applyPolitical(impact: CrisisImpact, result: ApplicatorResult): void {
  const pol = impact.political;
  if (!pol) return;

  if (pol.kgbAggressionMult !== undefined) {
    result.kgbAggressionMult *= pol.kgbAggressionMult;
  }
  if (pol.quotaMult !== undefined) {
    result.quotaMult *= pol.quotaMult;
  }
}

function applySocial(impact: CrisisImpact, result: ApplicatorResult): void {
  const soc = impact.social;
  if (!soc) return;

  if (soc.diseaseMult !== undefined) {
    result.diseaseMult *= soc.diseaseMult;
  }
  if (soc.growthMult !== undefined) {
    result.growthMult *= soc.growthMult;
  }
}

function applyNarrative(impact: CrisisImpact, deps: ApplicatorDeps): void {
  const narr = impact.narrative;
  if (!narr) return;

  if (narr.pravdaHeadlines) {
    for (const headline of narr.pravdaHeadlines) {
      deps.callbacks.onPravda(headline);
    }
  }

  if (narr.toastMessages) {
    for (const toast of narr.toastMessages) {
      deps.callbacks.onToast(toast.text, toast.severity);
    }
  }
}
