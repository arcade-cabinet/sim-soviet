/**
 * SaveSystem — game persistence via Drizzle ORM + sql.js (SQLite).
 *
 * Saves/loads game state from ECS to an in-memory SQLite database that is
 * persisted to IndexedDB between sessions.
 *
 * Falls back to localStorage if the database isn't initialized
 * (e.g., during tests or if sql.js Wasm fails to load).
 *
 * The `game_state` JSON column stores ALL extended state (subsystems,
 * all 14 resource fields, game config, durability, etc.) as a single blob.
 */
import { eq } from 'drizzle-orm';
import type { SQLJsDatabase } from 'drizzle-orm/sql-js';
import { getDatabase, persistToIndexedDB } from '@/db/provider';
import * as dbSchema from '@/db/schema';
import {
  buildingsLogic,
  decayableBuildings,
  getMetaEntity,
  getResourceEntity,
} from '@/ecs/archetypes';
import { createBuilding } from '@/ecs/factories';
import type { Resources } from '@/ecs/world';
import { world } from '@/ecs/world';
import { getFootprint } from '@/game/BuildingFootprints';
import type { GameGrid } from './GameGrid';
import type { SimulationEngine, SubsystemSaveData } from './SimulationEngine';

const LOCALSTORAGE_KEY = 'simsoviet_save_v2';

/** Module-level flag to log SQLite fallback warning only once. */
let _sqliteWarningLogged = false;

/** Shape of building data in save files. */
interface BuildingSaveEntry {
  x: number;
  y: number;
  defId: string;
  powered: boolean;
  level?: number;
  durability?: { current: number; decayRate: number };
}

/** Full game state blob stored as JSON in the game_state column. */
export interface ExtendedSaveData {
  version: string;
  timestamp: number;
  resources: Resources;
  gameMeta: {
    seed: string;
    date: { year: number; month: number; tick: number };
    quota: { type: string; target: number; current: number; deadlineYear: number };
    settlementTier: string;
    blackMarks: number;
    commendations: number;
    threatLevel: string;
    currentEra: string;
    leaderName?: string;
    leaderPersonality?: string;
  };
  buildings: BuildingSaveEntry[];
  subsystems?: SubsystemSaveData;
  gameConfig?: {
    difficulty?: string;
    consequence?: string;
    seed?: string;
    mapSize?: string;
    playerName?: string;
    cityName?: string;
    startEra?: string;
  };
}

export class SaveSystem {
  private autoSaveTimer: ReturnType<typeof setInterval> | null = null;
  private engine: SimulationEngine | null = null;

  constructor(private grid: GameGrid) {}

  /** Set the simulation engine reference (needed for subsystem serialization). */
  public setEngine(engine: SimulationEngine): void {
    this.engine = engine;
  }

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
    } catch (error) {
      console.error('[SaveSystem] hasSave failed:', error);
      return false;
    }
  }

  /** Check if any save exists (autosave or manual). */
  public async hasAnySave(): Promise<boolean> {
    try {
      const db = this.tryGetDb();
      if (db) {
        const rows = db.select().from(dbSchema.saves).all();
        return rows.length > 0;
      }
      return localStorage.getItem(LOCALSTORAGE_KEY) !== null;
    } catch (error) {
      console.error('[SaveSystem] hasAnySave failed:', error);
      return false;
    }
  }

  /** List all save names. */
  public async listSaves(): Promise<string[]> {
    try {
      const db = this.tryGetDb();
      if (db) {
        const rows = db.select({ name: dbSchema.saves.name }).from(dbSchema.saves).all();
        return rows.map((r) => r.name);
      }
      return localStorage.getItem(LOCALSTORAGE_KEY) !== null ? ['autosave'] : [];
    } catch (error) {
      console.error('[SaveSystem] listSaves failed:', error);
      return [];
    }
  }

  /** Get timestamp of the most recent save. */
  public async getLastSaveTime(): Promise<number | undefined> {
    try {
      const db = this.tryGetDb();
      if (db) {
        const rows = db.select({ timestamp: dbSchema.saves.timestamp }).from(dbSchema.saves).all();
        if (rows.length === 0) return undefined;
        return Math.max(...rows.map((r) => r.timestamp));
      }
      const raw = localStorage.getItem(LOCALSTORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        return data.timestamp;
      }
      return undefined;
    } catch (error) {
      console.error('[SaveSystem] getLastSaveTime failed:', error);
      return undefined;
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

  // ── State Collection ──────────────────────────────────────────────────

  /** Collect the full extended game state from ECS + subsystems. */
  private collectExtendedState(): ExtendedSaveData | null {
    const res = getResourceEntity();
    const meta = getMetaEntity();
    if (!res || !meta) return null;

    const ecsBuildings = buildingsLogic.entities;
    const durabilityMap = new Map<string, { current: number; decayRate: number }>();
    for (const e of decayableBuildings.entities) {
      const key = `${e.building.defId}:${(e as { position?: { gridX: number; gridY: number } }).position?.gridX ?? 0},${(e as { position?: { gridX: number; gridY: number } }).position?.gridY ?? 0}`;
      durabilityMap.set(key, {
        current: e.durability.current,
        decayRate: e.durability.decayRate,
      });
    }

    const buildings: BuildingSaveEntry[] = ecsBuildings.map((e) => {
      const key = `${e.building.defId}:${e.position.gridX},${e.position.gridY}`;
      return {
        x: e.position.gridX,
        y: e.position.gridY,
        defId: e.building.defId,
        powered: e.building.powered,
        level: e.building.level ?? 0,
        durability: durabilityMap.get(key),
      };
    });

    const data: ExtendedSaveData = {
      version: '2.0.0',
      timestamp: Date.now(),
      resources: { ...res.resources },
      gameMeta: {
        seed: meta.gameMeta.seed,
        date: { ...meta.gameMeta.date },
        quota: { ...meta.gameMeta.quota },
        settlementTier: meta.gameMeta.settlementTier,
        blackMarks: meta.gameMeta.blackMarks,
        commendations: meta.gameMeta.commendations,
        threatLevel: meta.gameMeta.threatLevel,
        currentEra: meta.gameMeta.currentEra,
        leaderName: meta.gameMeta.leaderName,
        leaderPersonality: meta.gameMeta.leaderPersonality,
      },
      buildings,
    };

    // Serialize subsystems if engine is available
    if (this.engine) {
      data.subsystems = this.engine.serializeSubsystems();
    }

    return data;
  }

  /** Restore the full extended game state to ECS + subsystems. */
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: restoring many subsystem states requires sequential field assignment
  private restoreExtendedState(data: ExtendedSaveData): boolean {
    const res = getResourceEntity();
    const meta = getMetaEntity();
    if (!res || !meta) return false;

    // Restore all 14 resource fields
    const r = res.resources;
    r.money = data.resources.money ?? 0;
    r.food = data.resources.food ?? 0;
    r.vodka = data.resources.vodka ?? 0;
    r.power = data.resources.power ?? 0;
    r.powerUsed = data.resources.powerUsed ?? 0;
    r.population = data.resources.population ?? 0;
    r.trudodni = data.resources.trudodni ?? 0;
    r.blat = data.resources.blat ?? 10;
    r.timber = data.resources.timber ?? 0;
    r.steel = data.resources.steel ?? 0;
    r.cement = data.resources.cement ?? 0;
    r.prefab = data.resources.prefab ?? 0;
    r.seedFund = data.resources.seedFund ?? 1.0;
    r.emergencyReserve = data.resources.emergencyReserve ?? 0;
    r.storageCapacity = data.resources.storageCapacity ?? 200;

    // Restore game meta
    const gm = data.gameMeta;
    meta.gameMeta.seed = gm.seed;
    meta.gameMeta.date = { ...gm.date };
    meta.gameMeta.quota = { ...gm.quota };
    meta.gameMeta.settlementTier = gm.settlementTier as typeof meta.gameMeta.settlementTier;
    meta.gameMeta.blackMarks = gm.blackMarks;
    meta.gameMeta.commendations = gm.commendations;
    meta.gameMeta.threatLevel = gm.threatLevel;
    meta.gameMeta.currentEra = gm.currentEra;
    meta.gameMeta.leaderName = gm.leaderName;
    meta.gameMeta.leaderPersonality = gm.leaderPersonality;

    // Clear existing ECS buildings
    for (const entity of [...buildingsLogic.entities]) {
      world.remove(entity);
    }

    // Clear grid and restore from save
    this.grid.resetGrid();

    for (const b of data.buildings) {
      const entity = createBuilding(b.x, b.y, b.defId);
      // Restore level if present
      if (entity.building && b.level != null) {
        entity.building.level = b.level;
      }
      // Restore durability if present
      if (b.durability && entity.durability) {
        entity.durability.current = b.durability.current;
        entity.durability.decayRate = b.durability.decayRate;
      }
      const fp = getFootprint(b.defId);
      for (let dx = 0; dx < fp.w; dx++) {
        for (let dy = 0; dy < fp.h; dy++) {
          this.grid.setCell(b.x + dx, b.y + dy, b.defId);
        }
      }
    }

    // Restore subsystems if engine is available and data has subsystem state
    if (this.engine && data.subsystems) {
      this.engine.restoreSubsystems(data.subsystems);
    }

    return true;
  }

  // ── SQLite (Drizzle) persistence ──────────────────────────────────────

  private tryGetDb(): SQLJsDatabase<typeof dbSchema> | null {
    try {
      return getDatabase();
    } catch (error) {
      if (!_sqliteWarningLogged) {
        console.warn('[SaveSystem] SQLite unavailable, using localStorage fallback:', error);
        _sqliteWarningLogged = true;
      }
      return null;
    }
  }

  private saveToDb(db: SQLJsDatabase<typeof dbSchema>, name: string): boolean {
    const extendedState = this.collectExtendedState();
    if (!extendedState) return false;

    const res = getResourceEntity();
    const meta = getMetaEntity();
    if (!res || !meta) return false;

    // Atomic upsert: wrap in transaction to prevent partial writes on interrupt
    db.transaction((tx) => {
      // Delete old save with same name
      const existing = tx.select().from(dbSchema.saves).where(eq(dbSchema.saves.name, name)).get();
      if (existing) {
        tx.delete(dbSchema.buildings).where(eq(dbSchema.buildings.saveId, existing.id)).run();
        tx.delete(dbSchema.resources).where(eq(dbSchema.resources.saveId, existing.id)).run();
        tx.delete(dbSchema.chronology).where(eq(dbSchema.chronology.saveId, existing.id)).run();
        tx.delete(dbSchema.quotas).where(eq(dbSchema.quotas.saveId, existing.id)).run();
        tx.delete(dbSchema.saves).where(eq(dbSchema.saves.id, existing.id)).run();
      }

      const save = tx
        .insert(dbSchema.saves)
        .values({
          name,
          timestamp: Date.now(),
          version: '2.0.0',
          gameState: JSON.stringify(extendedState),
        })
        .returning()
        .get();

      if (!save) return;

      // Also write legacy tables for backward compatibility
      tx.insert(dbSchema.resources)
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

      tx.insert(dbSchema.chronology)
        .values({
          saveId: save.id,
          year: meta.gameMeta.date.year,
          month: meta.gameMeta.date.month,
          tick: meta.gameMeta.date.tick,
        })
        .run();

      tx.insert(dbSchema.quotas)
        .values({
          saveId: save.id,
          type: meta.gameMeta.quota.type,
          target: meta.gameMeta.quota.target,
          current: meta.gameMeta.quota.current,
          deadlineYear: meta.gameMeta.quota.deadlineYear,
        })
        .run();

      const ecsBuildings = buildingsLogic.entities;
      if (ecsBuildings.length > 0) {
        tx.insert(dbSchema.buildings)
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
    });

    // Persist SQLite to IndexedDB (fire-and-forget)
    persistToIndexedDB();

    return true;
  }

  private loadFromDb(db: SQLJsDatabase<typeof dbSchema>, name: string): boolean {
    const save = db.select().from(dbSchema.saves).where(eq(dbSchema.saves.name, name)).get();
    if (!save) return false;

    // Prefer the JSON blob if available (version 2.0.0+)
    if (save.gameState) {
      try {
        const extendedState: ExtendedSaveData = JSON.parse(save.gameState);
        return this.restoreExtendedState(extendedState);
      } catch (error) {
        console.warn('Failed to parse game_state JSON, falling back to legacy tables:', error);
      }
    }

    // Legacy table-based load (v1.0.0 saves without game_state)
    return this.loadFromDbLegacy(db, save.id);
  }

  /** Load from legacy per-table format (pre-v2.0.0 saves). */
  private loadFromDbLegacy(db: SQLJsDatabase<typeof dbSchema>, saveId: number): boolean {
    const res = getResourceEntity();
    const meta = getMetaEntity();
    if (!res || !meta) return false;

    const dbRes = db
      .select()
      .from(dbSchema.resources)
      .where(eq(dbSchema.resources.saveId, saveId))
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
      .where(eq(dbSchema.chronology.saveId, saveId))
      .get();
    if (chrono) {
      meta.gameMeta.date = {
        year: chrono.year,
        month: chrono.month,
        tick: chrono.tick,
      };
    }

    const quota = db.select().from(dbSchema.quotas).where(eq(dbSchema.quotas.saveId, saveId)).get();
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
      .where(eq(dbSchema.buildings.saveId, saveId))
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
    const extendedState = this.collectExtendedState();
    if (!extendedState) return false;

    localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(extendedState));
    return true;
  }

  private loadFromLocalStorage(): boolean {
    const savedData = localStorage.getItem(LOCALSTORAGE_KEY);
    if (!savedData) return false;

    try {
      const data: ExtendedSaveData = JSON.parse(savedData);
      return this.restoreExtendedState(data);
    } catch (error) {
      console.error('Failed to parse localStorage save data:', error);
      return false;
    }
  }
}
