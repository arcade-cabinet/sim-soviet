/**
 * PostProcessing — R3F postprocessing effects for visual polish.
 *
 * Uses @react-three/postprocessing (wraps pmndrs/postprocessing):
 * - SMAA: Sub-pixel Morphological Anti-Aliasing (better than FXAA for low-poly)
 * - Bloom: Subtle glow on fire, emissive materials, and bright highlights
 * - ToneMapping: ACES Filmic for better color range and cinematic feel
 * - Vignette: Very subtle darkening at screen edges for Soviet atmosphere
 *
 * All effects are lightweight — targeting < 2ms per frame overhead.
 */

import { Bloom, EffectComposer, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import type React from 'react';

/** Postprocessing effect stack for the Soviet city scene. */
const PostProcessing: React.FC = () => {
  return (
    <EffectComposer multisampling={0}>
      {/* Anti-aliasing — SMAA gives cleaner edges than FXAA on low-poly geometry */}
      <SMAA />

      {/* Bloom — subtle glow on bright elements (fire, powered buildings, emissive) */}
      <Bloom luminanceThreshold={0.9} luminanceSmoothing={0.3} intensity={0.4} mipmapBlur />

      {/* Tone mapping — ACES Filmic for cinematic color range */}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />

      {/* Vignette — very subtle edge darkening for atmosphere */}
      <Vignette eskil={false} offset={0.3} darkness={0.4} />
    </EffectComposer>
  );
};

export default PostProcessing;
