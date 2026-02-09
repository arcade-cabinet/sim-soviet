/**
 * @module ecs/world
 *
 * Central ECS world definition for SimSoviet 2000.
 *
 * Defines all component types, the unified Entity interface, and exports a
 * singleton `world` instance plus a React context / provider powered by
 * miniplex-react.
 *
 * Miniplex 2.0 uses a single Entity interface where every component is an
 * optional property. Queries narrow the type via `world.with(...)`.
 */

import { World } from 'miniplex';
import createReactAPI from 'miniplex-react';

// ─── Component Types ─────────────────────────────────────────────────────────

/**
 * Grid position component.
 * Maps an entity to a cell in the 30x30 isometric grid.
 */
export interface Position {
  /** Column index (0-based) */
  gridX: number;
  /** Row index (0-based) */
  gridY: number;
}

/**
 * Building component — stores the type key, power state, production info,
 * housing capacity, and environmental stats.
 */
export interface BuildingComponent {
  /** Building type key that maps to BUILDING_TYPES in config */
  type: string;
  /** Whether this building currently receives power */
  powered: boolean;
  /** Power units this building requires to operate */
  powerReq: number;
  /** Power units this building generates (only for power plants) */
  powerOutput: number;
  /** If set, this building produces a resource each tick */
  produces?: { resource: 'food' | 'vodka'; amount: number };
  /** Maximum citizens this building can house (0 for non-housing) */
  housingCap: number;
  /** Pollution output per tick */
  pollution: number;
  /** Fear output (e.g. gulags) */
  fear: number;
}

/**
 * Citizen component for individual NPC entities.
 * Each citizen has a class, mood stats, and optional assignments.
 */
export interface CitizenComponent {
  /** Social class / occupation */
  class: 'worker' | 'party_official' | 'engineer' | 'farmer' | 'soldier' | 'prisoner';
  /** Happiness level (0 = miserable, 100 = suspiciously content) */
  happiness: number;
  /** Hunger level (0 = fed, 100 = starving) */
  hunger: number;
  /** Building type this citizen is assigned to work at */
  assignment?: string;
  /** Grid position of the housing this citizen is assigned to */
  home?: { gridX: number; gridY: number };
}

/**
 * 3D rendering component — stores the BabylonJS mesh reference info.
 * Actual mesh instances live in the scene graph; this component stores
 * enough info for the renderer to look them up.
 */
export interface Renderable {
  /** Unique mesh identifier for BabylonJS scene lookup */
  meshId: string;
  /** Path to the GLB model file (e.g. "/models/soviet/coal_plant.glb") */
  modelPath?: string;
  /** Uniform scale factor */
  scale: number;
  /** Whether this entity should be rendered */
  visible: boolean;
}

/**
 * Resource stockpile — held by a singleton entity.
 * All global economic values live here.
 */
export interface Resources {
  /** Rubles */
  money: number;
  /** Food units */
  food: number;
  /** Vodka units */
  vodka: number;
  /** Total power capacity */
  power: number;
  /** Power currently consumed */
  powerUsed: number;
  /** Total citizen count (derived but cached for quick access) */
  population: number;
}

/**
 * Grid tile component — describes the terrain type of a grid cell.
 */
export interface TileComponent {
  /** Current terrain type */
  terrain: 'grass' | 'road' | 'foundation' | 'water';
  /** Elevation offset for visual rendering */
  elevation: number;
}

/**
 * Health / decay component for buildings.
 * Buildings degrade over time and can eventually collapse.
 */
export interface Durability {
  /** Current durability (0 = collapsed, 100 = pristine) */
  current: number;
  /** Durability points lost per simulation tick */
  decayRate: number;
}

// ─── Entity ──────────────────────────────────────────────────────────────────

/**
 * The unified Entity type for the Miniplex world.
 *
 * Every component is optional — Miniplex queries narrow the type to only
 * entities that have the required components. Tag components use `true`
 * literal types for zero-cost filtering.
 */
export interface Entity {
  /** Grid position */
  position?: Position;
  /** Building data */
  building?: BuildingComponent;
  /** Citizen data */
  citizen?: CitizenComponent;
  /** 3D render info */
  renderable?: Renderable;
  /** Global resource stockpile (singleton) */
  resources?: Resources;
  /** Grid tile data */
  tile?: TileComponent;
  /** Structural health */
  durability?: Durability;

  // ── Tag components ──
  /** Tag: entity is a building */
  isBuilding?: true;
  /** Tag: entity is a citizen */
  isCitizen?: true;
  /** Tag: entity is a tile */
  isTile?: true;
  /** Tag: entity is the resource store singleton */
  isResourceStore?: true;
}

// ─── World Instance ──────────────────────────────────────────────────────────

/**
 * The singleton Miniplex world instance.
 * All game entities are managed through this world.
 */
export const world = new World<Entity>();

// ─── React API ───────────────────────────────────────────────────────────────

/**
 * React bindings generated from the world via miniplex-react.
 *
 * - `ECS.Entity`      — renders children with an entity in context
 * - `ECS.Entities`    — iterates a bucket, rendering children per entity
 * - `ECS.Component`   — adds/removes a component declaratively
 * - `ECS.useCurrentEntity` — reads the entity from the nearest Entity context
 */
export const ECS = createReactAPI(world);
