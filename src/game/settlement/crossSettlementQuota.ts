/**
 * Cross-settlement quota computation.
 *
 * Moscow's quotas span ALL settlements -- meeting quota from Settlement A
 * doesn't exempt Settlement B. The total quota contribution is the SUM
 * of production across all settlements.
 */

export interface SettlementQuotaInput {
  settlementId: string;
  foodProduced: number;
  vodkaProduced: number;
}

/** Compute total quota contribution across all settlements. */
export function computeCrossSettlementQuota(
  inputs: SettlementQuotaInput[],
  quotaType: 'food' | 'vodka',
): number {
  return inputs.reduce(
    (sum, s) =>
      sum + (quotaType === 'food' ? s.foodProduced : s.vodkaProduced),
    0,
  );
}
