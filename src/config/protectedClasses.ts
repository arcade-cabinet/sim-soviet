export type BuildingProtectionClass = 'government' | 'military' | 'power_water' | 'industry' | 'housing' | 'farms';

const PROTECTED: ReadonlySet<BuildingProtectionClass> = new Set(['government', 'military']);

const DEMOLITION_PRIORITY: Record<BuildingProtectionClass, number> = {
  farms: 1,
  housing: 2,
  industry: 3,
  power_water: 4,
  government: Infinity,
  military: Infinity,
};

/** Returns true if buildings of this class should never be auto-demolished. */
export function isProtected(cls: BuildingProtectionClass): boolean {
  return PROTECTED.has(cls);
}

/** Lower number = demolished first. Protected classes return Infinity. */
export function getDemolitionPriority(cls: BuildingProtectionClass): number {
  return DEMOLITION_PRIORITY[cls] ?? 3;
}
