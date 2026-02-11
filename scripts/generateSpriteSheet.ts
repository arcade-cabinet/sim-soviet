/**
 * @module scripts/generateSpriteSheet
 *
 * Google Imagen-powered sprite sheet generator for SimSoviet 2000.
 *
 * Generates game-ready isometric character sprite sheets using AI image generation.
 * The SpriteSheetSpec type system maps directly to the game's CitizenRenderSlot
 * architecture (gender × ageCategory × citizenClass → sprite variant).
 *
 * Usage:
 *   doppler run --project gha --config ci -- pnpm pipeline:characters
 *   # or generate specific sheets:
 *   doppler run --project gha --config ci -- tsx scripts/generateSpriteSheet.ts soldier_male_adult kgb_male_adult
 *
 * Accepts GOOGLE_GENAI_API_KEY or GEMINI_API_KEY from environment.
 * Requires: @google/genai as a dev dependency
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { GoogleGenAI } from '@google/genai';

export type Faction = 'kolkhoz' | 'kgb' | 'army' | 'militsiya' | 'engineer' | 'party_official';
export type Gender = 'female' | 'male' | 'androgynous';
export type Style =
  | 'painted-realistic'
  | 'pixel-art'
  | 'hand-inked'
  | 'ps1-lowpoly-render'
  | 'snes-pixel'
  | 'modern-2d-game-art';

export type SpriteSheetSpec = {
  // character identity
  faction: Faction;
  roleLabel?: string; // e.g. "tractor driver", "field medic", "checkpoint guard"
  gender: Gender;
  age: 'child' | 'teen' | 'young-adult' | 'adult' | 'middle-aged' | 'elder';
  bodyType?: 'slim' | 'average' | 'stocky' | 'strong' | 'curvy';
  ethnicityHint?: string; // keep as art direction, not identity claims

  // outfit + props
  uniformNotes?: string; // e.g. "work apron, headscarf, worn boots"
  props?: string[]; // e.g. ["scythe", "bucket"]
  insigniaNotes?: string; // e.g. "subtle shoulder patch", "no readable text"

  // animation set
  actions: Array<
    'idle' | 'walk' | 'run' | 'carry' | 'work' | 'talk' | 'inspect' | 'salute' | 'hurt' | 'death'
  >;

  // isometric / 2.5D constraints
  iso: {
    camera: 'isometric-2.5d'; // keep rigid for consistency
    directions: 4 | 8; // N/E/S/W or 8-way
    groundAnchor: 'feet'; // for tile grounding
    lighting: 'overcast' | 'noon' | 'studio-soft';
  };

  // sheet layout
  sheet: {
    columns: number; // grid cols
    rows: number; // grid rows
    cellPx: number; // square cell size (e.g. 256)
    paddingPx: number;
    background: 'transparent' | 'solid-neutral';
  };

  // art style + quality
  style: Style;
  paletteNotes?: string; // e.g. "muted soviet palette, drab blues/greens, small red accents"
  lineNotes?: string; // e.g. "clean silhouette, readable at distance"

  // prompt controls
  negative?: string[]; // "don'ts"
};

export type GenerateOptions = {
  model?: string; // e.g. "imagen-4.0-generate-001"
  numberOfImages?: number;
  extraConfig?: Record<string, unknown>;
};

export function createSpritePrompt(spec: SpriteSheetSpec): { prompt: string; negative: string } {
  const factionBlurb: Record<Faction, string> = {
    kolkhoz:
      'Soviet-era kolkhoz agricultural worker. Practical rural clothing, headscarf optional, worn boots, utilitarian posture.',
    kgb: 'Soviet-era KGB officer/agent. Subtle, austere uniform or plainclothes; composed stance; no overt caricature.',
    army: 'Soviet-era Red Army soldier. Standard field uniform; disciplined stance; utilitarian gear.',
    militsiya:
      'Soviet-era Militsiya (police). Practical uniform, authoritative posture, restrained demeanor.',
    engineer:
      'Soviet-era industrial engineer/technician. Work jacket, tool belt optional, industrial practicality.',
    party_official:
      'Soviet-era party official/bureaucrat. Clean coat or suit-like attire, reserved posture, administrative vibe.',
  };

  const propsLine = spec.props?.length ? `Props: ${spec.props.join(', ')}.` : '';
  const uniformLine = spec.uniformNotes ? `Outfit: ${spec.uniformNotes}.` : '';
  const insigniaLine = spec.insigniaNotes ? `Insignia notes: ${spec.insigniaNotes}.` : '';

  const actionsLine = `Actions to include as separate frames (readable silhouettes): ${spec.actions.join(', ')}.`;

  const isoLine = `Camera: strict ${spec.iso.camera} view. Directions: ${spec.iso.directions}-way (evenly spaced). Grounding: ${spec.iso.groundAnchor} anchored consistently to the tile plane. Lighting: ${spec.iso.lighting} consistent across ALL frames.`;

  const sheetLine = `Output: ONE sprite sheet on a strict grid of ${spec.sheet.columns} columns × ${spec.sheet.rows} rows. Each cell is ${spec.sheet.cellPx}×${spec.sheet.cellPx}px with ${spec.sheet.paddingPx}px padding between cells. Background: ${spec.sheet.background}. No extra margins outside the grid.`;

  const styleLine =
    `Style: ${spec.style}. ${spec.paletteNotes ?? ''} ${spec.lineNotes ?? ''}`.trim();

  const negativeDefaults = [
    'no text',
    'no logos',
    'no watermarks',
    'no captions',
    'no borders',
    'no UI',
    'no extra characters',
    'no cluttered background',
    'no motion blur',
    'no extreme foreshortening',
    'no inconsistent lighting',
    'no inconsistent scale between frames',
  ];
  const negative = [...negativeDefaults, ...(spec.negative ?? [])].join('; ');

  const prompt = [
    'Create a game-ready sprite sheet for a 2.5D isometric tile-based game.',
    factionBlurb[spec.faction],
    `Character: ${spec.gender}, ${spec.age}${spec.bodyType ? `, ${spec.bodyType} build` : ''}. ${
      spec.roleLabel ? `Role: ${spec.roleLabel}.` : ''
    } ${spec.ethnicityHint ? `Art direction note: ${spec.ethnicityHint}.` : ''}`.trim(),
    uniformLine,
    propsLine,
    insigniaLine,
    isoLine,
    actionsLine,
    sheetLine,
    styleLine,
    `Hard constraints: ${negative}.`,
    'Ensure each frame is centered in its cell, with consistent pixel density and silhouette readability from a distance.',
  ]
    .filter(Boolean)
    .join('\n');

  return { prompt, negative };
}

// ── Shared Config ─────────────────────────────────────────────────────────

/** Shared isometric camera + grid settings for all character sprites. */
const SHARED_ISO: SpriteSheetSpec['iso'] = {
  camera: 'isometric-2.5d',
  directions: 4,
  groundAnchor: 'feet',
  lighting: 'overcast',
};

/** 4 cols (directions) × 4 rows (actions) = 16 frames per sheet. */
const SHARED_SHEET: SpriteSheetSpec['sheet'] = {
  columns: 4,
  rows: 4,
  cellPx: 128,
  paddingPx: 2,
  background: 'transparent',
};

const SHARED_STYLE: Pick<SpriteSheetSpec, 'style' | 'paletteNotes' | 'lineNotes'> = {
  style: 'modern-2d-game-art',
  paletteNotes:
    'Muted Soviet palette: drab olive, steel blue, faded red accents, weathered browns.',
  lineNotes: 'Clean silhouette, readable at 32px height. Consistent proportions across all sheets.',
};

/** Civilian actions for household members. */
const CIVILIAN_ACTIONS: SpriteSheetSpec['actions'] = ['idle', 'walk', 'carry', 'work'];
/** Authority/force actions. */
const AUTHORITY_ACTIONS: SpriteSheetSpec['actions'] = ['idle', 'walk', 'inspect', 'salute'];
/** Prisoner actions. */
const PRISONER_ACTIONS: SpriteSheetSpec['actions'] = ['idle', 'walk', 'carry', 'hurt'];
/** Child/adolescent actions (no heavy labor). */
const YOUTH_ACTIONS: SpriteSheetSpec['actions'] = ['idle', 'walk', 'talk', 'run'];

// ── Character Spec Definitions ────────────────────────────────────────────

/** filename → SpriteSheetSpec for every character variant in the game. */
const CHARACTER_SPECS: Record<string, SpriteSheetSpec> = {
  // ── Household civilians (dvor members) ──────────────────────────────────

  worker_male_adult: {
    faction: 'kolkhoz',
    roleLabel: 'factory worker or general laborer',
    gender: 'male',
    age: 'adult',
    bodyType: 'stocky',
    uniformNotes: 'Worn work jacket, flat cap, heavy boots, coarse trousers.',
    props: ['shovel'],
    actions: CIVILIAN_ACTIONS,
    iso: SHARED_ISO,
    sheet: SHARED_SHEET,
    ...SHARED_STYLE,
  },
  worker_female_adult: {
    faction: 'kolkhoz',
    roleLabel: 'factory worker or farm laborer',
    gender: 'female',
    age: 'adult',
    bodyType: 'average',
    uniformNotes: 'Work apron over simple dress, headscarf, sturdy boots.',
    props: ['bucket'],
    actions: CIVILIAN_ACTIONS,
    iso: SHARED_ISO,
    sheet: SHARED_SHEET,
    ...SHARED_STYLE,
  },
  worker_male_elder: {
    faction: 'kolkhoz',
    roleLabel: 'retired elder, grandfather figure',
    gender: 'male',
    age: 'elder',
    bodyType: 'slim',
    uniformNotes: 'Old patched coat, ushanka hat, walking stick, weathered face.',
    actions: CIVILIAN_ACTIONS,
    iso: SHARED_ISO,
    sheet: SHARED_SHEET,
    ...SHARED_STYLE,
  },
  worker_female_elder: {
    faction: 'kolkhoz',
    roleLabel: 'babushka, elderly grandmother',
    gender: 'female',
    age: 'elder',
    bodyType: 'stocky',
    uniformNotes: 'Classic babushka headscarf, heavy overcoat, felt boots (valenki), bent posture.',
    actions: CIVILIAN_ACTIONS,
    iso: SHARED_ISO,
    sheet: SHARED_SHEET,
    ...SHARED_STYLE,
  },
  worker_male_adolescent: {
    faction: 'kolkhoz',
    roleLabel: 'teenage boy, Young Pioneer age',
    gender: 'male',
    age: 'teen',
    bodyType: 'slim',
    uniformNotes: 'Pioneer neckerchief, simple shirt, knee-length trousers, canvas shoes.',
    actions: YOUTH_ACTIONS,
    iso: SHARED_ISO,
    sheet: SHARED_SHEET,
    ...SHARED_STYLE,
  },
  worker_female_adolescent: {
    faction: 'kolkhoz',
    roleLabel: 'teenage girl, Young Pioneer age',
    gender: 'female',
    age: 'teen',
    bodyType: 'slim',
    uniformNotes: 'Pioneer neckerchief, simple blouse, pleated skirt, braided hair.',
    actions: YOUTH_ACTIONS,
    iso: SHARED_ISO,
    sheet: SHARED_SHEET,
    ...SHARED_STYLE,
  },
  worker_male_child: {
    faction: 'kolkhoz',
    roleLabel: 'young boy, age 6-10, Little Octobrist',
    gender: 'male',
    age: 'child',
    bodyType: 'slim',
    uniformNotes:
      'Simple shirt, short trousers with suspenders, bare feet or sandals. Small stature.',
    actions: YOUTH_ACTIONS,
    iso: SHARED_ISO,
    sheet: SHARED_SHEET,
    ...SHARED_STYLE,
  },
  worker_female_child: {
    faction: 'kolkhoz',
    roleLabel: 'young girl, age 6-10, Little Octobrist',
    gender: 'female',
    age: 'child',
    bodyType: 'slim',
    uniformNotes:
      'Simple dress with pinafore, ribbon in hair, bare feet or sandals. Small stature.',
    actions: YOUTH_ACTIONS,
    iso: SHARED_ISO,
    sheet: SHARED_SHEET,
    ...SHARED_STYLE,
  },

  // ── Specialist citizen classes ──────────────────────────────────────────

  engineer_male_adult: {
    faction: 'engineer',
    roleLabel: 'power plant technician or factory engineer',
    gender: 'male',
    age: 'adult',
    bodyType: 'average',
    uniformNotes: 'Work jacket with pockets, hard hat or cloth cap, tool belt, clipboard.',
    props: ['wrench'],
    actions: CIVILIAN_ACTIONS,
    iso: SHARED_ISO,
    sheet: SHARED_SHEET,
    ...SHARED_STYLE,
  },
  engineer_female_adult: {
    faction: 'engineer',
    roleLabel: 'factory engineer or technical specialist',
    gender: 'female',
    age: 'adult',
    bodyType: 'average',
    uniformNotes: 'Work jacket, safety goggles pushed up, practical trousers, tool belt.',
    props: ['clipboard'],
    actions: CIVILIAN_ACTIONS,
    iso: SHARED_ISO,
    sheet: SHARED_SHEET,
    ...SHARED_STYLE,
  },
  farmer_male_adult: {
    faction: 'kolkhoz',
    roleLabel: 'kolkhoz tractor driver or field laborer',
    gender: 'male',
    age: 'adult',
    bodyType: 'strong',
    uniformNotes: 'Faded work shirt, straw hat or cloth cap, worn trousers tucked into boots.',
    props: ['scythe'],
    actions: CIVILIAN_ACTIONS,
    iso: SHARED_ISO,
    sheet: SHARED_SHEET,
    ...SHARED_STYLE,
  },
  farmer_female_adult: {
    faction: 'kolkhoz',
    roleLabel: 'kolkhoz field worker, milkmaid',
    gender: 'female',
    age: 'adult',
    bodyType: 'strong',
    uniformNotes: 'Headscarf, work apron, rolled sleeves, heavy boots, tanned skin.',
    props: ['pitchfork'],
    actions: CIVILIAN_ACTIONS,
    iso: SHARED_ISO,
    sheet: SHARED_SHEET,
    ...SHARED_STYLE,
  },

  // ── External force / authority units ────────────────────────────────────

  soldier_male_adult: {
    faction: 'army',
    roleLabel: 'Red Army infantry soldier, garrison duty',
    gender: 'male',
    age: 'young-adult',
    bodyType: 'strong',
    uniformNotes: 'Standard olive field uniform, pilotka side cap, belt with star buckle, boots.',
    props: ['rifle'],
    insigniaNotes: 'Red star on cap, subtle shoulder boards. No readable text.',
    actions: AUTHORITY_ACTIONS,
    iso: SHARED_ISO,
    sheet: SHARED_SHEET,
    ...SHARED_STYLE,
  },
  kgb_male_adult: {
    faction: 'kgb',
    roleLabel: 'KGB field officer, state security agent',
    gender: 'male',
    age: 'middle-aged',
    bodyType: 'average',
    uniformNotes: 'Dark blue suit or long overcoat, fedora hat, leather gloves, stern expression.',
    insigniaNotes: 'Subtle KGB insignia pin. No visible text or large emblems.',
    actions: AUTHORITY_ACTIONS,
    iso: SHARED_ISO,
    sheet: SHARED_SHEET,
    ...SHARED_STYLE,
  },
  party_official_male_adult: {
    faction: 'party_official',
    roleLabel: 'Communist Party bureaucrat, local committee chairman',
    gender: 'male',
    age: 'middle-aged',
    bodyType: 'stocky',
    uniformNotes:
      'Gray suit with party pin on lapel, fur hat or fedora, leather briefcase, portly build.',
    insigniaNotes: 'Small red party membership pin. No readable text.',
    actions: AUTHORITY_ACTIONS,
    iso: SHARED_ISO,
    sheet: SHARED_SHEET,
    ...SHARED_STYLE,
  },
  prisoner_male_adult: {
    faction: 'kolkhoz',
    roleLabel: 'work camp laborer on heavy duty',
    gender: 'male',
    age: 'adult',
    bodyType: 'slim',
    uniformNotes:
      'Gray-blue striped work uniform, shaved head, thin face, heavy boots, hunched posture.',
    actions: PRISONER_ACTIONS,
    iso: SHARED_ISO,
    sheet: SHARED_SHEET,
    ...SHARED_STYLE,
  },
  prisoner_female_adult: {
    faction: 'kolkhoz',
    roleLabel: 'work camp laborer on heavy duty',
    gender: 'female',
    age: 'adult',
    bodyType: 'slim',
    uniformNotes:
      'Gray-blue striped work uniform, headscarf, thin face, worn boots, hunched posture.',
    actions: PRISONER_ACTIONS,
    iso: SHARED_ISO,
    sheet: SHARED_SHEET,
    ...SHARED_STYLE,
  },
};

// ── CLI Entry Point ───────────────────────────────────────────────────────

const OUT_DIR = path.resolve(
  import.meta.dirname ?? __dirname,
  '../app/public/sprites/soviet/characters'
);

async function main() {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('Missing API key. Set GOOGLE_GENAI_API_KEY or GEMINI_API_KEY env variable.');
    console.error(
      'Usage: doppler run --project gha --config ci -- tsx scripts/generateSpriteSheet.ts'
    );
    process.exit(1);
  }

  // Parse optional CLI filter: tsx scripts/generateSpriteSheet.ts [name1] [name2] ...
  const filterNames = process.argv.slice(2);
  const specsToGenerate =
    filterNames.length > 0
      ? Object.entries(CHARACTER_SPECS).filter(([name]) => filterNames.includes(name))
      : Object.entries(CHARACTER_SPECS);

  if (specsToGenerate.length === 0) {
    console.error(`No specs matched filters: ${filterNames.join(', ')}`);
    console.error(`Available: ${Object.keys(CHARACTER_SPECS).join(', ')}`);
    process.exit(1);
  }

  console.log(`Generating ${specsToGenerate.length} sprite sheets to ${OUT_DIR}/`);
  const factory = createSpriteSheetFactory({ apiKey });

  let success = 0;
  let failed = 0;

  for (const [name, spec] of specsToGenerate) {
    const outPath = path.join(OUT_DIR, `${name}.png`);
    console.log(`  [${success + failed + 1}/${specsToGenerate.length}] ${name}...`);
    try {
      await factory.generateToFile(spec, outPath);
      console.log(`    -> ${outPath}`);
      success++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`    FAILED: ${msg}`);
      failed++;
    }
  }

  console.log(
    `\nDone: ${success} generated, ${failed} failed out of ${specsToGenerate.length} total.`
  );
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

// ── Factory (library API) ─────────────────────────────────────────────────

export function createSpriteSheetFactory(args: { apiKey: string }) {
  const ai = new GoogleGenAI({ apiKey: args.apiKey });

  return {
    async generate(spec: SpriteSheetSpec, opts: GenerateOptions = {}) {
      const model = opts.model ?? 'imagen-4.0-generate-001';
      const { prompt } = createSpritePrompt(spec);

      const response = await ai.models.generateImages({
        model,
        prompt,
        config: {
          numberOfImages: opts.numberOfImages ?? 1,
          includeRaiReason: true,
          ...(opts.extraConfig ?? {}),
        } as Parameters<typeof ai.models.generateImages>[0]['config'],
      });

      const bytesB64 = response?.generatedImages?.[0]?.image?.imageBytes;
      if (!bytesB64) {
        throw new Error('No imageBytes returned from generateImages()');
      }
      return Buffer.from(bytesB64, 'base64');
    },

    async generateToFile(spec: SpriteSheetSpec, outPath: string, opts: GenerateOptions = {}) {
      const buf = await this.generate(spec, opts);
      await fs.mkdir(path.dirname(outPath), { recursive: true });
      await fs.writeFile(outPath, buf);
      return outPath;
    },
  };
}
