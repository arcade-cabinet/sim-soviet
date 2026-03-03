/**
 * Drizzle ORM schema for timeline event tracking.
 *
 * Stores historical and divergent crisis events for the governor system.
 * Used by both HistoricalGovernor (recording what happened) and
 * FreeformGovernor (recording player-driven divergences).
 */
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { saves } from './schema';

/** Timeline events — crisis occurrences linked to a save. */
export const timelineEvents = sqliteTable('timeline_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  saveId: integer('save_id')
    .notNull()
    .references(() => saves.id),
  eventId: text('event_id').notNull(),
  crisisType: text('crisis_type').notNull(),
  startYear: integer('start_year').notNull(),
  endYear: integer('end_year'),
  isHistorical: integer('is_historical', { mode: 'boolean' }).default(true),
  parameters: text('parameters'),
  outcomes: text('outcomes'),
  parentEventId: text('parent_event_id'),
  divergenceDecision: text('divergence_decision'),
  recordedTick: integer('recorded_tick').notNull(),
});

/** Divergence points — moments where the player's timeline splits from history. */
export const divergencePoints = sqliteTable('divergence_points', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  saveId: integer('save_id')
    .notNull()
    .references(() => saves.id),
  year: integer('year').notNull(),
  month: integer('month').notNull(),
  historicalContext: text('historical_context'),
  playerChoice: text('player_choice'),
  stateSnapshot: text('state_snapshot'),
  divergenceTick: integer('divergence_tick').notNull(),
});
