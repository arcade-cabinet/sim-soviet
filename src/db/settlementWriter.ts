/**
 * Pure function that maps a SettlementSummary to a settlement_state DB row.
 * No DB calls — the caller handles the actual insert/upsert.
 */
import type { SettlementSummary } from '../game/engine/SettlementSummary';

/** Shape of a settlement_state row for insert/upsert. */
export interface SettlementStateRow {
  population: number;
  totalBuildings: number;
  era: string;
  year: number;
  month: number;
  landGrantRadius: number;
  trendFoodDelta: number;
  trendPopDelta: number;
  trendMoraleDelta: number;
  trendPowerDelta: number;
  yearsSinceLastWar: number;
  yearsSinceLastFamine: number;
  yearsSinceLastDisaster: number;
}

/** Extra context not present in SettlementSummary. */
export interface SettlementContext {
  era: string;
  landGrantRadius: number;
}

/**
 * Build a settlement_state row object from a SettlementSummary.
 * @param summary - Current tick's settlement summary
 * @param ctx - Additional context (era, landGrantRadius) not in the summary
 * @returns Row object ready for DB insert/upsert
 */
export function buildSettlementRow(
  summary: SettlementSummary,
  ctx: SettlementContext,
): SettlementStateRow {
  return {
    population: summary.population,
    totalBuildings: summary.buildingCount,
    era: ctx.era,
    year: summary.year,
    month: summary.month,
    landGrantRadius: ctx.landGrantRadius,
    trendFoodDelta: summary.trendDeltas.food,
    trendPopDelta: summary.trendDeltas.population,
    trendMoraleDelta: summary.trendDeltas.morale,
    trendPowerDelta: summary.trendDeltas.power,
    yearsSinceLastWar: summary.yearsSinceLastWar,
    yearsSinceLastFamine: summary.yearsSinceLastFamine,
    yearsSinceLastDisaster: summary.yearsSinceLastDisaster,
  };
}
