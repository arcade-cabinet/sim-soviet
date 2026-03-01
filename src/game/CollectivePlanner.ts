/**
 * @module game/CollectivePlanner
 *
 * Collective Planner — merges state-mandated buildings (from PlanMandates)
 * with worker-generated demands (from demandSystem) into a single prioritized
 * construction queue.
 *
 * Priority ordering (lower sortPriority = build first):
 *   critical demands (0) < mandates (10) < urgent demands (20) < normal demands (30)
 *
 * Deduplication: if a mandate already covers a defId, the demand for that
 * defId is skipped (mandates take precedence as they are state-mandated).
 */

import type { PlanMandateState } from './PlanMandates';
import type { ConstructionDemand, DemandPriority } from './workers/demandSystem';

// ── Types ─────────────────────────────────────────────────────────────────────

export type RequestSource = 'mandate' | 'demand';

export interface ConstructionRequest {
  defId: string;
  source: RequestSource;
  label: string;
  sortPriority: number; // lower = build first
  reason: string;
}

// ── Priority Weights ──────────────────────────────────────────────────────────

const DEMAND_PRIORITY_WEIGHT: Record<DemandPriority, number> = {
  critical: 0, // Build before mandates
  urgent: 20, // Build after mandates
  normal: 30, // Lowest priority
};

const MANDATE_WEIGHT = 10; // Between critical demands and urgent demands

// ── CollectivePlanner ─────────────────────────────────────────────────────────

export class CollectivePlanner {
  /**
   * Generate a prioritized construction queue by merging mandates and demands.
   *
   * 1. Add unfulfilled mandates (required - fulfilled > 0) as requests
   * 2. Add worker demands as requests (one per suggestedDefId)
   * 3. Deduplicate: if a mandate already covers a defId, skip the demand
   * 4. Sort by sortPriority ascending (lower = higher priority)
   */
  generateQueue(
    mandateState: PlanMandateState | null,
    demands: ConstructionDemand[],
  ): ConstructionRequest[] {
    const requests: ConstructionRequest[] = [];
    const mandateDefIds = new Set<string>();

    // ── 1. Unfulfilled mandates ───────────────────────────────────────────
    if (mandateState) {
      for (const mandate of mandateState.mandates) {
        const remaining = mandate.required - mandate.fulfilled;
        if (remaining <= 0) continue;

        mandateDefIds.add(mandate.defId);

        // Emit one request per remaining unit
        for (let i = 0; i < remaining; i++) {
          requests.push({
            defId: mandate.defId,
            source: 'mandate',
            label: mandate.label,
            sortPriority: MANDATE_WEIGHT,
            reason: `5-Year Plan mandate: build ${mandate.label}`,
          });
        }
      }
    }

    // ── 2. Worker demands ─────────────────────────────────────────────────
    for (const demand of demands) {
      const weight = DEMAND_PRIORITY_WEIGHT[demand.priority];

      for (const defId of demand.suggestedDefIds) {
        // ── 3. Deduplicate: skip if mandate already covers this defId ───
        if (mandateDefIds.has(defId)) continue;

        requests.push({
          defId,
          source: 'demand',
          label: `${demand.category} demand`,
          sortPriority: weight,
          reason: demand.reason,
        });
      }
    }

    // ── 4. Sort by priority (ascending — lower = higher priority) ────────
    requests.sort((a, b) => a.sortPriority - b.sortPriority);

    return requests;
  }
}
