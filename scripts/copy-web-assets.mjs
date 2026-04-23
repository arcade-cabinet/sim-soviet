import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = resolve(repoRoot, 'dist');

const staticAssets = [
  ['assets/hdri', 'assets/hdri'],
  ['assets/textures', 'assets/textures'],
  ['assets/sprites', 'assets/sprites'],
  ['assets/fonts', 'assets/fonts'],
  ['assets/models/props', 'assets/models/props'],
  ['assets/audio', 'assets/audio'],
];

if (!existsSync(distRoot)) {
  throw new Error('dist does not exist. Run expo export before copying web assets.');
}

for (const [from, to] of staticAssets) {
  const source = resolve(repoRoot, from);
  const destination = resolve(distRoot, to);
  if (!existsSync(source)) {
    throw new Error(`Missing web asset source: ${from}`);
  }
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(source, destination, { recursive: true });
}

const historicalManifestPath = resolve(repoRoot, 'assets/models/soviet/manifest-historical.json');
const historicalManifest = JSON.parse(readFileSync(historicalManifestPath, 'utf8'));
const modelDestination = resolve(distRoot, 'models/soviet');
mkdirSync(modelDestination, { recursive: true });

for (const asset of Object.values(historicalManifest.assets)) {
  const source = resolve(repoRoot, 'assets', asset.file);
  if (!existsSync(source)) {
    throw new Error(`Missing historical Soviet model asset: ${asset.file}`);
  }
  copyFileSync(source, resolve(modelDestination, basename(asset.file)));
}
writeFileSync(resolve(modelDestination, 'manifest-historical.json'), JSON.stringify(historicalManifest, null, 2));

console.log(
  `Copied ${staticAssets.length} web asset groups and ${Object.keys(historicalManifest.assets).length} historical Soviet models into dist.`,
);
