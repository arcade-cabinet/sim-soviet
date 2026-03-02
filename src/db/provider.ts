/**
 * Database provider — abstracts SQLite backend for cross-platform use.
 *
 * Uses expo-sqlite which provides:
 * - Web: OPFS-based persistence (automatic)
 * - Native: Native SQLite (automatic)
 *
 * Storage security note: Game state stored locally is intentionally
 * unencrypted. This is single-player game save data with no sensitive user
 * information (no passwords, tokens, PII, or payment data). Encrypting
 * local game saves would add complexity without meaningful security benefit.
 */

import { type ExpoSQLiteDatabase, drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import * as schema from './schema';

let _db: ExpoSQLiteDatabase<typeof schema> | null = null;
let _sqliteDb: ReturnType<typeof openDatabaseSync> | null = null;

/**
 * Initialize the database. expo-sqlite handles persistence automatically.
 * Safe to call multiple times — returns cached instance after first init.
 *
 * @returns Drizzle ORM database instance with the SimSoviet schema
 */
export async function initDatabase(): Promise<ExpoSQLiteDatabase<typeof schema>> {
  if (_db) return _db;

  _sqliteDb = openDatabaseSync('simsoviet.db');
  _db = drizzle(_sqliteDb, { schema });

  // Create tables if they don't exist (idempotent)
  _sqliteDb.execSync(`
    CREATE TABLE IF NOT EXISTS saves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT 'autosave',
      timestamp INTEGER NOT NULL,
      version TEXT NOT NULL DEFAULT '1.0.0',
      game_state TEXT
    )
  `);
  _sqliteDb.execSync(`
    CREATE TABLE IF NOT EXISTS resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      save_id INTEGER NOT NULL REFERENCES saves(id),
      money INTEGER NOT NULL DEFAULT 2000,
      food INTEGER NOT NULL DEFAULT 200,
      vodka INTEGER NOT NULL DEFAULT 50,
      power INTEGER NOT NULL DEFAULT 0,
      power_used INTEGER NOT NULL DEFAULT 0,
      population INTEGER NOT NULL DEFAULT 0
    )
  `);
  _sqliteDb.execSync(`
    CREATE TABLE IF NOT EXISTS chronology (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      save_id INTEGER NOT NULL REFERENCES saves(id),
      year INTEGER NOT NULL DEFAULT 1980,
      month INTEGER NOT NULL DEFAULT 1,
      tick INTEGER NOT NULL DEFAULT 0
    )
  `);
  _sqliteDb.execSync(`
    CREATE TABLE IF NOT EXISTS quotas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      save_id INTEGER NOT NULL REFERENCES saves(id),
      type TEXT NOT NULL DEFAULT 'food',
      target INTEGER NOT NULL DEFAULT 500,
      current INTEGER NOT NULL DEFAULT 0,
      deadline_year INTEGER NOT NULL DEFAULT 1985
    )
  `);
  _sqliteDb.execSync(`
    CREATE TABLE IF NOT EXISTS buildings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      save_id INTEGER NOT NULL REFERENCES saves(id),
      grid_x INTEGER NOT NULL,
      grid_y INTEGER NOT NULL,
      type TEXT NOT NULL,
      powered INTEGER NOT NULL DEFAULT 0
    )
  `);
  _sqliteDb.execSync(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  return _db;
}

/**
 * Get the initialized database instance.
 *
 * @returns Drizzle ORM database instance
 * @throws If initDatabase() has not been called
 */
export function getDatabase(): ExpoSQLiteDatabase<typeof schema> {
  if (!_db) throw new Error('Database not initialized. Call initDatabase() first.');
  return _db;
}

/** Close the database and clean up. */
export function closeDatabase(): void {
  if (_sqliteDb) {
    _sqliteDb.closeSync();
    _sqliteDb = null;
  }
  _db = null;
}

/**
 * Export the entire SQLite database as a Uint8Array (for .db file download).
 *
 * @returns Raw SQLite database bytes, or null if database not initialized
 */
export function exportDatabaseFile(): Uint8Array | null {
  if (!_sqliteDb) return null;
  return _sqliteDb.serializeSync();
}

/**
 * Import a SQLite database from a Uint8Array (uploaded .db file).
 * Replaces the current database with the imported data.
 *
 * @param data - Raw SQLite database bytes
 * @returns New Drizzle ORM database instance wrapping the imported data
 */
export async function importDatabaseFile(data: Uint8Array): Promise<ExpoSQLiteDatabase<typeof schema>> {
  // Close existing database
  if (_sqliteDb) {
    _sqliteDb.closeSync();
  }

  _sqliteDb = openDatabaseSync('simsoviet.db');
  _sqliteDb.deserializeSync(data);
  _db = drizzle(_sqliteDb, { schema });

  return _db;
}
