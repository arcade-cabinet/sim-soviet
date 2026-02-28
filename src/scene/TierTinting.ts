/**
 * TierTinting — applies per-tier material color tinting to building meshes.
 *
 * Each settlement tier gets a distinct color palette to visually communicate
 * the settlement's progression from rustic selo to industrial gorod:
 *
 *  - Selo (tier 0):     Warm brown — wooden, rustic
 *  - Posyolok (tier 1): Neutral — no tint (default appearance)
 *  - Pgt (tier 2):      Slight grey — early industrialization
 *  - Gorod (tier 3):    Cool grey-blue — concrete Soviet blocks
 *
 * Tinting works by multiplying the material's diffuseColor by a per-tier
 * RGB factor. Each building clone gets its own material instance so
 * tinting one does not affect others or the shared template.
 */

import {
  Color3,
  StandardMaterial,
  PBRMaterial,
  type TransformNode,
  type AbstractMesh,
} from '@babylonjs/core';
import type { SettlementTier } from '../game/SettlementSystem';

// ─── Tier Tint Definitions ───────────────────────────────────────────────────

export interface TierTint {
  /** RGB multiplier applied to diffuse/albedo color */
  colorFactor: Color3;
  /** Human-readable label for debugging */
  label: string;
}

export const TIER_TINTS: Readonly<Record<SettlementTier, TierTint>> = {
  selo: {
    colorFactor: new Color3(0.85, 0.7, 0.5),
    label: 'Warm brown (rustic wood)',
  },
  posyolok: {
    colorFactor: new Color3(1.0, 1.0, 1.0),
    label: 'Neutral (no tint)',
  },
  pgt: {
    colorFactor: new Color3(0.8, 0.8, 0.85),
    label: 'Slight grey (early industrial)',
  },
  gorod: {
    colorFactor: new Color3(0.7, 0.75, 0.8),
    label: 'Cool grey-blue (concrete)',
  },
};

// ─── Material Helpers ────────────────────────────────────────────────────────

/**
 * Store each mesh's original diffuse/albedo color so tinting can be
 * re-applied from the original base when the tier changes.
 *
 * Key: mesh uniqueId, Value: original Color3.
 */
const originalColors = new Map<number, Color3>();

/**
 * Ensure a mesh has its own material instance (not shared with other clones).
 * BabylonJS `Mesh.clone()` shares the source material by default.
 */
function ensureOwnMaterial(mesh: AbstractMesh): void {
  if (!mesh.material) return;

  // Check if this material is already unique to this mesh
  // (name contains the mesh's unique suffix)
  if (mesh.material.name.includes('_tint_')) return;

  const clonedMat = mesh.material.clone(`${mesh.material.name}_tint_${mesh.uniqueId}`);
  if (clonedMat) {
    mesh.material = clonedMat;
  }
}

/**
 * Store the original diffuse/albedo color for a mesh (before any tinting).
 * Only stores once — subsequent calls are no-ops.
 */
function storeOriginalColor(mesh: AbstractMesh): void {
  if (originalColors.has(mesh.uniqueId)) return;

  if (mesh.material instanceof StandardMaterial) {
    originalColors.set(mesh.uniqueId, mesh.material.diffuseColor.clone());
  } else if (mesh.material instanceof PBRMaterial) {
    originalColors.set(mesh.uniqueId, mesh.material.albedoColor.clone());
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Apply settlement tier tinting to all child meshes of a building node.
 *
 * Each mesh gets its own material instance (cloned from the shared template
 * material) so tinting one building does not affect others.
 *
 * The original color is preserved internally so that re-tinting on tier
 * change applies the new factor to the original base, not a previously
 * tinted value.
 */
export function applyTierTint(node: TransformNode, tier: SettlementTier): void {
  const tint = TIER_TINTS[tier];
  if (!tint) return;

  const meshes = node.getChildMeshes() as AbstractMesh[];
  for (const mesh of meshes) {
    if (!mesh.material) continue;

    // Ensure each mesh has its own material instance
    ensureOwnMaterial(mesh);

    // Store the original color before any tinting
    storeOriginalColor(mesh);

    const original = originalColors.get(mesh.uniqueId);
    if (!original) continue;

    // Apply tint as a multiply of original color by tier factor
    const tinted = new Color3(
      original.r * tint.colorFactor.r,
      original.g * tint.colorFactor.g,
      original.b * tint.colorFactor.b,
    );

    if (mesh.material instanceof StandardMaterial) {
      mesh.material.diffuseColor = tinted;
    } else if (mesh.material instanceof PBRMaterial) {
      mesh.material.albedoColor = tinted;
    }
  }
}

/**
 * Apply a brief brightening flash to all child meshes of a building node,
 * then transition back to the tier tint over `durationMs` milliseconds.
 *
 * Used for the tier-up celebration effect.
 */
export function flashTierTransition(
  node: TransformNode,
  newTier: SettlementTier,
  durationMs: number = 500,
): void {
  const meshes = node.getChildMeshes() as AbstractMesh[];
  const flashColor = new Color3(1.0, 0.95, 0.8); // Warm white flash

  // Set emissive to flash color
  for (const mesh of meshes) {
    if (mesh.material instanceof StandardMaterial) {
      mesh.material.emissiveColor = flashColor;
    } else if (mesh.material instanceof PBRMaterial) {
      mesh.material.emissiveColor = flashColor;
    }
  }

  // Fade emissive back to black over durationMs
  const startTime = performance.now();
  const scene = node.getScene();

  const observer = scene.onBeforeRenderObservable.add(() => {
    const elapsed = performance.now() - startTime;
    const t = Math.min(elapsed / durationMs, 1.0);

    // Ease-out: fast start, slow finish
    const eased = 1.0 - (1.0 - t) * (1.0 - t);

    for (const mesh of meshes) {
      if (mesh.material instanceof StandardMaterial) {
        mesh.material.emissiveColor = Color3.Lerp(flashColor, Color3.Black(), eased);
      } else if (mesh.material instanceof PBRMaterial) {
        mesh.material.emissiveColor = Color3.Lerp(flashColor, Color3.Black(), eased);
      }
    }

    if (t >= 1.0) {
      scene.onBeforeRenderObservable.remove(observer);
    }
  });

  // Apply the new tier tint immediately (the flash is additive via emissive)
  applyTierTint(node, newTier);
}

/**
 * Clean up stored original colors for a disposed building node.
 * Call this when a building is removed to prevent memory leaks.
 */
export function clearTintData(node: TransformNode): void {
  const meshes = node.getChildMeshes() as AbstractMesh[];
  for (const mesh of meshes) {
    originalColors.delete(mesh.uniqueId);
  }
}
