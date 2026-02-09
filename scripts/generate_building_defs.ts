#!/usr/bin/env tsx
/**
 * generate_building_defs.ts — Pipeline script that reads the sprite manifest
 * and game config, then generates a validated JSON building definitions file.
 *
 * Input:  public/sprites/soviet/manifest.json (from render_sprites.py)
 * Output: src/data/buildingDefs.generated.json
 *
 * Footprint calculation: ceil(model_size.x) × ceil(model_size.y)
 * One Blender unit = one grid cell (TILE_WIDTH=80px at PPU=80).
 *
 * Usage:
 *   pnpm pipeline:defs
 *   # or directly:
 *   npx tsx scripts/generate_building_defs.ts
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Resolve paths relative to project root ──────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const MANIFEST_PATH = resolve(ROOT, 'public/sprites/soviet/manifest.json');
const OUTPUT_PATH = resolve(ROOT, 'src/data/buildingDefs.generated.json');

// ── Inline Zod import (we can't use path aliases in scripts) ────────────────

// We import zod directly (not from src/) so the script runs standalone with tsx.
import { z } from 'zod';

// ── Schema definitions (duplicated from src/data/buildingDefs.schema.ts) ────
// We duplicate here to keep the pipeline script self-contained and runnable
// without Vite path aliases. The source-of-truth schemas in src/ import from
// the generated JSON and validate at load time.

const RoleSchema = z.enum([
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

const BuildingDefSchema = z.object({
  id: z.string(),
  role: RoleSchema,
  sprite: z.object({
    path: z.string(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    anchorX: z.number().int(),
    anchorY: z.number().int(),
  }),
  footprint: z.object({
    tilesX: z.number().int().positive(),
    tilesY: z.number().int().positive(),
  }),
  modelSize: z.object({ x: z.number(), y: z.number(), z: z.number() }),
  stats: z.object({
    powerReq: z.number(),
    powerOutput: z.number(),
    housingCap: z.number(),
    pollution: z.number(),
    fear: z.number(),
    produces: z
      .object({
        resource: z.enum(['food', 'vodka']),
        amount: z.number().positive(),
      })
      .optional(),
    decayRate: z.number(),
    jobs: z.number(),
  }),
  presentation: z.object({
    name: z.string(),
    icon: z.string(),
    cost: z.number().int(),
    desc: z.string(),
    category: z.string(),
  }),
});

const BuildingDefsFileSchema = z.object({
  version: z.string(),
  generatedAt: z.string(),
  buildings: z.record(z.string(), BuildingDefSchema),
});

// ── Manifest types ──────────────────────────────────────────────────────────

interface ManifestSprite {
  sprite: string;
  role: string;
  width: number;
  height: number;
  anchor_x: number;
  anchor_y: number;
  model_size: { x: number; y: number; z: number };
}

interface Manifest {
  sprites: Record<string, ManifestSprite>;
  roles: Record<string, string[]>;
}

// ── Game config: maps sprite IDs to gameplay stats ──────────────────────────
// This is the "game designer's layer" — stats, costs, names, icons.
// Sprites not listed here get sensible defaults derived from their role.

interface GameConfig {
  name: string;
  icon: string;
  cost: number;
  desc: string;
  category: string;
  powerReq?: number;
  powerOutput?: number;
  housingCap?: number;
  pollution?: number;
  fear?: number;
  produces?: { resource: 'food' | 'vodka'; amount: number };
  decayRate?: number;
  jobs?: number;
}

const GAME_CONFIG: Record<string, GameConfig> = {
  // ── Power ──
  'power-station': {
    name: 'Coal Plant',
    icon: '⚡',
    cost: 300,
    desc: 'Creates smog & power.',
    category: 'utility',
    powerOutput: 100,
    pollution: 20,
    jobs: 15,
  },

  // ── Housing ──
  'apartment-tower-a': {
    name: 'Tenement Block',
    icon: '🏢',
    cost: 100,
    desc: 'Concrete sleeping box.',
    category: 'res',
    housingCap: 50,
    powerReq: 5,
  },
  'apartment-tower-b': {
    name: 'Tenement Tower',
    icon: '🏢',
    cost: 120,
    desc: 'Taller concrete box.',
    category: 'res',
    housingCap: 60,
    powerReq: 6,
  },
  'apartment-tower-c': {
    name: 'High-Rise Block',
    icon: '🏢',
    cost: 180,
    desc: 'Reaches for socialist skies.',
    category: 'res',
    housingCap: 80,
    powerReq: 8,
  },
  'apartment-tower-d': {
    name: 'Megablock',
    icon: '🏢',
    cost: 250,
    desc: 'A monument to standardization.',
    category: 'res',
    housingCap: 120,
    powerReq: 12,
  },
  'workers-house-a': {
    name: "Workers' House",
    icon: '🏠',
    cost: 80,
    desc: 'Modest proletarian dwelling.',
    category: 'res',
    housingCap: 30,
    powerReq: 3,
  },
  'workers-house-b': {
    name: "Workers' Duplex",
    icon: '🏠',
    cost: 110,
    desc: 'Double the concrete, double the joy.',
    category: 'res',
    housingCap: 45,
    powerReq: 4,
  },
  'workers-house-c': {
    name: "Workers' Complex",
    icon: '🏘️',
    cost: 200,
    desc: 'A whole courtyard of happiness.',
    category: 'res',
    housingCap: 80,
    powerReq: 8,
  },
  'concrete-block': {
    name: 'Concrete Block',
    icon: '🧱',
    cost: 60,
    desc: "The people's building material.",
    category: 'utility',
  },

  // ── Agriculture ──
  'collective-farm-hq': {
    name: 'Kolkhoz',
    icon: '🥔',
    cost: 150,
    desc: 'Potatoes for the motherland.',
    category: 'ind',
    produces: { resource: 'food', amount: 20 },
    powerReq: 2,
    jobs: 10,
  },

  // ── Industry ──
  'bread-factory': {
    name: 'Bread Factory',
    icon: '🍞',
    cost: 200,
    desc: 'Where flour becomes propaganda.',
    category: 'ind',
    produces: { resource: 'food', amount: 15 },
    powerReq: 5,
    jobs: 12,
    pollution: 3,
  },
  'factory-office': {
    name: 'Factory Office',
    icon: '🏭',
    cost: 180,
    desc: 'Paperwork division.',
    category: 'ind',
    powerReq: 4,
    jobs: 20,
    pollution: 2,
  },
  'vodka-distillery': {
    name: 'Vodka Plant',
    icon: '🍾',
    cost: 250,
    desc: 'Essential fluid production.',
    category: 'ind',
    produces: { resource: 'vodka', amount: 10 },
    powerReq: 5,
    jobs: 10,
    pollution: 5,
  },
  warehouse: {
    name: 'Warehouse',
    icon: '📦',
    cost: 120,
    desc: 'Stores everything but hope.',
    category: 'ind',
    powerReq: 2,
    jobs: 5,
  },

  // ── Government ──
  'government-hq': {
    name: 'Government HQ',
    icon: '🏛️',
    cost: 400,
    desc: 'Where decisions are made slowly.',
    category: 'gov',
    powerReq: 10,
    jobs: 25,
    fear: 5,
  },
  'kgb-office': {
    name: 'KGB Office',
    icon: '🕵️',
    cost: 500,
    desc: "They're watching. Always.",
    category: 'gov',
    powerReq: 8,
    jobs: 15,
    fear: 20,
  },
  'ministry-office': {
    name: 'Ministry Office',
    icon: '📋',
    cost: 350,
    desc: 'Bureaucracy incarnate.',
    category: 'gov',
    powerReq: 6,
    jobs: 30,
    fear: 3,
  },

  // ── Military ──
  barracks: {
    name: 'Barracks',
    icon: '🎖️',
    cost: 200,
    desc: 'Soldiers sleep here. Allegedly.',
    category: 'mil',
    powerReq: 4,
    jobs: 8,
    fear: 8,
  },
  'guard-post': {
    name: 'Guard Post',
    icon: '🛡️',
    cost: 100,
    desc: 'Watching the watchers.',
    category: 'mil',
    powerReq: 2,
    jobs: 4,
    fear: 5,
  },
  'gulag-admin': {
    name: 'Gulag',
    icon: '⛓️',
    cost: 500,
    desc: 'Fixes attitude problems.',
    category: 'gov',
    housingCap: -20,
    powerReq: 10,
    fear: 15,
    jobs: 5,
  },

  // ── Services ──
  'fire-station': {
    name: 'Fire Station',
    icon: '🚒',
    cost: 150,
    desc: 'Arrives after the fire.',
    category: 'svc',
    powerReq: 3,
    jobs: 10,
  },
  hospital: {
    name: 'Hospital',
    icon: '🏥',
    cost: 250,
    desc: 'Soviet medicine is best medicine.',
    category: 'svc',
    powerReq: 8,
    jobs: 20,
  },
  polyclinic: {
    name: 'Polyclinic',
    icon: '💊',
    cost: 180,
    desc: 'Aspirin cures everything.',
    category: 'svc',
    powerReq: 5,
    jobs: 12,
  },
  'post-office': {
    name: 'Post Office',
    icon: '✉️',
    cost: 100,
    desc: 'Letters arrive. Eventually.',
    category: 'svc',
    powerReq: 2,
    jobs: 6,
  },
  school: {
    name: 'School',
    icon: '📚',
    cost: 200,
    desc: 'Teaching the party line since 1917.',
    category: 'svc',
    powerReq: 4,
    jobs: 15,
  },

  // ── Culture ──
  'cultural-palace': {
    name: 'Cultural Palace',
    icon: '🎭',
    cost: 300,
    desc: 'Ballet, opera, and propaganda.',
    category: 'cul',
    powerReq: 6,
    jobs: 12,
  },
  'workers-club': {
    name: "Workers' Club",
    icon: '🎪',
    cost: 150,
    desc: 'Leisure in moderation.',
    category: 'cul',
    powerReq: 3,
    jobs: 8,
  },

  // ── Transport ──
  'train-station': {
    name: 'Train Station',
    icon: '🚂',
    cost: 300,
    desc: 'Trains run on Soviet time.',
    category: 'transport',
    powerReq: 5,
    jobs: 10,
  },

  // ── Propaganda ──
  'radio-station': {
    name: 'Radio Station',
    icon: '📻',
    cost: 250,
    desc: 'Broadcasting the truth. Our truth.',
    category: 'prop',
    powerReq: 6,
    jobs: 8,
    fear: 3,
  },

  // ── Environment ──
  fence: {
    name: 'Fence',
    icon: '🚧',
    cost: 10,
    desc: 'Keeps them in. Or out.',
    category: 'env',
  },
  'fence-low': {
    name: 'Low Fence',
    icon: '🚧',
    cost: 15,
    desc: 'A suggestion of boundaries.',
    category: 'env',
  },
};

// ── Pipeline ────────────────────────────────────────────────────────────────

/** Build a single building definition from manifest sprite + game config. */
function buildDef(
  id: string,
  sprite: ManifestSprite,
  config: (typeof GAME_CONFIG)[string] | undefined
): z.infer<typeof BuildingDefSchema> {
  const tilesX = Math.max(1, Math.round(sprite.model_size.x));
  const tilesY = Math.max(1, Math.round(sprite.model_size.y));

  return {
    id,
    role: sprite.role as z.infer<typeof RoleSchema>,
    sprite: {
      path: sprite.sprite,
      width: sprite.width,
      height: sprite.height,
      anchorX: sprite.anchor_x,
      anchorY: sprite.anchor_y,
    },
    footprint: { tilesX, tilesY },
    modelSize: sprite.model_size,
    stats: {
      powerReq: config?.powerReq ?? 0,
      powerOutput: config?.powerOutput ?? 0,
      housingCap: config?.housingCap ?? 0,
      pollution: config?.pollution ?? 0,
      fear: config?.fear ?? 0,
      produces: config?.produces,
      decayRate: config?.decayRate ?? 0.05,
      jobs: config?.jobs ?? 0,
    },
    presentation: {
      name: config?.name ?? prettifyId(id),
      icon: config?.icon ?? '🏗\uFE0F',
      cost: config?.cost ?? 50,
      desc: config?.desc ?? '',
      category: config?.category ?? 'misc',
    },
  };
}

/** Print a summary of footprints to the console. */
function printFootprintSummary(buildings: Record<string, z.infer<typeof BuildingDefSchema>>): void {
  console.log('\nFootprint summary:');
  for (const [id, def] of Object.entries(buildings)) {
    const fp = def.footprint;
    const label = fp.tilesX === 1 && fp.tilesY === 1 ? '1x1' : `${fp.tilesX}x${fp.tilesY}`;
    console.log(
      `  ${id.padEnd(24)} ${label.padEnd(5)} (model: ${def.modelSize.x.toFixed(2)} x ${def.modelSize.y.toFixed(2)})`
    );
  }
}

function main(): void {
  console.log('Reading manifest:', MANIFEST_PATH);
  const raw = readFileSync(MANIFEST_PATH, 'utf-8');
  const manifest: Manifest = JSON.parse(raw);

  const buildings: Record<string, z.infer<typeof BuildingDefSchema>> = {};

  for (const [id, sprite] of Object.entries(manifest.sprites)) {
    const config = GAME_CONFIG[id];
    if (!config) {
      console.warn(`  WARN: No game config for sprite "${id}" -- using defaults`);
    }
    buildings[id] = buildDef(id, sprite, config);
  }

  const output: z.infer<typeof BuildingDefsFileSchema> = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    buildings,
  };

  const result = BuildingDefsFileSchema.safeParse(output);
  if (!result.success) {
    console.error('Zod validation failed:');
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }

  const json = JSON.stringify(result.data, null, 2);
  writeFileSync(OUTPUT_PATH, `${json}\n`, 'utf-8');
  console.log(`Generated ${Object.keys(buildings).length} building definitions -> ${OUTPUT_PATH}`);
  printFootprintSummary(buildings);
}

/** Convert "kebab-case-name" to "Kebab Case Name". */
function prettifyId(id: string): string {
  return id
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

main();
