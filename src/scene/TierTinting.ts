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
 * R3F migration: works with Three.js Object3D groups containing Mesh children.
 * Tinting multiplies material.color by a per-tier RGB factor.
 * Original colors are stored in mesh.userData.originalColor for restoration.
 */

import * as THREE from 'three/webgpu';
import type { SettlementTier } from '../game/SettlementSystem';
import type { Season } from './TerrainGrid';

// ── Tier Tint Definitions ───────────────────────────────────────────────────

export interface TierTint {
  /** RGB multiplier applied to material color */
  colorFactor: [number, number, number];
  /** PBR roughness override (0 = mirror, 1 = fully rough) */
  roughness: number;
  /** PBR metalness override (0 = dielectric, 1 = fully metallic) */
  metalness: number;
  /** Human-readable label for debugging */
  label: string;
}

export const TIER_TINTS: Readonly<Record<SettlementTier, TierTint>> = {
  selo: {
    colorFactor: [0.85, 0.7, 0.5],
    roughness: 0.95,
    metalness: 0.0,
    label: 'Warm brown (rustic wood)',
  },
  posyolok: {
    colorFactor: [1.0, 1.0, 1.0],
    roughness: 0.75,
    metalness: 0.05,
    label: 'Neutral (no tint)',
  },
  pgt: {
    colorFactor: [0.8, 0.8, 0.85],
    roughness: 0.55,
    metalness: 0.1,
    label: 'Slight grey (early industrial)',
  },
  gorod: {
    colorFactor: [0.7, 0.75, 0.8],
    roughness: 0.35,
    metalness: 0.2,
    label: 'Cool grey-blue (concrete)',
  },
};

// ── Season Tint Definitions ─────────────────────────────────────────────────

/**
 * Seasonal RGB multipliers applied on top of tier tinting.
 * Winter is slightly blue/cold, summer slightly warm, spring/autumn subtle.
 */
export const SEASON_TINTS: Readonly<Record<Season, [number, number, number]>> = {
  winter: [0.85, 0.9, 1.1],
  spring: [0.95, 1.0, 0.95],
  summer: [1.05, 1.0, 0.9],
  autumn: [1.0, 0.95, 0.85],
};

// ── Helper: traverse all Mesh children ──────────────────────────────────────

function forEachMeshChild(
  group: THREE.Object3D,
  fn: (mesh: THREE.Mesh, material: THREE.MeshStandardMaterial) => void,
): void {
  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    // Handle both single material and material arrays
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const mat of materials) {
      if (mat instanceof THREE.MeshStandardMaterial) {
        fn(child, mat);
      }
    }
  });
}

// ── Store / restore original colors via userData ────────────────────────────

function storeOriginalColor(mesh: THREE.Mesh, mat: THREE.MeshStandardMaterial): void {
  // Store per-material using material.uuid as key, since one mesh can have
  // multiple materials and we need to track each independently.
  const colorKey = `originalColor_${mat.uuid}`;
  if (!mesh.userData[colorKey]) {
    mesh.userData[colorKey] = mat.color.clone();
  }
  const roughKey = `originalRoughness_${mat.uuid}`;
  if (mesh.userData[roughKey] == null) {
    mesh.userData[roughKey] = mat.roughness;
  }
  const metalKey = `originalMetalness_${mat.uuid}`;
  if (mesh.userData[metalKey] == null) {
    mesh.userData[metalKey] = mat.metalness;
  }
}

function getOriginalColor(mesh: THREE.Mesh, mat: THREE.MeshStandardMaterial): THREE.Color | null {
  const key = `originalColor_${mat.uuid}`;
  return mesh.userData[key] ?? null;
}

function getOriginalRoughness(mesh: THREE.Mesh, mat: THREE.MeshStandardMaterial): number | null {
  const key = `originalRoughness_${mat.uuid}`;
  return mesh.userData[key] ?? null;
}

function getOriginalMetalness(mesh: THREE.Mesh, mat: THREE.MeshStandardMaterial): number | null {
  const key = `originalMetalness_${mat.uuid}`;
  return mesh.userData[key] ?? null;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Apply settlement tier tinting to all Mesh children of a building group.
 *
 * Each mesh's material is cloned (if shared) so tinting one building
 * does not affect others. The original color is preserved in userData
 * so re-tinting on tier change applies the new factor to the original base.
 */
/**
 * Blend weight for PBR property overrides (roughness/metalness).
 * 0.0 = use original model value, 1.0 = use tier target value.
 * 0.7 gives a strong tier feel while preserving some model-specific character.
 */
const PBR_BLEND_WEIGHT = 0.7;

export function applyTierTint(group: THREE.Object3D, tier: SettlementTier): void {
  const tint = TIER_TINTS[tier];
  if (!tint) return;

  const [fr, fg, fb] = tint.colorFactor;

  forEachMeshChild(group, (mesh, mat) => {
    // Ensure own material instance
    if (!mesh.userData._ownMaterial) {
      const cloned = mat.clone();
      if (Array.isArray(mesh.material)) {
        const idx = mesh.material.indexOf(mat);
        if (idx >= 0) mesh.material[idx] = cloned;
      } else {
        mesh.material = cloned;
      }
      mesh.userData._ownMaterial = true;
      // Re-run with the cloned material
      storeOriginalColor(mesh, cloned);
      const orig = getOriginalColor(mesh, cloned);
      if (orig) {
        cloned.color.setRGB(orig.r * fr, orig.g * fg, orig.b * fb);
      }
      // Apply PBR overrides
      const origR = getOriginalRoughness(mesh, cloned);
      const origM = getOriginalMetalness(mesh, cloned);
      if (origR != null) cloned.roughness = origR + (tint.roughness - origR) * PBR_BLEND_WEIGHT;
      if (origM != null) cloned.metalness = origM + (tint.metalness - origM) * PBR_BLEND_WEIGHT;
      return;
    }

    storeOriginalColor(mesh, mat);
    const orig = getOriginalColor(mesh, mat);
    if (orig) {
      mat.color.setRGB(orig.r * fr, orig.g * fg, orig.b * fb);
    }
    // Apply PBR overrides
    const origR = getOriginalRoughness(mesh, mat);
    const origM = getOriginalMetalness(mesh, mat);
    if (origR != null) mat.roughness = origR + (tint.roughness - origR) * PBR_BLEND_WEIGHT;
    if (origM != null) mat.metalness = origM + (tint.metalness - origM) * PBR_BLEND_WEIGHT;
  });
}

/**
 * Apply seasonal tint to all Mesh children of a building group.
 * Multiplies the current material color by the seasonal RGB factor.
 * Must be called AFTER applyTierTint() so it layers on top of the tier base.
 */
export function applySeasonTint(group: THREE.Object3D, season: Season): void {
  const [sr, sg, sb] = SEASON_TINTS[season];

  forEachMeshChild(group, (mesh, mat) => {
    const orig = getOriginalColor(mesh, mat);
    if (!orig) return;

    // Read the current tier-tinted color and multiply by season factor.
    // Since applyTierTint already set color = original * tierFactor,
    // we re-read the current color and apply the season multiplier.
    mat.color.setRGB(mat.color.r * sr, mat.color.g * sg, mat.color.b * sb);
  });
}

/**
 * Apply construction-in-progress visual state to a building group.
 *
 * Foundation phase: semi-transparent (opacity 0.5), dim yellow emissive.
 * Building phase: semi-transparent (opacity 0.7), brighter yellow emissive
 * scaled by construction progress (0.0–1.0).
 *
 * Must be called AFTER applyTierTint() + applySeasonTint().
 * Mutually exclusive with applyPoweredState() — buildings under
 * construction are not yet connected to the power grid.
 */
export function applyConstructionState(
  group: THREE.Object3D,
  phase: 'foundation' | 'building',
  progress: number,
): void {
  const opacity = phase === 'foundation' ? 0.5 : 0.5 + progress * 0.5;
  // Yellow emissive glow intensifies with progress
  const emissiveIntensity = 0.15 + progress * 0.35;

  forEachMeshChild(group, (_mesh, mat) => {
    mat.transparent = true;
    mat.opacity = opacity;
    mat.depthWrite = false; // prevent z-fighting for transparent meshes
    mat.emissive.setRGB(emissiveIntensity, emissiveIntensity * 0.8, 0);
  });
}

/**
 * Apply powered/unpowered visual state to a building group.
 * Unpowered buildings are dimmed to 40% brightness.
 */
export function applyPoweredState(group: THREE.Object3D, powered: boolean): void {
  forEachMeshChild(group, (_mesh, mat) => {
    if (!powered) {
      // Dim the current color (applied on top of tier tinting)
      mat.color.multiplyScalar(0.4);
    }
  });
}

/**
 * Apply fire visual state to a building group.
 * On-fire buildings get a red emissive glow.
 */
export function applyFireTint(group: THREE.Object3D, onFire: boolean): void {
  forEachMeshChild(group, (_mesh, mat) => {
    if (onFire) {
      mat.emissive.setRGB(0.6, 0.1, 0.0);
    } else {
      mat.emissive.setRGB(0, 0, 0);
    }
  });
}

/**
 * Flash celebration effect for tier-up transitions.
 * Sets emissive to warm white then fades back over durationMs.
 * Returns a cleanup function to cancel the animation.
 */
export function flashTierTransition(
  group: THREE.Object3D,
  newTier: SettlementTier,
  durationMs: number = 500,
): () => void {
  const flashColor = new THREE.Color(1.0, 0.95, 0.8);
  const black = new THREE.Color(0, 0, 0);
  const startTime = performance.now();
  let cancelled = false;

  // Set initial flash
  forEachMeshChild(group, (_mesh, mat) => {
    mat.emissive.copy(flashColor);
  });

  // Apply the new tier tint immediately (flash is additive via emissive)
  applyTierTint(group, newTier);

  // Animate the fade via requestAnimationFrame
  function animate() {
    if (cancelled) return;

    const elapsed = performance.now() - startTime;
    const t = Math.min(elapsed / durationMs, 1.0);
    const eased = 1.0 - (1.0 - t) * (1.0 - t); // ease-out

    forEachMeshChild(group, (_mesh, mat) => {
      mat.emissive.lerpColors(flashColor, black, eased);
    });

    if (t < 1.0) {
      requestAnimationFrame(animate);
    }
  }

  requestAnimationFrame(animate);

  return () => {
    cancelled = true;
  };
}

/**
 * Clean up stored original colors for a disposed building group.
 * Call this when a building is removed to prevent memory leaks.
 */
export function clearTintData(group: THREE.Object3D): void {
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      // Remove all stored original values from userData
      for (const key of Object.keys(child.userData)) {
        if (
          key.startsWith('originalColor_') ||
          key.startsWith('originalRoughness_') ||
          key.startsWith('originalMetalness_') ||
          key === '_ownMaterial'
        ) {
          delete child.userData[key];
        }
      }
    }
  });
}
