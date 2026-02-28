/**
 * Database provider — abstracts SQLite backend for cross-platform use.
 *
 * Web: sql.js (Wasm-based, in-memory with IndexedDB persistence)
 * Mobile: @capacitor-community/sqlite (future)
 */

import type { SQLJsDatabase } from 'drizzle-orm/sql-js';
import { drizzle } from 'drizzle-orm/sql-js';
import initSqlJs from 'sql.js';
import { assetUrl } from '../utils/assetPath';
import * as schema from './schema';

const DB_STORAGE_KEY = 'simsoviet_db';

let _db: SQLJsDatabase<typeof schema> | null = null;
let _sqlDb: InstanceType<Awaited<ReturnType<typeof initSqlJs>>['Database']> | null = null;

/**
 * Initialize the database, loading any persisted data from IndexedDB.
 * Safe to call multiple times — returns cached instance after first init.
 */
export async function initDatabase(): Promise<SQLJsDatabase<typeof schema>> {
  if (_db) return _db;

  const SQL = await initSqlJs({
    // sql.js Wasm binary served from public/wasm/ via Metro middleware
    locateFile: (file: string) => assetUrl(`wasm/${file}`),
  });

  // Try to restore persisted database from IndexedDB
  const persisted = await loadFromIndexedDB();
  _sqlDb = persisted ? new SQL.Database(persisted) : new SQL.Database();

  _db = drizzle(_sqlDb, { schema });

  // Create tables if they don't exist (idempotent)
  _sqlDb.run(`
    CREATE TABLE IF NOT EXISTS saves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT 'autosave',
      timestamp INTEGER NOT NULL,
      version TEXT NOT NULL DEFAULT '1.0.0'
    )
  `);
  _sqlDb.run(`
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
  _sqlDb.run(`
    CREATE TABLE IF NOT EXISTS chronology (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      save_id INTEGER NOT NULL REFERENCES saves(id),
      year INTEGER NOT NULL DEFAULT 1980,
      month INTEGER NOT NULL DEFAULT 1,
      tick INTEGER NOT NULL DEFAULT 0
    )
  `);
  _sqlDb.run(`
    CREATE TABLE IF NOT EXISTS quotas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      save_id INTEGER NOT NULL REFERENCES saves(id),
      type TEXT NOT NULL DEFAULT 'food',
      target INTEGER NOT NULL DEFAULT 500,
      current INTEGER NOT NULL DEFAULT 0,
      deadline_year INTEGER NOT NULL DEFAULT 1985
    )
  `);
  _sqlDb.run(`
    CREATE TABLE IF NOT EXISTS buildings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      save_id INTEGER NOT NULL REFERENCES saves(id),
      grid_x INTEGER NOT NULL,
      grid_y INTEGER NOT NULL,
      type TEXT NOT NULL,
      powered INTEGER NOT NULL DEFAULT 0
    )
  `);
  _sqlDb.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // Migration: add game_state column to saves table (idempotent).
  try {
    _sqlDb.run(`ALTER TABLE saves ADD COLUMN game_state TEXT`);
  } catch {
    // Column already exists — safe to ignore.
  }

  return _db;
}

/** Get the initialized database instance (throws if not initialized). */
export function getDatabase(): SQLJsDatabase<typeof schema> {
  if (!_db) throw new Error('Database not initialized. Call initDatabase() first.');
  return _db;
}

/** Persist the current database state to IndexedDB. */
export async function persistToIndexedDB(): Promise<void> {
  if (!_sqlDb) return;
  const data = _sqlDb.export();
  const buffer = new Uint8Array(data);

  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('simsoviet', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('db')) {
        db.createObjectStore('db');
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('db', 'readwrite');
      tx.objectStore('db').put(buffer, DB_STORAGE_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    };
    request.onerror = () => reject(request.error);
  });
}

/** Load persisted database from IndexedDB (returns null if none). */
async function loadFromIndexedDB(): Promise<Uint8Array | null> {
  return new Promise<Uint8Array | null>((resolve) => {
    const request = indexedDB.open('simsoviet', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('db')) {
        db.createObjectStore('db');
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('db', 'readonly');
      const getReq = tx.objectStore('db').get(DB_STORAGE_KEY);
      getReq.onsuccess = () => {
        db.close();
        resolve((getReq.result as Uint8Array | null) ?? null);
      };
      getReq.onerror = () => {
        db.close();
        resolve(null);
      };
    };
    request.onerror = () => resolve(null);
  });
}

/** Close the database and clean up. */
export function closeDatabase(): void {
  if (_sqlDb) {
    _sqlDb.close();
    _sqlDb = null;
  }
  _db = null;
}

/** Export the entire SQLite database as a Uint8Array (for .db file download). */
export function exportDatabaseFile(): Uint8Array | null {
  if (!_sqlDb) return null;
  return new Uint8Array(_sqlDb.export());
}

/**
 * Import a SQLite database from a Uint8Array (uploaded .db file).
 * Replaces the current in-memory database and persists to IndexedDB.
 */
export async function importDatabaseFile(data: Uint8Array): Promise<SQLJsDatabase<typeof schema>> {
  const SQL = await initSqlJs({
    locateFile: (file: string) => assetUrl(`wasm/${file}`),
  });

  // Close existing database
  if (_sqlDb) {
    _sqlDb.close();
  }

  _sqlDb = new SQL.Database(data);
  _db = drizzle(_sqlDb, { schema });

  // Persist immediately
  await persistToIndexedDB();

  return _db;
}
