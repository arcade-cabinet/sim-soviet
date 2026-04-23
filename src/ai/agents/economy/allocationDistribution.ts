export interface BuildingAllocationInput {
  id: string;
  residentCount: number;
  loyalty: number;
  proximity: number;
  skill: number;
  kgbFavor: boolean;
}

export interface BuildingAllocationResult {
  id: string;
  baseline: number;
  spike: number;
  total: number;
}

/**
 * Two-layer resource distribution: uniform baseline per capita,
 * then a spiky redistribution layer shifts 20% of supply from low-merit
 * buildings toward high-merit ones (loyalty, proximity, skill, KGB favor).
 * The spike layer is zero-sum so total allocation always equals total supply.
 */
export function computeAllocation(
  totalSupply: number,
  totalPopulation: number,
  buildings: BuildingAllocationInput[],
): BuildingAllocationResult[] {
  if (
    !Number.isFinite(totalSupply) ||
    !Number.isFinite(totalPopulation) ||
    totalPopulation <= 0 ||
    totalSupply <= 0 ||
    buildings.length === 0
  ) {
    return buildings.map((b) => ({ id: b.id, baseline: 0, spike: 0, total: 0 }));
  }

  const perCapita = totalSupply / totalPopulation;
  const spikePool = totalSupply * 0.2;

  const rawScores = buildings.map((b) => {
    const residentCount = Number.isFinite(b.residentCount) ? Math.max(0, b.residentCount) : 0;
    const loyaltyFactor = Number.isFinite(b.loyalty) ? b.loyalty / 100 : 0.5;
    const proximityFactor = Number.isFinite(b.proximity) ? b.proximity : 0.5;
    const skillFactor = Number.isFinite(b.skill) ? b.skill / 100 : 0.5;
    const kgbBonus = b.kgbFavor ? 1.5 : 1.0;
    return residentCount * (loyaltyFactor * 0.4 + proximityFactor * 0.25 + skillFactor * 0.2 + 0.15) * kgbBonus;
  });

  const totalScore = rawScores.reduce((s, v) => s + v, 0);

  return buildings.map((b, i) => {
    const residentCount = Number.isFinite(b.residentCount) ? Math.max(0, b.residentCount) : 0;
    const baseline = residentCount * perCapita;
    // Spike: merit-weighted share of spikePool minus per-capita share of spikePool
    const rawScore = rawScores[i] ?? 0;
    const meritShare = totalScore > 0 && Number.isFinite(rawScore) ? (rawScore / totalScore) * spikePool : 0;
    const perCapitaShare = (residentCount / totalPopulation) * spikePool;
    const spike = meritShare - perCapitaShare;
    return { id: b.id, baseline, spike, total: baseline + spike };
  });
}
