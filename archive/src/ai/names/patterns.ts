/**
 * @fileoverview Patronymic generation rules: algorithmic + irregular forms.
 */

import { IRREGULAR_PATRONYMICS } from './syllables';

// ─────────────────────────────────────────────────────────
//  PATRONYMIC GENERATION RULES
// ─────────────────────────────────────────────────────────

export const PATRONYMIC_RULES = {
  /**
   * Generate a patronymic from a father's given name.
   *
   * @param fatherName - The father's given name (e.g. "Ivan", "Sergei").
   * @param gender - 'male' or 'female' for the person receiving the patronymic.
   * @returns The patronymic string (e.g. "Ivanovich", "Sergeevna").
   */
  generate(fatherName: string, gender: 'male' | 'female'): string {
    // Check irregular forms first
    const irregular = IRREGULAR_PATRONYMICS[fatherName];
    if (irregular) {
      return irregular[gender];
    }

    // Algorithmic fallback
    const name = fatherName;
    const lastChar = name.slice(-1).toLowerCase();
    const lastTwo = name.slice(-2).toLowerCase();

    // Names ending in soft-sign-like "i" or "ii"
    if (lastTwo === 'ii' || lastTwo === 'iy') {
      const stem = name.slice(0, -2);
      return gender === 'male' ? `${stem}ievich` : `${stem}ievna`;
    }

    if (lastChar === 'i') {
      const stem = name.slice(0, -1);
      return gender === 'male' ? `${stem}ievich` : `${stem}ievna`;
    }

    // Names ending in "a" (Ilya handled in irregulars)
    if (lastChar === 'a') {
      const stem = name.slice(0, -1);
      return gender === 'male' ? `${stem}ovich` : `${stem}ovna`;
    }

    // Names ending in "ei" (Sergei, Aleksei handled in irregulars, but fallback)
    if (lastTwo === 'ei') {
      const stem = name.slice(0, -2);
      return gender === 'male' ? `${stem}eevich` : `${stem}eevna`;
    }

    // Default: consonant ending
    return gender === 'male' ? `${name}ovich` : `${name}ovna`;
  },
} as const;
