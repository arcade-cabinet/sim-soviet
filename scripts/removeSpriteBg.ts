import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

/**
 * Removes the background color (magenta/purple) from sprites.
 * Scans the image for the background color and sets alpha to 0.
 * Then apply a 1px erosion on the alpha channel to clean edge fringing.
 */
async function removeBackground(filePath: string, threshold: number): Promise<boolean> {
  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixelCount = info.width * info.height;
  let modified = false;

  // Background color to remove (Magenta #FF00FF / rgb(255, 0, 255))
  // The threshold allows for some compression artifacts if source isn't perfect png
  const targetR = 255;
  const targetG = 0;
  const targetB = 255;

  modified = processPixels(data, pixelCount, targetR, targetG, targetB, threshold);

  if (modified) {
    // Save the modified buffer back to a file
    await sharp(data, {
      raw: {
        width: info.width,
        height: info.height,
        channels: 4
      }
    })
    .png()
    .toFile(filePath);

    console.log(`Processed: ${path.basename(filePath)}`);
    return true;
  }

  return false;
}

function processPixels(
  data: Buffer,
  pixelCount: number,
  targetR: number,
  targetG: number,
  targetB: number,
  threshold: number
): boolean {
  let modified = false;

  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4;
    const r = data[offset]!;
    const g = data[offset + 1]!;
    const b = data[offset + 2]!;

    if (
      Math.abs(r - targetR) < threshold &&
      Math.abs(g - targetG) < threshold &&
      Math.abs(b - targetB) < threshold
    ) {
      data[offset + 3] = 0; // Set Alpha to 0
      modified = true;
    }
  }

  return modified;
}

// Main execution
(async () => {
  const directory = process.argv[2];
  if (!directory) {
    console.error('Please provide a directory path.');
    process.exit(1);
  }

  try {
    const files = await fs.readdir(directory);
    for (const file of files) {
      if (file.endsWith('.png')) {
        await removeBackground(path.join(directory, file), 30);
      }
    }
    console.log('Background removal complete.');
  } catch (err) {
    console.error('Error processing files:', err);
  }
})();
