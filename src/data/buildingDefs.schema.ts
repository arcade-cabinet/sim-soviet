/**
 * buildingDefs.schema.ts — Zod schemas for building definitions.
 *
 * Single source of truth for building data shapes. Used by:
 *   1. Pipeline script (scripts/generate_building_defs.ts) — validates output
 *   2. Game runtime — validates loaded JSON, provides TypeScript types
 *   3. Miniplex ECS factories — typed building creation
 *
 * Grid footprint: derived from Blender model_size via ceil(x) × ceil(y).
 * One Blender unit = one grid cell (80px at PPU=80).
 */

import { z } from 'zod';

// ── Sprite manifest entry (from render_sprites.py output) ─────────────────────

/** Raw sprite data baked by the Blender pipeline. */
export const SpriteDataSchema = z.object({
  /** Relative path from public/ root, e.g. "sprites/soviet/apartment-tower-a.png" */
  path: z.string(),
  /** Pixel width of the cropped PNG */
  width: z.number().int().positive(),
  /** Pixel height of the cropped PNG */
  height: z.number().int().positive(),
  /** Anchor X: pixel offset from image left edge to tile base center */
  anchorX: z.number().int(),
  /** Anchor Y: pixel offset from image top edge to tile base center */
  anchorY: z.number().int(),
});

// ── Grid footprint ────────────────────────────────────────────────────────────

/** How many grid cells this building occupies. */
export const FootprintSchema = z.object({
  /** Horizontal tile count (grid X axis) */
  tilesX: z.number().int().positive(),
  /** Vertical tile count (grid Y axis) */
  tilesY: z.number().int().positive(),
});

// ── Blender model dimensions (reference data) ────────────────────────────────

/** Original model size in Blender units (kept for pipeline traceability). */
export const ModelSizeSchema = z.object({
  /** Width (Blender X axis → grid X) */
  x: z.number(),
  /** Depth (Blender Y axis → grid Y) */
  y: z.number(),
  /** Height (Blender Z axis → visual only, not grid) */
  z: z.number(),
});

// ── ECS building component defaults ──────────────────────────────────────────

/** Resource production descriptor. */
export const ProductionSchema = z.object({
  resource: z.enum(['food', 'vodka']),
  amount: z.number().positive(),
});

/**
 * Construction cost — labor + materials required to build.
 * Rubles are NOT used for construction (planned economy).
 */
export const ConstructionCostSchema = z.object({
  /** Labor units (trudodni) required */
  labor: z.number().nonnegative(),
  /** Timber units required */
  timber: z.number().nonnegative(),
  /** Steel units required */
  steel: z.number().nonnegative(),
  /** Cement units required */
  cement: z.number().nonnegative(),
  /** Prefab panel units required (late eras) */
  prefab: z.number().nonnegative(),
  /** Base construction ticks at full staffing */
  baseTicks: z.number().int().positive(),
  /** Optimal number of workers for construction */
  staffCap: z.number().int().positive(),
});

/**
 * Default stats for the Miniplex BuildingComponent.
 * These are the starting values when a building entity is created.
 */
export const BuildingStatsSchema = z.object({
  /** Power units required to operate */
  powerReq: z.number(),
  /** Power units generated (power plants only) */
  powerOutput: z.number(),
  /** Max citizens housed (0 for non-housing, negative for gulags) */
  housingCap: z.number(),
  /** Pollution output per tick */
  pollution: z.number(),
  /** Fear output per tick */
  fear: z.number(),
  /** Resource production (if any) */
  produces: ProductionSchema.optional(),
  /** Durability decay rate per tick */
  decayRate: z.number(),
  /** Worker slots */
  jobs: z.number(),
  /** Construction cost in labor + materials (optional for backward compat) */
  constructionCost: ConstructionCostSchema.optional(),
  /** Optimal staff count for production (overstaffing has diminishing returns) */
  staffCap: z.number().int().positive().optional(),
  /** Base output rate per worker per tick (for production formula) */
  baseRate: z.number().positive().optional(),
});

// ── Era classification ───────────────────────────────────────────────────────

/** Historical era in which this building first becomes available. */
export const EraIdSchema = z.enum([
  'war_communism',
  'first_plans',
  'great_patriotic',
  'reconstruction',
  'thaw',
  'stagnation',
  'perestroika',
  'eternal_soviet',
]);

// ── Role classification ──────────────────────────────────────────────────────

/** Sprite role from the Blender manifest. Used for archetype categorization. */
export const RoleSchema = z.enum([
  'housing',
  'industry',
  'agriculture',
  'government',
  'military',
  'services',
  'culture',
  'power',
  'transport',
  'propaganda',
  'utility',
  'environment',
]);

// ── Game presentation ────────────────────────────────────────────────────────

/** UI-facing metadata for the toolbar and HUD. */
export const PresentationSchema = z.object({
  /** Display name shown in toolbar */
  name: z.string(),
  /** Emoji icon for the toolbar button */
  icon: z.string(),
  /** Ruble cost to place */
  cost: z.number().int(),
  /** Flavor text for tooltip */
  desc: z.string(),
  /** Game category type (res, ind, gov, utility, infra, tool) */
  category: z.string(),
});

// ── Complete building definition ─────────────────────────────────────────────

/**
 * Full building definition — everything Miniplex and the renderer need
 * to spawn and draw a building entity.
 */
export const BuildingDefSchema = z.object({
  /** Unique ID matching the sprite manifest key */
  id: z.string(),
  /** Sprite role from Blender manifest */
  role: RoleSchema,
  /** Sprite rendering data (path, dimensions, anchor) */
  sprite: SpriteDataSchema,
  /** Grid footprint derived from model_size */
  footprint: FootprintSchema,
  /** Original Blender model dimensions */
  modelSize: ModelSizeSchema,
  /** ECS BuildingComponent defaults */
  stats: BuildingStatsSchema,
  /** UI presentation data */
  presentation: PresentationSchema,
  /** Era when this building first becomes available */
  eraAvailable: EraIdSchema,
});

// ── Top-level generated file schema ──────────────────────────────────────────

/** Schema for the complete generated buildingDefs.json file. */
export const BuildingDefsFileSchema = z.object({
  /** Schema version for forward compatibility */
  version: z.string(),
  /** ISO timestamp of generation */
  generatedAt: z.string(),
  /** Map of sprite ID → building definition */
  buildings: z.record(z.string(), BuildingDefSchema),
});

// ── Inferred TypeScript types ────────────────────────────────────────────────

export type SpriteData = z.infer<typeof SpriteDataSchema>;
export type Footprint = z.infer<typeof FootprintSchema>;
export type ModelSize = z.infer<typeof ModelSizeSchema>;
export type Production = z.infer<typeof ProductionSchema>;
export type ConstructionCost = z.infer<typeof ConstructionCostSchema>;
export type BuildingStats = z.infer<typeof BuildingStatsSchema>;
export type Role = z.infer<typeof RoleSchema>;
export type Presentation = z.infer<typeof PresentationSchema>;
export type BuildingDef = z.infer<typeof BuildingDefSchema>;
export type BuildingDefsFile = z.infer<typeof BuildingDefsFileSchema>;
