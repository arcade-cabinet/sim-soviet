/**
 * Era-based gender labor modifiers.
 *
 * Historical context: Soviet women's labor participation varied by era.
 * Revolution: radical equality. Industrialization: women in factories.
 * War: women do everything. Stagnation: return to traditional roles on paper.
 */

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

const ERA_GENDER_CONFIGS: Record<string, GenderLaborConfig> = {
  revolution: {
    femaleHeavyIndustry: 0.7,
    femaleAgriculture: 1.0,
    femaleServices: 1.0,
    femalesMilitary: false,
  },
  collectivization: {
    femaleHeavyIndustry: 0.8,
    femaleAgriculture: 1.0,
    femaleServices: 1.1,
    femalesMilitary: false,
  },
  industrialization: {
    femaleHeavyIndustry: 0.9,
    femaleAgriculture: 1.0,
    femaleServices: 1.2,
    femalesMilitary: false,
  },
  wartime: {
    femaleHeavyIndustry: 1.0,
    femaleAgriculture: 1.0,
    femaleServices: 1.0,
    femalesMilitary: true,
  },
  reconstruction: {
    femaleHeavyIndustry: 0.9,
    femaleAgriculture: 1.0,
    femaleServices: 1.2,
    femalesMilitary: false,
  },
  thaw: {
    femaleHeavyIndustry: 0.85,
    femaleAgriculture: 0.95,
    femaleServices: 1.3,
    femalesMilitary: false,
  },
  stagnation: {
    femaleHeavyIndustry: 0.8,
    femaleAgriculture: 0.9,
    femaleServices: 1.3,
    femalesMilitary: false,
  },
  eternal: {
    femaleHeavyIndustry: 1.0,
    femaleAgriculture: 1.0,
    femaleServices: 1.0,
    femalesMilitary: true,
  },
};

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
