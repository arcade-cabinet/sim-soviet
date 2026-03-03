/**
 * @fileoverview DefenseAgent — Yuka agent that absorbs FireSystem + DiseaseSystem.
 *
 * Manages:
 *   - Fire spread, damage, self-extinguish, zeppelin AI (from FireSystem)
 *   - Disease outbreaks, progression, mortality, prevention (from DiseaseSystem)
 *
 * Emits: EMERGENCY_FIRE, EMERGENCY_METEOR, DISEASE_OUTBREAK
 *
 * Fire logic:
 *   - Base spread 5% per tick (SPREAD_CHANCE_BASE = 0.05)
 *   - Fire station suppression: 0.2× within radius 5
 *   - Rain factor: 0.5× spread + faster burn-out
 *   - Damage: 3 durability/tick (FIRE_DAMAGE_PER_TICK)
 *   - Duration: 30-60 ticks (FIRE_DURATION_MIN/MAX)
 *   - Zeppelins: up to 2, spawned from fire station, take 5 ticks to extinguish
 *
 * Disease logic (monthly checks):
 *   - 4 types: typhus (15% mortality), cholera (25%), influenza (5%), scurvy (3%)
 *   - Base outbreak chance: 2% (BASE_OUTBREAK_CHANCE)
 *   - Overcrowding ×2, winter ×1.5, food shortage ×3 for scurvy
 *   - Medical buildings reduce spread multiplicatively (0.4× per building, floor 0.1)
 */

import type { With } from 'miniplex';
import { Vehicle } from 'yuka';
import { GRID_SIZE, social } from '../../../config';
import {
  buildingsLogic,
  citizens,
  getResourceEntity,
  housing as housingArchetype,
  operationalBuildings,
} from '../../../ecs/archetypes';
import type { CitizenDisease, Entity } from '../../../ecs/world';
import { world } from '../../../ecs/world';
import { TICKS_PER_MONTH } from '../../../game/Chronology';
import type { GameGrid } from '../../../game/GameGrid';
import type { GameRng } from '../../../game/SeedSystem';
import { MSG } from '../../telegrams';
import { WeatherType } from '../core/weather-types';
import { DISEASE_PRAVDA_HEADLINES, diseaseTick } from './disease';

// ─── Fire Constants (from config/social.json) ────────────────────────────────

const fcfg = social.fire;

/** Base chance per tick that fire spreads to an adjacent building. */
const SPREAD_CHANCE_BASE = fcfg.spreadChanceBase;

/** Manhattan distance within which fire can spread. */
const SPREAD_RADIUS = fcfg.spreadRadius;

/** Fire-station suppression factor (80% reduction). */
const FIRE_STATION_SUPPRESSION = fcfg.fireStationSuppression;

/** Radius (Manhattan) in which a fire station suppresses fire spread. */
const FIRE_STATION_RADIUS = fcfg.fireStationRadius;

/** Minimum fire duration in ticks. */
const FIRE_DURATION_MIN = fcfg.durationMin;

/** Maximum fire duration in ticks. */
const FIRE_DURATION_MAX = fcfg.durationMax;

/** Durability damage per tick while on fire. */
const FIRE_DAMAGE_PER_TICK = fcfg.damagePerTick;

/** Rain reduces spread chance and fire duration by this factor. */
const RAIN_FACTOR = fcfg.rainFactor;

/** Maximum concurrent zeppelins. */
const MAX_ZEPPELINS = fcfg.maxZeppelins;

/** Ticks it takes a zeppelin to extinguish a fire once it arrives. */
const ZEPPELIN_EXTINGUISH_TICKS = fcfg.zeppelinExtinguishTicks;

/** Zeppelin movement speed in grid units per tick. */
const ZEPPELIN_SPEED = fcfg.zeppelinSpeed;

/** Distance threshold at which a zeppelin is "over" its target. */
const ZEPPELIN_ARRIVAL_DIST = fcfg.zeppelinArrivalDist;

// ─── Disease Constants (from config/social.json) ─────────────────────────────

const ddcfg = social.disease;

/** Base outbreak chance per citizen per month check (2%). */
const BASE_OUTBREAK_CHANCE = ddcfg.baseOutbreakChance;

/** Overcrowding multiplier (pop > housing cap). */
const OVERCROWDING_MULT = ddcfg.overcrowdingMult;

/** Winter multiplier for all non-nutritional diseases. */
const WINTER_MULT = ddcfg.winterMult;

/** Food shortage threshold below which scurvy risk increases. */
const FOOD_SHORTAGE_THRESHOLD = ddcfg.foodShortageThreshold;

/** Food shortage multiplier for scurvy. */
const FOOD_SHORTAGE_SCURVY_MULT = ddcfg.foodShortageScurvyMult;

/** Reduction factor per operational medical building (multiplicative). */
const CLINIC_REDUCTION_PER_BUILDING = ddcfg.clinicReductionPerBuilding;

/** Maximum clinic reduction (floor — clinics can't eliminate disease entirely). */
const MAX_CLINIC_REDUCTION = ddcfg.maxClinicReduction;

// ─── Types ───────────────────────────────────────────────────────────────────

type BuildingEntity = With<Entity, 'position' | 'building'>;

/** Discriminated disease type identifier. */
export type DiseaseType = CitizenDisease['type'];

/** Static definition of a disease: spread/mortality rates, duration, and prevention. */
export interface DiseaseDefinition {
  type: DiseaseType;
  name: string;
  spreadRate: number;
  mortalityRate: number;
  durationTicks: number;
  preventedBy: readonly string[];
  winterOnly: boolean;
  nutritional: boolean;
}

/** State of a firefighting zeppelin: position, target, and mission phase. */
export interface ZeppelinState {
  x: number;
  y: number;
  tx: number;
  ty: number;
  phase: 'flying' | 'extinguishing' | 'returning';
  extinguishTicks: number;
}

/** Emergency state snapshot emitted each update(). */
export interface EmergencyState {
  activeFires: number;
  activeOutbreaks: number;
  zeppelinCount: number;
}

/** Serializable snapshot for save/load. */
export interface DefenseAgentSnapshot {
  zeppelins: ZeppelinState[];
}

// ─── Disease Definitions ──────────────────────────────────────────────────────

/** All four disease types with their epidemiological parameters. */
export const DISEASE_DEFINITIONS: readonly DiseaseDefinition[] = [
  {
    type: 'typhus',
    name: 'Typhus',
    spreadRate: 0.02,
    mortalityRate: 0.02,
    durationTicks: 90,
    preventedBy: ['hospital', 'polyclinic'],
    winterOnly: false,
    nutritional: false,
  },
  {
    type: 'cholera',
    name: 'Cholera',
    spreadRate: 0.01,
    mortalityRate: 0.03,
    durationTicks: 60,
    preventedBy: ['hospital', 'polyclinic'],
    winterOnly: false,
    nutritional: false,
  },
  {
    type: 'influenza',
    name: 'Influenza',
    spreadRate: 0.03,
    mortalityRate: 0.005,
    durationTicks: 30,
    preventedBy: ['hospital', 'polyclinic'],
    winterOnly: true,
    nutritional: false,
  },
  {
    type: 'scurvy',
    name: 'Scurvy',
    spreadRate: 0.02,
    mortalityRate: 0.003,
    durationTicks: 60,
    preventedBy: [],
    winterOnly: false,
    nutritional: true,
  },
] as const;

// ─── Callbacks ────────────────────────────────────────────────────────────────

/** Fire lifecycle callbacks (collapse, start, extinguish). */
export interface DefenseAgentCallbacks {
  onBuildingCollapsed?: (gridX: number, gridY: number, defId: string) => void;
  onFireStarted?: (gridX: number, gridY: number) => void;
  onFireExtinguished?: (gridX: number, gridY: number) => void;
}

// ─── DefenseAgent ─────────────────────────────────────────────────────────────

/**
 * Yuka Vehicle agent that absorbs FireSystem and DiseaseSystem logic.
 *
 * Call `update(delta, weather, grid, totalTicks, month)` once per simulation
 * tick from SimulationEngine.
 *
 * Telegrams emitted:
 *   - MSG.EMERGENCY_FIRE   — when one or more buildings are on fire
 *   - MSG.DISEASE_OUTBREAK — when new disease infections are detected this tick
 *
 * @example
 * const agent = new DefenseAgent(rng, callbacks);
 * agent.igniteAt(5, 7);
 * agent.update(1, WeatherType.CLEAR, grid, 30, 6);
 * const { activeFires } = agent.getEmergencyState();
 */
export class DefenseAgent extends Vehicle {
  private zeppelins: ZeppelinState[] = [];
  private rng: GameRng | null = null;
  private callbacks: DefenseAgentCallbacks = {};
  private emergencyState: EmergencyState = {
    activeFires: 0,
    activeOutbreaks: 0,
    zeppelinCount: 0,
  };

  /** Exported message constants (tests can reference). */
  static readonly MSG = MSG;

  constructor(rng?: GameRng, callbacks?: DefenseAgentCallbacks) {
    super();
    this.name = 'DefenseAgent';
    if (rng) this.rng = rng;
    if (callbacks) this.callbacks = callbacks;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Set the seeded RNG for deterministic simulation. */
  setRng(rng: GameRng): void {
    this.rng = rng;
  }

  /** Set callbacks for fire events. */
  setCallbacks(callbacks: DefenseAgentCallbacks): void {
    this.callbacks = callbacks;
  }

  /** Get current emergency state (fires, outbreaks, zeppelin count). */
  getEmergencyState(): Readonly<EmergencyState> {
    return this.emergencyState;
  }

  /** Get current zeppelin states (for rendering). */
  getZeppelins(): ReadonlyArray<ZeppelinState> {
    return this.zeppelins;
  }

  /** Count of buildings currently on fire. */
  getActiveFireCount(): number {
    let count = 0;
    for (const entity of buildingsLogic.entities) {
      if (entity.building.onFire) count++;
    }
    return count;
  }

  /**
   * Ignite a specific building by grid position.
   * Returns true if a building was found and successfully ignited.
   */
  igniteAt(gridX: number, gridY: number): boolean {
    const entity = this.findBuildingAt(gridX, gridY);
    if (!entity || entity.building.onFire) return false;
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

  // ── Main Tick ───────────────────────────────────────────────────────────────

  /**
   * Main tick — called once per simulation tick from SimulationEngine.
   *
   * Runs fire spread/damage/zeppelin AI and disease progression/outbreaks.
   *
   * @param _delta - Elapsed time (unused; tick-based)
   * @param weather - Current weather type
   * @param grid - GameGrid for clearing collapsed building cells
   * @param totalTicks - Absolute simulation tick counter
   * @param month - Current game month (1-12, for seasonal disease modifiers)
   */
  update(_delta: number, weather: WeatherType, grid: GameGrid, totalTicks: number, month: number): void {
    this.tickFire(weather, grid);
    const outbreakTypes = this.tickDisease(totalTicks, month);

    this.emergencyState = {
      activeFires: this.getActiveFireCount(),
      activeOutbreaks: outbreakTypes.length,
      zeppelinCount: this.zeppelins.length,
    };
  }

  // ── Fire Logic ──────────────────────────────────────────────────────────────

  private tickFire(weather: WeatherType, grid: GameGrid): void {
    const isRaining = weather === WeatherType.RAIN || weather === WeatherType.MUD_STORM;
    const spreadMult = isRaining ? RAIN_FACTOR : 1.0;
    const durationMult = isRaining ? RAIN_FACTOR : 1.0;

    const stationCoverage = this.buildFireStationCoverage();

    const burningEntities: BuildingEntity[] = [];
    for (const entity of buildingsLogic.entities) {
      if (entity.building.onFire) burningEntities.push(entity);
    }

    const toCollapse: BuildingEntity[] = [];
    const toExtinguish: BuildingEntity[] = [];

    for (const entity of burningEntities) {
      const b = entity.building;

      // 1. Decrement fire duration
      if (b.fireTicksRemaining != null && b.fireTicksRemaining > 0) {
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

          let chance = SPREAD_CHANCE_BASE * spreadMult;
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
    this.tickZeppelins(burningEntities);
  }

  // ── Zeppelin AI ─────────────────────────────────────────────────────────────

  private tickZeppelins(burningBuildings: BuildingEntity[]): void {
    const hasFireStation = operationalBuildings.entities.some(
      (e) => e.building.defId === 'fire-station' && e.building.powered,
    );

    // Spawn new zeppelins if needed
    if (hasFireStation && burningBuildings.length > 0) {
      while (this.zeppelins.length < MAX_ZEPPELINS && burningBuildings.length > 0) {
        const fireStation = operationalBuildings.entities.find(
          (e) => e.building.defId === 'fire-station' && e.building.powered,
        );
        if (!fireStation) break;

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

    const toRemove: number[] = [];

    for (let i = 0; i < this.zeppelins.length; i++) {
      const z = this.zeppelins[i]!;

      switch (z.phase) {
        case 'flying': {
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
            const target = this.findBuildingAt(Math.round(z.tx), Math.round(z.ty));
            if (target?.building.onFire) {
              this.extinguishFire(target);
            }
            z.phase = 'returning';
          }
          break;
        }

        case 'returning': {
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

    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.zeppelins.splice(toRemove[i]!, 1);
    }
  }

  // ── Disease Logic ────────────────────────────────────────────────────────────

  /**
   * Run disease progression + monthly outbreak check.
   * Returns array of disease types that broke out this tick.
   */
  private tickDisease(totalTicks: number, month: number): DiseaseType[] {
    // Skip entity-based disease logic in aggregate mode (no citizen entities)
    const resources = getResourceEntity()?.resources;
    if (resources?.raion) return [];

    const result = {
      newInfections: 0,
      recoveries: 0,
      deaths: 0,
      deadEntities: [] as Entity[],
      outbreakTypes: [] as DiseaseType[],
    };

    if (totalTicks <= 0) return [];

    this.progressDiseases(result);

    if (totalTicks % TICKS_PER_MONTH === 0) {
      this.checkOutbreaks(month, result);
    }

    return result.outbreakTypes;
  }

  private progressDiseases(result: { deaths: number; recoveries: number; deadEntities: Entity[] }): void {
    const snapshot = [...citizens];
    for (const entity of snapshot) {
      const disease = entity.citizen.disease;
      if (!disease) continue;

      if (disease.ticksRemaining <= 1) {
        const def = DISEASE_DEFINITIONS.find((d) => d.type === disease.type);
        const mortalityRate = def?.mortalityRate ?? 0.1;
        const roll = this.rng ? this.rng.random() : Math.random();
        if (roll < mortalityRate) {
          result.deaths++;
          result.deadEntities.push(entity);
          entity.citizen.disease = undefined;
        } else {
          entity.citizen.disease = undefined;
          result.recoveries++;
        }
      } else {
        disease.ticksRemaining--;
      }
    }
  }

  private checkOutbreaks(month: number, result: { newInfections: number; outbreakTypes: DiseaseType[] }): void {
    const store = getResourceEntity();
    if (!store) return;

    const population = store.resources.population;
    if (population <= 0) return;

    let housingCap = 0;
    for (const entity of housingArchetype) {
      if (entity.building.powered) {
        housingCap += entity.building.housingCap;
      }
    }

    const foodRatio = Math.min(1, store.resources.food / Math.max(1, population * 2));
    const medicalCounts = this.countMedicalBuildings();
    const outbreakSet = new Set<DiseaseType>();

    for (const entity of [...citizens]) {
      if (entity.citizen.disease) continue;

      for (const diseaseDef of DISEASE_DEFINITIONS) {
        const envModifier = this.calcOutbreakModifier(diseaseDef, month, housingCap, population, foodRatio);
        if (envModifier === 0) continue;

        const clinicFactor = this.clinicPreventionFactor(diseaseDef, medicalCounts);
        const chance = BASE_OUTBREAK_CHANCE * diseaseDef.spreadRate * envModifier * clinicFactor;

        const roll = this.rng ? this.rng.random() : Math.random();
        if (roll < chance) {
          entity.citizen.disease = {
            type: diseaseDef.type,
            ticksRemaining: diseaseDef.durationTicks,
          };
          result.newInfections++;
          outbreakSet.add(diseaseDef.type);
          break;
        }
      }
    }

    result.outbreakTypes = [...outbreakSet];
  }

  // ── Disease Helpers ──────────────────────────────────────────────────────────

  private countMedicalBuildings(): Map<string, number> {
    const counts = new Map<string, number>();
    for (const entity of operationalBuildings) {
      const defId = entity.building.defId;
      if (defId === 'hospital' || defId === 'polyclinic') {
        if (entity.building.powered) {
          counts.set(defId, (counts.get(defId) ?? 0) + 1);
        }
      }
    }
    return counts;
  }

  /** Calculate clinic prevention factor for a disease (0.1 floor). */
  clinicPreventionFactor(disease: DiseaseDefinition, medicalCounts: Map<string, number>): number {
    if (disease.preventedBy.length === 0) return 1.0;
    let totalClinics = 0;
    for (const defId of disease.preventedBy) {
      totalClinics += medicalCounts.get(defId) ?? 0;
    }
    if (totalClinics === 0) return 1.0;
    const factor = CLINIC_REDUCTION_PER_BUILDING ** totalClinics;
    return Math.max(MAX_CLINIC_REDUCTION, factor);
  }

  /** Calculate environment outbreak modifier for a disease. */
  calcOutbreakModifier(
    disease: DiseaseDefinition,
    month: number,
    housingCap: number,
    population: number,
    foodRatio: number,
  ): number {
    let modifier = 1.0;
    const isWinter = month >= 11 || month <= 3;

    if (isWinter && !disease.nutritional) modifier *= WINTER_MULT;
    if (disease.winterOnly && !isWinter) return 0;
    if (housingCap > 0 && population > housingCap) modifier *= OVERCROWDING_MULT;
    if (disease.nutritional && foodRatio < FOOD_SHORTAGE_THRESHOLD) modifier *= FOOD_SHORTAGE_SCURVY_MULT;
    if (disease.nutritional && foodRatio >= 0.8) modifier *= 0.1;

    return modifier;
  }

  // ── Fire Helpers ─────────────────────────────────────────────────────────────

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
    grid.setCell(gridX, gridY, null);
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

  // ── Sync to GameState ────────────────────────────────────────────────────────

  /**
   * Sync ECS fire state to the legacy gameState.grid for the 3D renderers.
   * Called after update() by SimulationEngine.
   */
  syncToGameState(gameStateGrid: { onFire: number }[][]): void {
    for (let y = 0; y < GRID_SIZE; y++) {
      const row = gameStateGrid[y];
      if (!row) continue;
      for (let x = 0; x < GRID_SIZE; x++) {
        const cell = row[x];
        if (cell) cell.onFire = 0;
      }
    }
    for (const entity of buildingsLogic.entities) {
      if (!entity.building.onFire) continue;
      const { gridX, gridY } = entity.position;
      const cell = gameStateGrid[gridY]?.[gridX];
      if (cell) {
        cell.onFire = Math.max(1, Math.min(entity.building.fireTicksRemaining ?? 1, 15));
      }
    }
  }

  /**
   * Get zeppelin state for ZeppelinRenderer.
   */
  getZeppelinRenderState(): Array<{ x: number; y: number; tx: number; ty: number; lx: number; ly: number }> {
    return this.zeppelins.map((z) => ({
      x: z.x,
      y: z.y,
      tx: z.tx,
      ty: z.ty,
      lx: z.x,
      ly: z.y,
    }));
  }

  // ── Serialization ────────────────────────────────────────────────────────────

  /** Serialize agent state for save/load. */
  serialize(): DefenseAgentSnapshot {
    return {
      zeppelins: this.zeppelins.map((z) => ({ ...z })),
    };
  }

  /**
   * Restore agent state from a snapshot.
   *
   * @param snapshot - Previously serialized DefenseAgentSnapshot
   */
  restore(snapshot: DefenseAgentSnapshot): void {
    this.zeppelins = snapshot.zeppelins.map((z) => ({ ...z }));
  }

  /**
   * Deserialize a DefenseAgent from saved data.
   * Backward-compat with old FireSystem.deserialize() call sites.
   *
   * @param data - Serialized snapshot
   * @param rng - Optional RNG for fire spread randomness
   * @param callbacks - Optional callbacks for fire events
   */
  static deserialize(data: DefenseAgentSnapshot, rng?: GameRng, callbacks?: DefenseAgentCallbacks): DefenseAgent {
    const agent = new DefenseAgent(rng, callbacks);
    agent.restore(data);
    return agent;
  }

  // ── Absorbed SimulationEngine Methods ─────────────────────────────────────

  /**
   * Powered gulags have a 10% chance per tick of arresting a citizen.
   * Absorbs SimulationEngine.processGulagEffect().
   */
  public processGulagEffect(deps: {
    population: number;
    rng: GameRng | undefined;
    workers: { arrestWorker(): any; getPopulation(): number };
    scoring: { onKGBLoss(count: number): void };
    kgb: { addMark(reason: string, tick: number, desc: string): void };
    callbacks: { onPravda: (msg: string) => void };
    totalTicks: number;
  }): void {
    if (deps.workers.getPopulation() <= 0) return;

    for (const entity of buildingsLogic) {
      if (entity.building.housingCap < 0) {
        if (entity.building.powered && deps.workers.getPopulation() > 0) {
          if ((deps.rng ? deps.rng.random() : Math.random()) < 0.1) {
            const arrest = deps.workers.arrestWorker();
            if (arrest) {
              deps.scoring.onKGBLoss(1);
              deps.kgb.addMark('worker_arrested', deps.totalTicks, 'Gulag processing of enemy of the people');
              deps.callbacks.onPravda('ENEMY OF THE PEOPLE SENTENCED TO CORRECTIVE LABOR');
            }
          }
        }
      }
    }
  }

  /**
   * Run disease tick and handle deaths + outbreak headlines.
   * Absorbs SimulationEngine disease tick orchestration.
   */
  public tickDiseaseFull(deps: {
    totalTicks: number;
    month: number;
    workers: { removeWorker(entity: any, reason: string): void };
    callbacks: { onPravda: (msg: string) => void };
    rng: GameRng | undefined;
  }): void {
    // Skip entity-based disease logic in aggregate mode (no citizen entities)
    const resources = getResourceEntity()?.resources;
    if (resources?.raion) return;

    const diseaseResult = diseaseTick(deps.totalTicks, deps.month);

    // Route disease deaths through WorkerSystem for proper stats cleanup
    for (const deadEntity of diseaseResult.deadEntities) {
      deps.workers.removeWorker(deadEntity, 'disease_death');
    }

    // Emit Pravda headlines for outbreaks
    if (diseaseResult.outbreakTypes.length > 0) {
      const rngLocal = deps.rng;
      for (const diseaseType of diseaseResult.outbreakTypes) {
        const headlines = DISEASE_PRAVDA_HEADLINES[diseaseType];
        if (headlines && headlines.length > 0) {
          const headline = rngLocal
            ? rngLocal.pick(headlines)
            : headlines[Math.floor(Math.random() * headlines.length)]!; // cosmetic fallback
          deps.callbacks.onPravda(headline);
        }
      }
    }
  }
}

/** Backward-compat alias: FireSystem is now DefenseAgent. */
export { DefenseAgent as FireSystem };
/** Backward-compat type alias for FireSystem save data. */
export type FireSystemSaveData = DefenseAgentSnapshot;

// Re-export disease system functions (from disease.ts, originally DiseaseSystem.ts)
export {
  calcOutbreakModifier,
  checkOutbreaks,
  clinicPreventionFactor,
  DISEASE_PRAVDA_HEADLINES,
  type DiseaseTickResult,
  diseaseTick,
  initDiseaseSystem,
  progressDiseases,
  SICK_LABOR_MULT,
} from './disease';
