import type { BuildingProtectionClass } from './protectedClasses';

const EXPLICIT_CLASS: Record<string, BuildingProtectionClass> = {
  'government-hq': 'government',
  'party-office': 'government',
  'settlement-hq': 'government',
  'raion-office': 'government',
  'militia-post': 'military',
  'barracks': 'military',
  'guard-tower': 'military',
  'power-station': 'power_water',
  'water-pump': 'power_water',
  'water-tower': 'power_water',
  'warehouse': 'industry',
};

export function classifyBuilding(defId: string): BuildingProtectionClass {
  if (EXPLICIT_CLASS[defId]) return EXPLICIT_CLASS[defId];
  if (defId.includes('house') || defId.includes('apartment') || defId.includes('dormitor'))
    return 'housing';
  if (defId.includes('farm') || defId.includes('grain') || defId.includes('silo')) return 'farms';
  if (defId.includes('power') || defId.includes('generator')) return 'power_water';
  if (defId.includes('government') || defId.includes('party') || defId.includes('soviet'))
    return 'government';
  if (defId.includes('militia') || defId.includes('barrack') || defId.includes('guard'))
    return 'military';
  return 'industry';
}
