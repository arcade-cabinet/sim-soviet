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
  if (totalPopulation <= 0 || totalSupply <= 0 || buildings.length === 0) {
    return buildings.map((b) => ({ id: b.id, baseline: 0, spike: 0, total: 0 }));
  }

  const perCapita = totalSupply / totalPopulation;
  const spikePool = totalSupply * 0.2;

  const rawScores = buildings.map((b) => {
    const loyaltyFactor = b.loyalty / 100;
    const proximityFactor = b.proximity;
    const skillFactor = b.skill / 100;
    const kgbBonus = b.kgbFavor ? 1.5 : 1.0;
    return b.residentCount * (loyaltyFactor * 0.4 + proximityFactor * 0.25 + skillFactor * 0.2 + 0.15) * kgbBonus;
  });

  const totalScore = rawScores.reduce((s, v) => s + v, 0);

  return buildings.map((b, i) => {
    const baseline = b.residentCount * perCapita;
    // Spike: merit-weighted share of spikePool minus per-capita share of spikePool
    const meritShare = totalScore > 0 ? (rawScores[i] / totalScore) * spikePool : 0;
    const perCapitaShare = (b.residentCount / totalPopulation) * spikePool;
    const spike = meritShare - perCapitaShare;
    return { id: b.id, baseline, spike, total: baseline + spike };
  });
}
