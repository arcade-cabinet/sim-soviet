#!/usr/bin/env node
/**
 * optimize-assets.mjs — Build-time GLB optimization pipeline.
 *
 * Applies Draco mesh compression and KTX2/Basis Universal texture compression
 * to all GLB models in assets/models/soviet/, outputting optimized copies to
 * assets-optimized/models/soviet/.
 *
 * Usage:
 *   node scripts/optimize-assets.mjs
 *   pnpm optimize-assets
 */

import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { resolve, join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { draco, textureCompress, dedup, prune, quantize } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const INPUT_DIR = join(ROOT, 'assets', 'models', 'soviet');
const OUTPUT_DIR = join(ROOT, 'assets-optimized', 'models', 'soviet');

// Also process public/models/soviet/ if it exists
const PUBLIC_INPUT_DIR = join(ROOT, 'public', 'models', 'soviet');
const PUBLIC_OUTPUT_DIR = join(ROOT, 'public-optimized', 'models', 'soviet');

/** Format bytes as a human-readable string */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Get all .glb files from a directory */
async function getGlbFiles(dir) {
  try {
    const entries = await readdir(dir);
    return entries.filter((f) => f.endsWith('.glb')).sort();
  } catch {
    return [];
  }
}

/** Process a single GLB file with Draco + texture compression */
async function processGlb(io, inputPath, outputPath) {
  const document = await io.read(inputPath);

  // Remove unused data
  await document.transform(
    prune(),
    dedup(),
  );

  // Quantize vertex attributes for smaller output
  await document.transform(
    quantize(),
  );

  // Apply Draco mesh compression (~80% geometry reduction)
  await document.transform(
    draco({
      quantizePosition: 14,
      quantizeNormal: 10,
      quantizeTexcoord: 12,
      quantizeColor: 8,
    }),
  );

  // Compress textures to WebP (KTX2/Basis requires gpu-compressed textures
  // which need additional tooling; WebP is a practical intermediate step
  // that works universally and still provides significant savings)
  await document.transform(
    textureCompress({
      encoder: sharp,
      targetFormat: 'webp',
      quality: 80,
    }),
  );

  // Ensure output directory exists
  await mkdir(dirname(outputPath), { recursive: true });

  // Write optimized GLB
  await io.write(outputPath, document);
}

/** Process all GLBs in a directory */
async function processDirectory(inputDir, outputDir, label) {
  const files = await getGlbFiles(inputDir);
  if (files.length === 0) {
    console.log(`\n  No .glb files found in ${inputDir}, skipping.\n`);
    return { totalBefore: 0, totalAfter: 0, count: 0 };
  }

  console.log(`\n  Processing ${files.length} GLB files from ${label}...`);
  console.log('  ' + '='.repeat(70));

  // Initialize glTF-Transform I/O with Draco support
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'draco3d.decoder': await draco3d.createDecoderModule(),
      'draco3d.encoder': await draco3d.createEncoderModule(),
    });

  let totalBefore = 0;
  let totalAfter = 0;
  let processed = 0;

  for (const file of files) {
    const inputPath = join(inputDir, file);
    const outputPath = join(outputDir, file);

    try {
      const beforeStat = await stat(inputPath);
      const beforeSize = beforeStat.size;

      await processGlb(io, inputPath, outputPath);

      const afterStat = await stat(outputPath);
      const afterSize = afterStat.size;

      const reduction = ((1 - afterSize / beforeSize) * 100).toFixed(1);

      totalBefore += beforeSize;
      totalAfter += afterSize;
      processed++;

      const arrow = afterSize < beforeSize ? '\x1b[32m->\x1b[0m' : '\x1b[33m->\x1b[0m';
      console.log(
        `  [${String(processed).padStart(2)}/${files.length}] ${file.padEnd(35)} ` +
          `${formatBytes(beforeSize).padStart(10)} ${arrow} ${formatBytes(afterSize).padStart(10)} ` +
          `(${reduction}% reduction)`,
      );
    } catch (err) {
      console.error(`  \x1b[31mERROR\x1b[0m processing ${file}: ${err.message}`);
    }
  }

  return { totalBefore, totalAfter, count: processed };
}

/** Copy manifest.json alongside optimized GLBs */
async function copyManifest(inputDir, outputDir) {
  const manifestPath = join(inputDir, 'manifest.json');
  try {
    const data = await readFile(manifestPath);
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, 'manifest.json'), data);
  } catch {
    // No manifest to copy — that's fine
  }
}

// ── Main ──

async function main() {
  console.log('\n\x1b[1m  SimSoviet 1917 — Asset Optimization Pipeline\x1b[0m');
  console.log('  Draco mesh compression + WebP texture compression\n');

  const startTime = Date.now();

  // Process assets/models/soviet/
  const result1 = await processDirectory(INPUT_DIR, OUTPUT_DIR, 'assets/models/soviet');
  await copyManifest(INPUT_DIR, OUTPUT_DIR);

  // Process public/models/soviet/
  const result2 = await processDirectory(PUBLIC_INPUT_DIR, PUBLIC_OUTPUT_DIR, 'public/models/soviet');
  await copyManifest(PUBLIC_INPUT_DIR, PUBLIC_OUTPUT_DIR);

  // Summary
  const totalBefore = result1.totalBefore + result2.totalBefore;
  const totalAfter = result1.totalAfter + result2.totalAfter;
  const totalCount = result1.count + result2.count;
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n  ' + '='.repeat(70));
  console.log('\x1b[1m  OPTIMIZATION COMPLETE\x1b[0m');
  console.log(`  Files processed: ${totalCount}`);
  console.log(`  Total before:    ${formatBytes(totalBefore)}`);
  console.log(`  Total after:     ${formatBytes(totalAfter)}`);
  if (totalBefore > 0) {
    const totalReduction = ((1 - totalAfter / totalBefore) * 100).toFixed(1);
    console.log(`  Total reduction: \x1b[32m${totalReduction}%\x1b[0m`);
  }
  console.log(`  Time elapsed:    ${elapsed}s`);
  console.log(`  Output:          assets-optimized/models/soviet/`);
  if (result2.count > 0) {
    console.log(`                   public-optimized/models/soviet/`);
  }
  console.log('');
}

main().catch((err) => {
  console.error('\n  \x1b[31mFATAL ERROR:\x1b[0m', err.message);
  console.error(err.stack);
  process.exit(1);
});
