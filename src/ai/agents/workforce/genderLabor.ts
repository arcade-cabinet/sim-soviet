/**
 * Era-based gender labor modifiers.
 *
 * Historical context: Soviet women's labor participation varied by era.
 * Revolution: radical equality. Industrialization: women in factories.
 * War: women do everything. Stagnation: return to traditional roles on paper.
 */

import { workforce } from '@/config';

/** Era-specific multipliers controlling female labor participation by sector. */
export interface GenderLaborConfig {
  /** Multiplier for female workers in heavy industry */
  femaleHeavyIndustry: number;
  /** Multiplier for female workers in agriculture */
  femaleAgriculture: number;
  /** Multiplier for female workers in services */
  femaleServices: number;
  /** Whether women can be assigned to military roles */
  femalesMilitary: boolean;
}

const ERA_GENDER_CONFIGS: Record<string, GenderLaborConfig> = workforce.genderLabor as Record<
  string,
  GenderLaborConfig
>;

/**
 * Look up the gender labor configuration for a given era.
 *
 * @param eraId - Era identifier (e.g. 'wartime', 'stagnation')
 * @returns The GenderLaborConfig for the era, defaulting to 'revolution' if not found
 */
export function getGenderLaborConfig(eraId: string): GenderLaborConfig {
  return ERA_GENDER_CONFIGS[eraId] ?? ERA_GENDER_CONFIGS.revolution!;
}

/**
 * Get labor multiplier for a worker based on gender, building role, and era.
 * Returns 1.0 for male workers (no modifier).
 */
export function getGenderLaborMultiplier(
  gender: 'male' | 'female' | undefined,
  buildingRole: string,
  eraId: string,
): number {
  if (!gender || gender === 'male') return 1.0;

  const config = getGenderLaborConfig(eraId);

  if (buildingRole === 'industry' || buildingRole === 'power') return config.femaleHeavyIndustry;
  if (buildingRole === 'agriculture') return config.femaleAgriculture;
  if (buildingRole === 'services' || buildingRole === 'culture') return config.femaleServices;

  return 1.0; // default — no modifier
}
