/**
 * SaveSystem — game persistence via Drizzle ORM + sql.js (SQLite).
 *
 * Saves/loads game state from ECS to an in-memory SQLite database that is
 * persisted to IndexedDB between sessions.
 *
 * Falls back to localStorage if the database isn't initialized
 * (e.g., during tests or if sql.js Wasm fails to load).
 */
import { eq } from 'drizzle-orm';
import type { SQLJsDatabase } from 'drizzle-orm/sql-js';
import { getDatabase, persistToIndexedDB } from '@/db/provider';
import * as dbSchema from '@/db/schema';
import { buildingsLogic, getMetaEntity, getResourceEntity } from '@/ecs/archetypes';
import { createBuilding } from '@/ecs/factories';
import { world } from '@/ecs/world';
import { getFootprint } from '@/game/BuildingFootprints';
import type { GameGrid } from './GameGrid';

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
  buildings: Array<{ x: number; y: number; defId: string; powered: boolean }>;
  quota: { type: string; target: number; current: number; deadlineYear: number };
}

export class SaveSystem {
  private autoSaveTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private grid: GameGrid) {}

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
    const res = getResourceEntity();
    const meta = getMetaEntity();
    if (!res || !meta) return false;

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
        money: res.resources.money,
        food: res.resources.food,
        vodka: res.resources.vodka,
        power: res.resources.power,
        powerUsed: res.resources.powerUsed,
        population: res.resources.population,
      })
      .run();

    db.insert(dbSchema.chronology)
      .values({
        saveId: save.id,
        year: meta.gameMeta.date.year,
        month: meta.gameMeta.date.month,
        tick: meta.gameMeta.date.tick,
      })
      .run();

    db.insert(dbSchema.quotas)
      .values({
        saveId: save.id,
        type: meta.gameMeta.quota.type,
        target: meta.gameMeta.quota.target,
        current: meta.gameMeta.quota.current,
        deadlineYear: meta.gameMeta.quota.deadlineYear,
      })
      .run();

    // Insert buildings from ECS
    const ecsBuildings = buildingsLogic.entities;
    if (ecsBuildings.length > 0) {
      db.insert(dbSchema.buildings)
        .values(
          ecsBuildings.map((e) => ({
            saveId: save.id,
            gridX: e.position.gridX,
            gridY: e.position.gridY,
            type: e.building.defId,
            powered: e.building.powered,
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

    const res = getResourceEntity();
    const meta = getMetaEntity();
    if (!res || !meta) return false;

    const dbRes = db
      .select()
      .from(dbSchema.resources)
      .where(eq(dbSchema.resources.saveId, save.id))
      .get();
    if (dbRes) {
      res.resources.money = dbRes.money;
      res.resources.food = dbRes.food;
      res.resources.vodka = dbRes.vodka;
      res.resources.power = dbRes.power;
      res.resources.powerUsed = dbRes.powerUsed;
      res.resources.population = dbRes.population;
    }

    const chrono = db
      .select()
      .from(dbSchema.chronology)
      .where(eq(dbSchema.chronology.saveId, save.id))
      .get();
    if (chrono) {
      meta.gameMeta.date = { year: chrono.year, month: chrono.month, tick: chrono.tick };
    }

    const quota = db
      .select()
      .from(dbSchema.quotas)
      .where(eq(dbSchema.quotas.saveId, save.id))
      .get();
    if (quota) {
      meta.gameMeta.quota = {
        type: quota.type,
        target: quota.target,
        current: quota.current,
        deadlineYear: quota.deadlineYear,
      };
    }

    // Clear existing ECS buildings
    for (const entity of [...buildingsLogic.entities]) {
      world.remove(entity);
    }

    // Clear grid and restore from save
    this.grid.resetGrid();

    const savedBuildings = db
      .select()
      .from(dbSchema.buildings)
      .where(eq(dbSchema.buildings.saveId, save.id))
      .all();

    for (const b of savedBuildings) {
      createBuilding(b.gridX, b.gridY, b.type);
      const fp = getFootprint(b.type);
      for (let dx = 0; dx < fp.w; dx++) {
        for (let dy = 0; dy < fp.h; dy++) {
          this.grid.setCell(b.gridX + dx, b.gridY + dy, b.type);
        }
      }
    }

    return true;
  }

  // ── localStorage fallback ──────────────────────────────────────────────

  private saveToLocalStorage(): boolean {
    const res = getResourceEntity();
    const meta = getMetaEntity();
    if (!res || !meta) return false;

    const ecsBuildings = buildingsLogic.entities;
    const saveData: SaveData = {
      version: '1.0.0',
      timestamp: Date.now(),
      money: res.resources.money,
      pop: res.resources.population,
      food: res.resources.food,
      vodka: res.resources.vodka,
      power: res.resources.power,
      powerUsed: res.resources.powerUsed,
      date: { ...meta.gameMeta.date },
      buildings: ecsBuildings.map((e) => ({
        x: e.position.gridX,
        y: e.position.gridY,
        defId: e.building.defId,
        powered: e.building.powered,
      })),
      quota: { ...meta.gameMeta.quota },
    };
    localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(saveData));
    return true;
  }

  private loadFromLocalStorage(): boolean {
    const savedData = localStorage.getItem(LOCALSTORAGE_KEY);
    if (!savedData) return false;

    const data: SaveData = JSON.parse(savedData);
    const res = getResourceEntity();
    const meta = getMetaEntity();
    if (!res || !meta) return false;

    res.resources.money = data.money;
    res.resources.population = data.pop;
    res.resources.food = data.food;
    res.resources.vodka = data.vodka;
    res.resources.power = data.power;
    res.resources.powerUsed = data.powerUsed;
    meta.gameMeta.date = { ...data.date };
    meta.gameMeta.quota = { ...data.quota };

    // Clear existing ECS buildings
    for (const entity of [...buildingsLogic.entities]) {
      world.remove(entity);
    }

    // Clear grid and restore from save
    this.grid.resetGrid();

    for (const b of data.buildings) {
      createBuilding(b.x, b.y, b.defId);
      const fp = getFootprint(b.defId);
      for (let dx = 0; dx < fp.w; dx++) {
        for (let dy = 0; dy < fp.h; dy++) {
          this.grid.setCell(b.x + dx, b.y + dy, b.defId);
        }
      }
    }

    return true;
  }
}
