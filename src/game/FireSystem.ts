/**
 * FireSystem — mechanical fire spread, damage, and zeppelin firefighting.
 *
 * Responsibilities:
 *   1. Fire spread: burning buildings ignite neighbors (Manhattan dist <= 2)
 *   2. Fire damage: burning buildings lose durability each tick
 *   3. Fire duration: fires self-extinguish after 30-60 ticks
 *   4. Fire-station suppression: reduces spread chance in radius by 80%
 *   5. Rain weather: reduces spread chance and fire duration by 50%
 *   6. Building collapse: health 0 → remove from grid + ECS
 *   7. Zeppelin firefighting AI: spawn, fly to fire, extinguish, despawn
 *
 * Wired into SimulationEngine after EventSystem and before PersonnelFile.
 * Fire state is tracked on ECS BuildingComponent (onFire, fireTicksRemaining)
 * and synced to gameState.grid[y][x].onFire for the 3D renderers.
 */

import type { With } from 'miniplex';
import { GRID_SIZE } from '@/config';
import { buildingsLogic, operationalBuildings } from '@/ecs/archetypes';
import type { Entity } from '@/ecs/world';
import { world } from '@/ecs/world';

import type { GameGrid } from './GameGrid';
import type { GameRng } from './SeedSystem';
import { WeatherType } from './WeatherSystem';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Base chance per tick that fire spreads to an adjacent building. */
const SPREAD_CHANCE_BASE = 0.05;

/** Manhattan distance within which fire can spread. */
const SPREAD_RADIUS = 2;

/** Fire-station suppression factor (80% reduction). */
const FIRE_STATION_SUPPRESSION = 0.2;

/** Radius (Manhattan) in which a fire station suppresses fire spread. */
const FIRE_STATION_RADIUS = 5;

/** Minimum fire duration in ticks. */
const FIRE_DURATION_MIN = 30;

/** Maximum fire duration in ticks. */
const FIRE_DURATION_MAX = 60;

/** Durability damage per tick while on fire. */
const FIRE_DAMAGE_PER_TICK = 3;

/** Rain reduces spread chance and fire duration by this factor. */
const RAIN_FACTOR = 0.5;

/** Maximum concurrent zeppelins. */
const MAX_ZEPPELINS = 2;

/** Ticks it takes a zeppelin to extinguish a fire once it arrives. */
const ZEPPELIN_EXTINGUISH_TICKS = 5;

/** Zeppelin movement speed in grid units per tick. */
const ZEPPELIN_SPEED = 0.5;

/** Distance threshold at which a zeppelin is "over" its target. */
const ZEPPELIN_ARRIVAL_DIST = 1.0;

// ─── Types ───────────────────────────────────────────────────────────────────

type BuildingEntity = With<Entity, 'position' | 'building'>;

export interface ZeppelinState {
  /** Current grid X position */
  x: number;
  /** Current grid Y position */
  y: number;
  /** Target grid X */
  tx: number;
  /** Target grid Y */
  ty: number;
  /** Phase of the zeppelin mission */
  phase: 'flying' | 'extinguishing' | 'returning';
  /** Ticks spent extinguishing */
  extinguishTicks: number;
}

export interface FireSystemSaveData {
  zeppelins: ZeppelinState[];
}

// ─── Callbacks ───────────────────────────────────────────────────────────────

export interface FireSystemCallbacks {
  onBuildingCollapsed?: (gridX: number, gridY: number, defId: string) => void;
  onFireStarted?: (gridX: number, gridY: number) => void;
  onFireExtinguished?: (gridX: number, gridY: number) => void;
}

// ─── System ──────────────────────────────────────────────────────────────────

export class FireSystem {
  private zeppelins: ZeppelinState[] = [];
  private rng: GameRng | null = null;
  private callbacks: FireSystemCallbacks = {};

  constructor(rng?: GameRng, callbacks?: FireSystemCallbacks) {
    if (rng) this.rng = rng;
    if (callbacks) this.callbacks = callbacks;
  }

  /** Set the seeded RNG (for deterministic simulation). */
  setRng(rng: GameRng): void {
    this.rng = rng;
  }

  /** Set callbacks for fire events. */
  setCallbacks(callbacks: FireSystemCallbacks): void {
    this.callbacks = callbacks;
  }

  /** Get current zeppelin states (for rendering). */
  getZeppelins(): ReadonlyArray<ZeppelinState> {
    return this.zeppelins;
  }

  /** Get count of buildings currently on fire. */
  getActiveFireCount(): number {
    let count = 0;
    for (const entity of buildingsLogic.entities) {
      if (entity.building.onFire) count++;
    }
    return count;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Ignite a specific building by grid position.
   * Called by EventSystem when a fire event triggers.
   */
  igniteAt(gridX: number, gridY: number): boolean {
    const entity = this.findBuildingAt(gridX, gridY);
    if (!entity) return false;
    if (entity.building.onFire) return false; // already burning

    this.startFire(entity);
    return true;
  }

  /**
   * Ignite a random building on the map.
   * Returns true if a building was successfully ignited.
   */
  igniteRandom(): boolean {
    const candidates = buildingsLogic.entities.filter((e) => !e.building.onFire && this.isBuildingOperational(e));
    if (candidates.length === 0) return false;

    const target = this.rng ? this.rng.pick(candidates) : candidates[Math.floor(Math.random() * candidates.length)]!;
    this.startFire(target);
    return true;
  }

  /**
   * Main tick — called once per simulation tick.
   *
   * @param weather Current weather type (for rain detection)
   * @param grid GameGrid for clearing collapsed building cells
   */
  tick(weather: WeatherType, grid: GameGrid): void {
    const isRaining = weather === WeatherType.RAIN || weather === WeatherType.MUD_STORM;
    const spreadMult = isRaining ? RAIN_FACTOR : 1.0;
    const durationMult = isRaining ? RAIN_FACTOR : 1.0;

    // Build fire-station coverage map (set of position keys within radius)
    const stationCoverage = this.buildFireStationCoverage();

    // Process all burning buildings
    const burningEntities: BuildingEntity[] = [];
    for (const entity of buildingsLogic.entities) {
      if (entity.building.onFire) {
        burningEntities.push(entity);
      }
    }

    const toCollapse: BuildingEntity[] = [];
    const toExtinguish: BuildingEntity[] = [];

    for (const entity of burningEntities) {
      const b = entity.building;

      // 1. Decrement fire duration
      if (b.fireTicksRemaining != null && b.fireTicksRemaining > 0) {
        // Rain accelerates burn-out (duration was already halved at ignition if raining,
        // but ongoing rain also ticks down faster)
        const decrement = isRaining ? 2 : 1;
        b.fireTicksRemaining = Math.max(0, b.fireTicksRemaining - decrement);

        if (b.fireTicksRemaining <= 0) {
          toExtinguish.push(entity);
          continue;
        }
      }

      // 2. Apply fire damage to durability
      if (entity.durability) {
        entity.durability.current = Math.max(0, entity.durability.current - FIRE_DAMAGE_PER_TICK);
        if (entity.durability.current <= 0) {
          toCollapse.push(entity);
          continue;
        }
      }

      // 3. Fire spread to adjacent buildings
      const { gridX, gridY } = entity.position;
      for (let dy = -SPREAD_RADIUS; dy <= SPREAD_RADIUS; dy++) {
        for (let dx = -SPREAD_RADIUS; dx <= SPREAD_RADIUS; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (Math.abs(dx) + Math.abs(dy) > SPREAD_RADIUS) continue;

          const nx = gridX + dx;
          const ny = gridY + dy;
          if (nx < 0 || ny < 0 || nx >= GRID_SIZE || ny >= GRID_SIZE) continue;

          const neighbor = this.findBuildingAt(nx, ny);
          if (!neighbor || neighbor.building.onFire) continue;
          if (!this.isBuildingOperational(neighbor)) continue;

          // Calculate spread chance
          let chance = SPREAD_CHANCE_BASE * spreadMult;

          // Fire station suppression
          const key = `${nx}_${ny}`;
          if (stationCoverage.has(key)) {
            chance *= FIRE_STATION_SUPPRESSION;
          }

          const roll = this.rng ? this.rng.random() : Math.random();
          if (roll < chance) {
            this.startFire(neighbor, durationMult);
          }
        }
      }
    }

    // 4. Process extinguished fires
    for (const entity of toExtinguish) {
      this.extinguishFire(entity);
    }

    // 5. Process collapsed buildings
    for (const entity of toCollapse) {
      this.collapseBuilding(entity, grid);
    }

    // 6. Zeppelin AI
    this.tickZeppelins(grid);
  }

  // ── Zeppelin AI ────────────────────────────────────────────────────────────

  private tickZeppelins(_grid: GameGrid): void {
    // Check if fire stations exist (operational + powered)
    const hasFireStation = operationalBuildings.entities.some(
      (e) => e.building.defId === 'fire-station' && e.building.powered,
    );

    // Find burning buildings for targeting
    const burningBuildings: BuildingEntity[] = [];
    for (const entity of buildingsLogic.entities) {
      if (entity.building.onFire) {
        burningBuildings.push(entity);
      }
    }

    // Spawn new zeppelins if needed
    if (hasFireStation && burningBuildings.length > 0) {
      while (this.zeppelins.length < MAX_ZEPPELINS && burningBuildings.length > 0) {
        // Find fire station position for launch point
        const fireStation = operationalBuildings.entities.find(
          (e) => e.building.defId === 'fire-station' && e.building.powered,
        );
        if (!fireStation) break;

        // Pick a target fire that no other zeppelin is already targeting
        const targetedPositions = new Set(
          this.zeppelins.filter((z) => z.phase !== 'returning').map((z) => `${z.tx}_${z.ty}`),
        );
        const untargeted = burningBuildings.filter(
          (b) => !targetedPositions.has(`${b.position.gridX}_${b.position.gridY}`),
        );
        if (untargeted.length === 0) break;

        const target = this.rng ? this.rng.pick(untargeted) : untargeted[0]!;

        this.zeppelins.push({
          x: fireStation.position.gridX,
          y: fireStation.position.gridY,
          tx: target.position.gridX,
          ty: target.position.gridY,
          phase: 'flying',
          extinguishTicks: 0,
        });
      }
    }

    // Update existing zeppelins
    const toRemove: number[] = [];

    for (let i = 0; i < this.zeppelins.length; i++) {
      const z = this.zeppelins[i]!;

      switch (z.phase) {
        case 'flying': {
          // Move toward target
          const dx = z.tx - z.x;
          const dy = z.ty - z.y;
          const dist = Math.hypot(dx, dy);

          if (dist <= ZEPPELIN_ARRIVAL_DIST) {
            z.phase = 'extinguishing';
            z.extinguishTicks = 0;
          } else {
            z.x += (dx / dist) * ZEPPELIN_SPEED;
            z.y += (dy / dist) * ZEPPELIN_SPEED;
          }

          // If target fire is already out, retarget or return
          const targetEntity = this.findBuildingAt(Math.round(z.tx), Math.round(z.ty));
          if (!targetEntity || !targetEntity.building.onFire) {
            // Try to find another fire
            const newTarget = burningBuildings.find(
              (b) => b.position.gridX !== Math.round(z.tx) || b.position.gridY !== Math.round(z.ty),
            );
            if (newTarget) {
              z.tx = newTarget.position.gridX;
              z.ty = newTarget.position.gridY;
            } else {
              z.phase = 'returning';
            }
          }
          break;
        }

        case 'extinguishing': {
          z.extinguishTicks++;
          if (z.extinguishTicks >= ZEPPELIN_EXTINGUISH_TICKS) {
            // Extinguish the fire
            const target = this.findBuildingAt(Math.round(z.tx), Math.round(z.ty));
            if (target?.building.onFire) {
              this.extinguishFire(target);
            }
            z.phase = 'returning';
          }
          break;
        }

        case 'returning': {
          // Return to fire station
          const station = operationalBuildings.entities.find(
            (e) => e.building.defId === 'fire-station' && e.building.powered,
          );
          if (!station) {
            toRemove.push(i);
            break;
          }

          const sx = station.position.gridX;
          const sy = station.position.gridY;
          const dx = sx - z.x;
          const dy = sy - z.y;
          const dist = Math.hypot(dx, dy);

          if (dist <= ZEPPELIN_ARRIVAL_DIST) {
            toRemove.push(i);
          } else {
            z.x += (dx / dist) * ZEPPELIN_SPEED;
            z.y += (dy / dist) * ZEPPELIN_SPEED;
          }
          break;
        }
      }
    }

    // Remove returned zeppelins (reverse order to preserve indices)
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.zeppelins.splice(toRemove[i]!, 1);
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private startFire(entity: BuildingEntity, durationMult = 1.0): void {
    const b = entity.building;
    b.onFire = true;
    const baseDuration = this.rng
      ? this.rng.int(FIRE_DURATION_MIN, FIRE_DURATION_MAX)
      : FIRE_DURATION_MIN + Math.floor(Math.random() * (FIRE_DURATION_MAX - FIRE_DURATION_MIN + 1));
    b.fireTicksRemaining = Math.round(baseDuration * durationMult);
    world.reindex(entity);
    this.callbacks.onFireStarted?.(entity.position.gridX, entity.position.gridY);
  }

  private extinguishFire(entity: BuildingEntity): void {
    entity.building.onFire = false;
    entity.building.fireTicksRemaining = 0;
    world.reindex(entity);
    this.callbacks.onFireExtinguished?.(entity.position.gridX, entity.position.gridY);
  }

  private collapseBuilding(entity: BuildingEntity, grid: GameGrid): void {
    const { gridX, gridY } = entity.position;
    const defId = entity.building.defId;

    // Clear the grid cell
    grid.setCell(gridX, gridY, null);

    // Remove from ECS
    world.remove(entity);

    this.callbacks.onBuildingCollapsed?.(gridX, gridY, defId);
  }

  private findBuildingAt(gridX: number, gridY: number): BuildingEntity | undefined {
    return buildingsLogic.entities.find((e) => e.position.gridX === gridX && e.position.gridY === gridY);
  }

  private isBuildingOperational(entity: BuildingEntity): boolean {
    const phase = entity.building.constructionPhase;
    return phase == null || phase === 'complete';
  }

  /**
   * Build a set of grid position keys ("x_y") that are within the suppression
   * radius of at least one operational, powered fire station.
   */
  private buildFireStationCoverage(): Set<string> {
    const covered = new Set<string>();

    for (const entity of operationalBuildings.entities) {
      if (entity.building.defId !== 'fire-station') continue;
      if (!entity.building.powered) continue;

      const { gridX, gridY } = entity.position;
      for (let dy = -FIRE_STATION_RADIUS; dy <= FIRE_STATION_RADIUS; dy++) {
        for (let dx = -FIRE_STATION_RADIUS; dx <= FIRE_STATION_RADIUS; dx++) {
          if (Math.abs(dx) + Math.abs(dy) > FIRE_STATION_RADIUS) continue;
          const nx = gridX + dx;
          const ny = gridY + dy;
          if (nx >= 0 && ny >= 0 && nx < GRID_SIZE && ny < GRID_SIZE) {
            covered.add(`${nx}_${ny}`);
          }
        }
      }
    }

    return covered;
  }

  // ── Sync to GameState ──────────────────────────────────────────────────────

  /**
   * Sync ECS fire state to the old gameState.grid for the 3D renderers.
   * Called after tick() by SimulationEngine.
   */
  syncToGameState(gameStateGrid: { onFire: number }[][]): void {
    // Reset all fire values
    for (let y = 0; y < GRID_SIZE; y++) {
      const row = gameStateGrid[y];
      if (!row) continue;
      for (let x = 0; x < GRID_SIZE; x++) {
        const cell = row[x];
        if (cell) cell.onFire = 0;
      }
    }

    // Set fire values from ECS
    for (const entity of buildingsLogic.entities) {
      if (!entity.building.onFire) continue;
      const { gridX, gridY } = entity.position;
      const cell = gameStateGrid[gridY]?.[gridX];
      if (cell) {
        // Use fireTicksRemaining as intensity (capped for renderer)
        cell.onFire = Math.max(1, Math.min(entity.building.fireTicksRemaining ?? 1, 15));
      }
    }
  }

  /**
   * Sync zeppelin state to the old gameState.zeppelins for ZeppelinRenderer.
   * Returns the array to assign to gameState.zeppelins.
   */
  getZeppelinRenderState(): Array<{ x: number; y: number; tx: number; ty: number; lx: number; ly: number }> {
    return this.zeppelins.map((z) => ({
      x: z.x,
      y: z.y,
      tx: z.tx,
      ty: z.ty,
      lx: z.x, // legacy fields, not used by current renderer
      ly: z.y,
    }));
  }

  // ── Serialization ──────────────────────────────────────────────────────────

  serialize(): FireSystemSaveData {
    return {
      zeppelins: this.zeppelins.map((z) => ({ ...z })),
    };
  }

  static deserialize(data: FireSystemSaveData, rng?: GameRng, callbacks?: FireSystemCallbacks): FireSystem {
    const system = new FireSystem(rng, callbacks);
    system.zeppelins = data.zeppelins.map((z) => ({ ...z }));
    return system;
  }
}
