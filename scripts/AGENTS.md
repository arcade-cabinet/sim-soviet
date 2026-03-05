# Scripts — Agent Index

> Scan headers: `head -20 scripts/*.ts scripts/*.mjs`

## How to Use This Index

Scripts are developer-facing CLI tools for asset management, optimization, and content enrichment. They are NOT part of the game runtime — they run in Node.js during development or CI.

## Scripts

| Script | Purpose | Runtime | Dependencies |
|--------|---------|---------|--------------|
| `fetch-polyhaven.ts` | Poly Haven asset pipeline (HDRIs, textures, models) | Node.js + tsx | Node.js fetch API |
| `optimize-assets.mjs` | GLB optimization (Draco + WebP compression) | Node.js | @gltf-transform/core, draco3dgltf, sharp |
| `enrich-narratives.ts` | AI-powered narrative scene enrichment | Node.js + tsx | Gemini 2.5 Flash API |

---

### fetch-polyhaven.ts

Declarative asset pipeline for downloading CC0-licensed HDRIs, PBR textures, and 3D models from [Poly Haven](https://polyhaven.com).

**Commands:**

| Command | Description | Example |
|---------|-------------|---------|
| `sync` | Fetch all missing assets from `polyhaven-requirements.json` | `pnpm tsx scripts/fetch-polyhaven.ts sync` |
| `hdri <id> [res]` | Download a single HDRI (.hdr) | `pnpm tsx scripts/fetch-polyhaven.ts hdri dikhololo_night 1k` |
| `texture <id> [res]` | Download a PBR texture set (Diffuse, Normal, Rough, AO, etc.) | `pnpm tsx scripts/fetch-polyhaven.ts texture rock_ground_02 1k` |
| `search <type> [categories]` | Search the Poly Haven catalog by type and category | `pnpm tsx scripts/fetch-polyhaven.ts search hdris night,outdoor --limit 20` |
| `preview <id>` | Show asset info, tags, and thumbnail URL | `pnpm tsx scripts/fetch-polyhaven.ts preview dikhololo_night` |
| `manifest` | List all previously fetched assets | `pnpm tsx scripts/fetch-polyhaven.ts manifest` |

**Workflow:**
1. Declare needed assets in `assets/polyhaven-requirements.json` (id, resolution, role, mapping)
2. Run `sync` to download everything missing
3. Fetched assets tracked in `assets/polyhaven-manifest.json` with checksums
4. All assets are CC0 (public domain)

**Output locations:**
- HDRIs: `assets/hdri/`
- Textures: `assets/textures/terrain/<id>/`
- Models: `assets/models/polyhaven/`

---

### optimize-assets.mjs

Build-time GLB optimization pipeline. Applies Draco mesh compression and WebP texture compression to all GLB models, producing optimized copies for production deployment.

**Usage:**
```bash
node scripts/optimize-assets.mjs
# or
pnpm optimize-assets
```

**Pipeline stages:**
1. **Prune** — remove unused nodes, materials, accessors
2. **Dedup** — deduplicate identical resources
3. **Quantize** — reduce vertex attribute precision (position 14-bit, normal 10-bit, texcoord 12-bit)
4. **Draco compression** — ~80% geometry size reduction
5. **WebP texture compression** — quality 80, universal browser support

**Input/output:**
- `assets/models/soviet/` -> `assets-optimized/models/soviet/`
- `public/models/soviet/` -> `public-optimized/models/soviet/` (if exists)
- Copies `manifest.json` alongside optimized GLBs

**Dependencies:** `@gltf-transform/core`, `@gltf-transform/extensions`, `@gltf-transform/functions`, `draco3dgltf`, `sharp`

---

### enrich-narratives.ts

Dev-time script that enriches narrative milestone scenes using Gemini 2.5 Flash. Reads timeline JSON files from `src/config/`, sends milestone scenes to Gemini with structured output constraints, and writes enriched prose back to `src/config/narrativeEnrichments.json`.

**Usage:**
```bash
GEMINI_API_KEY=... pnpm run enrich-narratives                        # Enrich new milestones only
GEMINI_API_KEY=... pnpm run enrich-narratives -- --force             # Re-enrich all milestones
GEMINI_API_KEY=... pnpm run enrich-narratives -- --milestone <id>    # Single milestone
GEMINI_API_KEY=... pnpm run enrich-narratives -- --timeline <id>     # One timeline only
GEMINI_API_KEY=... pnpm run enrich-narratives -- --concurrency 5     # Parallel requests (max 5)
```

**Flags:**

| Flag | Description | Default |
|------|-------------|---------|
| `--force` | Re-enrich all milestones, overwriting cache | off |
| `--milestone <id>` | Process a single milestone by ID | all |
| `--timeline <id>` | Only milestones from one timeline (filename prefix) | all |
| `--concurrency <n>` | Parallel API requests (1-5) | 3 |

**How it works:**
1. Scans 11 timeline JSON files in `src/config/` for milestones with narrative scenes and choices
2. Skips milestones already in `narrativeEnrichments.json` (unless `--force`)
3. Sends each milestone to Gemini with a Soviet bureaucratic prose persona
4. Gemini returns structured JSON (`scene` + `synopsis`) via `responseJsonSchema`
5. Persists after each success — partial results survive Ctrl-C

**Requirements:** `GEMINI_API_KEY` environment variable (Gemini 2.5 Flash)

**Timeline files scanned:** worldTimeline, spaceTimeline, lunarTimeline, marsTimeline, jupiterTimeline, titanTimeline, venusTimeline, beltTimeline, exoplanetTimeline, generationShipTimeline, ecology
