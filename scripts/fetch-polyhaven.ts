#!/usr/bin/env npx tsx
/**
 * Poly Haven Asset Fetcher — reusable pipeline for HDRIs, textures, and models.
 *
 * Usage:
 *   npx tsx scripts/fetch-polyhaven.ts hdri dikhololo_night 1k
 *   npx tsx scripts/fetch-polyhaven.ts texture rock_ground_02 1k
 *   npx tsx scripts/fetch-polyhaven.ts search hdris night,outdoor --limit 20
 *   npx tsx scripts/fetch-polyhaven.ts search textures metal,rust --limit 10
 *   npx tsx scripts/fetch-polyhaven.ts preview dikhololo_night
 *   npx tsx scripts/fetch-polyhaven.ts manifest
 *
 * All assets are CC0 (public domain). See https://polyhaven.com/license
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join, basename } from 'path';

const API = 'https://api.polyhaven.com';
const DL = 'https://dl.polyhaven.org/file/ph-assets';
const PROJECT_ROOT = join(__dirname, '..');
const HDRI_DIR = join(PROJECT_ROOT, 'assets', 'hdri');
const TEXTURE_DIR = join(PROJECT_ROOT, 'assets', 'textures', 'terrain');
const MANIFEST_PATH = join(PROJECT_ROOT, 'assets', 'polyhaven-manifest.json');

// ── Types ────────────────────────────────────────────────────────────────────

interface PHAsset {
  name: string;
  type: number; // 0=HDRI, 1=Texture, 2=Model
  download_count: number;
  categories: string[];
  tags: string[];
  thumbnail_url: string;
}

interface PHFileInfo {
  url: string;
  size: number;
  md5: string;
}

interface ManifestEntry {
  id: string;
  type: 'hdri' | 'texture';
  name: string;
  resolution: string;
  format: string;
  localPath: string;
  categories: string[];
  fetchedAt: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function fetchJSON(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
  return res.json();
}

async function downloadFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  mkdirSync(join(dest, '..'), { recursive: true });
  writeFileSync(dest, buf);
  console.log(`  ✓ ${basename(dest)} (${(buf.length / 1024).toFixed(0)} KB)`);
}

function loadManifest(): ManifestEntry[] {
  if (!existsSync(MANIFEST_PATH)) return [];
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
}

function saveManifest(entries: ManifestEntry[]): void {
  writeFileSync(MANIFEST_PATH, JSON.stringify(entries, null, 2) + '\n');
}

// ── Commands ─────────────────────────────────────────────────────────────────

async function fetchHDRI(id: string, resolution: string = '1k'): Promise<void> {
  console.log(`\nFetching HDRI: ${id} @ ${resolution}`);

  const files = (await fetchJSON(`${API}/files/${id}`)) as Record<string, unknown>;
  const hdriFiles = files.hdri as Record<string, Record<string, PHFileInfo>> | undefined;
  if (!hdriFiles?.[resolution]?.hdr) {
    console.error(`  No ${resolution} HDR file found. Available:`, Object.keys(hdriFiles ?? {}));
    return;
  }

  const url = hdriFiles[resolution].hdr.url;
  const filename = `${id}_${resolution}.hdr`;
  const dest = join(HDRI_DIR, filename);

  if (existsSync(dest)) {
    console.log(`  Already exists: ${dest}`);
    return;
  }

  mkdirSync(HDRI_DIR, { recursive: true });
  await downloadFile(url, dest);

  // Update manifest
  const asset = (await fetchJSON(`${API}/info/${id}`)) as PHAsset;
  const manifest = loadManifest();
  manifest.push({
    id, type: 'hdri', name: asset.name, resolution, format: 'hdr',
    localPath: `assets/hdri/${filename}`,
    categories: asset.categories ?? [],
    fetchedAt: new Date().toISOString(),
  });
  saveManifest(manifest);
  console.log(`  Added to polyhaven-manifest.json`);
}

async function fetchTexture(id: string, resolution: string = '1k'): Promise<void> {
  console.log(`\nFetching texture: ${id} @ ${resolution}`);

  const files = (await fetchJSON(`${API}/files/${id}`)) as Record<string, unknown>;

  // Textures have map types: Diffuse, Normal, Roughness, AO, Displacement, etc.
  // Structure: { "Diffuse": { "1k": { "jpg": { url, size } } }, ... }
  const mapTypes = ['Diffuse', 'nor_gl', 'Rough', 'AO', 'Displacement', 'Metalness'];
  const destDir = join(TEXTURE_DIR, id);
  mkdirSync(destDir, { recursive: true });

  let downloaded = 0;
  for (const mapType of mapTypes) {
    const mapData = (files as Record<string, Record<string, Record<string, PHFileInfo>>>)[mapType];
    if (!mapData?.[resolution]) continue;

    // Prefer jpg, fall back to png
    const format = mapData[resolution].jpg ? 'jpg' : mapData[resolution].png ? 'png' : null;
    if (!format) continue;

    const fileInfo = mapData[resolution][format];
    const suffix = mapType === 'Diffuse' ? 'Color' : mapType === 'nor_gl' ? 'NormalGL' : mapType === 'Rough' ? 'Roughness' : mapType === 'AO' ? 'AmbientOcclusion' : mapType;
    const filename = `${id}_${resolution.toUpperCase()}-JPG_${suffix}.${format}`;
    const dest = join(destDir, filename);

    if (existsSync(dest)) {
      console.log(`  Already exists: ${basename(dest)}`);
      downloaded++;
      continue;
    }

    await downloadFile(fileInfo.url, dest);
    downloaded++;
  }

  if (downloaded > 0) {
    const asset = (await fetchJSON(`${API}/info/${id}`)) as PHAsset;
    const manifest = loadManifest();
    manifest.push({
      id, type: 'texture', name: asset.name, resolution, format: 'jpg',
      localPath: `assets/textures/terrain/${id}/`,
      categories: asset.categories ?? [],
      fetchedAt: new Date().toISOString(),
    });
    saveManifest(manifest);
    console.log(`  Added to polyhaven-manifest.json (${downloaded} maps)`);
  }
}

async function searchAssets(type: string, categories: string, limit: number = 20): Promise<void> {
  const typeNum = type === 'hdris' ? 0 : type === 'textures' ? 1 : 2;
  const url = `${API}/assets?type=${typeNum}${categories ? `&categories=${categories}` : ''}`;
  const assets = (await fetchJSON(url)) as Record<string, PHAsset>;

  const sorted = Object.entries(assets)
    .sort(([, a], [, b]) => b.download_count - a.download_count)
    .slice(0, limit);

  console.log(`\n${type.toUpperCase()} — ${categories || 'all'} (top ${sorted.length} by downloads)\n`);
  for (const [id, asset] of sorted) {
    const tags = asset.tags?.slice(0, 5).join(', ') ?? '';
    console.log(`  ${id.padEnd(40)} ${String(asset.download_count).padStart(8)} DL  [${tags}]`);
    console.log(`    ${asset.thumbnail_url}`);
  }
}

async function showPreview(id: string): Promise<void> {
  const asset = (await fetchJSON(`${API}/info/${id}`)) as PHAsset;
  console.log(`\n${asset.name} (${id})`);
  console.log(`  Type: ${['HDRI', 'Texture', 'Model'][asset.type]}`);
  console.log(`  Downloads: ${asset.download_count}`);
  console.log(`  Categories: ${asset.categories?.join(', ')}`);
  console.log(`  Tags: ${asset.tags?.join(', ')}`);
  console.log(`  Thumbnail: ${asset.thumbnail_url}`);
}

function showManifest(): void {
  const manifest = loadManifest();
  if (manifest.length === 0) {
    console.log('\nNo Poly Haven assets fetched yet.');
    return;
  }
  console.log(`\nPoly Haven Assets (${manifest.length} total)\n`);
  for (const entry of manifest) {
    console.log(`  [${entry.type.toUpperCase()}] ${entry.id} — ${entry.name} (${entry.resolution}, ${entry.format})`);
    console.log(`    ${entry.localPath}`);
  }
}

// ── Sync from requirements manifest ──────────────────────────────────────────

interface RequirementEntry {
  id: string;
  resolution: string;
  role: string;
  mapping: Record<string, unknown>;
  notes: string;
  source?: string;
  existing?: boolean;
}

interface Requirements {
  hdris: RequirementEntry[];
  textures: RequirementEntry[];
}

async function syncFromRequirements(): Promise<void> {
  const reqPath = join(PROJECT_ROOT, 'assets', 'polyhaven-requirements.json');
  if (!existsSync(reqPath)) {
    console.error('No polyhaven-requirements.json found');
    return;
  }

  const req: Requirements = JSON.parse(readFileSync(reqPath, 'utf8'));
  let fetched = 0;
  let skipped = 0;
  let failed = 0;

  console.log('\n═══ Syncing from polyhaven-requirements.json ═══\n');

  // Sync HDRIs
  for (const entry of req.hdris) {
    if (entry.existing) { skipped++; continue; }
    const dest = join(HDRI_DIR, `${entry.id}_${entry.resolution}.hdr`);
    if (existsSync(dest)) { skipped++; continue; }
    try {
      await fetchHDRI(entry.id, entry.resolution);
      fetched++;
    } catch (err) {
      console.error(`  ✗ HDRI ${entry.id}: ${(err as Error).message}`);
      failed++;
    }
  }

  // Sync textures (Poly Haven source only — AmbientCG ones are existing/manual)
  for (const entry of req.textures) {
    if (entry.existing || entry.source === 'ambientcg') { skipped++; continue; }
    const destDir = join(TEXTURE_DIR, entry.id);
    if (existsSync(destDir)) { skipped++; continue; }
    try {
      await fetchTexture(entry.id, entry.resolution);
      fetched++;
    } catch (err) {
      console.error(`  ✗ Texture ${entry.id}: ${(err as Error).message}`);
      failed++;
    }
  }

  console.log(`\n═══ Sync complete: ${fetched} fetched, ${skipped} skipped, ${failed} failed ═══\n`);
}

// ── CLI ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const [, , command, ...args] = process.argv;

  switch (command) {
    case 'hdri':
      return fetchHDRI(args[0], args[1] ?? '1k');
    case 'texture':
      return fetchTexture(args[0], args[1] ?? '1k');
    case 'search':
      return searchAssets(args[0], args[1] ?? '', parseInt(args[2] ?? '20'));
    case 'preview':
      return showPreview(args[0]);
    case 'manifest':
      return void showManifest();
    case 'sync':
      return syncFromRequirements();
    default:
      console.log(`
Poly Haven Asset Fetcher — Declarative asset pipeline for SimSoviet 1917

Usage:
  pnpm tsx scripts/fetch-polyhaven.ts sync                      Fetch all missing assets from requirements
  pnpm tsx scripts/fetch-polyhaven.ts hdri <id> [resolution]     Download single HDRI (.hdr)
  pnpm tsx scripts/fetch-polyhaven.ts texture <id> [resolution]  Download single PBR texture set
  pnpm tsx scripts/fetch-polyhaven.ts search <type> [categories] Search Poly Haven catalog
  pnpm tsx scripts/fetch-polyhaven.ts preview <id>               Show asset info + thumbnail URL
  pnpm tsx scripts/fetch-polyhaven.ts manifest                   List all fetched assets

Workflow:
  1. Declare needed assets in assets/polyhaven-requirements.json
  2. Run 'sync' to download everything missing
  3. Fetched assets tracked in assets/polyhaven-manifest.json
  4. All assets CC0 (public domain) — https://polyhaven.com/license
`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
