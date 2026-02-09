/**
 * SaveSystem — game persistence via Drizzle ORM + sql.js (SQLite).
 *
 * Saves/loads game state to an in-memory SQLite database that is
 * persisted to IndexedDB between sessions.
 *
 * Falls back to localStorage if the database isn't initialized
 * (e.g., during tests or if sql.js Wasm fails to load).
 */
import { eq } from 'drizzle-orm';
import type { SQLJsDatabase } from 'drizzle-orm/sql-js';
import { getDatabase, persistToIndexedDB } from '@/db/provider';
import * as dbSchema from '@/db/schema';
import { getFootprint } from '@/game/BuildingFootprints';
import type { GameState } from './GameState';

const LOCALSTORAGE_KEY = 'simsoviet_save_v1';

export interface SaveData {
  version: string;
  timestamp: number;
  money: number;
  pop: number;
  food: number;
  vodka: number;
  power: number;
  powerUsed: number;
  date: { year: number; month: number; tick: number };
  buildings: Array<{ x: number; y: number; type: string; powered: boolean }>;
  quota: { type: string; target: number; current: number; deadlineYear: number };
}

export class SaveSystem {
  private autoSaveTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private gameState: GameState) {}

  /**
   * Save the current game state.
   * Uses Drizzle/SQLite if available, falls back to localStorage.
   */
  public async save(name = 'autosave'): Promise<boolean> {
    try {
      const db = this.tryGetDb();
      if (db) {
        return this.saveToDb(db, name);
      }
      return this.saveToLocalStorage();
    } catch (error) {
      console.error('Failed to save game:', error);
      return false;
    }
  }

  /**
   * Load a saved game.
   * Uses Drizzle/SQLite if available, falls back to localStorage.
   */
  public async load(name = 'autosave'): Promise<boolean> {
    try {
      const db = this.tryGetDb();
      if (db) {
        return this.loadFromDb(db, name);
      }
      return this.loadFromLocalStorage();
    } catch (error) {
      console.error('Failed to load game:', error);
      return false;
    }
  }

  /** Check if a save exists. */
  public async hasSave(name = 'autosave'): Promise<boolean> {
    try {
      const db = this.tryGetDb();
      if (db) {
        const rows = db.select().from(dbSchema.saves).where(eq(dbSchema.saves.name, name)).all();
        return rows.length > 0;
      }
      return localStorage.getItem(LOCALSTORAGE_KEY) !== null;
    } catch {
      return false;
    }
  }

  /** Delete a save. */
  public async deleteSave(name = 'autosave'): Promise<void> {
    try {
      const db = this.tryGetDb();
      if (db) {
        const save = db.select().from(dbSchema.saves).where(eq(dbSchema.saves.name, name)).get();
        if (save) {
          db.delete(dbSchema.buildings).where(eq(dbSchema.buildings.saveId, save.id)).run();
          db.delete(dbSchema.resources).where(eq(dbSchema.resources.saveId, save.id)).run();
          db.delete(dbSchema.chronology).where(eq(dbSchema.chronology.saveId, save.id)).run();
          db.delete(dbSchema.quotas).where(eq(dbSchema.quotas.saveId, save.id)).run();
          db.delete(dbSchema.saves).where(eq(dbSchema.saves.id, save.id)).run();
          await persistToIndexedDB();
        }
      } else {
        localStorage.removeItem(LOCALSTORAGE_KEY);
      }
    } catch (error) {
      console.error('Failed to delete save:', error);
    }
  }

  /** Start auto-saving every 60 seconds. Returns cleanup function. */
  public startAutoSave(): () => void {
    this.stopAutoSave();
    this.autoSaveTimer = setInterval(() => {
      this.save();
    }, 60000);
    return () => this.stopAutoSave();
  }

  /** Stop the auto-save timer. */
  public stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  // ── SQLite (Drizzle) persistence ──────────────────────────────────────

  private tryGetDb(): SQLJsDatabase<typeof dbSchema> | null {
    try {
      return getDatabase();
    } catch {
      return null;
    }
  }

  private saveToDb(db: SQLJsDatabase<typeof dbSchema>, name: string): boolean {
    // Upsert: delete old save with same name, insert new one
    const existing = db.select().from(dbSchema.saves).where(eq(dbSchema.saves.name, name)).get();
    if (existing) {
      db.delete(dbSchema.buildings).where(eq(dbSchema.buildings.saveId, existing.id)).run();
      db.delete(dbSchema.resources).where(eq(dbSchema.resources.saveId, existing.id)).run();
      db.delete(dbSchema.chronology).where(eq(dbSchema.chronology.saveId, existing.id)).run();
      db.delete(dbSchema.quotas).where(eq(dbSchema.quotas.saveId, existing.id)).run();
      db.delete(dbSchema.saves).where(eq(dbSchema.saves.id, existing.id)).run();
    }

    const save = db
      .insert(dbSchema.saves)
      .values({
        name,
        timestamp: Date.now(),
        version: '1.0.0',
      })
      .returning()
      .get();

    if (!save) return false;

    db.insert(dbSchema.resources)
      .values({
        saveId: save.id,
        money: this.gameState.money,
        food: this.gameState.food,
        vodka: this.gameState.vodka,
        power: this.gameState.power,
        powerUsed: this.gameState.powerUsed,
        population: this.gameState.pop,
      })
      .run();

    db.insert(dbSchema.chronology)
      .values({
        saveId: save.id,
        year: this.gameState.date.year,
        month: this.gameState.date.month,
        tick: this.gameState.date.tick,
      })
      .run();

    db.insert(dbSchema.quotas)
      .values({
        saveId: save.id,
        type: this.gameState.quota.type,
        target: this.gameState.quota.target,
        current: this.gameState.quota.current,
        deadlineYear: this.gameState.quota.deadlineYear,
      })
      .run();

    // Insert buildings in batch
    if (this.gameState.buildings.length > 0) {
      db.insert(dbSchema.buildings)
        .values(
          this.gameState.buildings.map((b) => ({
            saveId: save.id,
            gridX: b.x,
            gridY: b.y,
            type: b.type,
            powered: b.powered,
          }))
        )
        .run();
    }

    // Persist SQLite to IndexedDB (fire-and-forget)
    persistToIndexedDB();

    return true;
  }

  private loadFromDb(db: SQLJsDatabase<typeof dbSchema>, name: string): boolean {
    const save = db.select().from(dbSchema.saves).where(eq(dbSchema.saves.name, name)).get();
    if (!save) return false;

    const res = db
      .select()
      .from(dbSchema.resources)
      .where(eq(dbSchema.resources.saveId, save.id))
      .get();
    if (res) {
      this.gameState.money = res.money;
      this.gameState.food = res.food;
      this.gameState.vodka = res.vodka;
      this.gameState.power = res.power;
      this.gameState.powerUsed = res.powerUsed;
      this.gameState.pop = res.population;
    }

    const chrono = db
      .select()
      .from(dbSchema.chronology)
      .where(eq(dbSchema.chronology.saveId, save.id))
      .get();
    if (chrono) {
      this.gameState.date = { year: chrono.year, month: chrono.month, tick: chrono.tick };
    }

    const quota = db
      .select()
      .from(dbSchema.quotas)
      .where(eq(dbSchema.quotas.saveId, save.id))
      .get();
    if (quota) {
      this.gameState.quota = {
        type: quota.type,
        target: quota.target,
        current: quota.current,
        deadlineYear: quota.deadlineYear,
      };
    }

    const savedBuildings = db
      .select()
      .from(dbSchema.buildings)
      .where(eq(dbSchema.buildings.saveId, save.id))
      .all();
    this.gameState.buildings = savedBuildings.map(
      (b: { gridX: number; gridY: number; type: string; powered: boolean }) => ({
        x: b.gridX,
        y: b.gridY,
        type: b.type,
        powered: b.powered,
      })
    );

    // Clear stale grid cells before restoring buildings
    this.gameState.resetGrid();

    // Update grid cells (restore full footprint, not just origin)
    for (const b of savedBuildings) {
      const fp = getFootprint(b.type);
      for (let dx = 0; dx < fp.w; dx++) {
        for (let dy = 0; dy < fp.h; dy++) {
          this.gameState.setCell(b.gridX + dx, b.gridY + dy, b.type);
        }
      }
    }

    return true;
  }

  // ── localStorage fallback ──────────────────────────────────────────────

  private saveToLocalStorage(): boolean {
    const saveData: SaveData = {
      version: '1.0.0',
      timestamp: Date.now(),
      money: this.gameState.money,
      pop: this.gameState.pop,
      food: this.gameState.food,
      vodka: this.gameState.vodka,
      power: this.gameState.power,
      powerUsed: this.gameState.powerUsed,
      date: { ...this.gameState.date },
      buildings: this.gameState.buildings.map((b) => ({
        x: b.x,
        y: b.y,
        type: b.type,
        powered: b.powered,
      })),
      quota: { ...this.gameState.quota },
    };
    localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(saveData));
    return true;
  }

  private loadFromLocalStorage(): boolean {
    const savedData = localStorage.getItem(LOCALSTORAGE_KEY);
    if (!savedData) return false;

    const data: SaveData = JSON.parse(savedData);
    this.gameState.money = data.money;
    this.gameState.pop = data.pop;
    this.gameState.food = data.food;
    this.gameState.vodka = data.vodka;
    this.gameState.power = data.power;
    this.gameState.powerUsed = data.powerUsed;
    this.gameState.date = { ...data.date };
    this.gameState.quota = { ...data.quota };

    this.gameState.buildings = data.buildings.map((b) => ({
      x: b.x,
      y: b.y,
      type: b.type,
      powered: b.powered,
    }));

    // Clear stale grid cells before restoring buildings
    this.gameState.resetGrid();

    for (const b of data.buildings) {
      const fp = getFootprint(b.type);
      for (let dx = 0; dx < fp.w; dx++) {
        for (let dy = 0; dy < fp.h; dy++) {
          this.gameState.setCell(b.x + dx, b.y + dy, b.type);
        }
      }
    }

    return true;
  }
}
