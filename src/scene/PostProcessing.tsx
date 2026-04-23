/**
 * PostProcessing — R3F postprocessing effects for visual polish.
 *
 * Uses @react-three/postprocessing (wraps pmndrs/postprocessing):
 * - SMAA: Sub-pixel Morphological Anti-Aliasing (better than FXAA for low-poly)
 * - Bloom: Subtle glow on fire, emissive materials, and bright highlights
 * - ToneMapping: ACES Filmic for better color range and cinematic feel
 * - Vignette: Very subtle darkening at screen edges for Soviet atmosphere
 * - HueSaturation: Dynamic desaturation during famine crisis events
 *
 * All effects are lightweight — targeting < 2ms per frame overhead.
 */

import {
  Bloom,
  BrightnessContrast,
  EffectComposer,
  HueSaturation,
  SMAA,
  ToneMapping,
  Vignette,
} from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import type React from 'react';
import { useMemo } from 'react';

import { type CrisisVFXEvent, useCrisisVFX } from '@/stores/gameStore';

/** Calculate the normalized progress (0→1) of an effect. */
function effectProgress(event: CrisisVFXEvent): number {
  const elapsed = (Date.now() - event.startedAt) / 1000;
  return Math.min(1, elapsed / Math.max(0.01, event.duration));
}

/** Postprocessing effect stack for the Soviet city scene. */
const PostProcessing: React.FC = () => {
  const vfx = useCrisisVFX();

  // Calculate famine desaturation amount from active VFX
  const famineDesat = useMemo(() => {
    const famine = vfx.find((e) => e.type === 'famine_haze');
    if (!famine) return 0;
    const t = effectProgress(famine);
    // Ramp up over first 10%, hold, then fade out over last 20%
    let strength: number;
    if (t < 0.1) {
      strength = t / 0.1;
    } else if (t > 0.8) {
      strength = (1 - t) / 0.2;
    } else {
      strength = 1;
    }
    return -famine.intensity * strength; // Negative = desaturate
  }, [vfx]);

  return (
    <EffectComposer multisampling={0}>
      {/* Anti-aliasing — SMAA gives cleaner edges than FXAA on low-poly geometry */}
      <SMAA />

      {/* Bloom — subtle glow on bright elements (fire, powered buildings, emissive) */}
      <Bloom luminanceThreshold={0.9} luminanceSmoothing={0.3} intensity={0.4} mipmapBlur />

      {/* Famine desaturation — drains color when famine crisis is active.
          Always rendered (saturation=0 is a no-op) to satisfy EffectComposer child types. */}
      <HueSaturation saturation={famineDesat} />
      <BrightnessContrast brightness={famineDesat * 0.1} contrast={0} />

      {/* Tone mapping — ACES Filmic for cinematic color range */}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />

      {/* Vignette — very subtle edge darkening for atmosphere */}
      <Vignette eskil={false} offset={0.3} darkness={0.4} />
    </EffectComposer>
  );
};

export default PostProcessing;
