
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

/**
 * Removes the background from a sprite sheet.
 * Assumes the background color is uniform and matches the corners.
 */
async function removeBackground(filePath: string, threshold: number): Promise<boolean> {
  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const bg = calculateBackgroundColor(data, info.width, info.height, info.channels);
  let modified = false;
  const pixelCount = info.width * info.height;
  const channels = info.channels;
  const newData = Buffer.from(data);

  for (let i = 0; i < pixelCount; i++) {
    const idx = i * channels;
    if (isBackgroundPixel(data, idx, bg, threshold)) {
      newData[idx + 3] = 0; // Set alpha to 0
      modified = true;
    }
  }

  // Alpha erosion to clean up edges
  if (modified) {
    const eroded = erodeAlpha(newData, info.width, info.height, channels);
    await sharp(eroded, {
      raw: {
        width: info.width,
        height: info.height,
        channels: info.channels
      }
    })
    .toFile(filePath);
  }

  return modified;
}

function calculateBackgroundColor(data: Buffer, width: number, height: number, channels: number) {
  let r = 0, g = 0, b = 0;

  // Sample the corners
  const corners = [
    0, // Top-left
    (width - 1) * channels, // Top-right
    (height - 1) * width * channels, // Bottom-left
    (height * width - 1) * channels // Bottom-right
  ];

  for (const idx of corners) {
    r += data[idx];
    g += data[idx + 1];
    b += data[idx + 2];
  }

  return {
    r: Math.round(r / 4),
    g: Math.round(g / 4),
    b: Math.round(b / 4)
  };
}

function isBackgroundPixel(data: Buffer, idx: number, bg: {r: number, g: number, b: number}, threshold: number): boolean {
  const r = data[idx];
  const g = data[idx + 1];
  const b = data[idx + 2];

  const dist = Math.sqrt(
    Math.pow(r - bg.r, 2) +
    Math.pow(g - bg.g, 2) +
    Math.pow(b - bg.b, 2)
  );

  return dist < threshold;
}

function erodeAlpha(data: Buffer, width: number, height: number, channels: number): Buffer {
  const eroded = Buffer.from(data);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * channels;
      // Only erode non-transparent pixels
      if (data[idx + 3] > 0) {
        if (hasTransparentNeighbor(data, x, y, width, channels)) {
          eroded[idx + 3] = 0;
        }
      }
    }
  }
  return eroded;
}

function hasTransparentNeighbor(data: Buffer, x: number, y: number, width: number, channels: number): boolean {
  const neighbors = [
    ((y - 1) * width + x) * channels,
    ((y + 1) * width + x) * channels,
    (y * width + (x - 1)) * channels,
    (y * width + (x + 1)) * channels
  ];

  return neighbors.some(n => data[n + 3] === 0);
}

// ... Rest of the script (main execution)
// For the purpose of this task, I'm just replacing the function logic.
// But since I need to write the file, I should probably read the rest of the file or just output the function if it was a partial file.
// Ah, `removeSpriteBg.ts` is likely a script file.
// I'll read it first to ensure I don't overwrite imports or the main call.
