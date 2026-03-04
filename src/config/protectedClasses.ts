/**
 * Protected class hierarchy — in the "classless" Soviet system.
 * Government > Military > Power/Water > Industry > Housing > Farms
 */
export type BuildingProtectionClass = 'government' | 'military' | 'power_water' | 'industry' | 'housing' | 'farms';

export interface ProtectionConfig {
  protectionClass: BuildingProtectionClass;
  protected: boolean;
  demolitionPriority: number;
  description: string;
}

export const PROTECTED_CLASSES: Record<BuildingProtectionClass, ProtectionConfig> = {
  government: { protectionClass: 'government', protected: true, demolitionPriority: Infinity, description: 'Never demolished.' },
  military: { protectionClass: 'military', protected: true, demolitionPriority: Infinity, description: 'Never demolished.' },
  power_water: { protectionClass: 'power_water', protected: true, demolitionPriority: Infinity, description: 'Critical infrastructure.' },
  industry: { protectionClass: 'industry', protected: false, demolitionPriority: 30, description: 'Costly to demolish.' },
  housing: { protectionClass: 'housing', protected: false, demolitionPriority: 10, description: 'Fully expendable.' },
  farms: { protectionClass: 'farms', protected: false, demolitionPriority: 5, description: 'Fully expendable.' },
};

export function isProtected(cls: BuildingProtectionClass): boolean {
  return PROTECTED_CLASSES[cls]?.protected ?? false;
}

export function getDemolitionPriority(cls: BuildingProtectionClass): number {
  return PROTECTED_CLASSES[cls]?.demolitionPriority ?? 20;
}
