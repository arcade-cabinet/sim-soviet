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
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { deserializeDatabaseSync, openDatabaseSync } from 'expo-sqlite';
import migrations from './drizzle/migrations';
import * as schema from './schema';

let _db: ExpoSQLiteDatabase<typeof schema> | null = null;
let _sqliteDb: ReturnType<typeof openDatabaseSync> | null = null;

/**
 * Initialize the database. expo-sqlite handles persistence automatically.
 * Safe to call multiple times — returns cached instance after first init.
 *
 * Runs Drizzle migrations on first init to create/update tables.
 *
 * @returns Drizzle ORM database instance with the SimSoviet schema
 */
export async function initDatabase(): Promise<ExpoSQLiteDatabase<typeof schema>> {
  if (_db) return _db;

  _sqliteDb = openDatabaseSync('simsoviet.db');
  _db = drizzle(_sqliteDb, { schema });

  // Run Drizzle migrations (idempotent — tracks applied migrations internally)
  await migrate(_db, migrations);

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

  _sqliteDb = deserializeDatabaseSync(data);
  _db = drizzle(_sqliteDb, { schema });

  return _db;
}
