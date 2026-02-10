/**
 * Drizzle ORM schema for SimSoviet 2000.
 *
 * Defines SQLite tables for game persistence via sql.js (web)
 * or @capacitor-community/sqlite (mobile).
 */
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** Game save metadata. Multiple named saves supported. */
export const saves = sqliteTable('saves', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().default('autosave'),
  timestamp: integer('timestamp').notNull(),
  version: text('version').notNull().default('1.0.0'),
  /** JSON blob of full extended game state (subsystems, all resources, config). */
  gameState: text('game_state'),
});

/** Resource snapshot — one row per save. */
export const resources = sqliteTable('resources', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  saveId: integer('save_id')
    .notNull()
    .references(() => saves.id),
  money: integer('money').notNull().default(2000),
  food: integer('food').notNull().default(200),
  vodka: integer('vodka').notNull().default(50),
  power: integer('power').notNull().default(0),
  powerUsed: integer('power_used').notNull().default(0),
  population: integer('population').notNull().default(0),
});

/** Chronology state — one row per save. */
export const chronology = sqliteTable('chronology', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  saveId: integer('save_id')
    .notNull()
    .references(() => saves.id),
  year: integer('year').notNull().default(1980),
  month: integer('month').notNull().default(1),
  tick: integer('tick').notNull().default(0),
});

/** Quota state — one row per save. */
export const quotas = sqliteTable('quotas', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  saveId: integer('save_id')
    .notNull()
    .references(() => saves.id),
  type: text('type').notNull().default('food'),
  target: integer('target').notNull().default(500),
  current: integer('current').notNull().default(0),
  deadlineYear: integer('deadline_year').notNull().default(1985),
});

/** Building instances — many rows per save. */
export const buildings = sqliteTable('buildings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  saveId: integer('save_id')
    .notNull()
    .references(() => saves.id),
  gridX: integer('grid_x').notNull(),
  gridY: integer('grid_y').notNull(),
  type: text('type').notNull(),
  powered: integer('powered', { mode: 'boolean' }).notNull().default(false),
});

/** Game settings — key/value store. */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
