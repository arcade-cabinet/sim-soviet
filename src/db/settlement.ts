/**
 * Single-row settlement state — the canonical current state summary.
 * Agents read this instead of scanning entities.
 */
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const settlementState = sqliteTable('settlement_state', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  population: integer('population').notNull().default(0),
  totalBuildings: integer('total_buildings').notNull().default(0),
  era: text('era').notNull().default('revolution'),
  year: integer('year').notNull().default(1917),
  month: integer('month').notNull().default(10),
  landGrantRadius: integer('land_grant_radius').notNull().default(15),
  trendFoodDelta: real('trend_food_delta').notNull().default(0),
  trendPopDelta: real('trend_pop_delta').notNull().default(0),
  trendMoraleDelta: real('trend_morale_delta').notNull().default(0),
  trendPowerDelta: real('trend_power_delta').notNull().default(0),
  yearsSinceLastWar: integer('years_since_last_war').notNull().default(999),
  yearsSinceLastFamine: integer('years_since_last_famine').notNull().default(999),
  yearsSinceLastDisaster: integer('years_since_last_disaster').notNull().default(999),
});
