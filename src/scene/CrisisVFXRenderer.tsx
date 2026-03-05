/**
 * CrisisVFXRenderer — One-shot visual effects triggered by crisis impacts.
 *
 * Renders four dramatic effects:
 * 1. Nuclear Flash: White fullscreen plane fading from full opacity to 0 over 2s
 * 2. Earthquake Shake: Camera offset oscillation (reuses meteor shake pattern)
 * 3. Famine Haze: Brown-tinted FogExp2 that persists for the effect duration
 * 4. Dust Storm: Sandy FogExp2 with lower density than famine
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

/** Calculate the normalized progress (0->1) of an effect. */
function effectProgress(event: CrisisVFXEvent): number {
  const elapsed = (Date.now() - event.startedAt) / 1000;
  return Math.min(1, elapsed / Math.max(0.01, event.duration));
}

/** Ramp envelope: up 10%, hold, fade out 20%. */
function rampEnvelope(t: number): number {
  if (t < 0.1) return t / 0.1;
  if (t > 0.8) return (1 - t) / 0.2;
  return 1;
}

const CrisisVFXRenderer: React.FC = () => {
  const { scene, camera } = useThree();
  const flashRef = useRef<THREE.Mesh>(null);
  const flashMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const savedFogRef = useRef<THREE.FogExp2 | THREE.Fog | null>(null);
  const hazeActiveRef = useRef(false);
  const cameraBasePos = useRef<THREE.Vector3 | null>(null);

  // Clean up fog and camera on unmount
  useEffect(() => {
    return () => {
      if (hazeActiveRef.current && savedFogRef.current !== undefined) {
        scene.fog = savedFogRef.current;
        hazeActiveRef.current = false;
      }
      if (cameraBasePos.current) {
        camera.position.copy(cameraBasePos.current);
        cameraBasePos.current = null;
      }
    };
  }, [scene, camera]);

  useFrame(() => {
    pruneExpiredVFX();
    const effects = getActiveVFX();

    // ── Nuclear Flash (white fullscreen plane) ──
    const flash = effects.find((e) => e.type === 'nuclear_flash');
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

    // ── Earthquake Shake (camera offset oscillation) ──
    const shake = effects.find((e) => e.type === 'earthquake_shake');
    if (shake) {
      if (!cameraBasePos.current) {
        cameraBasePos.current = camera.position.clone();
      }
      const t = effectProgress(shake);
      const decay = 1 - t; // Shake decays linearly
      const amplitude = shake.intensity * decay * 0.3;
      const freq = 15; // Hz-ish oscillation
      const elapsed = (Date.now() - shake.startedAt) / 1000;
      camera.position.x = cameraBasePos.current.x + Math.sin(elapsed * freq) * amplitude;
      camera.position.y = cameraBasePos.current.y + Math.cos(elapsed * freq * 1.3) * amplitude * 0.5;
    } else if (cameraBasePos.current) {
      camera.position.copy(cameraBasePos.current);
      cameraBasePos.current = null;
    }

    // ── Famine Haze (brown FogExp2) + Dust Storm (sandy FogExp2) ──
    const haze = effects.find((e) => e.type === 'famine_haze');
    const dust = effects.find((e) => e.type === 'dust_storm');
    const fogEffect = haze ?? dust;

    if (fogEffect) {
      if (!hazeActiveRef.current) {
        savedFogRef.current = scene.fog;
        hazeActiveRef.current = true;
      }
      const t = effectProgress(fogEffect);
      const fogIntensity = rampEnvelope(t);
      const density = 0.015 * fogEffect.intensity * fogIntensity;
      // Brown for famine, sandy for dust storm
      const color = fogEffect.type === 'famine_haze' ? 0x8b6914 : 0xc2a65a;
      scene.fog = new THREE.FogExp2(color, density);
    } else if (hazeActiveRef.current) {
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
