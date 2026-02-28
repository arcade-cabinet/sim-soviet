/**
 * @module scripts/removeSpriteBg
 *
 * Post-processing step for AI-generated character sprite sheets.
 * Converts solid white/near-white backgrounds to true PNG alpha transparency.
 *
 * The problem: AI image generators (Google Imagen) sometimes produce PNGs
 * with a solid white or checkered pattern baked into the pixel data instead
 * of real alpha transparency. This script fixes that by thresholding.
 *
 * Algorithm:
 *   1. Extract raw RGBA pixel data from each PNG
 *   2. For each pixel, if R/G/B are ALL above a luminance threshold (default 240)
 *      AND the pixel is already fully opaque, set alpha to 0
 *   3. Apply a 1px alpha erosion pass to clean up fringing at character edges
 *   4. Write back as PNG with proper alpha channel
 *
 * Usage:
 *   tsx scripts/removeSpriteBg.ts                    # process all character PNGs
 *   tsx scripts/removeSpriteBg.ts kgb_male_adult     # process specific ones
 *   tsx scripts/removeSpriteBg.ts --threshold 230    # adjust sensitivity
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import sharp from 'sharp';

const CHARACTERS_DIR = path.resolve('app/public/sprites/soviet/characters');
const DEFAULT_THRESHOLD = 215; // R, G, B all above this → transparent
// AI generators produce backgrounds at ~230 brightness, not 250.
// Character pixels are generally below 140 brightness. The 140-215 gap is clean.

interface Options {
  threshold: number;
  targets: string[];
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  let threshold = DEFAULT_THRESHOLD;
  const targets: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--threshold' && args[i + 1]) {
      threshold = Number.parseInt(args[i + 1]!, 10);
      i++; // skip next
    } else {
      targets.push(args[i]!.replace(/\.png$/, ''));
    }
  }

  return { threshold, targets };
}

/**
 * Check if a PNG has significant areas of near-white opaque pixels
 * (indicating a baked-in background rather than real alpha).
 */
async function needsProcessing(filePath: string, threshold: number): Promise<boolean> {
  const { data, info } = await sharp(filePath)
    .ensureAlpha() // normalize to 4 channels — raw PNGs may be RGB (3ch)
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.channels !== 4) return true; // shouldn't happen after ensureAlpha

  const totalPixels = info.width * info.height;
  let opaqueWhiteCount = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const a = data[i + 3]!;

    if (a > 250 && r > threshold && g > threshold && b > threshold) {
      opaqueWhiteCount++;
    }
  }

  // If more than 15% of pixels are opaque-white, it needs processing
  const ratio = opaqueWhiteCount / totalPixels;
  return ratio > 0.15;
}

/**
 * Remove white/near-white background by converting those pixels to transparent.
 * Then apply a 1px erosion on the alpha channel to clean edge fringing.
 */
async function removeBackground(filePath: string, threshold: number): Promise<boolean> {
  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  if (channels !== 4) {
    console.warn(`  Skipping ${path.basename(filePath)}: unexpected ${channels} channels`);
    return false;
  }

  const output = Buffer.from(data); // copy
  let modified = 0;

  // Pass 1: Threshold — set near-white opaque pixels to transparent
  for (let i = 0; i < output.length; i += 4) {
    const r = output[i]!;
    const g = output[i + 1]!;
    const b = output[i + 2]!;
    const a = output[i + 3]!;

    if (a > 250 && r > threshold && g > threshold && b > threshold) {
      output[i + 3] = 0; // set alpha to 0
      modified++;
    }
  }

  if (modified === 0) return false;

  // Pass 2: Edge cleanup — erode alpha by 1px to remove white fringing
  // For each pixel that is now opaque but neighbors a transparent pixel,
  // soften its alpha based on how many transparent neighbors it has.
  const cleaned = Buffer.from(output);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      const alpha = output[idx + 3]!;
      if (alpha === 0) continue; // already transparent

      // Count transparent neighbors in a 3×3 kernel
      let transparentNeighbors = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nIdx = ((y + dy) * width + (x + dx)) * 4;
          if (output[nIdx + 3]! === 0) transparentNeighbors++;
        }
      }

      // If surrounded by 3+ transparent pixels, partially fade
      if (transparentNeighbors >= 5) {
        cleaned[idx + 3] = 0; // fully transparent
      } else if (transparentNeighbors >= 3) {
        cleaned[idx + 3] = Math.round(alpha * 0.5);
      }
    }
  }

  // Write back
  await sharp(cleaned, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(filePath);

  return true;
}

async function main() {
  const { threshold, targets } = parseArgs();

  // Discover PNGs to process
  let pngFiles: string[];
  if (targets.length > 0) {
    pngFiles = targets.map((name) => path.join(CHARACTERS_DIR, `${name}.png`));
  } else {
    const entries = await fs.readdir(CHARACTERS_DIR);
    pngFiles = entries.filter((f) => f.endsWith('.png')).map((f) => path.join(CHARACTERS_DIR, f));
  }

  console.log(`removeSpriteBg: Processing ${pngFiles.length} PNGs (threshold=${threshold})`);

  let processed = 0;
  let skipped = 0;

  for (const filePath of pngFiles) {
    const name = path.basename(filePath, '.png');
    try {
      const needs = await needsProcessing(filePath, threshold);
      if (!needs) {
        console.log(`  ✓ ${name} — already has proper alpha, skipping`);
        skipped++;
        continue;
      }

      console.log(`  ⚙ ${name} — removing white background...`);
      const changed = await removeBackground(filePath, threshold);
      if (changed) {
        console.log(`    ✓ ${name} — background removed`);
        processed++;
      } else {
        console.log(`    ○ ${name} — no changes needed after all`);
        skipped++;
      }
    } catch (err) {
      console.error(`  ✗ ${name} — error:`, err);
    }
  }

  console.log(`\nDone: ${processed} processed, ${skipped} skipped`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
