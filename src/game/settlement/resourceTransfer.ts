/**
 * Inter-settlement resource transfer with distance-based logistics cost.
 *
 * Pure function -- no side effects. The caller is responsible for
 * debiting source and crediting target settlement resources.
 */

/** Transfer request: amounts to send and distance metadata. */
export interface TransferRequest {
  food: number;
  money: number;
  workers: number;
  sourceDistance: number;
  targetDistance: number;
}

/** Transfer result: amounts that actually arrive after logistics loss. */
export interface TransferResult {
  food: number;
  money: number;
  workers: number;
  lossRate: number;
}

/**
 * Compute arrived amounts after logistics loss.
 *
 * Loss = 5% base + distance factor (capped at 50% total).
 * Money loses at half rate, workers at 30% rate.
 */
export function computeTransferResult(request: TransferRequest): TransferResult {
  const distanceDelta = Math.abs(request.targetDistance - request.sourceDistance);
  const distanceFactor = Math.min(0.3, distanceDelta * 0.0000001);
  const lossRate = Math.min(0.5, 0.05 + distanceFactor);

  return {
    food: Math.floor(request.food * (1 - lossRate)),
    money: Math.floor(request.money * (1 - lossRate * 0.5)),
    workers: Math.floor(request.workers * (1 - lossRate * 0.3)),
    lossRate,
  };
}
