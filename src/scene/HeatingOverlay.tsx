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
import type React from 'react';

/**
 * @stub Intentionally deferred during R3F migration (visual nicety, not core gameplay).
 * Tracked for post-launch: warm point lights + chimney smoke for heated buildings,
 * blue tint planes for unheated buildings during cold months.
 */
const HeatingOverlay: React.FC = () => {
  return null;
};

export default HeatingOverlay;
