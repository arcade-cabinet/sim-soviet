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
 * Building component — stores the def ID, power state, production info,
 * housing capacity, and environmental stats.
 */
/** Construction phase for buildings being built. */
export type ConstructionPhase = 'foundation' | 'building' | 'complete';

export interface BuildingComponent {
  /** Building definition ID (sprite ID key into BUILDING_DEFS) */
  defId: string;
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
  /** Construction phase — undefined or 'complete' means operational */
  constructionPhase?: ConstructionPhase;
  /** Construction progress 0.0–1.0 (derived from constructionTicks / baseTicks) */
  constructionProgress?: number;
  /** Integer ticks elapsed during construction (avoids floating-point accumulation) */
  constructionTicks?: number;
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
  /** Dvor (household) this citizen belongs to */
  dvorId?: string;
  /** Gender */
  gender?: 'male' | 'female';
  /** Age in years */
  age?: number;
  /** Demographic role within the household */
  memberRole?: MemberRole;
}

// ── Dvor (Household) System ──────────────────────────────────────────────────

/** Demographic role within a dvor. */
export type MemberRole = 'head' | 'spouse' | 'worker' | 'elder' | 'adolescent' | 'child' | 'infant';

/**
 * Individual family member within a dvor.
 * Authoritative demographic data — CitizenComponent entities are rendering proxies.
 */
export interface DvorMember {
  /** Unique member ID */
  id: string;
  /** Full name */
  name: string;
  /** Gender */
  gender: 'male' | 'female';
  /** Age in years */
  age: number;
  /** Role within the household */
  role: MemberRole;
  /** Labor capacity 0.0–1.0 (age/health dependent) */
  laborCapacity: number;
  /** Trudodni earned this year */
  trudodniEarned: number;
  /** Health 0–100 */
  health: number;
  /** Ticks remaining in pregnancy (women only) */
  pregnant?: number;
}

/**
 * Dvor (household) component — the fundamental administrative unit.
 * Contains all family members as embedded sub-entities.
 */
export interface DvorComponent {
  /** Unique household ID */
  id: string;
  /** Family members */
  members: DvorMember[];
  /** Member ID of head of household */
  headOfHousehold: string;
  /** Private plot size in hectares (era-dependent) */
  privatePlotSize: number;
  /** Private livestock counts */
  privateLivestock: {
    cow: number;
    pig: number;
    sheep: number;
    poultry: number;
  };
  /** Tick when this dvor joined the collective */
  joinedTick: number;
  /** Loyalty to the collective (0–100) */
  loyaltyToCollective: number;
  /** Surname for this household */
  surname: string;
  /** Monotonic counter for generating unique member IDs (avoids collision on death+birth) */
  nextMemberId?: number;
}

/**
 * Sprite rendering component — stores the data needed to draw this entity
 * on the Canvas 2D isometric renderer.
 *
 * Data is sourced from buildingDefs.generated.json (via the pipeline).
 */
export interface Renderable {
  /** Sprite manifest ID (e.g. "apartment-tower-a") — key into SpriteLoader cache */
  spriteId: string;
  /** Relative path to the PNG sprite (e.g. "sprites/soviet/apartment-tower-a.png") */
  spritePath: string;
  /** Grid footprint width (tiles in X direction) */
  footprintX: number;
  /** Grid footprint height (tiles in Y direction) */
  footprintY: number;
  /** Whether this entity should be rendered */
  visible: boolean;
}

/**
 * Resource stockpile — held by a singleton entity.
 * All global economic values live here.
 */
export interface Resources {
  /** Rubles (SECONDARY — only for consumer economy, black market, bribes) */
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

  // ── Planned Economy Resources ──

  /** Trudodni — labor units accumulated this period */
  trudodni: number;
  /** Blat — connections resource (0-100) */
  blat: number;
  /** Timber — construction/fuel material */
  timber: number;
  /** Steel — industrial construction material */
  steel: number;
  /** Cement — construction material */
  cement: number;
  /** Prefab panels — late-era rapid construction material */
  prefab: number;
  /** Seed fund — reserved grain for next season (0-1 ratio) */
  seedFund: number;
  /** Emergency reserve — buffer against disasters */
  emergencyReserve: number;
  /** Storage capacity — total food storage across all buildings */
  storageCapacity: number;
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
 * Game metadata — non-resource state stored on a singleton ECS entity.
 * Replaces the old GameState fields for date, quota, leader, settlement, etc.
 */
export interface GameMeta {
  seed: string;
  date: { year: number; month: number; tick: number };
  quota: { type: string; target: number; current: number; deadlineYear: number };
  selectedTool: string;
  gameOver: { victory: boolean; reason: string } | null;
  leaderName?: string;
  leaderPersonality?: string;
  settlementTier: 'selo' | 'posyolok' | 'pgt' | 'gorod';
  blackMarks: number;
  commendations: number;
  threatLevel: string;
  /** Current historical era ID (synced from EraSystem each tick) */
  currentEra: string;
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

// ─── Citizen Render Slot ─────────────────────────────────────────────────────

/** Age bracket for visual differentiation (sprite variant / dot size). */
export type AgeCategory = 'child' | 'adolescent' | 'adult' | 'elder';

/**
 * Pre-computed rendering instructions for citizen entities.
 *
 * Canvas2D reads these directly — no runtime lookups or branching needed.
 * Future sprite systems use `gender × ageCategory × citizenClass` to select
 * the correct sprite variant.
 *
 * The `dialoguePool` field tells the dialogue system which NPC pool to draw
 * from when the citizen is tapped — driven by ECS archetypes, not ad-hoc checks.
 */
export interface CitizenRenderSlot {
  /** Gender — determines sprite variant (male/female model) */
  gender: 'male' | 'female';
  /** Age bracket — determines sprite size/posture */
  ageCategory: AgeCategory;
  /** Citizen class key — determines color palette */
  citizenClass: string;
  /** Pre-computed dot color for Canvas2D indicator rendering */
  dotColor: string;
  /** Dialogue pool key for tap interaction */
  dialoguePool: 'worker' | 'party_official' | 'military' | 'ambient';
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
  /** Dvor (household) data */
  dvor?: DvorComponent;
  /** 3D render info */
  renderable?: Renderable;
  /** Global resource stockpile (singleton) */
  resources?: Resources;
  /** Grid tile data */
  tile?: TileComponent;
  /** Structural health */
  durability?: Durability;
  /** Game metadata singleton (date, quota, leader, settlement, etc.) */
  gameMeta?: GameMeta;
  /** Pre-computed rendering instructions for citizen entities */
  renderSlot?: CitizenRenderSlot;

  // ── Tag components ──
  /** Tag: entity is a building */
  isBuilding?: true;
  /** Tag: entity is a citizen */
  isCitizen?: true;
  /** Tag: entity is a tile */
  isTile?: true;
  /** Tag: entity is a dvor (household) */
  isDvor?: true;
  /** Tag: entity is the resource store singleton */
  isResourceStore?: true;
  /** Tag: entity is the game metadata singleton */
  isMetaStore?: true;
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
