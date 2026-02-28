/**
 * ModelPreloader — Preloads all GLB models from manifest using drei's useGLTF.preload.
 *
 * Exports URL lookup functions so other scene components can load models by name.
 * Preloading happens at module evaluation time (import side-effect).
 */
import { useGLTF } from '@react-three/drei';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import manifest from '../../assets/models/soviet/manifest.json';
import { assetUrl } from '../utils/assetPath';

// Configure Draco decoder for compressed GLBs
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/wasm/draco/');

// drei's useGLTF uses a shared GLTFLoader — configure it with Draco support
const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

// ── Building model URLs (from manifest.json) ──

/** Map of model name → resolved URL for all building models */
export const MODEL_URLS: Record<string, string> = {};

for (const [name, asset] of Object.entries(manifest.assets)) {
  MODEL_URLS[name] = assetUrl(`assets/${asset.file}`);
}

/** Get the resolved URL for a building model by name */
export function getModelUrl(modelName: string): string {
  const url = MODEL_URLS[modelName];
  if (!url) {
    console.warn(`[ModelPreloader] Unknown model name: "${modelName}"`);
    return '';
  }
  return url;
}

/** Total number of building models in the manifest */
export const TOTAL_MODEL_COUNT = Object.keys(manifest.assets).length;

// ── Prop model URLs ──

/** Prop file names from SceneProps.tsx PROP_DEFS */
const PROP_FILES = [
  'Rock_Medium_1.glb',
  'Rock_Medium_2.glb',
  'Rock_Medium_3.glb',
  'Bush_Common.glb',
  'Grass_Common_Short.glb',
  'Grass_Wispy_Short.glb',
  'Mushroom_Common.glb',
  'Cow.glb',
  'Horse_White.glb',
  'Donkey.glb',
  'rad_barrel.glb',
  'rad_sign.glb',
  'rad_debris.glb',
  'rad_glow.glb',
];

/** Map of prop file name → resolved URL */
export const PROP_URLS: Record<string, string> = {};

for (const file of PROP_FILES) {
  PROP_URLS[file] = assetUrl(`assets/models/props/${file}`);
}

/** Get the resolved URL for a prop model by file name */
export function getPropUrl(fileName: string): string {
  const url = PROP_URLS[fileName];
  if (!url) {
    console.warn(`[ModelPreloader] Unknown prop file: "${fileName}"`);
    return '';
  }
  return url;
}

// ── Preload all models at module load time ──
// drei's useGLTF.preload fetches and caches the GLTF data so that
// subsequent useGLTF() calls in scene components resolve instantly.

for (const url of Object.values(MODEL_URLS)) {
  useGLTF.preload(url);
}

for (const url of Object.values(PROP_URLS)) {
  useGLTF.preload(url);
}
