/**
 * scripts/enrich-narratives.ts
 *
 * Dev script: enrich narrative milestone scenes via Gemini 2.5 Flash,
 * writing results to src/config/narrativeEnrichments.json.
 *
 * Uses Gemini structured output (responseJsonSchema) to guarantee clean JSON —
 * no markdown bleed, no truncated prose, no formatting surprises.
 *
 * Usage:
 *   GEMINI_API_KEY=... pnpm run enrich-narratives
 *   GEMINI_API_KEY=... pnpm run enrich-narratives -- --force
 *   GEMINI_API_KEY=... pnpm run enrich-narratives -- --milestone ancient_plague
 *   GEMINI_API_KEY=... pnpm run enrich-narratives -- --timeline worldTimeline
 *   GEMINI_API_KEY=... pnpm run enrich-narratives -- --concurrency 5
 *
 * Flags:
 *   --force          Re-enrich all milestones, overwriting cache
 *   --milestone <id> Single milestone by ID
 *   --timeline <id>  Only milestones from one timeline (filename prefix)
 *   --concurrency <n> Parallel requests (default 3, max 5)
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

// ─── Config ──────────────────────────────────────────────────────────────────

const ROOT = resolve(import.meta.dirname, '..');
const CONFIG_DIR = resolve(ROOT, 'src/config');
const ENRICHMENTS_PATH = resolve(CONFIG_DIR, 'narrativeEnrichments.json');

const GEMINI_MODEL = 'gemini-2.5-flash-preview-05-20';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const TIMELINE_FILES = [
  'worldTimeline.json',
];

// ─── Response schema (Gemini structured output) ───────────────────────────────

/**
 * JSON Schema passed to Gemini as responseJsonSchema.
 * Forces the model to return a clean object — no markdown, no prose wrapping.
 *
 * scene: The enriched 3-4 paragraph narrative prose.
 * synopsis: One sentence (≤25 words) for use as a compact toast/ticker fallback.
 */
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    scene: {
      type: 'string',
      description: '3-4 paragraphs of dramatic Soviet narrative prose. Plain text, no headers.',
    },
    synopsis: {
      type: 'string',
      description:
        'One sentence (under 25 words) summarising the event for the Pravda ticker.',
    },
  },
  required: ['scene', 'synopsis'],
};

// ─── Arg parsing ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const force = args.includes('--force');
const milestoneFilter = args.includes('--milestone')
  ? args[args.indexOf('--milestone') + 1]
  : null;
const timelineFilter = args.includes('--timeline')
  ? args[args.indexOf('--timeline') + 1]
  : null;
const concurrencyArg = args.includes('--concurrency')
  ? parseInt(args[args.indexOf('--concurrency') + 1], 10)
  : 3;
const concurrency = Math.min(Math.max(1, concurrencyArg || 3), 5);

// ─── Types ───────────────────────────────────────────────────────────────────

interface NarrativeChoice {
  id: string;
  label: string;
  description: string;
  successChance: number;
}

interface Milestone {
  id: string;
  name: string;
  effects: {
    narrative: {
      pravdaHeadline: string;
      scene?: string;
      choices?: NarrativeChoice[];
    };
  };
}

interface TimelineFile {
  milestones?: Milestone[];
  timelineId?: string;
}

interface EnrichmentEntry {
  scene: string;
  synopsis: string;
}

interface EnrichmentsFile {
  version: string;
  enrichments: Record<string, EnrichmentEntry>;
}

interface NarrativeMilestone {
  milestoneId: string;
  timelineId: string;
  title: string;
  headline: string;
  scene: string;
  choices: NarrativeChoice[];
}

// ─── Load / save enrichments ─────────────────────────────────────────────────

function loadEnrichments(): EnrichmentsFile {
  try {
    return JSON.parse(readFileSync(ENRICHMENTS_PATH, 'utf8')) as EnrichmentsFile;
  } catch {
    return { version: '1', enrichments: {} };
  }
}

function saveEnrichments(data: EnrichmentsFile): void {
  writeFileSync(ENRICHMENTS_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// ─── Collect milestones with narrative scenes ─────────────────────────────────

function collectNarrativeMilestones(): NarrativeMilestone[] {
  const results: NarrativeMilestone[] = [];

  for (const filename of TIMELINE_FILES) {
    if (timelineFilter && !filename.startsWith(timelineFilter)) continue;

    let data: TimelineFile;
    try {
      data = JSON.parse(readFileSync(resolve(CONFIG_DIR, filename), 'utf8')) as TimelineFile;
    } catch {
      continue;
    }

    const timelineId = data.timelineId ?? filename.replace('.json', '');

    for (const milestone of data.milestones ?? []) {
      const { narrative } = milestone.effects;
      if (!narrative.scene || !narrative.choices?.length) continue;
      if (milestoneFilter && milestone.id !== milestoneFilter) continue;

      results.push({
        milestoneId: milestone.id,
        timelineId,
        title: milestone.name,
        headline: narrative.pravdaHeadline,
        scene: narrative.scene,
        choices: narrative.choices,
      });
    }
  }

  return results;
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

/**
 * System instruction: sets the model's persistent persona for the session.
 * Loaded once, not repeated per request.
 */
const SYSTEM_INSTRUCTION = `You are a narrative writer for SimSoviet 1917, an alternate-history Soviet bureaucrat survival simulation. The game spans 1917 to the deep future. The player character is a predsedatel (collective farm chairman) — a minor bureaucrat managing a remote settlement. They survive through careful mediocrity, selective corruption, and judicious cowardice.

Your prose voice:
- Soviet bureaucratic language: passive constructions, passive-aggressive formality, euphemism for catastrophe
- Mixed with eyewitness documentary tone: specific sensory details, bureaucratic objects (forms, stamps, reports)
- Historically and scientifically grounded — no anachronisms, no magical thinking
- Moral ambiguity throughout: the system is both oppressor and protector
- Dread is the baseline; optimism is suspicious
- Short paragraphs. Never more than 4 sentences per paragraph.`;

function buildPrompt(m: NarrativeMilestone): string {
  return `Expand this narrative event for the "${m.timelineId}" timeline.

EVENT: ${m.title}
PRAVDA HEADLINE: ${m.headline}
EVENT ID: ${m.milestoneId}

ORIGINAL SCENE (your source material — expand and dramatize, don't summarize):
${m.scene}

PLAYER CHOICES (foreshadow these options thematically, DO NOT name them explicitly):
${m.choices.map((c) => `• ${c.label} (${Math.round(c.successChance * 100)}% success): ${c.description}`).join('\n')}

Write the enriched scene and a Pravda synopsis. The final line of the scene should function as the dispatch arriving at the chairman's desk.`;
}

// ─── Gemini API call ─────────────────────────────────────────────────────────

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  error?: { code: number; message: string };
  usageMetadata?: { totalTokenCount?: number };
}

async function callGemini(
  apiKey: string,
  prompt: string,
): Promise<EnrichmentEntry> {
  const url = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.85,
      maxOutputTokens: 700,
      responseMimeType: 'application/json',
      responseJsonSchema: RESPONSE_SCHEMA,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = (await res.json()) as GeminiResponse;
  if (data.error) throw new Error(`API error ${data.error.code}: ${data.error.message}`);

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
  if (!text) throw new Error('Empty response from Gemini');

  const parsed = JSON.parse(text) as EnrichmentEntry;
  if (!parsed.scene || !parsed.synopsis) throw new Error('Response missing required fields');
  return parsed;
}

// ─── Concurrency pool ────────────────────────────────────────────────────────

async function runPool<T>(
  items: T[],
  fn: (item: T, index: number) => Promise<void>,
  limit: number,
): Promise<void> {
  let cursor = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (cursor < items.length) {
        const i = cursor++;
        await fn(items[i], i);
      }
    }),
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY ?? '';
  if (!apiKey) {
    console.error('Error: GEMINI_API_KEY not set.');
    process.exit(1);
  }

  const milestones = collectNarrativeMilestones();
  const enrichments = loadEnrichments();

  const toEnrich = milestones.filter(
    (m) => force || !enrichments.enrichments[m.milestoneId],
  );

  console.log(`Model: ${GEMINI_MODEL}`);
  console.log(`Milestones found: ${milestones.length} | To enrich: ${toEnrich.length} | Concurrency: ${concurrency}`);

  if (toEnrich.length === 0) {
    console.log('Nothing to do. Use --force to regenerate existing entries.');
    return;
  }

  let done = 0;
  const errors: string[] = [];

  await runPool(
    toEnrich,
    async (m, _i) => {
      const label = `[${done + 1}/${toEnrich.length}] ${m.milestoneId}`;
      process.stdout.write(`  ${label}...`);
      try {
        const result = await callGemini(apiKey, buildPrompt(m));
        enrichments.enrichments[m.milestoneId] = result;
        done++;
        // Persist after each success — partial results survive Ctrl-C
        saveEnrichments(enrichments);
        console.log(` ✓ (${result.scene.length} chars)`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${m.milestoneId}: ${msg}`);
        console.log(` ✗ ${msg}`);
      }
    },
    concurrency,
  );

  console.log(`\nDone: ${done}/${toEnrich.length} enriched.`);
  if (errors.length) {
    console.log('Failures:');
    for (const e of errors) console.log(`  ${e}`);
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
