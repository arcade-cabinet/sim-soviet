/**
 * CrisisVFXRenderer — One-shot visual effects triggered by crisis impacts.
 *
 * Renders two dramatic effects:
 * 1. Meteor Flash: White fullscreen plane fading from full opacity to 0 over 2s
 * 2. Nuclear Haze: Orange-tinted FogExp2 that persists for the effect duration
 *
 * Famine desaturation is handled by PostProcessing.tsx (HueSaturation effect)
 * since it requires the postprocessing pipeline.
 *
 * Reads from the gameStore CrisisVFX queue. Prunes expired effects each frame.
 */

import { useFrame, useThree } from '@react-three/fiber';
import type React from 'react';
import { useRef, useEffect } from 'react';
import * as THREE from 'three';

import { getActiveVFX, pruneExpiredVFX, type CrisisVFXEvent } from '@/stores/gameStore';

/** Calculate the normalized progress (0→1) of an effect. */
function effectProgress(event: CrisisVFXEvent): number {
  const elapsed = (Date.now() - event.startedAt) / 1000;
  return Math.min(1, elapsed / Math.max(0.01, event.duration));
}

const CrisisVFXRenderer: React.FC = () => {
  const { scene } = useThree();
  const flashRef = useRef<THREE.Mesh>(null);
  const flashMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const savedFogRef = useRef<THREE.FogExp2 | THREE.Fog | null>(null);
  const hazeActiveRef = useRef(false);

  // Clean up fog on unmount
  useEffect(() => {
    return () => {
      if (hazeActiveRef.current && savedFogRef.current !== undefined) {
        scene.fog = savedFogRef.current;
        hazeActiveRef.current = false;
      }
    };
  }, [scene]);

  useFrame(() => {
    pruneExpiredVFX();
    const effects = getActiveVFX();

    // ── Meteor Flash ──
    const flash = effects.find((e) => e.type === 'meteor_flash');
    if (flashRef.current && flashMatRef.current) {
      if (flash) {
        const t = effectProgress(flash);
        // Fast bright flash then slow fade: (1 - t)^2 curve
        const alpha = flash.intensity * (1 - t) * (1 - t);
        flashRef.current.visible = alpha > 0.01;
        flashMatRef.current.opacity = alpha;
      } else {
        flashRef.current.visible = false;
      }
    }

    // ── Nuclear Haze (orange FogExp2) ──
    const haze = effects.find((e) => e.type === 'nuclear_haze');
    if (haze) {
      if (!hazeActiveRef.current) {
        // Save current fog and replace with orange haze
        savedFogRef.current = scene.fog;
        hazeActiveRef.current = true;
      }
      const t = effectProgress(haze);
      // Ramp up over first 10%, hold, then fade out over last 20%
      let fogIntensity: number;
      if (t < 0.1) {
        fogIntensity = t / 0.1; // ramp up
      } else if (t > 0.8) {
        fogIntensity = (1 - t) / 0.2; // fade out
      } else {
        fogIntensity = 1; // hold
      }
      const density = 0.015 * haze.intensity * fogIntensity;
      scene.fog = new THREE.FogExp2(0xff6600, density);
    } else if (hazeActiveRef.current) {
      // Restore original fog
      scene.fog = savedFogRef.current;
      hazeActiveRef.current = false;
    }
  });

  return (
    <>
      {/* Fullscreen flash plane — rendered in front of camera via renderOrder */}
      <mesh ref={flashRef} visible={false} renderOrder={9999}>
        <planeGeometry args={[100, 100]} />
        <meshBasicMaterial
          ref={flashMatRef}
          color="white"
          transparent
          opacity={0}
          depthTest={false}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </>
  );
};

export default CrisisVFXRenderer;
