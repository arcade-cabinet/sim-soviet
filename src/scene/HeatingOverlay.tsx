/**
 * HeatingOverlay — Per-building heating visual indicators during cold seasons.
 *
 * TODO: Implement heating overlay for R3F.
 * This is a visual nicety, not core gameplay. The original BabylonJS version
 * rendered warm orange point lights + chimney smoke for heated buildings
 * and blue tint planes for unheated buildings during cold months.
 *
 * Future implementation should use:
 * - <pointLight> for warm glow effects
 * - <points> for chimney smoke particles
 * - Semi-transparent planes for cold tint overlays
 */
import React from 'react';

const HeatingOverlay: React.FC = () => {
  // TODO: Implement heating overlay for R3F
  // Original logic reads month from ECS meta entity, checks COLD_MONTHS set,
  // reads global heating state from EconomySystem, then renders per-building
  // warm (point light + smoke particles) or cold (blue tint plane) effects.
  return null;
};

export default HeatingOverlay;
