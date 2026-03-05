/**
 * CollapseOverlay — Post-apocalyptic sprite overlay for collapse events.
 *
 * Renders backterria pixel-art sprites (hazard signs, skulls, barrels, craters)
 * over buildings when collapse conditions activate:
 *   - nuclear_flash CrisisVFX active
 *   - Climate milestones: ecological_collapse, infrastructure_collapse
 *   - Any active CrisisVFX of type nuclear_flash or earthquake_shake
 *
 * Uses Three.js Sprites (billboarded quads) with PNG textures loaded via
 * THREE.TextureLoader. Sprites fade in over 3 seconds.
 *
 * Sprite assets from backterria post-apocalyptic tileset (16x16 pixel art).
 */

import { useFrame, useThree } from '@react-three/fiber';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { getBuildingStates } from '../bridge/ECSBridge';
import { getActiveVFX, useClimateMilestones } from '../stores/gameStore';
import { assetUrl } from '../utils/assetPath';

/** Fade-in duration in seconds. */
const FADE_IN_SECONDS = 3;

/** Maximum number of overlay sprites. */
const MAX_SPRITES = 60;

/** Height offset above buildings for sign sprites. */
const SIGN_Y = 2.5;

/** Ground-level offset for debris sprites. */
const DEBRIS_Y = 0.05;

/** Sprite file names and their placement category. */
const SPRITE_DEFS = [
  { file: 'sign-danger.png', y: SIGN_Y, scale: 0.8, weight: 2 },
  { file: 'sign-radioactive.png', y: SIGN_Y, scale: 0.8, weight: 3 },
  { file: 'sign-stop.png', y: SIGN_Y, scale: 0.7, weight: 1 },
  { file: 'skull.png', y: DEBRIS_Y, scale: 0.5, weight: 2 },
  { file: 'barrel.png', y: DEBRIS_Y, scale: 0.6, weight: 2 },
  { file: 'hole-1.png', y: DEBRIS_Y, scale: 0.9, weight: 1 },
  { file: 'hole-2.png', y: DEBRIS_Y, scale: 0.9, weight: 1 },
  { file: 'hole-3.png', y: DEBRIS_Y, scale: 0.9, weight: 1 },
] as const;

/** Build a weighted selection array for sprite type picking. */
function buildWeightedIndices(): number[] {
  const indices: number[] = [];
  for (let i = 0; i < SPRITE_DEFS.length; i++) {
    for (let w = 0; w < SPRITE_DEFS[i].weight; w++) {
      indices.push(i);
    }
  }
  return indices;
}

const WEIGHTED_INDICES = buildWeightedIndices();

/** Seeded PRNG. */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Check if collapse conditions are active. */
function isCollapseActive(climateMs: ReadonlySet<string>): boolean {
  // Climate milestone triggers
  if (climateMs.has('ecological_collapse') || climateMs.has('infrastructure_collapse') ||
      climateMs.has('nuclear_winter') || climateMs.has('ecological_permafrost_collapse')) {
    return true;
  }

  // Active crisis VFX triggers
  const vfx = getActiveVFX();
  for (const e of vfx) {
    if (e.type === 'nuclear_flash' || e.type === 'earthquake_shake') {
      return true;
    }
  }

  return false;
}

/** Load all sprite textures once. */
function useCollapseTextures(): THREE.Texture[] | null {
  const [textures, setTextures] = useState<THREE.Texture[] | null>(null);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    const promises = SPRITE_DEFS.map((def) => {
      const url = assetUrl(`assets/sprites/collapse/${def.file}`);
      return new Promise<THREE.Texture>((resolve) => {
        loader.load(url, (tex) => {
          tex.magFilter = THREE.NearestFilter;
          tex.minFilter = THREE.NearestFilter;
          tex.colorSpace = THREE.SRGBColorSpace;
          resolve(tex);
        }, undefined, () => {
          // On error, create a fallback 1x1 red texture
          const fallback = new THREE.DataTexture(new Uint8Array([255, 0, 0, 255]), 1, 1);
          fallback.needsUpdate = true;
          resolve(fallback);
        });
      });
    });

    Promise.all(promises).then(setTextures);

    return () => {
      // Dispose textures on unmount
      if (textures) {
        for (const t of textures) t.dispose();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return textures;
}

interface SpriteSlot {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  targetOpacity: number;
}

/**
 * Inner renderer — only mounted when collapse is active and textures are loaded.
 * Creates a pool of sprites positioned over buildings.
 */
const CollapseSprites: React.FC<{ textures: THREE.Texture[] }> = ({ textures }) => {
  const { scene } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const fadeRef = useRef(0); // 0→1 over FADE_IN_SECONDS
  const slotsRef = useRef<SpriteSlot[]>([]);
  const placedRef = useRef(false);

  // Create sprite pool
  const slots = useMemo(() => {
    const arr: SpriteSlot[] = [];
    for (let i = 0; i < MAX_SPRITES; i++) {
      const material = new THREE.SpriteMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.visible = false;
      arr.push({ sprite, material, targetOpacity: 0 });
    }
    return arr;
  }, []);

  // Mount sprites into group
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    for (const slot of slots) {
      group.add(slot.sprite);
    }
    slotsRef.current = slots;

    return () => {
      for (const slot of slots) {
        group.remove(slot.sprite);
        slot.material.dispose();
      }
    };
  }, [slots]);

  // Place sprites over buildings
  useEffect(() => {
    if (placedRef.current || textures.length === 0) return;

    const buildings = getBuildingStates();
    if (buildings.length === 0) return;

    const rng = mulberry32(0xc0_11_a9_5e);
    let spriteIdx = 0;

    for (const bldg of buildings) {
      if (spriteIdx >= MAX_SPRITES) break;

      // ~60% chance to place a sprite on each building
      if (rng() > 0.6) continue;

      // Pick a sprite type
      const typeIdx = WEIGHTED_INDICES[Math.floor(rng() * WEIGHTED_INDICES.length)];
      const def = SPRITE_DEFS[typeIdx];
      const tex = textures[typeIdx];

      const slot = slotsRef.current[spriteIdx];
      if (!slot) break;

      slot.material.map = tex;
      slot.material.needsUpdate = true;
      slot.targetOpacity = 0.7 + rng() * 0.3;

      // Position over the building with small random offset
      const ox = (rng() - 0.5) * 0.8;
      const oz = (rng() - 0.5) * 0.8;
      slot.sprite.position.set(
        bldg.gridX + 0.5 + ox,
        bldg.elevation * 0.5 + def.y,
        bldg.gridY + 0.5 + oz,
      );
      slot.sprite.scale.set(def.scale, def.scale, 1);
      slot.sprite.visible = true;

      spriteIdx++;

      // Optionally add a second debris sprite near this building
      if (rng() > 0.5 && spriteIdx < MAX_SPRITES) {
        const debrisIdx = WEIGHTED_INDICES[Math.floor(rng() * WEIGHTED_INDICES.length)];
        const debrisDef = SPRITE_DEFS[debrisIdx];
        const debrisTex = textures[debrisIdx];

        const slot2 = slotsRef.current[spriteIdx];
        if (!slot2) break;

        slot2.material.map = debrisTex;
        slot2.material.needsUpdate = true;
        slot2.targetOpacity = 0.5 + rng() * 0.3;

        slot2.sprite.position.set(
          bldg.gridX + 0.5 + (rng() - 0.5) * 1.2,
          bldg.elevation * 0.5 + debrisDef.y,
          bldg.gridY + 0.5 + (rng() - 0.5) * 1.2,
        );
        slot2.sprite.scale.set(debrisDef.scale, debrisDef.scale, 1);
        slot2.sprite.visible = true;

        spriteIdx++;
      }
    }

    placedRef.current = true;
  }, [textures]);

  // Fade in over 3 seconds
  useFrame((_, delta) => {
    if (fadeRef.current >= 1) return;

    fadeRef.current = Math.min(1, fadeRef.current + delta / FADE_IN_SECONDS);
    const t = fadeRef.current;

    for (const slot of slotsRef.current) {
      if (slot.sprite.visible) {
        slot.material.opacity = slot.targetOpacity * t;
      }
    }
  });

  return <group ref={groupRef} />;
};

/**
 * CollapseOverlay — conditionally renders post-apocalyptic sprites.
 * Checks climate milestones and active crisis VFX each render.
 */
const CollapseOverlay: React.FC = () => {
  const climateMilestones = useClimateMilestones();
  const textures = useCollapseTextures();
  const active = isCollapseActive(climateMilestones);

  if (!active || !textures) return null;

  return <CollapseSprites textures={textures} />;
};

export default CollapseOverlay;
