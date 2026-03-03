/**
 * @module game/politburo/modifiers
 *
 * Modifier application logic — how personality overrides merge
 * with the active modifier set.
 */

import type { MinistryModifiers } from './types';

/** Apply a minister's personality overrides to the active modifiers, scaled by competence. */
export function applyMinisterOverrides(
  mods: MinistryModifiers,
  overrides: Record<string, unknown>,
  competenceScale: number,
): void {
  const modsRecord = mods as unknown as Record<string, number | boolean>;
  for (const [key, value] of Object.entries(overrides)) {
    const modKey = key as keyof MinistryModifiers;
    if (typeof value === 'number') {
      const currentVal = mods[modKey];
      if (typeof currentVal !== 'number') continue;
      const isMultiplier = key.endsWith('Mult') || key === 'hospitalEffectiveness';
      modsRecord[modKey] = isMultiplier
        ? currentVal + (value - 1.0) * competenceScale
        : currentVal + (value - currentVal) * competenceScale;
    } else if (typeof value === 'boolean') {
      modsRecord[modKey] = value;
    }
  }
}
