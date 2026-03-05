/**
 * Mega-scaling tiers — buildings scale by orders of magnitude.
 * Same 50 GLB models, brutalist-scaled. Era unlocks ability.
 */
export interface MegaScalingTier {
  tier: number;
  scaleFactor: number;
  label: string;
}

export const MEGA_SCALING_TIERS: MegaScalingTier[] = [
  { tier: 0, scaleFactor: 1, label: 'Base' },
  { tier: 1, scaleFactor: 10, label: 'Tier 1' },
  { tier: 2, scaleFactor: 100, label: 'Tier 2' },
  { tier: 3, scaleFactor: 1000, label: 'Tier 3' },
  { tier: 4, scaleFactor: 10000, label: 'Tier 4' },
  { tier: 5, scaleFactor: 100000, label: 'Tier 5+' },
];

const ERA_MAX_TIER: Record<string, number> = {
  revolution: 0,
  collectivization: 1,
  industrialization: 2,
  wartime: 2,
  reconstruction: 3,
  thaw: 3,
  stagnation: 4,
  perestroika: 4,
  the_eternal: 5,
  // Kardashev sub-eras unlock progressively higher scaling tiers
  post_soviet: 5,
  planetary: 5,
  solar_engineering: 5,
  type_one: 5,
  deconstruction: 5,
  dyson_swarm: 5,
  megaearth: 5,
  type_two_peak: 5,
};

export function getMaxBuildingTier(eraId: string): number {
  return ERA_MAX_TIER[eraId] ?? 0;
}

export function getScaleFactor(tier: number): number {
  const entry = MEGA_SCALING_TIERS.find((t) => t.tier === tier);
  return entry?.scaleFactor ?? 1;
}
