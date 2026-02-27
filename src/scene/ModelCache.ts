/**
 * ModelCache — preloads all GLB models from manifest and provides clone/dispose API.
 *
 * Template meshes are loaded once, hidden, and stored in a Map.
 * cloneModel() creates visible copies by cloning each mesh individually
 * and parenting them to a new TransformNode.
 *
 * BabylonJS 8 notes:
 * - TransformNode.clone() does NOT clone children
 * - instantiateHierarchy() on disabled nodes creates non-rendering instances
 * - Explicit per-mesh Mesh.clone() is the reliable approach
 */
import {
  ImportMeshAsync,
  TransformNode,
  type Scene,
  type AbstractMesh,
  type Mesh,
} from '@babylonjs/core';
import '@babylonjs/loaders';

import manifest from '../../assets/models/soviet/manifest.json';

/** Root container for each loaded model template */
interface ModelTemplate {
  root: TransformNode;
  meshes: AbstractMesh[];
  scene: Scene;
}

const templates = new Map<string, ModelTemplate>();
let preloaded = false;
let loadedCount = 0;

/** Progress callback: (loaded, total, currentModelName) */
export type ModelLoadProgress = (loaded: number, total: number, name: string) => void;

/**
 * Preload all GLB models from the manifest.
 * Template meshes are made invisible (isVisible=false) but stay enabled
 * so they can be cloned.
 */
export async function preloadModels(
  scene: Scene,
  baseUrl: string = '',
  onProgress?: ModelLoadProgress,
): Promise<void> {
  if (preloaded) return;

  const entries = Object.entries(manifest.assets) as [
    string,
    { file: string; source: string; role: string; texture: string },
  ][];

  const total = entries.length;

  // Load models in batches to avoid overwhelming the loader
  const BATCH_SIZE = 8;
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async ([name, asset]) => {
        try {
          const url = baseUrl ? `${baseUrl}/${asset.file}` : asset.file;
          const result = await ImportMeshAsync(url, scene);

          // The first transform node or mesh is the __root__
          const root = result.transformNodes[0] ?? result.meshes[0];

          // Hide template meshes — they serve only as clone sources.
          // Use isVisible=false (not setEnabled) so meshes remain clonable.
          for (const mesh of result.meshes) {
            mesh.isVisible = false;
          }

          templates.set(name, {
            root: root as TransformNode,
            meshes: result.meshes,
            scene,
          });
          loadedCount++;
          onProgress?.(loadedCount, total, name);
        } catch (err) {
          console.warn(`[ModelCache] Failed to load model "${name}":`, err);
          loadedCount++;
          onProgress?.(loadedCount, total, name);
        }
      }),
    );
  }

  preloaded = true;
}

/** Get total number of models in the manifest. */
export function getTotalModelCount(): number {
  return Object.keys(manifest.assets).length;
}

/**
 * Clone a preloaded model template by individually cloning each mesh.
 * Returns the root TransformNode of the clone, or null if template is missing.
 */
export function cloneModel(
  name: string,
  instanceId: string,
): TransformNode | null {
  const template = templates.get(name);
  if (!template) {
    return null;
  }

  // Create a fresh parent TransformNode for the cloned meshes
  const parent = new TransformNode(`${name}_${instanceId}`, template.scene);

  let clonedAny = false;
  for (const mesh of template.meshes) {
    const verts = mesh.getTotalVertices();
    // Skip container nodes with no geometry (like __root__)
    if (verts === 0) continue;

    const cloned = (mesh as Mesh).clone(
      `${mesh.name}_${instanceId}`,
      parent,
    );
    if (cloned) {
      cloned.isVisible = true;
      cloned.setEnabled(true);
      clonedAny = true;
    }
  }

  if (!clonedAny) {
    // Debug: log why no meshes were cloned
    const meshInfo = template.meshes.map(m => `${m.name}(v=${m.getTotalVertices()})`).join(', ');
    console.warn(`[ModelCache] No meshes cloned for "${name}": [${meshInfo}]`);
    parent.dispose();
    return null;
  }

  return parent;
}

/**
 * Dispose a cloned model instance and all its child meshes.
 */
export function disposeModel(node: TransformNode): void {
  node.getChildMeshes().forEach((m) => m.dispose());
  node.dispose();
}

/**
 * Check if a model name exists in the cache.
 */
export function hasModel(name: string): boolean {
  return templates.has(name);
}

/** Number of successfully loaded model templates. */
export function getLoadedCount(): number {
  return loadedCount;
}

/** Whether all models have finished loading. */
export function isPreloaded(): boolean {
  return preloaded;
}

/**
 * Dispose all templates and reset the cache.
 */
export function disposeAll(): void {
  for (const [, template] of templates) {
    for (const mesh of template.meshes) {
      mesh.dispose();
    }
    template.root.dispose();
  }
  templates.clear();
  preloaded = false;
  loadedCount = 0;
}
