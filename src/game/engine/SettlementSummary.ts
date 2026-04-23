/**
 * Fixed-size settlement summary — the ONLY input every agent reads.
 * Same size at year 50 or year 50,000. No arrays that grow with time.
 */
export interface SettlementSummary {
  year: number;
  month: number;
  population: number;
  buildingCount: number;
  totalFood: number;
  totalPower: number;
  totalMorale: number;
  activeCrisisCount: number;
  activeCrisisTypes: Set<string>;
  trendDeltas: {
    food: number;
    population: number;
    morale: number;
    power: number;
  };
  yearsSinceLastWar: number;
  yearsSinceLastFamine: number;
  yearsSinceLastDisaster: number;
}

/** Build a SettlementSummary from raw inputs. Pure function. */
export function buildSettlementSummary(input: SettlementSummary): SettlementSummary {
  return { ...input };
}
